import { Chess } from 'chess.js';
import type { Color, PieceSymbol, Square } from 'chess.js';
import type { GameTermination, MoveRecord } from '../types/chess';
import {
  canCastleChess960,
  parseChess960Pgn,
  parseShredderFen,
  type Chess960CastlingRights,
} from './chess960';

const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

const CAPTURE_ORDER: readonly PieceSymbol[] = ['q', 'r', 'b', 'n', 'p'];

const CAPTURE_RANK: Record<PieceSymbol, number> = {
  q: 0,
  r: 1,
  b: 2,
  n: 3,
  p: 4,
  k: 5,
};

export type PieceInventory = Record<PieceSymbol, number>;

export interface SidePieceInventory {
  w: PieceInventory;
  b: PieceInventory;
}

export interface MaterialSummaryOptions {
  /** Move history up to the displayed position (primary source of truth for captures) */
  moves?: readonly MoveRecord[];
  /** Explicit starting FEN (used only when moves is omitted) */
  initialFen?: string;
  /** Explicit starting inventory (used only when moves is omitted) */
  initialInventory?: SidePieceInventory;
}

export interface MaterialSummary {
  /** Pieces captured BY White (sorted q, r, b, n, p) */
  capturedByWhite: PieceSymbol[];
  /** Pieces captured BY Black (sorted q, r, b, n, p) */
  capturedByBlack: PieceSymbol[];
  /** Positive means White leads in material; negative means Black leads */
  advantage: number;
  /** Total on-board material value for White */
  whiteMaterial: number;
  /** Total on-board material value for Black */
  blackMaterial: number;
}

/**
 * Counts every piece currently on the board directly from a FEN placement string.
 * Supports arbitrary Custom Positions, multiple promoted pieces, and Shredder-FENs.
 */
export function getPieceInventoryFromFen(fen: string): SidePieceInventory {
  const w: PieceInventory = { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 };
  const b: PieceInventory = { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 };
  const placement = fen.trim().split(/\s+/)[0] ?? '';

  for (const ch of placement) {
    if (ch === '/' || (ch >= '1' && ch <= '8')) continue;
    const lower = ch.toLowerCase() as PieceSymbol;
    if (lower in w) {
      if (ch === lower) {
        b[lower] += 1;
      } else {
        w[lower] += 1;
      }
    }
  }

  return { w, b };
}

function sumMaterialValue(inventory: PieceInventory): number {
  return (
    inventory.p * PIECE_VALUES.p +
    inventory.n * PIECE_VALUES.n +
    inventory.b * PIECE_VALUES.b +
    inventory.r * PIECE_VALUES.r +
    inventory.q * PIECE_VALUES.q
  );
}

function inferCapturesFromInventory(
  baseline: PieceInventory,
  current: PieceInventory
): PieceSymbol[] {
  const captured: PieceSymbol[] = [];
  let extraPromoted = 0;

  for (const piece of ['q', 'r', 'b', 'n'] as const) {
    if (current[piece] > baseline[piece]) {
      extraPromoted += current[piece] - baseline[piece];
    }
  }

  for (const piece of CAPTURE_ORDER) {
    const rawMissing = Math.max(0, baseline[piece] - current[piece]);
    const adjusted = piece === 'p' ? Math.max(0, rawMissing - extraPromoted) : rawMissing;
    for (let i = 0; i < adjusted; i++) {
      captured.push(piece);
    }
  }

  return captured;
}

/**
 * Computes captured pieces and on-board material advantage without assuming standard 32-piece starts.
 * - On-board `advantage` always sums actual pieces currently on the board (including promotions & custom armies).
 * - Captured pieces come strictly from `options.moves` (primary source of truth) or explicit
 *   `options.initialInventory` / `options.initialFen`. Never infers captures against hardcoded default counts.
 */
export function getMaterialSummary(
  fen: string,
  options?: MaterialSummaryOptions
): MaterialSummary {
  const current = getPieceInventoryFromFen(fen);
  const whiteMaterial = sumMaterialValue(current.w);
  const blackMaterial = sumMaterialValue(current.b);

  let capturedByWhite: PieceSymbol[] = [];
  let capturedByBlack: PieceSymbol[] = [];

  if (options?.moves !== undefined) {
    for (const m of options.moves) {
      if (!m.captured || m.captured === 'k') continue;
      if (m.color === 'w') {
        capturedByWhite.push(m.captured);
      } else {
        capturedByBlack.push(m.captured);
      }
    }
    capturedByWhite.sort((a, b) => CAPTURE_RANK[a] - CAPTURE_RANK[b]);
    capturedByBlack.sort((a, b) => CAPTURE_RANK[a] - CAPTURE_RANK[b]);
  } else if (options?.initialInventory || options?.initialFen) {
    const baseline = options.initialInventory ?? getPieceInventoryFromFen(options.initialFen!);
    capturedByWhite = inferCapturesFromInventory(baseline.b, current.b);
    capturedByBlack = inferCapturesFromInventory(baseline.w, current.w);
  }

  return {
    capturedByWhite,
    capturedByBlack,
    advantage: whiteMaterial - blackMaterial,
    whiteMaterial,
    blackMaterial,
  };
}

/**
 * Formats a player's numerical material advantage (e.g., '+2') when enabled and positive.
 */
export function formatMaterialDifference(
  materialAdvantage: number,
  showMaterialDifference = true,
): string | null {
  if (!showMaterialDifference) return null;
  if (!Number.isFinite(materialAdvantage) || materialAdvantage <= 0) return null;
  return `+${Math.round(materialAdvantage)}`;
}

/**
 * Checks whether a move leaves a non-pawn piece (N, B, R, Q) hanging for a net material sacrifice
 * of at least 2 points — used to award Brilliant (!!) classifications during analysis.
 */
export function isTacticalPieceSacrifice(move: MoveRecord): boolean {
  if (move.piece === 'p' || move.piece === 'k') return false;
  const before = getMaterialSummary(move.fenBefore).advantage;
  const after = getMaterialSummary(move.fenAfter).advantage;
  const moverMaterialDelta = move.color === 'w' ? after - before : before - after;
  if (moverMaterialDelta >= 2) return false;

  try {
    const nextChess = new Chess(move.fenAfter);
    const opponentCaptures = nextChess
      .moves({ verbose: true })
      .filter((m) => m.to === move.to && Boolean(m.captured));
    if (opponentCaptures.length === 0) return false;
    const sacrificedVal = PIECE_VALUES[move.piece] ?? 0;
    const capturedVal = move.captured ? PIECE_VALUES[move.captured] ?? 0 : 0;
    return sacrificedVal - capturedVal >= 2;
  } catch {
    return false;
  }
}

/**
 * Converts a Stockfish UCI principal variation (e.g. ['e2e4', 'e7e5', 'g1f3'])
 * starting from `fen` into clean SAN tokens (e.g. ['e4', 'e5', 'Nf3']).
 */
export function uciLineToSan(fen: string, uciMoves: string[], maxMoves = 10): string[] {
  const chess = new Chess(fen);
  const sanMoves: string[] = [];

  for (const uci of uciMoves.slice(0, maxMoves)) {
    if (uci.length < 4) break;
    const from = uci.slice(0, 2) as Square;
    const to = uci.slice(2, 4) as Square;
    const promotion = uci.length === 5 ? (uci[4] as PieceSymbol) : undefined;
    try {
      const move = chess.move({ from, to, promotion });
      if (!move) break;
      sanMoves.push(move.san);
    } catch {
      break;
    }
  }

  return sanMoves;
}

/**
 * Formats a SAN PV line starting at a given FEN with proper move numbers (e.g. "4... Nf6 5. O-O Be7").
 */
export function formatPvSanWithNumbers(fen: string, sanMoves: string[]): string {
  if (sanMoves.length === 0) return '';
  const parts = fen.split(' ');
  const turn = (parts[1] as Color) || 'w';
  let moveNum = parseInt(parts[5] || '1', 10) || 1;
  let currentTurn = turn;
  const formatted: string[] = [];

  for (let i = 0; i < sanMoves.length; i++) {
    if (currentTurn === 'w') {
      formatted.push(`${moveNum}. ${sanMoves[i]}`);
      currentTurn = 'b';
    } else {
      if (i === 0) {
        formatted.push(`${moveNum}... ${sanMoves[i]}`);
      } else {
        formatted.push(sanMoves[i]);
      }
      currentTurn = 'w';
      moveNum += 1;
    }
  }

  return formatted.join(' ');
}

/**
 * Strips castling rights from a FEN string for White, Black, or both sides.
 */
export function stripCastlingRights(fen: string, colors: Color | 'both' = 'both'): string {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 4) return fen;

  if (colors === 'both') {
    parts[2] = '-';
    return parts.join(' ');
  }

  const current = parts[2] === '-' ? '' : parts[2];
  const filtered =
    colors === 'w' ? current.replace(/[A-Z]/g, '') : current.replace(/[a-z]/g, '');
  parts[2] = filtered || '-';
  return parts.join(' ');
}

/**
 * Enforces castling rules on a FEN:
 * - Outside Classic mode (`allowCastling = false`), all castling rights are stripped.
 * - In Classic mode, if a side's king has ever moved, that side's castling rights are permanently cut
 *   so returning the king to e1/e8 can never restore castling.
 */
export function sanitizeFenForRules(
  fen: string,
  options: {
    allowCastling: boolean;
    whiteKingMoved?: boolean;
    blackKingMoved?: boolean;
  }
): string {
  if (!options.allowCastling) {
    return stripCastlingRights(fen, 'both');
  }
  let sanitized = fen;
  if (options.whiteKingMoved) {
    sanitized = stripCastlingRights(sanitized, 'w');
  }
  if (options.blackKingMoved) {
    sanitized = stripCastlingRights(sanitized, 'b');
  }
  return sanitized;
}

/**
 * Rebuilds a Chess instance from `initialFen` and replayed `moves` so full move history
 * (needed for threefold repetition and draw detection) is preserved.
 */
export function buildChessWithHistory(
  initialFen: string,
  moves: MoveRecord[],
  allowCastling = true
): Chess {
  const startFen = allowCastling ? initialFen : stripCastlingRights(initialFen, 'both');
  const chess = new Chess(startFen);

  for (const m of moves) {
    try {
      const applied = chess.move({
        from: m.from,
        to: m.to,
        promotion: m.promotion,
      });
      if (!applied) {
        return new Chess(moves[moves.length - 1]?.fenAfter ?? startFen);
      }
    } catch {
      return new Chess(moves[moves.length - 1]?.fenAfter ?? startFen);
    }
  }

  return chess;
}

function getRepetitionKey(fen: string): string {
  const parts = fen.trim().split(/\s+/);
  return parts.slice(0, 4).join(' ');
}

export function hasThreefoldRepetitionInHistory(
  initialFen: string,
  moves: MoveRecord[]
): boolean {
  const counts = new Map<string, number>();
  const bump = (fen: string): number => {
    const key = getRepetitionKey(fen);
    const next = (counts.get(key) ?? 0) + 1;
    counts.set(key, next);
    return next;
  };

  bump(initialFen);
  for (const m of moves) {
    if (bump(m.engineFenAfter ?? m.fenAfter) >= 3) {
      return true;
    }
  }
  return false;
}

export interface AppliedRuleMove {
  fenBefore: string;
  fenAfter: string;
  moveNumber: number;
  color: Color;
  san: string;
  uci: string;
  from: Square;
  to: Square;
  piece: PieceSymbol;
  captured?: PieceSymbol;
  promotion?: PieceSymbol;
  isCastle: boolean;
  isCapture: boolean;
  isPromotion: boolean;
  isCheck: boolean;
  isCheckmate: boolean;
  isDraw: boolean;
}

/**
 * Applies a single legal move while enforcing:
 * - Full move history awareness for draw/threefold-repetition status
 * - Complete revocation of castling rights when a king moves (even if it later returns to e1/e8)
 * - No castling allowed outside Classic mode (`allowCastling = false`)
 */
export function applyRuleMove(params: {
  initialFen: string;
  moves: MoveRecord[];
  from: Square;
  to: Square;
  promotion?: PieceSymbol;
  allowCastling: boolean;
}): AppliedRuleMove | null {
  const { initialFen, moves, from, to, promotion, allowCastling } = params;
  const whiteKingMoved = moves.some((m) => m.color === 'w' && m.piece === 'k');
  const blackKingMoved = moves.some((m) => m.color === 'b' && m.piece === 'k');

  const rawBaseFen = moves.length > 0 ? moves[moves.length - 1].fenAfter : initialFen;
  const sanitizedBaseFen = sanitizeFenForRules(rawBaseFen, {
    allowCastling,
    whiteKingMoved,
    blackKingMoved,
  });
  const moveNumber =
    parseInt(sanitizedBaseFen.split(' ')[5] || '1', 10) || Math.floor(moves.length / 2) + 1;

  const game = new Chess(sanitizedBaseFen);
  let played;
  try {
    played = game.move({ from, to, promotion: promotion ?? 'q' });
  } catch {
    return null;
  }
  if (!played) return null;

  // Reject castling if somehow attempted outside Classic mode
  const isCastle = played.flags.includes('k') || played.flags.includes('q');
  if (!allowCastling && isCastle) {
    return null;
  }

  const nextWhiteKingMoved = whiteKingMoved || (played.color === 'w' && played.piece === 'k');
  const nextBlackKingMoved = blackKingMoved || (played.color === 'b' && played.piece === 'k');
  const fenAfter = sanitizeFenForRules(game.fen(), {
    allowCastling,
    whiteKingMoved: nextWhiteKingMoved,
    blackKingMoved: nextBlackKingMoved,
  });

  const capturedPiece: PieceSymbol | undefined =
    played.captured ?? (played.flags.includes('e') ? 'p' : undefined);

  const nextMovesForCheck: MoveRecord[] = [
    ...moves,
    {
      ply: moves.length + 1,
      moveNumber,
      color: played.color,
      san: played.san,
      uci: `${played.from}${played.to}${played.promotion ?? ''}`,
      from: played.from,
      to: played.to,
      piece: played.piece,
      captured: capturedPiece,
      promotion: played.promotion,
      fenBefore: sanitizedBaseFen,
      fenAfter,
    },
  ];

  const isRepetitionDraw = hasThreefoldRepetitionInHistory(
    allowCastling ? initialFen : stripCastlingRights(initialFen, 'both'),
    nextMovesForCheck
  );

  return {
    fenBefore: sanitizedBaseFen,
    fenAfter,
    moveNumber,
    color: played.color,
    san: played.san,
    uci: `${played.from}${played.to}${played.promotion ?? ''}`,
    from: played.from,
    to: played.to,
    piece: played.piece,
    captured: capturedPiece,
    promotion: played.promotion,
    isCastle,
    isCapture: Boolean(capturedPiece) || played.flags.includes('e'),
    isPromotion: played.flags.includes('p'),
    isCheck: game.inCheck(),
    isCheckmate: game.isCheckmate(),
    isDraw: game.isDraw() || isRepetitionDraw,
  };
}

/**
 * Evaluates full game termination status including board rules, threefold repetition across full
 * move history, clock flag, resignation, and draw agreement.
 */
export function evaluateGameTermination(params: {
  fen: string;
  initialFen?: string;
  initialEngineFen?: string;
  moves?: MoveRecord[];
  chess?: Chess;
  allowCastling?: boolean;
  chess960Rights?: Chess960CastlingRights | null;
  timeoutLoser?: Color | null;
  resignedBy?: Color | null;
  agreedDraw?: boolean;
}): GameTermination {
  if (params.resignedBy) {
    const winner: Color = params.resignedBy === 'w' ? 'b' : 'w';
    return {
      isOver: true,
      winner,
      reason: `${params.resignedBy === 'w' ? 'White' : 'Black'} resigned`,
      resultString: winner === 'w' ? '1-0' : '0-1',
    };
  }

  if (params.timeoutLoser) {
    const winner: Color = params.timeoutLoser === 'w' ? 'b' : 'w';
    return {
      isOver: true,
      winner,
      reason: `${winner === 'w' ? 'White' : 'Black'} won on time`,
      resultString: winner === 'w' ? '1-0' : '0-1',
    };
  }

  if (params.agreedDraw) {
    return {
      isOver: true,
      winner: 'draw',
      reason: 'Draw by agreement',
      resultString: '1/2-1/2',
    };
  }

  const allowCastling = params.allowCastling ?? true;
  const startFen = params.initialFen ?? params.moves?.[0]?.fenBefore ?? params.fen;
  const chess =
    params.chess ??
    (params.moves && params.moves.length > 0
      ? buildChessWithHistory(startFen, params.moves, allowCastling)
      : new Chess(allowCastling ? params.fen : stripCastlingRights(params.fen, 'both')));

  if (chess.isCheckmate()) {
    const winner: Color = chess.turn() === 'w' ? 'b' : 'w';
    return {
      isOver: true,
      winner,
      reason: 'Checkmate',
      resultString: winner === 'w' ? '1-0' : '0-1',
    };
  }
  const canChess960Castle = Boolean(
    params.chess960Rights &&
      (canCastleChess960(params.fen, params.chess960Rights, 'k').legal ||
        canCastleChess960(params.fen, params.chess960Rights, 'q').legal)
  );
  if (chess.isStalemate() && !canChess960Castle) {
    return { isOver: true, winner: 'draw', reason: 'Stalemate', resultString: '1/2-1/2' };
  }
  const initialRepetitionFen =
    params.initialEngineFen ??
    (allowCastling ? startFen : stripCastlingRights(startFen, 'both'));
  if (
    chess.isThreefoldRepetition() ||
    (params.moves &&
      params.moves.length > 0 &&
      hasThreefoldRepetitionInHistory(initialRepetitionFen, params.moves))
  ) {
    return { isOver: true, winner: 'draw', reason: 'Threefold repetition', resultString: '1/2-1/2' };
  }
  if (chess.isInsufficientMaterial()) {
    return { isOver: true, winner: 'draw', reason: 'Insufficient material', resultString: '1/2-1/2' };
  }
  if (chess.isDrawByFiftyMoves() || (chess.isDraw() && !canChess960Castle)) {
    return { isOver: true, winner: 'draw', reason: '50-move rule draw', resultString: '1/2-1/2' };
  }

  return { isOver: false, winner: null, reason: '', resultString: '*' };
}

/**
 * Imports either a FEN position or a PGN game string into a clean initial FEN and MoveRecord list.
 */
export function parsePgnOrFen(input: string): {
  ok: true;
  initialFen: string;
  initialShredderFen?: string;
  initialChess960Rights?: Chess960CastlingRights;
  moves: MoveRecord[];
  variant?: 'Chess960';
} | {
  ok: false;
  error: string;
} {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: 'Please paste a valid FEN or PGN string.' };
  }

  // Try FEN first if it looks like a single-line 4-6 field FEN string
  const fenParts = trimmed.split(/\s+/);
  if (fenParts.length >= 4 && fenParts.length <= 6 && fenParts[0].includes('/')) {
    const parsedShredder = parseShredderFen(trimmed);
    if (parsedShredder.ok && parsedShredder.isChess960Castling) {
      return {
        ok: true,
        initialFen: parsedShredder.fen,
        initialShredderFen: parsedShredder.shredderFen,
        initialChess960Rights: parsedShredder.castlingRights,
        moves: [],
        variant: 'Chess960',
      };
    }
    try {
      const testChess = new Chess(trimmed);
      return { ok: true, initialFen: testChess.fen(), moves: [] };
    } catch {
      return { ok: false, error: 'Invalid FEN notation. Check piece placement and turn fields.' };
    }
  }

  // Detect Chess960 PGN via [Variant "Chess960"/"Fischerandom"] or Shredder/X-FEN header
  const variantMatch = trimmed.match(/^\s*\[Variant\s+"([^"]+)"\]\s*$/im);
  const fenHeaderMatch = trimmed.match(/^\s*\[FEN\s+"([^"]+)"\]\s*$/im);
  const normalizedVariantHeader = (variantMatch?.[1] ?? '').trim().toLowerCase();
  const isChess960Header =
    normalizedVariantHeader === 'chess960' || normalizedVariantHeader === 'fischerandom';
  const parsedHeaderFen = fenHeaderMatch ? parseShredderFen(fenHeaderMatch[1]) : null;
  const hasChess960HeaderFen = Boolean(parsedHeaderFen?.ok && parsedHeaderFen.isChess960Castling);

  if (isChess960Header || hasChess960HeaderFen) {
    return parseChess960Pgn(trimmed);
  }

  // Otherwise try loading as Standard PGN via chess.js
  try {
    const pgnChess = new Chess();
    pgnChess.loadPgn(trimmed);
    const verboseHistory = pgnChess.history({ verbose: true });

    // Extract custom starting FEN header if present
    const headers = pgnChess.getHeaders();
    const startFen = headers['FEN'] || new Chess().fen();
    const replay = new Chess(startFen);
    const records: MoveRecord[] = [];

    verboseHistory.forEach((m, index) => {
      const fenBefore = replay.fen();
      const moveNum = parseInt(fenBefore.split(' ')[5] || '1', 10) || Math.floor(index / 2) + 1;
      const applied = replay.move({
        from: m.from,
        to: m.to,
        promotion: m.promotion,
      });
      if (!applied) return;
      records.push({
        ply: index + 1,
        moveNumber: moveNum,
        color: applied.color,
        san: applied.san,
        uci: `${applied.from}${applied.to}${applied.promotion ?? ''}`,
        from: applied.from,
        to: applied.to,
        piece: applied.piece,
        captured: applied.captured ?? (applied.flags.includes('e') ? 'p' : undefined),
        promotion: applied.promotion,
        fenBefore,
        fenAfter: replay.fen(),
      });
    });

    return { ok: true, initialFen: startFen, moves: records };
  } catch {
    return { ok: false, error: 'Could not parse input as valid FEN or PGN.' };
  }
}

/**
 * Generates clean standard PGN text from game move history and metadata.
 */
export function buildPgn(params: {
  initialFen: string;
  moves: MoveRecord[];
  whiteName: string;
  blackName: string;
  result: '1-0' | '0-1' | '1/2-1/2' | '*';
  variant?: 'Chess960';
  pgnInitialFen?: string;
}): string {
  const defaultFen = new Chess().fen();
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  const lines: string[] = [
    `[Event "${params.variant === 'Chess960' ? 'Crownline Chess960 Match' : 'Crownline Chess Match'}"]`,
    `[Site "Crownline Chess"]`,
    `[Date "${dateStr}"]`,
    `[White "${params.whiteName}"]`,
    `[Black "${params.blackName}"]`,
    `[Result "${params.result}"]`,
  ];

  if (params.variant === 'Chess960') {
    lines.push(`[Variant "Chess960"]`);
  }

  const effectiveFen = params.pgnInitialFen ?? params.initialFen;
  if (effectiveFen !== defaultFen || params.variant === 'Chess960') {
    lines.push(`[SetUp "1"]`);
    lines.push(`[FEN "${effectiveFen}"]`);
  }

  lines.push('');

  const moveTokens: string[] = [];
  for (let i = 0; i < params.moves.length; i++) {
    const m = params.moves[i];
    if (m.color === 'w') {
      moveTokens.push(`${m.moveNumber}. ${m.san}`);
    } else {
      if (i === 0) {
        moveTokens.push(`${m.moveNumber}... ${m.san}`);
      } else {
        moveTokens.push(m.san);
      }
    }
  }
  moveTokens.push(params.result);
  lines.push(moveTokens.join(' '));

  return lines.join('\n');
}

/**
 * Formats seconds into mm:ss or m:ss.d when under 10 seconds.
 */
export function formatClock(seconds: number): string {
  const clamped = Math.max(0, seconds);
  if (clamped < 10 && clamped > 0) {
    return `0:0${clamped.toFixed(1)}`;
  }
  const mins = Math.floor(clamped / 60);
  const secs = Math.floor(clamped % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

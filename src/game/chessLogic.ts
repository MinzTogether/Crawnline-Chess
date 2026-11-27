import { Chess } from 'chess.js';
import type { Color, PieceSymbol, Square } from 'chess.js';
import type { GameTermination, MoveRecord } from '../types/chess';

const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

const STARTING_COUNTS: Record<PieceSymbol, number> = {
  p: 8,
  n: 2,
  b: 2,
  r: 2,
  q: 1,
  k: 1,
};

export interface MaterialSummary {
  /** Pieces captured BY White (i.e. missing Black pieces) */
  capturedByWhite: PieceSymbol[];
  /** Pieces captured BY Black (i.e. missing White pieces) */
  capturedByBlack: PieceSymbol[];
  /** Positive means White leads in material; negative means Black leads */
  advantage: number;
}

/**
 * Computes captured pieces and material advantage directly from any FEN.
 */
export function getMaterialSummary(fen: string): MaterialSummary {
  const chess = new Chess(fen);
  const board = chess.board();
  const whiteCounts: Record<PieceSymbol, number> = { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 };
  const blackCounts: Record<PieceSymbol, number> = { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 };

  let whiteMaterial = 0;
  let blackMaterial = 0;

  for (const row of board) {
    for (const sq of row) {
      if (!sq) continue;
      if (sq.color === 'w') {
        whiteCounts[sq.type] += 1;
        whiteMaterial += PIECE_VALUES[sq.type];
      } else {
        blackCounts[sq.type] += 1;
        blackMaterial += PIECE_VALUES[sq.type];
      }
    }
  }

  const order: PieceSymbol[] = ['q', 'r', 'b', 'n', 'p'];
  const capturedByWhite: PieceSymbol[] = [];
  const capturedByBlack: PieceSymbol[] = [];

  for (const piece of order) {
    const missingBlack = Math.max(0, STARTING_COUNTS[piece] - blackCounts[piece]);
    for (let i = 0; i < missingBlack; i++) capturedByWhite.push(piece);
    const missingWhite = Math.max(0, STARTING_COUNTS[piece] - whiteCounts[piece]);
    for (let i = 0; i < missingWhite; i++) capturedByBlack.push(piece);
  }

  return {
    capturedByWhite,
    capturedByBlack,
    advantage: whiteMaterial - blackMaterial,
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

function hasThreefoldRepetitionInHistory(initialFen: string, moves: MoveRecord[]): boolean {
  const counts = new Map<string, number>();
  const bump = (fen: string): number => {
    const key = getRepetitionKey(fen);
    const next = (counts.get(key) ?? 0) + 1;
    counts.set(key, next);
    return next;
  };

  bump(initialFen);
  for (const m of moves) {
    if (bump(m.fenAfter) >= 3) {
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
      captured: played.captured,
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
    captured: played.captured,
    promotion: played.promotion,
    isCastle,
    isCapture: Boolean(played.captured) || played.flags.includes('e'),
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
  moves?: MoveRecord[];
  chess?: Chess;
  allowCastling?: boolean;
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
  if (chess.isStalemate()) {
    return { isOver: true, winner: 'draw', reason: 'Stalemate', resultString: '1/2-1/2' };
  }
  if (
    chess.isThreefoldRepetition() ||
    (params.moves &&
      params.moves.length > 0 &&
      hasThreefoldRepetitionInHistory(
        allowCastling ? startFen : stripCastlingRights(startFen, 'both'),
        params.moves
      ))
  ) {
    return { isOver: true, winner: 'draw', reason: 'Threefold repetition', resultString: '1/2-1/2' };
  }
  if (chess.isInsufficientMaterial()) {
    return { isOver: true, winner: 'draw', reason: 'Insufficient material', resultString: '1/2-1/2' };
  }
  if (chess.isDraw()) {
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
  moves: MoveRecord[];
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
    try {
      const testChess = new Chess(trimmed);
      return { ok: true, initialFen: testChess.fen(), moves: [] };
    } catch {
      return { ok: false, error: 'Invalid FEN notation. Check piece placement and turn fields.' };
    }
  }

  // Otherwise try loading as PGN
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
        captured: applied.captured,
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

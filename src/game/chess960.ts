import { Chess } from 'chess.js';
import type { Color, PieceSymbol, Square } from 'chess.js';
import { BOARD_FILES, fenToBoardMap, type BoardMap } from './customPosition';

export interface Chess960CastlingRights {
  /** White kingside rook file index (0..7), or null if lost */
  wK: number | null;
  /** White queenside rook file index (0..7), or null if lost */
  wQ: number | null;
  /** Black kingside rook file index (0..7), or null if lost */
  bK: number | null;
  /** Black queenside rook file index (0..7), or null if lost */
  bQ: number | null;
}

export interface Chess960Position {
  /** Official Scharnagl starting position ID (0..959). 518 is Standard Chess. */
  id: number;
  /** Back rank pieces from file a (0) to file h (7) */
  backRank: PieceSymbol[];
  /** chess.js-compatible FEN (castling field '-' when non-standard) */
  fen: string;
  /** Stockfish UCI_Chess960 Shredder-FEN (e.g. "bbqnnrkr/... w HFhf - 0 1") */
  shredderFen: string;
  /** Initial castling rook files */
  castlingRights: Chess960CastlingRights;
}

export interface Chess960MoveResult {
  fenAfter: string;
  shredderFenAfter: string;
  castlingRightsAfter: Chess960CastlingRights;
  san: string;
  uci: string;
  from: Square;
  to: Square;
  piece: PieceSymbol;
  color: Color;
  captured?: PieceSymbol;
  promotion?: PieceSymbol;
  isCastle: boolean;
  isCapture: boolean;
  isPromotion: boolean;
  isCheck: boolean;
  isCheckmate: boolean;
  isDraw: boolean;
}

export interface Chess960LegalTarget {
  /** Square the user clicks or drags onto */
  targetSquare: Square;
  isCapture: boolean;
  isPromotion: boolean;
  isCastle: boolean;
  castleSide?: 'k' | 'q';
  /** Canonical rook square when castling */
  castleRookSquare?: Square;
}

const KNIGHT_COMBINATIONS: readonly [number, number][] = [
  [0, 1],
  [0, 2],
  [0, 3],
  [0, 4],
  [1, 2],
  [1, 3],
  [1, 4],
  [2, 3],
  [2, 4],
  [3, 4],
];

/**
 * Official FIDE / Scharnagl Chess960 back-rank generator.
 * Maps every integer 0..959 deterministically to a unique valid Chess960 arrangement.
 * Index 518 produces standard chess: ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'].
 */
export function getChess960BackRank(id: number): PieceSymbol[] {
  const normalized = ((Math.floor(id) % 960) + 960) % 960;
  const rank: (PieceSymbol | null)[] = Array(8).fill(null);

  // 1. Light-squared bishop (files b=1, d=3, f=5, h=7 on rank 1)
  const b1 = normalized % 4;
  let n = Math.floor(normalized / 4);
  rank[b1 * 2 + 1] = 'b';

  // 2. Dark-squared bishop (files a=0, c=2, e=4, g=6 on rank 1)
  const b2 = n % 4;
  n = Math.floor(n / 4);
  rank[b2 * 2] = 'b';

  // 3. Queen on one of the 6 remaining empty squares
  const q = n % 6;
  n = Math.floor(n / 6);
  let emptyIdx = 0;
  for (let i = 0; i < 8; i++) {
    if (rank[i] === null) {
      if (emptyIdx === q) {
        rank[i] = 'q';
        break;
      }
      emptyIdx += 1;
    }
  }

  // 4. Two knights on 2 of the 5 remaining empty squares (0..9)
  const [n1, n2] = KNIGHT_COMBINATIONS[n % 10];
  emptyIdx = 0;
  for (let i = 0; i < 8; i++) {
    if (rank[i] === null) {
      if (emptyIdx === n1 || emptyIdx === n2) {
        rank[i] = 'n';
      }
      emptyIdx += 1;
    }
  }

  // 5. Remaining 3 empty squares MUST be Rook - King - Rook (left to right)
  const rkr: PieceSymbol[] = ['r', 'k', 'r'];
  let rkrIdx = 0;
  for (let i = 0; i < 8; i++) {
    if (rank[i] === null) {
      rank[i] = rkr[rkrIdx++];
    }
  }

  return rank as PieceSymbol[];
}

export function isStandardBackRank(backRank: PieceSymbol[]): boolean {
  const std: PieceSymbol[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  return backRank.length === 8 && backRank.every((p, i) => p === std[i]);
}

/**
 * Formats Chess960 castling rights into Shredder-FEN castling token (e.g. "HFhf" or "-").
 */
export function formatShredderCastling(rights: Chess960CastlingRights): string {
  let out = '';
  if (rights.wK !== null) out += BOARD_FILES[rights.wK].toUpperCase();
  if (rights.wQ !== null) out += BOARD_FILES[rights.wQ].toUpperCase();
  if (rights.bK !== null) out += BOARD_FILES[rights.bK];
  if (rights.bQ !== null) out += BOARD_FILES[rights.bQ];
  return out || '-';
}

/**
 * Replaces the castling field in a standard chess.js FEN with Chess960 Shredder-FEN rights
 * so Stockfish (with UCI_Chess960=true) evaluates and plays Chess960 castling accurately.
 */
export function toShredderFen(fen: string, rights: Chess960CastlingRights): string {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 4) return fen;
  parts[2] = formatShredderCastling(rights);
  return parts.join(' ');
}

/**
 * Builds a complete Chess960 starting position for a given Scharnagl ID (0..959).
 */
export function createChess960Position(id?: number, rng: () => number = Math.random): Chess960Position {
  let resolvedId: number;
  if (typeof id === 'number' && Number.isFinite(id)) {
    resolvedId = ((Math.floor(id) % 960) + 960) % 960;
  } else {
    // Pick any non-standard Chess960 position (avoiding #518 unless explicitly requested)
    let candidate = Math.floor(rng() * 960);
    if (candidate === 518) {
      candidate = (candidate + 1 + Math.floor(rng() * 958)) % 960;
    }
    resolvedId = candidate;
  }

  const backRank = getChess960BackRank(resolvedId);

  // Castling is disabled outside Classic mode
  const castlingRights: Chess960CastlingRights = {
    wK: null,
    wQ: null,
    bK: null,
    bQ: null,
  };

  const blackRow = backRank.join('');
  const whiteRow = blackRow.toUpperCase();
  const baseFen = `${blackRow}/pppppppp/8/8/8/8/PPPPPPPP/${whiteRow} w - - 0 1`;
  const shredderFen = toShredderFen(baseFen, castlingRights);

  return {
    id: resolvedId,
    backRank,
    fen: baseFen,
    shredderFen,
    castlingRights,
  };
}

function fileIndex(sq: Square): number {
  return sq.charCodeAt(0) - 97;
}

function makeSquare(fileIdx: number, rank: '1' | '8'): Square {
  return `${BOARD_FILES[fileIdx]}${rank}` as Square;
}

function findKingSquare(chess: Chess, color: Color): Square | null {
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = board[r][c];
      if (cell && cell.type === 'k' && cell.color === color) {
        return cell.square;
      }
    }
  }
  return null;
}

function boardMapToPiecePlacement(board: BoardMap): string {
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'] as const;
  return ranks
    .map((rank) => {
      let row = '';
      let empty = 0;
      for (const file of BOARD_FILES) {
        const piece = board[`${file}${rank}` as Square];
        if (!piece) {
          empty += 1;
        } else {
          if (empty > 0) {
            row += String(empty);
            empty = 0;
          }
          row += piece.color === 'w' ? piece.type.toUpperCase() : piece.type;
        }
      }
      if (empty > 0) row += String(empty);
      return row;
    })
    .join('/');
}

/**
 * Checks whether Chess960 castling on side ('k' = kingside O-O, 'q' = queenside O-O-O) is strictly legal
 * under FIDE / Chess.com Chess960 rules.
 */
export function canCastleChess960(
  fen: string,
  rights: Chess960CastlingRights,
  side: 'k' | 'q'
): {
  legal: boolean;
  kingFrom?: Square;
  rookFrom?: Square;
  kingTo?: Square;
  rookTo?: Square;
  fenAfter?: string;
} {
  const chess = new Chess(fen);
  const color = chess.turn();
  const rank: '1' | '8' = color === 'w' ? '1' : '8';
  const opponent: Color = color === 'w' ? 'b' : 'w';

  const rookFile = color === 'w' ? (side === 'k' ? rights.wK : rights.wQ) : side === 'k' ? rights.bK : rights.bQ;
  if (rookFile === null) return { legal: false };

  const kingFrom = findKingSquare(chess, color);
  if (!kingFrom || kingFrom[1] !== rank) return { legal: false };

  const rookFrom = makeSquare(rookFile, rank);
  const rookPiece = chess.get(rookFrom);
  if (!rookPiece || rookPiece.type !== 'r' || rookPiece.color !== color) {
    return { legal: false };
  }

  const kFromFile = fileIndex(kingFrom);
  // Sanity: kingside rook must be to the right of king; queenside rook must be to the left
  if (side === 'k' && rookFile <= kFromFile) return { legal: false };
  if (side === 'q' && rookFile >= kFromFile) return { legal: false };

  const kToFile = side === 'k' ? 6 : 2; // g or c
  const rToFile = side === 'k' ? 5 : 3; // f or d
  const kingTo = makeSquare(kToFile, rank);
  const rookTo = makeSquare(rToFile, rank);

  // 1. All squares on king path [kFrom..kTo] and rook path [rFrom..rTo] must be empty except kFrom and rFrom
  const minFile = Math.min(kFromFile, kToFile, rookFile, rToFile);
  const maxFile = Math.max(kFromFile, kToFile, rookFile, rToFile);
  for (let f = minFile; f <= maxFile; f++) {
    if (f === kFromFile || f === rookFile) continue;
    const sq = makeSquare(f, rank);
    if (chess.get(sq)) {
      return { legal: false };
    }
  }

  // 2. King cannot be in check and cannot pass through or land on an attacked square
  const kMin = Math.min(kFromFile, kToFile);
  const kMax = Math.max(kFromFile, kToFile);
  for (let f = kMin; f <= kMax; f++) {
    const sq = makeSquare(f, rank);
    if (chess.isAttacked(sq, opponent)) {
      return { legal: false };
    }
  }

  // 3. Build resulting FEN and verify king on kingTo is NOT in check (catches rare rank-1 rook-pin discovery)
  const parts = fen.trim().split(/\s+/);
  const board = fenToBoardMap(fen);
  delete board[kingFrom];
  delete board[rookFrom];
  board[kingTo] = { type: 'k', color };
  board[rookTo] = { type: 'r', color };

  const nextTurn: Color = opponent;
  const halfMove = (parseInt(parts[4] || '0', 10) || 0) + 1;
  const fullMove = (parseInt(parts[5] || '1', 10) || 1) + (color === 'b' ? 1 : 0);
  const fenAfter = `${boardMapToPiecePlacement(board)} ${nextTurn} - - ${halfMove} ${fullMove}`;

  try {
    const afterChess = new Chess(fenAfter);
    if (afterChess.isAttacked(kingTo, opponent)) {
      return { legal: false };
    }
    return {
      legal: true,
      kingFrom,
      rookFrom,
      kingTo,
      rookTo,
      fenAfter: afterChess.fen(),
    };
  } catch {
    return { legal: false };
  }
}

/**
 * Updates Chess960 castling rights after a regular or castling move.
 */
export function updateChess960CastlingRights(
  rights: Chess960CastlingRights,
  moverColor: Color,
  pieceMoved: PieceSymbol,
  from: Square,
  to: Square
): Chess960CastlingRights {
  const next: Chess960CastlingRights = { ...rights };

  if (pieceMoved === 'k') {
    if (moverColor === 'w') {
      next.wK = null;
      next.wQ = null;
    } else {
      next.bK = null;
      next.bQ = null;
    }
  }

  // Moving from or capturing onto any home rook square revokes that rook's castling right
  const checkSquare = (sq: Square) => {
    if (sq[1] === '1') {
      const f = fileIndex(sq);
      if (next.wK === f) next.wK = null;
      if (next.wQ === f) next.wQ = null;
    } else if (sq[1] === '8') {
      const f = fileIndex(sq);
      if (next.bK === f) next.bK = null;
      if (next.bQ === f) next.bQ = null;
    }
  };

  checkSquare(from);
  checkSquare(to);

  return next;
}

/**
 * Computes all legal targets for a selected square in Chess960, following exact Chess.com UX:
 * - Standard moves for any piece (excluding chess.js standard castling since FEN has '-').
 * - When the King is selected, legal Chess960 castling adds:
 *   1. The castling Rook's own square (king-onto-rook castling — ALWAYS works in Chess960).
 *   2. The king's destination square (g1/c1 or g8/c8) ONLY when it is not the king's own square,
 *      not the rook's square, and NOT already a legal 1-square king step (just like Chess.com!).
 */
export function getChess960LegalTargets(
  fen: string,
  rights: Chess960CastlingRights,
  from: Square
): Map<Square, Chess960LegalTarget> {
  const map = new Map<Square, Chess960LegalTarget>();
  const chess = new Chess(fen);
  const piece = chess.get(from);
  if (!piece || piece.color !== chess.turn()) return map;

  const stdMoves = chess.moves({ square: from, verbose: true });
  for (const m of stdMoves) {
    // Ignore any standard chess.js castling flag (Chess960 handles castling below)
    if (m.flags.includes('k') || m.flags.includes('q')) continue;
    map.set(m.to, {
      targetSquare: m.to,
      isCapture: Boolean(m.captured) || m.flags.includes('e'),
      isPromotion: m.flags.includes('p'),
      isCastle: false,
    });
  }

  if (piece.type === 'k') {
    for (const side of ['k', 'q'] as const) {
      const check = canCastleChess960(fen, rights, side);
      if (!check.legal || !check.kingFrom || !check.rookFrom || !check.kingTo) continue;
      if (check.kingFrom !== from) continue;

      // 1. Clicking/dragging King directly onto own Rook ALWAYS castles
      map.set(check.rookFrom, {
        targetSquare: check.rookFrom,
        isCapture: false,
        isPromotion: false,
        isCastle: true,
        castleSide: side,
        castleRookSquare: check.rookFrom,
      });

      // 2. Clicking/dragging King to g1/c1 ALSO castles if g1/c1 is not already a 1-square king move and != from/rook
      if (check.kingTo !== from && check.kingTo !== check.rookFrom && !map.has(check.kingTo)) {
        map.set(check.kingTo, {
          targetSquare: check.kingTo,
          isCapture: false,
          isPromotion: false,
          isCastle: true,
          castleSide: side,
          castleRookSquare: check.rookFrom,
        });
      }
    }
  }

  return map;
}

/**
 * Executes either a Chess960 castling move or a regular move, returning full MoveRecord fields,
 * updated chess.js FEN, updated Shredder-FEN, and updated Chess960 castling rights.
 */
export function applyChess960Move(
  fen: string,
  rights: Chess960CastlingRights,
  from: Square,
  to: Square,
  promotion?: PieceSymbol
): Chess960MoveResult | null {
  const chess = new Chess(fen);
  const piece = chess.get(from);
  if (!piece || piece.color !== chess.turn()) return null;

  // Check if this (from, to) triggers a Chess960 castling move
  if (piece.type === 'k') {
    const targets = getChess960LegalTargets(fen, rights, from);
    const chosen = targets.get(to);
    if (chosen?.isCastle && chosen.castleSide) {
      const check = canCastleChess960(fen, rights, chosen.castleSide);
      if (!check.legal || !check.fenAfter || !check.kingFrom || !check.rookFrom || !check.kingTo) {
        return null;
      }

      const nextRights = updateChess960CastlingRights(rights, piece.color, 'k', check.kingFrom, check.rookFrom);
      const afterChess = new Chess(check.fenAfter);
      const isCheckmate = afterChess.isCheckmate();
      const isCheck = afterChess.inCheck();
      const isDraw = afterChess.isDraw();
      const suffix = isCheckmate ? '#' : isCheck ? '+' : '';
      const san = `${chosen.castleSide === 'k' ? 'O-O' : 'O-O-O'}${suffix}`;

      return {
        fenAfter: check.fenAfter,
        shredderFenAfter: toShredderFen(check.fenAfter, nextRights),
        castlingRightsAfter: nextRights,
        san,
        // Canonical UCI_Chess960 notation is kingFrom + rookFrom (e.g. "e1h1", "g1h1")
        uci: `${check.kingFrom}${check.rookFrom}`,
        from: check.kingFrom,
        to: check.kingTo,
        piece: 'k',
        color: piece.color,
        isCastle: true,
        isCapture: false,
        isPromotion: false,
        isCheck,
        isCheckmate,
        isDraw,
      };
    }
  }

  // Otherwise execute as a standard move via chess.js
  let played;
  try {
    played = chess.move({ from, to, promotion: promotion ?? 'q' });
  } catch {
    return null;
  }
  if (!played) return null;

  const fenAfter = chess.fen();
  const nextRights = updateChess960CastlingRights(rights, played.color, played.piece, played.from, played.to);

  return {
    fenAfter,
    shredderFenAfter: toShredderFen(fenAfter, nextRights),
    castlingRightsAfter: nextRights,
    san: played.san,
    uci: `${played.from}${played.to}${played.promotion ?? ''}`,
    from: played.from,
    to: played.to,
    piece: played.piece,
    color: played.color,
    captured: played.captured,
    promotion: played.promotion,
    isCastle: false,
    isCapture: Boolean(played.captured) || played.flags.includes('e'),
    isPromotion: played.flags.includes('p'),
    isCheck: chess.inCheck(),
    isCheckmate: chess.isCheckmate(),
    isDraw: chess.isDraw(),
  };
}

/**
 * Converts a Stockfish UCI principal variation (including UCI_Chess960 king-captures-rook castling moves)
 * into clean SAN tokens starting from a Chess960 position.
 */
export function uciLineToSan960(
  fen: string,
  rights: Chess960CastlingRights,
  uciMoves: string[],
  maxMoves = 10
): string[] {
  let curFen = fen;
  let curRights = rights;
  const sanMoves: string[] = [];

  for (const uci of uciMoves.slice(0, maxMoves)) {
    if (uci.length < 4) break;
    const from = uci.slice(0, 2) as Square;
    const to = uci.slice(2, 4) as Square;
    const promo = uci.length === 5 ? (uci[4] as PieceSymbol) : undefined;
    const applied = applyChess960Move(curFen, curRights, from, to, promo);
    if (!applied) break;
    sanMoves.push(applied.san);
    curFen = applied.fenAfter;
    curRights = applied.castlingRightsAfter;
  }

  return sanMoves;
}

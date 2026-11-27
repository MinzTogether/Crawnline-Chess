import { Chess } from 'chess.js';
import type { Color, PieceSymbol, Square } from 'chess.js';

export interface BoardPiece {
  type: PieceSymbol;
  color: Color;
}

export type BoardMap = Partial<Record<Square, BoardPiece>>;

export const STANDARD_START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const BOARD_FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
export const BOARD_RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'] as const;

export const ALL_SQUARES: Square[] = BOARD_RANKS.flatMap((rank) =>
  BOARD_FILES.map((file) => `${file}${rank}` as Square)
);

export type CustomPositionErrorKey =
  | 'customErrWhiteKing'
  | 'customErrBlackKing'
  | 'customErrPawnEdge'
  | 'customErrOpponentCheck'
  | 'customErrNoLegalMoves'
  | 'customErrInvalid';

export type CustomPositionValidation =
  | { valid: true; fen: string }
  | { valid: false; errorKey: CustomPositionErrorKey };

/**
 * Parses the piece-placement section of any FEN into a Square -> BoardPiece map.
 */
export function fenToBoardMap(fen: string): BoardMap {
  const board: BoardMap = {};
  const placement = fen.trim().split(/\s+/)[0] ?? '';
  const rows = placement.split('/');
  if (rows.length !== 8) return board;

  for (let r = 0; r < 8; r++) {
    let fileIdx = 0;
    const rankChar = BOARD_RANKS[r];
    for (const ch of rows[r]) {
      if (ch >= '1' && ch <= '8') {
        fileIdx += Number(ch);
      } else {
        const lower = ch.toLowerCase();
        if (
          fileIdx < 8 &&
          (lower === 'p' || lower === 'n' || lower === 'b' || lower === 'r' || lower === 'q' || lower === 'k')
        ) {
          const sq = `${BOARD_FILES[fileIdx]}${rankChar}` as Square;
          board[sq] = {
            type: lower as PieceSymbol,
            color: ch === ch.toUpperCase() ? 'w' : 'b',
          };
          fileIdx += 1;
        }
      }
    }
  }
  return board;
}

/**
 * Serializes a BoardMap + side-to-move into a clean, engine-safe FEN string.
 * Castling flags are only granted when kings and rooks stand on standard home squares.
 */
export function boardMapToFen(board: BoardMap, turn: Color = 'w', allowStandardCastling = false): string {
  const rankRows: string[] = [];

  for (const rank of BOARD_RANKS) {
    let rowStr = '';
    let emptyRun = 0;
    for (const file of BOARD_FILES) {
      const sq = `${file}${rank}` as Square;
      const piece = board[sq];
      if (!piece) {
        emptyRun += 1;
      } else {
        if (emptyRun > 0) {
          rowStr += String(emptyRun);
          emptyRun = 0;
        }
        rowStr += piece.color === 'w' ? piece.type.toUpperCase() : piece.type;
      }
    }
    if (emptyRun > 0) {
      rowStr += String(emptyRun);
    }
    rankRows.push(rowStr);
  }

  let castling = '-';
  if (allowStandardCastling) {
    let rights = '';
    if (board.e1?.color === 'w' && board.e1?.type === 'k') {
      if (board.h1?.color === 'w' && board.h1?.type === 'r') rights += 'K';
      if (board.a1?.color === 'w' && board.a1?.type === 'r') rights += 'Q';
    }
    if (board.e8?.color === 'b' && board.e8?.type === 'k') {
      if (board.h8?.color === 'b' && board.h8?.type === 'r') rights += 'k';
      if (board.a8?.color === 'b' && board.a8?.type === 'r') rights += 'q';
    }
    castling = rights || '-';
  }

  return `${rankRows.join('/')} ${turn} ${castling} - 0 1`;
}

/**
 * Moves a piece to an empty target square or swaps two pieces when both squares are occupied.
 */
export function swapOrMoveSquare(board: BoardMap, from: Square, to: Square): BoardMap {
  if (from === to) return board;
  const sourcePiece = board[from];
  if (!sourcePiece) return board;

  const next: BoardMap = { ...board };
  const targetPiece = board[to];

  next[to] = { ...sourcePiece };
  if (targetPiece) {
    next[from] = { ...targetPiece };
  } else {
    delete next[from];
  }
  return next;
}

/**
 * Places a piece onto a square, or removes the piece when `piece` is null.
 */
export function setSquarePiece(board: BoardMap, square: Square, piece: BoardPiece | null): BoardMap {
  const next: BoardMap = { ...board };
  if (!piece) {
    delete next[square];
  } else {
    next[square] = { ...piece };
  }
  return next;
}

/**
 * Returns a minimal legal starting board with only the two kings placed.
 */
export function createKingsOnlyBoard(): BoardMap {
  return {
    e1: { type: 'k', color: 'w' },
    e8: { type: 'k', color: 'b' },
  };
}

function squareCoords(sq: Square): { file: number; rank: number } {
  return {
    file: sq.charCodeAt(0) - 97,
    rank: Number(sq[1]),
  };
}

function areKingsAdjacent(sqA: Square, sqB: Square): boolean {
  const a = squareCoords(sqA);
  const b = squareCoords(sqB);
  return Math.abs(a.file - b.file) <= 1 && Math.abs(a.rank - b.rank) <= 1;
}

/**
 * Validates that a custom board can start a legal chess match in chess.js and Stockfish.
 */
export function validateCustomPosition(board: BoardMap, turn: Color = 'w'): CustomPositionValidation {
  let whiteKings = 0;
  let blackKings = 0;
  let whiteKingSq: Square | null = null;
  let blackKingSq: Square | null = null;

  for (const sq of ALL_SQUARES) {
    const piece = board[sq];
    if (!piece) continue;
    if (piece.type === 'k') {
      if (piece.color === 'w') {
        whiteKings += 1;
        whiteKingSq = sq;
      } else {
        blackKings += 1;
        blackKingSq = sq;
      }
    }
    if (piece.type === 'p' && (sq[1] === '1' || sq[1] === '8')) {
      return { valid: false, errorKey: 'customErrPawnEdge' };
    }
  }

  if (whiteKings !== 1 || !whiteKingSq) {
    return { valid: false, errorKey: 'customErrWhiteKing' };
  }
  if (blackKings !== 1 || !blackKingSq) {
    return { valid: false, errorKey: 'customErrBlackKing' };
  }
  if (areKingsAdjacent(whiteKingSq, blackKingSq)) {
    return { valid: false, errorKey: 'customErrOpponentCheck' };
  }

  const fen = boardMapToFen(board, turn, true);
  try {
    const chess = new Chess(fen);
    const opponent: Color = turn === 'w' ? 'b' : 'w';
    const opponentKingSq = opponent === 'w' ? whiteKingSq : blackKingSq;
    if (chess.isAttacked(opponentKingSq, turn)) {
      return { valid: false, errorKey: 'customErrOpponentCheck' };
    }
    if (chess.moves().length === 0) {
      return { valid: false, errorKey: 'customErrNoLegalMoves' };
    }
    return { valid: true, fen: chess.fen() };
  } catch {
    return { valid: false, errorKey: 'customErrInvalid' };
  }
}

function shuffleArray<T>(items: T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const STANDARD_NON_KING_PIECES: BoardPiece[] = [
  { type: 'q', color: 'w' },
  { type: 'r', color: 'w' },
  { type: 'r', color: 'w' },
  { type: 'b', color: 'w' },
  { type: 'b', color: 'w' },
  { type: 'n', color: 'w' },
  { type: 'n', color: 'w' },
  { type: 'q', color: 'b' },
  { type: 'r', color: 'b' },
  { type: 'r', color: 'b' },
  { type: 'b', color: 'b' },
  { type: 'b', color: 'b' },
  { type: 'n', color: 'b' },
  { type: 'n', color: 'b' },
];

const STANDARD_PAWNS: BoardPiece[] = [
  ...Array.from({ length: 8 }, (): BoardPiece => ({ type: 'p', color: 'w' })),
  ...Array.from({ length: 8 }, (): BoardPiece => ({ type: 'p', color: 'b' })),
];

const MIDDLE_RANK_SQUARES: Square[] = ALL_SQUARES.filter((sq) => sq[1] !== '1' && sq[1] !== '8');

/**
 * Generates a rule-free chaotic Random Chess FEN where all 32 standard pieces
 * are randomly shuffled across the 8x8 board (no Chess960 symmetry constraints),
 * while still guaranteeing legal playability in chess.js and Stockfish.
 */
export function generateRandomChessFen(rng: () => number = Math.random): string {
  // Primary chaotic shuffle: scramble all 32 pieces freely across all 64 squares
  // (pawns restricted to ranks 2-7 per chess engine legality; all other pieces anywhere on ranks 1-8)
  for (let attempt = 0; attempt < 120; attempt++) {
    const board: BoardMap = {};
    const shuffledMiddle = shuffleArray(MIDDLE_RANK_SQUARES, rng);
    const shuffledPawns = shuffleArray(STANDARD_PAWNS, rng);

    const used = new Set<Square>();
    for (let i = 0; i < shuffledPawns.length; i++) {
      const sq = shuffledMiddle[i];
      board[sq] = shuffledPawns[i];
      used.add(sq);
    }

    const remainingSquares = shuffleArray(
      ALL_SQUARES.filter((sq) => !used.has(sq)),
      rng
    );
    const shuffledMajorMinor = shuffleArray(STANDARD_NON_KING_PIECES, rng);

    for (let i = 0; i < shuffledMajorMinor.length; i++) {
      const sq = remainingSquares[i];
      board[sq] = shuffledMajorMinor[i];
    }

    const kingCandidates = remainingSquares.slice(shuffledMajorMinor.length);
    const candidatePairsLimit = Math.min(kingCandidates.length, 16);

    for (let wi = 0; wi < candidatePairsLimit; wi++) {
      const wKingSq = kingCandidates[wi];
      for (let bi = 0; bi < candidatePairsLimit; bi++) {
        if (wi === bi) continue;
        const bKingSq = kingCandidates[bi];
        if (areKingsAdjacent(wKingSq, bKingSq)) continue;

        board[wKingSq] = { type: 'k', color: 'w' };
        board[bKingSq] = { type: 'k', color: 'b' };

        const fen = boardMapToFen(board, 'w', false);
        try {
          const chess = new Chess(fen);
          if (
            !chess.isAttacked(bKingSq, 'w') &&
            !chess.isAttacked(wKingSq, 'b') &&
            chess.moves().length > 0 &&
            chess.fen() !== STANDARD_START_FEN
          ) {
            return chess.fen();
          }
        } catch {
          // Try next king placement
        }

        delete board[wKingSq];
        delete board[bKingSq];
      }
    }
  }

  // Deterministic safe fallback: independently shuffle White back rank & Black back rank
  return generateStandardRandomFen(rng);
}

const STANDARD_BACK_RANK_ORDER: PieceSymbol[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];

function isSameBackRank(a: PieceSymbol[], b: PieceSymbol[]): boolean {
  return a.length === b.length && a.every((p, idx) => p === b[idx]);
}

/**
 * Generates a Standard Random FEN where White and Black back-rank starting pieces
 * are randomly swapped on ranks 1 and 8 (no Chess960 bishop/king restrictions)
 * while pawns remain on ranks 2 and 7.
 */
export function generateStandardRandomFen(rng: () => number = Math.random): string {
  let wBack = shuffleArray(STANDARD_BACK_RANK_ORDER, rng);
  let bBack = shuffleArray(STANDARD_BACK_RANK_ORDER, rng);

  // Guarantee at least one side differs from standard chess starting arrangement
  for (let i = 0; i < 20; i++) {
    if (!isSameBackRank(wBack, STANDARD_BACK_RANK_ORDER) || !isSameBackRank(bBack, STANDARD_BACK_RANK_ORDER)) {
      break;
    }
    wBack = shuffleArray(STANDARD_BACK_RANK_ORDER, rng);
    bBack = shuffleArray(STANDARD_BACK_RANK_ORDER, rng);
  }
  if (isSameBackRank(wBack, STANDARD_BACK_RANK_ORDER) && isSameBackRank(bBack, STANDARD_BACK_RANK_ORDER)) {
    // Deterministic swap of knight and rook if RNG produced identical ordering
    wBack = ['n', 'r', 'b', 'q', 'k', 'b', 'n', 'r'];
  }

  const board: BoardMap = {};
  BOARD_FILES.forEach((f, idx) => {
    board[`${f}1` as Square] = { type: wBack[idx], color: 'w' };
    board[`${f}2` as Square] = { type: 'p', color: 'w' };
    board[`${f}7` as Square] = { type: 'p', color: 'b' };
    board[`${f}8` as Square] = { type: bBack[idx], color: 'b' };
  });

  return boardMapToFen(board, 'w', false);
}


import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import {
  applyChess960Move,
  canCastleChess960,
  createChess960Position,
  formatShredderCastling,
  getChess960BackRank,
  getChess960LegalTargets,
  parseShredderFen,
  uciLineToSan960,
  type Chess960CastlingRights,
} from './chess960';
import { buildPgn, parsePgnOrFen } from './chessLogic';
import type { MoveRecord } from '../types/chess';

test('Scharnagl numbering generates exact official Chess960 positions for #0, #518, #959 and all 960 unique IDs', () => {
  assert.equal(getChess960BackRank(0).join(''), 'bbqnnrkr');
  assert.equal(getChess960BackRank(518).join(''), 'rnbqkbnr');
  assert.equal(getChess960BackRank(959).join(''), 'rkrnnqbb');

  const seen = new Set<string>();
  for (let id = 0; id < 960; id++) {
    const rank = getChess960BackRank(id);
    assert.equal(rank.length, 8);
    const str = rank.join('');
    assert.equal(seen.has(str), false, `Duplicate back rank for ID #${id}`);
    seen.add(str);

    // Opposite-color bishops
    const bishops: number[] = [];
    const rooks: number[] = [];
    let king = -1;
    rank.forEach((p, idx) => {
      if (p === 'b') bishops.push(idx);
      if (p === 'r') rooks.push(idx);
      if (p === 'k') king = idx;
    });
    assert.equal(bishops.length, 2);
    assert.equal(bishops[0] % 2 !== bishops[1] % 2, true, `Bishops same color for #${id}`);
    assert.equal(rooks.length, 2);
    assert.ok(rooks[0] < king && king < rooks[1], `King not between rooks for #${id}`);
  }
  assert.equal(seen.size, 960);
});

test('createChess960Position builds mirrored FEN and full Chess960 castling rights + Shredder-FEN', () => {
  const pos = createChess960Position(0); // bbqnnrkr (rooks on f=5, h=7; king on g=6)
  assert.equal(pos.id, 0);
  assert.equal(pos.fen, 'bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPP/BBQNNRKR w - - 0 1');
  assert.equal(pos.shredderFen, 'bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPP/BBQNNRKR w HFhf - 0 1');
  assert.deepEqual(pos.castlingRights, { wK: 7, wQ: 5, bK: 7, bQ: 5 });

  // SP #518 (standard back rank) has rooks on a=0 and h=7 -> HAha
  const std518 = createChess960Position(518);
  assert.equal(std518.shredderFen, 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w HAha - 0 1');
  assert.deepEqual(std518.castlingRights, { wK: 7, wQ: 0, bK: 7, bQ: 0 });

  // Verify chess.js accepts the base FEN cleanly
  const chess = new Chess(pos.fen);
  assert.equal(chess.inCheck(), false);
  assert.ok(chess.moves().length >= 16);
});

test('Chess960 castling where king stays on g1 and rook jumps h1 -> f1 (SP #0)', () => {
  // Position where White has K on g1, R on h1, f1 is EMPTY, and Black king on g8
  const fen = '6k1/8/8/8/8/8/8/6KR w - - 0 1';
  const rights: Chess960CastlingRights = { wK: 7, wQ: null, bK: null, bQ: null };

  const check = canCastleChess960(fen, rights, 'k');
  assert.equal(check.legal, true);
  assert.equal(check.kingFrom, 'g1');
  assert.equal(check.rookFrom, 'h1');
  assert.equal(check.kingTo, 'g1');
  assert.equal(check.rookTo, 'f1');

  // Target square for king on g1 includes own rook on h1
  const targets = getChess960LegalTargets(fen, rights, 'g1');
  assert.equal(targets.get('h1')?.isCastle, true);
  assert.equal(targets.get('h1')?.castleSide, 'k');

  const applied = applyChess960Move(fen, rights, 'g1', 'h1');
  assert.ok(applied);
  assert.equal(applied.san, 'O-O');
  assert.equal(applied.uci, 'g1h1');
  assert.equal(applied.isCastle, true);
  assert.equal(applied.castlingRightsAfter.wK, null);

  const after = new Chess(applied.fenAfter);
  assert.equal(after.get('g1')?.type, 'k');
  assert.equal(after.get('f1')?.type, 'r');
  assert.equal(after.get('h1'), undefined);
});

test('Chess960 castling where king is on f1 adjacent to g1: f1->g1 is normal move Kf1-g1, f1->h1 castles O-O', () => {
  const fen = '4k3/8/8/8/8/8/8/5K1R w - - 0 1';
  const rights: Chess960CastlingRights = { wK: 7, wQ: null, bK: null, bQ: null };

  const targets = getChess960LegalTargets(fen, rights, 'f1');
  // g1 is an adjacent 1-square king move (NOT castling)
  assert.equal(targets.get('g1')?.isCastle, false);
  // h1 (the rook) IS castling
  assert.equal(targets.get('h1')?.isCastle, true);

  const normalKingMove = applyChess960Move(fen, rights, 'f1', 'g1');
  assert.ok(normalKingMove);
  assert.equal(normalKingMove.san, 'Kg1');
  assert.equal(normalKingMove.isCastle, false);
  assert.equal(normalKingMove.castlingRightsAfter.wK, null);

  const castleMove = applyChess960Move(fen, rights, 'f1', 'h1');
  assert.ok(castleMove);
  assert.equal(castleMove.san, 'O-O');
  assert.equal(castleMove.isCastle, true);
  const after = new Chess(castleMove.fenAfter);
  assert.equal(after.get('g1')?.type, 'k');
  assert.equal(after.get('f1')?.type, 'r');
});

test('Chess960 adjacent king-rook swap (Kf1+Rg1 and Kd1+Rc1) and king moving right on O-O-O (Ra1+Kb1)', () => {
  // 1. Adjacent swap O-O: Kf1, Rg1 -> Kg1, Rf1
  const swapKingSideFen = '4k3/8/8/8/8/8/8/5KR1 w - - 0 1';
  const swapKingSide = applyChess960Move(
    swapKingSideFen,
    { wK: 6, wQ: null, bK: null, bQ: null },
    'f1',
    'g1'
  );
  assert.ok(swapKingSide);
  assert.equal(swapKingSide.san, 'O-O');
  assert.equal(swapKingSide.uci, 'f1g1');
  const afterKS = new Chess(swapKingSide.fenAfter);
  assert.equal(afterKS.get('g1')?.type, 'k');
  assert.equal(afterKS.get('f1')?.type, 'r');

  // 2. Adjacent swap O-O-O: Rc1, Kd1 -> Kc1, Rd1
  const swapQueenSideFen = '4k3/8/8/8/8/8/8/2RK4 w - - 0 1';
  const swapQueenSide = applyChess960Move(
    swapQueenSideFen,
    { wK: null, wQ: 2, bK: null, bQ: null },
    'd1',
    'c1'
  );
  assert.ok(swapQueenSide);
  assert.equal(swapQueenSide.san, 'O-O-O');
  assert.equal(swapQueenSide.uci, 'd1c1');
  const afterQS = new Chess(swapQueenSide.fenAfter);
  assert.equal(afterQS.get('c1')?.type, 'k');
  assert.equal(afterQS.get('d1')?.type, 'r');

  // 3. King moves RIGHT on O-O-O: Ra1, Kb1 -> b1->c1 is normal Kc1, b1->a1 is O-O-O (Kc1, Rd1)
  const rightQueensideFen = '4k3/8/8/8/8/8/8/RK6 w - - 0 1';
  const rightRights: Chess960CastlingRights = { wK: null, wQ: 0, bK: null, bQ: null };
  const targets = getChess960LegalTargets(rightQueensideFen, rightRights, 'b1');
  assert.equal(targets.get('c1')?.isCastle, false);
  assert.equal(targets.get('a1')?.isCastle, true);

  const normalStep = applyChess960Move(rightQueensideFen, rightRights, 'b1', 'c1');
  assert.ok(normalStep);
  assert.equal(normalStep.san, 'Kc1');
  assert.equal(normalStep.isCastle, false);

  const castleRight = applyChess960Move(rightQueensideFen, rightRights, 'b1', 'a1');
  assert.ok(castleRight);
  assert.equal(castleRight.san, 'O-O-O');
  assert.equal(castleRight.uci, 'b1a1');
  const afterRight = new Chess(castleRight.fenAfter);
  assert.equal(afterRight.get('c1')?.type, 'k');
  assert.equal(afterRight.get('d1')?.type, 'r');
  assert.equal(afterRight.get('a1'), undefined);
  assert.equal(afterRight.get('b1'), undefined);
});

test('Chess960 castling supports rook stationary (Rf1/Rd1), Black O-O/O-O-O, and O-O+ / O-O# notation', () => {
  // Rook stationary on d1, King moves from f1 -> c1 (O-O-O), Black king on d8 gets checked by Rd1!
  const rookStayCheckFen = '3k4/8/8/8/8/8/8/3R1K2 w - - 0 1';
  const checkCastle = applyChess960Move(
    rookStayCheckFen,
    { wK: null, wQ: 3, bK: null, bQ: null },
    'f1',
    'd1'
  );
  assert.ok(checkCastle);
  assert.equal(checkCastle.san, 'O-O-O+');
  assert.equal(checkCastle.isCheck, true);
  assert.equal(checkCastle.isCastle, true);
  const afterCheck = new Chess(checkCastle.fenAfter);
  assert.equal(afterCheck.get('c1')?.type, 'k');
  assert.equal(afterCheck.get('d1')?.type, 'r');

  // Black O-O-O with king on e8, rook on b8 -> Kc8, Rd8
  const blackCastleFen = '1r2k3/8/8/8/8/8/8/4K3 b - - 0 1';
  const blackCastle = applyChess960Move(
    blackCastleFen,
    { wK: null, wQ: null, bK: null, bQ: 1 },
    'e8',
    'b8'
  );
  assert.ok(blackCastle);
  assert.equal(blackCastle.san, 'O-O-O');
  assert.equal(blackCastle.uci, 'e8b8');
  const afterBlack = new Chess(blackCastle.fenAfter);
  assert.equal(afterBlack.get('c8')?.type, 'k');
  assert.equal(afterBlack.get('d8')?.type, 'r');
});

test('Chess960 castling accepts both king-to-g1 and king-to-rook when e1->g1 is 2 squares away', () => {
  const fen = '4k3/8/8/8/8/8/8/R3K2R w - - 0 1';
  const rights: Chess960CastlingRights = { wK: 7, wQ: 0, bK: null, bQ: null };

  const viaG1 = applyChess960Move(fen, rights, 'e1', 'g1');
  const viaH1 = applyChess960Move(fen, rights, 'e1', 'h1');
  assert.ok(viaG1 && viaH1);
  assert.equal(viaG1.san, 'O-O');
  assert.equal(viaH1.san, 'O-O');
  assert.equal(viaG1.fenAfter, viaH1.fenAfter);

  const viaC1 = applyChess960Move(fen, rights, 'e1', 'c1');
  const viaA1 = applyChess960Move(fen, rights, 'e1', 'a1');
  assert.ok(viaC1 && viaA1);
  assert.equal(viaC1.san, 'O-O-O');
  assert.equal(viaA1.san, 'O-O-O');
  assert.equal(viaC1.fenAfter, viaA1.fenAfter);
});

test('Chess960 castling rejects blocked path, passing through check, and rank-1 discovery pin', () => {
  // Blocked rook path: knight on d1 blocks O-O-O (Ra1, Kc1)
  const blockedFen = '4k3/8/8/8/8/8/8/R1KN4 w - - 0 1';
  const blockedRights: Chess960CastlingRights = { wK: null, wQ: 0, bK: null, bQ: null };
  assert.equal(canCastleChess960(blockedFen, blockedRights, 'q').legal, false);

  // Passing through check: black rook on f8 attacks f1 while e1->g1 tries to castle
  const checkPathFen = '4kr2/8/8/8/8/8/8/4K2R w - - 0 1';
  const checkPathRights: Chess960CastlingRights = { wK: 7, wQ: null, bK: null, bQ: null };
  assert.equal(canCastleChess960(checkPathFen, checkPathRights, 'k').legal, false);

  // Rank-1 discovery pin: black rook on a1, white rook on b1, white king on d1 -> O-O-O puts K on c1 attacked by a1!
  const pinFen = '4k3/8/8/8/8/8/8/rR1K4 w - - 0 1';
  const pinRights: Chess960CastlingRights = { wK: null, wQ: 1, bK: null, bQ: null };
  assert.equal(canCastleChess960(pinFen, pinRights, 'q').legal, false);
});

test('Capturing an unmoved rook revokes its Chess960 castling right and uciLineToSan960 decodes castling', () => {
  // White bishop on a6 captures Black rook on c8 (which had bQ right on file 2)
  const fen = '2rk3r/8/B7/8/8/8/8/R3K2R w - - 0 1';
  const rights: Chess960CastlingRights = { wK: 7, wQ: 0, bK: 7, bQ: 2 };

  const capture = applyChess960Move(fen, rights, 'a6', 'c8');
  assert.ok(capture);
  assert.equal(capture.castlingRightsAfter.bQ, null);
  assert.equal(capture.castlingRightsAfter.bK, 7);
  assert.equal(formatShredderCastling(capture.castlingRightsAfter), 'HAh');

  // Stockfish PV line with Chess960 castling move d8h8 -> O-O
  const pvSan = uciLineToSan960(capture.fenAfter, capture.castlingRightsAfter, ['d8h8']);
  assert.deepEqual(pvSan, ['O-O']);
});

test('parseShredderFen handles Shredder-FEN, X-FEN, standard FEN, and rejects malformed FEN', () => {
  const shredder = parseShredderFen('bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPP/BBQNNRKR w HFhf - 0 1');
  assert.equal(shredder.ok, true);
  if (shredder.ok) {
    assert.equal(shredder.isChess960Castling, true);
    assert.deepEqual(shredder.castlingRights, { wK: 7, wQ: 5, bK: 7, bQ: 5 });
    assert.equal(shredder.shredderFen, 'bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPP/BBQNNRKR w HFhf - 0 1');
    assert.equal(shredder.fen.split(' ')[2], '-');
  }

  // X-FEN using KQkq on non-standard SP #0 back rank resolves to outermost rooks (h=7, f=5)
  const xfen = parseShredderFen('bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPP/BBQNNRKR w KQkq - 0 1');
  assert.equal(xfen.ok, true);
  if (xfen.ok) {
    assert.equal(xfen.isChess960Castling, true);
    assert.deepEqual(xfen.castlingRights, { wK: 7, wQ: 5, bK: 7, bQ: 5 });
    assert.equal(xfen.shredderFen, 'bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPP/BBQNNRKR w HFhf - 0 1');
  }

  // Standard FEN is NOT flagged as Chess960 castling
  const std = parseShredderFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  assert.equal(std.ok, true);
  if (std.ok) {
    assert.equal(std.isChess960Castling, false);
  }

  const bad = parseShredderFen('invalid fen string');
  assert.equal(bad.ok, false);
});

test('Chess960 full PGN build -> parse round-trip preserves Shredder-FEN, O-O, O-O-O, and castling rights', () => {
  const pos = createChess960Position(0); // bbqnnrkr (f1=R, g1=K, h1=R)
  const moves: MoveRecord[] = [];
  let curFen = pos.fen;
  let curRights = pos.castlingRights;

  // 1. f4 f5 2. Rf3 Rf6 3. O-O O-O (both kings stay on g1/g8, h-rooks jump to f1/f8)
  const seq: Array<[string, string]> = [
    ['f2', 'f4'],
    ['f7', 'f5'],
    ['f1', 'f3'],
    ['f8', 'f6'],
    ['g1', 'h1'],
    ['g8', 'h8'],
  ];

  for (let i = 0; i < seq.length; i++) {
    const [from, to] = seq[i];
    const res = applyChess960Move(curFen, curRights, from as any, to as any);
    assert.ok(res, `Move ${from}->${to} failed at ply ${i + 1}`);
    moves.push({
      ply: i + 1,
      moveNumber: Math.floor(i / 2) + 1,
      color: res.color,
      san: res.san,
      uci: res.uci,
      from: res.from,
      to: res.to,
      piece: res.piece,
      captured: res.captured,
      promotion: res.promotion,
      fenBefore: curFen,
      fenAfter: res.fenAfter,
      engineFenAfter: res.shredderFenAfter,
      castlingRights960: res.castlingRightsAfter,
    });
    curFen = res.fenAfter;
    curRights = res.castlingRightsAfter;
  }

  assert.equal(moves[4].san, 'O-O');
  assert.equal(moves[5].san, 'O-O');

  const pgn = buildPgn({
    initialFen: pos.fen,
    pgnInitialFen: pos.shredderFen,
    variant: 'Chess960',
    moves,
    whiteName: 'Alice',
    blackName: 'Stockfish',
    result: '*',
  });
  assert.ok(pgn.includes('[Variant "Chess960"]'));
  assert.ok(pgn.includes('[FEN "bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPP/BBQNNRKR w HFhf - 0 1"]'));
  assert.ok(pgn.includes('3. O-O O-O'));

  const reparsed = parsePgnOrFen(pgn);
  assert.equal(reparsed.ok, true);
  if (reparsed.ok) {
    assert.equal(reparsed.variant, 'Chess960');
    assert.equal(reparsed.initialShredderFen, pos.shredderFen);
    assert.deepEqual(reparsed.initialChess960Rights, pos.castlingRights);
    assert.equal(reparsed.moves.length, 6);
    assert.equal(reparsed.moves[4].san, 'O-O');
    assert.equal(reparsed.moves[4].uci, 'g1h1');
    assert.equal(reparsed.moves[5].san, 'O-O');
    assert.equal(reparsed.moves[5].uci, 'g8h8');
    assert.equal(reparsed.moves[5].fenAfter, moves[5].fenAfter);
    assert.equal(reparsed.moves[5].engineFenAfter, moves[5].engineFenAfter);
  }

  // Standard Chess PGN with O-O must remain Standard (variant undefined)
  const stdParsed = parsePgnOrFen('1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7');
  assert.equal(stdParsed.ok, true);
  if (stdParsed.ok) {
    assert.equal(stdParsed.variant, undefined);
    assert.equal(stdParsed.moves[8].san, 'O-O');
  }
});

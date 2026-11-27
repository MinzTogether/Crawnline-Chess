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
  uciLineToSan960,
  type Chess960CastlingRights,
} from './chess960';

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

test('createChess960Position builds mirrored FEN with castling disabled outside Classic mode', () => {
  const pos = createChess960Position(0); // bbqnnrkr
  assert.equal(pos.id, 0);
  assert.equal(pos.fen, 'bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPP/BBQNNRKR w - - 0 1');
  assert.equal(pos.shredderFen, 'bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPP/BBQNNRKR w - - 0 1');
  assert.deepEqual(pos.castlingRights, { wK: null, wQ: null, bK: null, bQ: null });

  // Verify chess.js accepts the FEN cleanly
  const chess = new Chess(pos.fen);
  assert.equal(chess.inCheck(), false);
  assert.ok(chess.moves().length >= 16);
});

test('Chess960 castling where king stays on g1 and rook jumps h1 -> f1 (SP #0)', () => {
  // Position where White has K on g1, R on h1, f1 is EMPTY, and Black king on g8
  const fen = '6k1/8/8/8/8/8/8/51KR w - - 0 1'.replace('51KR', '6KR'); // 6KR -> g1=K, h1=R, f1 empty
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
  // Blocked rook path: bishop on f1 blocks queenside rook on b1? Here knight on d1 blocks O-O-O (Ra1, Kc1)
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

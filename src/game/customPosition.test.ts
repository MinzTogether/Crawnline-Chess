import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import {
  STANDARD_START_FEN,
  boardMapToFen,
  createKingsOnlyBoard,
  fenToBoardMap,
  generateRandomChessFen,
  setSquarePiece,
  swapOrMoveSquare,
  validateCustomPosition,
} from './customPosition';

test('fenToBoardMap and boardMapToFen round-trip standard starting position', () => {
  const board = fenToBoardMap(STANDARD_START_FEN);
  assert.equal(Object.keys(board).length, 32);
  assert.deepEqual(board.e1, { type: 'k', color: 'w' });
  assert.deepEqual(board.d8, { type: 'q', color: 'b' });
  assert.equal(boardMapToFen(board, 'w', true), STANDARD_START_FEN);
});

test('swapOrMoveSquare swaps two occupied squares and moves to empty squares cleanly', () => {
  const start = fenToBoardMap(STANDARD_START_FEN);
  const swapped = swapOrMoveSquare(start, 'd1', 'e2');
  assert.deepEqual(swapped.e2, { type: 'q', color: 'w' });
  assert.deepEqual(swapped.d1, { type: 'p', color: 'w' });
  // Ensure original map was not mutated
  assert.deepEqual(start.d1, { type: 'q', color: 'w' });

  const moved = swapOrMoveSquare(start, 'g1', 'f3');
  assert.equal(moved.g1, undefined);
  assert.deepEqual(moved.f3, { type: 'n', color: 'w' });
});

test('validateCustomPosition catches missing kings, edge-rank pawns, and illegal check', () => {
  const kingsOnly = createKingsOnlyBoard();
  const validMinimal = validateCustomPosition(kingsOnly, 'w');
  assert.equal(validMinimal.valid, true);

  const noWhiteKing = setSquarePiece(kingsOnly, 'e1', null);
  const resNoW = validateCustomPosition(noWhiteKing, 'w');
  assert.equal(resNoW.valid, false);
  if (!resNoW.valid) assert.equal(resNoW.errorKey, 'customErrWhiteKing');

  const pawnOnRank1 = setSquarePiece(kingsOnly, 'a1', { type: 'p', color: 'w' });
  const resPawn = validateCustomPosition(pawnOnRank1, 'w');
  assert.equal(resPawn.valid, false);
  if (!resPawn.valid) assert.equal(resPawn.errorKey, 'customErrPawnEdge');

  // Black king in check while it is White's turn to move -> illegal
  const oppInCheck = setSquarePiece(kingsOnly, 'e4', { type: 'r', color: 'w' });
  const resCheck = validateCustomPosition(oppInCheck, 'w');
  assert.equal(resCheck.valid, false);
  if (!resCheck.valid) assert.equal(resCheck.errorKey, 'customErrOpponentCheck');
});

test('generateRandomChessFen creates valid, non-standard, rule-free 32-piece chess positions', () => {
  const generated = new Set<string>();
  for (let i = 0; i < 15; i++) {
    const fen = generateRandomChessFen();
    assert.notEqual(fen, STANDARD_START_FEN);
    generated.add(fen);

    const chess = new Chess(fen);
    assert.equal(chess.turn(), 'w');
    assert.equal(chess.inCheck(), false, 'Generated random board must not start in check');
    assert.ok(chess.moves().length > 0, 'Generated random board must have legal moves');

    const map = fenToBoardMap(fen);
    const pieces = Object.values(map);
    assert.equal(pieces.length, 32, 'Must preserve all 32 chess pieces');
    assert.equal(
      pieces.filter((p) => p?.type === 'k' && p.color === 'w').length,
      1,
      'Must have 1 White King'
    );
    assert.equal(
      pieces.filter((p) => p?.type === 'k' && p.color === 'b').length,
      1,
      'Must have 1 Black King'
    );
    for (const [sq, p] of Object.entries(map)) {
      if (p?.type === 'p') {
        assert.ok(sq[1] !== '1' && sq[1] !== '8', 'Pawns cannot be placed on rank 1 or 8');
      }
    }
  }
  assert.ok(generated.size >= 10, 'Random Chess should generate distinct positions');
});

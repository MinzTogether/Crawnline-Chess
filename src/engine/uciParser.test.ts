import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAverageAccuracy,
  classifyMove,
  evalToBarPercent,
  evalToWhiteWinProbability,
  formatEvalScore,
  parseBestMoveLine,
  parseUciInfoLine,
} from './uciParser';

test('parseUciInfoLine parses centipawn score for White and normalizes Black perspective', () => {
  const whiteLine =
    'info depth 16 seldepth 22 multipv 1 score cp 48 nodes 124500 nps 620000 pv e2e4 e7e5 g1f3';
  const parsedW = parseUciInfoLine(whiteLine, 'w');
  assert.ok(parsedW);
  assert.equal(parsedW.depth, 16);
  assert.equal(parsedW.seldepth, 22);
  assert.equal(parsedW.multipv, 1);
  assert.deepEqual(parsedW.score, { type: 'cp', value: 48 });
  assert.deepEqual(parsedW.pvUci, ['e2e4', 'e7e5', 'g1f3']);

  // When Black is to move, +120 cp from Stockfish means Black is winning (+120 for Black => -120 for White)
  const blackLine =
    'info depth 14 seldepth 19 multipv 2 score cp 120 nodes 90000 nps 510000 pv c7c5 g1f3';
  const parsedB = parseUciInfoLine(blackLine, 'b');
  assert.ok(parsedB);
  assert.equal(parsedB.multipv, 2);
  assert.deepEqual(parsedB.score, { type: 'cp', value: -120 });
});

test('parseUciInfoLine parses forced mate scores accurately for both colors', () => {
  const mateW = 'info depth 20 multipv 1 score mate 3 nodes 50000 pv d1h5 g7g6 h5e5';
  const parsedW = parseUciInfoLine(mateW, 'w');
  assert.ok(parsedW);
  assert.deepEqual(parsedW.score, { type: 'mate', value: 3 });

  const mateB = 'info depth 20 multipv 1 score mate 2 nodes 50000 pv d8h4 g2g3 h4e4';
  const parsedB = parseUciInfoLine(mateB, 'b');
  assert.ok(parsedB);
  assert.deepEqual(parsedB.score, { type: 'mate', value: -2 });
});

test('parseBestMoveLine extracts bestmove and ponder', () => {
  assert.deepEqual(parseBestMoveLine('bestmove e2e4 ponder e7e5'), {
    bestMove: 'e2e4',
    ponder: 'e7e5',
  });
  assert.deepEqual(parseBestMoveLine('bestmove (none)'), {
    bestMove: null,
    ponder: null,
  });
});

test('evalToWhiteWinProbability, evalToBarPercent, and formatEvalScore behave monotonically', () => {
  assert.equal(Math.round(evalToWhiteWinProbability({ type: 'cp', value: 0 })), 50);
  assert.ok(evalToWhiteWinProbability({ type: 'cp', value: 300 }) > 70);
  assert.ok(evalToWhiteWinProbability({ type: 'cp', value: -300 }) < 30);
  assert.equal(evalToBarPercent({ type: 'mate', value: 2 }), 100);
  assert.equal(evalToBarPercent({ type: 'mate', value: -1 }), 0);

  assert.equal(formatEvalScore({ type: 'cp', value: 145 }), '+1.5');
  assert.equal(formatEvalScore({ type: 'cp', value: -230 }, true), '-2.30');
  assert.equal(formatEvalScore({ type: 'cp', value: 1478 }, false, true), '+15');
  assert.equal(formatEvalScore({ type: 'cp', value: -1120 }, false, true), '-11');
  assert.equal(formatEvalScore({ type: 'mate', value: 4 }), 'M4');
  assert.equal(formatEvalScore({ type: 'mate', value: -2 }), '-M2');
});

test('classifyMove differentiates book, best, inaccuracy, and blunder', () => {
  const book = classifyMove({
    evalBefore: { type: 'cp', value: 20 },
    evalAfter: { type: 'cp', value: 20 },
    mover: 'w',
    playedUci: 'e2e4',
    bestUci: 'e2e4',
    isBook: true,
  });
  assert.equal(book.classification, 'book');
  assert.equal(book.accuracy, 100);

  const best = classifyMove({
    evalBefore: { type: 'cp', value: 50 },
    evalAfter: { type: 'cp', value: 50 },
    mover: 'w',
    playedUci: 'g1f3',
    bestUci: 'g1f3',
  });
  assert.equal(best.classification, 'best');

  const blunder = classifyMove({
    evalBefore: { type: 'cp', value: 180 },
    evalAfter: { type: 'cp', value: -350 },
    mover: 'w',
    playedUci: 'f2f3',
    bestUci: 'e2e4',
  });
  assert.equal(blunder.classification, 'blunder');
  assert.ok(blunder.accuracy < 40);

  assert.equal(calculateAverageAccuracy([100, 80, 90]), 90);
  assert.equal(calculateAverageAccuracy([]), null);
});

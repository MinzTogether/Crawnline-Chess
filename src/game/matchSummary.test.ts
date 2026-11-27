import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGameOverSummary } from './matchSummary';
import { parsePgnOrFen } from './chessLogic';

test('buildGameOverSummary computes outcomes, moves, captures, checks, and material on checkmate', () => {
  const parsed = parsePgnOrFen('1. f3 e5 2. g4 Qh4#');
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  const lastFen = parsed.moves[parsed.moves.length - 1].fenAfter;
  const summary = buildGameOverSummary(parsed.moves, lastFen, {
    isOver: true,
    winner: 'b',
    reason: 'Checkmate',
    resultString: '0-1',
  });

  assert.equal(summary.scoreLabel, '0 - 1');
  assert.equal(summary.totalFullMoves, 2);
  assert.equal(summary.white.outcome, 'loss');
  assert.equal(summary.black.outcome, 'win');
  assert.equal(summary.white.movesCount, 2);
  assert.equal(summary.black.movesCount, 2);
  assert.equal(summary.white.checks, 0);
  assert.equal(summary.black.checks, 1);
  assert.equal(summary.white.captures, 0);
  assert.equal(summary.black.captures, 0);
});

test('buildGameOverSummary aggregates captures, accuracy, and draw outcomes', () => {
  const parsed = parsePgnOrFen('1. e4 d5 2. exd5 Qxd5');
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  const ratedMoves = parsed.moves.map((m, idx) => ({
    ...m,
    accuracy: idx % 2 === 0 ? 94 : 82,
    classification: (idx % 2 === 0 ? 'best' : 'inaccuracy') as 'best' | 'inaccuracy',
  }));
  const lastFen = ratedMoves[ratedMoves.length - 1].fenAfter;

  const summary = buildGameOverSummary(ratedMoves, lastFen, {
    isOver: true,
    winner: 'draw',
    reason: 'Draw by agreement',
    resultString: '1/2-1/2',
  });

  assert.equal(summary.scoreLabel, '½ - ½');
  assert.equal(summary.white.outcome, 'draw');
  assert.equal(summary.black.outcome, 'draw');
  assert.equal(summary.white.captures, 1);
  assert.equal(summary.black.captures, 1);
  assert.equal(summary.white.accuracy, 94);
  assert.equal(summary.black.accuracy, 82);
  assert.equal(summary.white.strongMoves, 2);
  assert.equal(summary.black.errors, 2);
  assert.ok((summary.white.estimatedElo ?? 0) > (summary.black.estimatedElo ?? 0));
});

test('buildGameOverSummary reflects White win and material balance accurately', () => {
  const parsed = parsePgnOrFen('1. e4 d5 2. exd5');
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  const lastFen = parsed.moves[parsed.moves.length - 1].fenAfter;
  const summary = buildGameOverSummary(parsed.moves, lastFen, {
    isOver: true,
    winner: 'w',
    reason: 'Black resigned',
    resultString: '1-0',
  });

  assert.equal(summary.scoreLabel, '1 - 0');
  assert.equal(summary.white.outcome, 'win');
  assert.equal(summary.black.outcome, 'loss');
  assert.equal(summary.white.materialBalance, 1);
  assert.equal(summary.black.materialBalance, -1);
});

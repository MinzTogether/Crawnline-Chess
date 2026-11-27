import test from 'node:test';
import assert from 'node:assert/strict';
import type { MoveRecord } from '../types/chess';
import { accuracyToGrade, buildMatchRatingReport, estimateGameElo } from './matchRating';

test('estimateGameElo and accuracyToGrade scale monotonically with accuracy and blunders', () => {
  const cleanCounts = {
    book: 2,
    brilliant: 0,
    great: 1,
    best: 8,
    excellent: 3,
    good: 1,
    inaccuracy: 0,
    mistake: 0,
    blunder: 0,
  };
  const masterElo = estimateGameElo(96.5, cleanCounts);
  assert.ok(masterElo !== null && masterElo >= 2500);
  assert.equal(accuracyToGrade(96.5), 'S');

  const blunderCounts = { ...cleanCounts, great: 0, blunder: 3, mistake: 2 };
  const roughElo = estimateGameElo(61, blunderCounts);
  assert.ok(roughElo !== null && roughElo <= 1050);
  assert.equal(accuracyToGrade(61), 'D');
  assert.equal(estimateGameElo(null, cleanCounts), null);
});

test('buildMatchRatingReport computes phase ratings, Elo estimates, and key moments', () => {
  const sampleMoves: MoveRecord[] = [
    {
      ply: 1,
      moveNumber: 1,
      color: 'w',
      san: 'e4',
      uci: 'e2e4',
      from: 'e2',
      to: 'e4',
      piece: 'p',
      fenBefore: 'start',
      fenAfter: 'f1',
      evalAfter: { type: 'cp', value: 25 },
      classification: 'book',
      accuracy: 100,
    },
    {
      ply: 2,
      moveNumber: 1,
      color: 'b',
      san: 'e5',
      uci: 'e7e5',
      from: 'e7',
      to: 'e5',
      piece: 'p',
      fenBefore: 'f1',
      fenAfter: 'f2',
      evalAfter: { type: 'cp', value: 20 },
      classification: 'book',
      accuracy: 100,
    },
    {
      ply: 3,
      moveNumber: 12,
      color: 'w',
      san: 'Qh5',
      uci: 'd1h5',
      from: 'd1',
      to: 'h5',
      piece: 'q',
      fenBefore: 'f2',
      fenAfter: 'f3',
      evalAfter: { type: 'cp', value: -340 },
      bestMoveBefore: 'g1f3',
      classification: 'blunder',
      accuracy: 18,
    },
    {
      ply: 4,
      moveNumber: 12,
      color: 'b',
      san: 'Nf6',
      uci: 'g8f6',
      from: 'g8',
      to: 'f6',
      piece: 'n',
      fenBefore: 'f3',
      fenAfter: 'f4',
      evalAfter: { type: 'cp', value: -360 },
      bestMoveBefore: 'g8f6',
      classification: 'best',
      accuracy: 99,
    },
  ];

  const report = buildMatchRatingReport(sampleMoves);
  assert.equal(report.isComplete, true);
  assert.equal(report.analyzedPlies, 4);
  assert.equal(report.white.openingAccuracy, 100);
  assert.equal(report.white.middlegameAccuracy, 18);
  assert.equal(report.black.accuracy, 99.5);
  assert.ok(report.black.estimatedElo! > report.white.estimatedElo!);
  assert.equal(report.keyMoments.length, 1);
  assert.equal(report.keyMoments[0].san, 'Qh5');
  assert.equal(report.keyMoments[0].classification, 'blunder');
});

test('estimateGameElo and accuracyToGrade safely reject NaN/Infinity and clamp out-of-range values', () => {
  const normalCounts = {
    book: 2,
    brilliant: 0,
    great: 0,
    best: 6,
    excellent: 2,
    good: 0,
    inaccuracy: 0,
    mistake: 0,
    blunder: 0,
  };

  // Non-finite accuracies must return null / '—', never NaN or fabricated 400/2900
  assert.equal(estimateGameElo(Number.NaN, normalCounts), null);
  assert.equal(estimateGameElo(Number.POSITIVE_INFINITY, normalCounts), null);
  assert.equal(estimateGameElo(Number.NEGATIVE_INFINITY, normalCounts), null);
  assert.equal(accuracyToGrade(Number.NaN), '—');
  assert.equal(accuracyToGrade(Number.POSITIVE_INFINITY), '—');
  assert.equal(accuracyToGrade(Number.NEGATIVE_INFINITY), '—');

  // Out-of-range finite accuracies clamp cleanly to [0, 100] and [400, 2900]
  assert.equal(estimateGameElo(150, normalCounts), estimateGameElo(100, normalCounts));
  assert.equal(estimateGameElo(-40, normalCounts), estimateGameElo(0, normalCounts));
  assert.equal(accuracyToGrade(150), 'S');
  assert.equal(accuracyToGrade(-20), 'D');

  // Malformed counts (NaN, Infinity, negative, or huge counts) cannot poison or distort Elo into absurdity
  const malformedCounts = {
    book: Number.NaN,
    brilliant: Number.POSITIVE_INFINITY,
    great: -5,
    best: 8,
    excellent: 2,
    good: 0,
    inaccuracy: 0,
    mistake: Number.NEGATIVE_INFINITY,
    blunder: -10,
  };
  const safeFromMalformed = estimateGameElo(88, malformedCounts);
  assert.ok(safeFromMalformed !== null && Number.isFinite(safeFromMalformed));
  assert.equal(safeFromMalformed, estimateGameElo(88, { best: 8, excellent: 2 }));

  // Extreme bonus counts cannot inflate a 55% accuracy game into a master-level rating
  const inflatedCounts = { brilliant: 50, great: 50, best: 10 };
  const inflatedElo = estimateGameElo(55, inflatedCounts);
  assert.ok(inflatedElo !== null && inflatedElo <= 1250);

  // Zero explicit moveCount cannot produce an Elo estimate
  assert.equal(estimateGameElo(95, normalCounts, { moveCount: 0 }), null);
  assert.equal(estimateGameElo(95, normalCounts, { moveCount: Number.NaN }), null);
});

test('estimateGameElo prevents absurd 2900 Elo on 1-2 move or book-only samples while preserving full-game scale', () => {
  // 1 book move (100% accuracy) must NOT claim 2900 GM Elo
  const oneBookMove = estimateGameElo(100, { book: 1 }, { moveCount: 1 });
  assert.ok(oneBookMove !== null && oneBookMove <= 1500 && oneBookMove >= 1200);

  // Pure 10-move book opening with 0 independent moves is also moderated
  const pureBook = estimateGameElo(100, { book: 10 }, { moveCount: 10 });
  assert.ok(pureBook !== null && pureBook <= 1700);

  // Full 12-move game with 98% accuracy reaches full GM curve (>= 2700)
  const fullGmGame = estimateGameElo(98, { book: 2, best: 8, excellent: 2 }, { moveCount: 12 });
  assert.ok(fullGmGame !== null && fullGmGame >= 2700);
});

test('buildMatchRatingReport maintains consistency across accuracy, move count, outcome, and corrupted records', () => {
  // Equal high accuracy (98%) over 10 moves each where White wins by checkmate:
  // Winner should not trail loser, and losing side is capped at <= 2600 (no absurd 2850 rating in a loss)
  const makeMove = (ply: number, color: 'w' | 'b', san: string, accuracy: number): MoveRecord => ({
    ply,
    moveNumber: Math.ceil(ply / 2),
    color,
    san,
    uci: color === 'w' ? 'e2e4' : 'e7e5',
    from: color === 'w' ? 'e2' : 'e7',
    to: color === 'w' ? 'e4' : 'e5',
    piece: 'p',
    fenBefore: 'f0',
    fenAfter: 'f1',
    evalAfter: { type: 'cp', value: 20 },
    classification: 'best',
    accuracy,
  });

  const symmetricMoves: MoveRecord[] = [];
  for (let i = 1; i <= 19; i++) {
    symmetricMoves.push(makeMove(i, i % 2 === 1 ? 'w' : 'b', i === 19 ? 'Qh7#' : 'Nf3', 98));
  }
  symmetricMoves.push(makeMove(20, 'b', 'Ke8', 98));
  // Explicit 1-0 result
  const decisiveReport = buildMatchRatingReport(symmetricMoves, { result: '1-0' });
  assert.ok(decisiveReport.white.estimatedElo !== null && decisiveReport.black.estimatedElo !== null);
  assert.ok(decisiveReport.white.estimatedElo! > decisiveReport.black.estimatedElo!);
  assert.ok(decisiveReport.black.estimatedElo! <= 2600);

  // Corrupted MoveRecords (NaN/Infinity accuracy, NaN eval, unknown classification) never produce NaN
  const corruptedMoves: MoveRecord[] = [
    {
      ...makeMove(1, 'w', 'e4', Number.NaN),
      evalAfter: { type: 'cp', value: Number.NaN },
      classification: 'unknown_bad' as any,
    },
    {
      ...makeMove(2, 'b', 'e5', Number.POSITIVE_INFINITY),
      evalAfter: { type: 'cp', value: Number.POSITIVE_INFINITY },
      classification: 'blunder',
    },
    {
      ...makeMove(3, 'w', 'Nf3', 140),
      moveNumber: -3,
      classification: 'best',
    },
  ];

  const corruptedReport = buildMatchRatingReport(corruptedMoves);
  assert.equal(corruptedReport.analyzedPlies, 1);
  assert.equal(corruptedReport.white.accuracy, 100);
  assert.equal(corruptedReport.white.analyzedMoves, 1);
  assert.equal(corruptedReport.black.accuracy, null);
  assert.equal(corruptedReport.black.estimatedElo, null);
  assert.equal(corruptedReport.black.grade, '—');
  assert.ok(corruptedReport.keyMoments.every((km) => Number.isFinite(km.swing)));
  assert.ok(!corruptedReport.summaryHeadline.includes('White controlled'));
});


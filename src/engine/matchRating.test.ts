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

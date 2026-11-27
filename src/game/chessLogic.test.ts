import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPgn,
  evaluateGameTermination,
  formatClock,
  formatMaterialDifference,
  formatPvSanWithNumbers,
  getMaterialSummary,
  parsePgnOrFen,
  uciLineToSan,
} from './chessLogic';
import { detectOpening } from './openings';

test('uciLineToSan and formatPvSanWithNumbers convert Stockfish UCI PV lines accurately', () => {
  const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const san = uciLineToSan(startFen, ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5']);
  assert.deepEqual(san, ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5']);
  assert.equal(formatPvSanWithNumbers(startFen, san), '1. e4 e5 2. Nf3 Nc6 3. Bb5');
});

test('getMaterialSummary computes captured pieces and advantage', () => {
  // Position where Black is missing a Queen and a Pawn
  const fen = 'rnb1kbnr/ppppppp1/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const summary = getMaterialSummary(fen);
  assert.deepEqual(summary.capturedByWhite, ['q', 'p']);
  assert.deepEqual(summary.capturedByBlack, []);
  assert.equal(summary.advantage, 10);
});

test('formatMaterialDifference returns +N only when enabled and positive', () => {
  assert.equal(formatMaterialDifference(2), '+2');
  assert.equal(formatMaterialDifference(5, true), '+5');
  assert.equal(formatMaterialDifference(2, false), null);
  assert.equal(formatMaterialDifference(0, true), null);
  assert.equal(formatMaterialDifference(-3, true), null);
  assert.equal(formatMaterialDifference(Number.NaN, true), null);
});

test('detectOpening identifies deepest matching ECO opening', () => {
  const ruy = detectOpening(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6']);
  assert.ok(ruy);
  assert.equal(ruy.eco, 'C70');
  assert.equal(ruy.name, 'Ruy Lopez: Morphy Defense');

  const sicilian = detectOpening(['e4', 'c5']);
  assert.ok(sicilian);
  assert.equal(sicilian.eco, 'B20');
});

test('parsePgnOrFen handles valid PGN, valid FEN, and rejects malformed input', () => {
  const pgnRes = parsePgnOrFen('1. e4 e5 2. Nf3 Nc6 3. Bb5 a6');
  assert.equal(pgnRes.ok, true);
  if (pgnRes.ok) {
    assert.equal(pgnRes.moves.length, 6);
    assert.equal(pgnRes.moves[4].san, 'Bb5');
  }

  const fenStr = '5rk1/5ppp/8/8/8/2Q5/5PPP/3R2K1 w - - 0 1';
  const fenRes = parsePgnOrFen(fenStr);
  assert.equal(fenRes.ok, true);
  if (fenRes.ok) {
    assert.equal(fenRes.initialFen, fenStr);
    assert.equal(fenRes.moves.length, 0);
  }

  const badRes = parsePgnOrFen('not a real chess notation $$$');
  assert.equal(badRes.ok, false);
});

test('evaluateGameTermination detects checkmate, resignation, timeout, and ongoing games', () => {
  // Fool's mate checkmate FEN (White is checkmated)
  const foolsMateFen = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
  const cm = evaluateGameTermination({ fen: foolsMateFen });
  assert.equal(cm.isOver, true);
  assert.equal(cm.winner, 'b');
  assert.equal(cm.reason, 'Checkmate');
  assert.equal(cm.resultString, '0-1');

  const resign = evaluateGameTermination({
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    resignedBy: 'w',
  });
  assert.equal(resign.isOver, true);
  assert.equal(resign.winner, 'b');

  const pgn = buildPgn({
    initialFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    moves: [],
    whiteName: 'Player',
    blackName: 'Stockfish',
    result: '*',
  });
  assert.ok(pgn.includes('[White "Player"]'));
  assert.equal(formatClock(185), '3:05');
  assert.equal(formatClock(7.4), '0:07.4');
});

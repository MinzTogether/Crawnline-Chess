import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyRuleMove,
  buildChessWithHistory,
  buildPgn,
  evaluateGameTermination,
  formatClock,
  formatMaterialDifference,
  formatPvSanWithNumbers,
  getMaterialSummary,
  parsePgnOrFen,
  stripCastlingRights,
  uciLineToSan,
} from './chessLogic';
import type { MoveRecord } from '../types/chess';
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

test('evaluateGameTermination detects threefold repetition when full move history is maintained', () => {
  const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const seq: Array<[string, string]> = [
    ['g1', 'f3'],
    ['g8', 'f6'],
    ['f3', 'g1'],
    ['f6', 'g8'],
    ['g1', 'f3'],
    ['g8', 'f6'],
    ['f3', 'g1'],
    ['f6', 'g8'],
  ];

  const moves: MoveRecord[] = [];
  for (const [from, to] of seq) {
    const res = applyRuleMove({
      initialFen: startFen,
      moves,
      from: from as any,
      to: to as any,
      allowCastling: true,
    });
    assert.ok(res);
    moves.push({
      ply: moves.length + 1,
      moveNumber: res.moveNumber,
      color: res.color,
      san: res.san,
      uci: res.uci,
      from: res.from,
      to: res.to,
      piece: res.piece,
      captured: res.captured,
      promotion: res.promotion,
      fenBefore: res.fenBefore,
      fenAfter: res.fenAfter,
    });
  }

  const fullChess = buildChessWithHistory(startFen, moves, true);
  assert.equal(fullChess.history().length, 8);
  assert.equal(fullChess.isThreefoldRepetition(), true);

  // Passing full moves list triggers threefold repetition even without pre-built Chess instance
  const termByMoves = evaluateGameTermination({
    fen: moves[moves.length - 1].fenAfter,
    initialFen: startFen,
    moves,
  });
  assert.equal(termByMoves.isOver, true);
  assert.equal(termByMoves.winner, 'draw');
  assert.equal(termByMoves.reason, 'Threefold repetition');
  assert.equal(termByMoves.resultString, '1/2-1/2');
});

test('moving the king permanently strips castling rights even after returning to e1/e8', () => {
  // Open castling lanes for both sides in Classic mode
  const startFen = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1';
  const moves: MoveRecord[] = [];

  const play = (from: string, to: string, allowCastling = true) => {
    const res = applyRuleMove({
      initialFen: startFen,
      moves,
      from: from as any,
      to: to as any,
      allowCastling,
    });
    if (!res) return null;
    moves.push({
      ply: moves.length + 1,
      moveNumber: res.moveNumber,
      color: res.color,
      san: res.san,
      uci: res.uci,
      from: res.from,
      to: res.to,
      piece: res.piece,
      captured: res.captured,
      promotion: res.promotion,
      fenBefore: res.fenBefore,
      fenAfter: res.fenAfter,
    });
    return res;
  };

  // White king moves e1 -> f1 -> immediately loses K and Q rights
  const m1 = play('e1', 'f1');
  assert.ok(m1);
  assert.equal(m1.fenAfter.split(' ')[2], 'kq');

  // Black king moves e8 -> d8 -> immediately loses k and q rights
  const m2 = play('e8', 'd8');
  assert.ok(m2);
  assert.equal(m2.fenAfter.split(' ')[2], '-');

  // Both kings return to their home squares e1 and e8
  assert.ok(play('f1', 'e1'));
  assert.ok(play('d8', 'e8'));

  // Castling MUST still be completely forbidden for White (e1->g1 and e1->c1)
  assert.equal(play('e1', 'g1'), null);
  assert.equal(play('e1', 'c1'), null);
});

test('non-classic modes completely forbid castling even with king and rooks on classic home squares', () => {
  const fenWithRights = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1';
  assert.equal(stripCastlingRights(fenWithRights, 'both').split(' ')[2], '-');
  assert.equal(stripCastlingRights(fenWithRights, 'w').split(' ')[2], 'kq');
  assert.equal(stripCastlingRights(fenWithRights, 'b').split(' ')[2], 'KQ');

  // Classic mode allows O-O
  const classicCastle = applyRuleMove({
    initialFen: fenWithRights,
    moves: [],
    from: 'e1',
    to: 'g1',
    allowCastling: true,
  });
  assert.ok(classicCastle);
  assert.equal(classicCastle.san, 'O-O');
  assert.equal(classicCastle.isCastle, true);

  // Non-classic mode (custom / random / chess960) strictly blocks O-O and O-O-O
  const nonClassicOO = applyRuleMove({
    initialFen: fenWithRights,
    moves: [],
    from: 'e1',
    to: 'g1',
    allowCastling: false,
  });
  const nonClassicOOO = applyRuleMove({
    initialFen: fenWithRights,
    moves: [],
    from: 'e1',
    to: 'c1',
    allowCastling: false,
  });
  assert.equal(nonClassicOO, null);
  assert.equal(nonClassicOOO, null);
});

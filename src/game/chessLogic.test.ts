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
  getPieceInventoryFromFen,
  isTacticalPieceSacrifice,
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

test('getMaterialSummary computes material advantage and never fabricates captures from default counts', () => {
  // Non-standard / partial FEN with NO moves and NO initialFen must NOT assume standard 32-piece start
  const fen = 'rnb1kbnr/ppppppp1/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const withoutContext = getMaterialSummary(fen);
  assert.deepEqual(withoutContext.capturedByWhite, []);
  assert.deepEqual(withoutContext.capturedByBlack, []);
  assert.equal(withoutContext.advantage, 10);
  assert.equal(withoutContext.whiteMaterial, 39);
  assert.equal(withoutContext.blackMaterial, 29);

  // When explicit initialFen (or initialInventory) is provided, missing pieces vs that baseline are reported
  const stdStart = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const withInitialFen = getMaterialSummary(fen, { initialFen: stdStart });
  assert.deepEqual(withInitialFen.capturedByWhite, ['q', 'p']);
  assert.deepEqual(withInitialFen.capturedByBlack, []);
  assert.equal(withInitialFen.advantage, 10);

  const withInitialInventory = getMaterialSummary(fen, {
    initialInventory: getPieceInventoryFromFen(fen),
  });
  assert.deepEqual(withInitialInventory.capturedByWhite, []);
  assert.deepEqual(withInitialInventory.capturedByBlack, []);
});

test('getMaterialSummary handles pawn promotion, capture-promotion, and capturing a promoted piece accurately', () => {
  // Non-standard starting position: White Rook (5) + Pawn on e7 (1) vs Black Rook on a8 (5) -> +1
  const initialFen = 'r5k1/4P3/8/8/8/8/8/4K2R w - - 0 1';
  const moves: MoveRecord[] = [];

  const play = (from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => {
    const res = applyRuleMove({
      initialFen,
      moves,
      from: from as any,
      to: to as any,
      promotion,
      allowCastling: false,
    });
    assert.ok(res, `Expected legal move ${from}->${to}`);
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

  // Ply 0: Custom/non-standard start has ZERO phantom captures and exact +1 advantage
  const atStart = getMaterialSummary(initialFen, { initialFen, moves: [] });
  assert.deepEqual(atStart.capturedByWhite, []);
  assert.deepEqual(atStart.capturedByBlack, []);
  assert.equal(atStart.advantage, 1);

  // Ply 1: White promotes e7->e8=Q (non-capture) -> NO phantom pawn captured; advantage jumps +1 -> +9!
  const promo = play('e7', 'e8', 'q');
  const afterPromo = getMaterialSummary(promo.fenAfter, { initialFen, moves });
  assert.deepEqual(afterPromo.capturedByWhite, []);
  assert.deepEqual(afterPromo.capturedByBlack, []);
  assert.equal(afterPromo.advantage, 9);

  // Even via initialFen-only fallback (no moves), promoting a pawn does NOT create a phantom captured pawn
  const afterPromoByInitialFen = getMaterialSummary(promo.fenAfter, { initialFen });
  assert.deepEqual(afterPromoByInitialFen.capturedByWhite, []);
  assert.deepEqual(afterPromoByInitialFen.capturedByBlack, []);
  assert.equal(afterPromoByInitialFen.advantage, 9);

  // Ply 2: Black captures the promoted Queen (Rxe8) -> Black captured a QUEEN ('q'), NOT a pawn!
  const capturePromoted = play('a8', 'e8');
  const afterCapturePromoted = getMaterialSummary(capturePromoted.fenAfter, { initialFen, moves });
  assert.deepEqual(afterCapturePromoted.capturedByWhite, []);
  assert.deepEqual(afterCapturePromoted.capturedByBlack, ['q']);
  assert.equal(afterCapturePromoted.advantage, 0);

  // Capture-promotion: pawn captures a Black Rook and promotes to Knight (underpromotion)
  const capPromoStart = '3rk3/4P3/8/8/8/8/8/4K3 w - - 0 1';
  const capRes = applyRuleMove({
    initialFen: capPromoStart,
    moves: [],
    from: 'e7',
    to: 'd8',
    promotion: 'n',
    allowCastling: false,
  });
  assert.ok(capRes);
  const capMoves: MoveRecord[] = [
    {
      ply: 1,
      moveNumber: capRes.moveNumber,
      color: capRes.color,
      san: capRes.san,
      uci: capRes.uci,
      from: capRes.from,
      to: capRes.to,
      piece: capRes.piece,
      captured: capRes.captured,
      promotion: capRes.promotion,
      fenBefore: capRes.fenBefore,
      fenAfter: capRes.fenAfter,
    },
  ];
  const afterCapPromo = getMaterialSummary(capRes.fenAfter, {
    initialFen: capPromoStart,
    moves: capMoves,
  });
  assert.deepEqual(afterCapPromo.capturedByWhite, ['r']);
  assert.deepEqual(afterCapPromo.capturedByBlack, []);
  assert.equal(afterCapPromo.advantage, 3); // White has promoted Knight (+3), Black has only King (0)
});

test('getMaterialSummary handles multiple pieces of same type, Custom Positions, and en passant', () => {
  // Custom Position: White has 3 Queens (27), Black has 2 Rooks + 2 Queens (28) -> advantage = -1
  const customFen = 'qq1rk1r1/8/8/8/8/8/8/QQQ1K3 w - - 0 1';
  const customMoves: MoveRecord[] = [];
  const playCustom = (from: string, to: string) => {
    const res = applyRuleMove({
      initialFen: customFen,
      moves: customMoves,
      from: from as any,
      to: to as any,
      allowCastling: false,
    });
    assert.ok(res);
    customMoves.push({
      ply: customMoves.length + 1,
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

  const atCustomStart = getMaterialSummary(customFen, { initialFen: customFen, moves: [] });
  assert.deepEqual(atCustomStart.capturedByWhite, []);
  assert.deepEqual(atCustomStart.capturedByBlack, []);
  assert.equal(atCustomStart.advantage, -1);

  // White Queen a1 captures Black Queen a8, then Black Queen b8 captures White Queen b1,
  // then White Queen c1 captures Black Queen b1 -> White captured 2 Queens, Black captured 1 Queen!
  playCustom('a1', 'a8');
  playCustom('b8', 'b1');
  const third = playCustom('c1', 'b1');

  const afterMulti = getMaterialSummary(third.fenAfter, {
    initialFen: customFen,
    moves: customMoves,
  });
  assert.deepEqual(afterMulti.capturedByWhite, ['q', 'q']);
  assert.deepEqual(afterMulti.capturedByBlack, ['q']);
  // White has 2 Queens (18) vs Black 2 Rooks (10) -> +8
  assert.equal(afterMulti.advantage, 8);

  // En passant capture records captured pawn accurately
  const epFen = '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1';
  const epRes = applyRuleMove({
    initialFen: epFen,
    moves: [],
    from: 'e5',
    to: 'd6',
    allowCastling: false,
  });
  assert.ok(epRes);
  assert.equal(epRes.captured, 'p');
  const epSummary = getMaterialSummary(epRes.fenAfter, {
    initialFen: epFen,
    moves: [
      {
        ply: 1,
        moveNumber: epRes.moveNumber,
        color: epRes.color,
        san: epRes.san,
        uci: epRes.uci,
        from: epRes.from,
        to: epRes.to,
        piece: epRes.piece,
        captured: epRes.captured,
        promotion: epRes.promotion,
        fenBefore: epRes.fenBefore,
        fenAfter: epRes.fenAfter,
      },
    ],
  });
  assert.deepEqual(epSummary.capturedByWhite, ['p']);
  assert.deepEqual(epSummary.capturedByBlack, []);
  assert.equal(epSummary.advantage, 1);
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

test('isTacticalPieceSacrifice detects true piece sacrifices and ignores quiet or equal trades', () => {
  // White sacrifices a Rook on e5 (undefended, black pawn d6 can take it)
  const beforeSacFen = '4k3/8/3p4/8/8/8/8/4R2K w - - 0 1';
  const sacResult = applyRuleMove({
    initialFen: beforeSacFen,
    moves: [],
    from: 'e1',
    to: 'e5',
    allowCastling: true,
  });
  assert.ok(sacResult);
  const sacMove: MoveRecord = {
    ply: 1,
    moveNumber: sacResult.moveNumber,
    color: sacResult.color,
    san: sacResult.san,
    uci: sacResult.uci,
    from: sacResult.from,
    to: sacResult.to,
    piece: sacResult.piece,
    captured: sacResult.captured,
    promotion: sacResult.promotion,
    fenBefore: sacResult.fenBefore,
    fenAfter: sacResult.fenAfter,
  };
  assert.equal(isTacticalPieceSacrifice(sacMove), true);

  // Quiet pawn move e2 -> e4 is not a piece sacrifice
  const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const quietResult = applyRuleMove({
    initialFen: startFen,
    moves: [],
    from: 'e2',
    to: 'e4',
    allowCastling: true,
  });
  assert.ok(quietResult);
  const quietMove: MoveRecord = {
    ply: 1,
    moveNumber: quietResult.moveNumber,
    color: quietResult.color,
    san: quietResult.san,
    uci: quietResult.uci,
    from: quietResult.from,
    to: quietResult.to,
    piece: quietResult.piece,
    captured: quietResult.captured,
    promotion: quietResult.promotion,
    fenBefore: quietResult.fenBefore,
    fenAfter: quietResult.fenAfter,
  };
  assert.equal(isTacticalPieceSacrifice(quietMove), false);
});

test('parsePgnOrFen detects Chess960 variant header, Shredder-FEN, and castling moves', () => {
  const chess960Pgn = [
    '[Event "Chess960 Match"]',
    '[Variant "Chess960"]',
    '[SetUp "1"]',
    '[FEN "bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPP/BBQNNRKR w HFhf - 0 1"]',
    '',
    '1. f4 f5 2. Rf3 Rf6 3. O-O O-O',
  ].join('\n');

  const res = parsePgnOrFen(chess960Pgn);
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.variant, 'Chess960');
    assert.equal(res.moves.length, 6);
    assert.equal(res.moves[4].san, 'O-O');
    assert.equal(res.moves[5].san, 'O-O');
    assert.deepEqual(res.initialChess960Rights, { wK: 7, wQ: 5, bK: 7, bQ: 5 });
  }

  // Raw Shredder-FEN import also resolves as Chess960
  const shredderRes = parsePgnOrFen('bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPP/BBQNNRKR w HFhf - 0 1');
  assert.equal(shredderRes.ok, true);
  if (shredderRes.ok) {
    assert.equal(shredderRes.variant, 'Chess960');
    assert.deepEqual(shredderRes.initialChess960Rights, { wK: 7, wQ: 5, bK: 7, bQ: 5 });
  }
});

test('evaluateGameTermination respects Chess960 Shredder-FEN castling rights for threefold repetition', () => {
  const initialFen = 'bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPP/BBQNNRKR w - - 0 1';
  const initialEngineFen = 'bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPP/BBQNNRKR w HFhf - 0 1';
  const boardAfterRightsLost = 'bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPP/BBQNNRKR w - - 0 1';
  const engineAfterRightsLost = 'bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPP/BBQNNRKR w Fhf - 0 1';

  // Position appears once with HFhf, and twice with Fhf -> NOT threefold repetition
  const twoAfterLoss: MoveRecord[] = [
    {
      ply: 1,
      moveNumber: 1,
      color: 'w',
      san: 'Rh2',
      uci: 'h1h2',
      from: 'h1',
      to: 'h2',
      piece: 'r',
      fenBefore: initialFen,
      fenAfter: 'bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPR/BBQNNRK1 b - - 1 1',
      engineFenAfter: 'bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPR/BBQNNRK1 b Fhf - 1 1',
    },
    {
      ply: 2,
      moveNumber: 1,
      color: 'b',
      san: 'a6',
      uci: 'a7a6',
      from: 'a7',
      to: 'a6',
      piece: 'p',
      fenBefore: 'bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPR/BBQNNRK1 b - - 1 1',
      fenAfter: boardAfterRightsLost,
      engineFenAfter: engineAfterRightsLost,
    },
    {
      ply: 3,
      moveNumber: 2,
      color: 'w',
      san: 'Rh2',
      uci: 'h1h2',
      from: 'h1',
      to: 'h2',
      piece: 'r',
      fenBefore: boardAfterRightsLost,
      fenAfter: 'bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPR/BBQNNRK1 b - - 1 2',
      engineFenAfter: 'bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPR/BBQNNRK1 b Fhf - 1 2',
    },
    {
      ply: 4,
      moveNumber: 2,
      color: 'b',
      san: 'a6',
      uci: 'a7a6',
      from: 'a7',
      to: 'a6',
      piece: 'p',
      fenBefore: 'bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPR/BBQNNRK1 b - - 1 2',
      fenAfter: boardAfterRightsLost,
      engineFenAfter: engineAfterRightsLost,
    },
  ];

  const notYetThreefold = evaluateGameTermination({
    fen: boardAfterRightsLost,
    initialFen,
    initialEngineFen,
    moves: twoAfterLoss,
    allowCastling: false,
    chess960Rights: { wK: null, wQ: 5, bK: 7, bQ: 5 },
  });
  assert.equal(notYetThreefold.isOver, false);

  // One more occurrence with Fhf -> 3 identical Shredder-FEN positions -> Threefold repetition!
  const threeAfterLoss: MoveRecord[] = [
    ...twoAfterLoss,
    {
      ...twoAfterLoss[3],
      ply: 5,
      moveNumber: 3,
    },
  ];
  const isThreefold = evaluateGameTermination({
    fen: boardAfterRightsLost,
    initialFen,
    initialEngineFen,
    moves: threeAfterLoss,
    allowCastling: false,
    chess960Rights: { wK: null, wQ: 5, bK: 7, bQ: 5 },
  });
  assert.equal(isThreefold.isOver, true);
  assert.equal(isThreefold.reason, 'Threefold repetition');
});

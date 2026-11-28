import test from 'node:test';
import assert from 'node:assert/strict';
import type { Square } from 'chess.js';
import { applyRuleMove } from './chessLogic';
import { executeMatchReviewPass, type SinglePositionEvaluation } from './matchReview';
import {
  StockfishAnalyzer,
  type BootableWorkerLike,
  type StockfishWorkerFactory,
} from '../engine/stockfishService';
import type { MoveRecord } from '../types/chess';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function buildSampleMoves(pairs: Array<[Square, Square]>): MoveRecord[] {
  const moves: MoveRecord[] = [];
  for (const [from, to] of pairs) {
    const res = applyRuleMove({
      initialFen: START_FEN,
      moves,
      from,
      to,
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
  return moves;
}

const okEval = (cp: number, bestMove: string | null = 'e2e4'): SinglePositionEvaluation => ({
  status: 'completed',
  score: { type: 'cp', value: cp },
  bestMove,
});

test('executeMatchReviewPass completes full review and reports progress up to 100%', async () => {
  const sampleMoves = buildSampleMoves([
    ['e2', 'e4'],
    ['e7', 'e5'],
    ['g1', 'f3'],
  ]);

  const progressUpdates: number[] = [];
  const result = await executeMatchReviewPass({
    initialFen: START_FEN,
    moves: sampleMoves,
    isStandardVariant: true,
    evaluatePosition: async () => okEval(25),
    isCancelled: () => false,
    onMoveReviewed: ({ progressPct }) => {
      progressUpdates.push(progressPct);
    },
  });

  assert.equal(result.completed, true);
  assert.equal(result.cancelled, false);
  assert.equal(result.error, null);
  assert.deepEqual(progressUpdates, [33, 67, 100]);
  assert.equal(result.reviewedMoves.length, 3);
  for (const m of result.reviewedMoves) {
    assert.ok(m.classification);
    assert.equal(typeof m.accuracy, 'number');
  }
});

test('executeMatchReviewPass evaluates terminal checkmate move directly without fake 0cp score', async () => {
  // Fool's Mate: 1. f3 e5 2. g4 Qh4#
  const foolsMateMoves = buildSampleMoves([
    ['f2', 'f3'],
    ['e7', 'e5'],
    ['g2', 'g4'],
    ['d8', 'h4'],
  ]);

  let evalCalls = 0;
  const result = await executeMatchReviewPass({
    initialFen: START_FEN,
    moves: foolsMateMoves,
    isStandardVariant: true,
    evaluatePosition: async () => {
      evalCalls += 1;
      return okEval(-200, 'd8h4');
    },
    isCancelled: () => false,
  });

  assert.equal(result.completed, true);
  // 1 initial + 3 non-terminal moves = 4 Stockfish calls; ply 4 (checkmate) resolved directly
  assert.equal(evalCalls, 4);
  assert.deepEqual(result.reviewedMoves[3].evalAfter, { type: 'mate', value: -1 });
});

test('executeMatchReviewPass aborts cleanly on engine error or timeout without writing fake evaluations', async () => {
  const sampleMoves = buildSampleMoves([
    ['e2', 'e4'],
    ['e7', 'e5'],
    ['g1', 'f3'],
  ]);

  let callCount = 0;
  const progressUpdates: number[] = [];

  const result = await executeMatchReviewPass({
    initialFen: START_FEN,
    moves: sampleMoves,
    isStandardVariant: true,
    evaluatePosition: async () => {
      callCount += 1;
      if (callCount <= 2) return okEval(20);
      return {
        status: 'timeout',
        score: null,
        bestMove: null,
        error: 'Stockfish search timed out',
      };
    },
    isCancelled: () => false,
    onMoveReviewed: ({ progressPct }) => {
      progressUpdates.push(progressPct);
    },
  });

  assert.equal(result.completed, false);
  assert.equal(result.cancelled, false);
  assert.match(result.error ?? '', /timed out/i);
  assert.deepEqual(progressUpdates, [33]);
  // Ply 2 and 3 must NOT have fake 0cp evaluations written
  assert.equal(result.reviewedMoves[1].evalAfter, undefined);
  assert.equal(result.reviewedMoves[1].classification, undefined);
  assert.equal(result.reviewedMoves[2].evalAfter, undefined);
});

test('executeMatchReviewPass exits immediately without mutating when cancelled before initial eval resolves', async () => {
  const sampleMoves = buildSampleMoves([
    ['e2', 'e4'],
    ['e7', 'e5'],
  ]);

  let cancelled = false;
  let resolveInitial!: (val: SinglePositionEvaluation) => void;
  let reviewCallbackCount = 0;

  const reviewPromise = executeMatchReviewPass({
    initialFen: START_FEN,
    moves: sampleMoves,
    isStandardVariant: true,
    evaluatePosition: () =>
      new Promise<SinglePositionEvaluation>((resolve) => {
        resolveInitial = resolve;
      }),
    isCancelled: () => cancelled,
    onMoveReviewed: () => {
      reviewCallbackCount += 1;
    },
  });

  cancelled = true;
  resolveInitial(okEval(20));

  const result = await reviewPromise;
  assert.equal(result.completed, false);
  assert.equal(result.cancelled, true);
  assert.equal(reviewCallbackCount, 0);
  assert.equal(result.reviewedMoves[0].classification, undefined);
});

test('executeMatchReviewPass stops cleanly mid-review when cancelled while awaiting a move evaluation', async () => {
  const sampleMoves = buildSampleMoves([
    ['e2', 'e4'],
    ['e7', 'e5'],
    ['g1', 'f3'],
  ]);

  let cancelled = false;
  let evalCalls = 0;
  let releasePly2!: (val: SinglePositionEvaluation) => void;
  const reportedProgress: number[] = [];

  const reviewPromise = executeMatchReviewPass({
    initialFen: START_FEN,
    moves: sampleMoves,
    isStandardVariant: true,
    evaluatePosition: () => {
      evalCalls += 1;
      if (evalCalls <= 2) {
        return Promise.resolve(okEval(20));
      }
      return new Promise<SinglePositionEvaluation>((resolve) => {
        releasePly2 = resolve;
      });
    },
    isCancelled: () => cancelled,
    onMoveReviewed: ({ progressPct }) => {
      reportedProgress.push(progressPct);
    },
  });

  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(reportedProgress, [33]);
  assert.equal(evalCalls, 3);

  cancelled = true;
  releasePly2(okEval(15, 'g1f3'));

  const result = await reviewPromise;
  assert.equal(result.completed, false);
  assert.equal(result.cancelled, true);
  assert.deepEqual(reportedProgress, [33]);
  assert.equal(evalCalls, 3);
  assert.ok(result.reviewedMoves[0].classification);
  assert.equal(result.reviewedMoves[1].classification, undefined);
  assert.equal(result.reviewedMoves[2].classification, undefined);
});

test('cancelling review via StockfishAnalyzer.stop() unblocks pending evaluateOnce and halts review cleanly', async () => {
  const sampleMoves = buildSampleMoves([
    ['e2', 'e4'],
    ['e7', 'e5'],
  ]);

  let emitWorkerMessage: (data: string) => void = () => {};
  const worker: BootableWorkerLike = {
    postMessage() {},
    terminate() {},
    addEventListener() {},
    removeEventListener() {},
  };
  const factory: StockfishWorkerFactory = async (callbacks) => {
    emitWorkerMessage = (data: string) => callbacks.onMessage({ data } as MessageEvent);
    return { worker, backend: 'wasm', disposeListeners: () => {} };
  };

  const analyzer = new StockfishAnalyzer(factory);
  let activeRunId = 1;
  const runId = activeRunId;
  let updates = 0;

  const reviewPromise = executeMatchReviewPass({
    initialFen: START_FEN,
    moves: sampleMoves,
    isStandardVariant: true,
    evaluatePosition: (fen, depth) => analyzer.evaluateOnce(fen, depth),
    isCancelled: () => activeRunId !== runId,
    onMoveReviewed: () => {
      updates += 1;
    },
  });

  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  emitWorkerMessage('readyok');

  activeRunId += 1;
  analyzer.stop();

  const result = await reviewPromise;
  assert.equal(result.completed, false);
  assert.equal(result.cancelled, true);
  assert.equal(result.error, null);
  assert.equal(updates, 0);

  analyzer.terminate();
});

test('overlapping review runs prevent stale run #1 from writing after run #2 supersedes it', async () => {
  const sampleMoves = buildSampleMoves([
    ['e2', 'e4'],
    ['e7', 'e5'],
  ]);

  let currentRunId = 0;
  let resolveRun1Eval!: (val: SinglePositionEvaluation) => void;
  const writes: string[] = [];

  const run1Id = ++currentRunId;
  const run1Promise = executeMatchReviewPass({
    initialFen: START_FEN,
    moves: sampleMoves,
    isStandardVariant: true,
    evaluatePosition: () =>
      new Promise<SinglePositionEvaluation>((resolve) => {
        resolveRun1Eval = resolve;
      }),
    isCancelled: () => currentRunId !== run1Id,
    onMoveReviewed: () => {
      writes.push('run1');
    },
  });

  const run2Id = ++currentRunId;
  const run2Promise = executeMatchReviewPass({
    initialFen: START_FEN,
    moves: sampleMoves,
    isStandardVariant: true,
    evaluatePosition: async () => okEval(30),
    isCancelled: () => currentRunId !== run2Id,
    onMoveReviewed: () => {
      writes.push('run2');
    },
  });

  resolveRun1Eval(okEval(-999, 'a2a3'));

  const [res1, res2] = await Promise.all([run1Promise, run2Promise]);
  assert.equal(res1.completed, false);
  assert.equal(res2.completed, true);
  assert.deepEqual(writes, ['run2', 'run2']);
});

// ---------- End-to-End Game Review <-> StockfishAnalyzer Job Queue Scenarios ----------

function createAutoRespondingAnalyzerHarness(options?: {
  crashOnGoNumber?: number;
  evalDelayMs?: number;
}) {
  let bootCount = 0;
  let goCount = 0;
  const terminatedWorkers: number[] = [];

  const factory: StockfishWorkerFactory = async (callbacks) => {
    bootCount += 1;
    const workerId = bootCount;
    let alive = true;
    let currentDepth = 10;
    let pendingTimer: ReturnType<typeof setTimeout> | null = null;

    const clearTimer = () => {
      if (pendingTimer !== null) {
        clearTimeout(pendingTimer);
        pendingTimer = null;
      }
    };

    const worker: BootableWorkerLike = {
      postMessage(cmd: string) {
        if (!alive) return;
        if (cmd === 'isready') {
          setTimeout(() => {
            if (alive) callbacks.onMessage({ data: 'readyok' } as MessageEvent);
          }, 0);
        } else if (cmd.startsWith('go depth ')) {
          goCount += 1;
          const thisGo = goCount;
          currentDepth = Number(cmd.replace('go depth ', '')) || 10;
          clearTimer();
          pendingTimer = setTimeout(() => {
            pendingTimer = null;
            if (!alive) return;
            if (options?.crashOnGoNumber && thisGo === options.crashOnGoNumber) {
              callbacks.onError(new Error('WASM runtime trap during review'));
              return;
            }
            const cp = 20 + thisGo * 5;
            callbacks.onMessage({
              data: `info depth ${currentDepth} seldepth ${currentDepth + 1} multipv 1 score cp ${cp} nodes 500 nps 5000 pv e2e4`,
            } as MessageEvent);
            callbacks.onMessage({ data: 'bestmove e2e4' } as MessageEvent);
          }, options?.evalDelayMs ?? 8);
        } else if (cmd === 'stop') {
          clearTimer();
          setTimeout(() => {
            if (alive) callbacks.onMessage({ data: 'bestmove e2e4' } as MessageEvent);
          }, 0);
        }
      },
      terminate() {
        alive = false;
        clearTimer();
        terminatedWorkers.push(workerId);
      },
      addEventListener() {},
      removeEventListener() {},
    };

    return {
      worker,
      backend: 'wasm',
      disposeListeners: () => {
        alive = false;
        clearTimer();
      },
    };
  };

  return {
    factory,
    getBootCount: () => bootCount,
    getGoCount: () => goCount,
    terminatedWorkers,
  };
}

test('Scenario 1: Starting Game Review while realtime analysis is running yields clean handoff and resumes realtime afterwards', async () => {
  const sampleMoves = buildSampleMoves([
    ['e2', 'e4'],
    ['e7', 'e5'],
    ['g1', 'f3'],
  ]);
  const harness = createAutoRespondingAnalyzerHarness({ evalDelayMs: 12 });
  const analyzer = new StockfishAnalyzer(harness.factory);

  let isReviewing = false;
  const realtimeUpdatesDuringReview: number[] = [];
  const realtimeUpdatesAfterReview: number[] = [];

  // 1. Start realtime analysis
  await analyzer.analyzePosition(
    sampleMoves[2].fenAfter,
    { depth: 16, multiPv: 2 },
    (snap) => {
      if (isReviewing) realtimeUpdatesDuringReview.push(snap.depth);
    }
  );
  await new Promise((r) => setTimeout(r, 4));

  // 2. Start Game Review while realtime analysis is actively searching
  isReviewing = true;
  analyzer.stop();
  const reviewRes = await executeMatchReviewPass({
    initialFen: START_FEN,
    moves: sampleMoves,
    isStandardVariant: true,
    depth: 10,
    evaluatePosition: (fen, depth) => analyzer.evaluateOnce(fen, depth),
    isCancelled: () => false,
  });
  isReviewing = false;

  assert.equal(reviewRes.completed, true);
  assert.equal(reviewRes.error, null);
  assert.equal(realtimeUpdatesDuringReview.length, 0);
  assert.deepEqual(analyzer.getQueueState(), {
    phase: 'idle',
    isRunning: true,
    backend: 'wasm',
    activeJobMode: null,
    queuedJobMode: null,
    pendingSyncCount: 0,
  });

  // 3. Resume realtime analysis after Review finishes
  await analyzer.analyzePosition(
    sampleMoves[2].fenAfter,
    { depth: 14, multiPv: 2 },
    (snap) => {
      realtimeUpdatesAfterReview.push(snap.depth);
    }
  );
  await new Promise((r) => setTimeout(r, 30));

  assert.ok(realtimeUpdatesAfterReview.length >= 1);
  assert.equal(harness.getBootCount(), 1);
  analyzer.terminate();
});

test('Scenario 2 & 3: Exiting Review mid-way and switching screens cancel cleanly with zero hung Promises or lingering jobs', async () => {
  const sampleMoves = buildSampleMoves([
    ['e2', 'e4'],
    ['e7', 'e5'],
    ['g1', 'f3'],
    ['b8', 'c6'],
  ]);
  const harness = createAutoRespondingAnalyzerHarness({ evalDelayMs: 25 });
  const analyzer = new StockfishAnalyzer(harness.factory);

  // Mid-review cancel via stop()
  let runId = 1;
  const firstRunId = runId;
  const progressA: number[] = [];
  const reviewA = executeMatchReviewPass({
    initialFen: START_FEN,
    moves: sampleMoves,
    isStandardVariant: true,
    depth: 10,
    evaluatePosition: (fen, depth) => analyzer.evaluateOnce(fen, depth),
    isCancelled: () => runId !== firstRunId,
    onMoveReviewed: ({ progressPct }) => progressA.push(progressPct),
  });

  await new Promise((r) => setTimeout(r, 35));
  runId += 1;
  analyzer.stop();

  const resA = await reviewA;
  assert.equal(resA.completed, false);
  assert.equal(resA.cancelled, true);
  assert.equal(resA.error, null);
  assert.ok(progressA.length < sampleMoves.length);
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(analyzer.getQueueState().activeJobMode, null);
  assert.equal(analyzer.getQueueState().queuedJobMode, null);

  // Switch screen mid-review (terminate + runId bump) -> no leaked worker, next screen works cleanly
  const secondRunId = ++runId;
  const reviewB = executeMatchReviewPass({
    initialFen: START_FEN,
    moves: sampleMoves,
    isStandardVariant: true,
    depth: 10,
    evaluatePosition: (fen, depth) => analyzer.evaluateOnce(fen, depth),
    isCancelled: () => runId !== secondRunId,
  });

  await new Promise((r) => setTimeout(r, 15));
  runId += 1;
  analyzer.terminate();

  const resB = await reviewB;
  assert.equal(resB.completed, false);
  assert.equal(resB.cancelled, true);
  assert.equal(resB.error, null);
  assert.equal(analyzer.isRunning(), false);
  assert.deepEqual(analyzer.getQueueState(), {
    phase: 'idle',
    isRunning: false,
    backend: null,
    activeJobMode: null,
    queuedJobMode: null,
    pendingSyncCount: 0,
  });
});

test('Scenario 4: Starting Review #2 while Review #1 is running on the same StockfishAnalyzer settles #1 cleanly and finishes #2', async () => {
  const game1Moves = buildSampleMoves([
    ['e2', 'e4'],
    ['e7', 'e5'],
    ['d2', 'd4'],
  ]);
  const game2Moves = buildSampleMoves([
    ['d2', 'd4'],
    ['d7', 'd5'],
  ]);
  const harness = createAutoRespondingAnalyzerHarness({ evalDelayMs: 18 });
  const analyzer = new StockfishAnalyzer(harness.factory);

  let currentRunId = 0;
  const writes: Array<{ run: number; plyCount: number }> = [];

  const run1Id = ++currentRunId;
  analyzer.stop();
  const review1 = executeMatchReviewPass({
    initialFen: START_FEN,
    moves: game1Moves,
    isStandardVariant: true,
    depth: 10,
    evaluatePosition: (fen, depth) => analyzer.evaluateOnce(fen, depth),
    isCancelled: () => currentRunId !== run1Id,
    onMoveReviewed: ({ reviewedMoves }) => {
      if (currentRunId !== run1Id) return;
      writes.push({ run: 1, plyCount: reviewedMoves.length });
    },
  });

  // Interrupt Review #1 mid-flight with Review #2
  await new Promise((r) => setTimeout(r, 25));
  const run2Id = ++currentRunId;
  analyzer.stop();
  const review2 = executeMatchReviewPass({
    initialFen: START_FEN,
    moves: game2Moves,
    isStandardVariant: true,
    depth: 10,
    evaluatePosition: (fen, depth) => analyzer.evaluateOnce(fen, depth),
    isCancelled: () => currentRunId !== run2Id,
    onMoveReviewed: ({ reviewedMoves }) => {
      if (currentRunId !== run2Id) return;
      writes.push({ run: 2, plyCount: reviewedMoves.length });
    },
  });

  const [res1, res2] = await Promise.all([review1, review2]);
  assert.equal(res1.completed, false);
  assert.equal(res1.cancelled, true);
  assert.equal(res2.completed, true);
  assert.equal(res2.cancelled, false);
  assert.equal(res2.error, null);
  assert.equal(writes[writes.length - 1]?.run, 2);
  assert.equal(writes.filter((w) => w.run === 2).length, 2);
  assert.deepEqual(analyzer.getQueueState(), {
    phase: 'idle',
    isRunning: true,
    backend: 'wasm',
    activeJobMode: null,
    queuedJobMode: null,
    pendingSyncCount: 0,
  });

  analyzer.terminate();
});

test('Scenario 5: Worker runtime crash mid-Review aborts with real error (zero fake evals) and Retry Review auto-reboots and succeeds', async () => {
  const sampleMoves = buildSampleMoves([
    ['e2', 'e4'],
    ['e7', 'e5'],
    ['g1', 'f3'],
  ]);
  // Crash on the 3rd go command (during ply 2 evaluation)
  const harness = createAutoRespondingAnalyzerHarness({ crashOnGoNumber: 3, evalDelayMs: 6 });
  const analyzer = new StockfishAnalyzer(harness.factory);

  const failedRun = await executeMatchReviewPass({
    initialFen: START_FEN,
    moves: sampleMoves,
    isStandardVariant: true,
    depth: 10,
    evaluatePosition: (fen, depth) => analyzer.evaluateOnce(fen, depth),
    isCancelled: () => false,
  });

  assert.equal(failedRun.completed, false);
  assert.equal(failedRun.cancelled, false);
  assert.match(failedRun.error ?? '', /WASM runtime trap during review/);
  assert.equal(failedRun.reviewedMoves[1].evalAfter, undefined);
  assert.equal(failedRun.reviewedMoves[2].evalAfter, undefined);
  assert.equal(analyzer.isRunning(), false);
  assert.equal(harness.terminatedWorkers.length, 1);

  // User clicks Retry Review -> StockfishAnalyzer automatically boots worker #2 and completes 100%
  const retryRun = await executeMatchReviewPass({
    initialFen: START_FEN,
    moves: sampleMoves,
    isStandardVariant: true,
    depth: 10,
    evaluatePosition: (fen, depth) => analyzer.evaluateOnce(fen, depth),
    isCancelled: () => false,
  });

  assert.equal(retryRun.completed, true);
  assert.equal(retryRun.cancelled, false);
  assert.equal(retryRun.error, null);
  assert.equal(harness.getBootCount(), 2);
  for (const m of retryRun.reviewedMoves) {
    assert.ok(m.evalAfter);
    assert.ok(m.classification);
  }
  assert.deepEqual(analyzer.getQueueState(), {
    phase: 'idle',
    isRunning: true,
    backend: 'wasm',
    activeJobMode: null,
    queuedJobMode: null,
    pendingSyncCount: 0,
  });

  analyzer.terminate();
});

test('Scenario 6: Chess960 Game Review sends UCI_Chess960=true + Shredder-FEN and classifies O-O (g1h1) accurately', async () => {
  const { applyChess960Move, createChess960Position } = await import('./chess960');
  const pos = createChess960Position(0); // bbqnnrkr
  let curFen = pos.fen;
  let curRights = pos.castlingRights;
  const chess960Moves: MoveRecord[] = [];

  for (const [from, to] of [
    ['f2', 'f4'],
    ['f7', 'f5'],
    ['f1', 'f3'],
    ['f8', 'f6'],
    ['g1', 'h1'], // Chess960 O-O (g1h1)
  ] as const) {
    const res = applyChess960Move(curFen, curRights, from, to);
    assert.ok(res);
    chess960Moves.push({
      ply: chess960Moves.length + 1,
      moveNumber: Math.floor(chess960Moves.length / 2) + 1,
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

  const sentCommands: string[] = [];
  const factory: StockfishWorkerFactory = async (callbacks) => {
    let alive = true;
    const worker: BootableWorkerLike = {
      postMessage(cmd: string) {
        if (!alive) return;
        sentCommands.push(cmd);
        if (cmd === 'isready') {
          setTimeout(() => {
            if (alive) callbacks.onMessage({ data: 'readyok' } as MessageEvent);
          }, 0);
        } else if (cmd.startsWith('go depth ')) {
          setTimeout(() => {
            if (!alive) return;
            callbacks.onMessage({
              data: 'info depth 10 seldepth 11 multipv 1 score cp 25 nodes 400 nps 4000 pv g1h1',
            } as MessageEvent);
            callbacks.onMessage({ data: 'bestmove g1h1' } as MessageEvent);
          }, 2);
        }
      },
      terminate() {
        alive = false;
      },
      addEventListener() {},
      removeEventListener() {},
    };
    return { worker, backend: 'wasm', disposeListeners: () => { alive = false; } };
  };

  const analyzer = new StockfishAnalyzer(factory);
  const reviewRes = await executeMatchReviewPass({
    initialFen: pos.fen,
    initialEngineFen: pos.shredderFen,
    moves: chess960Moves,
    isStandardVariant: false,
    depth: 10,
    evaluatePosition: (fen, depth, engineFen) =>
      analyzer.evaluateOnce(fen, depth, {
        chess960: true,
        engineFen: engineFen ?? fen,
      }),
    isCancelled: () => false,
  });

  assert.equal(reviewRes.completed, true);
  assert.equal(reviewRes.error, null);
  // Must enable UCI_Chess960 and send Shredder-FENs with real castling rights
  assert.ok(sentCommands.includes('setoption name UCI_Chess960 value true'));
  assert.ok(sentCommands.includes(`position fen ${pos.shredderFen}`));
  assert.ok(sentCommands.includes(`position fen ${chess960Moves[4].engineFenAfter}`));
  // Move 5 (O-O, uci g1h1) matches Stockfish bestmove g1h1 -> classified as Best with 100 accuracy
  assert.equal(reviewRes.reviewedMoves[4].san, 'O-O');
  assert.equal(reviewRes.reviewedMoves[4].classification, 'best');

  analyzer.terminate();
});

test('Game Review cancellation after ply 2 preserves reviewed prefix, skips remaining plies, and resumes realtime analysis on the same worker', async () => {
  const sixPlies = buildSampleMoves([
    ['e2', 'e4'],
    ['e7', 'e5'],
    ['g1', 'f3'],
    ['b8', 'c6'],
    ['f1', 'b5'],
    ['a7', 'a6'],
  ]);
  const harness = createAutoRespondingAnalyzerHarness({ evalDelayMs: 6 });
  const analyzer = new StockfishAnalyzer(harness.factory);

  let cancelled = false;
  let evalCalls = 0;
  const completedPlies: number[] = [];

  const reviewPromise = executeMatchReviewPass({
    initialFen: START_FEN,
    moves: sixPlies,
    isStandardVariant: true,
    depth: 10,
    evaluatePosition: (fen, depth) => {
      evalCalls += 1;
      return analyzer.evaluateOnce(fen, depth);
    },
    isCancelled: () => cancelled,
    onMoveReviewed: ({ reviewedMoves }) => {
      const done = reviewedMoves.filter((m) => Boolean(m.classification)).length;
      completedPlies.push(done);
      if (done === 2) {
        cancelled = true;
        analyzer.stop();
      }
    },
  });

  const res = await reviewPromise;
  assert.equal(res.completed, false);
  assert.equal(res.cancelled, true);
  assert.equal(res.error, null);
  assert.deepEqual(completedPlies, [1, 2]);
  // Initial FEN + ply 1 + ply 2 = 3 evaluations only; plies 3..6 MUST NOT be evaluated
  assert.equal(evalCalls, 3);
  assert.ok(res.reviewedMoves[0].classification);
  assert.ok(res.reviewedMoves[1].classification);
  assert.equal(res.reviewedMoves[2].classification, undefined);
  assert.equal(res.reviewedMoves[5].classification, undefined);

  // Realtime analysis must resume cleanly on the same StockfishAnalyzer without rebooting
  const liveDepths: number[] = [];
  await analyzer.analyzePosition(
    sixPlies[5].fenAfter,
    { depth: 12, multiPv: 1 },
    (snap) => {
      liveDepths.push(snap.depth);
    }
  );
  await new Promise((r) => setTimeout(r, 25));

  assert.ok(liveDepths.length >= 1);
  assert.equal(harness.getBootCount(), 1);
  analyzer.terminate();
});

test('Game Review restart recovers immediately after cancellation and replaces completed evaluations cleanly without mutating prior snapshots', async () => {
  const sampleMoves = buildSampleMoves([
    ['e2', 'e4'],
    ['e7', 'e5'],
    ['g1', 'f3'],
    ['b8', 'c6'],
  ]);
  const harness = createAutoRespondingAnalyzerHarness({ evalDelayMs: 10 });
  const analyzer = new StockfishAnalyzer(harness.factory);

  // Part A: Start Review #1, cancel mid-way, then immediately restart Review #2 on the same analyzer
  let activeRun = 1;
  const run1 = activeRun;
  const firstAttempt = executeMatchReviewPass({
    initialFen: START_FEN,
    moves: sampleMoves,
    isStandardVariant: true,
    depth: 10,
    evaluatePosition: (fen, depth) => analyzer.evaluateOnce(fen, depth),
    isCancelled: () => activeRun !== run1,
  });

  await new Promise((r) => setTimeout(r, 18));
  activeRun += 1;
  analyzer.stop();

  const run2 = activeRun;
  const restartedAttempt = executeMatchReviewPass({
    initialFen: START_FEN,
    moves: sampleMoves,
    isStandardVariant: true,
    depth: 10,
    evaluatePosition: (fen, depth) => analyzer.evaluateOnce(fen, depth),
    isCancelled: () => activeRun !== run2,
  });

  const [firstRes, restartedRes] = await Promise.all([firstAttempt, restartedAttempt]);
  assert.equal(firstRes.completed, false);
  assert.equal(firstRes.cancelled, true);
  assert.equal(restartedRes.completed, true);
  assert.equal(restartedRes.cancelled, false);
  assert.equal(restartedRes.error, null);
  assert.equal(restartedRes.reviewedMoves.length, 4);
  for (const m of restartedRes.reviewedMoves) {
    assert.ok(m.classification);
    assert.ok(m.evalAfter);
  }
  assert.deepEqual(analyzer.getQueueState(), {
    phase: 'idle',
    isRunning: true,
    backend: 'wasm',
    activeJobMode: null,
    queuedJobMode: null,
    pendingSyncCount: 0,
  });

  // Part B: Re-run Game Review after completion with new engine evaluations -> isolates prior snapshot cleanly
  const firstPassSnapshot = restartedRes.reviewedMoves.map((m) => ({
    ply: m.ply,
    evalAfter: m.evalAfter,
    accuracy: m.accuracy,
  }));

  const rerunRes = await executeMatchReviewPass({
    initialFen: START_FEN,
    moves: restartedRes.reviewedMoves,
    isStandardVariant: true,
    depth: 12,
    evaluatePosition: async (_fen, _depth) => okEval(150, 'e2e4'),
    isCancelled: () => false,
  });

  assert.equal(rerunRes.completed, true);
  assert.equal(rerunRes.error, null);
  assert.deepEqual(rerunRes.reviewedMoves[0].evalAfter, { type: 'cp', value: 150 });
  // Previous completed array MUST remain untouched (no cross-pass mutation)
  assert.deepEqual(
    restartedRes.reviewedMoves.map((m) => ({
      ply: m.ply,
      evalAfter: m.evalAfter,
      accuracy: m.accuracy,
    })),
    firstPassSnapshot
  );

  analyzer.terminate();
});

test('executeMatchReviewPass deduplicates repeated positions within a single pass while evaluating fresh on separate passes', async () => {
  // 1. Nf3 Nf6 2. Ng1 Ng8 returns to the exact starting position (same normalized FEN key)
  const repetitionMoves = buildSampleMoves([
    ['g1', 'f3'],
    ['g8', 'f6'],
    ['f3', 'g1'],
    ['f6', 'g8'],
  ]);

  let pass1Calls = 0;
  const pass1 = await executeMatchReviewPass({
    initialFen: START_FEN,
    moves: repetitionMoves,
    isStandardVariant: true,
    depth: 10,
    evaluatePosition: async () => {
      pass1Calls += 1;
      return okEval(20, 'e2e4');
    },
    isCancelled: () => false,
  });

  assert.equal(pass1.completed, true);
  // 5 FENs total (initial + 4 plies), but ply 4 repeats the initial FEN key -> only 4 engine calls needed
  assert.equal(pass1Calls, 4);
  assert.equal(pass1.reviewedMoves.length, 4);
  for (const m of pass1.reviewedMoves) {
    assert.ok(m.evalAfter);
    assert.ok(m.classification);
  }

  // A new separate review pass must NOT reuse pass 1's cache (e.g., if depth or engine changed)
  let pass2Calls = 0;
  const pass2 = await executeMatchReviewPass({
    initialFen: START_FEN,
    moves: repetitionMoves,
    isStandardVariant: true,
    depth: 12,
    evaluatePosition: async () => {
      pass2Calls += 1;
      return okEval(45, 'd2d4');
    },
    isCancelled: () => false,
  });

  assert.equal(pass2.completed, true);
  assert.equal(pass2Calls, 4);
  assert.deepEqual(pass2.reviewedMoves[3].evalAfter, { type: 'cp', value: 45 });
});





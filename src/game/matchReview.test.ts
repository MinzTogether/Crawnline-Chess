import test from 'node:test';
import assert from 'node:assert/strict';
import { applyRuleMove } from './chessLogic';
import { executeMatchReviewPass, type SinglePositionEvaluation } from './matchReview';
import {
  StockfishAnalyzer,
  type BootableWorkerLike,
  type StockfishWorkerFactory,
} from '../engine/stockfishService';
import type { MoveRecord } from '../types/chess';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function buildSampleMoves(pairs: Array<[string, string]>): MoveRecord[] {
  const moves: MoveRecord[] = [];
  for (const [from, to] of pairs) {
    const res = applyRuleMove({
      initialFen: START_FEN,
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

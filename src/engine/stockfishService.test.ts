import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bootStockfishWorker,
  StockfishAnalyzer,
  StockfishOpponent,
  type BootableWorkerEventMap,
  type BootableWorkerEventType,
  type BootableWorkerLike,
  type StockfishBootCallbacks,
  type StockfishWorkerFactory,
} from './stockfishService';
import { STOCKFISH_LEVELS } from '../types/chess';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4_FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
const AFTER_E5_FEN = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';

const flushAsync = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

type MockEventPayloadMap = {
  message: Partial<MessageEvent> & { data?: unknown };
  error: Partial<ErrorEvent> & { message?: string };
  messageerror: Partial<MessageEvent> & { message?: string };
};

class MockEventWorker implements BootableWorkerLike {
  readonly url: string;
  readonly sent: string[] = [];
  terminated = false;
  private listeners: {
    [K in BootableWorkerEventType]: Set<(event: BootableWorkerEventMap[K]) => void>;
  } = {
    message: new Set(),
    error: new Set(),
    messageerror: new Set(),
  };

  constructor(url: string) {
    this.url = url;
  }

  postMessage(message: string): void {
    this.sent.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  addEventListener<K extends BootableWorkerEventType>(
    type: K,
    listener: (event: BootableWorkerEventMap[K]) => void
  ): void {
    this.listeners[type].add(listener);
  }

  removeEventListener<K extends BootableWorkerEventType>(
    type: K,
    listener: (event: BootableWorkerEventMap[K]) => void
  ): void {
    this.listeners[type].delete(listener);
  }

  emit<K extends BootableWorkerEventType>(type: K, event: MockEventPayloadMap[K]): void {
    for (const fn of Array.from(this.listeners[type])) {
      fn(event as BootableWorkerEventMap[K]);
    }
  }
}

function createBootedHarness() {
  const workers: MockEventWorker[] = [];
  let bootCount = 0;

  const factory: StockfishWorkerFactory = async (callbacks: StockfishBootCallbacks) => {
    bootCount += 1;
    const worker = new MockEventWorker(`/mock/worker-${bootCount}.js`);
    workers.push(worker);

    const onError = (e: ErrorEvent) => callbacks.onError(new Error(e?.message || 'worker runtime error'));
    const onMessageError = (e: MessageEvent) => {
      const msg =
        typeof e === 'object' && e !== null && 'message' in e
          ? String((e as { message?: unknown }).message ?? '')
          : '';
      callbacks.onError(new Error(msg || 'worker messageerror'));
    };

    worker.addEventListener('message', callbacks.onMessage);
    worker.addEventListener('error', onError);
    worker.addEventListener('messageerror', onMessageError);

    return {
      worker,
      backend: 'wasm',
      disposeListeners: () => {
        worker.removeEventListener('message', callbacks.onMessage);
        worker.removeEventListener('error', onError);
        worker.removeEventListener('messageerror', onMessageError);
      },
    };
  };

  return {
    factory,
    workers,
    latest: () => workers[workers.length - 1],
    getBootCount: () => bootCount,
  };
}

// ---------- 1. Worker Boot, WASM, asm.js Fallback & Handshake ----------

test('bootStockfishWorker completes WASM UCI handshake (uci -> uciok -> isready -> readyok) and wires runtime error/messageerror', async () => {
  const created: MockEventWorker[] = [];
  const runtimeErrors: Error[] = [];
  const runtimeMessages: string[] = [];

  const bootPromise = bootStockfishWorker(
    {
      onMessage: (e) => runtimeMessages.push(String(e.data)),
      onError: (err) => runtimeErrors.push(err),
    },
    {
      handshakeTimeoutMs: 500,
      detectWasm: () => true,
      createWorker: (url) => {
        const w = new MockEventWorker(url);
        created.push(w);
        return w;
      },
    }
  );

  assert.equal(created.length, 1);
  assert.equal(created[0].url, '/stockfish/stockfish.wasm.js');
  assert.deepEqual(created[0].sent, ['uci']);

  created[0].emit('message', { data: 'id name Stockfish\nuciok' });
  assert.deepEqual(created[0].sent, ['uci', 'isready']);

  created[0].emit('message', { data: 'readyok' });
  const booted = await bootPromise;
  assert.equal(booted.backend, 'wasm');

  // Verify steady-state listeners receive message, error, and messageerror
  created[0].emit('message', { data: 'bestmove e2e4' });
  created[0].emit('error', { message: 'wasm trap' });
  created[0].emit('messageerror', { message: 'corrupt payload' });

  assert.deepEqual(runtimeMessages, ['bestmove e2e4']);
  assert.equal(runtimeErrors.length, 2);
  assert.match(runtimeErrors[0].message, /wasm trap/);
  assert.match(runtimeErrors[1].message, /corrupt payload/);

  booted.disposeListeners();
});

test('bootStockfishWorker falls back to asm.js on WASM error, messageerror, or handshake timeout', async () => {
  // Case A: WASM messageerror -> asm.js fallback
  const workersA: MockEventWorker[] = [];
  const bootA = bootStockfishWorker(
    { onMessage: () => {}, onError: () => {} },
    {
      handshakeTimeoutMs: 500,
      detectWasm: () => true,
      createWorker: (url) => {
        const w = new MockEventWorker(url);
        workersA.push(w);
        return w;
      },
    }
  );

  workersA[0].emit('messageerror', { message: 'bad wasm clone' });
  assert.equal(workersA[0].terminated, true);
  assert.equal(workersA.length, 2);
  assert.equal(workersA[1].url, '/stockfish/stockfish.js');

  workersA[1].emit('message', { data: 'uciok' });
  workersA[1].emit('message', { data: 'readyok' });
  const resA = await bootA;
  assert.equal(resA.backend, 'asmjs');
  resA.disposeListeners();

  // Case B: WASM handshake timeout -> asm.js fallback
  const workersB: MockEventWorker[] = [];
  const bootB = bootStockfishWorker(
    { onMessage: () => {}, onError: () => {} },
    {
      handshakeTimeoutMs: 40,
      detectWasm: () => true,
      createWorker: (url) => {
        const w = new MockEventWorker(url);
        workersB.push(w);
        if (url.endsWith('stockfish.js')) {
          setTimeout(() => {
            w.emit('message', { data: 'uciok' });
            w.emit('message', { data: 'readyok' });
          }, 5);
        }
        return w;
      },
    }
  );

  const resB = await bootB;
  assert.equal(workersB.length, 2);
  assert.equal(workersB[0].terminated, true);
  assert.equal(resB.backend, 'asmjs');
  resB.disposeListeners();
});

test('bootStockfishWorker rejects cleanly when both WASM and asm.js handshake time out', async () => {
  const workers: MockEventWorker[] = [];
  await assert.rejects(
    () =>
      bootStockfishWorker(
        { onMessage: () => {}, onError: () => {} },
        {
          handshakeTimeoutMs: 30,
          detectWasm: () => true,
          createWorker: (url) => {
            const w = new MockEventWorker(url);
            workers.push(w);
            return w;
          },
        }
      ),
    /timed out/i
  );
  assert.equal(workers.length, 2);
  assert.equal(workers[0].terminated, true);
  assert.equal(workers[1].terminated, true);
});

// ---------- 2. Single Worker Guarantee, Stop, Cancellation & No Fake Eval ----------

test('StockfishAnalyzer deduplicates concurrent init() calls and destroys late workers if terminated during boot', async () => {
  const harness = createBootedHarness();
  const analyzer = new StockfishAnalyzer(harness.factory);

  await Promise.all([analyzer.init(), analyzer.init(), analyzer.init()]);
  assert.equal(harness.getBootCount(), 1);
  analyzer.terminate();

  // Delayed boot aborted by terminate() -> newly resolved worker must be terminated immediately
  let resolveLate!: (worker: MockEventWorker) => void;
  const lateWorker = new MockEventWorker('/late.js');
  const delayedAnalyzer = new StockfishAnalyzer(async (callbacks) => {
    const w = await new Promise<MockEventWorker>((resolve) => {
      resolveLate = resolve;
    });
    w.addEventListener('message', callbacks.onMessage);
    return {
      worker: w,
      backend: 'wasm',
      disposeListeners: () => w.removeEventListener('message', callbacks.onMessage),
    };
  });

  const initPromise = delayedAnalyzer.init();
  delayedAnalyzer.terminate();
  resolveLate(lateWorker);

  await assert.rejects(() => initPromise, /aborted/i);
  assert.equal(lateWorker.terminated, true);
  assert.equal(delayedAnalyzer.isRunning(), false);
});

test('StockfishAnalyzer.stop() resolves active, syncing, and queued evaluateOnce Promises as cancelled without fake evals', async () => {
  const harness = createBootedHarness();
  const analyzer = new StockfishAnalyzer(harness.factory);

  // Active searching + queued job both cancelled cleanly
  const firstPromise = analyzer.evaluateOnce(START_FEN, 10);
  await flushAsync();
  harness.latest().emit('message', { data: 'readyok' });

  const secondPromise = analyzer.evaluateOnce(AFTER_E4_FEN, 10);
  await flushAsync();

  analyzer.stop();

  const [firstResult, secondResult] = await Promise.all([firstPromise, secondPromise]);
  assert.equal(firstResult.status, 'cancelled');
  assert.equal(firstResult.score, null);
  assert.equal(secondResult.status, 'cancelled');
  assert.equal(secondResult.score, null);

  // Complete stop handshake so analyzer returns idle
  harness.latest().emit('message', { data: 'bestmove e2e4' });

  // Syncing phase cancellation + stale readyok ignored
  const syncPromise = analyzer.evaluateOnce(AFTER_E5_FEN, 10);
  await flushAsync();
  analyzer.stop();

  const syncResult = await syncPromise;
  assert.equal(syncResult.status, 'cancelled');
  assert.equal(syncResult.score, null);

  const cmdCountBefore = harness.latest().sent.length;
  harness.latest().emit('message', { data: 'readyok' });
  assert.equal(harness.latest().sent.length, cmdCountBefore);

  analyzer.terminate();
});

test('StockfishAnalyzer resolves superseded evaluateOnce as cancelled and returns real score for newer job', async () => {
  const harness = createBootedHarness();
  const analyzer = new StockfishAnalyzer(harness.factory);

  const firstPromise = analyzer.evaluateOnce(START_FEN, 10);
  await flushAsync();
  harness.latest().emit('message', { data: 'readyok' });

  const secondPromise = analyzer.evaluateOnce(AFTER_E4_FEN, 10);
  await flushAsync();

  const firstResult = await firstPromise;
  assert.equal(firstResult.status, 'cancelled');
  assert.equal(firstResult.score, null);

  harness.latest().emit('message', { data: 'bestmove e2e4' });
  harness.latest().emit('message', { data: 'readyok' });
  harness.latest().emit('message', {
    data: 'info depth 10 seldepth 12 multipv 1 score cp -35 nodes 1000 nps 10000 pv c7c5',
  });
  harness.latest().emit('message', { data: 'bestmove c7c5' });

  const secondResult = await secondPromise;
  assert.equal(secondResult.status, 'completed');
  if (secondResult.status === 'completed') {
    assert.deepEqual(secondResult.score, { type: 'cp', value: 35 });
    assert.equal(secondResult.bestMove, 'c7c5');
  }

  analyzer.terminate();
});

// ---------- 3. Runtime Error, Missing Eval Guard, Timeouts & Safe Restart ----------

test('StockfishAnalyzer returns error (never fake 0cp) on runtime error, messageerror, or missing eval info line', async () => {
  const harness = createBootedHarness();
  const analyzer = new StockfishAnalyzer(harness.factory);

  // Case A: bestmove arrives with NO info score line -> must NOT fabricate 0cp
  const missingEvalPromise = analyzer.evaluateOnce(START_FEN, 10);
  await flushAsync();
  harness.latest().emit('message', { data: 'readyok' });
  harness.latest().emit('message', { data: 'bestmove e2e4' });

  const missingEvalRes = await missingEvalPromise;
  assert.equal(missingEvalRes.status, 'error');
  assert.equal(missingEvalRes.score, null);

  // Case B: Runtime worker error mid-search -> terminates worker and resolves with error
  const crashedPromise = analyzer.evaluateOnce(START_FEN, 10);
  await flushAsync();
  harness.latest().emit('message', { data: 'readyok' });
  const workerBeforeCrash = harness.latest();
  workerBeforeCrash.emit('error', { message: 'WASM OOM' });

  const crashedRes = await crashedPromise;
  assert.equal(crashedRes.status, 'error');
  assert.equal(crashedRes.score, null);
  assert.equal(workerBeforeCrash.terminated, true);
  assert.equal(analyzer.isRunning(), false);

  // Case C: Next job automatically boots a fresh worker cleanly and succeeds
  const recoveredPromise = analyzer.evaluateOnce(START_FEN, 10);
  await flushAsync();
  assert.equal(harness.getBootCount(), 2);
  harness.latest().emit('message', { data: 'readyok' });
  harness.latest().emit('message', {
    data: 'info depth 10 seldepth 11 multipv 1 score cp 42 nodes 500 nps 5000 pv e2e4',
  });
  harness.latest().emit('message', { data: 'bestmove e2e4' });

  const recoveredRes = await recoveredPromise;
  assert.equal(recoveredRes.status, 'completed');
  if (recoveredRes.status === 'completed') {
    assert.deepEqual(recoveredRes.score, { type: 'cp', value: 42 });
  }

  analyzer.terminate();
});

test('StockfishAnalyzer enforces sync, search, and stop timeouts and recovers hung workers safely', async () => {
  const harness = createBootedHarness();
  const analyzer = new StockfishAnalyzer(harness.factory, {
    syncTimeoutMs: 35,
    singleEvalTimeoutMs: 35,
    stopTimeoutMs: 35,
  });

  // 1. Sync timeout (never receives readyok)
  const syncTimedOut = await analyzer.evaluateOnce(START_FEN, 10);
  assert.equal(syncTimedOut.status, 'timeout');
  assert.equal(syncTimedOut.score, null);
  assert.equal(harness.workers[0].terminated, true);

  // 2. Search timeout (receives readyok, never receives bestmove)
  const searchPromise = analyzer.evaluateOnce(START_FEN, 10);
  await flushAsync();
  harness.latest().emit('message', { data: 'readyok' });
  const searchTimedOut = await searchPromise;
  assert.equal(searchTimedOut.status, 'timeout');
  assert.equal(searchTimedOut.score, null);
  assert.equal(harness.workers[1].terminated, true);

  // 3. Stop timeout: worker ignores `stop`, gets terminated & restarted automatically for queued job
  const firstSearch = analyzer.evaluateOnce(START_FEN, 10);
  await flushAsync();
  harness.latest().emit('message', { data: 'readyok' });
  const hungWorker = harness.latest();

  const secondSearch = analyzer.evaluateOnce(AFTER_E4_FEN, 10);
  assert.equal((await firstSearch).status, 'cancelled');

  // Wait for stopTimeoutMs to fire and reboot a fresh worker for secondSearch
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(hungWorker.terminated, true);
  assert.equal(harness.getBootCount(), 4);

  harness.latest().emit('message', { data: 'readyok' });
  harness.latest().emit('message', {
    data: 'info depth 10 seldepth 10 multipv 1 score cp -20 nodes 400 nps 4000 pv e7e5',
  });
  harness.latest().emit('message', { data: 'bestmove e7e5' });

  const secondRes = await secondSearch;
  assert.equal(secondRes.status, 'completed');
  if (secondRes.status === 'completed') {
    assert.deepEqual(secondRes.score, { type: 'cp', value: 20 });
  }

  // 4. Explicit restart() terminates current worker and boots exactly 1 fresh worker
  const prevWorker = harness.latest();
  await analyzer.restart();
  assert.equal(prevWorker.terminated, true);
  assert.equal(harness.getBootCount(), 5);
  assert.equal(analyzer.isRunning(), true);

  analyzer.terminate();
});

// ---------- 4. StockfishOpponent Lifecycle ----------

test('StockfishOpponent handles bot move, timeout, runtime error, cancel, and safe restart', async () => {
  const harness = createBootedHarness();
  const opponent = new StockfishOpponent(harness.factory, {
    moveTimeoutMs: 40,
    stopTimeoutMs: 30,
  });
  const level = STOCKFISH_LEVELS[2];

  // Normal move
  const movePromise = opponent.computeMove(START_FEN, level);
  await flushAsync();
  harness.latest().emit('message', { data: 'bestmove e2e4 ponder e7e5' });
  assert.equal(await movePromise, 'e2e4');

  // Move timeout -> terminates hung worker & rejects cleanly
  const timedOutMove = opponent.computeMove(START_FEN, level);
  await assert.rejects(() => timedOutMove, /timed out/i);
  assert.equal(harness.workers[0].terminated, true);

  // Runtime messageerror -> terminates worker & rejects cleanly
  const errMove = opponent.computeMove(START_FEN, level);
  await flushAsync();
  harness.latest().emit('messageerror', { message: 'corrupted frame' });
  await assert.rejects(() => errMove, /corrupted frame/i);
  assert.equal(harness.workers[1].terminated, true);

  // Explicit restart() boots fresh worker and cancel() resolves null
  await opponent.restart();
  assert.equal(opponent.isRunning(), true);
  const cancelledMove = opponent.computeMove(START_FEN, level);
  await flushAsync();
  opponent.cancel();
  assert.equal(await cancelledMove, null);

  opponent.terminate();
  assert.equal(opponent.isRunning(), false);
});

// ---------- 5. Realtime vs Review Job Queue & Cancellation Invariants ----------

test('StockfishAnalyzer preempts realtime analyzePosition (both during init and searching) for evaluateOnce with zero stale updates or orphaned jobs', async () => {
  // Part A: analyzePosition awaiting delayed init() is superseded by evaluateOnce before init resolves
  let resolveInit!: (worker: MockEventWorker) => void;
  const bootWorker = new MockEventWorker('/mock/delayed-init.js');
  const delayedFactory: StockfishWorkerFactory = async (callbacks) => {
    const w = await new Promise<MockEventWorker>((resolve) => {
      resolveInit = resolve;
    });
    w.addEventListener('message', callbacks.onMessage);
    return {
      worker: w,
      backend: 'wasm',
      disposeListeners: () => w.removeEventListener('message', callbacks.onMessage),
    };
  };

  const analyzerA = new StockfishAnalyzer(delayedFactory);
  const staleUpdatesA: number[] = [];
  const streamPromiseA = analyzerA.analyzePosition(
    START_FEN,
    { depth: 14, multiPv: 2 },
    (snap) => staleUpdatesA.push(snap.depth)
  );
  // Game Review starts before init() resolves (even without explicit stop())
  const reviewEvalPromiseA = analyzerA.evaluateOnce(AFTER_E4_FEN, 10);

  resolveInit(bootWorker);
  await streamPromiseA;
  await flushAsync();

  // Only the review single-eval job should be scheduled; stale stream must never overwrite it
  assert.equal(analyzerA.getQueueState().activeJobMode, 'single');
  assert.equal(analyzerA.getQueueState().queuedJobMode, null);

  bootWorker.emit('message', { data: 'readyok' });
  bootWorker.emit('message', {
    data: 'info depth 10 seldepth 12 multipv 1 score cp -28 nodes 800 nps 8000 pv c7c5',
  });
  bootWorker.emit('message', { data: 'bestmove c7c5' });

  const reviewResA = await reviewEvalPromiseA;
  assert.equal(reviewResA.status, 'completed');
  if (reviewResA.status === 'completed') {
    assert.deepEqual(reviewResA.score, { type: 'cp', value: 28 });
  }
  assert.equal(staleUpdatesA.length, 0);
  assert.deepEqual(analyzerA.getQueueState(), {
    phase: 'idle',
    isRunning: true,
    backend: 'wasm',
    activeJobMode: null,
    queuedJobMode: null,
    pendingSyncCount: 0,
  });
  analyzerA.terminate();

  // Part B: active searching realtime stream preempted cleanly by stop() + evaluateOnce
  const harness = createBootedHarness();
  const analyzerB = new StockfishAnalyzer(harness.factory);
  const streamSnapshots: string[] = [];

  await analyzerB.analyzePosition(START_FEN, { depth: 16, multiPv: 2 }, (snap) => {
    streamSnapshots.push(`${snap.fen}@${snap.depth}`);
  });
  harness.latest().emit('message', { data: 'readyok' });
  harness.latest().emit('message', {
    data: 'info depth 10 seldepth 11 multipv 1 score cp 24 nodes 600 nps 6000 pv e2e4',
  });
  assert.equal(streamSnapshots.length, 1);
  assert.equal(analyzerB.getQueueState().activeJobMode, 'stream');
  assert.equal(analyzerB.getQueueState().phase, 'searching');

  // Review starts while realtime search is actively searching
  analyzerB.stop();
  const singlePromise = analyzerB.evaluateOnce(AFTER_E4_FEN, 10);
  await flushAsync();

  assert.equal(analyzerB.getQueueState().phase, 'stopping');
  assert.equal(analyzerB.getQueueState().queuedJobMode, 'single');

  // Stale info line arriving before bestmove must NOT fire stream callback
  harness.latest().emit('message', {
    data: 'info depth 12 seldepth 14 multipv 1 score cp 99 nodes 900 nps 9000 pv d2d4',
  });
  assert.equal(streamSnapshots.length, 1);

  // Stop completes -> single eval runs and finishes
  harness.latest().emit('message', { data: 'bestmove e2e4' });
  harness.latest().emit('message', { data: 'readyok' });
  harness.latest().emit('message', {
    data: 'info depth 10 seldepth 11 multipv 1 score cp -15 nodes 700 nps 7000 pv e7e5',
  });
  harness.latest().emit('message', { data: 'bestmove e7e5' });

  const singleRes = await singlePromise;
  assert.equal(singleRes.status, 'completed');
  if (singleRes.status === 'completed') {
    assert.deepEqual(singleRes.score, { type: 'cp', value: 15 });
  }
  assert.equal(streamSnapshots.length, 1);
  assert.deepEqual(analyzerB.getQueueState(), {
    phase: 'idle',
    isRunning: true,
    backend: 'wasm',
    activeJobMode: null,
    queuedJobMode: null,
    pendingSyncCount: 0,
  });

  analyzerB.terminate();
});

test('StockfishAnalyzer.stop() during handleStopTimeout reboot cancels queued job cleanly without scheduling it onto restarted worker', async () => {
  let bootIndex = 0;
  let resolveSecondBoot!: (w: MockEventWorker) => void;
  const workers: MockEventWorker[] = [];

  const factory: StockfishWorkerFactory = async (callbacks) => {
    bootIndex += 1;
    if (bootIndex === 1) {
      const w = new MockEventWorker('/mock/hung-1.js');
      workers.push(w);
      w.addEventListener('message', callbacks.onMessage);
      return {
        worker: w,
        backend: 'wasm',
        disposeListeners: () => w.removeEventListener('message', callbacks.onMessage),
      };
    }
    const w = await new Promise<MockEventWorker>((resolve) => {
      resolveSecondBoot = resolve;
    });
    workers.push(w);
    w.addEventListener('message', callbacks.onMessage);
    return {
      worker: w,
      backend: 'wasm',
      disposeListeners: () => w.removeEventListener('message', callbacks.onMessage),
    };
  };

  const analyzer = new StockfishAnalyzer(factory, { stopTimeoutMs: 30 });

  // Start job 1 -> searching
  const job1 = analyzer.evaluateOnce(START_FEN, 10);
  await flushAsync();
  workers[0].emit('message', { data: 'readyok' });

  // Supersede with job 2 -> enters stopping phase; worker ignores stop -> triggers handleStopTimeout reboot
  const job2 = analyzer.evaluateOnce(AFTER_E4_FEN, 10);
  assert.equal((await job1).status, 'cancelled');

  await new Promise((r) => setTimeout(r, 50));
  assert.equal(workers[0].terminated, true);

  // User exits review / calls stop() while reboot init() is still pending
  analyzer.stop();
  const rebootedWorker = new MockEventWorker('/mock/rebooted-2.js');
  resolveSecondBoot(rebootedWorker);
  await flushAsync();

  const job2Res = await job2;
  assert.equal(job2Res.status, 'cancelled');
  assert.equal(job2Res.score, null);
  assert.equal(rebootedWorker.sent.length, 0);
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

test('StockfishAnalyzer job queue handles rapid multi-burst preemption across syncing/searching without leaking stale callbacks', async () => {
  const harness = createBootedHarness();
  const analyzer = new StockfishAnalyzer(harness.factory);
  const fen3 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2';
  const fen4 = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';

  const staleStreamSnapshots: string[] = [];
  // Burst 1: realtime analysis starts syncing
  void analyzer.analyzePosition(
    START_FEN,
    { depth: 12, multiPv: 1 },
    (snap) => staleStreamSnapshots.push(snap.fen)
  );
  await flushAsync();
  const worker = harness.latest();
  assert.equal(analyzer.getQueueState().phase, 'syncing');

  // Burst 2 & 3: two evaluateOnce jobs arrive while still syncing -> job A supersedes stream, job B supersedes job A
  const jobA = analyzer.evaluateOnce(AFTER_E4_FEN, 10);
  const jobB = analyzer.evaluateOnce(fen3, 10);
  // Burst 4: final evaluateOnce arrives -> supersedes job B
  const jobC = analyzer.evaluateOnce(fen4, 10);

  const [resA, resB] = await Promise.all([jobA, jobB]);
  assert.equal(resA.status, 'cancelled');
  assert.equal(resB.status, 'cancelled');
  assert.equal(staleStreamSnapshots.length, 0);

  // Flush the queued isready/readyok handshakes; only fen4 should ever be searched
  worker.emit('message', { data: 'readyok' });
  await flushAsync();
  if (analyzer.getQueueState().phase === 'syncing') {
    worker.emit('message', { data: 'readyok' });
  }
  assert.equal(analyzer.getQueueState().phase, 'searching');
  assert.ok(worker.sent.includes(`position fen ${fen4}`));
  assert.ok(!worker.sent.includes(`position fen ${AFTER_E4_FEN}`));
  assert.ok(!worker.sent.includes(`position fen ${fen3}`));

  worker.emit('message', {
    data: 'info depth 10 seldepth 12 multipv 1 score cp 41 nodes 500 nps 5000 pv f1b5',
  });
  worker.emit('message', { data: 'bestmove f1b5' });

  const resC = await jobC;
  assert.equal(resC.status, 'completed');
  if (resC.status === 'completed') {
    assert.deepEqual(resC.score, { type: 'cp', value: 41 });
    assert.equal(resC.bestMove, 'f1b5');
  }
  assert.equal(staleStreamSnapshots.length, 0);
  assert.equal(analyzer.getQueueState().pendingSyncCount, 0);
  assert.equal(analyzer.getQueueState().phase, 'idle');

  analyzer.terminate();
});

test('Worker startup timeout after uciok (missing readyok) and synchronous Worker constructor failure both fall back to asm.js', async () => {
  // Case A: WASM sends uciok but hangs before readyok -> handshake timer expires -> falls back to asm.js
  const workersA: MockEventWorker[] = [];
  const resA = await bootStockfishWorker(
    { onMessage: () => {}, onError: () => {} },
    {
      handshakeTimeoutMs: 35,
      detectWasm: () => true,
      createWorker: (url) => {
        const w = new MockEventWorker(url);
        workersA.push(w);
        if (url.endsWith('stockfish.wasm.js')) {
          setTimeout(() => w.emit('message', { data: 'uciok' }), 5);
          // Never emits readyok -> stage-2 handshake timeout
        } else {
          setTimeout(() => {
            w.emit('message', { data: 'uciok' });
            w.emit('message', { data: 'readyok' });
          }, 5);
        }
        return w;
      },
    }
  );
  assert.equal(resA.backend, 'asmjs');
  assert.equal(workersA.length, 2);
  assert.equal(workersA[0].terminated, true);
  assert.ok(workersA[0].sent.includes('isready'));
  resA.disposeListeners();
  resA.worker.terminate();

  // Case B: WASM constructor throws synchronously -> falls back to asm.js immediately
  let attempts = 0;
  const resB = await bootStockfishWorker(
    { onMessage: () => {}, onError: () => {} },
    {
      handshakeTimeoutMs: 50,
      detectWasm: () => true,
      createWorker: (url) => {
        attempts += 1;
        if (url.endsWith('stockfish.wasm.js')) {
          throw new Error('CSP blocked wasm worker');
        }
        const w = new MockEventWorker(url);
        setTimeout(() => {
          w.emit('message', { data: 'uciok' });
          w.emit('message', { data: 'readyok' });
        }, 5);
        return w;
      },
    }
  );
  assert.equal(attempts, 2);
  assert.equal(resB.backend, 'asmjs');
  resB.disposeListeners();
  resB.worker.terminate();

  // Case C: StockfishOpponent startup timeout rejects cleanly and recovers on subsequent call
  let oppBootAttempt = 0;
  const opponent = new StockfishOpponent(
    (callbacks) => {
      oppBootAttempt += 1;
      if (oppBootAttempt === 1) {
        return bootStockfishWorker(callbacks, {
          handshakeTimeoutMs: 25,
          detectWasm: () => false,
          createWorker: (url) => new MockEventWorker(url), // never responds
        });
      }
      return bootStockfishWorker(callbacks, {
        handshakeTimeoutMs: 100,
        detectWasm: () => false,
        createWorker: (url) => {
          const w = new MockEventWorker(url);
          setTimeout(() => {
            w.emit('message', { data: 'uciok' });
            w.emit('message', { data: 'readyok' });
          }, 5);
          const origPost = w.postMessage.bind(w);
          w.postMessage = (cmd: string) => {
            origPost(cmd);
            if (cmd.startsWith('go ')) {
              setTimeout(() => w.emit('message', { data: 'bestmove e7e5' }), 5);
            }
          };
          return w;
        },
      });
    },
    { handshakeTimeoutMs: 25 }
  );

  await assert.rejects(
    () => opponent.computeMove(AFTER_E4_FEN, STOCKFISH_LEVELS[2]),
    /timed out/i
  );
  assert.equal(opponent.isRunning(), false);

  const recoveredMove = await opponent.computeMove(AFTER_E4_FEN, STOCKFISH_LEVELS[2]);
  assert.equal(recoveredMove, 'e7e5');
  assert.equal(opponent.isRunning(), true);
  opponent.terminate();
});

test('Worker runtime failure via synchronous postMessage throw fails active job without fake eval and auto-reboots cleanly', async () => {
  let bootIndex = 0;
  const createdWorkers: MockEventWorker[] = [];

  const factory: StockfishWorkerFactory = async (callbacks) => {
    bootIndex += 1;
    const worker = new MockEventWorker(`/mock/post-fail-${bootIndex}.js`);
    createdWorkers.push(worker);
    if (bootIndex === 1) {
      const origPost = worker.postMessage.bind(worker);
      worker.postMessage = (cmd: string) => {
        origPost(cmd);
        if (cmd.startsWith('go ')) {
          throw new Error('DataCloneError: worker port detached');
        }
      };
    }
    worker.addEventListener('message', callbacks.onMessage);
    return {
      worker,
      backend: 'wasm',
      disposeListeners: () => worker.removeEventListener('message', callbacks.onMessage),
    };
  };

  // 1) StockfishAnalyzer recovers cleanly after postMessage throws during search
  const analyzer = new StockfishAnalyzer(factory);
  const failedEvalPromise = analyzer.evaluateOnce(START_FEN, 10);
  await flushAsync();
  createdWorkers[0].emit('message', { data: 'readyok' });

  const failedRes = await failedEvalPromise;
  assert.equal(failedRes.status, 'error');
  assert.equal(failedRes.score, null);
  assert.equal(createdWorkers[0].terminated, true);
  assert.equal(analyzer.isRunning(), false);

  // Next request automatically boots worker #2 and returns a real score
  const recoveredPromise = analyzer.evaluateOnce(AFTER_E4_FEN, 10);
  await flushAsync();
  createdWorkers[1].emit('message', { data: 'readyok' });
  createdWorkers[1].emit('message', {
    data: 'info depth 10 seldepth 11 multipv 1 score cp 28 nodes 400 nps 4000 pv e7e5',
  });
  createdWorkers[1].emit('message', { data: 'bestmove e7e5' });

  const recoveredRes = await recoveredPromise;
  assert.equal(recoveredRes.status, 'completed');
  if (recoveredRes.status === 'completed') {
    assert.deepEqual(recoveredRes.score, { type: 'cp', value: -28 });
  }
  analyzer.terminate();

  // 2) StockfishAnalyzer.analyzePosition notifies onError on runtime fault and recovers on next call
  const streamErrors: string[] = [];
  const streamSnapshots: number[] = [];
  const streamHarness = createBootedHarness();
  const streamAnalyzer = new StockfishAnalyzer(streamHarness.factory);

  await streamAnalyzer.analyzePosition(
    START_FEN,
    { depth: 12, multiPv: 1 },
    (snap) => streamSnapshots.push(snap.depth),
    (err) => streamErrors.push(err.message)
  );
  const w1 = streamHarness.latest();
  w1.emit('message', { data: 'readyok' });
  w1.emit('error', { message: 'Out of WebAssembly memory' });

  assert.equal(streamErrors.length, 1);
  assert.match(streamErrors[0], /Out of WebAssembly memory/);
  assert.equal(w1.terminated, true);
  assert.equal(streamAnalyzer.isRunning(), false);

  // Next analyzePosition auto-reboots cleanly and delivers live snapshots
  await streamAnalyzer.analyzePosition(
    AFTER_E4_FEN,
    { depth: 12, multiPv: 1 },
    (snap) => streamSnapshots.push(snap.depth),
    (err) => streamErrors.push(err.message)
  );
  const w2 = streamHarness.latest();
  assert.notEqual(w2, w1);
  w2.emit('message', { data: 'readyok' });
  w2.emit('message', {
    data: 'info depth 12 seldepth 14 multipv 1 score cp 15 nodes 900 nps 9000 pv e7e5',
  });
  w2.emit('message', { data: 'bestmove e7e5' });
  assert.ok(streamSnapshots.includes(12));
  streamAnalyzer.terminate();
});

test('StockfishAnalyzer computes pvSan lazily on throttled stream emits with identical SAN accuracy', async () => {
  const harness = createBootedHarness();
  const analyzer = new StockfishAnalyzer(harness.factory);
  const snapshots: Array<{ depth: number; pvSan: string[] }> = [];

  await analyzer.analyzePosition(
    START_FEN,
    { depth: 12, multiPv: 1 },
    (snap) => {
      snapshots.push({ depth: snap.depth, pvSan: snap.lines[0]?.pvSan ?? [] });
    }
  );
  const w = harness.latest();
  w.emit('message', { data: 'readyok' });

  // Emit several rapid info lines inside the throttle window; only the emitted snapshot needs SAN conversion
  w.emit('message', {
    data: 'info depth 8 seldepth 10 multipv 1 score cp 20 nodes 200 nps 4000 pv e2e4 e7e5 g1f3',
  });
  w.emit('message', {
    data: 'info depth 10 seldepth 12 multipv 1 score cp 25 nodes 400 nps 6000 pv e2e4 e7e5 g1f3 b8c6',
  });
  w.emit('message', {
    data: 'info depth 12 seldepth 15 multipv 1 score cp 30 nodes 800 nps 8000 pv d2d4 d7d5 c2c4',
  });
  w.emit('message', { data: 'bestmove d2d4' });

  const finalSnap = snapshots[snapshots.length - 1];
  assert.ok(finalSnap);
  assert.equal(finalSnap.depth, 12);
  assert.deepEqual(finalSnap.pvSan, ['d4', 'd5', 'c4']);

  analyzer.terminate();
});




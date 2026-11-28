import type { Color } from 'chess.js';
import type { EngineAnalysis, EngineLine, EvalScore, StockfishLevel } from '../types/chess';
import { uciLineToSan } from '../game/chessLogic';
import { uciLineToSan960, type Chess960CastlingRights } from '../game/chess960';
import { resolvePublicAssetUrl } from '../utils/assetUrl';
import { parseBestMoveLine, parseUciInfoLine } from './uciParser';

export type StockfishBackend = 'wasm' | 'asmjs';

export interface BootableWorkerEventMap {
  message: MessageEvent;
  error: ErrorEvent;
  messageerror: MessageEvent;
}

export type BootableWorkerEventType = keyof BootableWorkerEventMap;

export interface BootableWorkerLike {
  postMessage(message: string): void;
  terminate(): void;
  addEventListener<K extends BootableWorkerEventType>(
    type: K,
    listener: (event: BootableWorkerEventMap[K]) => void
  ): void;
  removeEventListener<K extends BootableWorkerEventType>(
    type: K,
    listener: (event: BootableWorkerEventMap[K]) => void
  ): void;
}

export interface StockfishBootCallbacks {
  onMessage: (event: MessageEvent) => void;
  onError: (error: Error) => void;
}

export interface StockfishBootOptions {
  handshakeTimeoutMs?: number;
  wasmUrl?: string;
  asmJsUrl?: string;
  detectWasm?: () => boolean;
  createWorker?: (url: string) => BootableWorkerLike;
}

export interface StockfishBootResult {
  worker: BootableWorkerLike;
  backend: StockfishBackend;
  disposeListeners: () => void;
}

export type StockfishWorkerFactory = (
  callbacks: StockfishBootCallbacks
) => Promise<StockfishBootResult>;

export type EvaluateOnceResult =
  | {
      status: 'completed';
      score: EvalScore;
      bestMove: string | null;
    }
  | {
      status: 'cancelled';
      score: null;
      bestMove: null;
      reason: string;
    }
  | {
      status: 'timeout' | 'error';
      score: null;
      bestMove: null;
      error: string;
    };

export interface StockfishAnalyzerTimeouts {
  handshakeTimeoutMs?: number;
  syncTimeoutMs?: number;
  stopTimeoutMs?: number;
  singleEvalTimeoutMs?: number;
  streamSearchTimeoutMs?: number;
}

export interface StockfishOpponentTimeouts {
  handshakeTimeoutMs?: number;
  stopTimeoutMs?: number;
  moveTimeoutMs?: number;
}

export interface AnalyzerQueueState {
  phase: 'idle' | 'stopping' | 'syncing' | 'searching';
  isRunning: boolean;
  backend: StockfishBackend | null;
  activeJobMode: 'stream' | 'single' | null;
  queuedJobMode: 'stream' | 'single' | null;
  pendingSyncCount: number;
}

const DEFAULT_WASM_URL = '/stockfish/stockfish.wasm.js';
const DEFAULT_ASMJS_URL = '/stockfish/stockfish.js';

const DEFAULT_HANDSHAKE_TIMEOUT_MS = 10_000;
const DEFAULT_SYNC_TIMEOUT_MS = 5_000;
const DEFAULT_STOP_TIMEOUT_MS = 3_000;
const DEFAULT_SINGLE_EVAL_TIMEOUT_MS = 15_000;
const DEFAULT_STREAM_SEARCH_TIMEOUT_MS = 30_000;

export function detectWasmSupport(): boolean {
  try {
    if (typeof WebAssembly === 'object' && typeof WebAssembly.validate === 'function') {
      return WebAssembly.validate(Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00));
    }
  } catch {
    // Fall back to asm.js
  }
  return false;
}

function getTurnFromFen(fen: string): Color {
  const parts = fen.split(' ');
  return parts[1] === 'b' ? 'b' : 'w';
}

function toError(err: unknown, fallbackMessage: string): Error {
  if (err instanceof Error) return err;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const msg = String((err as { message?: unknown }).message ?? '').trim();
    if (msg) return new Error(msg);
  }
  if (typeof err === 'string' && err.trim()) return new Error(err);
  return new Error(fallbackMessage);
}

/**
 * Boots a Stockfish Web Worker (WASM with automatic asm.js fallback), runs the full UCI handshake
 * (`uci` -> `uciok` -> `isready` -> `readyok`) under an explicit timeout, and attaches steady-state
 * `message`, `error`, and `messageerror` listeners with deterministic cleanup.
 */
export function bootStockfishWorker(
  callbacks: StockfishBootCallbacks,
  options: StockfishBootOptions = {}
): Promise<StockfishBootResult> {
  const handshakeTimeoutMs = options.handshakeTimeoutMs ?? DEFAULT_HANDSHAKE_TIMEOUT_MS;
  const wasmUrl = options.wasmUrl ?? resolvePublicAssetUrl(DEFAULT_WASM_URL);
  const asmJsUrl = options.asmJsUrl ?? resolvePublicAssetUrl(DEFAULT_ASMJS_URL);
  const detectWasm = options.detectWasm ?? detectWasmSupport;
  const createWorker = options.createWorker ?? ((url: string) => new Worker(url));

  return new Promise<StockfishBootResult>((resolve, reject) => {
    let settled = false;
    let activeWorker: BootableWorkerLike | null = null;
    let handshakeTimer: ReturnType<typeof setTimeout> | null = null;

    const clearHandshakeTimer = () => {
      if (handshakeTimer !== null) {
        globalThis.clearTimeout(handshakeTimer);
        handshakeTimer = null;
      }
    };

    const fail = (err: unknown, fallbackMessage: string) => {
      if (settled) return;
      settled = true;
      clearHandshakeTimer();
      try {
        activeWorker?.terminate();
      } catch {
        // Ignore terminate errors on dead worker
      }
      activeWorker = null;
      reject(toError(err, fallbackMessage));
    };

    const launch = (url: string, backend: StockfishBackend, allowFallback: boolean) => {
      clearHandshakeTimer();

      let worker: BootableWorkerLike;
      try {
        worker = createWorker(url);
      } catch (err) {
        if (allowFallback && backend === 'wasm') {
          launch(asmJsUrl, 'asmjs', false);
          return;
        }
        fail(err, `Failed to instantiate Stockfish ${backend} worker`);
        return;
      }

      activeWorker = worker;
      let handshakeStage: 'uci' | 'ready' = 'uci';
      let attemptFinished = false;

      const detachInitListeners = () => {
        worker.removeEventListener('message', onInitMessage);
        worker.removeEventListener('error', onInitError);
        worker.removeEventListener('messageerror', onInitMessageError);
      };

      const handleAttemptFailure = (err: unknown, reason: string) => {
        if (settled || attemptFinished || activeWorker !== worker) return;
        attemptFinished = true;
        clearHandshakeTimer();
        detachInitListeners();
        try {
          worker.terminate();
        } catch {
          // Ignore terminate errors
        }
        if (activeWorker === worker) {
          activeWorker = null;
        }
        if (allowFallback && backend === 'wasm') {
          launch(asmJsUrl, 'asmjs', false);
          return;
        }
        fail(err, reason);
      };

      const onInitMessage = (event: MessageEvent) => {
        if (settled || attemptFinished || activeWorker !== worker) return;
        const raw = typeof event.data === 'string' ? event.data : String(event.data ?? '');
        for (const line of raw.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (handshakeStage === 'uci' && trimmed === 'uciok') {
            handshakeStage = 'ready';
            try {
              worker.postMessage('isready');
            } catch (err) {
              handleAttemptFailure(err, `Failed to send isready to Stockfish ${backend} worker`);
              return;
            }
          } else if (handshakeStage === 'ready' && trimmed === 'readyok') {
            attemptFinished = true;
            settled = true;
            clearHandshakeTimer();
            detachInitListeners();

            const onRuntimeError = (errEvent: ErrorEvent) => {
              callbacks.onError(toError(errEvent, `Stockfish ${backend} worker runtime error`));
            };
            const onRuntimeMessageError = (errEvent: MessageEvent) => {
              callbacks.onError(
                toError(errEvent, `Stockfish ${backend} worker message deserialization error`)
              );
            };

            worker.addEventListener('message', callbacks.onMessage);
            worker.addEventListener('error', onRuntimeError);
            worker.addEventListener('messageerror', onRuntimeMessageError);

            const disposeListeners = () => {
              worker.removeEventListener('message', callbacks.onMessage);
              worker.removeEventListener('error', onRuntimeError);
              worker.removeEventListener('messageerror', onRuntimeMessageError);
            };

            resolve({ worker, backend, disposeListeners });
            return;
          }
        }
      };

      const onInitError = (errEvent: ErrorEvent) => {
        handleAttemptFailure(errEvent, `Stockfish ${backend} worker error during handshake`);
      };

      const onInitMessageError = (errEvent: MessageEvent) => {
        handleAttemptFailure(errEvent, `Stockfish ${backend} worker messageerror during handshake`);
      };

      worker.addEventListener('message', onInitMessage);
      worker.addEventListener('error', onInitError);
      worker.addEventListener('messageerror', onInitMessageError);

      handshakeTimer = globalThis.setTimeout(() => {
        handleAttemptFailure(
          new Error(`Stockfish ${backend} handshake timed out after ${handshakeTimeoutMs}ms`),
          `Stockfish ${backend} handshake timed out`
        );
      }, handshakeTimeoutMs);

      try {
        worker.postMessage('uci');
      } catch (err) {
        handleAttemptFailure(err, `Failed to send uci to Stockfish ${backend} worker`);
      }
    };

    const useWasm = detectWasm();
    if (useWasm) {
      launch(wasmUrl, 'wasm', true);
    } else {
      launch(asmJsUrl, 'asmjs', false);
    }
  });
}

interface PendingJob {
  fen: string;
  /** Shredder-FEN sent to Stockfish when chess960 is true */
  engineFen: string;
  chess960: boolean;
  chess960Rights?: Chess960CastlingRights;
  depth: number;
  multiPv: number;
  mode: 'stream' | 'single';
  onUpdate?: (analysis: EngineAnalysis) => void;
  onError?: (error: Error) => void;
  resolveSingle?: (result: EvaluateOnceResult) => void;
}

/**
 * Dedicated Stockfish Web Worker controller for real-time MultiPV position analysis
 * and on-demand full game review.
 *
 * Strictly serializes stop -> bestmove -> setoption -> isready -> readyok -> go,
 * enforces timeouts on handshake/sync/stop/search, handles runtime error/messageerror,
 * supports safe terminate/restart without duplicate workers, and never fabricates fake evaluations.
 */
export class StockfishAnalyzer {
  private readonly workerFactory: StockfishWorkerFactory;
  private readonly timeouts: Required<StockfishAnalyzerTimeouts>;

  private worker: BootableWorkerLike | null = null;
  private disposeWorkerListeners: (() => void) | null = null;
  private backend: StockfishBackend | null = null;
  private isReady = false;
  private initPromise: Promise<void> | null = null;

  private phase: 'idle' | 'stopping' | 'syncing' | 'searching' = 'idle';
  private pendingSyncCount = 0;
  private stopGeneration = 0;
  private requestGeneration = 0;
  private lifecycleGeneration = 0;
  private activeJob: PendingJob | null = null;
  private queuedJob: PendingJob | null = null;
  private currentMultiPv = 1;
  private currentChess960 = false;

  private linesMap = new Map<number, EngineLine>();
  private pvSanCache = new Map<number, { pvKey: string; pvSan: string[] }>();
  private latestDepth = 0;
  private latestNodes = 0;
  private latestNps = 0;
  private bestMoveUci: string | null = null;
  private ponderUci: string | null = null;
  private lastEmitAt = 0;
  private emitTimer: ReturnType<typeof setTimeout> | null = null;
  private phaseTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    workerFactory?: StockfishWorkerFactory,
    timeouts: StockfishAnalyzerTimeouts = {}
  ) {
    this.timeouts = {
      handshakeTimeoutMs: timeouts.handshakeTimeoutMs ?? DEFAULT_HANDSHAKE_TIMEOUT_MS,
      syncTimeoutMs: timeouts.syncTimeoutMs ?? DEFAULT_SYNC_TIMEOUT_MS,
      stopTimeoutMs: timeouts.stopTimeoutMs ?? DEFAULT_STOP_TIMEOUT_MS,
      singleEvalTimeoutMs: timeouts.singleEvalTimeoutMs ?? DEFAULT_SINGLE_EVAL_TIMEOUT_MS,
      streamSearchTimeoutMs: timeouts.streamSearchTimeoutMs ?? DEFAULT_STREAM_SEARCH_TIMEOUT_MS,
    };
    this.workerFactory =
      workerFactory ??
      ((callbacks) =>
        bootStockfishWorker(callbacks, {
          handshakeTimeoutMs: this.timeouts.handshakeTimeoutMs,
        }));
  }

  getBackend(): StockfishBackend | null {
    return this.backend;
  }

  isRunning(): boolean {
    return this.isReady && this.worker !== null;
  }

  getQueueState(): AnalyzerQueueState {
    return {
      phase: this.phase,
      isRunning: this.isRunning(),
      backend: this.backend,
      activeJobMode: this.activeJob?.mode ?? null,
      queuedJobMode: this.queuedJob?.mode ?? null,
      pendingSyncCount: this.pendingSyncCount,
    };
  }

  async init(): Promise<void> {
    if (this.isReady && this.worker) return;
    if (this.initPromise) return this.initPromise;

    const bootGen = this.lifecycleGeneration;

    const promise = this.workerFactory({
      onMessage: (event) => {
        if (this.lifecycleGeneration !== bootGen) return;
        this.handleMessage(event);
      },
      onError: (err) => {
        if (this.lifecycleGeneration !== bootGen) return;
        this.handleRuntimeFault(err, 'error');
      },
    })
      .then((booted) => {
        // If terminate() or restart() ran while booting, immediately destroy this stale worker
        if (this.lifecycleGeneration !== bootGen) {
          booted.disposeListeners();
          try {
            booted.worker.terminate();
          } catch {
            // Ignore terminate errors
          }
          throw new Error('Stockfish worker initialization aborted');
        }
        this.worker = booted.worker;
        this.disposeWorkerListeners = booted.disposeListeners;
        this.backend = booted.backend;
        this.isReady = true;
        this.phase = 'idle';
        this.pendingSyncCount = 0;
        this.currentMultiPv = 1;
        this.currentChess960 = false;
      })
      .catch((err) => {
        if (this.lifecycleGeneration === bootGen) {
          this.worker = null;
          this.disposeWorkerListeners = null;
          this.backend = null;
          this.isReady = false;
          this.initPromise = null;
          this.phase = 'idle';
          this.pendingSyncCount = 0;
        }
        throw toError(err, 'Stockfish worker initialization failed');
      });

    this.initPromise = promise;
    return promise;
  }

  private clearEmitTimer() {
    if (this.emitTimer !== null) {
      globalThis.clearTimeout(this.emitTimer);
      this.emitTimer = null;
    }
  }

  private clearPhaseTimer() {
    if (this.phaseTimer !== null) {
      globalThis.clearTimeout(this.phaseTimer);
      this.phaseTimer = null;
    }
  }

  private armPhaseTimer(ms: number, onTimeout: () => void) {
    this.clearPhaseTimer();
    this.phaseTimer = globalThis.setTimeout(() => {
      this.phaseTimer = null;
      onTimeout();
    }, ms);
  }

  private destroyWorkerOnly() {
    this.clearEmitTimer();
    this.clearPhaseTimer();
    this.lifecycleGeneration += 1;
    const dispose = this.disposeWorkerListeners;
    this.disposeWorkerListeners = null;
    const worker = this.worker;
    this.worker = null;
    this.backend = null;
    this.isReady = false;
    this.initPromise = null;
    this.phase = 'idle';
    this.pendingSyncCount = 0;
    this.currentMultiPv = 1;
    this.currentChess960 = false;
    this.linesMap.clear();
    this.pvSanCache.clear();

    try {
      dispose?.();
    } catch {
      // Ignore listener detach errors
    }
    try {
      worker?.terminate();
    } catch {
      // Ignore terminate errors
    }
  }

  private postToWorker(command: string): boolean {
    if (!this.worker) return false;
    try {
      this.worker.postMessage(command);
      return true;
    } catch (err) {
      this.handleRuntimeFault(toError(err, `Failed to send UCI command: ${command}`), 'error');
      return false;
    }
  }

  private settleSingleJob(job: PendingJob | null, result: EvaluateOnceResult) {
    if (job?.mode === 'single' && job.resolveSingle) {
      const resolve = job.resolveSingle;
      job.resolveSingle = undefined;
      resolve(result);
    }
  }

  private settleJobCancelled(job: PendingJob | null, reason = 'cancelled') {
    this.settleSingleJob(job, {
      status: 'cancelled',
      score: null,
      bestMove: null,
      reason,
    });
  }

  private failJob(job: PendingJob | null, kind: 'error' | 'timeout', message: string) {
    if (!job) return;
    if (job.mode === 'single') {
      this.settleSingleJob(job, {
        status: kind,
        score: null,
        bestMove: null,
        error: message,
      });
    } else if (job.onError) {
      job.onError(new Error(message));
    }
  }

  private handleRuntimeFault(err: Error, kind: 'error' | 'timeout') {
    const active = this.activeJob;
    const queued = this.queuedJob;
    this.activeJob = null;
    this.queuedJob = null;
    this.destroyWorkerOnly();

    this.failJob(active, kind, err.message);
    this.failJob(queued, kind, err.message);
  }

  private handleStopTimeout() {
    if (this.phase !== 'stopping') return;
    const pendingQueued = this.queuedJob;
    this.queuedJob = null;
    const lingeringActive = this.activeJob;
    this.activeJob = null;

    // Worker froze while acknowledging `stop` -> terminate hung worker cleanly
    this.destroyWorkerOnly();
    this.settleJobCancelled(lingeringActive, 'stop-timeout');

    // If a newer job was waiting to start after stop, reboot cleanly and run it unless cancelled/superseded meanwhile
    if (pendingQueued) {
      const stopGen = this.stopGeneration;
      const reqGen = this.requestGeneration;
      this.init()
        .then(() => {
          if (this.stopGeneration !== stopGen || this.requestGeneration !== reqGen) {
            this.settleJobCancelled(
              pendingQueued,
              this.stopGeneration !== stopGen ? 'stopped' : 'superseded'
            );
            return;
          }
          if (this.worker) {
            this.scheduleJob(pendingQueued);
          } else {
            this.failJob(pendingQueued, 'error', 'Stockfish worker unavailable after restart');
          }
        })
        .catch((err) => {
          if (this.stopGeneration !== stopGen || this.requestGeneration !== reqGen) {
            this.settleJobCancelled(
              pendingQueued,
              this.stopGeneration !== stopGen ? 'stopped' : 'superseded'
            );
            return;
          }
          this.failJob(
            pendingQueued,
            'error',
            toError(err, 'Stockfish restart failed after stop timeout').message
          );
        });
    }
  }

  private scheduleJob(job: PendingJob) {
    if (!this.worker) {
      this.failJob(job, 'error', 'Stockfish worker is not initialized');
      return;
    }

    // Resolve any superseded queued single-eval job cleanly as cancelled
    this.settleJobCancelled(this.queuedJob, 'superseded');
    this.queuedJob = job;

    if (this.phase === 'idle') {
      this.startQueuedJob();
    } else if (this.phase === 'searching') {
      this.clearEmitTimer();
      // Resolve superseded active single-eval job immediately so callers never hang
      this.settleJobCancelled(this.activeJob, 'superseded');
      this.activeJob = null;
      this.phase = 'stopping';
      this.armPhaseTimer(this.timeouts.stopTimeoutMs, () => this.handleStopTimeout());
      this.postToWorker('stop');
    } else if (this.phase === 'syncing') {
      // Active job was still waiting for readyok and is now superseded by queuedJob
      this.settleJobCancelled(this.activeJob, 'superseded');
      this.activeJob = null;
    }
    // If phase is already 'stopping' or 'syncing', startQueuedJob() will pick up queuedJob automatically.
  }

  private startQueuedJob() {
    this.clearEmitTimer();
    this.clearPhaseTimer();
    if (!this.worker || !this.queuedJob) {
      this.phase = 'idle';
      return;
    }

    // Defensively settle any lingering active single-eval job before replacing it
    this.settleJobCancelled(this.activeJob, 'superseded');

    const job = this.queuedJob;
    this.queuedJob = null;
    this.activeJob = job;
    this.linesMap.clear();
    this.pvSanCache.clear();
    this.latestDepth = 0;
    this.latestNodes = 0;
    this.latestNps = 0;
    this.bestMoveUci = null;
    this.ponderUci = null;
    this.lastEmitAt = 0;

    if (job.multiPv !== this.currentMultiPv) {
      this.currentMultiPv = job.multiPv;
      if (!this.postToWorker(`setoption name MultiPV value ${job.multiPv}`)) return;
    }
    if (job.chess960 !== this.currentChess960) {
      this.currentChess960 = job.chess960;
      if (!this.postToWorker(`setoption name UCI_Chess960 value ${job.chess960 ? 'true' : 'false'}`)) {
        return;
      }
    }

    this.phase = 'syncing';
    this.pendingSyncCount += 1;
    this.armPhaseTimer(this.timeouts.syncTimeoutMs, () => {
      if (this.phase !== 'syncing') return;
      this.handleRuntimeFault(
        new Error(`Stockfish sync timed out waiting for readyok (${this.timeouts.syncTimeoutMs}ms)`),
        'timeout'
      );
    });
    this.postToWorker('isready');
  }

  private armSearchTimeout(job: PendingJob) {
    const timeoutMs =
      job.mode === 'single'
        ? this.timeouts.singleEvalTimeoutMs
        : this.timeouts.streamSearchTimeoutMs;
    this.armPhaseTimer(timeoutMs, () => {
      if (this.phase !== 'searching' || this.activeJob !== job) return;
      this.handleRuntimeFault(
        new Error(`Stockfish search timed out after ${timeoutMs}ms`),
        'timeout'
      );
    });
  }

  private handleMessage = (event: MessageEvent) => {
    const raw = typeof event.data === 'string' ? event.data : String(event.data ?? '');
    const lines = raw.split(/\r?\n/);

    for (const line of lines) {
      if (!line) continue;
      const trimmed = line.trim();

      if (trimmed === 'readyok') {
        if (this.pendingSyncCount > 0) {
          this.pendingSyncCount -= 1;
        }
        if (this.phase === 'syncing' && this.pendingSyncCount === 0) {
          this.clearPhaseTimer();
          if (this.queuedJob) {
            // A newer job arrived while syncing; switch straight to it
            this.startQueuedJob();
            continue;
          }
          if (this.activeJob && this.worker) {
            const job = this.activeJob;
            this.phase = 'searching';
            this.armSearchTimeout(job);
            if (!this.postToWorker(`position fen ${job.engineFen}`)) return;
            if (!this.postToWorker(`go depth ${job.depth}`)) return;
          } else {
            this.phase = 'idle';
          }
        }
        continue;
      }

      const best = parseBestMoveLine(trimmed);
      if (best) {
        this.clearEmitTimer();
        this.clearPhaseTimer();
        if (this.phase === 'stopping') {
          this.phase = 'idle';
          this.settleJobCancelled(this.activeJob, 'stopped');
          this.activeJob = null;
          if (this.queuedJob) {
            this.startQueuedJob();
          }
          continue;
        }

        if (this.phase === 'searching' && this.activeJob) {
          this.bestMoveUci = best.bestMove;
          this.ponderUci = best.ponder;
          const finishedJob = this.activeJob;
          this.phase = 'idle';
          this.activeJob = null;

          if (finishedJob.mode === 'single') {
            const topLine = this.linesMap.get(1);
            if (topLine) {
              this.settleSingleJob(finishedJob, {
                status: 'completed',
                score: topLine.score,
                bestMove: best.bestMove,
              });
            } else {
              // Never fabricate a fake 0.00 cp score when Stockfish returned no eval line
              this.settleSingleJob(finishedJob, {
                status: 'error',
                score: null,
                bestMove: null,
                error: 'Stockfish completed without returning an evaluation score',
              });
            }
          } else if (finishedJob.mode === 'stream' && finishedJob.onUpdate) {
            this.emitUpdate(finishedJob, false);
          }

          if (this.queuedJob) {
            this.startQueuedJob();
          }
        }
        continue;
      }

      if (this.phase !== 'searching' || !this.activeJob) {
        continue;
      }

      const sideToMove = getTurnFromFen(this.activeJob.fen);
      const parsedInfo = parseUciInfoLine(trimmed, sideToMove);
      if (parsedInfo) {
        // Reset stall timer on stream searches whenever genuine progress arrives
        if (this.activeJob.mode === 'stream') {
          this.armSearchTimeout(this.activeJob);
        }

        // Defer UCI->SAN chess.js conversion to throttled stream emits (and skip entirely for single-eval Game Review)
        if (parsedInfo.multipv <= this.activeJob.multiPv) {
          this.linesMap.set(parsedInfo.multipv, parsedInfo);
        }
        if (parsedInfo.depth >= this.latestDepth) {
          this.latestDepth = parsedInfo.depth;
        }
        if (parsedInfo.nodes > 0) this.latestNodes = parsedInfo.nodes;
        if (parsedInfo.nps > 0) this.latestNps = parsedInfo.nps;

        if (this.activeJob.mode === 'stream' && this.activeJob.onUpdate) {
          this.scheduleThrottledEmit(this.activeJob);
        }
      }
    }
  };

  private scheduleThrottledEmit(job: PendingJob) {
    // Only emit once MultiPV 1 exists so line 2/3 never briefly masquerades as top score
    if (!this.linesMap.has(1)) return;
    const now = performance.now();
    const minIntervalMs = 80;

    if (now - this.lastEmitAt >= minIntervalMs) {
      this.clearEmitTimer();
      this.lastEmitAt = now;
      this.emitUpdate(job, true);
    } else if (this.emitTimer === null) {
      const delay = minIntervalMs - (now - this.lastEmitAt);
      this.emitTimer = globalThis.setTimeout(() => {
        this.emitTimer = null;
        if (this.activeJob === job && this.phase === 'searching') {
          this.lastEmitAt = performance.now();
          this.emitUpdate(job, true);
        }
      }, delay);
    }
  }

  private emitUpdate(job: PendingJob, isSearching: boolean) {
    if (!job.onUpdate) return;
    const sortedLines = Array.from(this.linesMap.values())
      .sort((a, b) => a.multipv - b.multipv)
      .map((line) => {
        const pvKey = line.pvUci.slice(0, 10).join(' ');
        const cached = this.pvSanCache.get(line.multipv);
        let pvSan: string[];
        if (cached && cached.pvKey === pvKey) {
          pvSan = cached.pvSan;
        } else {
          pvSan =
            job.chess960 && job.chess960Rights
              ? uciLineToSan960(job.fen, job.chess960Rights, line.pvUci, 10)
              : uciLineToSan(job.fen, line.pvUci, 10);
          this.pvSanCache.set(line.multipv, { pvKey, pvSan });
        }
        return line.pvSan === pvSan ? line : { ...line, pvSan };
      });
    const bestFromLine = sortedLines[0]?.pvUci[0] ?? null;

    job.onUpdate({
      fen: job.fen,
      depth: this.latestDepth,
      nodes: this.latestNodes,
      nps: this.latestNps,
      bestMoveUci: this.bestMoveUci ?? bestFromLine,
      ponderUci: this.ponderUci,
      lines: sortedLines,
      isSearching,
    });
  }

  async analyzePosition(
    fen: string,
    options: {
      depth: number;
      multiPv: number;
      chess960?: boolean;
      engineFen?: string;
      chess960Rights?: Chess960CastlingRights;
    },
    onUpdate: (analysis: EngineAnalysis) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    const stopGen = this.stopGeneration;
    const reqGen = ++this.requestGeneration;
    try {
      await this.init();
    } catch (err) {
      if (this.stopGeneration !== stopGen || this.requestGeneration !== reqGen) return;
      const error = toError(err, 'Stockfish failed to initialize');
      onError?.(error);
      throw error;
    }
    if (!this.worker || this.stopGeneration !== stopGen || this.requestGeneration !== reqGen) return;

    this.scheduleJob({
      fen,
      engineFen: options.engineFen ?? fen,
      chess960: Boolean(options.chess960),
      chess960Rights: options.chess960Rights,
      depth: Math.max(8, Math.min(22, options.depth)),
      multiPv: Math.max(1, Math.min(3, options.multiPv)),
      mode: 'stream',
      onUpdate,
      onError,
    });
  }

  async evaluateOnce(
    fen: string,
    depth = 11,
    options?: { chess960?: boolean; engineFen?: string; chess960Rights?: Chess960CastlingRights }
  ): Promise<EvaluateOnceResult> {
    const stopGen = this.stopGeneration;
    const reqGen = ++this.requestGeneration;
    try {
      await this.init();
    } catch (err) {
      if (this.stopGeneration !== stopGen || this.requestGeneration !== reqGen) {
        return {
          status: 'cancelled',
          score: null,
          bestMove: null,
          reason: this.stopGeneration !== stopGen ? 'stopped-during-init' : 'superseded-during-init',
        };
      }
      return {
        status: 'error',
        score: null,
        bestMove: null,
        error: toError(err, 'Stockfish failed to initialize').message,
      };
    }

    if (this.stopGeneration !== stopGen || this.requestGeneration !== reqGen) {
      return {
        status: 'cancelled',
        score: null,
        bestMove: null,
        reason: this.stopGeneration !== stopGen ? 'stopped-during-init' : 'superseded-during-init',
      };
    }
    if (!this.worker) {
      return {
        status: 'error',
        score: null,
        bestMove: null,
        error: 'Stockfish worker unavailable',
      };
    }

    return new Promise<EvaluateOnceResult>((resolve) => {
      this.scheduleJob({
        fen,
        engineFen: options?.engineFen ?? fen,
        chess960: Boolean(options?.chess960),
        chess960Rights: options?.chess960Rights,
        depth: Math.max(6, Math.min(18, depth)),
        multiPv: 1,
        mode: 'single',
        resolveSingle: resolve,
      });
    });
  }

  stop() {
    this.stopGeneration += 1;
    this.requestGeneration += 1;
    this.clearEmitTimer();
    const queued = this.queuedJob;
    this.queuedJob = null;
    const active = this.activeJob;
    this.activeJob = null;

    // Always resolve BOTH queued and active pending single-eval Promises as cancelled
    this.settleJobCancelled(queued, 'stopped');
    this.settleJobCancelled(active, 'stopped');

    if (this.phase === 'searching' && this.worker) {
      this.phase = 'stopping';
      this.armPhaseTimer(this.timeouts.stopTimeoutMs, () => this.handleStopTimeout());
      this.postToWorker('stop');
    } else if (this.phase === 'syncing') {
      // Leave phase as 'syncing' with activeJob = null so the in-flight readyok transitions
      // cleanly back to 'idle' (or starts any new job queued before readyok arrives).
      // Keep the sync timeout armed so a stuck worker still recovers cleanly.
    }
  }

  terminate() {
    this.stopGeneration += 1;
    this.requestGeneration += 1;
    const queued = this.queuedJob;
    this.queuedJob = null;
    const active = this.activeJob;
    this.activeJob = null;

    this.destroyWorkerOnly();

    this.settleJobCancelled(queued, 'terminated');
    this.settleJobCancelled(active, 'terminated');
  }

  async restart(): Promise<void> {
    this.terminate();
    await this.init();
  }
}

interface PendingBotMove {
  fen: string;
  level: StockfishLevel;
  chess960: boolean;
  resolve: (move: string | null) => void;
  reject: (error: Error) => void;
}

/**
 * Dedicated Stockfish Web Worker for playing as the opponent bot with configurable UCI Skill Level.
 * Includes handshake/move/stop timeouts, WASM->asm.js fallback, runtime error/messageerror recovery,
 * and safe terminate/restart without duplicate workers.
 */
export class StockfishOpponent {
  private readonly workerFactory: StockfishWorkerFactory;
  private readonly timeouts: StockfishOpponentTimeouts;

  private worker: BootableWorkerLike | null = null;
  private disposeWorkerListeners: (() => void) | null = null;
  private backend: StockfishBackend | null = null;
  private isReady = false;
  private initPromise: Promise<void> | null = null;

  private lifecycleGeneration = 0;
  private cancelGeneration = 0;
  private activeMove: PendingBotMove | null = null;
  private pendingMove: PendingBotMove | null = null;
  private phase: 'idle' | 'searching' | 'stopping' = 'idle';
  private currentChess960 = false;
  private currentSkillLevel: number | null = null;
  private opTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    workerFactory?: StockfishWorkerFactory,
    timeouts: StockfishOpponentTimeouts = {}
  ) {
    this.timeouts = timeouts;
    this.workerFactory =
      workerFactory ??
      ((callbacks) =>
        bootStockfishWorker(callbacks, {
          handshakeTimeoutMs: timeouts.handshakeTimeoutMs ?? DEFAULT_HANDSHAKE_TIMEOUT_MS,
        }));
  }

  getBackend(): StockfishBackend | null {
    return this.backend;
  }

  isRunning(): boolean {
    return this.isReady && this.worker !== null;
  }

  async init(): Promise<void> {
    if (this.isReady && this.worker) return;
    if (this.initPromise) return this.initPromise;

    const bootGen = this.lifecycleGeneration;

    const promise = this.workerFactory({
      onMessage: (event) => {
        if (this.lifecycleGeneration !== bootGen) return;
        this.handleMessage(event);
      },
      onError: (err) => {
        if (this.lifecycleGeneration !== bootGen) return;
        this.handleRuntimeFault(err);
      },
    })
      .then((booted) => {
        if (this.lifecycleGeneration !== bootGen) {
          booted.disposeListeners();
          try {
            booted.worker.terminate();
          } catch {
            // Ignore terminate errors
          }
          throw new Error('Stockfish opponent initialization aborted');
        }
        this.worker = booted.worker;
        this.disposeWorkerListeners = booted.disposeListeners;
        this.backend = booted.backend;
        this.isReady = true;
        this.phase = 'idle';
        this.currentChess960 = false;
        this.currentSkillLevel = null;
      })
      .catch((err) => {
        if (this.lifecycleGeneration === bootGen) {
          this.worker = null;
          this.disposeWorkerListeners = null;
          this.backend = null;
          this.isReady = false;
          this.initPromise = null;
          this.phase = 'idle';
        }
        throw toError(err, 'Stockfish opponent initialization failed');
      });

    this.initPromise = promise;
    return promise;
  }

  private clearOpTimer() {
    if (this.opTimer !== null) {
      globalThis.clearTimeout(this.opTimer);
      this.opTimer = null;
    }
  }

  private armOpTimer(ms: number, onTimeout: () => void) {
    this.clearOpTimer();
    this.opTimer = globalThis.setTimeout(() => {
      this.opTimer = null;
      onTimeout();
    }, ms);
  }

  private destroyWorkerOnly() {
    this.clearOpTimer();
    this.lifecycleGeneration += 1;
    const dispose = this.disposeWorkerListeners;
    this.disposeWorkerListeners = null;
    const worker = this.worker;
    this.worker = null;
    this.backend = null;
    this.isReady = false;
    this.initPromise = null;
    this.phase = 'idle';
    this.currentChess960 = false;
    this.currentSkillLevel = null;

    try {
      dispose?.();
    } catch {
      // Ignore detach errors
    }
    try {
      worker?.terminate();
    } catch {
      // Ignore terminate errors
    }
  }

  private postToWorker(command: string): boolean {
    if (!this.worker) return false;
    try {
      this.worker.postMessage(command);
      return true;
    } catch (err) {
      this.handleRuntimeFault(toError(err, `Failed to send UCI command to opponent: ${command}`));
      return false;
    }
  }

  private handleRuntimeFault(err: Error) {
    const active = this.activeMove;
    const pending = this.pendingMove;
    this.activeMove = null;
    this.pendingMove = null;
    this.destroyWorkerOnly();

    active?.reject(err);
    pending?.reject(err);
  }

  private handleStopTimeout() {
    if (this.phase !== 'stopping') return;
    const queued = this.pendingMove;
    this.pendingMove = null;
    this.activeMove = null;

    this.destroyWorkerOnly();

    if (queued) {
      const gen = this.cancelGeneration;
      this.init()
        .then(() => {
          if (this.cancelGeneration !== gen) {
            queued.resolve(null);
            return;
          }
          this.pendingMove = queued;
          this.startPending();
        })
        .catch((err) => {
          if (this.cancelGeneration !== gen) {
            queued.resolve(null);
            return;
          }
          queued.reject(toError(err, 'Stockfish opponent restart failed after stop timeout'));
        });
    }
  }

  private startPending() {
    if (!this.worker || !this.pendingMove) {
      this.phase = 'idle';
      return;
    }
    const move = this.pendingMove;
    this.pendingMove = null;
    this.activeMove = move;
    this.phase = 'searching';

    const { fen, level, chess960 } = move;
    const moveTimeoutMs =
      this.timeouts.moveTimeoutMs ?? Math.max(8_000, level.moveTimeMs * 4 + 4_000);

    this.armOpTimer(moveTimeoutMs, () => {
      if (this.phase !== 'searching' || this.activeMove !== move) return;
      this.handleRuntimeFault(new Error(`Stockfish opponent timed out after ${moveTimeoutMs}ms`));
    });

    if (chess960 !== this.currentChess960) {
      this.currentChess960 = chess960;
      if (!this.postToWorker(`setoption name UCI_Chess960 value ${chess960 ? 'true' : 'false'}`)) {
        return;
      }
    }
    if (this.currentSkillLevel !== level.skillLevel) {
      this.currentSkillLevel = level.skillLevel;
      if (!this.postToWorker(`setoption name Skill Level value ${level.skillLevel}`)) return;
    }
    if (!this.postToWorker(`position fen ${fen}`)) return;
    this.postToWorker(`go depth ${level.depthCap} movetime ${level.moveTimeMs}`);
  }

  private handleMessage = (event: MessageEvent) => {
    const raw = typeof event.data === 'string' ? event.data : String(event.data ?? '');
    for (const line of raw.split(/\r?\n/)) {
      const best = parseBestMoveLine(line.trim());
      if (best) {
        this.clearOpTimer();
        if (this.phase === 'stopping') {
          this.phase = 'idle';
          this.activeMove = null;
          if (this.pendingMove) {
            this.startPending();
          }
          continue;
        }

        if (this.phase === 'searching') {
          this.phase = 'idle';
          const finished = this.activeMove;
          this.activeMove = null;
          finished?.resolve(best.bestMove);
          if (this.pendingMove) {
            this.startPending();
          }
        }
      }
    }
  };

  async computeMove(fen: string, level: StockfishLevel, chess960 = false): Promise<string | null> {
    const gen = this.cancelGeneration;
    await this.init();
    if (this.cancelGeneration !== gen || !this.worker) return null;

    return new Promise<string | null>((resolve, reject) => {
      if (this.pendingMove) {
        this.pendingMove.resolve(null);
      }
      this.pendingMove = { fen, level, chess960, resolve, reject };

      if (this.phase === 'searching') {
        if (this.activeMove) {
          this.activeMove.resolve(null);
          this.activeMove = null;
        }
        this.phase = 'stopping';
        this.armOpTimer(this.timeouts.stopTimeoutMs ?? DEFAULT_STOP_TIMEOUT_MS, () =>
          this.handleStopTimeout()
        );
        this.postToWorker('stop');
      } else if (this.phase === 'idle') {
        this.startPending();
      }
    });
  }

  cancel() {
    this.cancelGeneration += 1;
    if (this.pendingMove) {
      const p = this.pendingMove;
      this.pendingMove = null;
      p.resolve(null);
    }
    if (this.activeMove) {
      const a = this.activeMove;
      this.activeMove = null;
      a.resolve(null);
    }
    if (this.phase === 'searching' && this.worker) {
      this.phase = 'stopping';
      this.armOpTimer(this.timeouts.stopTimeoutMs ?? DEFAULT_STOP_TIMEOUT_MS, () =>
        this.handleStopTimeout()
      );
      this.postToWorker('stop');
    }
  }

  terminate() {
    this.cancelGeneration += 1;
    const pending = this.pendingMove;
    this.pendingMove = null;
    const active = this.activeMove;
    this.activeMove = null;

    this.destroyWorkerOnly();

    pending?.resolve(null);
    active?.resolve(null);
  }

  async restart(): Promise<void> {
    this.terminate();
    await this.init();
  }
}

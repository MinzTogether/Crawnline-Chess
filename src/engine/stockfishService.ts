import type { Color } from 'chess.js';
import type { EngineAnalysis, EngineLine, EvalScore, StockfishLevel } from '../types/chess';
import { uciLineToSan } from '../game/chessLogic';
import { uciLineToSan960, type Chess960CastlingRights } from '../game/chess960';
import { parseBestMoveLine, parseUciInfoLine } from './uciParser';

function detectWasmSupport(): boolean {
  try {
    if (typeof WebAssembly === 'object' && typeof WebAssembly.validate === 'function') {
      return WebAssembly.validate(Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00));
    }
  } catch {
    // Fall back to asm.js
  }
  return false;
}

function getStockfishWorkerUrl(): string {
  return detectWasmSupport() ? '/stockfish/stockfish.wasm.js' : '/stockfish/stockfish.js';
}

function getTurnFromFen(fen: string): Color {
  const parts = fen.split(' ');
  return parts[1] === 'b' ? 'b' : 'w';
}

/**
 * Boots a Stockfish Web Worker (WASM with automatic asm.js fallback), runs the UCI handshake
 * (`uci` -> `uciok` -> `isready` -> `readyok`), and attaches the steady-state message listener.
 * Both primary and fallback workers attach error handlers so init promises can never hang.
 */
function bootStockfishWorker(onMessage: (event: MessageEvent) => void): Promise<Worker> {
  return new Promise<Worker>((resolve, reject) => {
    let settled = false;
    let activeWorker: Worker | null = null;

    const fail = (err: unknown) => {
      if (settled) return;
      settled = true;
      activeWorker?.terminate();
      activeWorker = null;
      reject(err);
    };

    const launch = (url: string, allowFallback: boolean) => {
      let worker: Worker;
      try {
        worker = new Worker(url);
      } catch (err) {
        if (allowFallback && url.endsWith('stockfish.wasm.js')) {
          launch('/stockfish/stockfish.js', false);
          return;
        }
        fail(err);
        return;
      }

      activeWorker = worker;

      const onInitMessage = (event: MessageEvent) => {
        if (settled || activeWorker !== worker) return;
        const line = typeof event.data === 'string' ? event.data : String(event.data ?? '');
        if (line.includes('uciok')) {
          worker.postMessage('isready');
        } else if (line.includes('readyok')) {
          settled = true;
          worker.removeEventListener('message', onInitMessage);
          worker.removeEventListener('error', onInitError);
          worker.addEventListener('message', onMessage);
          resolve(worker);
        }
      };

      const onInitError = (err: ErrorEvent) => {
        if (settled || activeWorker !== worker) return;
        worker.removeEventListener('message', onInitMessage);
        worker.removeEventListener('error', onInitError);
        worker.terminate();
        if (allowFallback && url.endsWith('stockfish.wasm.js')) {
          launch('/stockfish/stockfish.js', false);
          return;
        }
        fail(err);
      };

      worker.addEventListener('message', onInitMessage);
      worker.addEventListener('error', onInitError);
      worker.postMessage('uci');
    };

    launch(getStockfishWorkerUrl(), true);
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
  resolveSingle?: (result: { score: EvalScore; bestMove: string | null }) => void;
}

/**
 * Dedicated Stockfish Web Worker controller for real-time MultiPV position analysis
 * and on-demand full game review.
 *
 * Strictly serializes stop -> bestmove -> setoption -> isready -> readyok -> go
 * so single-threaded Emscripten Stockfish WASM never drops depth or collides across FEN changes.
 */
export class StockfishAnalyzer {
  private worker: Worker | null = null;
  private isReady = false;
  private initPromise: Promise<void> | null = null;

  private phase: 'idle' | 'stopping' | 'syncing' | 'searching' = 'idle';
  private pendingSyncCount = 0;
  private activeJob: PendingJob | null = null;
  private queuedJob: PendingJob | null = null;
  private currentMultiPv = 1;
  private currentChess960 = false;

  private linesMap = new Map<number, EngineLine>();
  private latestDepth = 0;
  private latestNodes = 0;
  private latestNps = 0;
  private bestMoveUci: string | null = null;
  private ponderUci: string | null = null;
  private lastEmitAt = 0;
  private emitTimer: number | null = null;

  async init(): Promise<void> {
    if (this.isReady && this.worker) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = bootStockfishWorker(this.handleMessage)
      .then((worker) => {
        this.worker = worker;
        this.isReady = true;
        this.phase = 'idle';
        this.pendingSyncCount = 0;
      })
      .catch((err) => {
        this.worker = null;
        this.isReady = false;
        this.initPromise = null;
        this.phase = 'idle';
        this.pendingSyncCount = 0;
        throw err;
      });

    return this.initPromise;
  }

  private clearEmitTimer() {
    if (this.emitTimer !== null) {
      window.clearTimeout(this.emitTimer);
      this.emitTimer = null;
    }
  }

  private scheduleJob(job: PendingJob) {
    if (!this.worker) return;

    // Resolve any superseded single-eval job cleanly
    if (this.queuedJob?.mode === 'single' && this.queuedJob.resolveSingle) {
      this.queuedJob.resolveSingle({ score: { type: 'cp', value: 0 }, bestMove: null });
    }
    this.queuedJob = job;

    if (this.phase === 'idle') {
      this.startQueuedJob();
    } else if (this.phase === 'searching') {
      this.clearEmitTimer();
      this.phase = 'stopping';
      this.worker.postMessage('stop');
    }
    // If phase is already 'stopping' or 'syncing', startQueuedJob() will pick up queuedJob automatically.
  }

  private startQueuedJob() {
    this.clearEmitTimer();
    if (!this.worker || !this.queuedJob) {
      this.phase = 'idle';
      return;
    }

    const job = this.queuedJob;
    this.queuedJob = null;
    this.activeJob = job;
    this.linesMap.clear();
    this.latestDepth = 0;
    this.latestNodes = 0;
    this.latestNps = 0;
    this.bestMoveUci = null;
    this.ponderUci = null;
    this.lastEmitAt = 0;

    if (job.multiPv !== this.currentMultiPv) {
      this.currentMultiPv = job.multiPv;
      this.worker.postMessage(`setoption name MultiPV value ${job.multiPv}`);
    }
    if (job.chess960 !== this.currentChess960) {
      this.currentChess960 = job.chess960;
      this.worker.postMessage(`setoption name UCI_Chess960 value ${job.chess960 ? 'true' : 'false'}`);
    }

    this.phase = 'syncing';
    this.pendingSyncCount += 1;
    this.worker.postMessage('isready');
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
          if (this.queuedJob) {
            // A newer job arrived while syncing; switch straight to it
            this.startQueuedJob();
            continue;
          }
          if (this.activeJob && this.worker) {
            this.phase = 'searching';
            this.worker.postMessage(`position fen ${this.activeJob.engineFen}`);
            this.worker.postMessage(`go depth ${this.activeJob.depth}`);
          } else {
            this.phase = 'idle';
          }
        }
        continue;
      }

      const best = parseBestMoveLine(trimmed);
      if (best) {
        this.clearEmitTimer();
        if (this.phase === 'stopping') {
          this.phase = 'idle';
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

          if (finishedJob.mode === 'single' && finishedJob.resolveSingle) {
            const topLine = this.linesMap.get(1);
            finishedJob.resolveSingle({
              score: topLine?.score ?? { type: 'cp', value: 0 },
              bestMove: best.bestMove,
            });
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
        parsedInfo.pvSan =
          this.activeJob.chess960 && this.activeJob.chess960Rights
            ? uciLineToSan960(this.activeJob.fen, this.activeJob.chess960Rights, parsedInfo.pvUci, 10)
            : uciLineToSan(this.activeJob.fen, parsedInfo.pvUci, 10);
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
      this.emitTimer = window.setTimeout(() => {
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
    const sortedLines = Array.from(this.linesMap.values()).sort((a, b) => a.multipv - b.multipv);
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
    onUpdate: (analysis: EngineAnalysis) => void
  ): Promise<void> {
    await this.init();
    if (!this.worker) return;

    this.scheduleJob({
      fen,
      engineFen: options.engineFen ?? fen,
      chess960: Boolean(options.chess960),
      chess960Rights: options.chess960Rights,
      depth: Math.max(8, Math.min(22, options.depth)),
      multiPv: Math.max(1, Math.min(3, options.multiPv)),
      mode: 'stream',
      onUpdate,
    });
  }

  async evaluateOnce(
    fen: string,
    depth = 11,
    options?: { chess960?: boolean; engineFen?: string; chess960Rights?: Chess960CastlingRights }
  ): Promise<{ score: EvalScore; bestMove: string | null }> {
    await this.init();
    if (!this.worker) return { score: { type: 'cp', value: 0 }, bestMove: null };

    return new Promise((resolve) => {
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
    this.clearEmitTimer();
    this.queuedJob = null;
    if (this.activeJob?.mode === 'single' && this.activeJob.resolveSingle) {
      this.activeJob.resolveSingle({ score: { type: 'cp', value: 0 }, bestMove: null });
    }
    this.activeJob = null;
    if (this.phase === 'searching' && this.worker) {
      this.phase = 'stopping';
      this.worker.postMessage('stop');
    }
    // If phase === 'syncing', leave phase as 'syncing' with activeJob = null so the in-flight
    // readyok transitions cleanly back to 'idle' (or starts any job queued before readyok arrives).
  }

  terminate() {
    this.stop();
    this.worker?.terminate();
    this.worker = null;
    this.isReady = false;
    this.initPromise = null;
    this.phase = 'idle';
    this.pendingSyncCount = 0;
  }
}

/**
 * Dedicated Stockfish Web Worker for playing as the opponent bot with configurable UCI Skill Level.
 */
export class StockfishOpponent {
  private worker: Worker | null = null;
  private isReady = false;
  private initPromise: Promise<void> | null = null;
  private resolver: ((uciMove: string | null) => void) | null = null;
  private isSearching = false;
  private currentChess960 = false;
  private currentSkillLevel: number | null = null;
  private pendingMove: {
    fen: string;
    level: StockfishLevel;
    chess960: boolean;
    resolve: (m: string | null) => void;
  } | null = null;

  async init(): Promise<void> {
    if (this.isReady && this.worker) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = bootStockfishWorker(this.handleMessage)
      .then((worker) => {
        this.worker = worker;
        this.isReady = true;
      })
      .catch((err) => {
        this.worker = null;
        this.isReady = false;
        this.initPromise = null;
        throw err;
      });

    return this.initPromise;
  }

  private startPending() {
    if (!this.worker || !this.pendingMove) return;
    const { fen, level, chess960, resolve } = this.pendingMove;
    this.pendingMove = null;
    this.resolver = resolve;
    this.isSearching = true;
    if (chess960 !== this.currentChess960) {
      this.currentChess960 = chess960;
      this.worker.postMessage(`setoption name UCI_Chess960 value ${chess960 ? 'true' : 'false'}`);
    }
    if (this.currentSkillLevel !== level.skillLevel) {
      this.currentSkillLevel = level.skillLevel;
      this.worker.postMessage(`setoption name Skill Level value ${level.skillLevel}`);
    }
    this.worker.postMessage(`position fen ${fen}`);
    this.worker.postMessage(`go depth ${level.depthCap} movetime ${level.moveTimeMs}`);
  }

  private handleMessage = (event: MessageEvent) => {
    const raw = typeof event.data === 'string' ? event.data : String(event.data ?? '');
    for (const line of raw.split(/\r?\n/)) {
      const best = parseBestMoveLine(line.trim());
      if (best) {
        this.isSearching = false;
        const resolve = this.resolver;
        this.resolver = null;
        if (resolve) resolve(best.bestMove);
        if (this.pendingMove) {
          this.startPending();
        }
      }
    }
  };

  async computeMove(fen: string, level: StockfishLevel, chess960 = false): Promise<string | null> {
    await this.init();
    if (!this.worker) return null;

    return new Promise<string | null>((resolve) => {
      if (this.pendingMove) {
        this.pendingMove.resolve(null);
      }
      this.pendingMove = { fen, level, chess960, resolve };

      if (this.isSearching) {
        if (this.resolver) {
          this.resolver(null);
          this.resolver = null;
        }
        this.worker!.postMessage('stop');
      } else {
        this.startPending();
      }
    });
  }

  cancel() {
    if (this.pendingMove) {
      this.pendingMove.resolve(null);
      this.pendingMove = null;
    }
    if (this.resolver) {
      this.resolver(null);
      this.resolver = null;
    }
    if (this.isSearching) {
      this.worker?.postMessage('stop');
    }
  }

  terminate() {
    this.cancel();
    this.worker?.terminate();
    this.worker = null;
    this.isReady = false;
    this.initPromise = null;
    this.isSearching = false;
    this.currentChess960 = false;
    this.currentSkillLevel = null;
  }
}

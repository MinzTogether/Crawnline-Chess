import type { EvalScore } from '../types/chess';
import { evalToBarPercent, evalToWhiteWinProbability } from './uciParser';

export interface CachedEvalEntry {
  score: EvalScore;
  depth: number;
}

export interface StabilizerInput {
  fen: string;
  incomingScore: EvalScore | null;
  incomingDepth: number;
  isSearching: boolean;
  storedMoveEval?: EvalScore | null;
  cache: Map<string, CachedEvalEntry>;
  displayed: {
    fen: string | null;
    score: EvalScore | null;
    depth: number;
  };
}

export interface StabilizerOutput {
  score: EvalScore | null;
  depth: number;
  barPercent: number;
  winProb: number;
  isStabilizing: boolean;
  /** Updated displayed snapshot to store in ref/state */
  nextDisplayed: {
    fen: string;
    score: EvalScore | null;
    depth: number;
  };
}

/** Minimum depth required before a streaming score replaces an already-established score for a position. */
export const MIN_STABLE_DEPTH = 6;

/** Deadband in centipawns below which mid-search micro-oscillations are absorbed on the same FEN. */
export const SAME_FEN_CP_DEADBAND = 14;

/** Deadband in bar percentage below which visual bar micro-jitter is suppressed while searching. */
export const SAME_FEN_BAR_DEADBAND = 1.0;

/** Maximum number of evaluated positions kept in memory to prevent unbounded growth across long sessions. */
export const MAX_EVAL_CACHE_SIZE = 500;

function writeCachedEval(
  cache: Map<string, CachedEvalEntry>,
  key: string,
  entry: CachedEvalEntry
): void {
  if (cache.has(key)) {
    cache.delete(key);
  } else if (cache.size >= MAX_EVAL_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) {
      cache.delete(oldestKey);
    }
  }
  cache.set(key, entry);
}

/**
 * Normalizes a FEN to its position identity (board + side + castling + ep)
 * so transpositions / halfmove clock differences share cached evaluations safely.
 */
export function positionKeyFromFen(fen: string): string {
  const parts = fen.trim().split(/\s+/);
  if (parts.length >= 4) {
    return `${parts[0]} ${parts[1]} ${parts[2]} ${parts[3]}`;
  }
  return fen.trim();
}

function isForcedMate(score: EvalScore | null | undefined): boolean {
  return Boolean(score && score.type === 'mate');
}

function scoresDifferSignificantly(prev: EvalScore, next: EvalScore, nextDepth: number): boolean {
  if (prev.type !== next.type) return true;
  if (prev.type === 'mate' && next.type === 'mate') {
    return prev.value !== next.value;
  }
  const cpDelta = Math.abs(next.value - prev.value);
  const barDelta = Math.abs(evalToBarPercent(next) - evalToBarPercent(prev));

  // At high depth (>= 14) or final depth, accept smaller refinements
  if (nextDepth >= 14) {
    return cpDelta >= 6 || barDelta >= 0.4;
  }
  return cpDelta >= SAME_FEN_CP_DEADBAND || barDelta >= SAME_FEN_BAR_DEADBAND;
}

/**
 * Pure, deterministic evaluation stabilizer for the vertical Evaluation Bar.
 *
 * Prevents 4 common causes of evaluation bar jitter:
 * 1. Flashing back to 0.0 / 50% when stepping between moves (uses FEN cache + storedMoveEval fallback).
 * 2. Shallow depth (1..5) horizon-effect spikes during the first 10-40ms of a new position search.
 * 3. Regressing from a deeper cached eval to a shallower streaming eval on the same FEN.
 * 4. High-frequency ±0.1 pawn micro-trembling on the same FEN while Stockfish iterates depths.
 */
export function stabilizeEvaluation(input: StabilizerInput): StabilizerOutput {
  const { fen, incomingScore, incomingDepth, isSearching, storedMoveEval, cache, displayed } = input;
  const key = positionKeyFromFen(fen);
  const cached = cache.get(key) ?? null;
  if (cached) {
    // Refresh recency for LRU eviction
    cache.delete(key);
    cache.set(key, cached);
  }

  // Determine the best authoritative baseline for this FEN before considering shallow streaming updates
  let candidateScore: EvalScore | null = null;
  let candidateDepth = 0;

  if (cached) {
    candidateScore = cached.score;
    candidateDepth = cached.depth;
  } else if (storedMoveEval) {
    candidateScore = storedMoveEval;
    candidateDepth = MIN_STABLE_DEPTH;
  }

  // Decide whether to accept the incoming Stockfish evaluation
  if (incomingScore) {
    const isTerminal = !isSearching && incomingDepth === 0;
    const isFinalSearchResult = !isSearching && incomingDepth > 0;
    const isDeepEnough = incomingDepth >= MIN_STABLE_DEPTH || isForcedMate(incomingScore) || isTerminal;
    const improvesDepth = incomingDepth >= candidateDepth || isTerminal;

    if (isTerminal || isFinalSearchResult) {
      // Finalized or terminal (checkmate/stalemate) evaluation is always authoritative
      candidateScore = incomingScore;
      candidateDepth = incomingDepth;
      if (incomingDepth >= MIN_STABLE_DEPTH || isTerminal) {
        writeCachedEval(cache, key, { score: incomingScore, depth: incomingDepth });
      }
    } else if (isDeepEnough && improvesDepth) {
      candidateScore = incomingScore;
      candidateDepth = incomingDepth;
      writeCachedEval(cache, key, { score: incomingScore, depth: incomingDepth });
    } else if (!candidateScore && incomingDepth >= 4) {
      // Brand new position with no cached/stored eval yet: wait until at least depth 4 before initial draw
      candidateScore = incomingScore;
      candidateDepth = incomingDepth;
    }
  }

  // If this is a brand new FEN and we still don't have a depth>=4 score yet,
  // hold the previous displayed score softly rather than snapping abruptly to 50% (0.0)
  let finalScore = candidateScore;
  let finalDepth = candidateDepth;

  if (!finalScore) {
    if (displayed.fen === fen && displayed.score) {
      finalScore = displayed.score;
      finalDepth = displayed.depth;
    } else if (displayed.score && isSearching) {
      // Keep the bar steady while waiting the ~30ms for depth 4..6 on the new position
      finalScore = displayed.score;
      finalDepth = 0;
    }
  } else if (
    displayed.fen === fen &&
    displayed.score &&
    isSearching &&
    finalDepth < 16 &&
    !scoresDifferSignificantly(displayed.score, finalScore, finalDepth)
  ) {
    // Absorb tiny mid-search oscillations on the same position
    finalScore = displayed.score;
  }

  const barPercent = evalToBarPercent(finalScore);
  const winProb = finalScore ? Math.round(evalToWhiteWinProbability(finalScore)) : 50;
  const isStabilizing = isSearching && finalDepth < MIN_STABLE_DEPTH;

  return {
    score: finalScore,
    depth: finalDepth,
    barPercent,
    winProb,
    isStabilizing,
    nextDisplayed: {
      fen,
      score: finalScore,
      depth: finalDepth,
    },
  };
}

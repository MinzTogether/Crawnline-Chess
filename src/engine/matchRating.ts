import type { Color } from 'chess.js';
import type { MoveClassification, MoveRecord } from '../types/chess';
import { calculateAverageAccuracy, evalToWhiteWinProbability } from './uciParser';

export const MIN_ESTIMATED_ELO = 400;
export const MAX_ESTIMATED_ELO = 2900;
const NEUTRAL_BASELINE_ELO = 1200;
const MIN_FULL_CONFIDENCE_MOVES = 8;
const LOSS_ESTIMATED_ELO_CAP = 2600;

export type MatchResultString = '1-0' | '0-1' | '1/2-1/2' | '*';
export type PlayerMatchOutcome = 'win' | 'loss' | 'draw';

export interface EstimateGameEloOptions {
  /** Number of analyzed moves played by this side (prevents absurd GM ratings on 1-2 move samples). */
  moveCount?: number;
  /** Match outcome for this side to keep Estimated Game Elo consistent with decisive results. */
  outcome?: PlayerMatchOutcome | null;
}

export interface MatchRatingOptions {
  /** Optional game result string ('1-0', '0-1', '1/2-1/2', '*') for outcome-consistent rating & summary. */
  result?: MatchResultString;
}

export interface PlayerMatchStats {
  accuracy: number | null;
  /** Single-game Estimated Game Elo (NOT an official FIDE/platform rating). Range: 400..2900. */
  estimatedElo: number | null;
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | '—';
  counts: Record<MoveClassification, number>;
  analyzedMoves: number;
  openingAccuracy: number | null;
  middlegameAccuracy: number | null;
  endgameAccuracy: number | null;
}

export interface KeyMoment {
  ply: number;
  moveNumber: number;
  color: Color;
  san: string;
  classification: MoveClassification;
  bestMoveUci?: string;
  swing: number; // win-probability swing magnitude
  headline: string;
}

export interface MatchRatingReport {
  isComplete: boolean;
  analyzedPlies: number;
  totalPlies: number;
  white: PlayerMatchStats;
  black: PlayerMatchStats;
  keyMoments: KeyMoment[];
  summaryHeadline: string;
}

function emptyCounts(): Record<MoveClassification, number> {
  return {
    book: 0,
    brilliant: 0,
    great: 0,
    best: 0,
    excellent: 0,
    good: 0,
    inaccuracy: 0,
    mistake: 0,
    blunder: 0,
  };
}

function sanitizeCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

function sanitizeCounts(
  counts: Partial<Record<MoveClassification, number>> | null | undefined
): Record<MoveClassification, number> {
  const safe = emptyCounts();
  if (!counts || typeof counts !== 'object') return safe;
  for (const key of Object.keys(safe) as MoveClassification[]) {
    safe[key] = sanitizeCount(counts[key]);
  }
  return safe;
}

function resolveResultFromMoves(moves: MoveRecord[], explicit?: MatchResultString): MatchResultString {
  if (explicit === '1-0' || explicit === '0-1' || explicit === '1/2-1/2') {
    return explicit;
  }
  const last = moves[moves.length - 1];
  if (last && typeof last.san === 'string' && last.san.includes('#')) {
    return last.color === 'w' ? '1-0' : '0-1';
  }
  return '*';
}

function resolveSideOutcome(result: MatchResultString, color: Color): PlayerMatchOutcome | null {
  if (result === '1-0') return color === 'w' ? 'win' : 'loss';
  if (result === '0-1') return color === 'b' ? 'win' : 'loss';
  if (result === '1/2-1/2') return 'draw';
  return null;
}

/**
 * Estimates a Chess.com-style single-game Performance Rating (Estimated Game Elo, NOT an official rating)
 * from CAPS accuracy, move classification counts, sample size, and optional game outcome.
 * Range: 400 to 2900 Elo.
 */
export function estimateGameElo(
  accuracy: number | null,
  counts: Partial<Record<MoveClassification, number>> | null | undefined,
  options?: EstimateGameEloOptions
): number | null {
  if (accuracy === null || typeof accuracy !== 'number' || !Number.isFinite(accuracy)) {
    return null;
  }

  const safeCounts = sanitizeCounts(counts);
  const classifiedTotal = (Object.values(safeCounts) as number[]).reduce((acc, n) => acc + n, 0);

  let sampleMoves = classifiedTotal;
  if (options?.moveCount !== undefined) {
    if (typeof options.moveCount !== 'number' || !Number.isFinite(options.moveCount) || options.moveCount <= 0) {
      return null;
    }
    sampleMoves = Math.floor(options.moveCount);
  }

  const clampedAccuracy = Math.max(0, Math.min(100, accuracy));

  // Base curve mapped closely to Chess.com Game Review Elo expectations
  // 50% -> ~750, 70% -> ~1300, 80% -> ~1700, 88% -> ~2050, 95% -> ~2480, 99% -> ~2800
  let elo: number;
  if (clampedAccuracy >= 95) {
    elo = 2450 + (clampedAccuracy - 95) * 90;
  } else if (clampedAccuracy >= 85) {
    elo = 1900 + (clampedAccuracy - 85) * 55;
  } else if (clampedAccuracy >= 70) {
    elo = 1280 + (clampedAccuracy - 70) * 41.3;
  } else {
    elo = 400 + Math.max(0, clampedAccuracy - 25) * 19.5;
  }

  // Slight adjustment for blunders vs great/brilliant moves, bounded so extreme/long counts stay consistent with accuracy
  const rawAdjustment =
    (safeCounts.great + safeCounts.brilliant) * 40 -
    safeCounts.blunder * 75 -
    safeCounts.mistake * 25;
  const boundedAdjustment = Math.max(-300, Math.min(200, rawAdjustment));
  elo += boundedAdjustment;

  // Sample-size confidence moderation: full strength at >= 8 moves; shrinks tiny 1-7 move samples
  // or book-only openings gently toward neutral baseline so 1-2 book moves cannot claim 2900 GM Elo.
  let confidence = 1;
  if (sampleMoves > 0) {
    confidence = Math.min(1, sampleMoves / MIN_FULL_CONFIDENCE_MOVES);
    const nonBookMoves = Math.max(0, classifiedTotal - safeCounts.book);
    if (classifiedTotal > 0 && nonBookMoves === 0) {
      confidence = Math.min(confidence, 0.25);
    }
    if (confidence < 1) {
      elo = NEUTRAL_BASELINE_ELO + (elo - NEUTRAL_BASELINE_ELO) * confidence;
    }
  }

  // Keep Estimated Game Elo gently consistent with decisive outcomes without overriding strong accuracy gaps
  const outcome = options?.outcome ?? null;
  if (outcome === 'win') {
    elo += 50 * confidence;
  } else if (outcome === 'loss') {
    elo -= 50 * confidence;
    elo = Math.min(elo, LOSS_ESTIMATED_ELO_CAP);
  }

  const clamped = Math.max(MIN_ESTIMATED_ELO, Math.min(MAX_ESTIMATED_ELO, elo));
  return Math.round(clamped / 50) * 50;
}

export function accuracyToGrade(accuracy: number | null): 'S' | 'A' | 'B' | 'C' | 'D' | '—' {
  if (accuracy === null || typeof accuracy !== 'number' || !Number.isFinite(accuracy)) {
    return '—';
  }
  const clamped = Math.max(0, Math.min(100, accuracy));
  if (clamped >= 93) return 'S';
  if (clamped >= 84) return 'A';
  if (clamped >= 74) return 'B';
  if (clamped >= 62) return 'C';
  return 'D';
}

function buildPlayerStats(
  moves: MoveRecord[],
  color: Color,
  outcome: PlayerMatchOutcome | null
): PlayerMatchStats {
  const playerMoves = moves.filter((m) => m && m.color === color);
  const counts = emptyCounts();
  const allAcc: number[] = [];
  const openingAcc: number[] = [];
  const middleAcc: number[] = [];
  const endgameAcc: number[] = [];

  for (const m of playerMoves) {
    if (m.classification && Object.prototype.hasOwnProperty.call(counts, m.classification)) {
      counts[m.classification] += 1;
    }
    if (typeof m.accuracy === 'number' && Number.isFinite(m.accuracy)) {
      const clampedAcc = Math.max(0, Math.min(100, m.accuracy));
      allAcc.push(clampedAcc);
      if (typeof m.moveNumber === 'number' && Number.isFinite(m.moveNumber) && m.moveNumber >= 1) {
        if (m.moveNumber <= 10) {
          openingAcc.push(clampedAcc);
        } else if (m.moveNumber <= 25) {
          middleAcc.push(clampedAcc);
        } else {
          endgameAcc.push(clampedAcc);
        }
      }
    }
  }

  const accuracy = calculateAverageAccuracy(allAcc);
  const analyzedMoves = allAcc.length;
  return {
    accuracy,
    estimatedElo:
      analyzedMoves > 0
        ? estimateGameElo(accuracy, counts, { moveCount: analyzedMoves, outcome })
        : null,
    grade: accuracyToGrade(accuracy),
    counts,
    analyzedMoves,
    openingAccuracy: calculateAverageAccuracy(openingAcc),
    middlegameAccuracy: calculateAverageAccuracy(middleAcc),
    endgameAccuracy: calculateAverageAccuracy(endgameAcc),
  };
}

/**
 * Generates a full Chess.com-style Match Rating report from analyzed moves.
 */
export function buildMatchRatingReport(
  moves: MoveRecord[],
  options?: MatchRatingOptions
): MatchRatingReport {
  const safeMoves = Array.isArray(moves) ? moves : [];
  const analyzedPlies = safeMoves.filter(
    (m) => m && typeof m.accuracy === 'number' && Number.isFinite(m.accuracy)
  ).length;

  const resolvedResult = resolveResultFromMoves(safeMoves, options?.result);
  const white = buildPlayerStats(safeMoves, 'w', resolveSideOutcome(resolvedResult, 'w'));
  const black = buildPlayerStats(safeMoves, 'b', resolveSideOutcome(resolvedResult, 'b'));

  // Identify up to 5 Key Turning Points (blunders, mistakes, great/brilliant moves)
  const keyMoments: KeyMoment[] = [];
  for (let i = 0; i < safeMoves.length; i++) {
    const m = safeMoves[i];
    if (!m || !m.classification) continue;

    const prevProb =
      i > 0 && safeMoves[i - 1]?.evalAfter ? evalToWhiteWinProbability(safeMoves[i - 1].evalAfter!) : 50;
    const afterProb = m.evalAfter ? evalToWhiteWinProbability(m.evalAfter) : prevProb;
    const rawSwing = Math.abs(afterProb - prevProb);
    const swing = Number.isFinite(rawSwing) ? Math.round(rawSwing) : 0;

    const isNotable =
      m.classification === 'blunder' ||
      m.classification === 'mistake' ||
      m.classification === 'brilliant' ||
      m.classification === 'great';

    if (isNotable) {
      const sideLabel = m.color === 'w' ? 'White' : 'Black';
      let headline = `${sideLabel} played a strong resource`;
      if (m.classification === 'blunder') {
        headline = `${sideLabel} blundered decisive advantage`;
      } else if (m.classification === 'mistake') {
        headline = `${sideLabel} let the edge slip`;
      } else if (m.classification === 'brilliant') {
        headline = `${sideLabel} found a brilliant sacrifice`;
      } else if (m.classification === 'great') {
        headline = `${sideLabel} found the only winning move`;
      }

      keyMoments.push({
        ply: m.ply,
        moveNumber: m.moveNumber,
        color: m.color,
        san: m.san,
        classification: m.classification,
        bestMoveUci: m.bestMoveBefore,
        swing,
        headline,
      });
    }
  }

  // Sort by biggest swing first and keep top 5
  keyMoments.sort((a, b) => b.swing - a.swing);
  const topMoments = keyMoments.slice(0, 5);

  let summaryHeadline = 'Run Stockfish Match Rating to grade every move.';
  if (analyzedPlies > 0) {
    const bothRated = white.accuracy !== null && black.accuracy !== null;
    if (!bothRated) {
      summaryHeadline = 'Brief opening sample analyzed — play more moves for a full match rating.';
    } else if (white.accuracy! >= 90 && black.accuracy! >= 90) {
      summaryHeadline = 'Master-level battle with razor-sharp accuracy from both sides.';
    } else if (white.accuracy! - black.accuracy! >= 12 && resolvedResult !== '0-1') {
      summaryHeadline = 'White controlled the game with cleaner calculation and fewer errors.';
    } else if (black.accuracy! - white.accuracy! >= 12 && resolvedResult !== '1-0') {
      summaryHeadline = 'Black outplayed White with sharper tactical precision.';
    } else if (white.counts.blunder + black.counts.blunder >= 3) {
      summaryHeadline = 'Wild tactical clash decided by critical late-game turning points.';
    } else if (resolvedResult === '1-0') {
      summaryHeadline = 'White converted key moments cleanly to claim the victory.';
    } else if (resolvedResult === '0-1') {
      summaryHeadline = 'Black capitalized on critical chances to secure the win.';
    } else {
      summaryHeadline = 'Balanced contest with solid opening play and key middlegame decisions.';
    }
  }

  return {
    isComplete: safeMoves.length > 0 && analyzedPlies === safeMoves.length,
    analyzedPlies,
    totalPlies: safeMoves.length,
    white,
    black,
    keyMoments: topMoments,
    summaryHeadline,
  };
}

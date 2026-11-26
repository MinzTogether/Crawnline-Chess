import type { Color } from 'chess.js';
import type { MoveClassification, MoveRecord } from '../types/chess';
import { calculateAverageAccuracy, evalToWhiteWinProbability } from './uciParser';

export interface PlayerMatchStats {
  accuracy: number | null;
  estimatedElo: number | null;
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | '—';
  counts: Record<MoveClassification, number>;
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

/**
 * Estimates a Chess.com-style Game Rating (Elo) from CAPS accuracy and error rate.
 * Range: 400 to 2900 Elo.
 */
export function estimateGameElo(accuracy: number | null, counts: Record<MoveClassification, number>): number | null {
  if (accuracy === null) return null;

  // Base curve mapped closely to Chess.com Game Review Elo expectations
  // 50% -> ~750, 70% -> ~1300, 80% -> ~1700, 88% -> ~2050, 95% -> ~2480, 99% -> ~2800
  let elo: number;
  if (accuracy >= 95) {
    elo = 2450 + (accuracy - 95) * 90;
  } else if (accuracy >= 85) {
    elo = 1900 + (accuracy - 85) * 55;
  } else if (accuracy >= 70) {
    elo = 1280 + (accuracy - 70) * 41.3;
  } else {
    elo = 400 + Math.max(0, accuracy - 25) * 19.5;
  }

  // Slight adjustment for blunders vs great/brilliant moves
  elo -= counts.blunder * 75;
  elo -= counts.mistake * 25;
  elo += (counts.great + counts.brilliant) * 40;

  const clamped = Math.max(400, Math.min(2900, elo));
  return Math.round(clamped / 50) * 50;
}

export function accuracyToGrade(accuracy: number | null): 'S' | 'A' | 'B' | 'C' | 'D' | '—' {
  if (accuracy === null) return '—';
  if (accuracy >= 93) return 'S';
  if (accuracy >= 84) return 'A';
  if (accuracy >= 74) return 'B';
  if (accuracy >= 62) return 'C';
  return 'D';
}

function buildPlayerStats(moves: MoveRecord[], color: Color): PlayerMatchStats {
  const playerMoves = moves.filter((m) => m.color === color);
  const counts = emptyCounts();
  const allAcc: number[] = [];
  const openingAcc: number[] = [];
  const middleAcc: number[] = [];
  const endgameAcc: number[] = [];

  for (const m of playerMoves) {
    if (m.classification) {
      counts[m.classification] += 1;
    }
    if (typeof m.accuracy === 'number') {
      allAcc.push(m.accuracy);
      if (m.moveNumber <= 10) {
        openingAcc.push(m.accuracy);
      } else if (m.moveNumber <= 25) {
        middleAcc.push(m.accuracy);
      } else {
        endgameAcc.push(m.accuracy);
      }
    }
  }

  const accuracy = calculateAverageAccuracy(allAcc);
  return {
    accuracy,
    estimatedElo: estimateGameElo(accuracy, counts),
    grade: accuracyToGrade(accuracy),
    counts,
    openingAccuracy: calculateAverageAccuracy(openingAcc),
    middlegameAccuracy: calculateAverageAccuracy(middleAcc),
    endgameAccuracy: calculateAverageAccuracy(endgameAcc),
  };
}

/**
 * Generates a full Chess.com-style Match Rating report from analyzed moves.
 */
export function buildMatchRatingReport(moves: MoveRecord[]): MatchRatingReport {
  const analyzedPlies = moves.filter((m) => typeof m.accuracy === 'number').length;
  const white = buildPlayerStats(moves, 'w');
  const black = buildPlayerStats(moves, 'b');

  // Identify up to 5 Key Turning Points (blunders, mistakes, great/brilliant moves)
  const keyMoments: KeyMoment[] = [];
  for (let i = 0; i < moves.length; i++) {
    const m = moves[i];
    if (!m.classification) continue;

    const prevProb = i > 0 && moves[i - 1].evalAfter ? evalToWhiteWinProbability(moves[i - 1].evalAfter!) : 50;
    const afterProb = m.evalAfter ? evalToWhiteWinProbability(m.evalAfter) : prevProb;
    const swing = Math.abs(afterProb - prevProb);

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
        swing: Math.round(swing),
        headline,
      });
    }
  }

  // Sort by biggest swing first and keep top 5
  keyMoments.sort((a, b) => b.swing - a.swing);
  const topMoments = keyMoments.slice(0, 5);

  let summaryHeadline = 'Run Stockfish Match Rating to grade every move.';
  if (analyzedPlies > 0) {
    const wAcc = white.accuracy ?? 0;
    const bAcc = black.accuracy ?? 0;
    if (wAcc >= 90 && bAcc >= 90) {
      summaryHeadline = 'Master-level battle with razor-sharp accuracy from both sides.';
    } else if (wAcc - bAcc >= 12) {
      summaryHeadline = 'White controlled the game with cleaner calculation and fewer errors.';
    } else if (bAcc - wAcc >= 12) {
      summaryHeadline = 'Black outplayed White with sharper tactical precision.';
    } else if (white.counts.blunder + black.counts.blunder >= 3) {
      summaryHeadline = 'Wild tactical clash decided by critical late-game turning points.';
    } else {
      summaryHeadline = 'Balanced contest with solid opening play and key middlegame decisions.';
    }
  }

  return {
    isComplete: moves.length > 0 && analyzedPlies === moves.length,
    analyzedPlies,
    totalPlies: moves.length,
    white,
    black,
    keyMoments: topMoments,
    summaryHeadline,
  };
}

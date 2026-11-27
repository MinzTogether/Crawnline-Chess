import type { GameTermination, MoveRecord } from '../types/chess';
import { buildMatchRatingReport } from '../engine/matchRating';
import { getMaterialSummary } from './chessLogic';

export type SideOutcome = 'win' | 'loss' | 'draw';

export interface SideGameOverStats {
  outcome: SideOutcome;
  movesCount: number;
  captures: number;
  checks: number;
  materialBalance: number;
  accuracy: number | null;
  estimatedElo: number | null;
  strongMoves: number;
  errors: number;
}

export interface GameOverSummary {
  scoreLabel: '1 - 0' | '0 - 1' | '½ - ½' | '*';
  totalFullMoves: number;
  white: SideGameOverStats;
  black: SideGameOverStats;
}

export function buildGameOverSummary(
  moves: MoveRecord[],
  finalFen: string,
  termination: GameTermination
): GameOverSummary {
  const report = buildMatchRatingReport(moves, { result: termination.resultString });

  let materialAdvantage = 0;
  try {
    materialAdvantage = getMaterialSummary(finalFen, { moves }).advantage;
  } catch {
    materialAdvantage = 0;
  }

  let whiteMoves = 0;
  let blackMoves = 0;
  let whiteCaptures = 0;
  let blackCaptures = 0;
  let whiteChecks = 0;
  let blackChecks = 0;

  for (const m of moves) {
    const isCheck = m.san.includes('+') || m.san.includes('#');
    if (m.color === 'w') {
      whiteMoves += 1;
      if (m.captured) whiteCaptures += 1;
      if (isCheck) whiteChecks += 1;
    } else {
      blackMoves += 1;
      if (m.captured) blackCaptures += 1;
      if (isCheck) blackChecks += 1;
    }
  }

  const whiteOutcome: SideOutcome =
    termination.winner === 'w' ? 'win' : termination.winner === 'b' ? 'loss' : 'draw';
  const blackOutcome: SideOutcome =
    termination.winner === 'b' ? 'win' : termination.winner === 'w' ? 'loss' : 'draw';

  const scoreLabel: GameOverSummary['scoreLabel'] =
    termination.winner === 'w'
      ? '1 - 0'
      : termination.winner === 'b'
        ? '0 - 1'
        : termination.winner === 'draw'
          ? '½ - ½'
          : '*';

  const wCounts = report.white.counts;
  const bCounts = report.black.counts;

  return {
    scoreLabel,
    totalFullMoves: Math.ceil(moves.length / 2),
    white: {
      outcome: whiteOutcome,
      movesCount: whiteMoves,
      captures: whiteCaptures,
      checks: whiteChecks,
      materialBalance: materialAdvantage,
      accuracy: report.white.accuracy,
      estimatedElo: report.white.estimatedElo,
      strongMoves: wCounts.brilliant + wCounts.great + wCounts.best + wCounts.excellent,
      errors: wCounts.inaccuracy + wCounts.mistake + wCounts.blunder,
    },
    black: {
      outcome: blackOutcome,
      movesCount: blackMoves,
      captures: blackCaptures,
      checks: blackChecks,
      materialBalance: -materialAdvantage,
      accuracy: report.black.accuracy,
      estimatedElo: report.black.estimatedElo,
      strongMoves: bCounts.brilliant + bCounts.great + bCounts.best + bCounts.excellent,
      errors: bCounts.inaccuracy + bCounts.mistake + bCounts.blunder,
    },
  };
}

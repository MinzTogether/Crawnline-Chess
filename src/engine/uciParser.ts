import type { Color } from 'chess.js';
import type { EngineLine, EvalScore, MoveClassification } from '../types/chess';

/**
 * Parses a Stockfish UCI `info` line into structured evaluation data.
 * Scores are normalized strictly to White's perspective (+ favors White, - favors Black).
 */
export function parseUciInfoLine(line: string, sideToMove: Color): EngineLine | null {
  if (!line.startsWith('info ')) return null;
  // Ignore pure currmove / string telemetry lines without score & pv
  if (!line.includes(' score ') || !line.includes(' pv ')) return null;
  // Ignore aspiration-window lowerbound / upperbound intermediate lines that cause eval bar spikes
  if (line.includes(' lowerbound ') || line.includes(' upperbound ')) return null;

  const tokens = line.trim().split(/\s+/);
  let depth = 0;
  let seldepth = 0;
  let multipv = 1;
  let nodes = 0;
  let nps = 0;
  let scoreType: 'cp' | 'mate' | null = null;
  let rawScore = 0;
  let pvIndex = -1;

  for (let i = 1; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok === 'depth' && i + 1 < tokens.length) {
      depth = parseInt(tokens[++i], 10) || 0;
    } else if (tok === 'seldepth' && i + 1 < tokens.length) {
      seldepth = parseInt(tokens[++i], 10) || 0;
    } else if (tok === 'multipv' && i + 1 < tokens.length) {
      multipv = parseInt(tokens[++i], 10) || 1;
    } else if (tok === 'nodes' && i + 1 < tokens.length) {
      nodes = parseInt(tokens[++i], 10) || 0;
    } else if (tok === 'nps' && i + 1 < tokens.length) {
      nps = parseInt(tokens[++i], 10) || 0;
    } else if (tok === 'score' && i + 2 < tokens.length) {
      const kind = tokens[++i];
      if (kind === 'cp' || kind === 'mate') {
        scoreType = kind;
        rawScore = parseInt(tokens[++i], 10) || 0;
      }
    } else if (tok === 'pv') {
      pvIndex = i + 1;
      break;
    }
  }

  if (!scoreType || pvIndex === -1 || pvIndex >= tokens.length) {
    return null;
  }

  const pvUci = tokens.slice(pvIndex).filter((t) => /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(t));
  if (pvUci.length === 0) return null;

  // Stockfish reports scores from side-to-move's perspective. Flip when Black is to move.
  const perspectiveSign = sideToMove === 'w' ? 1 : -1;
  const normalizedValue = rawScore * perspectiveSign;

  return {
    multipv,
    depth,
    seldepth: seldepth || depth,
    score: {
      type: scoreType,
      value: normalizedValue,
    },
    nodes,
    nps,
    pvUci,
    pvSan: [],
  };
}

/**
 * Parses a Stockfish `bestmove <move> [ponder <move>]` line.
 */
export function parseBestMoveLine(line: string): { bestMove: string | null; ponder: string | null } | null {
  if (!line.startsWith('bestmove ')) return null;
  const tokens = line.trim().split(/\s+/);
  const best = tokens[1] && tokens[1] !== '(none)' ? tokens[1] : null;
  let ponder: string | null = null;
  const ponderIdx = tokens.indexOf('ponder');
  if (ponderIdx !== -1 && tokens[ponderIdx + 1] && tokens[ponderIdx + 1] !== '(none)') {
    ponder = tokens[ponderIdx + 1];
  }
  return { bestMove: best, ponder };
}

/**
 * Computes White's expected winning percentage (0 to 100) using the standard logistic win-probability curve.
 */
export function evalToWhiteWinProbability(score: EvalScore): number {
  if (score.type === 'mate') {
    if (score.value > 0) return 100;
    if (score.value < 0) return 0;
    return 50;
  }
  const clampedCp = Math.max(-1500, Math.min(1500, score.value));
  const prob = 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * clampedCp)) - 1);
  return Math.max(0, Math.min(100, prob));
}

/**
 * Converts an EvalScore into a visual percentage for the vertical Evaluation Bar (White's fill height).
 */
export function evalToBarPercent(score: EvalScore | null | undefined): number {
  if (!score) return 50;
  if (score.type === 'mate') {
    if (score.value > 0) return 100;
    if (score.value < 0) return 0;
    return 50;
  }
  const wp = evalToWhiteWinProbability(score);
  return Math.max(4, Math.min(96, wp));
}

/**
 * Formats an EvalScore for clean display (e.g. "+0.4", "-2.1", "M3", "-M2", "0.0").
 */
export function formatEvalScore(score: EvalScore | null | undefined, precise = false, compact = false): string {
  if (!score) return '0.0';
  if (score.type === 'mate') {
    if (score.value === 0) return '#';
    const prefix = score.value > 0 ? 'M' : '-M';
    return `${prefix}${Math.abs(score.value)}`;
  }
  const pawns = score.value / 100;
  if (Math.abs(pawns) < 0.05) return '0.0';
  const sign = pawns > 0 ? '+' : '';
  if (precise) {
    return `${sign}${pawns.toFixed(2)}`;
  }
  if (compact && Math.abs(pawns) >= 9.95) {
    return `${sign}${Math.round(pawns)}`;
  }
  const rounded = Math.round(pawns * 10) / 10;
  return `${sign}${rounded.toFixed(1)}`;
}

/**
 * Classifies a played move using win-probability delta from the mover's perspective,
 * matching Chess.com / Lichess analytical thresholds.
 */
export function classifyMove(params: {
  evalBefore: EvalScore;
  evalAfter: EvalScore;
  mover: Color;
  playedUci: string;
  bestUci?: string | null;
  isBook?: boolean;
  isSacrifice?: boolean;
}): { classification: MoveClassification; accuracy: number; winProbLoss: number } {
  if (params.isBook) {
    return { classification: 'book', accuracy: 100, winProbLoss: 0 };
  }

  const whiteProbBefore = evalToWhiteWinProbability(params.evalBefore);
  const whiteProbAfter = evalToWhiteWinProbability(params.evalAfter);

  const moverProbBefore = params.mover === 'w' ? whiteProbBefore : 100 - whiteProbBefore;
  const moverProbAfter = params.mover === 'w' ? whiteProbAfter : 100 - whiteProbAfter;

  const winProbLoss = Math.max(0, moverProbBefore - moverProbAfter);
  const rawAccuracy = 103.1668 * Math.exp(-0.04354 * winProbLoss) - 3.1669;
  const accuracy = Math.max(0, Math.min(100, Math.round(rawAccuracy * 10) / 10));

  const isExactBest = Boolean(params.bestUci && params.playedUci === params.bestUci);

  if (isExactBest || winProbLoss <= 1.2) {
    // Award Brilliant for a strong tactical sacrifice that maintains or gains a winning edge
    if (params.isSacrifice && isExactBest && moverProbAfter >= 55 && moverProbBefore < 92) {
      return { classification: 'brilliant', accuracy: 100, winProbLoss: 0 };
    }
    // Reward turning a close/tough position into a decisive tactical gain with the exact best move
    if (isExactBest && moverProbBefore >= 35 && moverProbBefore <= 68 && moverProbAfter >= moverProbBefore + 8) {
      return { classification: 'great', accuracy: 100, winProbLoss: 0 };
    }
    return { classification: 'best', accuracy: Math.max(accuracy, 98), winProbLoss };
  }

  if (winProbLoss <= 3.5) {
    return { classification: 'excellent', accuracy, winProbLoss };
  }
  if (winProbLoss <= 7.5) {
    return { classification: 'good', accuracy, winProbLoss };
  }
  if (winProbLoss <= 14) {
    return { classification: 'inaccuracy', accuracy, winProbLoss };
  }
  if (winProbLoss <= 24) {
    return { classification: 'mistake', accuracy, winProbLoss };
  }
  return { classification: 'blunder', accuracy, winProbLoss };
}

/**
 * Computes average player accuracy across classified moves (0..100).
 */
export function calculateAverageAccuracy(accuracies: number[]): number | null {
  if (accuracies.length === 0) return null;
  const sum = accuracies.reduce((acc, v) => acc + v, 0);
  return Math.round((sum / accuracies.length) * 10) / 10;
}

/**
 * Formats large node counts cleanly (e.g. 1.4M, 420k).
 */
export function formatNodes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

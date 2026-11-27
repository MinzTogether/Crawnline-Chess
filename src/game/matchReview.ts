import { Chess } from 'chess.js';
import type { EvalScore, MoveRecord } from '../types/chess';
import type { EvaluateOnceResult } from '../engine/stockfishService';
import { classifyMove } from '../engine/uciParser';
import { isTacticalPieceSacrifice } from './chessLogic';
import { detectOpening } from './openings';

export type SinglePositionEvaluation = EvaluateOnceResult;

export interface MatchReviewPassParams {
  initialFen: string;
  /** Optional Shredder-FEN for Chess960 initial position evaluation */
  initialEngineFen?: string;
  moves: MoveRecord[];
  isStandardVariant: boolean;
  depth?: number;
  evaluatePosition: (
    fen: string,
    depth: number,
    engineFen?: string
  ) => Promise<SinglePositionEvaluation>;
  isCancelled: () => boolean;
  onMoveReviewed?: (payload: {
    reviewedMoves: MoveRecord[];
    progressPct: number;
    fen: string;
    engineFen: string;
    score: EvalScore;
    depth: number;
  }) => void;
}

export interface MatchReviewPassResult {
  completed: boolean;
  cancelled: boolean;
  error: string | null;
  reviewedMoves: MoveRecord[];
}

function getTerminalScoreIfGameOver(fen: string): { score: EvalScore; bestMove: null } | null {
  try {
    const chess = new Chess(fen);
    if (!chess.isGameOver()) return null;
    if (chess.isCheckmate()) {
      return {
        score: { type: 'mate', value: chess.turn() === 'w' ? -1 : 1 },
        bestMove: null,
      };
    }
    return {
      score: { type: 'cp', value: 0 },
      bestMove: null,
    };
  } catch {
    return null;
  }
}

/**
 * Runs a full Stockfish game review across a move list with cooperative cancellation checks
 * before and after every asynchronous evaluation call. Never records fake evaluations when
 * the engine fails, times out, or is cancelled.
 */
export async function executeMatchReviewPass({
  initialFen,
  initialEngineFen,
  moves,
  isStandardVariant,
  depth = 10,
  evaluatePosition,
  isCancelled,
  onMoveReviewed,
}: MatchReviewPassParams): Promise<MatchReviewPassResult> {
  if (moves.length === 0) {
    return { completed: true, cancelled: false, error: null, reviewedMoves: [] };
  }

  const reviewed: MoveRecord[] = [...moves];
  if (isCancelled()) {
    return { completed: false, cancelled: true, error: null, reviewedMoves: reviewed };
  }

  let prevEval: { score: EvalScore; bestMove: string | null };
  const initialTerminal = getTerminalScoreIfGameOver(initialFen);
  if (initialTerminal) {
    prevEval = initialTerminal;
  } else {
    let initialRes: SinglePositionEvaluation;
    try {
      initialRes = await evaluatePosition(initialFen, depth, initialEngineFen ?? initialFen);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Engine evaluation failed';
      return {
        completed: false,
        cancelled: isCancelled(),
        error: isCancelled() ? null : msg,
        reviewedMoves: reviewed,
      };
    }

    if (isCancelled() || initialRes.status === 'cancelled') {
      return { completed: false, cancelled: true, error: null, reviewedMoves: reviewed };
    }
    if (initialRes.status !== 'completed') {
      return {
        completed: false,
        cancelled: false,
        error: initialRes.error,
        reviewedMoves: reviewed,
      };
    }
    prevEval = { score: initialRes.score, bestMove: initialRes.bestMove };
  }

  for (let i = 0; i < reviewed.length; i++) {
    if (isCancelled()) {
      return { completed: false, cancelled: true, error: null, reviewedMoves: reviewed };
    }

    const move = reviewed[i];
    const moveEngineFen = move.engineFenAfter ?? move.fenAfter;
    let afterEval: { score: EvalScore; bestMove: string | null };
    const terminalAfter = getTerminalScoreIfGameOver(move.fenAfter);

    if (terminalAfter) {
      afterEval = terminalAfter;
    } else {
      let afterRes: SinglePositionEvaluation;
      try {
        afterRes = await evaluatePosition(move.fenAfter, depth, moveEngineFen);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Engine evaluation failed';
        return {
          completed: false,
          cancelled: isCancelled(),
          error: isCancelled() ? null : msg,
          reviewedMoves: reviewed,
        };
      }

      if (isCancelled() || afterRes.status === 'cancelled') {
        return { completed: false, cancelled: true, error: null, reviewedMoves: reviewed };
      }
      if (afterRes.status !== 'completed') {
        return {
          completed: false,
          cancelled: false,
          error: afterRes.error,
          reviewedMoves: reviewed,
        };
      }
      afterEval = { score: afterRes.score, bestMove: afterRes.bestMove };
    }

    const isBook =
      isStandardVariant &&
      i < 6 &&
      Boolean(detectOpening(reviewed.slice(0, i + 1).map((x) => x.san)));

    const classified = classifyMove({
      evalBefore: prevEval.score,
      evalAfter: afterEval.score,
      mover: move.color,
      playedUci: move.uci,
      bestUci: prevEval.bestMove,
      isBook,
      isSacrifice: isTacticalPieceSacrifice(move),
    });

    reviewed[i] = {
      ...move,
      bestMoveBefore: prevEval.bestMove ?? move.bestMoveBefore,
      evalAfter: afterEval.score,
      classification: classified.classification,
      accuracy: classified.accuracy,
    };

    prevEval = afterEval;
    const progressPct = Math.round(((i + 1) / reviewed.length) * 100);
    onMoveReviewed?.({
      reviewedMoves: [...reviewed],
      progressPct,
      fen: move.fenAfter,
      engineFen: moveEngineFen,
      score: afterEval.score,
      depth,
    });
  }

  return {
    completed: !isCancelled(),
    cancelled: isCancelled(),
    error: null,
    reviewedMoves: reviewed,
  };
}

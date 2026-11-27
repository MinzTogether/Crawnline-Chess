import type { Color } from 'chess.js';

export interface ClockState {
  /** Remaining seconds for White at the moment turnStartedAtMs was anchored */
  w: number;
  /** Remaining seconds for Black at the moment turnStartedAtMs was anchored */
  b: number;
  /** Side whose clock is currently running (when turnStartedAtMs !== null) */
  activeTurn: Color;
  /** Wall-clock timestamp (ms) when the current active turn started ticking, or null if paused/stopped */
  turnStartedAtMs: number | null;
}

export interface ClockDisplay {
  w: number;
  b: number;
  expiredColor: Color | null;
}

/**
 * Creates an initial clock snapshot. Pass a non-null `nowMs` to start ticking immediately.
 */
export function createClockState(
  initialSeconds: number,
  activeTurn: Color,
  nowMs: number | null
): ClockState {
  const clamped = Math.max(0, initialSeconds);
  return {
    w: clamped,
    b: clamped,
    activeTurn,
    turnStartedAtMs: nowMs,
  };
}

/**
 * Computes exact remaining seconds for both sides using elapsed wall-clock time
 * (`nowMs - turnStartedAtMs`) rather than fixed interval decrements.
 */
export function getClockRemaining(state: ClockState, nowMs: number): ClockDisplay {
  if (state.turnStartedAtMs === null) {
    const w = Math.max(0, state.w);
    const b = Math.max(0, state.b);
    return {
      w,
      b,
      expiredColor: w <= 0 ? 'w' : b <= 0 ? 'b' : null,
    };
  }

  const elapsedSec = Math.max(0, (nowMs - state.turnStartedAtMs) / 1000);
  const w = state.activeTurn === 'w' ? Math.max(0, state.w - elapsedSec) : Math.max(0, state.w);
  const b = state.activeTurn === 'b' ? Math.max(0, state.b - elapsedSec) : Math.max(0, state.b);

  let expiredColor: Color | null = null;
  if (state.activeTurn === 'w' && w <= 0) {
    expiredColor = 'w';
  } else if (state.activeTurn === 'b' && b <= 0) {
    expiredColor = 'b';
  }

  return { w, b, expiredColor };
}

/**
 * Commits elapsed time up to `nowMs` and pauses the clock so resuming does not lose or gain time.
 */
export function pauseClockState(state: ClockState, nowMs: number): ClockState {
  const remaining = getClockRemaining(state, nowMs);
  return {
    w: remaining.w,
    b: remaining.b,
    activeTurn: state.activeTurn,
    turnStartedAtMs: null,
  };
}

/**
 * Anchors the active player's turn start timestamp at `nowMs` to resume ticking cleanly.
 */
export function resumeClockState(state: ClockState, activeTurn: Color, nowMs: number): ClockState {
  const base = state.turnStartedAtMs !== null ? pauseClockState(state, nowMs) : state;
  return {
    w: base.w,
    b: base.b,
    activeTurn,
    turnStartedAtMs: nowMs,
  };
}

export interface PreMoveClockCheck {
  allowed: boolean;
  expiredColor: Color | null;
  nextState: ClockState;
}

/**
 * Verifies BEFORE committing a move that the moving side still has time remaining.
 * If the mover's clock has already expired (e.g. between UI ticks or after tab throttling),
 * the move is rejected and the clock is paused at 0 for the flagged side without increment.
 */
export function checkClockBeforeMove(
  state: ClockState,
  movingColor: Color,
  nowMs: number
): PreMoveClockCheck {
  const remaining = getClockRemaining(state, nowMs);
  const moverRemaining = movingColor === 'w' ? remaining.w : remaining.b;

  if (moverRemaining <= 0 || remaining.expiredColor === movingColor) {
    return {
      allowed: false,
      expiredColor: movingColor,
      nextState: {
        w: movingColor === 'w' ? 0 : remaining.w,
        b: movingColor === 'b' ? 0 : remaining.b,
        activeTurn: state.activeTurn,
        turnStartedAtMs: null,
      },
    };
  }

  return {
    allowed: true,
    expiredColor: null,
    nextState: state,
  };
}

/**
 * Commits elapsed time on the mover's clock when a move is played, applies increment if not flagged,
 * and starts the opponent's turn timestamp immediately at `nowMs` (unless the game ended).
 */
export function commitMoveClock(
  state: ClockState,
  movedColor: Color,
  nextTurn: Color,
  incrementSec: number,
  nowMs: number,
  gameEnded = false
): { nextState: ClockState; expiredColor: Color | null } {
  const remaining = getClockRemaining(state, nowMs);
  const movedRemaining = movedColor === 'w' ? remaining.w : remaining.b;

  if (movedRemaining <= 0) {
    return {
      nextState: {
        w: movedColor === 'w' ? 0 : remaining.w,
        b: movedColor === 'b' ? 0 : remaining.b,
        activeTurn: movedColor,
        turnStartedAtMs: null,
      },
      expiredColor: movedColor,
    };
  }

  const inc = Math.max(0, incrementSec);
  const nextW = movedColor === 'w' ? remaining.w + inc : remaining.w;
  const nextB = movedColor === 'b' ? remaining.b + inc : remaining.b;

  return {
    nextState: {
      w: nextW,
      b: nextB,
      activeTurn: nextTurn,
      turnStartedAtMs: gameEnded ? null : nowMs,
    },
    expiredColor: null,
  };
}

/**
 * Quantizes exact remaining seconds to the display resolution used by `formatClock`:
 * - 1-second steps when >= 10s (prevents 10Hz React re-renders while keeping ms precision in ClockState)
 * - 0.1-second steps when 0 < seconds < 10s for smooth final time-scramble countdown
 */
export function quantizeClockDisplay(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  if (seconds < 10) {
    return Math.round(seconds * 10) / 10;
  }
  return Math.floor(seconds);
}

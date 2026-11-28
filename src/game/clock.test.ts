import test from 'node:test';
import assert from 'node:assert/strict';
import type { Square } from 'chess.js';
import {
  checkClockBeforeMove,
  commitMoveClock,
  createClockState,
  getClockRemaining,
  pauseClockState,
  quantizeClockDisplay,
  resumeClockState,
  type ClockState,
} from './clock';
import { applyRuleMove, evaluateGameTermination } from './chessLogic';
import type { MoveRecord } from '../types/chess';

test('clock starts ticking immediately when entering playing at ply 0 using exact timestamps', () => {
  const t0 = 1_000_000;
  const state = createClockState(300, 'w', t0);

  // After an irregular 2.35s delay (e.g., throttled timer or background tab), elapsed is exact
  const after2350ms = getClockRemaining(state, t0 + 2350);
  assert.equal(after2350ms.w, 297.65);
  assert.equal(after2350ms.b, 300);
  assert.equal(after2350ms.expiredColor, null);

  // Even a large 45.7s jump computes exact remaining without relying on 100ms ticks
  const after45700ms = getClockRemaining(state, t0 + 45700);
  assert.equal(after45700ms.w, 254.3);
  assert.equal(after45700ms.b, 300);
});

test('commitMoveClock deducts elapsed time, applies increment, and anchors next turn timestamp', () => {
  const t0 = 2_000_000;
  const initial = createClockState(180, 'w', t0);

  // White thinks 4.5s and plays move with +2s increment
  const move1 = commitMoveClock(initial, 'w', 'b', 2, t0 + 4500, false);
  assert.equal(move1.expiredColor, null);
  assert.equal(move1.nextState.w, 177.5);
  assert.equal(move1.nextState.b, 180);
  assert.equal(move1.nextState.activeTurn, 'b');
  assert.equal(move1.nextState.turnStartedAtMs, t0 + 4500);

  // Black thinks 10.25s
  const duringBlack = getClockRemaining(move1.nextState, t0 + 4500 + 10250);
  assert.equal(duringBlack.w, 177.5);
  assert.equal(duringBlack.b, 169.75);
});

test('pauseClockState and resumeClockState preserve exact remaining time with zero drift', () => {
  const t0 = 5_000_000;
  const running = createClockState(60, 'w', t0);

  // Pause after 7.2s
  const paused = pauseClockState(running, t0 + 7200);
  assert.equal(paused.w, 52.8);
  assert.equal(paused.turnStartedAtMs, null);

  // 30 seconds pass while paused -> remaining time must NOT change
  const whilePaused = getClockRemaining(paused, t0 + 37200);
  assert.equal(whilePaused.w, 52.8);

  // Resume at t0 + 37200, then check 3.8s later
  const resumed = resumeClockState(paused, 'w', t0 + 37200);
  const afterResume = getClockRemaining(resumed, t0 + 41000);
  assert.equal(Math.round(afterResume.w * 100) / 100, 49);
});

test('clock flags active player cleanly when timestamp exceeds remaining time', () => {
  const t0 = 9_000_000;
  const state = createClockState(10, 'b', t0);

  const flagged = getClockRemaining(state, t0 + 12_500);
  assert.equal(flagged.b, 0);
  assert.equal(flagged.w, 10);
  assert.equal(flagged.expiredColor, 'b');
});

test('quantizeClockDisplay buckets >=10s to whole seconds and <10s to tenths', () => {
  assert.equal(quantizeClockDisplay(299.94), 299);
  assert.equal(quantizeClockDisplay(299.05), 299);
  assert.equal(quantizeClockDisplay(10.01), 10);
  assert.equal(quantizeClockDisplay(9.94), 9.9);
  assert.equal(quantizeClockDisplay(0.14), 0.1);
  assert.equal(quantizeClockDisplay(0), 0);
  assert.equal(quantizeClockDisplay(-2.5), 0);
  assert.equal(quantizeClockDisplay(Number.NaN), 0);
});

test('checkClockBeforeMove rejects move when mover clock expired between ticks and pauses clock at 0', () => {
  const t0 = 10_000_000;
  const running = createClockState(5, 'w', t0);

  // White attempts a move 5.25s later (250ms after flagging, before next timer tick)
  const check = checkClockBeforeMove(running, 'w', t0 + 5250);
  assert.equal(check.allowed, false);
  assert.equal(check.expiredColor, 'w');
  assert.equal(check.nextState.w, 0);
  assert.equal(check.nextState.b, 5);
  assert.equal(check.nextState.turnStartedAtMs, null);
});

test('checkClockBeforeMove allows move when mover still has positive time left', () => {
  const t0 = 11_000_000;
  const running = createClockState(5, 'w', t0);

  // White moves with 50ms remaining -> allowed
  const check = checkClockBeforeMove(running, 'w', t0 + 4950);
  assert.equal(check.allowed, true);
  assert.equal(check.expiredColor, null);
});

test('commitMoveClock does not award increment when mover has already flagged on time', () => {
  const t0 = 12_000_000;
  const running = createClockState(3, 'b', t0);

  // Black tries to move after 3.4s with a +5s increment time control
  const res = commitMoveClock(running, 'b', 'w', 5, t0 + 3400, false);
  assert.equal(res.expiredColor, 'b');
  assert.equal(res.nextState.b, 0);
  assert.equal(res.nextState.w, 3);
  assert.equal(res.nextState.activeTurn, 'b');
  assert.equal(res.nextState.turnStartedAtMs, null);
});

test('multi-turn timeout flow rejects Black move after flagging while preserving White clock', () => {
  const t0 = 15_000_000;
  const initial = createClockState(10, 'w', t0);

  // White moves after 2.0s with +1s increment -> White has 9.0s, Black starts ticking at t0 + 2000
  const whiteCheck = checkClockBeforeMove(initial, 'w', t0 + 2000);
  assert.equal(whiteCheck.allowed, true);
  const afterWhite = commitMoveClock(initial, 'w', 'b', 1, t0 + 2000, false);
  assert.equal(afterWhite.expiredColor, null);
  assert.equal(afterWhite.nextState.w, 9);
  assert.equal(afterWhite.nextState.b, 10);

  // Black thinks for 10.1s -> Black's pre-move check MUST reject the move before commit
  const blackCheck = checkClockBeforeMove(afterWhite.nextState, 'b', t0 + 12_100);
  assert.equal(blackCheck.allowed, false);
  assert.equal(blackCheck.expiredColor, 'b');
  assert.equal(blackCheck.nextState.w, 9);
  assert.equal(blackCheck.nextState.b, 0);
  assert.equal(blackCheck.nextState.turnStartedAtMs, null);
});

test('clock timeout exact 0ms boundary flags cleanly, backward system clock skew never adds free time, and gameEnded freezes clock', () => {
  const t0 = 20_000_000;
  const running = createClockState(5, 'w', t0);

  // Exact boundary: elapsed === remaining (5000ms on a 5s clock) MUST flag, NOT allow
  const atZero = getClockRemaining(running, t0 + 5000);
  assert.equal(atZero.w, 0);
  assert.equal(atZero.expiredColor, 'w');

  const preMoveAtZero = checkClockBeforeMove(running, 'w', t0 + 5000);
  assert.equal(preMoveAtZero.allowed, false);
  assert.equal(preMoveAtZero.expiredColor, 'w');
  assert.equal(preMoveAtZero.nextState.turnStartedAtMs, null);

  // Backward system clock jump (e.g. NTP adjustment -1500ms) clamps elapsed to 0 and never grants extra time
  const skewed = getClockRemaining(running, t0 - 1500);
  assert.equal(skewed.w, 5);
  assert.equal(skewed.b, 5);
  assert.equal(skewed.expiredColor, null);

  const skewedCommit = commitMoveClock(running, 'w', 'b', 0, t0 - 1500, false);
  assert.equal(skewedCommit.expiredColor, null);
  assert.equal(skewedCommit.nextState.w, 5);
  assert.equal(skewedCommit.nextState.activeTurn, 'b');

  // Committing a game-ending move freezes the clock immediately (turnStartedAtMs === null)
  const gameOverCommit = commitMoveClock(running, 'w', 'b', 2, t0 + 1200, true);
  assert.equal(gameOverCommit.expiredColor, null);
  assert.equal(gameOverCommit.nextState.w, 5.8); // 5 - 1.2 + 2 = 5.8
  assert.equal(gameOverCommit.nextState.turnStartedAtMs, null);
  // Time passing after game ends MUST NOT drain either player's clock
  const longAfterEnd = getClockRemaining(gameOverCommit.nextState, t0 + 999_999);
  assert.equal(longAfterEnd.w, 5.8);
  assert.equal(longAfterEnd.b, 5);
  assert.equal(longAfterEnd.expiredColor, null);
});

test('move commit ordering enforces clock-check -> rule-validation -> board-commit -> clock-commit invariants', () => {
  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  interface MatchState {
    initialFen: string;
    fen: string;
    moves: MoveRecord[];
    clock: ClockState;
    incrementSec: number;
    timedOutBy: 'w' | 'b' | null;
  }

  function attemptOrderedMove(
    state: MatchState,
    from: Square,
    to: Square,
    nowMs: number
  ): { committed: boolean; reason: 'ok' | 'timeout' | 'illegal'; next: MatchState } {
    const mover = (state.fen.split(' ')[1] as 'w' | 'b') ?? 'w';

    // Step 1: Verify clock BEFORE applying move to board
    const preCheck = checkClockBeforeMove(state.clock, mover, nowMs);
    if (!preCheck.allowed) {
      return {
        committed: false,
        reason: 'timeout',
        next: {
          ...state,
          clock: preCheck.nextState,
          timedOutBy: preCheck.expiredColor,
        },
      };
    }

    // Step 2: Validate and apply chess rules BEFORE committing clock/increment
    const moveRes = applyRuleMove({
      initialFen: state.initialFen,
      moves: state.moves,
      from,
      to,
      allowCastling: true,
    });
    if (!moveRes) {
      return { committed: false, reason: 'illegal', next: state };
    }

    // Step 3: Append move record and evaluate termination
    const nextMoves: MoveRecord[] = [
      ...state.moves,
      {
        ply: state.moves.length + 1,
        moveNumber: moveRes.moveNumber,
        color: moveRes.color,
        san: moveRes.san,
        uci: moveRes.uci,
        from: moveRes.from,
        to: moveRes.to,
        piece: moveRes.piece,
        captured: moveRes.captured,
        promotion: moveRes.promotion,
        fenBefore: moveRes.fenBefore,
        fenAfter: moveRes.fenAfter,
      },
    ];
    const term = evaluateGameTermination({
      fen: moveRes.fenAfter,
      initialFen: state.initialFen,
      moves: nextMoves,
      allowCastling: true,
    });

    // Step 4: Commit clock ONLY after valid board state is produced
    const nextTurn: 'w' | 'b' = moveRes.color === 'w' ? 'b' : 'w';
    const clockCommit = commitMoveClock(
      state.clock,
      moveRes.color,
      nextTurn,
      state.incrementSec,
      nowMs,
      term.isOver
    );

    return {
      committed: true,
      reason: 'ok',
      next: {
        ...state,
        fen: moveRes.fenAfter,
        moves: nextMoves,
        clock: clockCommit.nextState,
      },
    };
  }

  const t0 = 30_000_000;
  let match: MatchState = {
    initialFen: START_FEN,
    fen: START_FEN,
    moves: [],
    clock: createClockState(10, 'w', t0),
    incrementSec: 3,
    timedOutBy: null,
  };

  // Case 1: Illegal move (e2->e5) attempted with time left MUST NOT alter board, switch turns, or award increment
  const illegalAttempt = attemptOrderedMove(match, 'e2', 'e5', t0 + 1000);
  assert.equal(illegalAttempt.committed, false);
  assert.equal(illegalAttempt.reason, 'illegal');
  assert.equal(illegalAttempt.next.moves.length, 0);
  assert.equal(illegalAttempt.next.fen, START_FEN);
  assert.equal(illegalAttempt.next.clock.activeTurn, 'w');
  assert.equal(illegalAttempt.next.clock.w, 10);
  assert.equal(illegalAttempt.next.clock.turnStartedAtMs, t0);

  // Case 2: Fool's Mate — Black plays Qh4# with 100ms remaining -> Checkmate commits and freezes clock (NOT timeout)
  match = attemptOrderedMove(match, 'f2', 'f3', t0 + 1000).next; // W: 10-1+3 = 12, B starts at t0+1000
  match = attemptOrderedMove(match, 'e7', 'e5', t0 + 2000).next; // B: 10-1+3 = 12, W starts at t0+2000
  match = attemptOrderedMove(match, 'g2', 'g4', t0 + 3000).next; // W: 12-1+3 = 14, B starts at t0+3000
  const mateAttempt = attemptOrderedMove(match, 'd8', 'h4', t0 + 3000 + 11_900); // B has 100ms left!
  assert.equal(mateAttempt.committed, true);
  assert.equal(mateAttempt.reason, 'ok');
  assert.equal(mateAttempt.next.moves.length, 4);
  assert.equal(mateAttempt.next.moves[3].san, 'Qh4#');
  assert.equal(mateAttempt.next.clock.turnStartedAtMs, null);
  assert.equal(mateAttempt.next.timedOutBy, null);
  const mateTerm = evaluateGameTermination({
    fen: mateAttempt.next.fen,
    initialFen: START_FEN,
    moves: mateAttempt.next.moves,
    allowCastling: true,
  });
  assert.equal(mateTerm.isOver, true);
  assert.equal(mateTerm.winner, 'b');
  assert.equal(mateTerm.reason, 'Checkmate');

  // Case 3: Legal move attempted AFTER clock expired MUST be rejected BEFORE modifying board/history and award NO increment
  const expiredMatch: MatchState = {
    initialFen: START_FEN,
    fen: START_FEN,
    moves: [],
    clock: createClockState(5, 'w', t0),
    incrementSec: 10,
    timedOutBy: null,
  };
  const lateMove = attemptOrderedMove(expiredMatch, 'e2', 'e4', t0 + 5150);
  assert.equal(lateMove.committed, false);
  assert.equal(lateMove.reason, 'timeout');
  assert.equal(lateMove.next.moves.length, 0);
  assert.equal(lateMove.next.fen, START_FEN);
  assert.equal(lateMove.next.clock.w, 0);
  assert.equal(lateMove.next.clock.b, 5);
  assert.equal(lateMove.next.clock.turnStartedAtMs, null);
  assert.equal(lateMove.next.timedOutBy, 'w');
  const timeoutTerm = evaluateGameTermination({
    fen: lateMove.next.fen,
    timeoutLoser: lateMove.next.timedOutBy,
  });
  assert.equal(timeoutTerm.isOver, true);
  assert.equal(timeoutTerm.winner, 'b');
  assert.equal(timeoutTerm.reason, 'Black won on time');
});

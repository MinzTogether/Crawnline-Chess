import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkClockBeforeMove,
  commitMoveClock,
  createClockState,
  getClockRemaining,
  pauseClockState,
  quantizeClockDisplay,
  resumeClockState,
} from './clock';

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

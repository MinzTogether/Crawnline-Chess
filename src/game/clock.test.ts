import test from 'node:test';
import assert from 'node:assert/strict';
import {
  commitMoveClock,
  createClockState,
  getClockRemaining,
  pauseClockState,
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

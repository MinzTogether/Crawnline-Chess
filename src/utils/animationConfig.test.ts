import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ANIMATION_EASING_CURVES,
  PIECE_SPEED_MAX_MS,
  PIECE_SPEED_MIN_MS,
  UI_SPEED_MAX,
  UI_SPEED_MIN,
  clampPieceSpeedMs,
  clampUiSpeedMultiplier,
  getAnimationPresetPatch,
  resolveAnimationTokens,
} from './animationConfig';

test('clampPieceSpeedMs enforces valid bounds and handles non-finite numbers', () => {
  assert.equal(clampPieceSpeedMs(20), PIECE_SPEED_MIN_MS);
  assert.equal(clampPieceSpeedMs(999), PIECE_SPEED_MAX_MS);
  assert.equal(clampPieceSpeedMs(184.6), 185);
  assert.equal(clampPieceSpeedMs(Number.NaN), 185);
});

test('clampUiSpeedMultiplier enforces valid bounds and rounds to 2 decimals', () => {
  assert.equal(clampUiSpeedMultiplier(0.1), UI_SPEED_MIN);
  assert.equal(clampUiSpeedMultiplier(4.5), UI_SPEED_MAX);
  assert.equal(clampUiSpeedMultiplier(1.256), 1.26);
  assert.equal(clampUiSpeedMultiplier(Number.POSITIVE_INFINITY), 1);
});

test('getAnimationPresetPatch returns complete curated defaults for each preset', () => {
  const subtle = getAnimationPresetPatch('subtle');
  assert.equal(subtle.animationLevel, 'subtle');
  assert.equal(subtle.pieceSpeedMs, 115);
  assert.equal(subtle.animationEasing, 'ease-out');
  assert.equal(subtle.pieceLiftEffect, false);

  const expressive = getAnimationPresetPatch('expressive');
  assert.equal(expressive.animationLevel, 'expressive');
  assert.equal(expressive.animationEasing, 'spring');
  assert.equal(expressive.pieceLiftEffect, true);
  assert.equal(expressive.badgePopAnimation, true);
});

test('resolveAnimationTokens zeroes durations and disables channels when preset is off', () => {
  const tokens = resolveAnimationTokens({
    ...getAnimationPresetPatch('smooth'),
    animationLevel: 'off',
  });

  assert.equal(tokens.cssVars['--anim-mult'], '0');
  assert.equal(tokens.cssVars['--anim-piece-ms'], '0ms');
  assert.equal(tokens.cssVars['--anim-eval-ms'], '0ms');
  assert.equal(tokens.cssVars['--anim-piece-lift-scale'], '1');
  assert.equal(tokens.dataset.pieceMotion, 'off');
  assert.equal(tokens.dataset.badgeMotion, 'off');
  assert.equal(tokens.dataset.highlightMotion, 'off');
  assert.equal(tokens.dataset.evalMotion, 'off');
  assert.equal(tokens.dataset.uiTransitions, 'off');
  assert.equal(tokens.dataset.pieceLift, 'off');
});

test('resolveAnimationTokens respects fine-grained custom sliders, easing, and channel toggles', () => {
  const tokens = resolveAnimationTokens({
    animationLevel: 'smooth',
    pieceSpeedMs: 310,
    uiSpeedMultiplier: 1.5,
    animationEasing: 'spring',
    pieceLiftEffect: true,
    pieceMoveAnimation: true,
    badgePopAnimation: false,
    boardHighlightsAnimation: true,
    evalBarAnimation: false,
    uiTransitions: true,
  });

  assert.equal(tokens.cssVars['--anim-piece-ms'], '310ms');
  assert.equal(tokens.cssVars['--anim-mult'], '1.5');
  assert.equal(tokens.cssVars['--anim-eval-ms'], '0ms');
  assert.equal(tokens.cssVars['--anim-piece-ease'], ANIMATION_EASING_CURVES.spring);
  assert.equal(tokens.cssVars['--anim-piece-lift-scale'], '1.09');
  assert.equal(tokens.dataset.pieceMotion, 'on');
  assert.equal(tokens.dataset.badgeMotion, 'off');
  assert.equal(tokens.dataset.highlightMotion, 'on');
  assert.equal(tokens.dataset.evalMotion, 'off');
  assert.equal(tokens.dataset.pieceLift, 'on');
});

export type AnimationLevelId = 'off' | 'subtle' | 'smooth' | 'expressive';
export type AnimationEasingId = 'linear' | 'ease-out' | 'smooth' | 'spring';

export interface AnimationSettings {
  animationLevel: AnimationLevelId;
  pieceSpeedMs: number;
  uiSpeedMultiplier: number;
  animationEasing: AnimationEasingId;
  pieceLiftEffect: boolean;
  pieceMoveAnimation: boolean;
  badgePopAnimation: boolean;
  boardHighlightsAnimation: boolean;
  evalBarAnimation: boolean;
  uiTransitions: boolean;
}

export const PIECE_SPEED_MIN_MS = 60;
export const PIECE_SPEED_MAX_MS = 400;
export const UI_SPEED_MIN = 0.4;
export const UI_SPEED_MAX = 1.8;

export const ANIMATION_EASING_CURVES: Record<AnimationEasingId, string> = {
  linear: 'linear',
  'ease-out': 'cubic-bezier(0.0, 0.0, 0.2, 1)',
  smooth: 'cubic-bezier(0.16, 1, 0.3, 1)',
  spring: 'cubic-bezier(0.22, 1.32, 0.36, 1)',
};

export const ANIMATION_PRESET_DEFAULTS: Record<AnimationLevelId, Omit<AnimationSettings, 'animationLevel'>> = {
  off: {
    pieceSpeedMs: 60,
    uiSpeedMultiplier: 0.4,
    animationEasing: 'linear',
    pieceLiftEffect: false,
    pieceMoveAnimation: false,
    badgePopAnimation: false,
    boardHighlightsAnimation: false,
    evalBarAnimation: false,
    uiTransitions: false,
  },
  subtle: {
    pieceSpeedMs: 115,
    uiSpeedMultiplier: 0.65,
    animationEasing: 'ease-out',
    pieceLiftEffect: false,
    pieceMoveAnimation: true,
    badgePopAnimation: true,
    boardHighlightsAnimation: true,
    evalBarAnimation: true,
    uiTransitions: true,
  },
  smooth: {
    pieceSpeedMs: 185,
    uiSpeedMultiplier: 1.0,
    animationEasing: 'smooth',
    pieceLiftEffect: true,
    pieceMoveAnimation: true,
    badgePopAnimation: true,
    boardHighlightsAnimation: true,
    evalBarAnimation: true,
    uiTransitions: true,
  },
  expressive: {
    pieceSpeedMs: 255,
    uiSpeedMultiplier: 1.32,
    animationEasing: 'spring',
    pieceLiftEffect: true,
    pieceMoveAnimation: true,
    badgePopAnimation: true,
    boardHighlightsAnimation: true,
    evalBarAnimation: true,
    uiTransitions: true,
  },
};

export function clampPieceSpeedMs(value: number): number {
  if (!Number.isFinite(value)) return ANIMATION_PRESET_DEFAULTS.smooth.pieceSpeedMs;
  return Math.round(Math.min(PIECE_SPEED_MAX_MS, Math.max(PIECE_SPEED_MIN_MS, value)));
}

export function clampUiSpeedMultiplier(value: number): number {
  if (!Number.isFinite(value)) return ANIMATION_PRESET_DEFAULTS.smooth.uiSpeedMultiplier;
  const clamped = Math.min(UI_SPEED_MAX, Math.max(UI_SPEED_MIN, value));
  return Math.round(clamped * 100) / 100;
}

export function getAnimationPresetPatch(level: AnimationLevelId): AnimationSettings {
  return {
    animationLevel: level,
    ...ANIMATION_PRESET_DEFAULTS[level],
  };
}

export interface ResolvedAnimationTokens {
  cssVars: Record<string, string>;
  dataset: {
    animationLevel: AnimationLevelId;
    pieceMotion: 'on' | 'off';
    badgeMotion: 'on' | 'off';
    highlightMotion: 'on' | 'off';
    evalMotion: 'on' | 'off';
    uiTransitions: 'on' | 'off';
    pieceLift: 'on' | 'off';
  };
}

export function resolveAnimationTokens(settings: AnimationSettings): ResolvedAnimationTokens {
  const isOff = settings.animationLevel === 'off';
  const pieceMs = isOff ? 0 : clampPieceSpeedMs(settings.pieceSpeedMs);
  const uiMult = isOff ? 0 : clampUiSpeedMultiplier(settings.uiSpeedMultiplier);
  const easingCurve = ANIMATION_EASING_CURVES[settings.animationEasing] ?? ANIMATION_EASING_CURVES.smooth;
  const springCurve =
    settings.animationEasing === 'linear' || settings.animationEasing === 'ease-out'
      ? easingCurve
      : ANIMATION_EASING_CURVES.spring;
  const evalMs = isOff || !settings.evalBarAnimation ? 0 : Math.round(440 * uiMult);
  const liftActive = !isOff && settings.pieceMoveAnimation && settings.pieceLiftEffect;

  return {
    cssVars: {
      '--anim-mult': String(uiMult),
      '--anim-piece-ms': `${pieceMs}ms`,
      '--anim-eval-ms': `${evalMs}ms`,
      '--anim-ease': easingCurve,
      '--anim-piece-ease': easingCurve,
      '--anim-spring': springCurve,
      '--anim-piece-lift-scale': liftActive ? '1.09' : '1',
      '--anim-piece-lift-shadow': liftActive ? 'drop-shadow(0 8px 10px rgba(0, 0, 0, 0.34))' : 'none',
    },
    dataset: {
      animationLevel: settings.animationLevel,
      pieceMotion: !isOff && settings.pieceMoveAnimation ? 'on' : 'off',
      badgeMotion: !isOff && settings.badgePopAnimation ? 'on' : 'off',
      highlightMotion: !isOff && settings.boardHighlightsAnimation ? 'on' : 'off',
      evalMotion: !isOff && settings.evalBarAnimation ? 'on' : 'off',
      uiTransitions: !isOff && settings.uiTransitions ? 'on' : 'off',
      pieceLift: liftActive ? 'on' : 'off',
    },
  };
}

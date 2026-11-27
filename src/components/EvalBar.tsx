import React, { useState } from 'react';
import type { Color } from 'chess.js';
import type { EvalScore } from '../types/chess';
import { evalToBarPercent, evalToWhiteWinProbability, formatEvalScore } from '../engine/uciParser';
import { useI18n } from '../i18n/LanguageContext';

interface EvalBarProps {
  score: EvalScore | null;
  orientation: Color;
  depth?: number;
  isStabilizing?: boolean;
}

/**
 * Upgraded, high-stability vertical Stockfish Evaluation Bar.
 *
 * Uses GPU-composited `scaleY` transforms (zero layout reflow), subtle architectural
 * metallic/stone surfaces, advantage graduation ticks, forced-mate highlights,
 * and an on-hover precision telemetry readout.
 */
export const EvalBar: React.FC<EvalBarProps> = ({
  score,
  orientation,
  depth = 0,
  isStabilizing = false,
}) => {
  const { t } = useI18n();
  const [hovered, setHovered] = useState(false);

  const whiteBarPct = evalToBarPercent(score);
  const whiteScale = Math.max(0, Math.min(1, whiteBarPct / 100));
  const evalText = formatEvalScore(score, false, true);
  const preciseText = formatEvalScore(score, true, false);
  const whiteWinProb = score ? Math.round(evalToWhiteWinProbability(score)) : 50;

  const isMate = score?.type === 'mate';
  const whiteAhead = !score || score.value >= 0;

  const showTopLabel = (!whiteAhead && orientation === 'w') || (whiteAhead && orientation === 'b');
  const showBottomLabel = (whiteAhead && orientation === 'w') || (!whiteAhead && orientation === 'b');

  // Split boundary position in percentage from the top of the bar
  const splitTopPct = orientation === 'w' ? 100 - whiteBarPct : whiteBarPct;

  const advantageSummary = isMate
    ? score!.value === 0
      ? t('evalCheckmate')
      : `${score!.value > 0 ? t('white') : t('black')} ${t('evalMateIn')} ${Math.abs(score!.value)}`
    : Math.abs(score?.value ?? 0) < 20
      ? t('evalEqual')
      : `${whiteAhead ? t('white') : t('black')} ${preciseText}`;

  return (
    <div
      className="relative w-7 sm:w-9 shrink-0 rounded-[6px] overflow-visible select-none group"
      data-testid="eval-bar"
      data-eval-percent={Math.round(whiteBarPct)}
      data-eval-depth={depth}
      aria-label={`Stockfish ${advantageSummary}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      tabIndex={0}
    >
      {/* Inner clipped bar track */}
      <div className="relative w-full h-full rounded-[6px] overflow-hidden border border-white/15 shadow-[inset_0_1px_2px_rgba(0,0,0,0.45),0_8px_22px_rgba(0,0,0,0.3)] flex flex-col justify-between bg-gradient-to-b from-[#2F2E2B] via-[#242320] to-[#1A1917]">
        {/* White advantage fill — GPU-composited scaleY with smooth stabilized easing */}
        <div
          className="absolute inset-0 will-change-transform anim-eval-fill motion-reduce:transition-none"
          style={{
            transform: `scaleY(${whiteScale})`,
            transformOrigin: orientation === 'w' ? 'bottom center' : 'top center',
            background:
              orientation === 'w'
                ? 'linear-gradient(180deg, #F8F6F1 0%, #EDEAE2 55%, #DFDBD1 100%)'
                : 'linear-gradient(0deg, #F8F6F1 0%, #EDEAE2 55%, #DFDBD1 100%)',
          }}
        />

        {/* Subtle vertical specular rim on left edge for tactile architectural depth */}
        <div className="absolute inset-y-0 left-0 w-[2px] bg-white/15 pointer-events-none z-10" />

        {/* Dynamic boundary seam line at exact White/Black split */}
        {whiteBarPct > 2 && whiteBarPct < 98 && (
          <div
            className={`absolute inset-x-0 h-[1.5px] z-10 pointer-events-none anim-eval-seam ${
              isMate
                ? 'bg-[var(--app-accent)] opacity-95'
                : isStabilizing
                  ? 'bg-[var(--app-accent)]/75 opacity-80'
                  : 'bg-black/25 opacity-60'
            }`}
            style={{ top: `${splitTopPct}%` }}
          />
        )}

        {/* Precision Graduation Ticks (25%, 50% center equality notch, 75%) */}
        <div className="absolute inset-y-0 right-0 w-2 pointer-events-none z-10" aria-hidden="true">
          <span className="absolute top-[25%] right-0 w-1.5 h-[1px] bg-[#7D7C78]/60" />
          <span className="absolute top-1/2 -translate-y-1/2 right-0 w-full h-[2px] bg-[var(--app-accent)]/90 rounded-l-full shadow-xs" />
          <span className="absolute top-[75%] right-0 w-1.5 h-[1px] bg-[#7D7C78]/60" />
        </div>

        {/* Center subtle hairline across full width */}
        <div
          className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[1px] bg-[var(--app-accent)]/35 z-10 pointer-events-none"
          aria-hidden="true"
        />

        {/* Top Score Readout */}
        <div className="relative z-20 pt-1.5 px-0.5 flex flex-col items-center">
          {showTopLabel && (
            <span
              data-testid="eval-bar-score"
              className={`text-[9.5px] sm:text-[10.5px] font-mono font-extrabold tabular-nums tracking-tight leading-none px-0.5 py-0.5 rounded-[3px] ${
                isMate
                  ? orientation === 'w'
                    ? 'bg-[#E34545]/90 text-white'
                    : 'bg-[var(--app-accent)] text-[var(--app-accent-fg)]'
                  : orientation === 'w'
                    ? 'text-[#F3F1EC]'
                    : 'text-[#181715]'
              }`}
            >
              {evalText}
            </span>
          )}
        </div>

        {/* Bottom Score Readout */}
        <div className="relative z-20 pb-1.5 px-0.5 flex flex-col items-center">
          {showBottomLabel && (
            <span
              data-testid="eval-bar-score"
              className={`text-[9.5px] sm:text-[10.5px] font-mono font-extrabold tabular-nums tracking-tight leading-none px-0.5 py-0.5 rounded-[3px] ${
                isMate
                  ? orientation === 'w'
                    ? 'bg-[var(--app-accent)] text-[var(--app-accent-fg)]'
                    : 'bg-[#E34545]/90 text-white'
                  : orientation === 'w'
                    ? 'text-[#181715]'
                    : 'text-[#F3F1EC]'
              }`}
            >
              {evalText}
            </span>
          )}
        </div>
      </div>

      {/* Hover / Focus Precision Tooltip */}
      {hovered && (
        <div
          role="tooltip"
          className="hidden sm:flex flex-col gap-0.5 absolute left-full top-1/2 -translate-y-1/2 ml-2.5 z-40 px-2.5 py-2 rounded-lg bg-[var(--app-surface)] border border-[var(--app-border-strong)] shadow-xl whitespace-nowrap pointer-events-none anim-tooltip-enter"
        >
          <span className="text-[11px] font-bold text-[var(--app-text)]">{advantageSummary}</span>
          <span className="text-[10px] font-mono tabular-nums text-[var(--app-text-muted)]">
            {t('white')} {whiteWinProb}% · {t('black')} {100 - whiteWinProb}%
            {depth > 0 ? ` · d${depth}` : ''}
          </span>
        </div>
      )}
    </div>
  );
};

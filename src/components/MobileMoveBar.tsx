import React, { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ListOrdered } from 'lucide-react';
import { type MoveRecord, type OpeningInfo } from '../types/chess';
import { useI18n } from '../i18n/LanguageContext';
import { MoveBadge } from './MoveBadge';

interface MobileMoveBarProps {
  moves: MoveRecord[];
  viewPly: number;
  opening: OpeningInfo | null;
  showMoveBadges?: boolean;
  onSelectPly: (ply: number) => void;
  onJumpToMoveList?: () => void;
}

/**
 * Compact, thumb-friendly horizontal move history ribbon for mobile & tablet screens (< lg).
 * Keeps move notation and quick < / > stepping directly alongside the board without scrolling.
 */
export const MobileMoveBar: React.FC<MobileMoveBarProps> = ({
  moves,
  viewPly,
  opening,
  showMoveBadges = false,
  onSelectPly,
  onJumpToMoveList,
}) => {
  const { t } = useI18n();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const activeChipRef = useRef<HTMLButtonElement | null>(null);

  // Smoothly keep the active move centered in the horizontal strip
  useEffect(() => {
    const scroller = scrollerRef.current;
    const chip = activeChipRef.current;
    if (!scroller) return;

    if (viewPly === 0) {
      scroller.scrollTo({ left: 0, behavior: 'smooth' });
      return;
    }

    if (chip) {
      const targetLeft = chip.offsetLeft - scroller.clientWidth / 2 + chip.clientWidth / 2;
      scroller.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
    }
  }, [viewPly, moves.length]);

  return (
    <div
      data-testid="mobile-move-bar"
      aria-label="Mobile move history strip"
      className="arena-mobile-move-bar lg:hidden mb-1.5 rounded-xl bg-[var(--app-surface)] border border-[var(--app-border)] flex items-center h-11 overflow-hidden shadow-xs"
    >
      {/* Scrollable Horizontal Move Ribbon */}
      <div
        ref={scrollerRef}
        className="flex-1 min-w-0 h-full overflow-x-auto no-scrollbar flex items-center gap-1 px-2.5 scroll-smooth"
      >
        {moves.length === 0 ? (
          <span className="text-xs text-[var(--app-text-muted)] truncate">
            {opening ? `${opening.eco} · ${opening.name}` : t('noMovesYet')}
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onSelectPly(0)}
              aria-label="Start position"
              className={`shrink-0 px-2 py-1 rounded-md text-[11px] font-mono font-semibold transition-colors cursor-pointer ${
                viewPly === 0
                  ? 'bg-[var(--app-accent)] text-[var(--app-accent-fg)] font-bold'
                  : 'text-[var(--app-text-subtle)] hover:text-[var(--app-text)] hover:bg-[var(--app-surface-hover)]'
              }`}
            >
              0
            </button>

            {moves.map((m) => {
              const isActive = viewPly === m.ply;
              const showMoveNum = m.color === 'w' || m.ply === 1;
              return (
                <React.Fragment key={m.ply}>
                  {showMoveNum && (
                    <span className="shrink-0 text-[11px] font-mono tabular-nums text-[var(--app-text-subtle)] pl-1 select-none">
                      {m.moveNumber}.{m.color === 'b' ? '..' : ''}
                    </span>
                  )}
                  <button
                    ref={isActive ? activeChipRef : null}
                    type="button"
                    onClick={() => onSelectPly(m.ply)}
                    className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 min-h-[30px] rounded-md font-mono text-xs transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[var(--app-accent)] text-[var(--app-accent-fg)] font-extrabold shadow-xs'
                        : 'text-[var(--app-text)] hover:bg-[var(--app-surface-hover)]'
                    }`}
                  >
                    <span>{m.san}</span>
                    {showMoveBadges && m.classification && (
                      <MoveBadge classification={m.classification} variant="inline" />
                    )}
                  </button>
                </React.Fragment>
              );
            })}
          </>
        )}
      </div>

      {/* Pinned Thumb Stepper Controls (< > + Jump to full history) */}
      <div className="shrink-0 h-full flex items-center border-l border-[var(--app-border)] bg-[var(--app-surface-2)]">
        <button
          type="button"
          aria-label="Previous move"
          disabled={viewPly === 0}
          onClick={() => onSelectPly(Math.max(0, viewPly - 1))}
          className="w-9 h-full flex items-center justify-center text-[var(--app-text)] hover:bg-[var(--app-surface-hover)] disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          aria-label="Next move"
          disabled={viewPly >= moves.length}
          onClick={() => onSelectPly(Math.min(moves.length, viewPly + 1))}
          className="w-9 h-full flex items-center justify-center border-l border-[var(--app-border)] text-[var(--app-text)] hover:bg-[var(--app-surface-hover)] disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        {onJumpToMoveList && (
          <button
            type="button"
            aria-label="Open full move history"
            title="Full Move History"
            onClick={onJumpToMoveList}
            className="w-9 h-full flex items-center justify-center border-l border-[var(--app-border)] text-[var(--app-text-muted)] hover:text-[var(--app-accent)] hover:bg-[var(--app-surface-hover)] transition-colors cursor-pointer"
          >
            <ListOrdered className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

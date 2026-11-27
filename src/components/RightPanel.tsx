import React, { useEffect, useRef, useState } from 'react';
import {
  AlignJustify,
  Award,
  BookOpen,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Cpu,
  Flag,
  Handshake,
  Lightbulb,
  RotateCcw,
  Sparkles,
  ArrowUpDown,
  LayoutGrid,
  ListOrdered,
  Play,
} from 'lucide-react';
import {
  type ClassicStudy,
  type EngineAnalysis,
  type GameMode,
  type MoveRecord,
  type OpeningInfo,
} from '../types/chess';
import { evalToWhiteWinProbability, formatEvalScore, formatNodes } from '../engine/uciParser';
import { formatPvSanWithNumbers } from '../game/chessLogic';
import { CLASSIC_STUDIES } from '../game/openings';
import { useI18n } from '../i18n/LanguageContext';
import { EvalGraph } from './EvalGraph';
import { MatchRatingPanel } from './MatchRatingPanel';
import { MoveBadge } from './MoveBadge';

export type RightPanelTab = 'moves' | 'rating' | 'engine' | 'library';

interface RightPanelProps {
  activeTab: RightPanelTab;
  onTabChange: (tab: RightPanelTab) => void;
  mode: GameMode;
  showMoveBadges?: boolean;
  moves: MoveRecord[];
  viewPly: number;
  currentFen: string;
  opening: OpeningInfo | null;
  positionLabel?: string | null;
  whiteName: string;
  blackName: string;
  engineAnalysis: EngineAnalysis | null;
  engineEnabled: boolean;
  onToggleEngine: (enabled: boolean) => void;
  multiPv: number;
  onChangeMultiPv: (count: number) => void;
  analysisDepth: number;
  showBestArrow: boolean;
  onToggleBestArrow: (show: boolean) => void;
  isGameOver: boolean;
  isReviewing: boolean;
  reviewProgress: number;
  onSelectPly: (ply: number) => void;
  onFlipBoard: () => void;
  onRequestHint: () => void;
  onTakeback: () => void;
  onOfferDraw: () => void;
  onResign: () => void;
  onNewMatch: () => void;
  onRunGameReview: () => void;
  onPlayEngineMove: (uciMove: string) => void;
  onImportPgnOrFen: (text: string) => { ok: boolean; error?: string };
  onImportAndRatePgn: (text: string) => { ok: boolean; error?: string };
  onLoadStudy: (study: ClassicStudy) => void;
  pgnText: string;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  activeTab,
  onTabChange,
  mode,
  showMoveBadges = mode === 'analysis',
  moves,
  viewPly,
  currentFen,
  opening,
  positionLabel,
  whiteName,
  blackName,
  engineAnalysis,
  engineEnabled,
  onToggleEngine,
  multiPv,
  onChangeMultiPv,
  analysisDepth,
  showBestArrow,
  onToggleBestArrow,
  isGameOver,
  isReviewing,
  reviewProgress,
  onSelectPly,
  onFlipBoard,
  onRequestHint,
  onTakeback,
  onOfferDraw,
  onResign,
  onNewMatch,
  onRunGameReview,
  onPlayEngineMove,
  onImportPgnOrFen,
  onImportAndRatePgn,
  onLoadStudy,
  pgnText,
}) => {
  const { t } = useI18n();
  const moveListContainerRef = useRef<HTMLDivElement>(null);
  const activeMoveBtnRef = useRef<HTMLButtonElement | null>(null);
  const [importInput, setImportInput] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<'fen' | 'pgn' | null>(null);
  const [moveViewMode, setMoveViewMode] = useState<'table' | 'flow'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'flow' : 'table'
  );

  // Scroll only inside the move list container (never scroll the outer window on mobile)
  useEffect(() => {
    if (activeTab !== 'moves') return;
    const container = moveListContainerRef.current;
    if (!container) return;

    const activeEl = activeMoveBtnRef.current;
    if (activeEl) {
      const containerRect = container.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();
      const relativeTop = activeRect.top - containerRect.top + container.scrollTop;
      const relativeBottom = relativeTop + activeRect.height;

      if (relativeTop < container.scrollTop) {
        container.scrollTo({ top: Math.max(0, relativeTop - 8), behavior: 'smooth' });
      } else if (relativeBottom > container.scrollTop + container.clientHeight) {
        container.scrollTo({
          top: Math.max(0, relativeBottom - container.clientHeight + 8),
          behavior: 'smooth',
        });
      }
    } else if (viewPly === 0) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [moves.length, viewPly, activeTab, moveViewMode]);

  const moveRows: { moveNumber: number; white?: MoveRecord; black?: MoveRecord }[] = [];
  for (const m of moves) {
    const lastRow = moveRows[moveRows.length - 1];
    if (m.color === 'w' || !lastRow || lastRow.moveNumber !== m.moveNumber || lastRow.black) {
      moveRows.push({
        moveNumber: m.moveNumber,
        white: m.color === 'w' ? m : undefined,
        black: m.color === 'b' ? m : undefined,
      });
    } else {
      lastRow.black = m;
    }
  }

  const topScore = engineAnalysis?.lines[0]?.score ?? null;
  const whiteWinProb = topScore ? Math.round(evalToWhiteWinProbability(topScore)) : 50;

  const handleCopy = async (kind: 'fen' | 'pgn') => {
    const value = kind === 'fen' ? currentFen : pgnText;
    let copied = false;
    try {
      await navigator.clipboard.writeText(value);
      copied = true;
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = value;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        copied = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        copied = false;
      }
    }
    if (copied) {
      setCopiedType(kind);
      setTimeout(() => setCopiedType(null), 1800);
    }
  };

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = onImportPgnOrFen(importInput);
    if (res.ok) {
      setImportError(null);
      setImportSuccess('Position loaded into board.');
      setImportInput('');
      setTimeout(() => setImportSuccess(null), 2200);
    } else {
      setImportSuccess(null);
      setImportError(res.error ?? 'Invalid notation.');
    }
  };

  return (
    <aside
      id="right-panel-dock"
      aria-label="Chess analysis and move history panel"
      className="arena-dock w-full lg:w-[400px] xl:w-[430px] shrink-0 bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl flex flex-col overflow-hidden lg:h-[calc(100vh-4.2rem)] lg:max-h-[820px]"
    >
      {/* 4-Tab Bar: Moves, Rating, Stockfish, Library */}
      <div
        role="tablist"
        aria-label="Workspace tabs"
        className="grid grid-cols-4 bg-[var(--app-surface-2)] border-b border-[var(--app-border)] shrink-0"
      >
        {(
          [
            { id: 'moves', label: t('tabMoves'), icon: ListOrdered },
            { id: 'rating', label: t('tabRating'), icon: Award },
            { id: 'engine', label: t('tabStockfish'), icon: Cpu },
            { id: 'library', label: t('tabLibrary'), icon: BookOpen },
          ] as { id: RightPanelTab; label: string; icon: React.ComponentType<{ className?: string }> }[]
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onTabChange(tab.id)}
              className={`arena-dock-tab flex items-center justify-center gap-1 py-3 px-1 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer border-b-2 ${
                active
                  ? 'border-[var(--app-accent)] text-[var(--app-text)] bg-[var(--app-surface)]'
                  : 'border-transparent text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: MOVES & GAME CONTROLS */}
      {activeTab === 'moves' && (
        <div key="tab-moves" className="flex flex-col flex-1 min-h-0 anim-view-enter">
          <div className="px-4 py-2.5 bg-[var(--app-surface-2)] border-b border-[var(--app-border)] flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-[var(--app-text)] truncate">
                {opening ? `${opening.eco} · ${opening.name}` : positionLabel ?? t('startingPosition')}
              </div>
              <div className="text-[11px] text-[var(--app-text-muted)] flex items-center gap-1.5 font-mono tabular-nums mt-0.5">
                <span>Stockfish</span>
                <span aria-hidden="true">·</span>
                <span>{topScore ? formatEvalScore(topScore, true) : '0.00'}</span>
                {engineAnalysis && engineAnalysis.depth > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>d{engineAnalysis.depth}</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleCopy('pgn')}
                disabled={moves.length === 0}
                title={t('copyPgn')}
                className="px-2 py-1 rounded-md bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] disabled:opacity-40 text-[11px] font-semibold text-[var(--app-text)] inline-flex items-center gap-1 transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap anim-interactive"
              >
                {copiedType === 'pgn' ? (
                  <Check className="w-3 h-3 text-[var(--app-accent)]" />
                ) : (
                  <Copy className="w-3 h-3 text-[var(--app-text-muted)]" />
                )}
                <span>{copiedType === 'pgn' ? t('copied') : t('copyPgn')}</span>
              </button>
              <button
                type="button"
                onClick={() => onTabChange('engine')}
                className="text-xs font-semibold text-[var(--app-accent)] hover:underline whitespace-nowrap cursor-pointer"
              >
                {t('tabStockfish')} →
              </button>
            </div>
          </div>

          <div className="arena-eval-graph px-3.5 pt-3 shrink-0">
            <EvalGraph moves={moves} viewPly={viewPly} onSelectPly={onSelectPly} liveEval={topScore} />
          </div>

          {/* Move History Sub-Header with Compact Flow / 2-Column Table Switcher */}
          <div className="px-3.5 pt-2.5 pb-1 flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-[var(--app-text-muted)] font-mono tabular-nums">
              {moves.length === 0
                ? t('tabMoves')
                : `${Math.ceil(viewPly / 2)} / ${Math.ceil(moves.length / 2)}`}
            </span>
            <div
              role="group"
              aria-label="Move history layout"
              className="inline-flex items-center rounded-md bg-[var(--app-surface-2)] border border-[var(--app-border)] p-0.5"
            >
              <button
                type="button"
                aria-pressed={moveViewMode === 'flow'}
                onClick={() => setMoveViewMode('flow')}
                className={`px-2 py-1 rounded text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer ${
                  moveViewMode === 'flow'
                    ? 'bg-[var(--app-surface)] text-[var(--app-text)] shadow-xs'
                    : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
                }`}
              >
                <LayoutGrid className="w-3 h-3" />
                <span>{t('viewCompact')}</span>
              </button>
              <button
                type="button"
                aria-pressed={moveViewMode === 'table'}
                onClick={() => setMoveViewMode('table')}
                className={`px-2 py-1 rounded text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer ${
                  moveViewMode === 'table'
                    ? 'bg-[var(--app-surface)] text-[var(--app-text)] shadow-xs'
                    : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
                }`}
              >
                <AlignJustify className="w-3 h-3" />
                <span>{t('viewTable')}</span>
              </button>
            </div>
          </div>

          <div
            ref={moveListContainerRef}
            className="arena-move-list flex-1 min-h-[140px] max-h-[260px] lg:max-h-none overflow-y-auto px-3.5 py-2"
            data-testid="move-history"
          >
            {moveRows.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-6 px-4">
                <p className="text-sm font-semibold text-[var(--app-text)]">{t('noMovesYet')}</p>
                <p className="text-xs text-[var(--app-text-muted)] mt-1 max-w-[240px]">
                  {t('moveHistoryEmpty')}
                </p>
              </div>
            ) : moveViewMode === 'flow' ? (
              /* Mobile-First Compact Flowing Move Pairs (move numbers never orphan) */
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5" data-testid="move-history-flow">
                {moveRows.map((row) => (
                  <div key={row.moveNumber} className="inline-flex items-center gap-1">
                    <span className="text-[11px] font-mono tabular-nums text-[var(--app-text-subtle)] select-none">
                      {row.moveNumber}.{!row.white && row.black ? '..' : ''}
                    </span>
                    {row.white && (
                      <button
                        ref={viewPly === row.white.ply ? activeMoveBtnRef : null}
                        type="button"
                        onClick={() => onSelectPly(row.white!.ply)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[34px] rounded-lg font-mono text-xs border transition-colors cursor-pointer ${
                          viewPly === row.white.ply
                            ? 'bg-[var(--app-accent)] text-[var(--app-accent-fg)] border-[var(--app-accent)] font-extrabold shadow-xs'
                            : 'bg-[var(--app-surface-2)] text-[var(--app-text)] border-[var(--app-border)] hover:bg-[var(--app-surface-hover)]'
                        }`}
                      >
                        <span>{row.white.san}</span>
                        {showMoveBadges && row.white.classification && (
                          <MoveBadge classification={row.white.classification} variant="inline" />
                        )}
                      </button>
                    )}
                    {row.black && (
                      <button
                        ref={viewPly === row.black.ply ? activeMoveBtnRef : null}
                        type="button"
                        onClick={() => onSelectPly(row.black!.ply)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[34px] rounded-lg font-mono text-xs border transition-colors cursor-pointer ${
                          viewPly === row.black.ply
                            ? 'bg-[var(--app-accent)] text-[var(--app-accent-fg)] border-[var(--app-accent)] font-extrabold shadow-xs'
                            : 'bg-[var(--app-surface-2)] text-[var(--app-text)] border-[var(--app-border)] hover:bg-[var(--app-surface-hover)]'
                        }`}
                      >
                        <span>{row.black.san}</span>
                        {showMoveBadges && row.black.classification && (
                          <MoveBadge classification={row.black.classification} variant="inline" />
                        )}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              /* Classic 2-Column Move Table with Touch-Friendly Mobile Targets */
              <div className="flex flex-col gap-0.5" data-testid="move-history-table">
                {moveRows.map((row) => (
                  <div
                    key={row.moveNumber}
                    className="grid grid-cols-[36px_1fr_1fr] items-center rounded px-1.5 py-0.5 odd:bg-black/[0.04]"
                  >
                    <span className="text-xs font-mono tabular-nums text-[var(--app-text-subtle)]">
                      {row.moveNumber}.
                    </span>

                    {row.white ? (
                      <button
                        ref={viewPly === row.white.ply ? activeMoveBtnRef : null}
                        type="button"
                        onClick={() => onSelectPly(row.white!.ply)}
                        className={`flex items-center justify-between gap-1.5 px-2.5 py-2 lg:py-1 rounded text-left font-mono text-xs transition-colors cursor-pointer ${
                          viewPly === row.white.ply
                            ? 'bg-[var(--app-accent-soft)] text-[var(--app-text)] font-bold ring-1 ring-[var(--app-accent)]/50'
                            : 'text-[var(--app-text)] hover:bg-[var(--app-surface-hover)]'
                        }`}
                      >
                        <span>{row.white.san}</span>
                        {showMoveBadges && row.white.classification && (
                          <MoveBadge classification={row.white.classification} variant="inline" />
                        )}
                      </button>
                    ) : (
                      <span />
                    )}

                    {row.black ? (
                      <button
                        ref={viewPly === row.black.ply ? activeMoveBtnRef : null}
                        type="button"
                        onClick={() => onSelectPly(row.black!.ply)}
                        className={`flex items-center justify-between gap-1.5 px-2.5 py-2 lg:py-1 rounded text-left font-mono text-xs transition-colors cursor-pointer ${
                          viewPly === row.black.ply
                            ? 'bg-[var(--app-accent-soft)] text-[var(--app-text)] font-bold ring-1 ring-[var(--app-accent)]/50'
                            : 'text-[var(--app-text)] hover:bg-[var(--app-surface-hover)]'
                        }`}
                      >
                        <span>{row.black.san}</span>
                        {showMoveBadges && row.black.classification && (
                          <MoveBadge classification={row.black.classification} variant="inline" />
                        )}
                      </button>
                    ) : (
                      <span />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* VCR Controls */}
          <div className="arena-dock-vcr px-3.5 py-2 border-t border-[var(--app-border)] bg-[var(--app-surface-2)] grid grid-cols-5 gap-1 shrink-0">
            {[
              { label: 'First move', disabled: viewPly === 0, onClick: () => onSelectPly(0), icon: ChevronFirst },
              {
                label: 'Previous move',
                disabled: viewPly === 0,
                onClick: () => onSelectPly(Math.max(0, viewPly - 1)),
                icon: ChevronLeft,
              },
              {
                label: 'Next move',
                disabled: viewPly >= moves.length,
                onClick: () => onSelectPly(Math.min(moves.length, viewPly + 1)),
                icon: ChevronRight,
              },
              {
                label: 'Latest move',
                disabled: viewPly >= moves.length,
                onClick: () => onSelectPly(moves.length),
                icon: ChevronLast,
              },
              { label: 'Flip board', disabled: false, onClick: onFlipBoard, icon: ArrowUpDown },
            ].map((btn) => {
              const Icon = btn.icon;
              return (
                <button
                  key={btn.label}
                  type="button"
                  aria-label={btn.label}
                  disabled={btn.disabled}
                  onClick={btn.onClick}
                  className="py-2.5 lg:py-2 rounded-md flex items-center justify-center bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] disabled:opacity-35 text-[var(--app-text)] transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>

          {/* Action Footer */}
          <div className="arena-dock-footer p-3.5 border-t border-[var(--app-border)] bg-[var(--app-surface-2)] flex flex-col gap-2 shrink-0">
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={onRequestHint}
                disabled={isGameOver}
                className="arena-dock-action-btn flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] disabled:opacity-40 text-[var(--app-text)] text-[11px] font-medium transition-colors cursor-pointer anim-interactive"
              >
                <Lightbulb className="w-3.5 h-3.5 text-[#E6A832] shrink-0" />
                <span className="truncate">{t('actionHint')}</span>
              </button>
              <button
                type="button"
                onClick={onTakeback}
                disabled={moves.length === 0}
                className="arena-dock-action-btn flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] disabled:opacity-40 text-[var(--app-text)] text-[11px] font-medium transition-colors cursor-pointer anim-interactive"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[var(--app-text-muted)] shrink-0" />
                <span className="truncate">{t('actionTakeback')}</span>
              </button>
              <button
                type="button"
                onClick={onOfferDraw}
                disabled={isGameOver || mode === 'analysis'}
                className="arena-dock-action-btn flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] disabled:opacity-40 text-[var(--app-text)] text-[11px] font-medium transition-colors cursor-pointer anim-interactive"
              >
                <Handshake className="w-3.5 h-3.5 text-[var(--app-text-muted)] shrink-0" />
                <span className="truncate">{t('actionDraw')}</span>
              </button>
              <button
                type="button"
                onClick={onResign}
                disabled={isGameOver || mode === 'analysis'}
                className="arena-dock-action-btn flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg bg-[var(--app-surface)] hover:bg-[#C94A4A]/20 border border-[var(--app-border)] disabled:opacity-40 text-[var(--app-text)] text-[11px] font-medium transition-colors cursor-pointer anim-interactive"
              >
                <Flag className="w-3.5 h-3.5 text-[#D96666] shrink-0" />
                <span className="truncate">{t('actionResign')}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  onTabChange('rating');
                  if (moves.length > 0 && !isReviewing) onRunGameReview();
                }}
                disabled={moves.length === 0 || isReviewing}
                className="arena-dock-cta py-2.5 px-3 rounded-lg bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] disabled:opacity-40 text-xs font-bold text-[var(--app-text)] flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap anim-interactive"
              >
                <Sparkles className="w-3.5 h-3.5 text-[var(--app-accent)] shrink-0" />
                <span className="truncate">{isReviewing ? `${reviewProgress}%` : t('rateMatch')}</span>
              </button>
              <button
                type="button"
                onClick={onNewMatch}
                className="arena-dock-cta py-2.5 px-3 rounded-lg bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-xs font-extrabold text-[var(--app-accent-fg)] transition-colors cursor-pointer whitespace-nowrap anim-interactive"
              >
                {t('actionNewMatch')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DEDICATED MATCH RATING REPORT */}
      {activeTab === 'rating' && (
        <div key="tab-rating" className="flex flex-col flex-1 min-h-0 anim-view-enter">
          <MatchRatingPanel
            moves={moves}
            viewPly={viewPly}
            whiteName={whiteName}
            blackName={blackName}
            isReviewing={isReviewing}
            reviewProgress={reviewProgress}
            liveEval={topScore}
            onRunGameReview={onRunGameReview}
            onSelectPly={onSelectPly}
            onImportAndRatePgn={onImportAndRatePgn}
          />
          <div className="px-3.5 py-2 border-t border-[var(--app-border)] bg-[var(--app-surface-2)] grid grid-cols-5 gap-1 shrink-0">
            {[
              { label: 'First move', disabled: viewPly === 0, onClick: () => onSelectPly(0), icon: ChevronFirst },
              {
                label: 'Previous move',
                disabled: viewPly === 0,
                onClick: () => onSelectPly(Math.max(0, viewPly - 1)),
                icon: ChevronLeft,
              },
              {
                label: 'Next move',
                disabled: viewPly >= moves.length,
                onClick: () => onSelectPly(Math.min(moves.length, viewPly + 1)),
                icon: ChevronRight,
              },
              {
                label: 'Latest move',
                disabled: viewPly >= moves.length,
                onClick: () => onSelectPly(moves.length),
                icon: ChevronLast,
              },
              { label: 'Flip board', disabled: false, onClick: onFlipBoard, icon: ArrowUpDown },
            ].map((btn) => {
              const Icon = btn.icon;
              return (
                <button
                  key={btn.label}
                  type="button"
                  aria-label={btn.label}
                  disabled={btn.disabled}
                  onClick={btn.onClick}
                  className="py-2 rounded-md flex items-center justify-center bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] disabled:opacity-35 text-[var(--app-text)] transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: LIVE STOCKFISH UCI ENGINE LINES */}
      {activeTab === 'engine' && (
        <div
          key="tab-engine"
          className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 anim-view-enter"
          data-testid="stockfish-panel"
        >
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--app-border)]">
            <div>
              <h2 className="text-sm font-bold text-[var(--app-text)]">Stockfish WASM Engine</h2>
              <p className="text-xs text-[var(--app-text-muted)] font-mono tabular-nums mt-0.5">
                {engineEnabled
                  ? `Depth ${engineAnalysis?.depth ?? 0}/${analysisDepth} · ${formatNodes(engineAnalysis?.nodes ?? 0)} nodes · ${formatNodes(engineAnalysis?.nps ?? 0)}/s`
                  : 'Engine paused'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onToggleEngine(!engineEnabled)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap border ${
                engineEnabled
                  ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)] border-[var(--app-accent)]'
                  : 'bg-[var(--app-surface-2)] text-[var(--app-text-muted)] border-[var(--app-border)]'
              }`}
            >
              {engineEnabled ? 'Running' : 'Paused'}
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs font-mono tabular-nums">
              <span className="text-[var(--app-text)] font-semibold">White {whiteWinProb}%</span>
              <span className="text-[var(--app-accent)] font-bold text-sm">
                {topScore ? formatEvalScore(topScore, true) : '0.00'}
              </span>
              <span className="text-[var(--app-text-muted)] font-semibold">Black {100 - whiteWinProb}%</span>
            </div>
            <div className="h-2.5 w-full rounded-full overflow-hidden bg-[#33322E] flex">
              <div
                className="h-full bg-[#ECEAE4] transition-[width] duration-300"
                style={{ width: `${whiteWinProb}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[var(--app-text-muted)]">Lines:</span>
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onChangeMultiPv(n)}
                  className={`w-7 h-7 rounded text-xs font-mono font-bold transition-colors cursor-pointer ${
                    multiPv === n
                      ? 'bg-[var(--app-accent)] text-[var(--app-accent-fg)]'
                      : 'bg-[var(--app-surface-2)] text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onToggleBestArrow(!showBestArrow)}
              className={`px-2.5 py-1.5 rounded text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                showBestArrow
                  ? 'bg-[var(--app-accent-soft)] border-[var(--app-accent)] text-[var(--app-text)]'
                  : 'bg-[var(--app-surface-2)] border-[var(--app-border)] text-[var(--app-text-muted)]'
              }`}
            >
              Best Arrow: {showBestArrow ? 'On' : 'Off'}
            </button>
          </div>

          <div className="flex flex-col gap-2" data-testid="engine-lines">
            {!engineEnabled ? (
              <div className="py-6 text-center text-xs text-[var(--app-text-muted)] bg-[var(--app-surface-2)] rounded-lg">
                Resume Stockfish to view live top variations.
              </div>
            ) : !engineAnalysis || engineAnalysis.lines.length === 0 ? (
              <div className="py-6 text-center text-xs text-[var(--app-text-muted)] bg-[var(--app-surface-2)] rounded-lg">
                Calculating principal variations…
              </div>
            ) : (
              engineAnalysis.lines.map((line) => {
                const scoreStr = formatEvalScore(line.score, true);
                const isWhiteAdv = line.score.value >= 0;
                const pvText = formatPvSanWithNumbers(engineAnalysis.fen, line.pvSan);
                const firstUci = line.pvUci[0];

                return (
                  <div
                    key={line.multipv}
                    className="bg-[var(--app-surface-2)] border border-[var(--app-border)] rounded-lg p-2.5 flex items-start gap-2.5"
                  >
                    <span
                      className={`font-mono font-bold text-xs tabular-nums px-1.5 py-0.5 rounded shrink-0 ${
                        isWhiteAdv ? 'bg-[#ECEAE4] text-[#181817]' : 'bg-[#363532] text-[#F1EFEA]'
                      }`}
                    >
                      {scoreStr}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs text-[var(--app-text)] leading-relaxed break-words">
                        {pvText || line.pvUci.slice(0, 6).join(' ')}
                      </p>
                      <span className="text-[11px] text-[var(--app-text-subtle)] font-mono tabular-nums">
                        Line {line.multipv} · depth {line.depth}
                      </span>
                    </div>
                    {firstUci && (
                      <button
                        type="button"
                        aria-label={`Play engine line ${line.multipv}`}
                        title="Play this move on board"
                        onClick={() => onPlayEngineMove(firstUci)}
                        className="p-1.5 rounded bg-[var(--app-surface)] hover:bg-[var(--app-accent)] hover:text-[var(--app-accent-fg)] border border-[var(--app-border)] text-[var(--app-text-muted)] transition-colors shrink-0 cursor-pointer"
                      >
                        <Play className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 4: LIBRARY, FEN/PGN IMPORT & EXPORT */}
      {activeTab === 'library' && (
        <div key="tab-library" className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 anim-view-enter">
          <div className="flex flex-col gap-3">
            {/* FEN Display & Copy */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-bold text-[var(--app-text)]">{t('fenNotation')}</h2>
                <button
                  type="button"
                  onClick={() => handleCopy('fen')}
                  className="py-1 px-2.5 rounded-md bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-[11px] font-semibold text-[var(--app-text)] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap anim-interactive"
                >
                  {copiedType === 'fen' ? (
                    <Check className="w-3 h-3 text-[var(--app-accent)]" />
                  ) : (
                    <Copy className="w-3 h-3 text-[var(--app-text-muted)]" />
                  )}
                  <span>{copiedType === 'fen' ? t('copied') : t('copyFen')}</span>
                </button>
              </div>
              <div className="bg-[var(--app-surface-2)] border border-[var(--app-border)] rounded-lg p-2.5 font-mono text-[11px] text-[var(--app-text-muted)] break-all">
                {currentFen}
              </div>
            </div>

            {/* PGN Display Area & Copy PGN Button */}
            <div className="flex flex-col gap-1.5" data-testid="pgn-display-area">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-bold text-[var(--app-text)]">{t('pgnNotation')}</h2>
                <button
                  type="button"
                  onClick={() => handleCopy('pgn')}
                  className="py-1 px-2.5 rounded-md bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-[11px] font-semibold text-[var(--app-text)] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap anim-interactive"
                >
                  {copiedType === 'pgn' ? (
                    <Check className="w-3 h-3 text-[var(--app-accent)]" />
                  ) : (
                    <Copy className="w-3 h-3 text-[var(--app-text-muted)]" />
                  )}
                  <span>{copiedType === 'pgn' ? t('copied') : t('copyPgn')}</span>
                </button>
              </div>
              <pre
                data-testid="pgn-display-text"
                className="bg-[var(--app-surface-2)] border border-[var(--app-border)] rounded-lg p-2.5 font-mono text-[11px] text-[var(--app-text-muted)] whitespace-pre-wrap break-words max-h-36 overflow-y-auto m-0"
              >
                {pgnText}
              </pre>
            </div>
          </div>

          <form onSubmit={handleImportSubmit} className="flex flex-col gap-2">
            <label htmlFor="fen-pgn-input" className="text-xs font-bold text-[var(--app-text)]">
              Load Custom FEN or PGN
            </label>
            <textarea
              id="fen-pgn-input"
              rows={3}
              value={importInput}
              onChange={(e) => {
                setImportInput(e.target.value);
                if (importError) setImportError(null);
              }}
              placeholder="Paste a FEN string or PGN move list (e.g. 1. e4 e5 2. Nf3 Nc6)..."
              className="w-full rounded-lg bg-[var(--app-surface-2)] border border-[var(--app-border-strong)] focus:border-[var(--app-accent)] focus:outline-none p-2.5 text-xs font-mono text-[var(--app-text)] placeholder:text-[var(--app-text-subtle)] resize-none"
            />
            {importError && <p className="text-xs text-[#E04F4F]">{importError}</p>}
            {importSuccess && <p className="text-xs text-[var(--app-accent)]">{importSuccess}</p>}
            <button
              type="submit"
              className="py-2 px-3 rounded-lg bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-[var(--app-accent-fg)] text-xs font-bold transition-colors cursor-pointer"
            >
              Load Into Board
            </button>
          </form>

          <div className="flex flex-col gap-2">
            <h2 className="text-xs font-bold text-[var(--app-text)]">Classic Master Games</h2>
            <div className="flex flex-col gap-1.5">
              {CLASSIC_STUDIES.map((study) => (
                <button
                  key={study.id}
                  type="button"
                  onClick={() => onLoadStudy(study)}
                  className="w-full text-left p-3 rounded-lg bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] hover:border-[var(--app-accent)] transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[var(--app-text)]">{study.title}</span>
                    <span className="text-[11px] text-[var(--app-accent)] whitespace-nowrap">{study.category}</span>
                  </div>
                  <p className="text-[11px] text-[var(--app-text-muted)] mt-0.5">{study.subtitle}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

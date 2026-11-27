import React, { useMemo, useState } from 'react';
import { AlertCircle, Award, ChevronRight, RotateCcw, Sparkles, Upload, X } from 'lucide-react';
import { CLASSIFICATION_META, type EvalScore, type MoveRecord } from '../types/chess';
import { buildMatchRatingReport, type MatchResultString } from '../engine/matchRating';
import { useI18n } from '../i18n/LanguageContext';
import { EvalGraph } from './EvalGraph';
import { MoveBadge } from './MoveBadge';

interface MatchRatingPanelProps {
  moves: MoveRecord[];
  viewPly: number;
  whiteName: string;
  blackName: string;
  resultString?: MatchResultString;
  isReviewing: boolean;
  reviewProgress: number;
  reviewError?: string | null;
  liveEval?: EvalScore | null;
  onRunGameReview: () => void;
  onCancelGameReview?: () => void;
  onSelectPly: (ply: number) => void;
  onImportAndRatePgn: (pgn: string) => { ok: boolean; error?: string };
}

export const MatchRatingPanel: React.FC<MatchRatingPanelProps> = React.memo(({
  moves,
  viewPly,
  whiteName,
  blackName,
  resultString,
  isReviewing,
  reviewProgress,
  reviewError = null,
  liveEval,
  onRunGameReview,
  onCancelGameReview,
  onSelectPly,
  onImportAndRatePgn,
}) => {
  const { t, getClassificationLabel } = useI18n();
  const report = useMemo(
    () => buildMatchRatingReport(moves, resultString ? { result: resultString } : undefined),
    [moves, resultString]
  );
  const [showPgnBox, setShowPgnBox] = useState(false);
  const [pgnDraft, setPgnDraft] = useState('');
  const [pgnError, setPgnError] = useState<string | null>(null);

  const handlePgnRateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = onImportAndRatePgn(pgnDraft);
    if (res.ok) {
      setPgnDraft('');
      setPgnError(null);
      setShowPgnBox(false);
    } else {
      setPgnError(res.error ?? 'Could not parse PGN.');
    }
  };

  const rows: Array<keyof typeof CLASSIFICATION_META> = [
    'brilliant',
    'great',
    'best',
    'excellent',
    'book',
    'good',
    'inaccuracy',
    'mistake',
    'blunder',
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4" data-testid="match-rating-panel">
      {/* Header + Action */}
      <div className="flex items-start justify-between gap-2 pb-3 border-b border-[var(--app-border)]">
        <div>
          <div className="flex items-center gap-1.5">
            <Award className="w-4 h-4 text-[var(--app-accent)] shrink-0" />
            <h2 className="text-sm font-bold text-[var(--app-text)]">{t('matchRatingTitle')}</h2>
          </div>
          <p className="text-xs text-[var(--app-text-muted)] mt-1 leading-relaxed">{report.summaryHeadline}</p>
        </div>
        <button
          type="button"
          onClick={onRunGameReview}
          disabled={moves.length === 0 || isReviewing}
          className="px-3 py-1.5 rounded-md bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] disabled:opacity-40 text-[var(--app-accent-fg)] text-xs font-extrabold transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1 anim-interactive"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{isReviewing ? `${reviewProgress}%` : report.isComplete ? t('reRate') : t('rateMatch')}</span>
        </button>
      </div>

      {/* Live Progress Bar while Stockfish reviews all moves */}
      {isReviewing && (
        <div className="flex flex-col gap-1.5" data-testid="review-progress-bar">
          <div className="flex items-center justify-between gap-2 text-xs text-[var(--app-text-muted)] font-mono tabular-nums">
            <span className="truncate font-sans">{t('evaluatingMoves')}</span>
            <div className="flex items-center gap-2 shrink-0">
              <span>{reviewProgress}%</span>
              {onCancelGameReview && (
                <button
                  type="button"
                  data-testid="cancel-review-btn"
                  onClick={onCancelGameReview}
                  className="px-2 py-0.5 rounded bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-[11px] font-sans font-semibold text-[var(--app-text)] inline-flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  <span>{t('cancel')}</span>
                </button>
              )}
            </div>
          </div>
          <div className="w-full h-2 bg-[var(--app-surface-2)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--app-accent)] transition-[width] duration-200"
              style={{ width: `${reviewProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Clean recovery banner when Stockfish hits an error or timeout mid-review */}
      {!isReviewing && reviewError && (
        <div
          role="alert"
          data-testid="review-error-banner"
          className="rounded-lg bg-[#E04F4F]/10 border border-[#E04F4F]/35 px-3 py-2.5 flex items-center justify-between gap-2 text-xs"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-[#E04F4F] shrink-0" />
            <span className="text-[var(--app-text)] leading-snug">{t('reviewFailed')}</span>
          </div>
          <button
            type="button"
            data-testid="retry-review-btn"
            onClick={onRunGameReview}
            disabled={moves.length === 0}
            className="px-2.5 py-1 rounded-md bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-[11px] font-bold text-[var(--app-text)] inline-flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>{t('reviewRetry')}</span>
          </button>
        </div>
      )}

      {/* Advantage Curve */}
      {moves.length > 0 && (
        <EvalGraph moves={moves} viewPly={viewPly} onSelectPly={onSelectPly} liveEval={liveEval} />
      )}

      {/* White vs Black Accuracy & Estimated Game Elo */}
      <div className="flex flex-col gap-1.5">
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-[var(--app-surface-2)] border border-[var(--app-border)] rounded-xl p-3 flex flex-col gap-1">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-semibold text-[var(--app-text)] truncate">{whiteName}</span>
              <span className="text-xs font-mono font-extrabold text-[var(--app-accent)]">
                {report.white.grade}
              </span>
            </div>
            <div className="text-2xl font-mono font-extrabold tabular-nums text-[var(--app-text)] leading-tight">
              {report.white.accuracy !== null ? `${report.white.accuracy.toFixed(1)}%` : '—'}
            </div>
            <div className="flex items-center justify-between gap-1 text-[11px] text-[var(--app-text-muted)] font-mono tabular-nums pt-1 border-t border-[var(--app-border)]">
              <span className="truncate font-sans">{t('gameElo')}</span>
              <span className="font-bold text-[var(--app-text)] shrink-0" data-testid="match-rating-elo-w">
                {report.white.estimatedElo !== null ? report.white.estimatedElo : '—'}
              </span>
            </div>
          </div>

          <div className="bg-[var(--app-surface-2)] border border-[var(--app-border)] rounded-xl p-3 flex flex-col gap-1">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-semibold text-[var(--app-text)] truncate">{blackName}</span>
              <span className="text-xs font-mono font-extrabold text-[var(--app-accent)]">
                {report.black.grade}
              </span>
            </div>
            <div className="text-2xl font-mono font-extrabold tabular-nums text-[var(--app-text)] leading-tight">
              {report.black.accuracy !== null ? `${report.black.accuracy.toFixed(1)}%` : '—'}
            </div>
            <div className="flex items-center justify-between gap-1 text-[11px] text-[var(--app-text-muted)] font-mono tabular-nums pt-1 border-t border-[var(--app-border)]">
              <span className="truncate font-sans">{t('gameElo')}</span>
              <span className="font-bold text-[var(--app-text)] shrink-0" data-testid="match-rating-elo-b">
                {report.black.estimatedElo !== null ? report.black.estimatedElo : '—'}
              </span>
            </div>
          </div>
        </div>
        <p className="text-[10px] text-[var(--app-text-subtle)] leading-snug px-0.5" data-testid="est-elo-disclaimer">
          {t('estEloDisclaimer')}
        </p>
      </div>

      {/* Phase-by-Phase Ratings */}
      {report.analyzedPlies > 0 && (
        <div className="bg-[var(--app-surface-2)] border border-[var(--app-border)] rounded-xl p-3 flex flex-col gap-2">
          <span className="text-xs font-bold text-[var(--app-text)]">{t('phaseAccuracy')}</span>
          <div className="grid grid-cols-3 gap-2 text-center font-mono tabular-nums text-xs">
            {(
              [
                { label: t('phaseOpening'), w: report.white.openingAccuracy, b: report.black.openingAccuracy },
                { label: t('phaseMiddlegame'), w: report.white.middlegameAccuracy, b: report.black.middlegameAccuracy },
                { label: t('phaseEndgame'), w: report.white.endgameAccuracy, b: report.black.endgameAccuracy },
              ] as const
            ).map((phase) => (
              <div key={phase.label} className="bg-[var(--app-surface)] rounded-lg p-2 border border-[var(--app-border)]">
                <div className="text-[10px] font-sans text-[var(--app-text-muted)] mb-1">{phase.label}</div>
                <div className="text-xs font-bold text-[var(--app-text)]">
                  {phase.w !== null ? `${Math.round(phase.w)}%` : '—'}
                  <span className="text-[var(--app-text-subtle)] mx-1">/</span>
                  {phase.b !== null ? `${Math.round(phase.b)}%` : '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-Player Move Classification Table */}
      {report.analyzedPlies > 0 && (
        <div className="bg-[var(--app-surface-2)] border border-[var(--app-border)] rounded-xl p-3 flex flex-col gap-1">
          <div className="grid grid-cols-[1fr_44px_44px] text-[11px] text-[var(--app-text-muted)] pb-1.5 border-b border-[var(--app-border)]">
            <span>{t('moveQuality')}</span>
            <span className="text-right">{t('white')}</span>
            <span className="text-right">{t('black')}</span>
          </div>
          {rows.map((key) => {
            const wCount = report.white.counts[key];
            const bCount = report.black.counts[key];
            if (wCount === 0 && bCount === 0 && (key === 'brilliant' || key === 'great')) return null;
            const meta = CLASSIFICATION_META[key];
            return (
              <div
                key={key}
                className="grid grid-cols-[1fr_44px_44px] items-center text-xs py-1 font-mono tabular-nums"
              >
                <span className="font-sans font-semibold flex items-center gap-2 text-[var(--app-text)]">
                  <MoveBadge classification={key} variant="legend" showTitle={false} />
                  <span style={{ color: meta.color }}>{getClassificationLabel(key)}</span>
                </span>
                <span className="text-right font-bold text-[var(--app-text)]">{wCount}</span>
                <span className="text-right font-bold text-[var(--app-text)]">{bCount}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Key Moments Navigator */}
      {report.keyMoments.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-xs font-bold text-[var(--app-text)]">{t('keyTurningPoints')}</h3>
          {report.keyMoments.map((km) => {
            const meta = CLASSIFICATION_META[km.classification];
            const active = viewPly === km.ply;
            return (
              <button
                key={km.ply}
                type="button"
                onClick={() => onSelectPly(km.ply)}
                className={`w-full text-left p-2.5 rounded-lg border transition-colors flex items-center justify-between gap-2 cursor-pointer anim-interactive ${
                  active
                    ? 'bg-[var(--app-accent-soft)] border-[var(--app-accent)]'
                    : 'bg-[var(--app-surface-2)] border-[var(--app-border)] hover:bg-[var(--app-surface-hover)]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <MoveBadge classification={km.classification} variant="legend" showTitle={false} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs font-mono font-bold">
                      <span style={{ color: meta.color }}>
                        {km.moveNumber}
                        {km.color === 'w' ? '.' : '...'} {km.san}
                      </span>
                      <span className="text-[11px] font-sans font-normal text-[var(--app-text-muted)]">
                        {getClassificationLabel(km.classification)}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--app-text-muted)] truncate mt-0.5">{km.headline}</p>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-[var(--app-text-subtle)] shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      {/* Rate Any PGN Match Inline Drawer */}
      <div className="pt-2 border-t border-[var(--app-border)]">
        {!showPgnBox ? (
          <button
            type="button"
            onClick={() => setShowPgnBox(true)}
            className="w-full py-2 px-3 rounded-lg bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-xs font-semibold text-[var(--app-text)] flex items-center justify-center gap-1.5 transition-colors cursor-pointer anim-interactive"
          >
            <Upload className="w-3.5 h-3.5 text-[var(--app-accent)]" />
            <span>{t('pastePgnAnother')}</span>
          </button>
        ) : (
          <form onSubmit={handlePgnRateSubmit} className="flex flex-col gap-2">
            <label htmlFor="rate-pgn-input" className="text-xs font-bold text-[var(--app-text)]">
              {t('pasteMatchPgn')}
            </label>
            <textarea
              id="rate-pgn-input"
              rows={3}
              value={pgnDraft}
              onChange={(e) => {
                setPgnDraft(e.target.value);
                if (pgnError) setPgnError(null);
              }}
              placeholder="1. e4 e5 2. Nf3 Nc6 3. Bb5 a6..."
              className="w-full rounded-lg bg-[var(--app-surface-2)] border border-[var(--app-border-strong)] focus:border-[var(--app-accent)] focus:outline-none p-2 text-xs font-mono text-[var(--app-text)] resize-none"
            />
            {pgnError && <p className="text-xs text-[#E04F4F]">{pgnError}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowPgnBox(false);
                  setPgnError(null);
                }}
                className="py-2 rounded-lg bg-[var(--app-surface-2)] text-xs font-semibold text-[var(--app-text-muted)] cursor-pointer anim-interactive"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                className="py-2 rounded-lg bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-[var(--app-accent-fg)] text-xs font-extrabold cursor-pointer anim-interactive"
              >
                {t('analyzeAndRate')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
});

MatchRatingPanel.displayName = 'MatchRatingPanel';

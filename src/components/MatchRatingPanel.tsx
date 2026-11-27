import React, { useMemo, useState } from 'react';
import { Award, ChevronRight, Sparkles, Upload } from 'lucide-react';
import { CLASSIFICATION_META, type EvalScore, type MoveRecord } from '../types/chess';
import { buildMatchRatingReport } from '../engine/matchRating';
import { EvalGraph } from './EvalGraph';
import { MoveBadge } from './MoveBadge';

interface MatchRatingPanelProps {
  moves: MoveRecord[];
  viewPly: number;
  whiteName: string;
  blackName: string;
  isReviewing: boolean;
  reviewProgress: number;
  liveEval?: EvalScore | null;
  onRunGameReview: () => void;
  onSelectPly: (ply: number) => void;
  onImportAndRatePgn: (pgn: string) => { ok: boolean; error?: string };
}

export const MatchRatingPanel: React.FC<MatchRatingPanelProps> = ({
  moves,
  viewPly,
  whiteName,
  blackName,
  isReviewing,
  reviewProgress,
  liveEval,
  onRunGameReview,
  onSelectPly,
  onImportAndRatePgn,
}) => {
  const report = useMemo(() => buildMatchRatingReport(moves), [moves]);
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

  const rows: { key: keyof typeof CLASSIFICATION_META; label: string }[] = [
    { key: 'brilliant', label: 'Brilliant' },
    { key: 'great', label: 'Great' },
    { key: 'best', label: 'Best' },
    { key: 'excellent', label: 'Excellent' },
    { key: 'book', label: 'Book' },
    { key: 'good', label: 'Good' },
    { key: 'inaccuracy', label: 'Inaccuracy' },
    { key: 'mistake', label: 'Mistake' },
    { key: 'blunder', label: 'Blunder' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4" data-testid="match-rating-panel">
      {/* Header + Action */}
      <div className="flex items-start justify-between gap-2 pb-3 border-b border-[var(--app-border)]">
        <div>
          <div className="flex items-center gap-1.5">
            <Award className="w-4 h-4 text-[var(--app-accent)] shrink-0" />
            <h2 className="text-sm font-bold text-[var(--app-text)]">Stockfish Match Rating</h2>
          </div>
          <p className="text-xs text-[var(--app-text-muted)] mt-1 leading-relaxed">{report.summaryHeadline}</p>
        </div>
        <button
          type="button"
          onClick={onRunGameReview}
          disabled={moves.length === 0 || isReviewing}
          className="px-3 py-1.5 rounded-md bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] disabled:opacity-40 text-[var(--app-accent-fg)] text-xs font-extrabold transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{isReviewing ? `${reviewProgress}%` : report.isComplete ? 'Re-Rate' : 'Rate Match'}</span>
        </button>
      </div>

      {/* Live Progress Bar while Stockfish reviews all moves */}
      {isReviewing && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-[var(--app-text-muted)] font-mono tabular-nums">
            <span>Stockfish evaluating move by move…</span>
            <span>{reviewProgress}%</span>
          </div>
          <div className="w-full h-2 bg-[var(--app-surface-2)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--app-accent)] transition-[width] duration-200"
              style={{ width: `${reviewProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Advantage Curve */}
      {moves.length > 0 && (
        <EvalGraph moves={moves} viewPly={viewPly} onSelectPly={onSelectPly} liveEval={liveEval} />
      )}

      {/* White vs Black Accuracy & Estimated Game Elo */}
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
          <div className="flex items-center justify-between text-[11px] text-[var(--app-text-muted)] font-mono tabular-nums pt-1 border-t border-[var(--app-border)]">
            <span>Game Elo</span>
            <span className="font-bold text-[var(--app-text)]">
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
          <div className="flex items-center justify-between text-[11px] text-[var(--app-text-muted)] font-mono tabular-nums pt-1 border-t border-[var(--app-border)]">
            <span>Game Elo</span>
            <span className="font-bold text-[var(--app-text)]">
              {report.black.estimatedElo !== null ? report.black.estimatedElo : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Phase-by-Phase Ratings */}
      {report.analyzedPlies > 0 && (
        <div className="bg-[var(--app-surface-2)] border border-[var(--app-border)] rounded-xl p-3 flex flex-col gap-2">
          <span className="text-xs font-bold text-[var(--app-text)]">Phase Accuracy</span>
          <div className="grid grid-cols-3 gap-2 text-center font-mono tabular-nums text-xs">
            {(
              [
                { label: 'Opening', w: report.white.openingAccuracy, b: report.black.openingAccuracy },
                { label: 'Middlegame', w: report.white.middlegameAccuracy, b: report.black.middlegameAccuracy },
                { label: 'Endgame', w: report.white.endgameAccuracy, b: report.black.endgameAccuracy },
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
            <span>Move Quality</span>
            <span className="text-right">White</span>
            <span className="text-right">Black</span>
          </div>
          {rows.map(({ key, label }) => {
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
                  <span style={{ color: meta.color }}>{label}</span>
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
          <h3 className="text-xs font-bold text-[var(--app-text)]">Key Turning Points</h3>
          {report.keyMoments.map((km) => {
            const meta = CLASSIFICATION_META[km.classification];
            const active = viewPly === km.ply;
            return (
              <button
                key={km.ply}
                type="button"
                onClick={() => onSelectPly(km.ply)}
                className={`w-full text-left p-2.5 rounded-lg border transition-colors flex items-center justify-between gap-2 cursor-pointer ${
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
                        {meta.label}
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
            className="w-full py-2 px-3 rounded-lg bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-xs font-semibold text-[var(--app-text)] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-[var(--app-accent)]" />
            <span>Paste PGN to Rate Another Match</span>
          </button>
        ) : (
          <form onSubmit={handlePgnRateSubmit} className="flex flex-col gap-2">
            <label htmlFor="rate-pgn-input" className="text-xs font-bold text-[var(--app-text)]">
              Paste Match PGN
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
                className="py-2 rounded-lg bg-[var(--app-surface-2)] text-xs font-semibold text-[var(--app-text-muted)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="py-2 rounded-lg bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-[var(--app-accent-fg)] text-xs font-extrabold cursor-pointer"
              >
                Load &amp; Rate
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

import React, { useMemo } from 'react';
import { Award, Crown, Home, Plus, X } from 'lucide-react';
import {
  STOCKFISH_LEVELS,
  TIME_CONTROLS,
  type GameMode,
  type GameTermination,
  type MatchSettings,
  type MoveRecord,
  type PlayerSideChoice,
} from '../types/chess';
import { buildGameOverSummary, type SideOutcome } from '../game/matchSummary';
import { useI18n } from '../i18n/LanguageContext';

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onReturnHome: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({ onResume, onRestart, onReturnHome }) => {
  const { t } = useI18n();
  return (
    <div
      className="fixed inset-0 z-50 bg-black/68 flex items-center justify-center p-4 anim-backdrop-enter"
      onClick={(e) => {
        if (e.target === e.currentTarget) onResume();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('matchPaused')}
        className="w-full max-w-sm bg-[var(--app-surface)] border border-[var(--app-border-strong)] rounded-xl p-6 shadow-2xl flex flex-col gap-4 anim-modal-enter"
      >
        <div>
          <h2 className="text-xl font-extrabold text-[var(--app-text)]">{t('matchPaused')}</h2>
          <p className="text-xs text-[var(--app-text-muted)] mt-1">{t('clocksFrozen')}</p>
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onResume}
            className="w-full py-2.5 px-4 rounded-lg bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-[var(--app-accent-fg)] text-sm font-extrabold transition-colors cursor-pointer anim-interactive"
          >
            {t('resumeMatch')}
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="w-full py-2.5 px-4 rounded-lg bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-[var(--app-text)] text-sm font-semibold transition-colors cursor-pointer anim-interactive"
          >
            {t('restartMatch')}
          </button>
          <button
            type="button"
            onClick={onReturnHome}
            className="w-full py-2.5 px-4 rounded-lg bg-transparent hover:bg-[var(--app-surface-hover)] text-[var(--app-text-muted)] hover:text-[var(--app-text)] text-sm font-medium transition-colors cursor-pointer anim-interactive"
          >
            {t('backToHome')}
          </button>
        </div>
      </div>
    </div>
  );
};

interface GameOverModalProps {
  termination: GameTermination;
  whiteName: string;
  blackName: string;
  whiteAvatarImage?: string | null;
  blackAvatarImage?: string | null;
  moves: MoveRecord[];
  finalFen: string;
  onAnalysis: () => void;
  onNewMatch: () => void;
  onReturnHome: () => void;
  onDismiss: () => void;
}

function getOutcomeAccent(outcome: SideOutcome): { ring: string; text: string } {
  if (outcome === 'win') {
    return { ring: 'border-[#81B64C]', text: 'text-[#81B64C]' };
  }
  if (outcome === 'loss') {
    return { ring: 'border-[#D95A5A]/70', text: 'text-[#E06868]' };
  }
  return { ring: 'border-[var(--app-border-strong)]', text: 'text-[var(--app-text-muted)]' };
}

function formatMaterialDiff(val: number): string {
  if (val > 0) return `+${val}`;
  if (val < 0) return `${val}`;
  return '0';
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  termination,
  whiteName,
  blackName,
  whiteAvatarImage,
  blackAvatarImage,
  moves,
  finalFen,
  onAnalysis,
  onNewMatch,
  onReturnHome,
  onDismiss,
}) => {
  const { t } = useI18n();

  const summary = useMemo(
    () => buildGameOverSummary(moves, finalFen, termination),
    [moves, finalFen, termination]
  );

  const headline =
    termination.winner === 'draw'
      ? t('drawResult')
      : termination.winner === 'w'
        ? t('whiteWins')
        : t('blackWins');

  const subOutcome =
    termination.winner === 'w'
      ? `${t('blackLoses')} · ${termination.reason}`
      : termination.winner === 'b'
        ? `${t('whiteLoses')} · ${termination.reason}`
        : termination.reason;

  const whiteOutcomeLabel =
    summary.white.outcome === 'win'
      ? t('outcomeWon')
      : summary.white.outcome === 'loss'
        ? t('outcomeLost')
        : t('outcomeDraw');

  const blackOutcomeLabel =
    summary.black.outcome === 'win'
      ? t('outcomeWon')
      : summary.black.outcome === 'loss'
        ? t('outcomeLost')
        : t('outcomeDraw');

  const whiteStyle = getOutcomeAccent(summary.white.outcome);
  const blackStyle = getOutcomeAccent(summary.black.outcome);

  const statRows: {
    key: string;
    label: string;
    whiteDisplay: string;
    blackDisplay: string;
    whiteBetter?: boolean;
    blackBetter?: boolean;
  }[] = [
    {
      key: 'accuracy',
      label: t('statAccuracy'),
      whiteDisplay: summary.white.accuracy !== null ? `${summary.white.accuracy.toFixed(1)}%` : '—',
      blackDisplay: summary.black.accuracy !== null ? `${summary.black.accuracy.toFixed(1)}%` : '—',
      whiteBetter:
        summary.white.accuracy !== null &&
        summary.black.accuracy !== null &&
        summary.white.accuracy > summary.black.accuracy,
      blackBetter:
        summary.white.accuracy !== null &&
        summary.black.accuracy !== null &&
        summary.black.accuracy > summary.white.accuracy,
    },
    {
      key: 'moves',
      label: t('statMoves'),
      whiteDisplay: String(summary.white.movesCount),
      blackDisplay: String(summary.black.movesCount),
    },
    {
      key: 'captures',
      label: t('statCaptures'),
      whiteDisplay: String(summary.white.captures),
      blackDisplay: String(summary.black.captures),
      whiteBetter: summary.white.captures > summary.black.captures,
      blackBetter: summary.black.captures > summary.white.captures,
    },
    {
      key: 'checks',
      label: t('statChecks'),
      whiteDisplay: String(summary.white.checks),
      blackDisplay: String(summary.black.checks),
      whiteBetter: summary.white.checks > summary.black.checks,
      blackBetter: summary.black.checks > summary.white.checks,
    },
    {
      key: 'material',
      label: t('statMaterial'),
      whiteDisplay: formatMaterialDiff(summary.white.materialBalance),
      blackDisplay: formatMaterialDiff(summary.black.materialBalance),
      whiteBetter: summary.white.materialBalance > 0,
      blackBetter: summary.black.materialBalance > 0,
    },
  ];

  if (summary.white.estimatedElo !== null || summary.black.estimatedElo !== null) {
    statRows.push({
      key: 'elo',
      label: t('statEstElo'),
      whiteDisplay: summary.white.estimatedElo !== null ? String(summary.white.estimatedElo) : '—',
      blackDisplay: summary.black.estimatedElo !== null ? String(summary.black.estimatedElo) : '—',
      whiteBetter:
        summary.white.estimatedElo !== null &&
        summary.black.estimatedElo !== null &&
        summary.white.estimatedElo > summary.black.estimatedElo,
      blackBetter:
        summary.white.estimatedElo !== null &&
        summary.black.estimatedElo !== null &&
        summary.black.estimatedElo > summary.white.estimatedElo,
    });
  }

  return (
    <div
      data-testid="gameover-overlay"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] flex items-center justify-center p-4 anim-backdrop-enter"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={headline}
        data-testid="gameover-dialog"
        className="relative w-full max-w-[440px] max-h-[92vh] overflow-y-auto bg-[var(--app-surface)] border border-[var(--app-border-strong)] rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4 anim-modal-enter"
      >
        {/* Top-Right Close Button */}
        <button
          type="button"
          aria-label={t('close')}
          onClick={onDismiss}
          className="absolute top-3.5 right-3.5 w-8 h-8 rounded-lg bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-[var(--app-text-muted)] hover:text-[var(--app-text)] flex items-center justify-center transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Result Headline */}
        <div className="text-center pt-1 px-6">
          <h2 className="text-2xl font-extrabold tracking-tight text-[var(--app-text)] leading-tight">
            {headline}
          </h2>
          <p className="text-xs sm:text-sm text-[var(--app-text-muted)] mt-1">{subOutcome}</p>
        </div>

        {/* Chess.com-Style VS Player Cards */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 bg-[var(--app-surface-2)] border border-[var(--app-border)] rounded-xl px-3.5 py-3.5">
          {/* White Side */}
          <div className="flex flex-col items-center text-center min-w-0 gap-1.5">
            <div className="relative">
              {whiteAvatarImage ? (
                <img
                  src={whiteAvatarImage}
                  alt={whiteName}
                  className={`w-12 h-12 rounded-xl object-cover border-2 ${whiteStyle.ring}`}
                />
              ) : (
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-extrabold bg-[#F3EFE6] text-[#1C1B18] border-2 ${whiteStyle.ring}`}
                >
                  ♔
                </div>
              )}
              {summary.white.outcome === 'win' && (
                <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#81B64C] text-[#12160D] flex items-center justify-center shadow">
                  <Crown className="w-3 h-3" />
                </span>
              )}
            </div>
            <div className="text-xs font-bold text-[var(--app-text)] truncate w-full">{whiteName}</div>
            <div className={`text-[11px] font-extrabold tracking-wide ${whiteStyle.text}`}>
              {t('white')} · {whiteOutcomeLabel}
            </div>
          </div>

          {/* Center Score */}
          <div className="flex flex-col items-center justify-center px-1">
            <div className="text-lg sm:text-xl font-mono font-extrabold tabular-nums text-[var(--app-text)] whitespace-nowrap">
              {summary.scoreLabel}
            </div>
          </div>

          {/* Black Side */}
          <div className="flex flex-col items-center text-center min-w-0 gap-1.5">
            <div className="relative">
              {blackAvatarImage ? (
                <img
                  src={blackAvatarImage}
                  alt={blackName}
                  className={`w-12 h-12 rounded-xl object-cover border-2 ${blackStyle.ring}`}
                />
              ) : (
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-extrabold bg-[#262522] text-[#F3EFE6] border-2 ${blackStyle.ring}`}
                >
                  ♚
                </div>
              )}
              {summary.black.outcome === 'win' && (
                <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#81B64C] text-[#12160D] flex items-center justify-center shadow">
                  <Crown className="w-3 h-3" />
                </span>
              )}
            </div>
            <div className="text-xs font-bold text-[var(--app-text)] truncate w-full">{blackName}</div>
            <div className={`text-[11px] font-extrabold tracking-wide ${blackStyle.text}`}>
              {t('black')} · {blackOutcomeLabel}
            </div>
          </div>
        </div>

        {/* Dual-Side Match Statistics Comparison */}
        <div
          data-testid="gameover-stats"
          className="bg-[var(--app-surface-2)] border border-[var(--app-border)] rounded-xl divide-y divide-[var(--app-border)] overflow-hidden"
        >
          {statRows.map((row) => (
            <div
              key={row.key}
              className="grid grid-cols-[1fr_auto_1fr] items-center px-4 py-2 text-xs"
            >
              <div
                className={`font-mono tabular-nums font-bold text-left ${
                  row.whiteBetter ? 'text-[var(--app-accent)]' : 'text-[var(--app-text)]'
                }`}
              >
                {row.whiteDisplay}
              </div>
              <div className="text-[11px] font-semibold text-[var(--app-text-muted)] text-center px-2">
                {row.label}
              </div>
              <div
                className={`font-mono tabular-nums font-bold text-right ${
                  row.blackBetter ? 'text-[var(--app-accent)]' : 'text-[var(--app-text)]'
                }`}
              >
                {row.blackDisplay}
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons: Analysis, New Match, Home */}
        <div className="flex flex-col gap-2.5 pt-0.5">
          <button
            type="button"
            data-testid="gameover-analysis"
            onClick={onAnalysis}
            className="w-full py-3 px-4 rounded-xl bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-[var(--app-accent-fg)] text-sm font-extrabold transition-colors shadow-[0_4px_0_var(--app-accent-shadow)] cursor-pointer flex items-center justify-center gap-2 anim-interactive"
          >
            <Award className="w-4 h-4" />
            <span>{t('overlayAnalysis')}</span>
          </button>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              data-start="true"
              data-testid="gameover-new-match"
              onClick={onNewMatch}
              className="py-2.5 px-3 rounded-xl bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border-strong)] text-[var(--app-text)] text-sm font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 anim-interactive"
            >
              <Plus className="w-4 h-4 text-[var(--app-accent)]" />
              <span>{t('overlayNewMatch')}</span>
            </button>

            <button
              type="button"
              data-testid="gameover-home"
              onClick={onReturnHome}
              className="py-2.5 px-3 rounded-xl bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border-strong)] text-[var(--app-text)] text-sm font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 anim-interactive"
            >
              <Home className="w-4 h-4 text-[var(--app-text-muted)]" />
              <span>{t('overlayHome')}</span>
            </button>
          </div>
        </div>

        <p className="text-[11px] text-center text-[var(--app-text-subtle)] -mt-1">
          {t('clickOutsideToHide')}
        </p>
      </div>
    </div>
  );
};

interface NewMatchModalProps {
  settings: MatchSettings;
  onChangeSettings: (next: MatchSettings) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export const NewMatchModal: React.FC<NewMatchModalProps> = ({
  settings,
  onChangeSettings,
  onConfirm,
  onCancel,
}) => {
  const { t } = useI18n();
  return (
    <div
      className="fixed inset-0 z-50 bg-black/68 flex items-center justify-center p-4 anim-backdrop-enter"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('newMatchTitle')}
        className="w-full max-w-md bg-[var(--app-surface)] border border-[var(--app-border-strong)] rounded-xl p-5 shadow-2xl flex flex-col gap-4 anim-modal-enter"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-[var(--app-text)]">{t('newMatchTitle')}</h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-[var(--app-text-muted)] hover:text-[var(--app-text)] cursor-pointer"
          >
            {t('close')}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1.5 p-1 bg-[var(--app-surface-2)] rounded-lg">
          {(
            [
              { id: 'stockfish', label: t('modeStockfishTitle') },
              { id: 'local', label: t('modeLocalTitle') },
              { id: 'analysis', label: t('tabRating') },
            ] as { id: GameMode; label: string }[]
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onChangeSettings({ ...settings, mode: m.id })}
              className={`py-2 px-1 text-xs font-semibold rounded-md cursor-pointer truncate ${
                settings.mode === m.id
                  ? 'bg-[var(--app-surface)] text-[var(--app-text)] shadow-sm'
                  : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {settings.mode === 'stockfish' && (
          <div className="grid grid-cols-3 gap-1.5">
            {STOCKFISH_LEVELS.map((lvl) => (
              <button
                key={lvl.id}
                type="button"
                onClick={() => onChangeSettings({ ...settings, stockfishLevelId: lvl.id })}
                className={`p-2 rounded-lg text-left border cursor-pointer anim-interactive ${
                  lvl.id === settings.stockfishLevelId
                    ? 'bg-[var(--app-accent-soft)] border-[var(--app-accent)] text-[var(--app-text)]'
                    : 'bg-[var(--app-surface-2)] border-[var(--app-border)] text-[var(--app-text-muted)]'
                }`}
              >
                <div className="text-xs font-mono font-bold tabular-nums">{lvl.elo}</div>
                <div className="text-[11px] truncate opacity-80">{lvl.name}</div>
              </button>
            ))}
          </div>
        )}

        {settings.mode !== 'analysis' && (
          <div className="grid grid-cols-4 gap-1.5">
            {TIME_CONTROLS.map((tc) => (
              <button
                key={tc.id}
                type="button"
                onClick={() => onChangeSettings({ ...settings, timeControlId: tc.id })}
                className={`py-1.5 px-2 rounded-lg text-xs font-medium border cursor-pointer truncate anim-interactive ${
                  tc.id === 'unlimited' ? 'col-span-2' : ''
                } ${
                  tc.id === settings.timeControlId
                    ? 'bg-[var(--app-accent-soft)] border-[var(--app-accent)] text-[var(--app-text)]'
                    : 'bg-[var(--app-surface-2)] border-[var(--app-border)] text-[var(--app-text-muted)]'
                }`}
              >
                {tc.id === 'unlimited' ? t('unlimited') : tc.label}
              </button>
            ))}
          </div>
        )}

        {settings.mode !== 'analysis' && (
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--app-text-muted)]">{t('playAs')}</span>
            <div className="flex gap-1.5">
              {(['w', 'random', 'b'] as PlayerSideChoice[]).map((side) => (
                <button
                  key={side}
                  type="button"
                  onClick={() => onChangeSettings({ ...settings, playerSide: side })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer anim-interactive ${
                    settings.playerSide === side
                      ? 'bg-[var(--app-accent-soft)] border-[var(--app-accent)] text-[var(--app-text)]'
                      : 'bg-[var(--app-surface-2)] border-[var(--app-border)] text-[var(--app-text-muted)]'
                  }`}
                >
                  {side === 'w' ? t('white') : side === 'b' ? t('black') : t('random')}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="py-2.5 rounded-lg bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-hover)] text-xs font-semibold text-[var(--app-text-muted)] cursor-pointer anim-interactive"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="py-2.5 rounded-lg bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-xs font-extrabold text-[var(--app-accent-fg)] cursor-pointer anim-interactive"
          >
            {t('startMatch')}
          </button>
        </div>
      </div>
    </div>
  );
};


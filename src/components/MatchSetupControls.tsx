import React from 'react';
import {
  STOCKFISH_LEVELS,
  TIME_CONTROLS,
  type MatchSettings,
  type PlayerSideChoice,
} from '../types/chess';
import { useI18n } from '../i18n/LanguageContext';

interface OpponentSelectorProps {
  value: 'stockfish' | 'local';
  onChange: (next: 'stockfish' | 'local') => void;
  testIdPrefix: string;
  compact?: boolean;
}

export const OpponentSelector: React.FC<OpponentSelectorProps> = ({
  value,
  onChange,
  testIdPrefix,
  compact = false,
}) => {
  const { t } = useI18n();
  return (
    <div>
      <span className="block text-xs font-semibold text-[var(--app-text-muted)] mb-2">
        {t('opponentLabel')}
      </span>
      <div className={`grid grid-cols-2 ${compact ? 'gap-1.5' : 'gap-2'}`}>
        {(
          [
            { id: 'stockfish', label: t('opponentStockfish') },
            { id: 'local', label: t('opponentOffline') },
          ] as const
        ).map((opt) => (
          <button
            key={opt.id}
            type="button"
            data-testid={`${testIdPrefix}-opponent-${opt.id}`}
            onClick={() => onChange(opt.id)}
            className={`px-3 ${compact ? 'py-2' : 'py-2.5'} rounded-lg text-xs font-semibold border transition-colors cursor-pointer text-center truncate anim-interactive ${
              value === opt.id
                ? 'bg-[var(--app-accent-soft)] border-[var(--app-accent)] text-[var(--app-text)]'
                : 'bg-[var(--app-surface-2)] border-[var(--app-border)] text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
};

interface StockfishStrengthSelectorProps {
  levelId: MatchSettings['stockfishLevelId'];
  onChange: (levelId: MatchSettings['stockfishLevelId']) => void;
  testId?: string;
  compact?: boolean;
}

export const StockfishStrengthSelector: React.FC<StockfishStrengthSelectorProps> = ({
  levelId,
  onChange,
  testId,
  compact = false,
}) => {
  const { t } = useI18n();
  const activeLevel = STOCKFISH_LEVELS.find((l) => l.id === levelId) ?? STOCKFISH_LEVELS[2];

  return (
    <div data-testid={testId}>
      <div className="flex flex-wrap items-center justify-between gap-1 mb-2">
        <span className="text-xs font-semibold text-[var(--app-text-muted)]">
          {t('stockfishStrength')}
        </span>
        <span className="text-xs font-mono tabular-nums font-bold text-[var(--app-accent)] whitespace-nowrap">
          {activeLevel.name} · {activeLevel.elo}
        </span>
      </div>
      <div className={`grid grid-cols-3 ${compact ? 'gap-1.5' : 'gap-2'}`}>
        {STOCKFISH_LEVELS.map((lvl) => {
          const selected = lvl.id === levelId;
          return (
            <button
              key={lvl.id}
              type="button"
              onClick={() => onChange(lvl.id)}
              className={`${compact ? 'py-2 px-2' : 'py-2.5 px-2.5'} rounded-lg text-left border transition-colors cursor-pointer anim-interactive ${
                selected
                  ? 'bg-[var(--app-accent-soft)] border-[var(--app-accent)] text-[var(--app-text)]'
                  : 'bg-[var(--app-surface-2)] border-[var(--app-border)] text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
              }`}
            >
              <div className="text-xs font-mono font-bold tabular-nums">{lvl.elo}</div>
              <div className="text-[11px] truncate opacity-85">{lvl.name}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

interface TimeControlSelectorProps {
  timeControlId: MatchSettings['timeControlId'];
  onChange: (timeControlId: MatchSettings['timeControlId']) => void;
}

export const TimeControlSelector: React.FC<TimeControlSelectorProps> = ({
  timeControlId,
  onChange,
}) => {
  const { t } = useI18n();
  return (
    <div>
      <span className="block text-xs font-semibold text-[var(--app-text-muted)] mb-2">
        {t('timeControl')}
      </span>
      <div className="grid grid-cols-4 gap-1.5">
        {TIME_CONTROLS.map((tc) => {
          const selected = tc.id === timeControlId;
          return (
            <button
              key={tc.id}
              type="button"
              onClick={() => onChange(tc.id)}
              className={`py-2 px-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap truncate cursor-pointer anim-interactive ${
                tc.id === 'unlimited' ? 'col-span-2' : ''
              } ${
                selected
                  ? 'bg-[var(--app-accent-soft)] border-[var(--app-accent)] text-[var(--app-text)]'
                  : 'bg-[var(--app-surface-2)] border-[var(--app-border)] text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
              }`}
            >
              {tc.id === 'unlimited' ? t('unlimited') : tc.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

interface PlaySideSelectorProps {
  playerSide: PlayerSideChoice;
  onChange: (playerSide: PlayerSideChoice) => void;
  compact?: boolean;
}

export const PlaySideSelector: React.FC<PlaySideSelectorProps> = ({
  playerSide,
  onChange,
  compact = false,
}) => {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-xs font-semibold text-[var(--app-text-muted)]">{t('playAs')}</span>
      <div
        className={`grid grid-cols-3 gap-1.5 flex-1 ${
          compact ? 'min-w-[180px] max-w-[260px]' : 'min-w-[190px] max-w-[280px]'
        }`}
      >
        {(
          [
            { id: 'w', label: t('white') },
            { id: 'random', label: t('random') },
            { id: 'b', label: t('black') },
          ] as { id: PlayerSideChoice; label: string }[]
        ).map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(s.id)}
            className={`px-2 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer text-center truncate anim-interactive ${
              playerSide === s.id
                ? 'bg-[var(--app-accent-soft)] border-[var(--app-accent)] text-[var(--app-text)]'
                : 'bg-[var(--app-surface-2)] border-[var(--app-border)] text-[var(--app-text-muted)]'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
};

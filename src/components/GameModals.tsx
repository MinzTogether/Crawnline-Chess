import React from 'react';
import {
  STOCKFISH_LEVELS,
  TIME_CONTROLS,
  type GameMode,
  type GameTermination,
  type MatchSettings,
  type PlayerSideChoice,
} from '../types/chess';

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onReturnHome: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({ onResume, onRestart, onReturnHome }) => (
  <div className="fixed inset-0 z-50 bg-black/68 flex items-center justify-center p-4">
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Game paused"
      className="w-full max-w-sm bg-[var(--app-surface)] border border-[var(--app-border-strong)] rounded-xl p-6 shadow-2xl flex flex-col gap-4"
    >
      <div>
        <h2 className="text-xl font-extrabold text-[var(--app-text)]">Match Paused</h2>
        <p className="text-xs text-[var(--app-text-muted)] mt-1">Clocks are frozen until you resume.</p>
      </div>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onResume}
          className="w-full py-2.5 px-4 rounded-lg bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-[var(--app-accent-fg)] text-sm font-extrabold transition-colors cursor-pointer"
        >
          Resume Match
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="w-full py-2.5 px-4 rounded-lg bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-[var(--app-text)] text-sm font-semibold transition-colors cursor-pointer"
        >
          Restart Match
        </button>
        <button
          type="button"
          onClick={onReturnHome}
          className="w-full py-2.5 px-4 rounded-lg bg-transparent hover:bg-[var(--app-surface-hover)] text-[var(--app-text-muted)] hover:text-[var(--app-text)] text-sm font-medium transition-colors cursor-pointer"
        >
          Back to Home
        </button>
      </div>
    </div>
  </div>
);

interface GameOverModalProps {
  termination: GameTermination;
  whiteName: string;
  blackName: string;
  totalMoves: number;
  whiteAccuracy: number | null;
  blackAccuracy: number | null;
  onRateMatch: () => void;
  onPlayAgain: () => void;
  onDismiss: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  termination,
  whiteName,
  blackName,
  totalMoves,
  whiteAccuracy,
  blackAccuracy,
  onRateMatch,
  onPlayAgain,
  onDismiss,
}) => {
  const headline =
    termination.winner === 'draw'
      ? 'Draw'
      : termination.winner === 'w'
        ? `${whiteName} Wins`
        : `${blackName} Wins`;

  return (
    <div className="fixed inset-0 z-50 bg-black/68 flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Game over summary"
        className="w-full max-w-md bg-[var(--app-surface)] border border-[var(--app-border-strong)] rounded-xl p-6 shadow-2xl flex flex-col gap-5"
      >
        <div className="text-center">
          <div className="text-xs font-mono font-bold text-[var(--app-accent)] tracking-wider">
            {termination.resultString}
          </div>
          <h2 className="text-2xl font-extrabold text-[var(--app-text)] mt-1">{headline}</h2>
          <p className="text-sm text-[var(--app-text-muted)] mt-1">{termination.reason}</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[var(--app-surface-2)] rounded-lg p-3 text-center border border-[var(--app-border)]">
            <div className="text-[11px] text-[var(--app-text-muted)]">Moves</div>
            <div className="text-lg font-mono font-bold tabular-nums text-[var(--app-text)] mt-0.5">
              {Math.ceil(totalMoves / 2)}
            </div>
          </div>
          <div className="bg-[var(--app-surface-2)] rounded-lg p-3 text-center border border-[var(--app-border)]">
            <div className="text-[11px] text-[var(--app-text-muted)]">White Acc.</div>
            <div className="text-lg font-mono font-bold tabular-nums text-[var(--app-text)] mt-0.5">
              {whiteAccuracy !== null ? `${whiteAccuracy.toFixed(0)}%` : '—'}
            </div>
          </div>
          <div className="bg-[var(--app-surface-2)] rounded-lg p-3 text-center border border-[var(--app-border)]">
            <div className="text-[11px] text-[var(--app-text-muted)]">Black Acc.</div>
            <div className="text-lg font-mono font-bold tabular-nums text-[var(--app-text)] mt-0.5">
              {blackAccuracy !== null ? `${blackAccuracy.toFixed(0)}%` : '—'}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onRateMatch}
            className="w-full py-2.5 px-4 rounded-lg bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-[var(--app-accent-fg)] text-sm font-extrabold transition-colors cursor-pointer"
          >
            Rate &amp; Analyze Match with Stockfish
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              data-start="true"
              onClick={onPlayAgain}
              className="py-2.5 px-4 rounded-lg bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-[var(--app-text)] text-sm font-semibold transition-colors cursor-pointer"
            >
              Play Again
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="py-2.5 px-4 rounded-lg bg-transparent hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-[var(--app-text-muted)] hover:text-[var(--app-text)] text-sm font-medium transition-colors cursor-pointer"
            >
              Inspect Board
            </button>
          </div>
        </div>
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
}) => (
  <div className="fixed inset-0 z-50 bg-black/68 flex items-center justify-center p-4">
    <div
      role="dialog"
      aria-modal="true"
      aria-label="New match setup"
      className="w-full max-w-md bg-[var(--app-surface)] border border-[var(--app-border-strong)] rounded-xl p-5 shadow-2xl flex flex-col gap-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-[var(--app-text)]">New Match</h2>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-[var(--app-text-muted)] hover:text-[var(--app-text)] cursor-pointer"
        >
          Close
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1.5 p-1 bg-[var(--app-surface-2)] rounded-lg">
        {(
          [
            { id: 'stockfish', label: 'Vs Stockfish' },
            { id: 'local', label: 'Pass & Play' },
            { id: 'analysis', label: 'Rate / Analyze' },
          ] as { id: GameMode; label: string }[]
        ).map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onChangeSettings({ ...settings, mode: m.id })}
            className={`py-2 text-xs font-semibold rounded-md cursor-pointer ${
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
              className={`p-2 rounded-lg text-left border cursor-pointer ${
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
              className={`py-1.5 px-2 rounded-lg text-xs font-medium border cursor-pointer ${
                tc.id === settings.timeControlId
                  ? 'bg-[var(--app-accent-soft)] border-[var(--app-accent)] text-[var(--app-text)]'
                  : 'bg-[var(--app-surface-2)] border-[var(--app-border)] text-[var(--app-text-muted)]'
              }`}
            >
              {tc.label}
            </button>
          ))}
        </div>
      )}

      {settings.mode === 'stockfish' && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[var(--app-text-muted)]">Play As</span>
          <div className="flex gap-1.5">
            {(['w', 'random', 'b'] as PlayerSideChoice[]).map((side) => (
              <button
                key={side}
                type="button"
                onClick={() => onChangeSettings({ ...settings, playerSide: side })}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                  settings.playerSide === side
                    ? 'bg-[var(--app-accent-soft)] border-[var(--app-accent)] text-[var(--app-text)]'
                    : 'bg-[var(--app-surface-2)] border-[var(--app-border)] text-[var(--app-text-muted)]'
                }`}
              >
                {side === 'w' ? 'White' : side === 'b' ? 'Black' : 'Random'}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="py-2.5 rounded-lg bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-hover)] text-xs font-semibold text-[var(--app-text-muted)] cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="py-2.5 rounded-lg bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-xs font-extrabold text-[var(--app-accent-fg)] cursor-pointer"
        >
          Start Match
        </button>
      </div>
    </div>
  </div>
);

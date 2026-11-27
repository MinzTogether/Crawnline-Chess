import React from 'react';
import type { Color, PieceSymbol } from 'chess.js';
import { formatClock, formatMaterialDifference } from '../game/chessLogic';
import { PIECE_UNICODE } from './ChessPieces';

interface PlayerBarProps {
  name: string;
  subtitle: string;
  color: Color;
  avatarImage?: string | null;
  isActiveTurn: boolean;
  isEngineThinking?: boolean;
  capturedPieces: PieceSymbol[];
  materialAdvantage: number;
  showMaterialDifference?: boolean;
  clockSeconds: number | null;
  accuracy: number | null;
}

export const PlayerBar: React.FC<PlayerBarProps> = React.memo(({
  name,
  subtitle,
  color,
  avatarImage,
  isActiveTurn,
  isEngineThinking = false,
  capturedPieces,
  materialAdvantage,
  showMaterialDifference = true,
  clockSeconds,
  accuracy,
}) => {
  const isLowTime = clockSeconds !== null && clockSeconds > 0 && clockSeconds <= 20;
  const isFlagged = clockSeconds !== null && clockSeconds <= 0;
  const materialDiffLabel = formatMaterialDifference(materialAdvantage, showMaterialDifference);

  return (
    <div className="arena-player-bar flex items-center justify-between gap-3 py-2 px-1">
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        {avatarImage ? (
          <img
            src={avatarImage}
            alt={name}
            className="arena-player-avatar w-9 h-9 rounded-md shrink-0 object-cover border border-[var(--app-border-strong)]"
          />
        ) : (
          <div
            className={`arena-player-avatar w-9 h-9 rounded-md shrink-0 flex items-center justify-center border font-bold text-sm ${
              color === 'w'
                ? 'bg-[#ECEAE4] text-[#181817] border-black/15'
                : 'bg-[#2A2926] text-[#F1EFEA] border-white/15'
            }`}
            aria-hidden="true"
          >
            {color === 'w' ? '♔' : '♚'}
          </div>
        )}

        <div className="min-w-0">
          <div className="arena-player-name flex items-center gap-2 text-sm">
            <span className="font-bold text-[var(--app-text)] truncate">{name}</span>
            {subtitle && <span className="text-xs text-[var(--app-text-muted)] whitespace-nowrap">{subtitle}</span>}
            {accuracy !== null && (
              <span className="text-xs font-mono tabular-nums text-[var(--app-accent)] font-semibold whitespace-nowrap">
                · {accuracy.toFixed(1)}%
              </span>
            )}
            {isEngineThinking && (
              <span className="text-xs text-[#E6A832] whitespace-nowrap">· Thinking…</span>
            )}
          </div>

          <div className="arena-player-subrow flex items-center gap-1.5 min-h-[18px] text-xs text-[var(--app-text-muted)]">
            {capturedPieces.length > 0 ? (
              <span
                data-testid={`player-captured-${color}`}
                className="tracking-[-0.12em] text-sm leading-none text-[var(--app-text)] opacity-85"
                aria-label="Captured pieces"
              >
                {capturedPieces.map((p, idx) => (
                  <span key={`${p}-${idx}`}>{PIECE_UNICODE[p]}</span>
                ))}
              </span>
            ) : !materialDiffLabel ? (
              <span className="arena-player-idle-text text-[11px] text-[var(--app-text-subtle)]">
                {isActiveTurn ? 'To move' : 'Waiting'}
              </span>
            ) : null}
            {materialDiffLabel && (
              <span
                data-testid={`player-material-diff-${color}`}
                aria-label={`Material advantage ${materialDiffLabel}`}
                className="font-mono tabular-nums text-[11px] font-bold leading-none text-[var(--app-text)] opacity-90 ml-0.5"
              >
                {materialDiffLabel}
              </span>
            )}
          </div>
        </div>
      </div>

      {clockSeconds !== null && (
        <div
          className={`arena-player-clock px-3.5 py-1.5 rounded-md font-mono font-bold text-lg tabular-nums tracking-tight shrink-0 transition-colors border ${
            isFlagged
              ? 'bg-[#C94A4A] text-white border-[#E06A6A]'
              : isActiveTurn
                ? isLowTime
                  ? 'bg-[#7A2727] text-white border-[#C94A4A]'
                  : 'bg-[#ECEAE4] text-[#181817] border-black/15 shadow-sm'
                : 'bg-[var(--app-surface)] text-[var(--app-text-muted)] border-[var(--app-border)]'
          }`}
          aria-label={`${name} clock ${formatClock(clockSeconds)}`}
        >
          {formatClock(clockSeconds)}
        </div>
      )}
    </div>
  );
});

PlayerBar.displayName = 'PlayerBar';

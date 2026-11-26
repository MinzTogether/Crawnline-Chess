import React from 'react';
import type { Color, PieceSymbol } from 'chess.js';
import { formatClock } from '../game/chessLogic';
import { PIECE_UNICODE } from './ChessPieces';

interface PlayerBarProps {
  name: string;
  subtitle: string;
  color: Color;
  isActiveTurn: boolean;
  isEngineThinking?: boolean;
  capturedPieces: PieceSymbol[];
  materialAdvantage: number; // positive if THIS player leads
  clockSeconds: number | null; // null when Unlimited or Analysis
  accuracy: number | null;
}

export const PlayerBar: React.FC<PlayerBarProps> = ({
  name,
  subtitle,
  color,
  isActiveTurn,
  isEngineThinking = false,
  capturedPieces,
  materialAdvantage,
  clockSeconds,
  accuracy,
}) => {
  const isLowTime = clockSeconds !== null && clockSeconds > 0 && clockSeconds <= 20;
  const isFlagged = clockSeconds !== null && clockSeconds <= 0;

  return (
    <div className="flex items-center justify-between gap-3 py-2 px-1">
      <div className="flex items-center gap-3 min-w-0">
        {/* Compact avatar square */}
        <div
          className={`w-9 h-9 rounded-md shrink-0 flex items-center justify-center border font-bold text-sm ${
            color === 'w'
              ? 'bg-[#ECEAE4] text-[#181817] border-white/20'
              : 'bg-[#2A2926] text-[#F1EFEA] border-white/15'
          }`}
          aria-hidden="true"
        >
          {color === 'w' ? '♔' : '♚'}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-bold text-[#F3F1EC] truncate">{name}</span>
            <span className="text-xs text-[#9C9990] whitespace-nowrap">{subtitle}</span>
            {accuracy !== null && (
              <span className="text-xs font-mono tabular-nums text-[#81B64C] whitespace-nowrap">
                · {accuracy.toFixed(1)}%
              </span>
            )}
            {isEngineThinking && (
              <span className="text-xs text-[#E6A832] whitespace-nowrap">· Thinking…</span>
            )}
          </div>

          {/* Captured pieces + material delta */}
          <div className="flex items-center gap-1.5 min-h-[18px] text-xs text-[#A8A59E]">
            {capturedPieces.length > 0 ? (
              <span className="tracking-[-0.12em] text-sm leading-none text-[#C8C5BC]" aria-label="Captured pieces">
                {capturedPieces.map((p, idx) => (
                  <span key={`${p}-${idx}`}>{PIECE_UNICODE[p]}</span>
                ))}
              </span>
            ) : (
              <span className="text-[11px] text-[#6F6D67]">
                {isActiveTurn ? 'To move' : 'Waiting'}
              </span>
            )}
            {materialAdvantage > 0 && (
              <span className="font-mono tabular-nums text-[11px] font-semibold text-[#D6D3CB] ml-1">
                +{materialAdvantage}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Chess Clock */}
      {clockSeconds !== null && (
        <div
          className={`px-3.5 py-1.5 rounded-md font-mono font-bold text-lg tabular-nums tracking-tight shrink-0 transition-colors border ${
            isFlagged
              ? 'bg-[#C94A4A] text-white border-[#E06A6A]'
              : isActiveTurn
                ? isLowTime
                  ? 'bg-[#7A2727] text-white border-[#C94A4A]'
                  : 'bg-[#ECEAE4] text-[#181817] border-white'
                : 'bg-[#252422] text-[#8E8B84] border-white/[0.06]'
          }`}
          aria-label={`${name} clock ${formatClock(clockSeconds)}`}
        >
          {formatClock(clockSeconds)}
        </div>
      )}
    </div>
  );
};

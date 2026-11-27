import React from 'react';
import { CLASSIFICATION_META, type MoveClassification } from '../types/chess';

interface MoveBadgeProps {
  classification: MoveClassification;
  /**
   * - `board`: 22-24px high-contrast Chess.com-style circular token overlaid on the destination square
   * - `inline`: 16px crisp token used next to SAN moves in Move History & MobileMoveBar
   * - `legend`: 20px token used in Match Rating tables & Key Turning Points
   */
  variant?: 'board' | 'inline' | 'legend';
  className?: string;
  showTitle?: boolean;
}

interface ChessComBadgePalette {
  fill: string;
  lip: string;
  glyph: string;
}

/**
 * Chess.com Game Review authentic color palette for all 9 move classifications:
 * Brilliant (Teal !!), Great (Blue !), Best (Green Star), Excellent (Green Thumbs-Up),
 * Book (Brown Open Book), Good (Sage Checkmark), Inaccuracy (Gold ?!), Mistake (Orange ?), Blunder (Crimson ??).
 */
const CHESSCOM_BADGE_PALETTES: Record<MoveClassification, ChessComBadgePalette> = {
  brilliant: {
    fill: '#1BADA6',
    lip: '#13827C',
    glyph: '#FFFFFF',
  },
  great: {
    fill: '#5089C6',
    lip: '#39699E',
    glyph: '#FFFFFF',
  },
  best: {
    fill: '#96BC4B',
    lip: '#729433',
    glyph: '#FFFFFF',
  },
  excellent: {
    fill: '#8AB846',
    lip: '#688F2F',
    glyph: '#FFFFFF',
  },
  book: {
    fill: '#A88865',
    lip: '#806446',
    glyph: '#FFFFFF',
  },
  good: {
    fill: '#96AF8B',
    lip: '#738C68',
    glyph: '#FFFFFF',
  },
  inaccuracy: {
    fill: '#E8AC1A',
    lip: '#BD860C',
    glyph: '#FFFFFF',
  },
  mistake: {
    fill: '#E58F2A',
    lip: '#B86C16',
    glyph: '#FFFFFF',
  },
  blunder: {
    fill: '#CA3431',
    lip: '#9A211F',
    glyph: '#FFFFFF',
  },
};

const SIZE_CLASSES: Record<NonNullable<MoveBadgeProps['variant']>, string> = {
  board: 'w-[22px] h-[22px] sm:w-[25px] sm:h-[25px]',
  inline: 'w-[16px] h-[16px]',
  legend: 'w-[20px] h-[20px]',
};

function renderChessComGlyph(classification: MoveClassification, color: string) {
  switch (classification) {
    case 'brilliant':
      // Chess.com iconic bold double exclamation "!!"
      return (
        <g fill={color}>
          <path d="M6.4 4.8h3.4l-.65 9.1H7.05L6.4 4.8z" />
          <circle cx="8.1" cy="17.1" r="1.75" />
          <path d="M14.2 4.8h3.4l-.65 9.1h-2.1L14.2 4.8z" />
          <circle cx="15.9" cy="17.1" r="1.75" />
        </g>
      );

    case 'great':
      // Chess.com iconic bold single exclamation "!"
      return (
        <g fill={color}>
          <path d="M9.9 4.5h4.2l-.75 9.5h-2.7L9.9 4.5z" />
          <circle cx="12" cy="17.4" r="2.0" />
        </g>
      );

    case 'best':
      // Chess.com iconic centered 5-point star
      return (
        <path
          fill={color}
          d="M12 4.2l2.32 4.82 5.3.71-3.88 3.68.96 5.25L12 16.12l-4.7 2.54.96-5.25-3.88-3.68 5.3-.71L12 4.2z"
        />
      );

    case 'excellent':
      // Chess.com iconic white thumbs-up
      return (
        <g fill={color}>
          {/* Wrist cuff */}
          <rect x="5.2" y="10.8" width="2.9" height="6.8" rx="0.9" />
          {/* Hand + raised thumb */}
          <path d="M9.3 11.1c0-.45.2-.9.52-1.22l2.6-2.95c.46-.52.66-1.22.58-1.92-.04-.4.27-.76.67-.76h.35c1.1 0 1.92.95 1.78 2.04l-.35 2.71h2.48c1.12 0 1.96 1.02 1.75 2.12l-.74 3.92c-.22 1.17-1.24 2.02-2.43 2.02H10.5c-.66 0-1.2-.54-1.2-1.2v-4.76z" />
        </g>
      );

    case 'book':
      // Chess.com iconic open book silhouette
      return (
        <g fill={color}>
          <path d="M5.2 6.6c2.25-.45 4.75.1 6.35 1.45v9.45c-1.7-1.15-4.2-1.55-6.35-1.15a.72.72 0 0 1-.85-.71V7.42c0-.42.32-.74.85-.82z" />
          <path d="M18.8 6.6c-2.25-.45-4.75.1-6.35 1.45v9.45c1.7-1.15 4.2-1.55 6.35-1.15a.72.72 0 0 0 .85-.71V7.42c0-.42-.32-.74-.85-.82z" />
        </g>
      );

    case 'good':
      // Chess.com iconic clean bold checkmark
      return (
        <path
          fill="none"
          stroke={color}
          strokeWidth="3.1"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6.4 12.4l3.7 3.7 7.6-8.0"
        />
      );

    case 'inaccuracy':
      // Chess.com iconic bold white "?!"
      return (
        <g>
          <path
            fill="none"
            stroke={color}
            strokeWidth="2.45"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5.8 8.3c0-1.55 1.25-2.6 2.95-2.6 1.6 0 2.7.95 2.7 2.35 0 1.25-.85 1.95-1.8 2.55-.68.44-1.0.9-1.0 1.7v.35"
          />
          <circle cx="8.65" cy="17.05" r="1.45" fill={color} />
          <path fill={color} d="M14.75 5.4h3.05l-.55 8.15h-1.95l-.55-8.15z" />
          <circle cx="16.28" cy="17.05" r="1.45" fill={color} />
        </g>
      );

    case 'mistake':
      // Chess.com iconic bold white "?"
      return (
        <g>
          <path
            fill="none"
            stroke={color}
            strokeWidth="3.0"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.3 8.4c0-2.05 1.65-3.4 3.85-3.4 2.1 0 3.6 1.25 3.6 3.1 0 1.55-1.0 2.4-2.25 3.15-.95.58-1.45 1.15-1.45 2.2v.35"
          />
          <circle cx="12.0" cy="17.75" r="1.75" fill={color} />
        </g>
      );

    case 'blunder':
      // Chess.com iconic bold white "??"
      return (
        <g>
          <path
            fill="none"
            stroke={color}
            strokeWidth="2.35"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.9 8.4c0-1.45 1.15-2.45 2.75-2.45 1.5 0 2.55.9 2.55 2.25 0 1.2-.8 1.85-1.65 2.45-.6.42-.9.85-.9 1.6v.35"
          />
          <circle cx="7.65" cy="16.95" r="1.4" fill={color} />
          <path
            fill="none"
            stroke={color}
            strokeWidth="2.35"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13.5 8.4c0-1.45 1.15-2.45 2.75-2.45 1.5 0 2.55.9 2.55 2.25 0 1.2-.8 1.85-1.65 2.45-.6.42-.9.85-.9 1.6v.35"
          />
          <circle cx="16.25" cy="16.95" r="1.4" fill={color} />
        </g>
      );
  }
}

/**
 * Chess.com-style Game Review move evaluation badge.
 * Renders authentic solid circular tokens with Chess.com's bottom depth lip and crisp white glyphs.
 */
export const MoveBadge: React.FC<MoveBadgeProps> = ({
  classification,
  variant = 'inline',
  className = '',
  showTitle = true,
}) => {
  const palette = CHESSCOM_BADGE_PALETTES[classification];
  const meta = CLASSIFICATION_META[classification];
  const isBoard = variant === 'board';

  return (
    <span
      data-testid={`move-badge-${classification}`}
      title={showTitle ? `${meta.label} (${meta.symbol})` : undefined}
      aria-label={meta.label}
      className={`inline-flex items-center justify-center shrink-0 select-none ${SIZE_CLASSES[variant]} ${className}`}
      style={
        isBoard
          ? {
              filter: 'drop-shadow(0 2px 2.5px rgba(0,0,0,0.45))',
            }
          : undefined
      }
    >
      <svg viewBox="0 0 24 24" className="w-full h-full overflow-visible block" aria-hidden="true">
        {/* Chess.com signature 3D bottom lip under the circular medallion */}
        <circle cx="12" cy="12.75" r="11.1" fill={palette.lip} />

        {/* Crisp solid main circle face */}
        <circle cx="12" cy="11.55" r="11.0" fill={palette.fill} />

        {/* Clean Chess.com vector glyph shifted slightly up to sit optically centered on the face */}
        <g transform="translate(0, -0.35)">{renderChessComGlyph(classification, palette.glyph)}</g>
      </svg>
    </span>
  );
};

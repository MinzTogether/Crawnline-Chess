import React, { useId } from 'react';
import type { PieceSymbol } from 'chess.js';
import {
  APP_ICONS,
  getAppIconMeta,
  resolveAppIconId,
  type AppIconId,
  type AppIconMeta,
} from '../utils/appIconCatalog';

export { APP_ICONS, getAppIconMeta, resolveAppIconId };
export type { AppIconMeta };

interface AppLogoIconProps {
  iconId: AppIconId;
  className?: string;
}

interface PiecePaths {
  fillStroke: string;
  outlineStroke: string;
  detailStroke: string;
  accentFill: string;
}

function renderChessPieceGlyph(piece: PieceSymbol, p: PiecePaths): React.ReactNode {
  switch (piece) {
    case 'k':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Cross finial */}
          <path
            d="M32 11.2v7.2M28.6 14.3h6.8"
            fill="none"
            stroke={p.outlineStroke}
            strokeWidth="2.3"
          />
          <path
            d="M32 11.2v7.2M28.6 14.3h6.8"
            fill="none"
            stroke={p.detailStroke}
            strokeWidth="1.05"
          />
          {/* Imperial flared crown lobes */}
          <path
            d="M32 20.2c-2.6-2.4-7.1-2.5-10.3-.2-3.5 2.5-4.3 7.5-2.1 12.1 1.3 2.7 2.9 4.5 3.6 6.7h17.6c.7-2.2 2.3-4 3.6-6.7 2.2-4.6 1.4-9.6-2.1-12.1-3.2-2.3-7.7-2.2-10.3.2z"
            fill={p.fillStroke}
            stroke={p.outlineStroke}
            strokeWidth="1.35"
          />
          {/* Central carved rib */}
          <path d="M32 20.5v17.8" fill="none" stroke={p.detailStroke} strokeWidth="1.1" strokeOpacity="0.8" />
          {/* Collar ring */}
          <rect
            x="20.2"
            y="38.8"
            width="23.6"
            height="3.4"
            rx="1.7"
            fill={p.fillStroke}
            stroke={p.outlineStroke}
            strokeWidth="1.25"
          />
          {/* Stepped pedestal base */}
          <path
            d="M19.8 42.4h24.4l2.2 4.6c.4.8-.2 1.8-1.1 1.8H18.7c-.9 0-1.5-1-1.1-1.8l2.2-4.6z"
            fill={p.fillStroke}
            stroke={p.outlineStroke}
            strokeWidth="1.35"
          />
          <rect
            x="16.2"
            y="48.8"
            width="31.6"
            height="3.2"
            rx="1.6"
            fill={p.fillStroke}
            stroke={p.outlineStroke}
            strokeWidth="1.3"
          />
          <path d="M21.2 45.6h21.6" fill="none" stroke={p.detailStroke} strokeWidth="1" strokeOpacity="0.7" />
        </g>
      );

    case 'q':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Five coronet jewels */}
          <circle cx="15.8" cy="20.4" r="2.15" fill={p.accentFill} stroke={p.outlineStroke} strokeWidth="1.15" />
          <circle cx="23.4" cy="16.4" r="2.2" fill={p.accentFill} stroke={p.outlineStroke} strokeWidth="1.15" />
          <circle cx="32" cy="14.4" r="2.45" fill={p.accentFill} stroke={p.outlineStroke} strokeWidth="1.2" />
          <circle cx="40.6" cy="16.4" r="2.2" fill={p.accentFill} stroke={p.outlineStroke} strokeWidth="1.15" />
          <circle cx="48.2" cy="20.4" r="2.15" fill={p.accentFill} stroke={p.outlineStroke} strokeWidth="1.15" />
          {/* Sculpted five-point royal crown */}
          <path
            d="M16.4 22.8l4.5 16h22.2l4.5-16-7.8 9.2L40 19l-5.2 11.4L32 17.4l-2.8 13L24 19l.2 13-7.8-9.2z"
            fill={p.fillStroke}
            stroke={p.outlineStroke}
            strokeWidth="1.35"
          />
          {/* Cinched collar */}
          <rect
            x="19.8"
            y="38.8"
            width="24.4"
            height="3.4"
            rx="1.7"
            fill={p.fillStroke}
            stroke={p.outlineStroke}
            strokeWidth="1.25"
          />
          {/* Pedestal base */}
          <path
            d="M19.5 42.4h25l2.1 4.6c.4.8-.2 1.8-1.1 1.8H18.5c-.9 0-1.5-1-1.1-1.8l2.1-4.6z"
            fill={p.fillStroke}
            stroke={p.outlineStroke}
            strokeWidth="1.35"
          />
          <rect
            x="16.2"
            y="48.8"
            width="31.6"
            height="3.2"
            rx="1.6"
            fill={p.fillStroke}
            stroke={p.outlineStroke}
            strokeWidth="1.3"
          />
          <path d="M21 45.6h22" fill="none" stroke={p.detailStroke} strokeWidth="1" strokeOpacity="0.72" />
        </g>
      );

    case 'r':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Battlement parapet */}
          <path
            d="M18.6 14.8h6.1v4.2h4.2v-4.2h6.2v4.2h4.2v-4.2h6.1v9.4l-3.6 3.2H22.2l-3.6-3.2v-9.4z"
            fill={p.fillStroke}
            stroke={p.outlineStroke}
            strokeWidth="1.35"
          />
          {/* Tower keep column */}
          <path
            d="M22.4 27.4h19.2l1.6 13.6H20.8l1.6-13.6z"
            fill={p.fillStroke}
            stroke={p.outlineStroke}
            strokeWidth="1.35"
          />
          {/* Carved masonry lines & embrasure slit */}
          <path d="M21.2 24.1h21.6" fill="none" stroke={p.detailStroke} strokeWidth="1.05" strokeOpacity="0.75" />
          <rect
            x="30.4"
            y="30.6"
            width="3.2"
            height="6.4"
            rx="1.6"
            fill="none"
            stroke={p.detailStroke}
            strokeWidth="1.15"
            strokeOpacity="0.82"
          />
          {/* Stepped fortress base */}
          <path
            d="M19.8 41h24.4l2.2 4.8c.4.8-.2 1.8-1.1 1.8H18.7c-.9 0-1.5-1-1.1-1.8l2.2-4.8z"
            fill={p.fillStroke}
            stroke={p.outlineStroke}
            strokeWidth="1.35"
          />
          <rect
            x="16.2"
            y="47.8"
            width="31.6"
            height="3.8"
            rx="1.7"
            fill={p.fillStroke}
            stroke={p.outlineStroke}
            strokeWidth="1.3"
          />
        </g>
      );

    case 'b':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Mitre finial orb */}
          <circle cx="32" cy="14" r="2.8" fill={p.accentFill} stroke={p.outlineStroke} strokeWidth="1.25" />
          {/* Sculpted teardrop mitre */}
          <path
            d="M32 17.2c-7.8 3.7-11.2 11.4-8.4 18.2.9 2.2 2.4 3.4 3.2 4.4h10.4c.8-1 2.3-2.2 3.2-4.4 2.8-6.8-.6-14.5-8.4-18.2z"
            fill={p.fillStroke}
            stroke={p.outlineStroke}
            strokeWidth="1.35"
          />
          {/* Liturgical diagonal cleft & inner cross etch */}
          <path d="M32.2 22.8l5.8 5.6" fill="none" stroke={p.detailStroke} strokeWidth="1.5" strokeOpacity="0.9" />
          <path d="M27.4 33.4h9.2" fill="none" stroke={p.detailStroke} strokeWidth="1.05" strokeOpacity="0.72" />
          {/* Collar ring */}
          <rect
            x="21.4"
            y="39.6"
            width="21.2"
            height="3.3"
            rx="1.65"
            fill={p.fillStroke}
            stroke={p.outlineStroke}
            strokeWidth="1.25"
          />
          {/* Flared base */}
          <path
            d="M21 43h22l2.4 4.6c.4.8-.2 1.8-1.1 1.8H19.7c-.9 0-1.5-1-1.1-1.8L21 43z"
            fill={p.fillStroke}
            stroke={p.outlineStroke}
            strokeWidth="1.35"
          />
          <rect
            x="16.4"
            y="49.2"
            width="31.2"
            height="3.1"
            rx="1.55"
            fill={p.fillStroke}
            stroke={p.outlineStroke}
            strokeWidth="1.3"
          />
        </g>
      );

    case 'n':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Heroic sculpted stallion profile */}
          <path
            d="M21.4 42.2c.6-5.7 4.4-9 8.2-12.2-2.6.8-5.3 1.4-7.9 1.6-1.9.1-3.3-.9-3.9-2.4-.5-1.2-.2-2.6.6-3.7l5.3-6.6c.7-.9 1.1-2 .9-3.2-.1-.9.4-1.8 1.2-2 1.2-.3 2.5.4 3.5 1.5 2-.8 4.4-.9 6.8-.2 5.9 1.7 9.9 7.8 10.3 16.2.2 3.8-.5 7.9-1.9 11H21.4z"
            fill={p.fillStroke}
            stroke={p.outlineStroke}
            strokeWidth="1.35"
          />
          {/* Carved mane contour */}
          <path
            d="M34.2 18.6c4.2 2 6.8 6.8 7.2 13.6.2 3-.2 6.1-1.1 8.8"
            fill="none"
            stroke={p.detailStroke}
            strokeWidth="1.2"
            strokeOpacity="0.82"
          />
          {/* Eye glint & jaw etch */}
          <circle cx="26.2" cy="22.8" r="1.35" fill={p.detailStroke} />
          <path d="M22.2 28.4c2-.5 3.8-1.4 5.2-2.6" fill="none" stroke={p.detailStroke} strokeWidth="1" strokeOpacity="0.72" />
          {/* Pedestal base */}
          <path
            d="M19.8 42.2h25l2 4.8c.3.8-.2 1.7-1.1 1.7H18.9c-.9 0-1.5-.9-1.1-1.7l2-4.8z"
            fill={p.fillStroke}
            stroke={p.outlineStroke}
            strokeWidth="1.35"
          />
          <rect
            x="16.4"
            y="48.8"
            width="31.2"
            height="3.2"
            rx="1.6"
            fill={p.fillStroke}
            stroke={p.outlineStroke}
            strokeWidth="1.3"
          />
        </g>
      );

    case 'p':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Classical pawn sphere */}
          <circle cx="32" cy="20.4" r="6.4" fill={p.fillStroke} stroke={p.outlineStroke} strokeWidth="1.35" />
          {/* Subtle sphere specular highlight */}
          <path
            d="M28.6 18.4a3.6 3.6 0 0 1 3.4-2.1"
            fill="none"
            stroke={p.detailStroke}
            strokeWidth="1.1"
            strokeOpacity="0.72"
          />
          {/* Collar ring */}
          <rect
            x="23.2"
            y="27"
            width="17.6"
            height="3.4"
            rx="1.7"
            fill={p.fillStroke}
            stroke={p.outlineStroke}
            strokeWidth="1.25"
          />
          {/* Graceful concave pawn stem */}
          <path
            d="M26.2 30.6h11.6c.4 5.2 2.4 9.5 6.4 13.4H19.8c4-3.9 6-8.2 6.4-13.4z"
            fill={p.fillStroke}
            stroke={p.outlineStroke}
            strokeWidth="1.35"
          />
          {/* Stepped pedestal base */}
          <path
            d="M19.6 44h24.8l1.6 3.6c.3.7-.2 1.5-1 1.5H19c-.8 0-1.3-.8-1-1.5L19.6 44z"
            fill={p.fillStroke}
            stroke={p.outlineStroke}
            strokeWidth="1.35"
          />
          <rect
            x="16.6"
            y="49"
            width="30.8"
            height="3.1"
            rx="1.55"
            fill={p.fillStroke}
            stroke={p.outlineStroke}
            strokeWidth="1.3"
          />
        </g>
      );
  }
}

/**
 * Translucent Frosted White Jade & Frosted Black Jade App Emblem supporting all 6 chess pieces
 * (King, Queen, Rook, Bishop, Knight, Pawn) in both luminous frosted-white and smoked frosted-black sets.
 */
export const AppLogoIcon: React.FC<AppLogoIconProps> = ({ iconId, className = 'w-9 h-9' }) => {
  const uid = useId().replace(/:/g, '');
  const meta = getAppIconMeta(iconId);
  const isWhite = meta.tone === 'white';

  const clipId = `fj-clip-${uid}`;
  const baseGradId = `fj-base-${uid}`;
  const sheenId = `fj-sheen-${uid}`;
  const causticId = `fj-caustic-${uid}`;
  const rimId = `fj-rim-${uid}`;
  const coreGlowId = `fj-glow-${uid}`;
  const pieceGradId = `fj-piece-${uid}`;
  const grainId = `fj-grain-${uid}`;
  const pieceShadowId = `fj-pshadow-${uid}`;

  const pieceStyle: PiecePaths = isWhite
    ? {
        fillStroke: `url(#${pieceGradId})`,
        outlineStroke: '#3D5254',
        detailStroke: '#50686A',
        accentFill: '#FFFFFF',
      }
    : {
        fillStroke: `url(#${pieceGradId})`,
        outlineStroke: '#D9E9EB',
        detailStroke: '#F0F9FA',
        accentFill: '#45545A',
      };

  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <rect x="3" y="3" width="58" height="58" rx="16" />
        </clipPath>

        {/* Fine satin frosted-jade matte micro-grain */}
        <filter id={grainId} x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="1.45" numOctaves="2" seed="11" result="noise" />
          <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise" />
        </filter>

        {/* Soft sculptural relief shadow / luminous separation under the carved piece */}
        <filter id={pieceShadowId} x="-18%" y="-18%" width="136%" height="136%">
          {isWhite ? (
            <feDropShadow dx="0" dy="1.8" stdDeviation="1.6" floodColor="#233738" floodOpacity="0.28" />
          ) : (
            <feDropShadow dx="0" dy="1.2" stdDeviation="2.1" floodColor="#9DC0C4" floodOpacity="0.28" />
          )}
        </filter>

        {isWhite ? (
          <>
            {/* Frosted White Translucent Jade tile body (semi-transparent matte white celadon) */}
            <linearGradient id={baseGradId} x1="6" y1="4" x2="58" y2="60" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.72" />
              <stop offset="48%" stopColor="#E6F1EE" stopOpacity="0.52" />
              <stop offset="100%" stopColor="#BFD1CD" stopOpacity="0.64" />
            </linearGradient>

            {/* Subsurface translucent milky jade diffusion */}
            <radialGradient id={coreGlowId} cx="38%" cy="30%" r="62%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.72" />
              <stop offset="56%" stopColor="#EAF4F2" stopOpacity="0.30" />
              <stop offset="100%" stopColor="#A9BEBA" stopOpacity="0" />
            </radialGradient>

            {/* Curved top-left frosted specular arc */}
            <linearGradient id={sheenId} x1="6" y1="4" x2="46" y2="38" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.88" />
              <stop offset="46%" stopColor="#FFFFFF" stopOpacity="0.26" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </linearGradient>

            {/* Bottom-right soft jade caustic bounce */}
            <radialGradient id={causticId} cx="78%" cy="84%" r="44%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.58" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </radialGradient>

            {/* Crisp frosted-pearl outer rim */}
            <linearGradient id={rimId} x1="4" y1="4" x2="60" y2="60" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.98" />
              <stop offset="46%" stopColor="#8CA4A2" stopOpacity="0.78" />
              <stop offset="100%" stopColor="#F2FAF8" stopOpacity="0.94" />
            </linearGradient>

            {/* Sculpted milky translucent white jade piece fill */}
            <linearGradient id={pieceGradId} x1="16" y1="10" x2="48" y2="54" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.96" />
              <stop offset="48%" stopColor="#F2F8F6" stopOpacity="0.88" />
              <stop offset="100%" stopColor="#CADAD6" stopOpacity="0.86" />
            </linearGradient>
          </>
        ) : (
          <>
            {/* Frosted Black Translucent Jade tile body (semi-transparent smoked obsidian jade) */}
            <linearGradient id={baseGradId} x1="6" y1="4" x2="58" y2="60" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#3D4B50" stopOpacity="0.68" />
              <stop offset="48%" stopColor="#171E22" stopOpacity="0.72" />
              <stop offset="100%" stopColor="#070A0C" stopOpacity="0.84" />
            </linearGradient>

            {/* Smoked obsidian-jade subsurface mist glow */}
            <radialGradient id={coreGlowId} cx="42%" cy="34%" r="60%">
              <stop offset="0%" stopColor="#89A8AC" stopOpacity="0.34" />
              <stop offset="56%" stopColor="#2E3E42" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#090D0F" stopOpacity="0" />
            </radialGradient>

            {/* Top-left smoked satin frost specular */}
            <linearGradient id={sheenId} x1="6" y1="4" x2="46" y2="38" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#EAF5F6" stopOpacity="0.34" />
              <stop offset="46%" stopColor="#B8D0D2" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </linearGradient>

            {/* Bottom-right translucent smoked caustic light */}
            <radialGradient id={causticId} cx="80%" cy="86%" r="44%">
              <stop offset="0%" stopColor="#A6C1C4" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </radialGradient>

            {/* Etched silver-obsidian jade rim */}
            <linearGradient id={rimId} x1="4" y1="4" x2="60" y2="60" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#DFECEE" stopOpacity="0.90" />
              <stop offset="48%" stopColor="#4F6367" stopOpacity="0.68" />
              <stop offset="100%" stopColor="#A8BFC2" stopOpacity="0.80" />
            </linearGradient>

            {/* Sculpted smoked translucent black jade piece fill */}
            <linearGradient id={pieceGradId} x1="16" y1="10" x2="48" y2="54" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#56676E" stopOpacity="0.92" />
              <stop offset="46%" stopColor="#232C30" stopOpacity="0.92" />
              <stop offset="100%" stopColor="#0A0E10" stopOpacity="0.96" />
            </linearGradient>
          </>
        )}
      </defs>

      {/* Clipped frosted translucent jade body */}
      <g clipPath={`url(#${clipId})`}>
        {/* Subtle atmospheric frost wash (keeps translucency legible on both light & dark UI) */}
        <rect
          x="3"
          y="3"
          width="58"
          height="58"
          rx="16"
          fill={isWhite ? '#DCE8E5' : '#0E1316'}
          fillOpacity={isWhite ? '0.28' : '0.32'}
        />

        {/* Primary frosted translucent jade gradient */}
        <rect x="3" y="3" width="58" height="58" rx="16" fill={`url(#${baseGradId})`} />

        {/* Subsurface optical jade mist */}
        <circle cx="29" cy="25" r="28" fill={`url(#${coreGlowId})`} />

        {/* Satin etched micro-frost grain */}
        <rect
          x="3"
          y="3"
          width="58"
          height="58"
          filter={`url(#${grainId})`}
          opacity={isWhite ? '0.095' : '0.125'}
        />

        {/* Curved top frosted glass specular sheen */}
        <path
          d="M19 3h26c8.8 0 16 7.2 16 16v3.2c-10.2-4.6-23-5.6-35.8-2.4-7.2 1.8-13.8 4.8-22.2 8.8V19C3 10.2 10.2 3 19 3z"
          fill={`url(#${sheenId})`}
        />

        {/* Soft lower-right translucent caustic reflection */}
        <rect x="3" y="3" width="58" height="58" rx="16" fill={`url(#${causticId})`} />

        {/* Sculpted frosted translucent chess piece with soft relief shadow */}
        <g filter={`url(#${pieceShadowId})`}>
          {renderChessPieceGlyph(meta.piece, pieceStyle)}
        </g>
      </g>

      {/* Inner hairline frost bevel */}
      <rect
        x="5.6"
        y="5.6"
        width="52.8"
        height="52.8"
        rx="13.4"
        fill="none"
        stroke={isWhite ? '#FFFFFF' : '#E2F0F2'}
        strokeOpacity={isWhite ? '0.62' : '0.24'}
        strokeWidth="0.95"
      />

      {/* Outer crisp luminous rim outline */}
      <rect
        x="3"
        y="3"
        width="58"
        height="58"
        rx="16"
        fill="none"
        stroke={`url(#${rimId})`}
        strokeWidth="1.7"
      />
    </svg>
  );
};

function getFaviconPieceMarkup(piece: PieceSymbol, fill: string, stroke: string): string {
  switch (piece) {
    case 'k':
      return `<path d='M32 11v7M28.5 14.3h7' fill='none' stroke='${stroke}' stroke-width='2.6' stroke-linecap='round'/><path d='M32 20c-2.6-2.4-7.1-2.5-10.3-.2-3.5 2.5-4.3 7.5-2.1 12.1 1.3 2.7 2.9 4.5 3.6 6.7h17.6c.7-2.2 2.3-4 3.6-6.7 2.2-4.6 1.4-9.6-2.1-12.1-3.2-2.3-7.7-2.2-10.3.2z' fill='${fill}' stroke='${stroke}' stroke-width='1.8'/><rect x='17' y='44' width='30' height='7' rx='2.5' fill='${fill}' stroke='${stroke}' stroke-width='1.8'/>`;
    case 'q':
      return `<circle cx='16' cy='20' r='2.3' fill='${fill}' stroke='${stroke}' stroke-width='1.4'/><circle cx='23.5' cy='16' r='2.3' fill='${fill}' stroke='${stroke}' stroke-width='1.4'/><circle cx='32' cy='14' r='2.5' fill='${fill}' stroke='${stroke}' stroke-width='1.4'/><circle cx='40.5' cy='16' r='2.3' fill='${fill}' stroke='${stroke}' stroke-width='1.4'/><circle cx='48' cy='20' r='2.3' fill='${fill}' stroke='${stroke}' stroke-width='1.4'/><path d='M16.5 23l4.5 16h22l4.5-16-7.8 9L40 19l-5.2 11.4L32 17.4l-2.8 13L24 19l.2 13z' fill='${fill}' stroke='${stroke}' stroke-width='1.8'/><rect x='17' y='44' width='30' height='7' rx='2.5' fill='${fill}' stroke='${stroke}' stroke-width='1.8'/>`;
    case 'r':
      return `<path d='M18.5 15h6v4h4.5v-4h6v4h4.5v-4h6v9l-3.5 3.2v14.8h-20V27.2L18.5 24z' fill='${fill}' stroke='${stroke}' stroke-width='1.8'/><rect x='17' y='44' width='30' height='7' rx='2.5' fill='${fill}' stroke='${stroke}' stroke-width='1.8'/>`;
    case 'b':
      return `<circle cx='32' cy='14' r='2.8' fill='${fill}' stroke='${stroke}' stroke-width='1.6'/><path d='M32 17.2c-7.8 3.7-11.2 11.4-8.4 18.2.9 2.2 2.4 3.4 3.2 4.4h10.4c.8-1 2.3-2.2 3.2-4.4 2.8-6.8-.6-14.5-8.4-18.2z' fill='${fill}' stroke='${stroke}' stroke-width='1.8'/><rect x='17' y='44' width='30' height='7' rx='2.5' fill='${fill}' stroke='${stroke}' stroke-width='1.8'/>`;
    case 'n':
      return `<path d='M21.4 42.2c.6-5.7 4.4-9 8.2-12.2-2.6.8-5.3 1.4-7.9 1.6-2 .1-3.4-1-4-2.5-.5-1.2-.2-2.6.6-3.7l5.3-6.6c.7-.9 1.1-2 .9-3.2-.1-.9.4-1.8 1.2-2 1.2-.3 2.5.4 3.5 1.5 2-.8 4.4-.9 6.8-.2 5.9 1.7 9.9 7.8 10.3 16.2.2 3.8-.5 7.9-1.9 11H21.4z' fill='${fill}' stroke='${stroke}' stroke-width='1.8'/><rect x='17' y='44' width='30' height='7' rx='2.5' fill='${fill}' stroke='${stroke}' stroke-width='1.8'/>`;
    case 'p':
      return `<circle cx='32' cy='20.4' r='6.5' fill='${fill}' stroke='${stroke}' stroke-width='1.8'/><path d='M25.5 29h13c.4 5.5 2.5 10.2 6.5 14.5H19c4-4.3 6.1-9 6.5-14.5z' fill='${fill}' stroke='${stroke}' stroke-width='1.8'/><rect x='17' y='45' width='30' height='6.5' rx='2.5' fill='${fill}' stroke='${stroke}' stroke-width='1.8'/>`;
  }
}

let lastSyncedFaviconId: AppIconId | null = null;

/**
 * Dynamically updates the browser tab SVG favicon to match the active Frosted White/Black Jade App Icon.
 */
export function syncBrowserFavicon(iconId: AppIconId): void {
  if (typeof document === 'undefined') return;
  if (lastSyncedFaviconId === iconId) return;
  const meta = getAppIconMeta(iconId);
  const isWhite = meta.tone === 'white';

  const bgStart = encodeURIComponent(isWhite ? '#FFFFFF' : '#3D4B50');
  const bgEnd = encodeURIComponent(isWhite ? '#BFD1CD' : '#090C0E');
  const rim = encodeURIComponent(isWhite ? '#8CA4A2' : '#D4E4E6');
  const pieceFill = encodeURIComponent(isWhite ? '#F7FBFA' : '#232C30');
  const pieceStroke = encodeURIComponent(isWhite ? '#3D5254' : '#E2F0F2');

  const glyph = getFaviconPieceMarkup(meta.piece, pieceFill, pieceStroke);

  const svg = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%25' stop-color='${bgStart}' stop-opacity='0.88'/><stop offset='100%25' stop-color='${bgEnd}' stop-opacity='0.94'/></linearGradient></defs><rect x='3' y='3' width='58' height='58' rx='16' fill='url(%23g)' stroke='${rim}' stroke-width='2.6'/>${glyph}</svg>`;

  let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = svg;
  lastSyncedFaviconId = iconId;
}

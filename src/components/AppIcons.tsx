import React, { useId } from 'react';
import type { AppIconId } from '../types/preferences';

export interface AppIconMeta {
  id: AppIconId;
  name: string;
  subtitle: string;
  /** Primary translucent jade / crystal hue */
  jadeLight: string;
  jadeMid: string;
  jadeDeep: string;
  /** Luminous crisp outline rim */
  outline: string;
  /** Core highlight glint */
  core: string;
}

export const APP_ICONS: AppIconMeta[] = [
  {
    id: 'crown',
    name: 'Celadon Crown',
    subtitle: 'Frosted imperial jade',
    jadeLight: '#A8F5D8',
    jadeMid: '#3AB594',
    jadeDeep: '#0D3B33',
    outline: '#9CFCE0',
    core: '#E4FFF6',
  },
  {
    id: 'knight',
    name: 'Glacier Knight',
    subtitle: 'Translucent arctic glass',
    jadeLight: '#B6EAFF',
    jadeMid: '#3C9AE6',
    jadeDeep: '#102D4F',
    outline: '#9EE2FF',
    core: '#EBF8FF',
  },
  {
    id: 'shield',
    name: 'Aegis Quartz',
    subtitle: 'Milky seafoam crystal',
    jadeLight: '#9FFCE6',
    jadeMid: '#24B8A8',
    jadeDeep: '#0B3538',
    outline: '#8AFCEB',
    core: '#E2FFF9',
  },
  {
    id: 'rook',
    name: 'Citrine Citadel',
    subtitle: 'Smoked amber opal',
    jadeLight: '#FFE3A8',
    jadeMid: '#D98E34',
    jadeDeep: '#3D240B',
    outline: '#FFD98E',
    core: '#FFF6E0',
  },
  {
    id: 'queen',
    name: 'Nebula Sovereign',
    subtitle: 'Frosted amethyst prism',
    jadeLight: '#E0C7FF',
    jadeMid: '#9462EB',
    jadeDeep: '#251447',
    outline: '#D8B8FF',
    core: '#F6EEFF',
  },
  {
    id: 'star',
    name: 'Rose Nova',
    subtitle: 'Translucent ruby quartz',
    jadeLight: '#FFC2D1',
    jadeMid: '#DE5078',
    jadeDeep: '#421222',
    outline: '#FFB0C6',
    core: '#FFECF1',
  },
  {
    id: 'prism',
    name: 'Hyper Prism',
    subtitle: 'Holographic cyan crystal',
    jadeLight: '#AEF6FF',
    jadeMid: '#28BCD1',
    jadeDeep: '#0C2F3D',
    outline: '#94F2FF',
    core: '#E6FCFF',
  },
  {
    id: 'orbit',
    name: 'Vanguard Halo',
    subtitle: 'Frosted emerald orb',
    jadeLight: '#C5FAA8',
    jadeMid: '#5BB849',
    jadeDeep: '#173814',
    outline: '#B4FA91',
    core: '#EEFFE6',
  },
];

interface AppLogoIconProps {
  iconId: AppIconId;
  className?: string;
}

/**
 * Futuristic frosted-jade / translucent crystal glass app icon with crisp luminous outlines.
 */
export const AppLogoIcon: React.FC<AppLogoIconProps> = ({ iconId, className = 'w-9 h-9' }) => {
  const uid = useId().replace(/:/g, '');
  const meta = APP_ICONS.find((i) => i.id === iconId) ?? APP_ICONS[0];

  const bgId = `jade-bg-${uid}`;
  const sheenId = `jade-sheen-${uid}`;
  const rimId = `jade-rim-${uid}`;
  const glyphId = `jade-glyph-${uid}`;
  const glowId = `jade-glow-${uid}`;

  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <defs>
        {/* Translucent milky-jade tile gradient */}
        <linearGradient id={bgId} x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={meta.jadeLight} stopOpacity="0.46" />
          <stop offset="48%" stopColor={meta.jadeMid} stopOpacity="0.34" />
          <stop offset="100%" stopColor={meta.jadeDeep} stopOpacity="0.86" />
        </linearGradient>

        {/* Diagonal frosted specular sheen across top-left glass facet */}
        <linearGradient id={sheenId} x1="4" y1="4" x2="36" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.58" />
          <stop offset="45%" stopColor={meta.core} stopOpacity="0.16" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>

        {/* Crisp futuristic outline gradient */}
        <linearGradient id={rimId} x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.92" />
          <stop offset="42%" stopColor={meta.outline} stopOpacity="0.85" />
          <stop offset="100%" stopColor={meta.jadeMid} stopOpacity="0.55" />
        </linearGradient>

        {/* Inner frosted-jade chess glyph fill */}
        <linearGradient id={glyphId} x1="12" y1="10" x2="36" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.96" />
          <stop offset="55%" stopColor={meta.core} stopOpacity="0.82" />
          <stop offset="100%" stopColor={meta.jadeLight} stopOpacity="0.62" />
        </linearGradient>

        {/* Soft translucent core bloom */}
        <radialGradient id={glowId} cx="50%" cy="44%" r="48%">
          <stop offset="0%" stopColor={meta.jadeLight} stopOpacity="0.52" />
          <stop offset="70%" stopColor={meta.jadeMid} stopOpacity="0.16" />
          <stop offset="100%" stopColor={meta.jadeDeep} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Deep translucent backdrop plate */}
      <rect x="2.5" y="2.5" width="43" height="43" rx="13" fill={meta.jadeDeep} fillOpacity="0.72" />

      {/* Milky frosted jade glass layer */}
      <rect x="2.5" y="2.5" width="43" height="43" rx="13" fill={`url(#${bgId})`} />

      {/* Ambient core refraction */}
      <circle cx="24" cy="22" r="19" fill={`url(#${glowId})`} />

      {/* Top curved glass refraction highlight */}
      <path
        d="M15.5 4h17c6.4 0 11.5 5.1 11.5 11.5v2.2c-7.5-3.4-16.8-4.2-26.2-1.8-5.3 1.3-10.1 3.5-13.8 6.2V15.5C4 9.1 9.1 4 15.5 4z"
        fill={`url(#${sheenId})`}
      />

      {/* Inner hairline frost frame */}
      <rect
        x="5"
        y="5"
        width="38"
        height="38"
        rx="10.5"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.22"
        strokeWidth="0.9"
      />

      {/* Outer crisp luminous rim outline */}
      <rect x="2.5" y="2.5" width="43" height="43" rx="13" fill="none" stroke={`url(#${rimId})`} strokeWidth="1.6" />

      {/* Futuristic translucent-jade emblems with crisp outline */}
      {iconId === 'crown' && (
        <g stroke={meta.outline} strokeWidth="1.15" strokeLinejoin="round">
          <path
            d="M13 31.5L10.8 18.2l7.4 5.4L24 13.4l5.8 10.2 7.4-5.4-2.2 13.3H13z"
            fill={`url(#${glyphId})`}
          />
          <rect x="13" y="33.5" width="22" height="3" rx="1.5" fill={`url(#${glyphId})`} />
          <polygon points="24,8.6 26.2,11.2 24,13.8 21.8,11.2" fill="#FFFFFF" stroke={meta.outline} strokeWidth="0.9" />
        </g>
      )}

      {iconId === 'knight' && (
        <g stroke={meta.outline} strokeWidth="1.15" strokeLinejoin="round">
          <path
            d="M15.5 31.5c.8-4.8 4.4-6.4 6.2-9.2-2.2.5-4.7 1.1-6.8.3l-1.5-2.7 5.8-7.4c1.9-2.3 5-2.8 7.8-1.6 3.9 1.6 6.2 6.1 6.2 11.7 0 3.4-.7 6.6-1.8 8.9H15.5z"
            fill={`url(#${glyphId})`}
          />
          <rect x="14" y="33.5" width="20" height="3" rx="1.5" fill={`url(#${glyphId})`} />
          <circle cx="22.8" cy="17.2" r="1.5" fill={meta.jadeDeep} stroke="#FFFFFF" strokeWidth="0.8" />
        </g>
      )}

      {iconId === 'shield' && (
        <g strokeLinejoin="round">
          <path
            d="M24 10.5l11.5 4.6v8.5c0 7.1-4.8 11.9-11.5 14.4-6.7-2.5-11.5-7.3-11.5-14.4v-8.5L24 10.5z"
            fill={`url(#${glyphId})`}
            fillOpacity="0.34"
            stroke="#FFFFFF"
            strokeOpacity="0.92"
            strokeWidth="1.7"
          />
          <path
            d="M24 15.2l6.8 2.8v5.2c0 4.3-2.9 7.3-6.8 8.9-3.9-1.6-6.8-4.6-6.8-8.9V18l6.8-2.8z"
            fill={`url(#${glyphId})`}
            stroke={meta.outline}
            strokeWidth="1"
          />
          <path d="M24 18.2v10.2M19.5 23.2h9" stroke={meta.jadeDeep} strokeWidth="1.8" strokeLinecap="round" />
        </g>
      )}

      {iconId === 'rook' && (
        <g stroke={meta.outline} strokeWidth="1.15" strokeLinejoin="round">
          <path
            d="M15.5 31.5v-10l-2.3-2.3V12.5h4.2v2.8h3.7v-2.8h5.8v2.8h3.7v-2.8h4.2v6.7l-2.3 2.3v10h-17z"
            fill={`url(#${glyphId})`}
          />
          <rect x="13" y="33.5" width="22" height="3" rx="1.5" fill={`url(#${glyphId})`} />
          <rect x="20.2" y="22.5" width="7.6" height="2.4" rx="1.2" fill={meta.jadeDeep} stroke="none" />
        </g>
      )}

      {iconId === 'queen' && (
        <g stroke={meta.outline} strokeWidth="1.1" strokeLinejoin="round">
          <path
            d="M14 31.5L11.5 18.5l5.8 6.4 1.6-9 5.1 9 5.1-9 1.6 9 5.8-6.4L34 31.5H14z"
            fill={`url(#${glyphId})`}
          />
          <rect x="13.5" y="33.5" width="21" height="3" rx="1.5" fill={`url(#${glyphId})`} />
          <circle cx="11.5" cy="15.2" r="2" fill="#FFFFFF" />
          <circle cx="18.8" cy="12.5" r="2" fill="#FFFFFF" />
          <circle cx="24" cy="11.4" r="2.3" fill="#FFFFFF" />
          <circle cx="29.2" cy="12.5" r="2" fill="#FFFFFF" />
          <circle cx="36.5" cy="15.2" r="2" fill="#FFFFFF" />
        </g>
      )}

      {iconId === 'star' && (
        <g strokeLinejoin="round">
          <path
            d="M24 10.2l3.8 8.3 9 1.1-6.6 6.2 1.7 8.9-7.9-4.3-7.9 4.3 1.7-8.9-6.6-6.2 9-1.1L24 10.2z"
            fill={`url(#${glyphId})`}
            stroke="#FFFFFF"
            strokeWidth="1.25"
          />
          <circle cx="24" cy="23.5" r="3" fill={meta.jadeDeep} fillOpacity="0.45" stroke={meta.outline} strokeWidth="1" />
        </g>
      )}

      {iconId === 'prism' && (
        <g strokeLinejoin="round">
          <polygon
            points="24,9.5 36.5,24 24,38.5 11.5,24"
            fill={`url(#${glyphId})`}
            fillOpacity="0.45"
            stroke="#FFFFFF"
            strokeWidth="1.5"
          />
          <polygon
            points="24,9.5 30.2,24 24,38.5 17.8,24"
            fill={`url(#${glyphId})`}
            stroke={meta.outline}
            strokeWidth="1"
          />
          <line x1="11.5" y1="24" x2="36.5" y2="24" stroke="#FFFFFF" strokeOpacity="0.75" strokeWidth="1.1" />
        </g>
      )}

      {iconId === 'orbit' && (
        <g>
          <ellipse
            cx="24"
            cy="24"
            rx="14.5"
            ry="6.8"
            transform="rotate(-28 24 24)"
            fill="none"
            stroke="#FFFFFF"
            strokeOpacity="0.88"
            strokeWidth="1.6"
          />
          <ellipse
            cx="24"
            cy="24"
            rx="14.5"
            ry="6.8"
            transform="rotate(28 24 24)"
            fill="none"
            stroke={meta.outline}
            strokeOpacity="0.72"
            strokeWidth="1.25"
          />
          <circle cx="24" cy="24" r="6.2" fill={`url(#${glyphId})`} stroke="#FFFFFF" strokeWidth="1.2" />
          <circle cx="34.5" cy="17.5" r="2.2" fill="#FFFFFF" />
        </g>
      )}
    </svg>
  );
};

/**
 * Dynamically updates the browser tab SVG favicon to match the futuristic frosted-jade App Icon.
 */
export function syncBrowserFavicon(iconId: AppIconId): void {
  if (typeof document === 'undefined') return;
  const meta = APP_ICONS.find((i) => i.id === iconId) ?? APP_ICONS[0];

  const glyphMap: Record<AppIconId, string> = {
    crown:
      "<path d='M13 31.5L10.8 18.2l7.4 5.4L24 13.4l5.8 10.2 7.4-5.4-2.2 13.3H13z' fill='white' fill-opacity='0.9'/><rect x='13' y='33.5' width='22' height='3' rx='1.5' fill='white' fill-opacity='0.9'/>",
    knight:
      "<path d='M15.5 31.5c.8-4.8 4.4-6.4 6.2-9.2-2.2.5-4.7 1.1-6.8.3l-1.5-2.7 5.8-7.4c1.9-2.3 5-2.8 7.8-1.6 3.9 1.6 6.2 6.1 6.2 11.7 0 3.4-.7 6.6-1.8 8.9H15.5z' fill='white' fill-opacity='0.9'/><rect x='14' y='33.5' width='20' height='3' rx='1.5' fill='white' fill-opacity='0.9'/>",
    shield:
      "<path d='M24 10.5l11.5 4.6v8.5c0 7.1-4.8 11.9-11.5 14.4-6.7-2.5-11.5-7.3-11.5-14.4v-8.5L24 10.5z' fill='white' fill-opacity='0.28' stroke='white' stroke-width='2.2'/>",
    rook:
      "<path d='M15.5 31.5v-10l-2.3-2.3V12.5h4.2v2.8h3.7v-2.8h5.8v2.8h3.7v-2.8h4.2v6.7l-2.3 2.3v10h-17z' fill='white' fill-opacity='0.9'/><rect x='13' y='33.5' width='22' height='3' rx='1.5' fill='white' fill-opacity='0.9'/>",
    queen:
      "<path d='M14 31.5L11.5 18.5l5.8 6.4 1.6-9 5.1 9 5.1-9 1.6 9 5.8-6.4L34 31.5H14z' fill='white' fill-opacity='0.9'/><rect x='13.5' y='33.5' width='21' height='3' rx='1.5' fill='white' fill-opacity='0.9'/>",
    star:
      "<path d='M24 10.2l3.8 8.3 9 1.1-6.6 6.2 1.7 8.9-7.9-4.3-7.9 4.3 1.7-8.9-6.6-6.2 9-1.1L24 10.2z' fill='white' fill-opacity='0.9'/>",
    prism:
      "<polygon points='24,9.5 36.5,24 24,38.5 11.5,24' fill='white' fill-opacity='0.45' stroke='white' stroke-width='2'/>",
    orbit:
      "<ellipse cx='24' cy='24' rx='14.5' ry='6.8' transform='rotate(-28 24 24)' fill='none' stroke='white' stroke-width='2'/><circle cx='24' cy='24' r='6' fill='white' fill-opacity='0.9'/>",
  };

  const lightEnc = encodeURIComponent(meta.jadeLight);
  const midEnc = encodeURIComponent(meta.jadeMid);
  const deepEnc = encodeURIComponent(meta.jadeDeep);
  const rimEnc = encodeURIComponent(meta.outline);

  const svg = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%25' stop-color='${lightEnc}' stop-opacity='0.8'/><stop offset='50%25' stop-color='${midEnc}' stop-opacity='0.72'/><stop offset='100%25' stop-color='${deepEnc}'/></linearGradient></defs><rect x='2.5' y='2.5' width='43' height='43' rx='13' fill='${deepEnc}'/><rect x='2.5' y='2.5' width='43' height='43' rx='13' fill='url(%23g)' stroke='${rimEnc}' stroke-width='2.2'/>${glyphMap[iconId]}</svg>`;

  let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = svg;
}

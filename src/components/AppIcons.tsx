import React from 'react';
import type { AppIconId } from '../types/preferences';

export interface AppIconMeta {
  id: AppIconId;
  name: string;
  accent: string;
}

export const APP_ICONS: AppIconMeta[] = [
  { id: 'crown', name: 'Classic Crown', accent: '#81B64C' },
  { id: 'knight', name: 'Tournament Knight', accent: '#5C9CE6' },
  { id: 'shield', name: 'Emerald Shield', accent: '#26C2A3' },
  { id: 'rook', name: 'Obsidian Rook', accent: '#E58F2A' },
  { id: 'queen', name: 'Royal Queen', accent: '#D6A84E' },
  { id: 'star', name: 'Grandmaster Star', accent: '#D96666' },
];

interface AppLogoIconProps {
  iconId: AppIconId;
  className?: string;
}

export const AppLogoIcon: React.FC<AppLogoIconProps> = ({ iconId, className = 'w-9 h-9' }) => {
  const meta = APP_ICONS.find((i) => i.id === iconId) ?? APP_ICONS[0];
  const accent = meta.accent;

  return (
    <svg viewBox="0 0 44 44" className={className} aria-hidden="true">
      <rect x="2" y="2" width="40" height="40" rx="10" fill="#1F1E1C" stroke={accent} strokeWidth="1.8" />

      {iconId === 'crown' && (
        <>
          <path d="M11 30.5h22v3H11v-3zm2-3l-2.5-11 6.5 4.5L22 12l5 9 6.5-4.5L31 27.5H13z" fill="#F4F2EC" />
          <circle cx="22" cy="10.2" r="2.1" fill={accent} />
        </>
      )}

      {iconId === 'knight' && (
        <>
          <path
            d="M14 33h17v-3H14v3zm2.5-5c.5-4.5 4-6 5.5-8.5-2 .5-4.2 1.2-6.2.5l-1.3-2.5 5.2-6.5c1.6-2 4.3-2.5 6.8-1.5 3.6 1.4 5.5 5.4 5.5 10.5 0 3.2-.6 6.2-1.5 8H16.5z"
            fill="#F4F2EC"
          />
          <circle cx="21.5" cy="15.5" r="1.4" fill={accent} />
        </>
      )}

      {iconId === 'shield' && (
        <>
          <path
            d="M22 9l11 4.5v8.2c0 6.8-4.7 11.4-11 13.8-6.3-2.4-11-7-11-13.8v-8.2L22 9z"
            fill="none"
            stroke="#F4F2EC"
            strokeWidth="2.2"
          />
          <path d="M22 14v15M15.5 21.5h13" stroke={accent} strokeWidth="2.6" strokeLinecap="round" />
        </>
      )}

      {iconId === 'rook' && (
        <>
          <path
            d="M12 33h20v-3H12v3zm2.5-5h15v-9.5l2-2V11h-3.8v2.6h-3.5V11h-4.4v2.6h-3.5V11H12.5v5.5l2 2V28z"
            fill="#F4F2EC"
          />
          <rect x="16.5" y="21" width="11" height="2.4" rx="1" fill={accent} />
        </>
      )}

      {iconId === 'queen' && (
        <>
          <circle cx="11.5" cy="14" r="2" fill={accent} />
          <circle cx="17" cy="11.5" r="2" fill={accent} />
          <circle cx="22" cy="10.5" r="2.2" fill={accent} />
          <circle cx="27" cy="11.5" r="2" fill={accent} />
          <circle cx="32.5" cy="14" r="2" fill={accent} />
          <path d="M12 32.5h20v-3H12v3zm1.5-5L11.5 17l5.2 6.5 1.3-8.5 4 8.5 4-8.5 1.3 8.5 5.2-6.5-2 10.5h-17z" fill="#F4F2EC" />
        </>
      )}

      {iconId === 'star' && (
        <path
          d="M22 9.5l3.5 7.4 8.1 1.1-5.9 5.6 1.4 8-7.1-3.8-7.1 3.8 1.4-8-5.9-5.6 8.1-1.1L22 9.5z"
          fill="#F4F2EC"
          stroke={accent}
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
};

/**
 * Dynamically updates the browser tab SVG favicon to match the user's selected App Icon.
 */
export function syncBrowserFavicon(iconId: AppIconId): void {
  if (typeof document === 'undefined') return;
  const meta = APP_ICONS.find((i) => i.id === iconId) ?? APP_ICONS[0];
  const glyphMap: Record<AppIconId, string> = {
    crown: "<path d='M11 30.5h22v3H11v-3zm2-3l-2.5-11 6.5 4.5L22 12l5 9 6.5-4.5L31 27.5H13z' fill='%23F4F2EC'/>",
    knight: "<path d='M14 33h17v-3H14v3zm2.5-5c.5-4.5 4-6 5.5-8.5-2 .5-4.2 1.2-6.2.5l-1.3-2.5 5.2-6.5c1.6-2 4.3-2.5 6.8-1.5 3.6 1.4 5.5 5.4 5.5 10.5 0 3.2-.6 6.2-1.5 8H16.5z' fill='%23F4F2EC'/>",
    shield: "<path d='M22 9l11 4.5v8.2c0 6.8-4.7 11.4-11 13.8-6.3-2.4-11-7-11-13.8v-8.2L22 9z' fill='none' stroke='%23F4F2EC' stroke-width='2.5'/>",
    rook: "<path d='M12 33h20v-3H12v3zm2.5-5h15v-9.5l2-2V11h-3.8v2.6h-3.5V11h-4.4v2.6h-3.5V11H12.5v5.5l2 2V28z' fill='%23F4F2EC'/>",
    queen: "<path d='M12 32.5h20v-3H12v3zm1.5-5L11.5 17l5.2 6.5 1.3-8.5 4 8.5 4-8.5 1.3 8.5 5.2-6.5-2 10.5h-17z' fill='%23F4F2EC'/>",
    star: "<path d='M22 9.5l3.5 7.4 8.1 1.1-5.9 5.6 1.4 8-7.1-3.8-7.1 3.8 1.4-8-5.9-5.6 8.1-1.1L22 9.5z' fill='%23F4F2EC'/>",
  };
  const strokeEnc = encodeURIComponent(meta.accent);
  const svg = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 44 44'><rect x='2' y='2' width='40' height='40' rx='10' fill='%231F1E1C' stroke='${strokeEnc}' stroke-width='2.4'/>${glyphMap[iconId]}</svg>`;

  let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = svg;
}

import type { BoardThemeId } from './chess';

export type AppThemeId = 'dark-slate' | 'midnight-emerald' | 'walnut-lounge' | 'light-classic';

export type AppIconId = 'crown' | 'knight' | 'shield' | 'rook' | 'queen' | 'star';

export type PieceStyleId = 'classic' | 'ivory' | 'gold';

export interface AppThemeMeta {
  id: AppThemeId;
  name: string;
  description: string;
  swatchBg: string;
  swatchSurface: string;
  swatchAccent: string;
  isLight?: boolean;
}

export const APP_THEMES: AppThemeMeta[] = [
  {
    id: 'dark-slate',
    name: 'Dark Slate',
    description: 'Classic tournament charcoal with crisp emerald accents.',
    swatchBg: '#181817',
    swatchSurface: '#242321',
    swatchAccent: '#81B64C',
  },
  {
    id: 'midnight-emerald',
    name: 'Midnight Emerald',
    description: 'Deep club-room forest slate for long study sessions.',
    swatchBg: '#111916',
    swatchSurface: '#1A2621',
    swatchAccent: '#6CC067',
  },
  {
    id: 'walnut-lounge',
    name: 'Walnut Lounge',
    description: 'Warm mahogany woodwork with rich amber highlights.',
    swatchBg: '#1B1613',
    swatchSurface: '#27201B',
    swatchAccent: '#D99B3C',
  },
  {
    id: 'light-classic',
    name: 'Light Classic',
    description: 'Bright daylight stone surface with clean dark ink.',
    swatchBg: '#EEEDE8',
    swatchSurface: '#FFFFFF',
    swatchAccent: '#5B9330',
    isLight: true,
  },
];

export interface PieceStyleMeta {
  id: PieceStyleId;
  name: string;
  whiteFill: string;
  whiteStroke: string;
  blackFill: string;
  blackStroke: string;
  blackDetail: string;
}

export const PIECE_STYLES: Record<PieceStyleId, PieceStyleMeta> = {
  classic: {
    id: 'classic',
    name: 'Tournament Neo',
    whiteFill: '#FBFBF8',
    whiteStroke: '#1A1917',
    blackFill: '#1E1D1B',
    blackStroke: '#11100F',
    blackDetail: '#E7E4DC',
  },
  ivory: {
    id: 'ivory',
    name: 'Warm Ivory',
    whiteFill: '#FFF5DF',
    whiteStroke: '#382B1D',
    blackFill: '#33251B',
    blackStroke: '#1A120C',
    blackDetail: '#EBD9BE',
  },
  gold: {
    id: 'gold',
    name: 'Royal Brass',
    whiteFill: '#F6E6B8',
    whiteStroke: '#2E2311',
    blackFill: '#22262E',
    blackStroke: '#101318',
    blackDetail: '#D9C284',
  },
};

export interface UserProfile {
  displayName: string;
  title: string;
  avatarColor: string;
  bio: string;
}

export interface SavedMatch {
  id: string;
  date: string;
  whiteName: string;
  blackName: string;
  result: '1-0' | '0-1' | '1/2-1/2' | '*';
  reason: string;
  openingName: string;
  movesCount: number;
  pgn: string;
  whiteAccuracy?: number | null;
  blackAccuracy?: number | null;
  whiteGameElo?: number | null;
  blackGameElo?: number | null;
  userSide?: 'w' | 'b' | 'both';
}

export interface AppPreferences {
  appTheme: AppThemeId;
  appIcon: AppIconId;
  boardTheme: BoardThemeId;
  pieceStyle: PieceStyleId;
  showCoordinates: boolean;
  showLegalMoves: boolean;
  showEvalBar: boolean;
  muted: boolean;
  analysisDepth: number;
  multiPv: number;
}

export const DEFAULT_PREFERENCES: AppPreferences = {
  appTheme: 'dark-slate',
  appIcon: 'crown',
  boardTheme: 'tournament',
  pieceStyle: 'classic',
  showCoordinates: true,
  showLegalMoves: true,
  showEvalBar: true,
  muted: false,
  analysisDepth: 16,
  multiPv: 3,
};

export const DEFAULT_PROFILE: UserProfile = {
  displayName: 'Club Challenger',
  title: 'Club Player',
  avatarColor: '#81B64C',
  bio: 'Studying openings and reviewing every match with Stockfish.',
};

export const SEEDED_MATCHES: SavedMatch[] = [
  {
    id: 'seed-italian-match',
    date: 'Today',
    whiteName: 'Club Challenger',
    blackName: 'Stockfish (Club Player)',
    result: '1-0',
    reason: 'Checkmate',
    openingName: 'C50 · Italian Game',
    movesCount: 8,
    pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 d6 4. Nc3 Bg4 5. h3 Bh5 6. Nxe5 Bxd1 7. Bxf7+ Ke7 8. Nd5#',
    whiteAccuracy: 92.4,
    blackAccuracy: 68.5,
    whiteGameElo: 2200,
    blackGameElo: 1200,
    userSide: 'w',
  },
  {
    id: 'seed-opera-match',
    date: 'Yesterday',
    whiteName: 'Paul Morphy',
    blackName: 'Duke Karl & Count Isouard',
    result: '1-0',
    reason: 'Checkmate',
    openingName: 'C41 · Philidor Defense',
    movesCount: 17,
    pgn: '1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8#',
    whiteAccuracy: 97.6,
    blackAccuracy: 64.5,
    whiteGameElo: 2680,
    blackGameElo: 1150,
    userSide: 'w',
  },
];

const PREFS_KEY = 'crownline_preferences_v1';
const PROFILE_KEY = 'crownline_profile_v1';
const MATCHES_KEY = 'crownline_matches_v1';

export function loadPreferences(): AppPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(prefs: AppPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadProfile(): UserProfile {
  if (typeof window === 'undefined') return DEFAULT_PROFILE;
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveProfile(profile: UserProfile): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadSavedMatches(): SavedMatch[] {
  if (typeof window === 'undefined') return SEEDED_MATCHES;
  try {
    const raw = window.localStorage.getItem(MATCHES_KEY);
    if (!raw) return SEEDED_MATCHES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return SEEDED_MATCHES;
    return parsed;
  } catch {
    return SEEDED_MATCHES;
  }
}

export function saveMatches(matches: SavedMatch[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MATCHES_KEY, JSON.stringify(matches.slice(0, 25)));
  } catch {
    // Ignore storage quota errors
  }
}

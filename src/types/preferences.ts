import type { BoardThemeId } from './chess';

export type AppThemeId =
  | 'dark-slate'
  | 'midnight-emerald'
  | 'walnut-lounge'
  | 'light-classic'
  | 'obsidian-cyber'
  | 'deep-ocean'
  | 'amethyst-velvet'
  | 'crimson-noir'
  | 'jade-temple'
  | 'nordic-frost'
  | 'desert-parchment'
  | 'sakura-daylight'
  | 'solar-amber'
  | 'arctic-mint';

export type AppIconId = 'crown' | 'knight' | 'shield' | 'rook' | 'queen' | 'star' | 'prism' | 'orbit';

export type PieceStyleId =
  | 'classic'
  | 'ivory'
  | 'gold'
  | 'jade-crystal'
  | 'sapphire-ice'
  | 'crimson-ruby'
  | 'obsidian-chrome'
  | 'amethyst-dusk'
  | 'rose-quartz'
  | 'arctic-glass'
  | 'vintage-cedar'
  | 'emerald-mint'
  | 'solar-bronze';

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
    swatchBg: '#101714',
    swatchSurface: '#192520',
    swatchAccent: '#6CC067',
  },
  {
    id: 'walnut-lounge',
    name: 'Walnut Lounge',
    description: 'Warm mahogany woodwork with rich amber highlights.',
    swatchBg: '#1A1512',
    swatchSurface: '#28211C',
    swatchAccent: '#D99B3C',
  },
  {
    id: 'light-classic',
    name: 'Light Classic',
    description: 'Bright daylight stone surface with clean dark ink.',
    swatchBg: '#ECEAE4',
    swatchSurface: '#FFFFFF',
    swatchAccent: '#5D9432',
    isLight: true,
  },
  {
    id: 'obsidian-cyber',
    name: 'Obsidian Cyan',
    description: 'Futuristic matte obsidian paired with luminous frosted cyan.',
    swatchBg: '#0D1318',
    swatchSurface: '#152028',
    swatchAccent: '#38D6DC',
  },
  {
    id: 'deep-ocean',
    name: 'Deep Ocean',
    description: 'Abyssal marine indigo accented with bright electric sky.',
    swatchBg: '#0E1522',
    swatchSurface: '#172236',
    swatchAccent: '#5AA9F5',
  },
  {
    id: 'amethyst-velvet',
    name: 'Amethyst Velvet',
    description: 'Dark twilight plum balanced with soft luminous violet.',
    swatchBg: '#171221',
    swatchSurface: '#231C32',
    swatchAccent: '#B184F5',
  },
  {
    id: 'crimson-noir',
    name: 'Crimson Noir',
    description: 'Smoked graphite charcoal infused with regal ruby red.',
    swatchBg: '#1A1214',
    swatchSurface: '#271B1E',
    swatchAccent: '#E55B69',
  },
  {
    id: 'jade-temple',
    name: 'Jade Sanctuary',
    description: 'Frosted celadon dark slate with serene translucent jade.',
    swatchBg: '#0E1918',
    swatchSurface: '#162725',
    swatchAccent: '#48D4A8',
  },
  {
    id: 'solar-amber',
    name: 'Solar Amber',
    description: 'Roasted espresso carbon lit with molten championship gold.',
    swatchBg: '#17140F',
    swatchSurface: '#241F17',
    swatchAccent: '#F0B43A',
  },
  {
    id: 'nordic-frost',
    name: 'Nordic Frost',
    description: 'Crisp Scandinavian ice daylight with glacial cobalt accents.',
    swatchBg: '#E6EEF5',
    swatchSurface: '#F9FCFF',
    swatchAccent: '#2F78C4',
    isLight: true,
  },
  {
    id: 'desert-parchment',
    name: 'Desert Parchment',
    description: 'Sunlit sandstone paper paired with warm terracotta bronze.',
    swatchBg: '#F2E9DC',
    swatchSurface: '#FFFBF4',
    swatchAccent: '#C2673A',
    isLight: true,
  },
  {
    id: 'sakura-daylight',
    name: 'Sakura Daylight',
    description: 'Soft blossom pearl canvas accented with crisp rose berry.',
    swatchBg: '#F5EBEF',
    swatchSurface: '#FFFBFC',
    swatchAccent: '#C44D78',
    isLight: true,
  },
  {
    id: 'arctic-mint',
    name: 'Arctic Mint',
    description: 'Translucent celadon daylight with bold botanical jade.',
    swatchBg: '#E5F2EE',
    swatchSurface: '#F7FCFA',
    swatchAccent: '#1F9674',
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
  pieceOpacity?: number;
  glowColor?: string;
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
  'jade-crystal': {
    id: 'jade-crystal',
    name: 'Frosted Jade',
    whiteFill: '#D9FAF0',
    whiteStroke: '#185445',
    blackFill: '#13473D',
    blackStroke: '#07241E',
    blackDetail: '#8CF2D4',
    pieceOpacity: 0.94,
    glowColor: 'rgba(72, 212, 168, 0.32)',
  },
  'sapphire-ice': {
    id: 'sapphire-ice',
    name: 'Sapphire Ice',
    whiteFill: '#E3F2FF',
    whiteStroke: '#1A4475',
    blackFill: '#1B3B6B',
    blackStroke: '#0B1D38',
    blackDetail: '#99CEFF',
    pieceOpacity: 0.95,
    glowColor: 'rgba(90, 169, 245, 0.3)',
  },
  'crimson-ruby': {
    id: 'crimson-ruby',
    name: 'Crimson Ruby',
    whiteFill: '#FFF0F0',
    whiteStroke: '#5E1A22',
    blackFill: '#6B1825',
    blackStroke: '#300910',
    blackDetail: '#FFABB6',
  },
  'obsidian-chrome': {
    id: 'obsidian-chrome',
    name: 'Obsidian Chrome',
    whiteFill: '#E6ECEF',
    whiteStroke: '#242D33',
    blackFill: '#171C21',
    blackStroke: '#080A0C',
    blackDetail: '#A9C0CC',
  },
  'amethyst-dusk': {
    id: 'amethyst-dusk',
    name: 'Amethyst Dusk',
    whiteFill: '#F3EBFF',
    whiteStroke: '#3E2569',
    blackFill: '#3B2361',
    blackStroke: '#1C0E33',
    blackDetail: '#D3B8FF',
  },
  'rose-quartz': {
    id: 'rose-quartz',
    name: 'Rose Quartz',
    whiteFill: '#FFEBF2',
    whiteStroke: '#662840',
    blackFill: '#5E243B',
    blackStroke: '#2E0F1B',
    blackDetail: '#FFC2D7',
  },
  'arctic-glass': {
    id: 'arctic-glass',
    name: 'Arctic Glass',
    whiteFill: '#EDF9FF',
    whiteStroke: '#25607A',
    blackFill: '#1D495C',
    blackStroke: '#0B2430',
    blackDetail: '#9CEBFF',
    pieceOpacity: 0.9,
    glowColor: 'rgba(56, 214, 220, 0.34)',
  },
  'vintage-cedar': {
    id: 'vintage-cedar',
    name: 'Vintage Cedar',
    whiteFill: '#F7E7CE',
    whiteStroke: '#4A2E19',
    blackFill: '#54321B',
    blackStroke: '#261409',
    blackDetail: '#E3C39D',
  },
  'emerald-mint': {
    id: 'emerald-mint',
    name: 'Emerald Mint',
    whiteFill: '#EBFCEB',
    whiteStroke: '#1D4D26',
    blackFill: '#1C4A27',
    blackStroke: '#0B2411',
    blackDetail: '#A7F0B6',
  },
  'solar-bronze': {
    id: 'solar-bronze',
    name: 'Solar Bronze',
    whiteFill: '#FCECC7',
    whiteStroke: '#4D340C',
    blackFill: '#453013',
    blackStroke: '#1F1406',
    blackDetail: '#F5C969',
  },
};

export interface UserProfile {
  displayName: string;
  title: string;
  avatarColor: string;
  avatarImage?: string | null;
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
  avatarImage: null,
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

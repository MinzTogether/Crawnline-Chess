import { BOARD_THEMES, type BoardThemeId } from './chess';
import type { AppLanguage } from '../i18n/translations';
import {
  ANIMATION_EASING_CURVES,
  ANIMATION_PRESET_DEFAULTS,
  clampPieceSpeedMs,
  clampUiSpeedMultiplier,
  type AnimationEasingId,
  type AnimationLevelId,
} from '../utils/animationConfig';
import { resolveAppIconId, type AppIconId } from '../utils/appIconCatalog';

export type { AnimationEasingId, AnimationLevelId, AppIconId };

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
  | 'arctic-mint'
  | 'cobalt-carbon'
  | 'emerald-velvet'
  | 'rosewood-atelier'
  | 'titanium-mist'
  | 'monochrome-ink'
  | 'indigo-nebula'
  | 'copper-forge'
  | 'matcha-noir'
  | 'burgundy-club'
  | 'teal-abyss'
  | 'ivory-linen'
  | 'matcha-studio'
  | 'lavender-cloud'
  | 'champagne-silk'
  | 'porcelain-slate'
  | 'terracotta-sun'
  | 'chesscom-dark'
  | 'chesscom-charcoal'
  | 'chesscom-wood'
  | 'chesscom-blue'
  | 'chesscom-purple'
  | 'chesscom-red'
  | 'chesscom-light'
  | 'chesscom-sky';


export type PieceStyleId =
  | 'classic'
  | 'staunton-neo'
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
  isChessCom?: boolean;
}

export const APP_THEMES: AppThemeMeta[] = [
  {
    id: 'chesscom-dark',
    name: 'Chess.com Dark',
    description: 'Signature #302E2B tournament charcoal with iconic Chess.com green.',
    swatchBg: '#302E2B',
    swatchSurface: '#262421',
    swatchAccent: '#81B64C',
    isChessCom: true,
  },
  {
    id: 'chesscom-charcoal',
    name: 'Chess.com Charcoal',
    description: 'Deep matte charcoal deck tuned for focused blitz and rapid sessions.',
    swatchBg: '#21201D',
    swatchSurface: '#2B2926',
    swatchAccent: '#81B64C',
    isChessCom: true,
  },
  {
    id: 'chesscom-wood',
    name: 'Chess.com Wood',
    description: 'Classic warm mahogany club finish with crisp tournament green buttons.',
    swatchBg: '#342318',
    swatchSurface: '#422E20',
    swatchAccent: '#81B64C',
    isChessCom: true,
  },
  {
    id: 'chesscom-blue',
    name: 'Chess.com Blue',
    description: 'Classic Chess.com midnight-navy palette with bright sky-slate panels.',
    swatchBg: '#1C2838',
    swatchSurface: '#25354A',
    swatchAccent: '#81B64C',
    isChessCom: true,
  },
  {
    id: 'chesscom-purple',
    name: 'Chess.com Purple',
    description: 'Rich royal plum backdrop paired with crisp violet-lavender controls.',
    swatchBg: '#261F36',
    swatchSurface: '#322947',
    swatchAccent: '#9D7CE8',
    isChessCom: true,
  },
  {
    id: 'chesscom-red',
    name: 'Chess.com Crimson',
    description: 'Deep tournament garnet canvas accented with vivid scarlet highlights.',
    swatchBg: '#2C191A',
    swatchSurface: '#3A2224',
    swatchAccent: '#E05A5A',
    isChessCom: true,
  },
  {
    id: 'chesscom-light',
    name: 'Chess.com Light',
    description: 'Clean bright Chess.com daylight canvas with signature green accents.',
    swatchBg: '#ECECEC',
    swatchSurface: '#FFFFFF',
    swatchAccent: '#7FA650',
    isLight: true,
    isChessCom: true,
  },
  {
    id: 'chesscom-sky',
    name: 'Chess.com Sky',
    description: 'Airy Chess.com sky-blue daylight theme with crisp tournament cobalt.',
    swatchBg: '#E3EFFA',
    swatchSurface: '#F9FCFF',
    swatchAccent: '#4B89C8',
    isLight: true,
    isChessCom: true,
  },
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
    id: 'cobalt-carbon',
    name: 'Cobalt Carbon',
    description: 'Precision matte carbon accented with electric tournament cobalt.',
    swatchBg: '#10131A',
    swatchSurface: '#1B202D',
    swatchAccent: '#4D8BF5',
  },
  {
    id: 'emerald-velvet',
    name: 'Emerald Velvet',
    description: 'Deep botanical pine slate illuminated by vivid malachite.',
    swatchBg: '#0D1612',
    swatchSurface: '#16251F',
    swatchAccent: '#32C984',
  },
  {
    id: 'rosewood-atelier',
    name: 'Rosewood Atelier',
    description: 'Smoked rosewood studio paired with warm copper-rose highlights.',
    swatchBg: '#1A1315',
    swatchSurface: '#2A1F22',
    swatchAccent: '#DF7B72',
  },
  {
    id: 'titanium-mist',
    name: 'Titanium Mist',
    description: 'Cool aerospace titanium gray finished with brushed silver-ice.',
    swatchBg: '#15171A',
    swatchSurface: '#22262B',
    swatchAccent: '#8AB4D6',
  },
  {
    id: 'monochrome-ink',
    name: 'Monochrome Ink',
    description: 'Minimalist gallery obsidian with high-contrast alabaster controls.',
    swatchBg: '#111111',
    swatchSurface: '#1E1E1E',
    swatchAccent: '#E8E6E0',
  },
  {
    id: 'indigo-nebula',
    name: 'Indigo Nebula',
    description: 'Deep astral indigo paired with crisp periwinkle highlights.',
    swatchBg: '#111224',
    swatchSurface: '#1D1F3B',
    swatchAccent: '#828CFF',
  },
  {
    id: 'copper-forge',
    name: 'Copper Forge',
    description: 'Burnished iron charcoal lit with forged bronze-copper warmth.',
    swatchBg: '#171311',
    swatchSurface: '#261F1C',
    swatchAccent: '#DE834C',
  },
  {
    id: 'matcha-noir',
    name: 'Matcha Noir',
    description: 'Roasted dark tea-room charcoal balanced with Kyoto matcha.',
    swatchBg: '#141713',
    swatchSurface: '#21261E',
    swatchAccent: '#9BC462',
  },
  {
    id: 'burgundy-club',
    name: 'Burgundy Club',
    description: 'Grandmaster lounge wine-slate trimmed with champagne gold.',
    swatchBg: '#1B1217',
    swatchSurface: '#2B1D24',
    swatchAccent: '#D6A962',
  },
  {
    id: 'teal-abyss',
    name: 'Teal Abyss',
    description: 'Deep oceanic slate-teal accented with clear aquamarine.',
    swatchBg: '#0C171C',
    swatchSurface: '#15262E',
    swatchAccent: '#2EC4B6',
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
  {
    id: 'ivory-linen',
    name: 'Ivory Linen',
    description: 'Soft architectural linen paper paired with deep forest sage.',
    swatchBg: '#EFECE5',
    swatchSurface: '#FCFBF8',
    swatchAccent: '#3F7D58',
    isLight: true,
  },
  {
    id: 'matcha-studio',
    name: 'Matcha Studio',
    description: 'Sunlit botanical white-sage with ceremonial matcha green.',
    swatchBg: '#EBF1E6',
    swatchSurface: '#FAFCF8',
    swatchAccent: '#5C8C38',
    isLight: true,
  },
  {
    id: 'lavender-cloud',
    name: 'Lavender Cloud',
    description: 'Airy mist porcelain accented with refined royal iris.',
    swatchBg: '#ECEAF6',
    swatchSurface: '#FAF9FE',
    swatchAccent: '#6854C4',
    isLight: true,
  },
  {
    id: 'champagne-silk',
    name: 'Champagne Silk',
    description: 'Warm gallery alabaster with burnished bronze-gold accents.',
    swatchBg: '#F3EEE4',
    swatchSurface: '#FFFDF9',
    swatchAccent: '#B37E29',
    isLight: true,
  },
  {
    id: 'porcelain-slate',
    name: 'Porcelain Slate',
    description: 'Crisp Swiss studio white with cool slate-blue precision ink.',
    swatchBg: '#E9EDF2',
    swatchSurface: '#FAFBFD',
    swatchAccent: '#385E8C',
    isLight: true,
  },
  {
    id: 'terracotta-sun',
    name: 'Terracotta Sun',
    description: 'Warm Mediterranean limestone with kiln-fired sienna accents.',
    swatchBg: '#F4E8E0',
    swatchSurface: '#FFFBF8',
    swatchAccent: '#C75734',
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
  /** Optional directory containing transparent {w|b}{k|q|r|b|n|p}.png piece icons */
  spriteBasePath?: string;
}

export const PIECE_STYLES: Record<PieceStyleId, PieceStyleMeta> = {
  classic: {
    id: 'classic',
    name: 'Classic Default',
    whiteFill: '#FBFBF8',
    whiteStroke: '#1A1917',
    blackFill: '#2E2E2E',
    blackStroke: '#11100F',
    blackDetail: '#D9D8D4',
    spriteBasePath: '/assets/pieces/default',
  },
  'staunton-neo': {
    id: 'staunton-neo',
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
  language: AppLanguage;
  animationLevel: AnimationLevelId;
  pieceSpeedMs: number;
  uiSpeedMultiplier: number;
  animationEasing: AnimationEasingId;
  pieceLiftEffect: boolean;
  pieceMoveAnimation: boolean;
  badgePopAnimation: boolean;
  boardHighlightsAnimation: boolean;
  evalBarAnimation: boolean;
  uiTransitions: boolean;
  showCoordinates: boolean;
  showLegalMoves: boolean;
  showEvalBar: boolean;
  showMaterialDifference: boolean;
  muted: boolean;
  analysisDepth: number;
  multiPv: number;
}

export const DEFAULT_PREFERENCES: AppPreferences = {
  appTheme: 'dark-slate',
  appIcon: 'white-king',
  boardTheme: 'tournament',
  pieceStyle: 'classic',
  language: 'en',
  animationLevel: 'smooth',
  pieceSpeedMs: 185,
  uiSpeedMultiplier: 1.0,
  animationEasing: 'smooth',
  pieceLiftEffect: true,
  pieceMoveAnimation: true,
  badgePopAnimation: true,
  boardHighlightsAnimation: true,
  evalBarAnimation: true,
  uiTransitions: true,
  showCoordinates: true,
  showLegalMoves: true,
  showEvalBar: true,
  showMaterialDifference: true,
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

export const PREFERENCES_STORAGE_KEY = 'crownline_preferences_v1';
export const PROFILE_STORAGE_KEY = 'crownline_profile_v1';
export const MATCHES_STORAGE_KEY = 'crownline_matches_v1';
export const MAX_AVATAR_DATA_URL_LENGTH = 512_000;
export const MAX_SAVED_MATCHES = 25;

const PREFS_KEY = PREFERENCES_STORAGE_KEY;
const PROFILE_KEY = PROFILE_STORAGE_KEY;
const MATCHES_KEY = MATCHES_STORAGE_KEY;

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type StorageLoadStatus = 'ok' | 'missing' | 'corrupted' | 'unavailable';
export type StorageWriteError = 'unavailable' | 'quota_exceeded' | 'serialization' | 'empty_blocked';

export interface StorageLoadResult<T> {
  data: T;
  status: StorageLoadStatus;
  migrated: boolean;
}

export interface StorageWriteResult {
  ok: boolean;
  error?: StorageWriteError;
}

const VALID_APP_THEMES = new Set<string>(APP_THEMES.map((t) => t.id));
const VALID_LANGUAGES = new Set<AppLanguage>(['en', 'vi', 'zh-TW', 'ja']);
const VALID_RESULTS = new Set<SavedMatch['result']>(['1-0', '0-1', '1/2-1/2', '*']);
const VALID_USER_SIDES = new Set<'w' | 'b' | 'both'>(['w', 'b', 'both']);

const LEGACY_LANGUAGE_MAP: Record<string, AppLanguage> = {
  vn: 'vi',
  'vi-VN': 'vi',
  'en-US': 'en',
  'en-GB': 'en',
  tw: 'zh-TW',
  'zh-Hant': 'zh-TW',
  jp: 'ja',
  'ja-JP': 'ja',
};

const LEGACY_ANIMATION_LEVEL_MAP: Record<string, AnimationLevelId> = {
  none: 'off',
  disabled: 'off',
  minimal: 'subtle',
  normal: 'smooth',
  default: 'smooth',
  high: 'expressive',
  full: 'expressive',
};

const SAFE_AVATAR_DATA_URL_RE = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.round(Math.min(max, Math.max(min, value)));
}

function readBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readString(value: unknown, fallback: string, maxLen = 200): string {
  if (typeof value !== 'string') return fallback;
  return value.slice(0, maxLen);
}

function readNullableNumber(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.min(max, Math.max(min, value));
}

/**
 * Validates that an avatar data URL is a safe raster image (PNG/JPEG/WebP/GIF)
 * within the LocalStorage-friendly size budget (blocking SVG XSS and multi-MB bloat).
 */
export function isValidAvatarDataUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value.length === 0 || value.length > MAX_AVATAR_DATA_URL_LENGTH) return false;
  return SAFE_AVATAR_DATA_URL_RE.test(value);
}

/**
 * Safely retrieves window.localStorage without throwing SecurityError in
 * sandboxed iframes, private browsing, or SSR contexts.
 */
export function getSafeLocalStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  try {
    const storage = window.localStorage;
    if (!storage) return null;
    return storage;
  } catch {
    return null;
  }
}

function isQuotaExceededError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const candidate = err as { name?: string; code?: number };
  return (
    candidate.name === 'QuotaExceededError' ||
    candidate.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    candidate.code === 22 ||
    candidate.code === 1014
  );
}

function resolveStorage(explicit?: StorageLike | null): StorageLike | null {
  if (explicit !== undefined) return explicit;
  return getSafeLocalStorage();
}

/**
 * Best-effort preservation of unreadable/corrupted raw JSON under `<key>_corrupt_backup`
 * before an explicit user save replaces the primary key. Never deletes or modifies other keys.
 */
function preserveCorruptRawBeforeOverwrite(
  storage: StorageLike,
  key: string,
  existingRaw: string | null
): void {
  if (!existingRaw) return;
  try {
    JSON.parse(existingRaw);
    // Existing payload is valid JSON — no backup needed.
    return;
  } catch {
    try {
      const backupKey = `${key}_corrupt_backup`;
      if (!storage.getItem(backupKey)) {
        storage.setItem(backupKey, existingRaw);
      }
    } catch {
      // Ignore backup failures (e.g. storage full or restricted) — never block or destroy other keys.
    }
  }
}

function safeWriteItem(storage: StorageLike | null, key: string, payload: unknown): StorageWriteResult {
  if (!storage) {
    return { ok: false, error: 'unavailable' };
  }
  let serialized: string;
  try {
    serialized = JSON.stringify(payload);
  } catch {
    return { ok: false, error: 'serialization' };
  }

  let existingRaw: string | null = null;
  try {
    existingRaw = storage.getItem(key);
    // Skip redundant synchronous disk write when stored JSON is byte-identical
    if (existingRaw === serialized) {
      return { ok: true };
    }
  } catch {
    // Proceed to write attempt if getItem throws (e.g. restricted storage)
  }

  preserveCorruptRawBeforeOverwrite(storage, key, existingRaw);

  try {
    storage.setItem(key, serialized);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: isQuotaExceededError(err) ? 'quota_exceeded' : 'unavailable',
    };
  }
}

function unwrapPayloadEnvelope(raw: unknown): { payload: unknown; migrated: boolean } {
  if (isRecord(raw) && isRecord(raw.data) && !('appTheme' in raw) && !('displayName' in raw)) {
    return { payload: raw.data, migrated: true };
  }
  return { payload: raw, migrated: false };
}

export function sanitizePreferences(raw: unknown): AppPreferences {
  const { payload } = unwrapPayloadEnvelope(raw);
  if (!isRecord(payload)) return { ...DEFAULT_PREFERENCES };

  const appTheme: AppThemeId =
    typeof payload.appTheme === 'string' && VALID_APP_THEMES.has(payload.appTheme)
      ? (payload.appTheme as AppThemeId)
      : DEFAULT_PREFERENCES.appTheme;

  const boardTheme: BoardThemeId =
    typeof payload.boardTheme === 'string' && Object.prototype.hasOwnProperty.call(BOARD_THEMES, payload.boardTheme)
      ? (payload.boardTheme as BoardThemeId)
      : DEFAULT_PREFERENCES.boardTheme;

  const pieceStyle: PieceStyleId =
    typeof payload.pieceStyle === 'string' && Object.prototype.hasOwnProperty.call(PIECE_STYLES, payload.pieceStyle)
      ? (payload.pieceStyle as PieceStyleId)
      : DEFAULT_PREFERENCES.pieceStyle;

  let language: AppLanguage = DEFAULT_PREFERENCES.language;
  if (typeof payload.language === 'string') {
    if (VALID_LANGUAGES.has(payload.language as AppLanguage)) {
      language = payload.language as AppLanguage;
    } else if (Object.prototype.hasOwnProperty.call(LEGACY_LANGUAGE_MAP, payload.language)) {
      language = LEGACY_LANGUAGE_MAP[payload.language];
    }
  }

  let animationLevel: AnimationLevelId = DEFAULT_PREFERENCES.animationLevel;
  if (typeof payload.animationLevel === 'string') {
    if (Object.prototype.hasOwnProperty.call(ANIMATION_PRESET_DEFAULTS, payload.animationLevel)) {
      animationLevel = payload.animationLevel as AnimationLevelId;
    } else if (Object.prototype.hasOwnProperty.call(LEGACY_ANIMATION_LEVEL_MAP, payload.animationLevel)) {
      animationLevel = LEGACY_ANIMATION_LEVEL_MAP[payload.animationLevel];
    }
  }

  const animationEasing: AnimationEasingId =
    typeof payload.animationEasing === 'string' &&
    Object.prototype.hasOwnProperty.call(ANIMATION_EASING_CURVES, payload.animationEasing)
      ? (payload.animationEasing as AnimationEasingId)
      : DEFAULT_PREFERENCES.animationEasing;

  return {
    appTheme,
    appIcon: resolveAppIconId(typeof payload.appIcon === 'string' ? payload.appIcon : undefined),
    boardTheme,
    pieceStyle,
    language,
    animationLevel,
    pieceSpeedMs:
      typeof payload.pieceSpeedMs === 'number'
        ? clampPieceSpeedMs(payload.pieceSpeedMs)
        : DEFAULT_PREFERENCES.pieceSpeedMs,
    uiSpeedMultiplier:
      typeof payload.uiSpeedMultiplier === 'number'
        ? clampUiSpeedMultiplier(payload.uiSpeedMultiplier)
        : DEFAULT_PREFERENCES.uiSpeedMultiplier,
    animationEasing,
    pieceLiftEffect: readBool(payload.pieceLiftEffect, DEFAULT_PREFERENCES.pieceLiftEffect),
    pieceMoveAnimation: readBool(payload.pieceMoveAnimation, DEFAULT_PREFERENCES.pieceMoveAnimation),
    badgePopAnimation: readBool(payload.badgePopAnimation, DEFAULT_PREFERENCES.badgePopAnimation),
    boardHighlightsAnimation: readBool(
      payload.boardHighlightsAnimation,
      DEFAULT_PREFERENCES.boardHighlightsAnimation
    ),
    evalBarAnimation: readBool(payload.evalBarAnimation, DEFAULT_PREFERENCES.evalBarAnimation),
    uiTransitions: readBool(payload.uiTransitions, DEFAULT_PREFERENCES.uiTransitions),
    showCoordinates: readBool(payload.showCoordinates, DEFAULT_PREFERENCES.showCoordinates),
    showLegalMoves: readBool(payload.showLegalMoves, DEFAULT_PREFERENCES.showLegalMoves),
    showEvalBar: readBool(payload.showEvalBar, DEFAULT_PREFERENCES.showEvalBar),
    showMaterialDifference: readBool(
      payload.showMaterialDifference,
      DEFAULT_PREFERENCES.showMaterialDifference
    ),
    muted: readBool(payload.muted, DEFAULT_PREFERENCES.muted),
    analysisDepth: clampInt(payload.analysisDepth, 8, 22, DEFAULT_PREFERENCES.analysisDepth),
    multiPv: clampInt(payload.multiPv, 1, 3, DEFAULT_PREFERENCES.multiPv),
  };
}

export function sanitizeProfile(raw: unknown): UserProfile {
  const { payload } = unwrapPayloadEnvelope(raw);
  if (!isRecord(payload)) return { ...DEFAULT_PROFILE };

  // Backward-compatible fallback for legacy field aliases (`name` -> `displayName`, `avatar` -> `avatarImage`)
  const rawName = payload.displayName !== undefined ? payload.displayName : payload.name;
  const rawAvatar = payload.avatarImage !== undefined ? payload.avatarImage : payload.avatar;

  const displayName = readString(rawName, DEFAULT_PROFILE.displayName, 40).trim();
  const title = readString(payload.title, DEFAULT_PROFILE.title, 32).trim();
  const avatarColor =
    typeof payload.avatarColor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(payload.avatarColor)
      ? payload.avatarColor
      : DEFAULT_PROFILE.avatarColor;
  const avatarImage = isValidAvatarDataUrl(rawAvatar) ? rawAvatar : null;
  const bio = readString(payload.bio, DEFAULT_PROFILE.bio, 240);

  return {
    displayName: displayName || DEFAULT_PROFILE.displayName,
    title: title || DEFAULT_PROFILE.title,
    avatarColor,
    avatarImage,
    bio,
  };
}

function extractMatchArray(raw: unknown): unknown[] | null {
  if (Array.isArray(raw)) return raw;
  if (isRecord(raw)) {
    if (Array.isArray(raw.matches)) return raw.matches;
    if (Array.isArray(raw.data)) return raw.data;
  }
  return null;
}

function extractValidSavedMatches(raw: unknown): SavedMatch[] | null {
  const list = extractMatchArray(raw);
  if (!list) return null;

  const valid: SavedMatch[] = [];
  const seenIds = new Set<string>();

  for (let idx = 0; idx < list.length; idx++) {
    const item = list[idx];
    if (!isRecord(item)) continue;
    const rawId = readString(item.id, '', 80).trim();
    const pgn = readString(item.pgn, '', 20000).trim();
    if (!pgn) continue;

    // Preserve legacy records with valid PGN even if id was absent, while deduplicating IDs
    const id = rawId || `legacy-match-${idx + 1}`;
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const result: SavedMatch['result'] =
      typeof item.result === 'string' && VALID_RESULTS.has(item.result as SavedMatch['result'])
        ? (item.result as SavedMatch['result'])
        : '*';

    const userSide =
      typeof item.userSide === 'string' && VALID_USER_SIDES.has(item.userSide as 'w' | 'b' | 'both')
        ? (item.userSide as 'w' | 'b' | 'both')
        : undefined;

    const rawWhiteElo = item.whiteGameElo !== undefined ? item.whiteGameElo : item.whiteElo;
    const rawBlackElo = item.blackGameElo !== undefined ? item.blackGameElo : item.blackElo;

    valid.push({
      id,
      date: readString(item.date, 'Today', 40) || 'Today',
      whiteName: readString(item.whiteName, 'White', 60) || 'White',
      blackName: readString(item.blackName, 'Black', 60) || 'Black',
      result,
      reason: readString(item.reason, '', 80),
      openingName: readString(item.openingName, 'Standard Position', 120) || 'Standard Position',
      movesCount: clampInt(item.movesCount, 0, 500, 0),
      pgn,
      whiteAccuracy: readNullableNumber(item.whiteAccuracy, 0, 100),
      blackAccuracy: readNullableNumber(item.blackAccuracy, 0, 100),
      whiteGameElo: readNullableNumber(rawWhiteElo, 400, 2900),
      blackGameElo: readNullableNumber(rawBlackElo, 400, 2900),
      userSide,
    });
    if (valid.length >= MAX_SAVED_MATCHES) break;
  }

  return valid;
}

export function sanitizeSavedMatches(raw: unknown): SavedMatch[] {
  const valid = extractValidSavedMatches(raw);
  return valid && valid.length > 0 ? valid : SEEDED_MATCHES.map((m) => ({ ...m }));
}

export function loadPreferencesWithStatus(storage?: StorageLike | null): StorageLoadResult<AppPreferences> {
  const store = resolveStorage(storage);
  if (!store) {
    return { data: { ...DEFAULT_PREFERENCES }, status: 'unavailable', migrated: false };
  }
  try {
    const raw = store.getItem(PREFS_KEY);
    if (raw === null) {
      return { data: { ...DEFAULT_PREFERENCES }, status: 'missing', migrated: false };
    }
    const parsed: unknown = JSON.parse(raw);
    const { payload, migrated } = unwrapPayloadEnvelope(parsed);
    if (!isRecord(payload)) {
      return { data: { ...DEFAULT_PREFERENCES }, status: 'corrupted', migrated: false };
    }
    return { data: sanitizePreferences(parsed), status: 'ok', migrated };
  } catch {
    return { data: { ...DEFAULT_PREFERENCES }, status: 'corrupted', migrated: false };
  }
}

export function loadPreferences(storage?: StorageLike | null): AppPreferences {
  return loadPreferencesWithStatus(storage).data;
}

export function savePreferences(prefs: AppPreferences, storage?: StorageLike | null): StorageWriteResult {
  const store = resolveStorage(storage);
  const sanitized = sanitizePreferences(prefs);
  return safeWriteItem(store, PREFS_KEY, sanitized);
}

/**
 * Resets ONLY stored app preferences while preserving user profile and saved match history.
 */
export function resetStoredPreferences(storage?: Pick<Storage, 'removeItem'> | null): void {
  const store = storage !== undefined ? storage : getSafeLocalStorage();
  if (!store) return;
  try {
    store.removeItem(PREFERENCES_STORAGE_KEY);
  } catch {
    // Ignore storage access failures
  }
}

export function loadProfileWithStatus(storage?: StorageLike | null): StorageLoadResult<UserProfile> {
  const store = resolveStorage(storage);
  if (!store) {
    return { data: { ...DEFAULT_PROFILE }, status: 'unavailable', migrated: false };
  }
  try {
    const raw = store.getItem(PROFILE_KEY);
    if (raw === null) {
      return { data: { ...DEFAULT_PROFILE }, status: 'missing', migrated: false };
    }
    const parsed: unknown = JSON.parse(raw);
    const { payload, migrated } = unwrapPayloadEnvelope(parsed);
    if (!isRecord(payload)) {
      return { data: { ...DEFAULT_PROFILE }, status: 'corrupted', migrated: false };
    }
    return { data: sanitizeProfile(parsed), status: 'ok', migrated };
  } catch {
    return { data: { ...DEFAULT_PROFILE }, status: 'corrupted', migrated: false };
  }
}

export function loadProfile(storage?: StorageLike | null): UserProfile {
  return loadProfileWithStatus(storage).data;
}

export function saveProfile(profile: UserProfile, storage?: StorageLike | null): StorageWriteResult {
  const store = resolveStorage(storage);
  const sanitized = sanitizeProfile(profile);
  return safeWriteItem(store, PROFILE_KEY, sanitized);
}

export function loadSavedMatchesWithStatus(storage?: StorageLike | null): StorageLoadResult<SavedMatch[]> {
  const store = resolveStorage(storage);
  if (!store) {
    return { data: SEEDED_MATCHES.map((m) => ({ ...m })), status: 'unavailable', migrated: false };
  }
  try {
    const raw = store.getItem(MATCHES_KEY);
    if (raw === null) {
      return { data: SEEDED_MATCHES.map((m) => ({ ...m })), status: 'missing', migrated: false };
    }
    const parsed: unknown = JSON.parse(raw);
    const list = extractMatchArray(parsed);
    if (!list) {
      return { data: SEEDED_MATCHES.map((m) => ({ ...m })), status: 'corrupted', migrated: false };
    }
    const migrated = !Array.isArray(parsed);
    return { data: sanitizeSavedMatches(parsed), status: 'ok', migrated };
  } catch {
    return { data: SEEDED_MATCHES.map((m) => ({ ...m })), status: 'corrupted', migrated: false };
  }
}

export function loadSavedMatches(storage?: StorageLike | null): SavedMatch[] {
  return loadSavedMatchesWithStatus(storage).data;
}

/**
 * Safely persists saved match history.
 * - Never overwrites valid existing stored match history with an empty array.
 * - Never deletes/prunes existing stored matches when quota is exceeded (atomic failure leaves prior history intact).
 */
export function saveMatches(matches: SavedMatch[], storage?: StorageLike | null): StorageWriteResult {
  const store = resolveStorage(storage);
  if (!store) {
    return { ok: false, error: 'unavailable' };
  }
  const valid = extractValidSavedMatches(matches);
  if (!valid || valid.length === 0) {
    return { ok: false, error: 'empty_blocked' };
  }

  return safeWriteItem(store, MATCHES_KEY, valid.slice(0, MAX_SAVED_MATCHES));
}

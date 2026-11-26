import type { Color, PieceSymbol, Square } from 'chess.js';

export type AppState = 'title' | 'playing' | 'paused' | 'gameover';

export type GameMode = 'stockfish' | 'local' | 'analysis';

export type PlayerSideChoice = 'w' | 'b' | 'random';

export type BoardThemeId =
  | 'tournament'
  | 'walnut'
  | 'slate'
  | 'graphite'
  | 'jade-glass'
  | 'ocean-reef'
  | 'royal-amethyst'
  | 'marble-cream'
  | 'terracotta'
  | 'obsidian-neon'
  | 'sakura-blush'
  | 'honey-birch'
  | 'arctic-ice'
  | 'crimson-mahogany';

export interface BoardTheme {
  id: BoardThemeId;
  name: string;
  light: string;
  dark: string;
  lastMoveLight: string;
  lastMoveDark: string;
  selectedLight: string;
  selectedDark: string;
  coordLight: string;
  coordDark: string;
}

export const BOARD_THEMES: Record<BoardThemeId, BoardTheme> = {
  tournament: {
    id: 'tournament',
    name: 'Tournament Green',
    light: '#EEEED2',
    dark: '#769656',
    lastMoveLight: '#F5F682',
    lastMoveDark: '#B9CA43',
    selectedLight: '#F6F669',
    selectedDark: '#BACA2B',
    coordLight: '#769656',
    coordDark: '#EEEED2',
  },
  walnut: {
    id: 'walnut',
    name: 'Classic Walnut',
    light: '#F0D9B5',
    dark: '#B58863',
    lastMoveLight: '#F7EC74',
    lastMoveDark: '#DAC34B',
    selectedLight: '#F6E86E',
    selectedDark: '#D2B93E',
    coordLight: '#B58863',
    coordDark: '#F0D9B5',
  },
  slate: {
    id: 'slate',
    name: 'Slate Blue',
    light: '#DEE3E6',
    dark: '#8CA2AD',
    lastMoveLight: '#CDD981',
    lastMoveDark: '#92B364',
    selectedLight: '#D5E27B',
    selectedDark: '#8EAF5C',
    coordLight: '#8CA2AD',
    coordDark: '#DEE3E6',
  },
  graphite: {
    id: 'graphite',
    name: 'Dusk Graphite',
    light: '#D8D8D4',
    dark: '#6C7077',
    lastMoveLight: '#E4DF82',
    lastMoveDark: '#A8A64E',
    selectedLight: '#EBE67B',
    selectedDark: '#B0AD4B',
    coordLight: '#6C7077',
    coordDark: '#D8D8D4',
  },
  'jade-glass': {
    id: 'jade-glass',
    name: 'Frosted Jade',
    light: '#E3F2EC',
    dark: '#4E8C79',
    lastMoveLight: '#C5F0B0',
    lastMoveDark: '#67B887',
    selectedLight: '#B8F2C0',
    selectedDark: '#59B081',
    coordLight: '#4E8C79',
    coordDark: '#E3F2EC',
  },
  'ocean-reef': {
    id: 'ocean-reef',
    name: 'Ocean Reef',
    light: '#E4F0F7',
    dark: '#4C7DA1',
    lastMoveLight: '#BFE4F5',
    lastMoveDark: '#5DA3C9',
    selectedLight: '#AEE0F7',
    selectedDark: '#4D96BF',
    coordLight: '#4C7DA1',
    coordDark: '#E4F0F7',
  },
  'royal-amethyst': {
    id: 'royal-amethyst',
    name: 'Royal Amethyst',
    light: '#ECE7F5',
    dark: '#7B629E',
    lastMoveLight: '#DFC7F7',
    lastMoveDark: '#9A78C4',
    selectedLight: '#D6B8F5',
    selectedDark: '#8E69BA',
    coordLight: '#7B629E',
    coordDark: '#ECE7F5',
  },
  'marble-cream': {
    id: 'marble-cream',
    name: 'Carrara Marble',
    light: '#F6F4EF',
    dark: '#9C988E',
    lastMoveLight: '#EFE598',
    lastMoveDark: '#C2B86A',
    selectedLight: '#F2E582',
    selectedDark: '#C7BC5D',
    coordLight: '#858178',
    coordDark: '#F6F4EF',
  },
  terracotta: {
    id: 'terracotta',
    name: 'Terracotta Clay',
    light: '#F5E4D3',
    dark: '#B86A4D',
    lastMoveLight: '#F7D88A',
    lastMoveDark: '#D99B52',
    selectedLight: '#F5CE73',
    selectedDark: '#CF8F44',
    coordLight: '#B86A4D',
    coordDark: '#F5E4D3',
  },
  'obsidian-neon': {
    id: 'obsidian-neon',
    name: 'Obsidian Cyan',
    light: '#BCCCD1',
    dark: '#314954',
    lastMoveLight: '#8CE2E8',
    lastMoveDark: '#368C99',
    selectedLight: '#78DAE3',
    selectedDark: '#2E7E8C',
    coordLight: '#314954',
    coordDark: '#D2E4EA',
  },
  'sakura-blush': {
    id: 'sakura-blush',
    name: 'Sakura Blush',
    light: '#FAEDF0',
    dark: '#BA768A',
    lastMoveLight: '#F7CFD8',
    lastMoveDark: '#D689A0',
    selectedLight: '#F5BFD0',
    selectedDark: '#CC7892',
    coordLight: '#A86176',
    coordDark: '#FAEDF0',
  },
  'honey-birch': {
    id: 'honey-birch',
    name: 'Honey Birch',
    light: '#FBF0D9',
    dark: '#C99654',
    lastMoveLight: '#F7E37E',
    lastMoveDark: '#DEC14B',
    selectedLight: '#F5DD67',
    selectedDark: '#D6B73C',
    coordLight: '#A8793C',
    coordDark: '#FBF0D9',
  },
  'arctic-ice': {
    id: 'arctic-ice',
    name: 'Arctic Ice',
    light: '#EDF4FA',
    dark: '#6D92B8',
    lastMoveLight: '#C2E4FA',
    lastMoveDark: '#74B2DC',
    selectedLight: '#AFDCFA',
    selectedDark: '#60A3D1',
    coordLight: '#5C80A6',
    coordDark: '#EDF4FA',
  },
  'crimson-mahogany': {
    id: 'crimson-mahogany',
    name: 'Crimson Mahogany',
    light: '#F2E5DC',
    dark: '#8C4348',
    lastMoveLight: '#F2CA85',
    lastMoveDark: '#BF7658',
    selectedLight: '#EDBE72',
    selectedDark: '#B3684B',
    coordLight: '#8C4348',
    coordDark: '#F2E5DC',
  },
};

export interface TimeControl {
  id: string;
  label: string;
  category: 'Bullet' | 'Blitz' | 'Rapid' | 'Classical' | 'Unlimited';
  initialSeconds: number; // 0 means unlimited
  incrementSeconds: number;
}

export const TIME_CONTROLS: TimeControl[] = [
  { id: '1+0', label: '1 min', category: 'Bullet', initialSeconds: 60, incrementSeconds: 0 },
  { id: '3+0', label: '3 min', category: 'Blitz', initialSeconds: 180, incrementSeconds: 0 },
  { id: '3+2', label: '3 | 2', category: 'Blitz', initialSeconds: 180, incrementSeconds: 2 },
  { id: '5+0', label: '5 min', category: 'Blitz', initialSeconds: 300, incrementSeconds: 0 },
  { id: '10+0', label: '10 min', category: 'Rapid', initialSeconds: 600, incrementSeconds: 0 },
  { id: '15+10', label: '15 | 10', category: 'Rapid', initialSeconds: 900, incrementSeconds: 10 },
  { id: 'unlimited', label: 'Unlimited', category: 'Unlimited', initialSeconds: 0, incrementSeconds: 0 },
];

export interface StockfishLevel {
  id: string;
  name: string;
  elo: number;
  skillLevel: number; // UCI Skill Level 0..20
  depthCap: number;
  moveTimeMs: number;
  description: string;
}

export const STOCKFISH_LEVELS: StockfishLevel[] = [
  {
    id: 'novice',
    name: 'Club Novice',
    elo: 800,
    skillLevel: 1,
    depthCap: 3,
    moveTimeMs: 220,
    description: 'Makes casual inaccuracies and overlooks simple tactics.',
  },
  {
    id: 'casual',
    name: 'Intermediate',
    elo: 1200,
    skillLevel: 5,
    depthCap: 6,
    moveTimeMs: 320,
    description: 'Solid developing moves with occasional tactical slips.',
  },
  {
    id: 'club',
    name: 'Club Player',
    elo: 1600,
    skillLevel: 10,
    depthCap: 9,
    moveTimeMs: 450,
    description: 'Punishes loose pieces and plays principled openings.',
  },
  {
    id: 'expert',
    name: 'Candidate Master',
    elo: 2100,
    skillLevel: 15,
    depthCap: 13,
    moveTimeMs: 650,
    description: 'Sharp tactical calculation and strong endgame technique.',
  },
  {
    id: 'master',
    name: 'Grandmaster',
    elo: 2600,
    skillLevel: 18,
    depthCap: 16,
    moveTimeMs: 850,
    description: 'Relentless positional pressure and deep combinations.',
  },
  {
    id: 'max',
    name: 'Stockfish Max',
    elo: 3100,
    skillLevel: 20,
    depthCap: 18,
    moveTimeMs: 1100,
    description: 'Full-strength Stockfish WASM engine with zero handicap.',
  },
];

export type MoveClassification =
  | 'book'
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder';

export interface ClassificationMeta {
  label: string;
  symbol: string;
  color: string;
  bgColor: string;
}

export const CLASSIFICATION_META: Record<MoveClassification, ClassificationMeta> = {
  book: { label: 'Book', symbol: 'Bk', color: '#D5A47D', bgColor: 'rgba(213, 164, 125, 0.18)' },
  brilliant: { label: 'Brilliant', symbol: '!!', color: '#26C2A3', bgColor: 'rgba(38, 194, 163, 0.22)' },
  great: { label: 'Great', symbol: '!', color: '#5C9CE6', bgColor: 'rgba(92, 156, 230, 0.22)' },
  best: { label: 'Best', symbol: '★', color: '#81B64C', bgColor: 'rgba(129, 182, 76, 0.22)' },
  excellent: { label: 'Excellent', symbol: '✓', color: '#96BC4B', bgColor: 'rgba(150, 188, 75, 0.16)' },
  good: { label: 'Good', symbol: '·', color: '#A3A19C', bgColor: 'rgba(163, 161, 156, 0.14)' },
  inaccuracy: { label: 'Inaccuracy', symbol: '?!', color: '#F0C15C', bgColor: 'rgba(240, 193, 92, 0.22)' },
  mistake: { label: 'Mistake', symbol: '?', color: '#E58F2A', bgColor: 'rgba(229, 143, 42, 0.22)' },
  blunder: { label: 'Blunder', symbol: '??', color: '#E04F4F', bgColor: 'rgba(224, 79, 79, 0.24)' },
};

export interface EvalScore {
  type: 'cp' | 'mate';
  /** Normalized to White's perspective: positive favors White, negative favors Black. */
  value: number;
}

export interface EngineLine {
  multipv: number;
  depth: number;
  seldepth: number;
  score: EvalScore;
  nodes: number;
  nps: number;
  pvUci: string[];
  pvSan: string[];
}

export interface EngineAnalysis {
  fen: string;
  depth: number;
  nodes: number;
  nps: number;
  bestMoveUci: string | null;
  ponderUci: string | null;
  lines: EngineLine[];
  isSearching: boolean;
}

export interface MoveRecord {
  ply: number; // 1-based ply index
  moveNumber: number; // 1, 1, 2, 2...
  color: Color;
  san: string;
  uci: string;
  from: Square;
  to: Square;
  piece: PieceSymbol;
  captured?: PieceSymbol;
  promotion?: PieceSymbol;
  fenBefore: string;
  fenAfter: string;
  evalAfter?: EvalScore;
  bestMoveBefore?: string;
  classification?: MoveClassification;
  accuracy?: number;
}

export interface BoardArrow {
  from: Square;
  to: Square;
  color: string;
  kind?: 'best' | 'threat' | 'user';
}

export interface OpeningInfo {
  eco: string;
  name: string;
  moves: string[];
}

export interface ClassicStudy {
  id: string;
  title: string;
  subtitle: string;
  category: 'Classic Game' | 'Tactic' | 'Endgame';
  pgn?: string;
  fen?: string;
}

export interface GameTermination {
  isOver: boolean;
  winner: Color | 'draw' | null;
  reason: string;
  resultString: '1-0' | '0-1' | '1/2-1/2' | '*';
}

export interface MatchSettings {
  mode: GameMode;
  playerSide: PlayerSideChoice;
  stockfishLevelId: string;
  timeControlId: string;
}

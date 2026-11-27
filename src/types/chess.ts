import type { Color, PieceSymbol, Square } from 'chess.js';

export type AppState = 'title' | 'playing' | 'paused' | 'gameover';

export type GameMode = 'stockfish' | 'local' | 'analysis';

export type PlayerSideChoice = 'w' | 'b' | 'random';

export type BoardThemeCategory = 'Chess.com' | 'Classic' | 'Wood' | 'Stone' | 'Modern';

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
  | 'crimson-mahogany'
  | 'emerald-felt'
  | 'rosewood-royale'
  | 'midnight-gold'
  | 'olive-grove'
  | 'nordic-ash'
  | 'cobalt-tournament'
  | 'espresso-oak'
  | 'lavender-mist'
  | 'copper-patina'
  | 'matcha-zen'
  | 'sandstone-dune'
  | 'plum-velvet'
  | 'carbon-monolith'
  | 'coral-bay'
  | 'alpine-pine'
  | 'gilded-onyx'
  | 'cc-green'
  | 'cc-brown'
  | 'cc-icy-sea'
  | 'cc-blue'
  | 'cc-walnut'
  | 'cc-tournament'
  | 'cc-newspaper'
  | 'cc-glass'
  | 'cc-purple'
  | 'cc-bubblegum'
  | 'cc-burled-wood'
  | 'cc-dark-wood'
  | 'cc-orange'
  | 'cc-tan'
  | 'cc-red'
  | 'cc-sky';

export interface BoardTheme {
  id: BoardThemeId;
  name: string;
  category: BoardThemeCategory;
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
    category: 'Classic',
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
    category: 'Wood',
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
    category: 'Classic',
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
    category: 'Stone',
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
    category: 'Modern',
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
    category: 'Modern',
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
    category: 'Modern',
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
    category: 'Stone',
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
    category: 'Stone',
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
    category: 'Modern',
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
    category: 'Modern',
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
    category: 'Wood',
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
    category: 'Modern',
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
    category: 'Wood',
    light: '#F2E5DC',
    dark: '#8C4348',
    lastMoveLight: '#F2CA85',
    lastMoveDark: '#BF7658',
    selectedLight: '#EDBE72',
    selectedDark: '#B3684B',
    coordLight: '#8C4348',
    coordDark: '#F2E5DC',
  },
  'emerald-felt': {
    id: 'emerald-felt',
    name: 'Emerald Felt',
    category: 'Classic',
    light: '#EBF0E6',
    dark: '#3D7A5A',
    lastMoveLight: '#E9F28E',
    lastMoveDark: '#82B558',
    selectedLight: '#E4F075',
    selectedDark: '#73A84A',
    coordLight: '#3D7A5A',
    coordDark: '#EBF0E6',
  },
  'rosewood-royale': {
    id: 'rosewood-royale',
    name: 'Rosewood Royale',
    category: 'Wood',
    light: '#F5E6D3',
    dark: '#8F4C3E',
    lastMoveLight: '#F6D986',
    lastMoveDark: '#C98A4B',
    selectedLight: '#F4CE6C',
    selectedDark: '#BD7D3E',
    coordLight: '#8F4C3E',
    coordDark: '#F5E6D3',
  },
  'midnight-gold': {
    id: 'midnight-gold',
    name: 'Midnight Gold',
    category: 'Modern',
    light: '#EDE6D4',
    dark: '#384661',
    lastMoveLight: '#F3DF89',
    lastMoveDark: '#8B8955',
    selectedLight: '#F2D66B',
    selectedDark: '#858046',
    coordLight: '#384661',
    coordDark: '#EDE6D4',
  },
  'olive-grove': {
    id: 'olive-grove',
    name: 'Olive Grove',
    category: 'Classic',
    light: '#F2EFE1',
    dark: '#828B56',
    lastMoveLight: '#F4EE84',
    lastMoveDark: '#B9BE48',
    selectedLight: '#F2EA6D',
    selectedDark: '#B0B63A',
    coordLight: '#737C49',
    coordDark: '#F2EFE1',
  },
  'nordic-ash': {
    id: 'nordic-ash',
    name: 'Nordic Ash',
    category: 'Wood',
    light: '#ECEAE2',
    dark: '#8E8B82',
    lastMoveLight: '#E6E493',
    lastMoveDark: '#B4B465',
    selectedLight: '#E3E07C',
    selectedDark: '#ABA954',
    coordLight: '#7A776F',
    coordDark: '#ECEAE2',
  },
  'cobalt-tournament': {
    id: 'cobalt-tournament',
    name: 'Cobalt Tournament',
    category: 'Classic',
    light: '#EDF2F8',
    dark: '#466FA3',
    lastMoveLight: '#D4E99A',
    lastMoveDark: '#69A48B',
    selectedLight: '#C5E384',
    selectedDark: '#5A9880',
    coordLight: '#466FA3',
    coordDark: '#EDF2F8',
  },
  'espresso-oak': {
    id: 'espresso-oak',
    name: 'Espresso Oak',
    category: 'Wood',
    light: '#E9D6BD',
    dark: '#6E4B35',
    lastMoveLight: '#F2DC79',
    lastMoveDark: '#B89444',
    selectedLight: '#F0D362',
    selectedDark: '#AC8736',
    coordLight: '#6E4B35',
    coordDark: '#E9D6BD',
  },
  'lavender-mist': {
    id: 'lavender-mist',
    name: 'Lavender Mist',
    category: 'Modern',
    light: '#F3F0FA',
    dark: '#8E7DB3',
    lastMoveLight: '#E6D6FA',
    lastMoveDark: '#A88EE0',
    selectedLight: '#DBC5FA',
    selectedDark: '#9A7DD8',
    coordLight: '#7A699E',
    coordDark: '#F3F0FA',
  },
  'copper-patina': {
    id: 'copper-patina',
    name: 'Copper Patina',
    category: 'Stone',
    light: '#EBF0EC',
    dark: '#5C827E',
    lastMoveLight: '#E8E29B',
    lastMoveDark: '#92A86C',
    selectedLight: '#E5DC83',
    selectedDark: '#879E5E',
    coordLight: '#4E736F',
    coordDark: '#EBF0EC',
  },
  'matcha-zen': {
    id: 'matcha-zen',
    name: 'Matcha Zen',
    category: 'Classic',
    light: '#F3F4E9',
    dark: '#869E68',
    lastMoveLight: '#F2F088',
    lastMoveDark: '#BAC750',
    selectedLight: '#EFEA71',
    selectedDark: '#B0BE40',
    coordLight: '#738B57',
    coordDark: '#F3F4E9',
  },
  'sandstone-dune': {
    id: 'sandstone-dune',
    name: 'Sandstone Dune',
    category: 'Stone',
    light: '#F7ECD9',
    dark: '#C49464',
    lastMoveLight: '#F7E080',
    lastMoveDark: '#DBB74F',
    selectedLight: '#F5D666',
    selectedDark: '#D1AC3F',
    coordLight: '#A8794B',
    coordDark: '#F7ECD9',
  },
  'plum-velvet': {
    id: 'plum-velvet',
    name: 'Plum Velvet',
    category: 'Modern',
    light: '#F3E9EE',
    dark: '#7D4D66',
    lastMoveLight: '#F0CFDC',
    lastMoveDark: '#AD6C8E',
    selectedLight: '#EBBDCE',
    selectedDark: '#A15D81',
    coordLight: '#7D4D66',
    coordDark: '#F3E9EE',
  },
  'carbon-monolith': {
    id: 'carbon-monolith',
    name: 'Carbon Monolith',
    category: 'Stone',
    light: '#C9CDD1',
    dark: '#484E57',
    lastMoveLight: '#DCE08A',
    lastMoveDark: '#8E974E',
    selectedLight: '#D8DD72',
    selectedDark: '#858F42',
    coordLight: '#484E57',
    coordDark: '#D6DADE',
  },
  'coral-bay': {
    id: 'coral-bay',
    name: 'Coral Bay',
    category: 'Modern',
    light: '#FAF0EA',
    dark: '#C77867',
    lastMoveLight: '#F7DF94',
    lastMoveDark: '#DE9F62',
    selectedLight: '#F5D47A',
    selectedDark: '#D49253',
    coordLight: '#B26453',
    coordDark: '#FAF0EA',
  },
  'alpine-pine': {
    id: 'alpine-pine',
    name: 'Alpine Pine',
    category: 'Classic',
    light: '#E7EFEA',
    dark: '#3B6656',
    lastMoveLight: '#D8ED98',
    lastMoveDark: '#6CA168',
    selectedLight: '#CBE882',
    selectedDark: '#5E945A',
    coordLight: '#3B6656',
    coordDark: '#E7EFEA',
  },
  'gilded-onyx': {
    id: 'gilded-onyx',
    name: 'Gilded Onyx',
    category: 'Stone',
    light: '#EFE6D1',
    dark: '#524F4A',
    lastMoveLight: '#F2DE82',
    lastMoveDark: '#A8964B',
    selectedLight: '#F0D568',
    selectedDark: '#9D8A3E',
    coordLight: '#524F4A',
    coordDark: '#EFE6D1',
  },
  'cc-green': {
    id: 'cc-green',
    name: 'Green',
    category: 'Chess.com',
    light: '#EEEED2',
    dark: '#769656',
    lastMoveLight: '#F6F669',
    lastMoveDark: '#BACA2B',
    selectedLight: '#F6F669',
    selectedDark: '#BACA2B',
    coordLight: '#769656',
    coordDark: '#EEEED2',
  },
  'cc-brown': {
    id: 'cc-brown',
    name: 'Brown',
    category: 'Chess.com',
    light: '#F0D9B5',
    dark: '#B58863',
    lastMoveLight: '#F7EC74',
    lastMoveDark: '#DAC34B',
    selectedLight: '#F6E86E',
    selectedDark: '#D2B93E',
    coordLight: '#B58863',
    coordDark: '#F0D9B5',
  },
  'cc-icy-sea': {
    id: 'cc-icy-sea',
    name: 'Icy Sea',
    category: 'Chess.com',
    light: '#F0F4F7',
    dark: '#7395AE',
    lastMoveLight: '#CBE6F5',
    lastMoveDark: '#5B9BC2',
    selectedLight: '#BBE0F5',
    selectedDark: '#4D90B8',
    coordLight: '#7395AE',
    coordDark: '#F0F4F7',
  },
  'cc-blue': {
    id: 'cc-blue',
    name: 'Blue',
    category: 'Chess.com',
    light: '#EAE9D2',
    dark: '#4B7399',
    lastMoveLight: '#75C7E8',
    lastMoveDark: '#4396B9',
    selectedLight: '#6AC1E6',
    selectedDark: '#388CAE',
    coordLight: '#4B7399',
    coordDark: '#EAE9D2',
  },
  'cc-walnut': {
    id: 'cc-walnut',
    name: 'Walnut',
    category: 'Chess.com',
    light: '#D8B78C',
    dark: '#8C5E3C',
    lastMoveLight: '#E8D27A',
    lastMoveDark: '#BA9B3D',
    selectedLight: '#E6CB65',
    selectedDark: '#B08F32',
    coordLight: '#8C5E3C',
    coordDark: '#D8B78C',
  },
  'cc-tournament': {
    id: 'cc-tournament',
    name: 'Tournament',
    category: 'Chess.com',
    light: '#EAE8E4',
    dark: '#316549',
    lastMoveLight: '#DCEB8B',
    lastMoveDark: '#6CA653',
    selectedLight: '#D5E875',
    selectedDark: '#5E9946',
    coordLight: '#316549',
    coordDark: '#EAE8E4',
  },
  'cc-newspaper': {
    id: 'cc-newspaper',
    name: 'Newspaper',
    category: 'Chess.com',
    light: '#F2F2F2',
    dark: '#A7A7A7',
    lastMoveLight: '#E6E297',
    lastMoveDark: '#B8B468',
    selectedLight: '#E3DF80',
    selectedDark: '#B0AB58',
    coordLight: '#6E6E6E',
    coordDark: '#F2F2F2',
  },
  'cc-glass': {
    id: 'cc-glass',
    name: 'Glass',
    category: 'Chess.com',
    light: '#646E7A',
    dark: '#3D444E',
    lastMoveLight: '#7A9FB8',
    lastMoveDark: '#4E728A',
    selectedLight: '#7098B5',
    selectedDark: '#466A82',
    coordLight: '#C5CFD9',
    coordDark: '#C5CFD9',
  },
  'cc-purple': {
    id: 'cc-purple',
    name: 'Purple',
    category: 'Chess.com',
    light: '#EFEFEF',
    dark: '#8877B7',
    lastMoveLight: '#E2D4F7',
    lastMoveDark: '#A58AD9',
    selectedLight: '#D9C5F5',
    selectedDark: '#9A7CD1',
    coordLight: '#8877B7',
    coordDark: '#EFEFEF',
  },
  'cc-bubblegum': {
    id: 'cc-bubblegum',
    name: 'Bubblegum',
    category: 'Chess.com',
    light: '#FCE3EC',
    dark: '#F28FB1',
    lastMoveLight: '#FFF0A8',
    lastMoveDark: '#F5B582',
    selectedLight: '#FFE98C',
    selectedDark: '#F0A870',
    coordLight: '#CC5E85',
    coordDark: '#FCE3EC',
  },
  'cc-burled-wood': {
    id: 'cc-burled-wood',
    name: 'Burled Wood',
    category: 'Chess.com',
    light: '#E5C29F',
    dark: '#9E6338',
    lastMoveLight: '#F2D97D',
    lastMoveDark: '#C79B44',
    selectedLight: '#F0D066',
    selectedDark: '#BD9038',
    coordLight: '#9E6338',
    coordDark: '#E5C29F',
  },
  'cc-dark-wood': {
    id: 'cc-dark-wood',
    name: 'Dark Wood',
    category: 'Chess.com',
    light: '#C29B74',
    dark: '#6F462C',
    lastMoveLight: '#DEC86F',
    lastMoveDark: '#A8893B',
    selectedLight: '#D9BF59',
    selectedDark: '#9E7F31',
    coordLight: '#6F462C',
    coordDark: '#E5CBB0',
  },
  'cc-orange': {
    id: 'cc-orange',
    name: 'Orange',
    category: 'Chess.com',
    light: '#FCE4B2',
    dark: '#D08B18',
    lastMoveLight: '#FFF08F',
    lastMoveDark: '#E6B330',
    selectedLight: '#FFEA73',
    selectedDark: '#DDA724',
    coordLight: '#B07210',
    coordDark: '#FCE4B2',
  },
  'cc-tan': {
    id: 'cc-tan',
    name: 'Tan',
    category: 'Chess.com',
    light: '#EDD6B0',
    dark: '#B88762',
    lastMoveLight: '#F4E687',
    lastMoveDark: '#D1BA53',
    selectedLight: '#F2E070',
    selectedDark: '#C7AF46',
    coordLight: '#9E704D',
    coordDark: '#EDD6B0',
  },
  'cc-red': {
    id: 'cc-red',
    name: 'Red',
    category: 'Chess.com',
    light: '#F5DBC3',
    dark: '#BB5746',
    lastMoveLight: '#F7D883',
    lastMoveDark: '#D98E4E',
    selectedLight: '#F5CE6B',
    selectedDark: '#CF8240',
    coordLight: '#BB5746',
    coordDark: '#F5DBC3',
  },
  'cc-sky': {
    id: 'cc-sky',
    name: 'Sky',
    category: 'Chess.com',
    light: '#EFEFEF',
    dark: '#8FB3CC',
    lastMoveLight: '#CEE9F7',
    lastMoveDark: '#6CA9CF',
    selectedLight: '#BEE2F5',
    selectedDark: '#5C9DC7',
    coordLight: '#6F93AD',
    coordDark: '#EFEFEF',
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
  book: { label: 'Book', symbol: 'Bk', color: '#A88865', bgColor: 'rgba(168, 136, 101, 0.22)' },
  brilliant: { label: 'Brilliant', symbol: '!!', color: '#1BADA6', bgColor: 'rgba(27, 173, 166, 0.24)' },
  great: { label: 'Great', symbol: '!', color: '#5089C6', bgColor: 'rgba(80, 137, 198, 0.24)' },
  best: { label: 'Best', symbol: '★', color: '#96BC4B', bgColor: 'rgba(150, 188, 75, 0.24)' },
  excellent: { label: 'Excellent', symbol: '👍', color: '#8AB846', bgColor: 'rgba(138, 184, 70, 0.22)' },
  good: { label: 'Good', symbol: '✓', color: '#96AF8B', bgColor: 'rgba(150, 175, 139, 0.2)' },
  inaccuracy: { label: 'Inaccuracy', symbol: '?!', color: '#E6A817', bgColor: 'rgba(230, 168, 23, 0.24)' },
  mistake: { label: 'Mistake', symbol: '?', color: '#E58F2A', bgColor: 'rgba(229, 143, 42, 0.24)' },
  blunder: { label: 'Blunder', symbol: '??', color: '#CA3431', bgColor: 'rgba(202, 52, 49, 0.26)' },
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

import type { PieceSymbol } from 'chess.js';

export type AppIconTone = 'white' | 'black';

export type AppIconId =
  | 'white-king'
  | 'white-queen'
  | 'white-rook'
  | 'white-bishop'
  | 'white-knight'
  | 'white-pawn'
  | 'black-king'
  | 'black-queen'
  | 'black-rook'
  | 'black-bishop'
  | 'black-knight'
  | 'black-pawn';

export interface AppIconMeta {
  id: AppIconId;
  piece: PieceSymbol;
  tone: AppIconTone;
  pieceLabelKey: 'pieceKing' | 'pieceQueen' | 'pieceRook' | 'pieceBishop' | 'pieceKnight' | 'piecePawn';
  name: string;
  subtitle: string;
}

export const APP_ICONS: AppIconMeta[] = [
  // Frosted Translucent White Jade Set (6 pieces)
  {
    id: 'white-king',
    piece: 'k',
    tone: 'white',
    pieceLabelKey: 'pieceKing',
    name: 'White Jade King',
    subtitle: 'Frosted white jade',
  },
  {
    id: 'white-queen',
    piece: 'q',
    tone: 'white',
    pieceLabelKey: 'pieceQueen',
    name: 'White Jade Queen',
    subtitle: 'Frosted white jade',
  },
  {
    id: 'white-rook',
    piece: 'r',
    tone: 'white',
    pieceLabelKey: 'pieceRook',
    name: 'White Jade Rook',
    subtitle: 'Frosted white jade',
  },
  {
    id: 'white-bishop',
    piece: 'b',
    tone: 'white',
    pieceLabelKey: 'pieceBishop',
    name: 'White Jade Bishop',
    subtitle: 'Frosted white jade',
  },
  {
    id: 'white-knight',
    piece: 'n',
    tone: 'white',
    pieceLabelKey: 'pieceKnight',
    name: 'White Jade Knight',
    subtitle: 'Frosted white jade',
  },
  {
    id: 'white-pawn',
    piece: 'p',
    tone: 'white',
    pieceLabelKey: 'piecePawn',
    name: 'White Jade Pawn',
    subtitle: 'Frosted white jade',
  },

  // Frosted Translucent Black Jade Set (6 pieces)
  {
    id: 'black-king',
    piece: 'k',
    tone: 'black',
    pieceLabelKey: 'pieceKing',
    name: 'Black Jade King',
    subtitle: 'Frosted black jade',
  },
  {
    id: 'black-queen',
    piece: 'q',
    tone: 'black',
    pieceLabelKey: 'pieceQueen',
    name: 'Black Jade Queen',
    subtitle: 'Frosted black jade',
  },
  {
    id: 'black-rook',
    piece: 'r',
    tone: 'black',
    pieceLabelKey: 'pieceRook',
    name: 'Black Jade Rook',
    subtitle: 'Frosted black jade',
  },
  {
    id: 'black-bishop',
    piece: 'b',
    tone: 'black',
    pieceLabelKey: 'pieceBishop',
    name: 'Black Jade Bishop',
    subtitle: 'Frosted black jade',
  },
  {
    id: 'black-knight',
    piece: 'n',
    tone: 'black',
    pieceLabelKey: 'pieceKnight',
    name: 'Black Jade Knight',
    subtitle: 'Frosted black jade',
  },
  {
    id: 'black-pawn',
    piece: 'p',
    tone: 'black',
    pieceLabelKey: 'piecePawn',
    name: 'Black Jade Pawn',
    subtitle: 'Frosted black jade',
  },
];

const VALID_ICON_IDS = new Set<AppIconId>(APP_ICONS.map((ic) => ic.id));

const LEGACY_ICON_MIGRATION: Record<string, AppIconId> = {
  crown: 'white-king',
  knight: 'white-knight',
  rook: 'white-rook',
  queen: 'white-queen',
  shield: 'black-king',
  star: 'white-bishop',
  prism: 'black-queen',
  orbit: 'black-knight',
};

/**
 * Safely resolves any persisted or legacy AppIconId into a valid frosted-jade icon ID.
 */
export function resolveAppIconId(raw: unknown): AppIconId {
  if (typeof raw === 'string') {
    if (VALID_ICON_IDS.has(raw as AppIconId)) {
      return raw as AppIconId;
    }
    if (raw in LEGACY_ICON_MIGRATION) {
      return LEGACY_ICON_MIGRATION[raw];
    }
  }
  return 'white-king';
}

export function getAppIconMeta(iconId: AppIconId): AppIconMeta {
  const safeId = resolveAppIconId(iconId);
  return APP_ICONS.find((ic) => ic.id === safeId) ?? APP_ICONS[0];
}

export function filterAppIcons(filter: 'all' | AppIconTone): AppIconMeta[] {
  if (filter === 'all') return APP_ICONS;
  return APP_ICONS.filter((ic) => ic.tone === filter);
}

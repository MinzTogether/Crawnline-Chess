import React, { useState } from 'react';
import type { Color, PieceSymbol, Square } from 'chess.js';
import {
  AlertCircle,
  ArrowLeftRight,
  ArrowUpDown,
  CheckCircle2,
  Crown,
  Eraser,
  RotateCcw,
  Shuffle,
} from 'lucide-react';
import { BOARD_THEMES, type BoardThemeId } from '../types/chess';
import type { PieceStyleId } from '../types/preferences';
import {
  BOARD_FILES,
  BOARD_RANKS,
  STANDARD_START_FEN,
  createKingsOnlyBoard,
  fenToBoardMap,
  generateRandomChessFen,
  setSquarePiece,
  swapOrMoveSquare,
  type BoardMap,
  type BoardPiece,
  type CustomPositionValidation,
} from '../game/customPosition';
import { useI18n } from '../i18n/LanguageContext';
import { ChessPiece } from './ChessPieces';

type EditorTool =
  | { kind: 'swap' }
  | { kind: 'erase' }
  | { kind: 'place'; piece: BoardPiece };

const PALETTE_PIECES: PieceSymbol[] = ['k', 'q', 'r', 'b', 'n', 'p'];

interface CustomBoardEditorProps {
  board: BoardMap;
  turn: Color;
  validation: CustomPositionValidation;
  boardTheme: BoardThemeId;
  pieceStyle: PieceStyleId;
  onChangeBoard: (next: BoardMap) => void;
  onChangeTurn: (next: Color) => void;
}

export const CustomBoardEditor: React.FC<CustomBoardEditorProps> = ({
  board,
  turn,
  validation,
  boardTheme,
  pieceStyle,
  onChangeBoard,
  onChangeTurn,
}) => {
  const { t } = useI18n();
  const [tool, setTool] = useState<EditorTool>({ kind: 'swap' });
  const [selectedSq, setSelectedSq] = useState<Square | null>(null);
  const [dragOriginSq, setDragOriginSq] = useState<Square | null>(null);
  const [dragOverSq, setDragOverSq] = useState<Square | null>(null);
  const [flipped, setFlipped] = useState(false);

  const theme = BOARD_THEMES[boardTheme] ?? BOARD_THEMES.tournament;
  const ranks = flipped ? [...BOARD_RANKS].reverse() : [...BOARD_RANKS];
  const files = flipped ? [...BOARD_FILES].reverse() : [...BOARD_FILES];

  const handleSquareClick = (sq: Square) => {
    if (tool.kind === 'erase') {
      onChangeBoard(setSquarePiece(board, sq, null));
      setSelectedSq(null);
      return;
    }

    if (tool.kind === 'place') {
      onChangeBoard(setSquarePiece(board, sq, tool.piece));
      setSelectedSq(null);
      return;
    }

    // Default: Swap / Move mode
    if (!selectedSq) {
      if (board[sq]) {
        setSelectedSq(sq);
      }
      return;
    }

    if (selectedSq === sq) {
      setSelectedSq(null);
      return;
    }

    onChangeBoard(swapOrMoveSquare(board, selectedSq, sq));
    setSelectedSq(null);
  };

  const handleDropOnSquare = (targetSq: Square) => {
    if (dragOriginSq && dragOriginSq !== targetSq) {
      onChangeBoard(swapOrMoveSquare(board, dragOriginSq, targetSq));
    }
    setDragOriginSq(null);
    setDragOverSq(null);
    setSelectedSq(null);
  };

  return (
    <div className="flex flex-col gap-3.5" data-testid="custom-board-editor">
      {/* Compact Instruction + Validation Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-[var(--app-text-muted)]">{t('customEditorHint')}</span>
        {validation.valid ? (
          <span
            data-testid="custom-position-valid"
            className="inline-flex items-center gap-1.5 font-semibold text-[#6CC067] whitespace-nowrap"
          >
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>{t('customPositionReady')}</span>
          </span>
        ) : (
          <span
            data-testid="custom-position-error"
            className="inline-flex items-center gap-1.5 font-semibold text-[#E06060] whitespace-nowrap"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{t(validation.errorKey)}</span>
          </span>
        )}
      </div>

      {/* Interactive 8x8 Editor Board */}
      <div
        className="w-full max-w-[460px] mx-auto aspect-square rounded-xl overflow-hidden border border-[var(--app-border-strong)] shadow-md select-none grid grid-cols-8 grid-rows-8"
        role="grid"
        aria-label={t('modeCustomTitle')}
      >
        {ranks.map((rank, rIdx) =>
          files.map((file, fIdx) => {
            const sq = `${file}${rank}` as Square;
            const piece = board[sq];
            const isLight = (rIdx + fIdx) % 2 === 0;
            const isSelected = selectedSq === sq;
            const isDragTarget = dragOverSq === sq && dragOriginSq !== sq;

            const bg = isSelected
              ? isLight
                ? theme.selectedLight
                : theme.selectedDark
              : isLight
                ? theme.light
                : theme.dark;

            const coordColor = isLight ? theme.coordLight : theme.coordDark;

            return (
              <button
                key={sq}
                type="button"
                data-testid={`editor-sq-${sq}`}
                data-piece={piece ? `${piece.color}${piece.type}` : ''}
                aria-label={`${sq}${piece ? ` ${piece.color === 'w' ? 'White' : 'Black'} ${piece.type}` : ' empty'}`}
                onClick={() => handleSquareClick(sq)}
                draggable={Boolean(piece) && tool.kind === 'swap'}
                onDragStart={(e) => {
                  if (!piece) return;
                  setDragOriginSq(sq);
                  setSelectedSq(sq);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', sq);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOverSq !== sq) setDragOverSq(sq);
                }}
                onDragLeave={() => {
                  if (dragOverSq === sq) setDragOverSq(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDropOnSquare(sq);
                }}
                onDragEnd={() => {
                  setDragOriginSq(null);
                  setDragOverSq(null);
                }}
                className={`relative w-full h-full flex items-center justify-center cursor-pointer transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--app-accent)] ${
                  isDragTarget ? 'ring-2 ring-inset ring-[var(--app-accent)]' : ''
                }`}
                style={{ backgroundColor: bg }}
              >
                {fIdx === 0 && (
                  <span
                    className="pointer-events-none absolute top-0.5 left-1 text-[9px] font-bold leading-none opacity-85"
                    style={{ color: coordColor }}
                  >
                    {rank}
                  </span>
                )}
                {rIdx === 7 && (
                  <span
                    className="pointer-events-none absolute bottom-0.5 right-1 text-[9px] font-bold leading-none opacity-85"
                    style={{ color: coordColor }}
                  >
                    {file}
                  </span>
                )}
                {piece && (
                  <div
                    className={`w-[86%] h-[86%] pointer-events-none transition-transform duration-150 ${
                      isSelected ? 'scale-110 drop-shadow-md' : ''
                    }`}
                  >
                    <ChessPiece type={piece.type} color={piece.color} pieceStyle={pieceStyle} />
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Tool Strip: Swap/Move, Erase, and Quick Board Actions */}
      <div className="w-full max-w-[460px] mx-auto flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[var(--app-surface-2)] border border-[var(--app-border)]">
            <button
              type="button"
              data-testid="editor-tool-swap"
              aria-pressed={tool.kind === 'swap'}
              onClick={() => {
                setTool({ kind: 'swap' });
                setSelectedSq(null);
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                tool.kind === 'swap'
                  ? 'bg-[var(--app-accent)] text-[var(--app-accent-fg)]'
                  : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>{t('customToolSwap')}</span>
            </button>
            <button
              type="button"
              data-testid="editor-tool-erase"
              aria-pressed={tool.kind === 'erase'}
              onClick={() => {
                setTool({ kind: 'erase' });
                setSelectedSq(null);
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                tool.kind === 'erase'
                  ? 'bg-[#C94A4A] text-white'
                  : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
              }`}
            >
              <Eraser className="w-3.5 h-3.5" />
              <span>{t('customToolErase')}</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              data-testid="editor-action-standard"
              title={t('customActionStandard')}
              onClick={() => {
                onChangeBoard(fenToBoardMap(STANDARD_START_FEN));
                onChangeTurn('w');
                setSelectedSq(null);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-[11px] font-semibold text-[var(--app-text)] cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{t('customActionStandard')}</span>
            </button>
            <button
              type="button"
              data-testid="editor-action-shuffle"
              title={t('customActionShuffle')}
              onClick={() => {
                onChangeBoard(fenToBoardMap(generateRandomChessFen()));
                onChangeTurn('w');
                setSelectedSq(null);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-[11px] font-semibold text-[var(--app-text)] cursor-pointer whitespace-nowrap"
            >
              <Shuffle className="w-3 h-3" />
              <span>{t('customActionShuffle')}</span>
            </button>
            <button
              type="button"
              data-testid="editor-action-kings"
              title={t('customActionKingsOnly')}
              onClick={() => {
                onChangeBoard(createKingsOnlyBoard());
                setSelectedSq(null);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-[11px] font-semibold text-[var(--app-text)] cursor-pointer whitespace-nowrap"
            >
              <Crown className="w-3 h-3" />
              <span>{t('customActionKingsOnly')}</span>
            </button>
            <button
              type="button"
              data-testid="editor-action-flip"
              aria-label={t('customActionFlip')}
              title={t('customActionFlip')}
              onClick={() => setFlipped((f) => !f)}
              className="p-1.5 rounded-lg bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-[var(--app-text)] cursor-pointer"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Piece Brush Palette (White & Black rows) + Side to Move */}
        <div className="p-2.5 rounded-xl bg-[var(--app-surface-2)] border border-[var(--app-border)] flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="font-semibold text-[var(--app-text-muted)]">{t('customPlacePiecesLabel')}</span>
            <div className="inline-flex items-center gap-1">
              <span className="text-[var(--app-text-subtle)] mr-1">{t('customFirstTurnLabel')}:</span>
              {(['w', 'b'] as Color[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  data-testid={`editor-turn-${c}`}
                  aria-pressed={turn === c}
                  onClick={() => onChangeTurn(c)}
                  className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    turn === c
                      ? 'bg-[var(--app-accent)] text-[var(--app-accent-fg)]'
                      : 'bg-[var(--app-surface)] text-[var(--app-text-muted)] hover:text-[var(--app-text)] border border-[var(--app-border)]'
                  }`}
                >
                  {c === 'w' ? t('white') : t('black')}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-6 gap-1.5">
            {(['w', 'b'] as Color[]).flatMap((color) =>
              PALETTE_PIECES.map((type) => {
                const active =
                  tool.kind === 'place' && tool.piece.color === color && tool.piece.type === type;
                return (
                  <button
                    key={`${color}-${type}`}
                    type="button"
                    data-testid={`editor-palette-${color}${type}`}
                    aria-pressed={active}
                    aria-label={`${color === 'w' ? t('white') : t('black')} ${type}`}
                    onClick={() => {
                      setTool({ kind: 'place', piece: { color, type } });
                      setSelectedSq(null);
                    }}
                    className={`h-10 rounded-lg border flex items-center justify-center p-1 transition-all cursor-pointer ${
                      active
                        ? 'border-[var(--app-accent)] ring-2 ring-[var(--app-accent)] scale-[1.03]'
                        : 'border-black/20 hover:border-[var(--app-accent)]'
                    }`}
                    style={{
                      backgroundColor: color === 'b' ? theme.light : theme.dark,
                    }}
                  >
                    <div className="w-7 h-7 pointer-events-none">
                      <ChessPiece type={type} color={color} pieceStyle={pieceStyle} />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { Color, PieceSymbol, Square } from 'chess.js';
import {
  BOARD_THEMES,
  CLASSIFICATION_META,
  type BoardArrow,
  type BoardThemeId,
  type EvalScore,
  type MoveClassification,
} from '../types/chess';
import { evalToBarPercent, formatEvalScore } from '../engine/uciParser';
import { ChessPiece } from './ChessPieces';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'] as const;

const PIECE_NAMES: Record<PieceSymbol, string> = {
  p: 'Pawn',
  n: 'Knight',
  b: 'Bishop',
  r: 'Rook',
  q: 'Queen',
  k: 'King',
};

interface ChessBoardProps {
  fen: string;
  orientation: Color;
  themeId: BoardThemeId;
  interactive: boolean;
  allowedTurn?: Color | 'both';
  lastMove?: { from: Square; to: Square; classification?: MoveClassification } | null;
  engineArrows: BoardArrow[];
  showCoordinates: boolean;
  showLegalMoves: boolean;
  showEvalBar: boolean;
  evalScore: EvalScore | null;
  onMove: (from: Square, to: Square, promotion?: PieceSymbol) => boolean;
}

function squareToBoardCoords(sq: Square, orientation: Color): { x: number; y: number } {
  const fileIdx = FILES.indexOf(sq[0] as (typeof FILES)[number]);
  const rankNum = parseInt(sq[1], 10); // 1..8
  const col = orientation === 'w' ? fileIdx : 7 - fileIdx;
  const row = orientation === 'w' ? 8 - rankNum : rankNum - 1;
  return { x: col * 100 + 50, y: row * 100 + 50 };
}

export const ChessBoard: React.FC<ChessBoardProps> = ({
  fen,
  orientation,
  themeId,
  interactive,
  allowedTurn = 'both',
  lastMove,
  engineArrows,
  showCoordinates,
  showLegalMoves,
  showEvalBar,
  evalScore,
  onMove,
}) => {
  const theme = BOARD_THEMES[themeId];
  const boardRef = useRef<HTMLDivElement>(null);

  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [draggingFrom, setDraggingFrom] = useState<Square | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square; color: Color } | null>(null);

  // User right-click annotations (like Chess.com!)
  const [userArrows, setUserArrows] = useState<BoardArrow[]>([]);
  const [markedSquares, setMarkedSquares] = useState<Set<Square>>(new Set());
  const rightDragStartRef = useRef<Square | null>(null);

  const chess = useMemo(() => new Chess(fen), [fen]);
  const turn = chess.turn();
  const inCheck = chess.inCheck();

  // Locate king square if in check
  const checkedKingSquare = useMemo<Square | null>(() => {
    if (!inCheck) return null;
    const board = chess.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.type === 'k' && piece.color === turn) {
          return piece.square;
        }
      }
    }
    return null;
  }, [chess, inCheck, turn]);

  // Compute legal destinations for the selected or dragged piece
  const activeSource = draggingFrom ?? selectedSquare;
  const legalTargets = useMemo(() => {
    const map = new Map<Square, { isCapture: boolean; isPromotion: boolean }>();
    if (!activeSource || !interactive) return map;
    if (allowedTurn !== 'both' && turn !== allowedTurn) return map;

    const moves = chess.moves({ square: activeSource, verbose: true });
    for (const m of moves) {
      map.set(m.to, {
        isCapture: Boolean(m.captured) || m.flags.includes('e'),
        isPromotion: m.flags.includes('p'),
      });
    }
    return map;
  }, [activeSource, chess, interactive, allowedTurn, turn]);

  const orderedRanks = orientation === 'w' ? RANKS : [...RANKS].reverse();
  const orderedFiles = orientation === 'w' ? FILES : [...FILES].reverse();

  const canControlPiece = (pieceColor: Color) => {
    if (!interactive) return false;
    if (pieceColor !== turn) return false;
    if (allowedTurn !== 'both' && pieceColor !== allowedTurn) return false;
    return true;
  };

  const attemptMove = (from: Square, to: Square) => {
    const piece = chess.get(from);
    if (!piece) return false;

    const legal = chess.moves({ square: from, verbose: true }).filter((m) => m.to === to);
    if (legal.length === 0) return false;

    if (legal.some((m) => m.flags.includes('p'))) {
      setPendingPromotion({ from, to, color: piece.color });
      setSelectedSquare(null);
      setDraggingFrom(null);
      setDragPos(null);
      return true;
    }

    const ok = onMove(from, to);
    if (ok) {
      setSelectedSquare(null);
      setUserArrows([]);
      setMarkedSquares(new Set());
    }
    return ok;
  };

  const getSquareFromPointer = (clientX: number, clientY: number): Square | null => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const relX = clientX - rect.left;
    const relY = clientY - rect.top;
    if (relX < 0 || relY < 0 || relX >= rect.width || relY >= rect.height) return null;
    const col = Math.floor((relX / rect.width) * 8);
    const row = Math.floor((relY / rect.height) * 8);
    const file = orderedFiles[col];
    const rank = orderedRanks[row];
    return `${file}${rank}` as Square;
  };

  const handleSquareClick = (sq: Square) => {
    if (pendingPromotion) return;

    // Clear right-click highlights on normal left click
    if (userArrows.length > 0 || markedSquares.size > 0) {
      setUserArrows([]);
      setMarkedSquares(new Set());
    }

    if (selectedSquare && legalTargets.has(sq)) {
      attemptMove(selectedSquare, sq);
      return;
    }

    const piece = chess.get(sq);
    if (piece && canControlPiece(piece.color)) {
      setSelectedSquare((prev) => (prev === sq ? null : sq));
    } else {
      setSelectedSquare(null);
    }
  };

  const handlePointerDown = (e: React.PointerEvent, sq: Square) => {
    if (e.button === 2) {
      rightDragStartRef.current = sq;
      return;
    }
    if (e.button !== 0 || pendingPromotion) return;

    const piece = chess.get(sq);
    if (piece && canControlPiece(piece.color)) {
      const rect = boardRef.current?.getBoundingClientRect();
      if (rect) {
        setDraggingFrom(sq);
        setDragPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
    }
  };

  const handleBoardPointerMove = (e: React.PointerEvent) => {
    if (!draggingFrom) return;
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDragPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleBoardPointerUp = (e: React.PointerEvent) => {
    if (e.button === 2 && rightDragStartRef.current) {
      const startSq = rightDragStartRef.current;
      rightDragStartRef.current = null;
      const endSq = getSquareFromPointer(e.clientX, e.clientY);
      if (!endSq) return;

      if (startSq === endSq) {
        setMarkedSquares((prev) => {
          const next = new Set(prev);
          if (next.has(endSq)) next.delete(endSq);
          else next.add(endSq);
          return next;
        });
      } else {
        setUserArrows((prev) => {
          const exists = prev.some((a) => a.from === startSq && a.to === endSq);
          if (exists) {
            return prev.filter((a) => !(a.from === startSq && a.to === endSq));
          }
          return [...prev, { from: startSq, to: endSq, color: 'rgba(240, 152, 34, 0.86)', kind: 'user' }];
        });
      }
      return;
    }

    if (!draggingFrom) return;
    const fromSq = draggingFrom;
    const targetSq = getSquareFromPointer(e.clientX, e.clientY);
    setDraggingFrom(null);
    setDragPos(null);

    if (targetSq && targetSq !== fromSq) {
      const moved = attemptMove(fromSq, targetSq);
      if (!moved) {
        setSelectedSquare(fromSq);
      }
    }
  };

  const whiteBarPct = evalToBarPercent(evalScore);
  const evalText = formatEvalScore(evalScore, false, true);
  const whiteAhead = !evalScore || evalScore.value >= 0;
  const allArrows = [...engineArrows, ...userArrows];

  const draggedPiece = draggingFrom ? chess.get(draggingFrom) : null;

  return (
    <div className="flex items-stretch gap-2.5 w-full select-none">
      {/* Vertical Stockfish Evaluation Bar */}
      {showEvalBar && (
        <div
          className="relative w-7 sm:w-8 shrink-0 rounded-[4px] overflow-hidden bg-[#2D2C29] border border-white/[0.08] flex flex-col justify-between"
          data-testid="eval-bar"
          aria-label={`Stockfish evaluation ${evalText}`}
        >
          {/* White portion — grows from bottom when White is at bottom, or from top when flipped */}
          <div
            className="absolute inset-x-0 bg-[#ECEAE4] transition-[height] duration-300 ease-out"
            style={{
              height: `${whiteBarPct}%`,
              bottom: orientation === 'w' ? 0 : 'auto',
              top: orientation === 'b' ? 0 : 'auto',
            }}
          />

          {/* Center equality tick */}
          <div className="absolute inset-x-0 top-1/2 h-[1.5px] bg-[#81B64C]/70 z-10 pointer-events-none" />

          {/* Score readout pinned cleanly to the top or bottom depending on advantage */}
          <span
            className={`relative z-10 text-[10px] font-mono font-bold tabular-nums text-center pt-1.5 leading-none ${
              orientation === 'w' ? 'text-[#ECEAE4]' : 'text-[#1E1D1B]'
            }`}
          >
            {(!whiteAhead && orientation === 'w') || (whiteAhead && orientation === 'b') ? evalText : ''}
          </span>
          <span
            className={`relative z-10 text-[10px] font-mono font-bold tabular-nums text-center pb-1.5 leading-none ${
              orientation === 'w' ? 'text-[#1E1D1B]' : 'text-[#ECEAE4]'
            }`}
          >
            {(whiteAhead && orientation === 'w') || (!whiteAhead && orientation === 'b') ? evalText : ''}
          </span>
        </div>
      )}

      {/* Main 8x8 Chessboard Container */}
      <div
        ref={boardRef}
        data-testid="chess-board"
        className="relative aspect-square w-full rounded-[5px] overflow-hidden shadow-[0_14px_38px_rgba(0,0,0,0.48)] ring-1 ring-white/[0.08] touch-none"
        onContextMenu={(e) => e.preventDefault()}
        onPointerMove={handleBoardPointerMove}
        onPointerUp={handleBoardPointerUp}
        onPointerLeave={() => {
          if (draggingFrom) {
            setDraggingFrom(null);
            setDragPos(null);
          }
        }}
      >
        <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
          {orderedRanks.map((rank, rowIdx) =>
            orderedFiles.map((file, colIdx) => {
              const sq = `${file}${rank}` as Square;
              const isLight = (FILES.indexOf(file) + parseInt(rank, 10)) % 2 === 1;
              const piece = chess.get(sq);
              const isSelected = selectedSquare === sq || draggingFrom === sq;
              const isLastFrom = lastMove?.from === sq;
              const isLastTo = lastMove?.to === sq;
              const isMarked = markedSquares.has(sq);
              const targetMeta = legalTargets.get(sq);
              const isCheckedKing = checkedKingSquare === sq;

              let bg = isLight ? theme.light : theme.dark;
              if (isLastFrom || isLastTo) {
                bg = isLight ? theme.lastMoveLight : theme.lastMoveDark;
              }
              if (isSelected) {
                bg = isLight ? theme.selectedLight : theme.selectedDark;
              }

              const coordColor = isLight ? theme.coordLight : theme.coordDark;
              const classificationBadge =
                isLastTo && lastMove?.classification ? CLASSIFICATION_META[lastMove.classification] : null;

              const pieceLabel = piece
                ? `${piece.color === 'w' ? 'White' : 'Black'} ${PIECE_NAMES[piece.type]}`
                : 'empty';

              return (
                <button
                  key={sq}
                  type="button"
                  data-square={sq}
                  aria-label={`Square ${sq}, ${pieceLabel}`}
                  onClick={() => handleSquareClick(sq)}
                  onPointerDown={(e) => handlePointerDown(e, sq)}
                  className="relative w-full h-full p-0 border-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/80 flex items-center justify-center cursor-pointer"
                  style={{ backgroundColor: bg }}
                >
                  {/* Right-click tactical square highlight */}
                  {isMarked && (
                    <span
                      className="absolute inset-0 pointer-events-none"
                      style={{ backgroundColor: 'rgba(224, 79, 79, 0.52)' }}
                    />
                  )}

                  {/* King in check radial glow */}
                  {isCheckedKing && (
                    <span
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background:
                          'radial-gradient(circle at center, rgba(224,48,48,0.88) 0%, rgba(224,48,48,0.5) 55%, rgba(224,48,48,0) 80%)',
                      }}
                    />
                  )}

                  {/* Rank coordinate (left edge) */}
                  {showCoordinates && colIdx === 0 && (
                    <span
                      className="absolute top-[3px] left-[4px] text-[10px] sm:text-[11px] font-bold leading-none pointer-events-none font-mono"
                      style={{ color: coordColor }}
                    >
                      {rank}
                    </span>
                  )}

                  {/* File coordinate (bottom edge) */}
                  {showCoordinates && rowIdx === 7 && (
                    <span
                      className="absolute bottom-[3px] right-[4px] text-[10px] sm:text-[11px] font-bold leading-none pointer-events-none font-mono"
                      style={{ color: coordColor }}
                    >
                      {file}
                    </span>
                  )}

                  {/* Legal move dot or capture ring */}
                  {showLegalMoves && targetMeta && (
                    <span
                      className={
                        targetMeta.isCapture
                          ? 'absolute inset-[7%] rounded-full border-[5px] sm:border-[6px] border-black/22 pointer-events-none z-10'
                          : 'w-[30%] h-[30%] rounded-full bg-black/22 pointer-events-none z-10'
                      }
                    />
                  )}

                  {/* Chess Piece SVG */}
                  {piece && draggingFrom !== sq && (
                    <div
                      className={`w-[88%] h-[88%] relative z-10 pointer-events-none ${
                        isLastTo ? 'animate-piece-pop' : ''
                      }`}
                    >
                      <ChessPiece type={piece.type} color={piece.color} />
                    </div>
                  )}

                  {/* Chess.com-style classification badge on destination square */}
                  {classificationBadge && (
                    <span
                      className="absolute -top-0.5 -right-0.5 z-20 w-5 h-5 sm:w-5.5 sm:h-5.5 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] font-extrabold text-[#181817] shadow-md pointer-events-none"
                      style={{ backgroundColor: classificationBadge.color }}
                      title={classificationBadge.label}
                    >
                      {classificationBadge.symbol}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* SVG Arrow Overlay (Stockfish Best Move + Threat + User Right-Click Arrows) */}
        {allArrows.length > 0 && (
          <svg
            viewBox="0 0 800 800"
            className="absolute inset-0 w-full h-full pointer-events-none z-20"
            aria-hidden="true"
          >
            {allArrows.map((arrow, idx) => {
              const start = squareToBoardCoords(arrow.from, orientation);
              const end = squareToBoardCoords(arrow.to, orientation);
              const dx = end.x - start.x;
              const dy = end.y - start.y;
              const len = Math.hypot(dx, dy);
              if (len < 1) return null;

              const ux = dx / len;
              const uy = dy / len;
              // Shorten shaft slightly so arrowhead lands cleanly at target center
              const headLen = 30;
              const headWidth = 22;
              const shaftStartOffset = 18;
              const sx = start.x + ux * shaftStartOffset;
              const sy = start.y + uy * shaftStartOffset;
              const ex = end.x - ux * headLen;
              const ey = end.y - uy * headLen;

              // Perpendicular unit vector
              const px = -uy;
              const py = ux;

              const tipX = end.x;
              const tipY = end.y;
              const leftX = ex + px * headWidth;
              const leftY = ey + py * headWidth;
              const rightX = ex - px * headWidth;
              const rightY = ey - py * headWidth;

              return (
                <g key={`${arrow.from}-${arrow.to}-${idx}`} opacity={0.9}>
                  <line
                    x1={sx}
                    y1={sy}
                    x2={ex}
                    y2={ey}
                    stroke={arrow.color}
                    strokeWidth="15"
                    strokeLinecap="round"
                  />
                  <polygon points={`${tipX},${tipY} ${leftX},${leftY} ${rightX},${rightY}`} fill={arrow.color} />
                </g>
              );
            })}
          </svg>
        )}

        {/* Dragged Piece Ghost */}
        {draggedPiece && dragPos && (
          <div
            className="absolute pointer-events-none z-30 w-[13%] h-[13%] -translate-x-1/2 -translate-y-1/2"
            style={{ left: dragPos.x, top: dragPos.y }}
          >
            <ChessPiece type={draggedPiece.type} color={draggedPiece.color} />
          </div>
        )}

        {/* Pawn Promotion Dialog */}
        {pendingPromotion && (
          <div className="absolute inset-0 z-40 bg-black/55 flex items-center justify-center p-4">
            <div
              role="dialog"
              aria-label="Choose promotion piece"
              className="bg-[#242321] border border-white/15 rounded-xl p-4 shadow-2xl flex flex-col items-center gap-3"
            >
              <span className="text-sm font-semibold text-[#F1EFEA]">Promote Pawn</span>
              <div className="flex items-center gap-2">
                {(['q', 'r', 'b', 'n'] as PieceSymbol[]).map((promo) => (
                  <button
                    key={promo}
                    type="button"
                    aria-label={`Promote to ${PIECE_NAMES[promo]}`}
                    onClick={() => {
                      onMove(pendingPromotion.from, pendingPromotion.to, promo);
                      setPendingPromotion(null);
                    }}
                    className="w-14 h-14 rounded-lg bg-[#312F2C] hover:bg-[#81B64C]/25 border border-white/10 hover:border-[#81B64C] p-1.5 transition-colors cursor-pointer"
                  >
                    <ChessPiece type={promo} color={pendingPromotion.color} />
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setPendingPromotion(null)}
                className="text-xs text-[#A5A29B] hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

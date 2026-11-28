import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { Color, PieceSymbol, Square } from 'chess.js';
import {
  BOARD_THEMES,
  type BoardArrow,
  type BoardThemeId,
  type EvalScore,
  type MoveClassification,
} from '../types/chess';
import type { PieceStyleId } from '../types/preferences';
import { getChess960LegalTargets, type Chess960CastlingRights } from '../game/chess960';
import { stripCastlingRights } from '../game/chessLogic';
import { ChessPiece } from './ChessPieces';
import { EvalBar } from './EvalBar';
import { MoveBadge } from './MoveBadge';
import { useI18n } from '../i18n/LanguageContext';

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
  pieceStyle?: PieceStyleId;
  interactive: boolean;
  allowedTurn?: Color | 'both';
  lastMove?: { from: Square; to: Square; classification?: MoveClassification } | null;
  engineArrows: BoardArrow[];
  showCoordinates: boolean;
  showLegalMoves: boolean;
  showEvalBar: boolean;
  evalScore: EvalScore | null;
  evalDepth?: number;
  evalStabilizing?: boolean;
  allowCastling?: boolean;
  chess960Rights?: Chess960CastlingRights | null;
  onMove: (from: Square, to: Square, promotion?: PieceSymbol) => boolean;
}

function squareToBoardCoords(sq: Square, orientation: Color): { x: number; y: number } {
  const fileIdx = FILES.indexOf(sq[0] as (typeof FILES)[number]);
  const rankNum = parseInt(sq[1], 10); // 1..8
  const col = orientation === 'w' ? fileIdx : 7 - fileIdx;
  const row = orientation === 'w' ? 8 - rankNum : rankNum - 1;
  return { x: col * 100 + 50, y: row * 100 + 50 };
}

export const ChessBoard: React.FC<ChessBoardProps> = React.memo(({
  fen,
  orientation,
  themeId,
  pieceStyle = 'classic',
  interactive,
  allowedTurn = 'both',
  lastMove,
  engineArrows,
  showCoordinates,
  showLegalMoves,
  showEvalBar,
  evalScore,
  evalDepth = 0,
  evalStabilizing = false,
  allowCastling = true,
  chess960Rights = null,
  onMove,
}) => {
  const { t } = useI18n();
  const theme = BOARD_THEMES[themeId] ?? BOARD_THEMES.tournament;
  const boardRef = useRef<HTMLDivElement>(null);

  const fenPlacement = useMemo(() => fen.split(' ')[0], [fen]);

  // Compute percentage delta so the moved piece glides smoothly from its origin square
  const slideDelta = useMemo(() => {
    if (!lastMove) return null;
    const fromFile = FILES.indexOf(lastMove.from[0] as (typeof FILES)[number]);
    const fromRank = parseInt(lastMove.from[1], 10);
    const toFile = FILES.indexOf(lastMove.to[0] as (typeof FILES)[number]);
    const toRank = parseInt(lastMove.to[1], 10);
    if (fromFile < 0 || toFile < 0 || Number.isNaN(fromRank) || Number.isNaN(toRank)) return null;

    const fromCol = orientation === 'w' ? fromFile : 7 - fromFile;
    const toCol = orientation === 'w' ? toFile : 7 - toFile;
    const fromRow = orientation === 'w' ? 8 - fromRank : fromRank - 1;
    const toRow = orientation === 'w' ? 8 - toRank : toRank - 1;

    // Account for piece container being 88% of square width/height
    const scaleFactor = 100 / 88;
    return {
      x: `${(fromCol - toCol) * 100 * scaleFactor}%`,
      y: `${(fromRow - toRow) * 100 * scaleFactor}%`,
      key: `${lastMove.from}-${lastMove.to}-${fenPlacement}`,
    };
  }, [lastMove, orientation, fenPlacement]);

  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [draggingFrom, setDraggingFrom] = useState<Square | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square; color: Color } | null>(null);

  // Refs for zero-rerender, GPU-composited piece dragging
  const dragGhostRef = useRef<HTMLDivElement>(null);
  const boardRectRef = useRef<DOMRect | null>(null);
  const dragCoordsRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // User right-click annotations (like Chess.com!)
  const [userArrows, setUserArrows] = useState<BoardArrow[]>([]);
  const [markedSquares, setMarkedSquares] = useState<Set<Square>>(new Set());
  const rightDragStartRef = useRef<Square | null>(null);
  const suppressNextClickRef = useRef(false);

  const effectiveFen = useMemo(
    () => (allowCastling ? fen : stripCastlingRights(fen, 'both')),
    [fen, allowCastling]
  );

  // Reset transient selection, drag, promotion, and annotation state whenever the board position changes
  useEffect(() => {
    setSelectedSquare(null);
    setDraggingFrom(null);
    boardRectRef.current = null;
    setPendingPromotion(null);
    setUserArrows([]);
    setMarkedSquares(new Set());
    rightDragStartRef.current = null;
    suppressNextClickRef.current = false;
  }, [effectiveFen]);

  // Clear active drag, selection, or promotion modal if the board becomes non-interactive (pause/timeout/gameover)
  useEffect(() => {
    if (!interactive) {
      setSelectedSquare(null);
      setDraggingFrom(null);
      boardRectRef.current = null;
      setPendingPromotion(null);
    }
  }, [interactive]);

  const chess = useMemo(() => {
    try {
      return new Chess(effectiveFen);
    } catch {
      return new Chess();
    }
  }, [effectiveFen]);
  const turn = chess.turn();
  const inCheck = chess.inCheck();

  // Single-pass piece lookup table per position (avoids 64x chess.get() calls per render)
  const boardPieceMap = useMemo(() => {
    const map = new Map<Square, { type: PieceSymbol; color: Color }>();
    const board = chess.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece) {
          map.set(piece.square, { type: piece.type, color: piece.color });
        }
      }
    }
    return map;
  }, [chess]);

  // Locate king square if in check
  const checkedKingSquare = useMemo<Square | null>(() => {
    if (!inCheck) return null;
    for (const [sq, piece] of boardPieceMap) {
      if (piece.type === 'k' && piece.color === turn) {
        return sq;
      }
    }
    return null;
  }, [boardPieceMap, inCheck, turn]);

  // Compute legal destinations for the selected or dragged piece
  const activeSource = draggingFrom ?? selectedSquare;
  const legalTargets = useMemo(() => {
    const map = new Map<Square, { isCapture: boolean; isPromotion: boolean; isCastle?: boolean }>();
    if (!activeSource || !interactive) return map;
    if (allowedTurn !== 'both' && turn !== allowedTurn) return map;

    if (chess960Rights) {
      const targets960 = getChess960LegalTargets(effectiveFen, chess960Rights, activeSource);
      targets960.forEach((meta, targetSq) => {
        map.set(targetSq, {
          isCapture: meta.isCapture,
          isPromotion: meta.isPromotion,
          isCastle: meta.isCastle,
        });
      });
      return map;
    }

    const moves = chess.moves({ square: activeSource, verbose: true });
    for (const m of moves) {
      map.set(m.to, {
        isCapture: Boolean(m.captured) || m.flags.includes('e'),
        isPromotion: m.flags.includes('p'),
      });
    }
    return map;
  }, [activeSource, chess, effectiveFen, chess960Rights, interactive, allowedTurn, turn]);

  const orderedRanks = useMemo(() => (orientation === 'w' ? RANKS : [...RANKS].reverse()), [orientation]);
  const orderedFiles = useMemo(() => (orientation === 'w' ? FILES : [...FILES].reverse()), [orientation]);

  const canControlPiece = (pieceColor: Color) => {
    if (!interactive) return false;
    if (pieceColor !== turn) return false;
    if (allowedTurn !== 'both' && pieceColor !== allowedTurn) return false;
    return true;
  };

  const attemptMove = (from: Square, to: Square) => {
    const piece = chess.get(from);
    if (!piece) return false;

    let isPromotion = false;
    if (chess960Rights) {
      const targets960 = getChess960LegalTargets(effectiveFen, chess960Rights, from);
      const targetMeta = targets960.get(to);
      if (!targetMeta) return false;
      isPromotion = targetMeta.isPromotion;
    } else {
      const legal = chess.moves({ square: from, verbose: true }).filter((m) => m.to === to);
      if (legal.length === 0) return false;
      isPromotion = legal.some((m) => m.flags.includes('p'));
    }

    if (isPromotion) {
      setPendingPromotion({ from, to, color: piece.color });
      setSelectedSquare(null);
      setDraggingFrom(null);
      boardRectRef.current = null;
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

  const getSquareFromPointer = (clientX: number, clientY: number, cachedRect?: DOMRect | null): Square | null => {
    const rect = cachedRect ?? boardRef.current?.getBoundingClientRect();
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
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
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

    // When the King is already selected and the user clicks their own Rook to castle in Chess960,
    // let handleSquareClick execute castling without initiating a rook drag.
    if (selectedSquare && legalTargets.get(sq)?.isCastle) {
      return;
    }

    const piece = boardPieceMap.get(sq);
    if (piece && canControlPiece(piece.color)) {
      const rect = boardRef.current?.getBoundingClientRect();
      if (rect) {
        boardRectRef.current = rect;
        dragCoordsRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        setDraggingFrom(sq);
      }
    }
  };

  const handleBoardPointerMove = (e: React.PointerEvent) => {
    if (!draggingFrom) return;
    const rect = boardRectRef.current ?? boardRef.current?.getBoundingClientRect() ?? null;
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    dragCoordsRef.current = { x, y };
    if (dragGhostRef.current) {
      dragGhostRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    }
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
    const targetSq = getSquareFromPointer(e.clientX, e.clientY, boardRectRef.current);
    boardRectRef.current = null;
    setDraggingFrom(null);

    if (targetSq && targetSq !== fromSq) {
      const moved = attemptMove(fromSq, targetSq);
      if (!moved) {
        setSelectedSquare(fromSq);
        suppressNextClickRef.current = true;
      }
    }
  };

  const allArrows = useMemo(() => [...engineArrows, ...userArrows], [engineArrows, userArrows]);

  const draggedPiece = draggingFrom ? boardPieceMap.get(draggingFrom) ?? null : null;

  return (
    <div className="flex items-stretch gap-2.5 w-full select-none">
      {/* Upgraded & Stabilized Vertical Stockfish Evaluation Bar */}
      {showEvalBar && (
        <EvalBar
          score={evalScore}
          orientation={orientation}
          depth={evalDepth}
          isStabilizing={evalStabilizing}
        />
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
          rightDragStartRef.current = null;
          boardRectRef.current = null;
          if (draggingFrom) {
            setDraggingFrom(null);
          }
        }}
        onPointerCancel={() => {
          rightDragStartRef.current = null;
          boardRectRef.current = null;
          if (draggingFrom) {
            setDraggingFrom(null);
          }
        }}
      >
        <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
          {orderedRanks.map((rank, rowIdx) =>
            orderedFiles.map((file, colIdx) => {
              const sq = `${file}${rank}` as Square;
              const isLight = (FILES.indexOf(file) + parseInt(rank, 10)) % 2 === 1;
              const piece = boardPieceMap.get(sq);
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
              const moveClassification = isLastTo && lastMove?.classification ? lastMove.classification : null;

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
                      className="absolute inset-0 pointer-events-none anim-check-pulse"
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

                  {/* Legal move dot, capture ring, or Chess960 castling ring */}
                  {showLegalMoves && targetMeta && (
                    <span
                      data-castle-target={targetMeta.isCastle ? 'true' : undefined}
                      className={
                        targetMeta.isCastle && piece
                          ? 'absolute inset-[7%] rounded-full border-[5px] sm:border-[6px] border-[#81B64C]/85 pointer-events-none z-20 anim-dot-pop'
                          : targetMeta.isCapture
                            ? 'absolute inset-[7%] rounded-full border-[5px] sm:border-[6px] border-black/22 pointer-events-none z-10 anim-dot-pop'
                            : 'w-[30%] h-[30%] rounded-full bg-black/22 pointer-events-none z-10 anim-dot-pop'
                      }
                    />
                  )}

                  {/* Chess Piece SVG with smooth square-to-square glide on last move */}
                  {piece && draggingFrom !== sq && (
                    <div
                      key={isLastTo && slideDelta ? slideDelta.key : `${sq}-${piece.color}-${piece.type}`}
                      className={`w-[88%] h-[88%] relative z-10 pointer-events-none ${
                        isLastTo && slideDelta ? 'anim-piece-slide' : ''
                      }`}
                      style={
                        isLastTo && slideDelta
                          ? ({
                              '--slide-x': slideDelta.x,
                              '--slide-y': slideDelta.y,
                            } as React.CSSProperties)
                          : undefined
                      }
                    >
                      <ChessPiece type={piece.type} color={piece.color} pieceStyle={pieceStyle} />
                    </div>
                  )}

                  {/* Chess.com-style move evaluation badge on destination square */}
                  {moveClassification && (
                    <MoveBadge
                      key={`badge-${sq}-${moveClassification}-${fenPlacement}`}
                      classification={moveClassification}
                      variant="board"
                      className="absolute -top-0.5 -right-0.5 z-20 pointer-events-none anim-badge-pop"
                    />
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

        {/* Dragged Piece Ghost (GPU-composited direct transform for 0 React re-renders during drag) */}
        {draggedPiece && (
          <div
            ref={dragGhostRef}
            className="absolute top-0 left-0 pointer-events-none z-30 w-[13%] h-[13%] will-change-transform"
            style={{
              transform: `translate3d(${dragCoordsRef.current.x}px, ${dragCoordsRef.current.y}px, 0) translate(-50%, -50%)`,
            }}
          >
            <ChessPiece type={draggedPiece.type} color={draggedPiece.color} pieceStyle={pieceStyle} />
          </div>
        )}

        {/* Pawn Promotion Dialog */}
        {pendingPromotion && (
          <div className="absolute inset-0 z-40 bg-black/55 flex items-center justify-center p-4 anim-backdrop-enter">
            <div
              role="dialog"
              aria-label={t('promotePawn')}
              className="bg-[var(--app-surface)] border border-[var(--app-border-strong)] rounded-xl p-4 shadow-2xl flex flex-col items-center gap-3 anim-modal-enter"
            >
              <span className="text-sm font-semibold text-[var(--app-text)]">{t('promotePawn')}</span>
              <div className="flex items-center gap-2">
                {(['q', 'r', 'b', 'n'] as PieceSymbol[]).map((promo) => (
                  <button
                    key={promo}
                    type="button"
                    aria-label={`${t('promotePawn')} ${PIECE_NAMES[promo]}`}
                    onClick={() => {
                      onMove(pendingPromotion.from, pendingPromotion.to, promo);
                      setPendingPromotion(null);
                    }}
                    className="w-14 h-14 rounded-lg bg-[var(--app-surface-2)] hover:bg-[var(--app-accent-soft)] border border-[var(--app-border)] hover:border-[var(--app-accent)] p-1.5 anim-interactive cursor-pointer"
                  >
                    <ChessPiece type={promo} color={pendingPromotion.color} pieceStyle={pieceStyle} />
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setPendingPromotion(null)}
                className="text-xs text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors cursor-pointer"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

ChessBoard.displayName = 'ChessBoard';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { Color, PieceSymbol, Square } from 'chess.js';
import { ArrowUpDown, Pause, Plus, Volume2, VolumeX } from 'lucide-react';
import {
  STOCKFISH_LEVELS,
  TIME_CONTROLS,
  type AppState,
  type BoardArrow,
  type BoardThemeId,
  type ClassicStudy,
  type EngineAnalysis,
  type EvalScore,
  type GameMode,
  type MatchSettings,
  type MoveRecord,
} from './types/chess';
import { StockfishAnalyzer, StockfishOpponent } from './engine/stockfishService';
import { calculateAverageAccuracy, classifyMove } from './engine/uciParser';
import { buildPgn, evaluateGameTermination, getMaterialSummary, parsePgnOrFen } from './game/chessLogic';
import { detectOpening } from './game/openings';
import { playChessSound } from './utils/sound';
import { ChessBoard } from './components/ChessBoard';
import { PlayerBar } from './components/PlayerBar';
import { RightPanel, type RightPanelTab } from './components/RightPanel';
import { TitleScreen } from './components/TitleScreen';
import { GameOverModal, NewMatchModal, PauseModal } from './components/GameModals';

const INITIAL_FEN = new Chess().fen();

function resolvePlayerColor(choice: MatchSettings['playerSide']): Color {
  if (choice === 'w' || choice === 'b') return choice;
  return Math.random() < 0.5 ? 'w' : 'b';
}

function getAutostartFlag(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('autostart') === '1';
}

export default function App() {
  const [matchSettings, setMatchSettings] = useState<MatchSettings>({
    mode: 'stockfish',
    playerSide: 'w',
    stockfishLevelId: 'club',
    timeControlId: '10+0',
  });

  const [appState, setAppState] = useState<AppState>(() => (getAutostartFlag() ? 'playing' : 'title'));
  const [gameOverDismissed, setGameOverDismissed] = useState(false);
  const [showNewMatchModal, setShowNewMatchModal] = useState(false);

  // Active match runtime state
  const [initialFen, setInitialFen] = useState<string>(INITIAL_FEN);
  const [moves, setMoves] = useState<MoveRecord[]>([]);
  const [viewPly, setViewPly] = useState<number>(0);
  const [humanColor, setHumanColor] = useState<Color>('w');
  const [orientation, setOrientation] = useState<Color>('w');
  const [activeMode, setActiveMode] = useState<GameMode>('stockfish');
  const [positionLabel, setPositionLabel] = useState<string | null>(null);

  // Termination flags
  const [resignedBy, setResignedBy] = useState<Color | null>(null);
  const [timeoutLoser, setTimeoutLoser] = useState<Color | null>(null);
  const [agreedDraw, setAgreedDraw] = useState<boolean>(false);

  // Clocks (in seconds; null if unlimited or analysis mode)
  const [whiteClock, setWhiteClock] = useState<number | null>(600);
  const [blackClock, setBlackClock] = useState<number | null>(600);
  const [incrementSec, setIncrementSec] = useState<number>(0);

  // UI & Board Preferences
  const [rightTab, setRightTab] = useState<RightPanelTab>('moves');
  const [boardTheme, setBoardTheme] = useState<BoardThemeId>('tournament');
  const [showCoordinates, setShowCoordinates] = useState(true);
  const [showLegalMoves, setShowLegalMoves] = useState(true);
  const [showEvalBar, setShowEvalBar] = useState(true);
  const [showBestArrow, setShowBestArrow] = useState(false);
  const [hintArrow, setHintArrow] = useState<BoardArrow | null>(null);
  const [muted, setMuted] = useState(false);

  // Stockfish Engine State
  const [engineEnabled, setEngineEnabled] = useState(true);
  const [multiPv, setMultiPv] = useState(3);
  const [analysisDepth, setAnalysisDepth] = useState(16);
  const [engineAnalysis, setEngineAnalysis] = useState<EngineAnalysis | null>(null);
  const [isBotThinking, setIsBotThinking] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewProgress, setReviewProgress] = useState(0);

  // Dedicated Stockfish Web Workers
  const analyzerRef = useRef<StockfishAnalyzer | null>(null);
  const opponentRef = useRef<StockfishOpponent | null>(null);
  const latestAnalysisRef = useRef<EngineAnalysis | null>(null);

  useEffect(() => {
    latestAnalysisRef.current = engineAnalysis;
  }, [engineAnalysis]);

  // Keep body data-state synchronized with the game state machine
  useEffect(() => {
    document.body.dataset.state = appState;
  }, [appState]);

  // Initialize workers lazily when leaving title screen and clean up on unmount
  useEffect(() => {
    return () => {
      analyzerRef.current?.terminate();
      opponentRef.current?.terminate();
    };
  }, []);

  const ensureAnalyzer = useCallback(() => {
    if (!analyzerRef.current) {
      analyzerRef.current = new StockfishAnalyzer();
    }
    return analyzerRef.current;
  }, []);

  const ensureOpponent = useCallback(() => {
    if (!opponentRef.current) {
      opponentRef.current = new StockfishOpponent();
    }
    return opponentRef.current;
  }, []);

  const activeLevel = useMemo(
    () => STOCKFISH_LEVELS.find((l) => l.id === matchSettings.stockfishLevelId) ?? STOCKFISH_LEVELS[2],
    [matchSettings.stockfishLevelId]
  );

  // Derived board positions
  const latestFen = moves.length > 0 ? moves[moves.length - 1].fenAfter : initialFen;
  const viewedFen = viewPly === 0 ? initialFen : moves[viewPly - 1]?.fenAfter ?? latestFen;
  const isViewingLatest = viewPly === moves.length;

  const viewedChess = useMemo(() => new Chess(viewedFen), [viewedFen]);
  const latestChess = useMemo(() => new Chess(latestFen), [latestFen]);

  const termination = useMemo(
    () =>
      evaluateGameTermination({
        fen: latestFen,
        timeoutLoser,
        resignedBy,
        agreedDraw,
      }),
    [latestFen, timeoutLoser, resignedBy, agreedDraw]
  );

  const opening = useMemo(() => {
    const sanList = moves.slice(0, viewPly).map((m) => m.san);
    return detectOpening(sanList);
  }, [moves, viewPly]);

  const material = useMemo(() => getMaterialSummary(viewedFen), [viewedFen]);

  const whiteAccuracy = useMemo(
    () =>
      calculateAverageAccuracy(
        moves.filter((m) => m.color === 'w' && typeof m.accuracy === 'number').map((m) => m.accuracy!)
      ),
    [moves]
  );

  const blackAccuracy = useMemo(
    () =>
      calculateAverageAccuracy(
        moves.filter((m) => m.color === 'b' && typeof m.accuracy === 'number').map((m) => m.accuracy!)
      ),
    [moves]
  );

  // Start / Restart a match
  const startMatch = useCallback(
    (customSettings?: MatchSettings) => {
      const cfg = customSettings ?? matchSettings;
      const tc = TIME_CONTROLS.find((t) => t.id === cfg.timeControlId) ?? TIME_CONTROLS[4];
      const chosenSide = cfg.mode === 'stockfish' ? resolvePlayerColor(cfg.playerSide) : 'w';

      opponentRef.current?.cancel();
      analyzerRef.current?.stop();

      setActiveMode(cfg.mode);
      setHumanColor(chosenSide);
      setOrientation(chosenSide);
      setInitialFen(INITIAL_FEN);
      setPositionLabel(null);
      setMoves([]);
      setViewPly(0);
      setResignedBy(null);
      setTimeoutLoser(null);
      setAgreedDraw(false);
      setGameOverDismissed(false);
      setHintArrow(null);
      setIsBotThinking(false);
      setIsReviewing(false);
      setReviewProgress(0);
      setEngineAnalysis(null);
      setShowNewMatchModal(false);

      if (cfg.mode === 'analysis' || tc.initialSeconds === 0) {
        setWhiteClock(null);
        setBlackClock(null);
        setIncrementSec(0);
      } else {
        setWhiteClock(tc.initialSeconds);
        setBlackClock(tc.initialSeconds);
        setIncrementSec(tc.incrementSeconds);
      }

      // Default Best Move arrow ON in Analysis mode, OFF during competitive games
      setShowBestArrow(cfg.mode === 'analysis');
      setRightTab(cfg.mode === 'analysis' ? 'engine' : 'moves');
      setAppState('playing');

      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    },
    [matchSettings]
  );

  // Core move application function (used by human, Stockfish opponent, and clicking engine lines)
  const applyMove = useCallback(
    (from: Square, to: Square, promotion?: PieceSymbol): boolean => {
      if (appState !== 'playing' && activeMode !== 'analysis') return false;
      if (termination.isOver && activeMode !== 'analysis') return false;

      // If user makes a move while viewing an earlier ply in analysis mode, branch cleanly from that ply
      const baseMoves = isViewingLatest ? moves : moves.slice(0, viewPly);
      const baseFen = baseMoves.length > 0 ? baseMoves[baseMoves.length - 1].fenAfter : initialFen;

      const game = new Chess(baseFen);
      let played;
      try {
        played = game.move({ from, to, promotion: promotion ?? 'q' });
      } catch {
        playChessSound('illegal', muted);
        return false;
      }
      if (!played) {
        playChessSound('illegal', muted);
        return false;
      }

      const fenAfter = game.fen();
      const moveNum = parseInt(baseFen.split(' ')[5] || '1', 10) || Math.floor(baseMoves.length / 2) + 1;

      // Capture Stockfish pre-move bestMove for instant classification if available
      const prevAnalysis = latestAnalysisRef.current;
      const bestBefore = prevAnalysis && prevAnalysis.fen === baseFen ? prevAnalysis.bestMoveUci ?? undefined : undefined;
      const evalBefore = prevAnalysis && prevAnalysis.fen === baseFen ? prevAnalysis.lines[0]?.score : undefined;

      const newRecord: MoveRecord = {
        ply: baseMoves.length + 1,
        moveNumber: moveNum,
        color: played.color,
        san: played.san,
        uci: `${played.from}${played.to}${played.promotion ?? ''}`,
        from: played.from,
        to: played.to,
        piece: played.piece,
        captured: played.captured,
        promotion: played.promotion,
        fenBefore: baseFen,
        fenAfter,
        bestMoveBefore: bestBefore,
        // Store pre-move eval tentatively on previous move if missing
      };

      const nextMoves = [...baseMoves, newRecord];
      if (evalBefore && nextMoves.length >= 2 && !nextMoves[nextMoves.length - 2].evalAfter) {
        nextMoves[nextMoves.length - 2] = {
          ...nextMoves[nextMoves.length - 2],
          evalAfter: evalBefore,
        };
      }

      setMoves(nextMoves);
      setViewPly(nextMoves.length);
      setHintArrow(null);

      // Add clock increment to the player who just moved
      if (incrementSec > 0 && activeMode !== 'analysis') {
        if (played.color === 'w') {
          setWhiteClock((c) => (c !== null ? c + incrementSec : null));
        } else {
          setBlackClock((c) => (c !== null ? c + incrementSec : null));
        }
      }

      // Play weight-matched procedural chess sound
      if (game.isCheckmate() || game.isDraw()) {
        playChessSound('gameover', muted);
      } else if (game.inCheck()) {
        playChessSound('check', muted);
      } else if (played.flags.includes('p')) {
        playChessSound('promote', muted);
      } else if (played.flags.includes('k') || played.flags.includes('q')) {
        playChessSound('castle', muted);
      } else if (played.captured || played.flags.includes('e')) {
        playChessSound('capture', muted);
      } else {
        playChessSound('move', muted);
      }

      return true;
    },
    [appState, activeMode, termination.isOver, isViewingLatest, moves, viewPly, initialFen, incrementSec, muted]
  );

  // Trigger game-over state cleanly when board reaches checkmate/draw/resign/timeout
  useEffect(() => {
    if (appState === 'playing' && termination.isOver && activeMode !== 'analysis') {
      setAppState('gameover');
      setGameOverDismissed(false);
      opponentRef.current?.cancel();
      setIsBotThinking(false);
    }
  }, [appState, termination.isOver, activeMode]);

  // Real-time Stockfish Analysis Worker trigger whenever viewedFen changes
  useEffect(() => {
    if (appState === 'title' || !engineEnabled || isReviewing) {
      analyzerRef.current?.stop();
      return;
    }

    let cancelled = false;
    const analyzer = ensureAnalyzer();

    // If the viewed position is already checkmate/stalemate, don't ask Stockfish to search
    if (viewedChess.isGameOver()) {
      const mateScore: EvalScore = viewedChess.isCheckmate()
        ? { type: 'mate', value: viewedChess.turn() === 'w' ? -0 : 0 }
        : { type: 'cp', value: 0 };
      setEngineAnalysis({
        fen: viewedFen,
        depth: 0,
        nodes: 0,
        nps: 0,
        bestMoveUci: null,
        ponderUci: null,
        lines: viewedChess.isCheckmate()
          ? [
              {
                multipv: 1,
                depth: 0,
                seldepth: 0,
                score: { type: 'mate', value: viewedChess.turn() === 'w' ? -1 : 1 },
                nodes: 0,
                nps: 0,
                pvUci: [],
                pvSan: [],
              },
            ]
          : [
              {
                multipv: 1,
                depth: 0,
                seldepth: 0,
                score: mateScore,
                nodes: 0,
                nps: 0,
                pvUci: [],
                pvSan: [],
              },
            ],
        isSearching: false,
      });
      return;
    }

    analyzer
      .analyzePosition(viewedFen, { depth: analysisDepth, multiPv }, (snapshot) => {
        if (cancelled) return;
        setEngineAnalysis(snapshot);

        // Once Stockfish reaches depth >= 10 on the latest move, update that move's evalAfter & classification
        if (snapshot.depth >= 10 && snapshot.lines[0]?.score) {
          const score = snapshot.lines[0].score;
          setMoves((prev) => {
            const idx = prev.findIndex((m) => m.fenAfter === snapshot.fen);
            if (idx === -1) return prev;
            const target = prev[idx];
            // Only update if score changed or classification missing
            const prevEval: EvalScore = idx > 0 && prev[idx - 1].evalAfter ? prev[idx - 1].evalAfter! : { type: 'cp', value: 20 };
            const isBook = idx < 6 && Boolean(detectOpening(prev.slice(0, idx + 1).map((x) => x.san)));
            const classified = classifyMove({
              evalBefore: prevEval,
              evalAfter: score,
              mover: target.color,
              playedUci: target.uci,
              bestUci: target.bestMoveBefore,
              isBook,
            });
            const updated = [...prev];
            updated[idx] = {
              ...target,
              evalAfter: score,
              classification: classified.classification,
              accuracy: classified.accuracy,
            };
            return updated;
          });
        }
      })
      .catch(() => {
        // Ignore worker init errors on rapid unmount
      });

    return () => {
      cancelled = true;
    };
  }, [appState, engineEnabled, isReviewing, viewedFen, viewedChess, analysisDepth, multiPv, ensureAnalyzer]);

  // Stockfish Opponent Bot Turn Execution
  useEffect(() => {
    if (appState !== 'playing') return;
    if (activeMode !== 'stockfish') return;
    if (termination.isOver) return;
    if (!isViewingLatest) return;

    const botColor: Color = humanColor === 'w' ? 'b' : 'w';
    if (latestChess.turn() !== botColor) return;

    let cancelled = false;
    setIsBotThinking(true);
    const opponent = ensureOpponent();
    const startedAt = performance.now();

    opponent
      .computeMove(latestFen, activeLevel)
      .then((uciMove) => {
        if (cancelled || !uciMove || uciMove.length < 4) return;
        const elapsed = performance.now() - startedAt;
        const minDelay = Math.max(0, 340 - elapsed);

        window.setTimeout(() => {
          if (cancelled) return;
          setIsBotThinking(false);
          const from = uciMove.slice(0, 2) as Square;
          const to = uciMove.slice(2, 4) as Square;
          const promo = uciMove.length === 5 ? (uciMove[4] as PieceSymbol) : undefined;
          applyMove(from, to, promo);
        }, minDelay);
      })
      .catch(() => {
        if (!cancelled) setIsBotThinking(false);
      });

    return () => {
      cancelled = true;
      opponent.cancel();
      setIsBotThinking(false);
    };
  }, [
    appState,
    activeMode,
    termination.isOver,
    isViewingLatest,
    humanColor,
    latestChess,
    latestFen,
    activeLevel,
    ensureOpponent,
    applyMove,
  ]);

  // Active Match Clocks Ticker (100ms precision)
  useEffect(() => {
    if (appState !== 'playing') return;
    if (activeMode === 'analysis') return;
    if (termination.isOver) return;
    if (whiteClock === null || blackClock === null) return;
    // Start ticking once at least one move has been played (standard Chess.com rule)
    if (moves.length === 0) return;

    const activeTurn = latestChess.turn();
    const timer = window.setInterval(() => {
      if (activeTurn === 'w') {
        setWhiteClock((prev) => {
          if (prev === null) return null;
          const next = Math.max(0, prev - 0.1);
          if (next <= 0) {
            setTimeoutLoser('w');
            playChessSound('gameover', muted);
          }
          return next;
        });
      } else {
        setBlackClock((prev) => {
          if (prev === null) return null;
          const next = Math.max(0, prev - 0.1);
          if (next <= 0) {
            setTimeoutLoser('b');
            playChessSound('gameover', muted);
          }
          return next;
        });
      }
    }, 100);

    return () => window.clearInterval(timer);
  }, [appState, activeMode, termination.isOver, whiteClock === null, blackClock === null, moves.length, latestChess, muted]);

  // Full Game Review using real Stockfish Worker across all plies
  const handleRunGameReview = useCallback(async () => {
    if (moves.length === 0 || isReviewing) return;
    setIsReviewing(true);
    setReviewProgress(0);
    setRightTab('engine');

    const analyzer = ensureAnalyzer();
    const snapshotMoves = [...moves];
    const reviewed: MoveRecord[] = [...snapshotMoves];

    try {
      // Evaluate starting position first
      let prevResult = await analyzer.evaluateOnce(initialFen, 10);

      for (let i = 0; i < reviewed.length; i++) {
        const m = reviewed[i];
        const afterResult = await analyzer.evaluateOnce(m.fenAfter, 10);
        const isBook = i < 6 && Boolean(detectOpening(reviewed.slice(0, i + 1).map((x) => x.san)));

        const classified = classifyMove({
          evalBefore: prevResult.score,
          evalAfter: afterResult.score,
          mover: m.color,
          playedUci: m.uci,
          bestUci: prevResult.bestMove,
          isBook,
        });

        reviewed[i] = {
          ...m,
          bestMoveBefore: prevResult.bestMove ?? m.bestMoveBefore,
          evalAfter: afterResult.score,
          classification: classified.classification,
          accuracy: classified.accuracy,
        };

        prevResult = afterResult;
        setReviewProgress(Math.round(((i + 1) / reviewed.length) * 100));
        setMoves([...reviewed]);
      }
    } finally {
      setIsReviewing(false);
    }
  }, [moves, isReviewing, ensureAnalyzer, initialFen]);

  // Hint: reveal Stockfish's best move as a glowing emerald arrow on the board
  const handleRequestHint = useCallback(() => {
    const bestUci = engineAnalysis?.bestMoveUci ?? engineAnalysis?.lines[0]?.pvUci[0];
    if (bestUci && bestUci.length >= 4) {
      setHintArrow({
        from: bestUci.slice(0, 2) as Square,
        to: bestUci.slice(2, 4) as Square,
        color: 'rgba(129, 182, 76, 0.92)',
        kind: 'best',
      });
    } else {
      // Ensure engine is enabled so it computes a hint
      setEngineEnabled(true);
      setShowBestArrow(true);
    }
  }, [engineAnalysis]);

  const handleTakeback = useCallback(() => {
    if (moves.length === 0) return;
    opponentRef.current?.cancel();
    setIsBotThinking(false);
    setResignedBy(null);
    setTimeoutLoser(null);
    setAgreedDraw(false);
    setHintArrow(null);

    // Against Stockfish, take back 2 plies so it's the human's turn again (unless human just moved and bot is thinking)
    const popCount = activeMode === 'stockfish' && latestChess.turn() === humanColor && moves.length >= 2 ? 2 : 1;
    const nextMoves = moves.slice(0, Math.max(0, moves.length - popCount));
    setMoves(nextMoves);
    setViewPly(nextMoves.length);
    if (appState === 'gameover') {
      setAppState('playing');
    }
  }, [moves, activeMode, latestChess, humanColor, appState]);

  const handleImportPgnOrFen = useCallback(
    (text: string, label?: string): { ok: boolean; error?: string } => {
      const parsed = parsePgnOrFen(text);
      if (!parsed.ok) return parsed;

      opponentRef.current?.cancel();
      setIsBotThinking(false);
      setActiveMode('analysis');
      setInitialFen(parsed.initialFen);
      setPositionLabel(label ?? (parsed.initialFen !== INITIAL_FEN ? 'Custom FEN Position' : 'Imported Game'));
      setMoves(parsed.moves);
      setViewPly(parsed.moves.length);
      setResignedBy(null);
      setTimeoutLoser(null);
      setAgreedDraw(false);
      setWhiteClock(null);
      setBlackClock(null);
      setHintArrow(null);
      setShowBestArrow(true);
      setAppState('playing');
      setRightTab('moves');
      return { ok: true };
    },
    []
  );

  const handleLoadStudy = useCallback(
    (study: ClassicStudy) => {
      const payload = study.pgn ?? study.fen ?? INITIAL_FEN;
      const res = handleImportPgnOrFen(payload, study.title);
      if (res.ok) {
        if (study.pgn) {
          setRightTab('moves');
        } else {
          setRightTab('engine');
        }
      }
    },
    [handleImportPgnOrFen]
  );

  const handlePlayEngineMove = useCallback(
    (uciMove: string) => {
      if (uciMove.length < 4) return;
      const from = uciMove.slice(0, 2) as Square;
      const to = uciMove.slice(2, 4) as Square;
      const promo = uciMove.length === 5 ? (uciMove[4] as PieceSymbol) : undefined;
      applyMove(from, to, promo);
    },
    [applyMove]
  );

  // Global keyboard shortcuts during playing / paused states
  useEffect(() => {
    if (appState === 'title') return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }

      if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
        if (showNewMatchModal) {
          setShowNewMatchModal(false);
          return;
        }
        if (appState === 'playing') setAppState('paused');
        else if (appState === 'paused') setAppState('playing');
        return;
      }
      if (appState === 'paused') return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setViewPly((p) => Math.max(0, p - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setViewPly((p) => Math.min(moves.length, p + 1));
      } else if (e.key === 'Home') {
        e.preventDefault();
        setViewPly(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setViewPly(moves.length);
      } else if (e.key.toLowerCase() === 'f') {
        setOrientation((o) => (o === 'w' ? 'b' : 'w'));
      } else if (e.key.toLowerCase() === 'h') {
        handleRequestHint();
      } else if (e.key.toLowerCase() === 'm') {
        setMuted((m) => !m);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [appState, moves.length, showNewMatchModal, handleRequestHint]);

  // Compute live Stockfish arrows for the board
  const engineArrows = useMemo<BoardArrow[]>(() => {
    const arrows: BoardArrow[] = [];
    if (hintArrow) {
      arrows.push(hintArrow);
      return arrows;
    }
    if (showBestArrow && engineAnalysis && engineAnalysis.fen === viewedFen) {
      const best = engineAnalysis.bestMoveUci ?? engineAnalysis.lines[0]?.pvUci[0];
      if (best && best.length >= 4) {
        arrows.push({
          from: best.slice(0, 2) as Square,
          to: best.slice(2, 4) as Square,
          color: 'rgba(129, 182, 76, 0.84)',
          kind: 'best',
        });
      }
      const reply = engineAnalysis.lines[0]?.pvUci[1];
      if (activeMode === 'analysis' && reply && reply.length >= 4) {
        arrows.push({
          from: reply.slice(0, 2) as Square,
          to: reply.slice(2, 4) as Square,
          color: 'rgba(92, 156, 230, 0.6)',
          kind: 'threat',
        });
      }
    }
    return arrows;
  }, [hintArrow, showBestArrow, engineAnalysis, viewedFen, activeMode]);

  // Player display names
  const whiteName =
    activeMode === 'stockfish'
      ? humanColor === 'w'
        ? 'You'
        : `Stockfish (${activeLevel.name})`
      : activeMode === 'analysis'
        ? 'White'
        : 'White Player';

  const blackName =
    activeMode === 'stockfish'
      ? humanColor === 'b'
        ? 'You'
        : `Stockfish (${activeLevel.name})`
      : activeMode === 'analysis'
        ? 'Black'
        : 'Black Player';

  const whiteSubtitle =
    activeMode === 'stockfish'
      ? humanColor === 'w'
        ? 'White'
        : `${activeLevel.elo} Elo`
      : activeMode === 'analysis'
        ? 'Analysis'
        : '';
  const blackSubtitle =
    activeMode === 'stockfish'
      ? humanColor === 'b'
        ? 'Black'
        : `${activeLevel.elo} Elo`
      : activeMode === 'analysis'
        ? 'Analysis'
        : '';

  const pgnText = useMemo(
    () =>
      buildPgn({
        initialFen,
        moves,
        whiteName,
        blackName,
        result: termination.resultString,
      }),
    [initialFen, moves, whiteName, blackName, termination.resultString]
  );

  // Title Screen
  if (appState === 'title') {
    return (
      <TitleScreen
        settings={matchSettings}
        boardTheme={boardTheme}
        onChangeSettings={setMatchSettings}
        onStart={() => startMatch()}
      />
    );
  }

  // Determine top vs bottom player bars based on board orientation
  const topColor: Color = orientation === 'w' ? 'b' : 'w';
  const bottomColor: Color = orientation;

  const viewedLastMove = viewPly > 0 ? moves[viewPly - 1] : null;
  const activeEvalScore =
    engineAnalysis && engineAnalysis.fen === viewedFen && engineAnalysis.lines[0]
      ? engineAnalysis.lines[0].score
      : viewedLastMove?.evalAfter ?? null;

  const canInteractWithBoard =
    appState === 'playing' &&
    (!termination.isOver || activeMode === 'analysis') &&
    (isViewingLatest || activeMode === 'analysis') &&
    !isBotThinking;

  const allowedBoardTurn: Color | 'both' = activeMode === 'stockfish' ? humanColor : 'both';

  return (
    <div className="min-h-screen w-full bg-[#181817] text-[#F1EFEA] flex flex-col">
      {/* Compact Game Shell Utility Strip */}
      <div className="w-full max-w-[1320px] mx-auto px-4 sm:px-6 pt-3 pb-1 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => setAppState('title')}
          className="flex items-center gap-2.5 text-left group cursor-pointer"
        >
          <svg viewBox="0 0 36 36" className="w-7 h-7 shrink-0" aria-hidden="true">
            <rect x="1.5" y="1.5" width="33" height="33" rx="7" fill="#242321" stroke="#81B64C" strokeWidth="1.4" />
            <path d="M9 25h18v2.5H9V25zm1.5-2.5L8.5 14l5.2 3.6L18 10l4.3 7.6 5.2-3.6-2 8.5h-15z" fill="#F1EFEA" />
          </svg>
          <span className="text-base font-extrabold tracking-tight text-[#F6F4EE] group-hover:text-white whitespace-nowrap">
            Crownline Chess
          </span>
          <span className="hidden sm:inline text-xs text-[#8E8B84] whitespace-nowrap">
            · {activeMode === 'stockfish' ? `vs Stockfish ${activeLevel.elo}` : activeMode === 'local' ? 'Pass & Play' : 'Analysis Board'}
          </span>
        </button>

        {/* Compact Utility Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            tabIndex={-1}
            aria-label="New match"
            title="New Match"
            onClick={(e) => {
              e.currentTarget.blur();
              setShowNewMatchModal(true);
            }}
            className="h-8 px-2.5 rounded-md bg-[#242321] hover:bg-[#312F2C] border border-white/[0.08] text-xs font-semibold text-[#E8E6DF] flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 text-[#81B64C]" />
            <span className="hidden sm:inline">New</span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label="Flip board"
            title="Flip Board (F)"
            onClick={(e) => {
              e.currentTarget.blur();
              setOrientation((o) => (o === 'w' ? 'b' : 'w'));
            }}
            className="w-8 h-8 rounded-md bg-[#242321] hover:bg-[#312F2C] border border-white/[0.08] text-[#D4D1C8] flex items-center justify-center transition-colors cursor-pointer"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            title="Mute / Unmute (M)"
            onClick={(e) => {
              e.currentTarget.blur();
              setMuted((m) => !m);
            }}
            className="w-8 h-8 rounded-md bg-[#242321] hover:bg-[#312F2C] border border-white/[0.08] text-[#D4D1C8] flex items-center justify-center transition-colors cursor-pointer"
          >
            {muted ? <VolumeX className="w-3.5 h-3.5 text-[#9C9990]" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label="Pause match"
            title="Pause (P / Esc)"
            onClick={(e) => {
              e.currentTarget.blur();
              setAppState((s) => (s === 'paused' ? 'playing' : 'paused'));
            }}
            className="w-8 h-8 rounded-md bg-[#242321] hover:bg-[#312F2C] border border-white/[0.08] text-[#D4D1C8] flex items-center justify-center transition-colors cursor-pointer"
          >
            <Pause className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Arena: Centered Chessboard + Right Dock */}
      <main className="flex-1 w-full max-w-[1320px] mx-auto px-4 sm:px-6 py-3 flex flex-col lg:flex-row items-center lg:items-start justify-center gap-6">
        {/* Board Column */}
        <section aria-label="Chessboard arena" className="w-full max-w-[660px] flex flex-col">
          {/* Top Player Strip */}
          <PlayerBar
            name={topColor === 'w' ? whiteName : blackName}
            subtitle={topColor === 'w' ? whiteSubtitle : blackSubtitle}
            color={topColor}
            isActiveTurn={!termination.isOver && viewedChess.turn() === topColor}
            isEngineThinking={activeMode === 'stockfish' && isBotThinking && topColor !== humanColor}
            capturedPieces={topColor === 'w' ? material.capturedByWhite : material.capturedByBlack}
            materialAdvantage={topColor === 'w' ? material.advantage : -material.advantage}
            clockSeconds={topColor === 'w' ? whiteClock : blackClock}
            accuracy={topColor === 'w' ? whiteAccuracy : blackAccuracy}
          />

          {/* Interactive 8x8 Board + Eval Bar */}
          <ChessBoard
            fen={viewedFen}
            orientation={orientation}
            themeId={boardTheme}
            interactive={canInteractWithBoard}
            allowedTurn={allowedBoardTurn}
            lastMove={
              viewedLastMove
                ? {
                    from: viewedLastMove.from,
                    to: viewedLastMove.to,
                    classification: viewedLastMove.classification,
                  }
                : null
            }
            engineArrows={engineArrows}
            showCoordinates={showCoordinates}
            showLegalMoves={showLegalMoves}
            showEvalBar={showEvalBar}
            evalScore={activeEvalScore}
            onMove={applyMove}
          />

          {/* Bottom Player Strip */}
          <PlayerBar
            name={bottomColor === 'w' ? whiteName : blackName}
            subtitle={bottomColor === 'w' ? whiteSubtitle : blackSubtitle}
            color={bottomColor}
            isActiveTurn={!termination.isOver && viewedChess.turn() === bottomColor}
            isEngineThinking={activeMode === 'stockfish' && isBotThinking && bottomColor !== humanColor}
            capturedPieces={bottomColor === 'w' ? material.capturedByWhite : material.capturedByBlack}
            materialAdvantage={bottomColor === 'w' ? material.advantage : -material.advantage}
            clockSeconds={bottomColor === 'w' ? whiteClock : blackClock}
            accuracy={bottomColor === 'w' ? whiteAccuracy : blackAccuracy}
          />

          {/* Historical Ply Banner (when browsing earlier moves during live match) */}
          {!isViewingLatest && activeMode !== 'analysis' && (
            <div className="mt-1 px-3 py-2 rounded-lg bg-[#2A2926] border border-[#E6A832]/40 flex items-center justify-between text-xs">
              <span className="text-[#E6D9B8]">
                Viewing move {Math.ceil(viewPly / 2)} of {Math.ceil(moves.length / 2)}
              </span>
              <button
                type="button"
                onClick={() => setViewPly(moves.length)}
                className="font-semibold text-[#81B64C] hover:underline cursor-pointer"
              >
                Return to Live Position
              </button>
            </div>
          )}
        </section>

        {/* Right Dock: Moves, Stockfish UCI Analysis, Library, Settings */}
        <RightPanel
          activeTab={rightTab}
          onTabChange={setRightTab}
          mode={activeMode}
          moves={moves}
          viewPly={viewPly}
          currentFen={viewedFen}
          opening={opening}
          positionLabel={positionLabel}
          engineAnalysis={engineAnalysis}
          engineEnabled={engineEnabled}
          onToggleEngine={setEngineEnabled}
          multiPv={multiPv}
          onChangeMultiPv={setMultiPv}
          analysisDepth={analysisDepth}
          onChangeAnalysisDepth={setAnalysisDepth}
          showBestArrow={showBestArrow}
          onToggleBestArrow={(val) => {
            setShowBestArrow(val);
            if (!val) setHintArrow(null);
          }}
          showEvalBar={showEvalBar}
          onToggleEvalBar={setShowEvalBar}
          showCoordinates={showCoordinates}
          onToggleCoordinates={setShowCoordinates}
          showLegalMoves={showLegalMoves}
          onToggleLegalMoves={setShowLegalMoves}
          boardTheme={boardTheme}
          onChangeBoardTheme={setBoardTheme}
          muted={muted}
          onToggleMuted={() => setMuted((m) => !m)}
          isGameOver={termination.isOver}
          isReviewing={isReviewing}
          reviewProgress={reviewProgress}
          whiteAccuracy={whiteAccuracy}
          blackAccuracy={blackAccuracy}
          onSelectPly={(ply) => {
            setViewPly(ply);
            setHintArrow(null);
          }}
          onFlipBoard={() => setOrientation((o) => (o === 'w' ? 'b' : 'w'))}
          onRequestHint={handleRequestHint}
          onTakeback={handleTakeback}
          onOfferDraw={() => {
            setAgreedDraw(true);
            playChessSound('gameover', muted);
          }}
          onResign={() => {
            const resigner: Color = activeMode === 'stockfish' ? humanColor : latestChess.turn();
            setResignedBy(resigner);
            playChessSound('gameover', muted);
          }}
          onNewMatch={() => setShowNewMatchModal(true)}
          onRunGameReview={handleRunGameReview}
          onPlayEngineMove={handlePlayEngineMove}
          onImportPgnOrFen={handleImportPgnOrFen}
          onLoadStudy={handleLoadStudy}
          pgnText={pgnText}
        />
      </main>

      {/* Modals */}
      {appState === 'paused' && (
        <PauseModal
          onResume={() => setAppState('playing')}
          onRestart={() => startMatch()}
          onReturnTitle={() => {
            opponentRef.current?.cancel();
            setAppState('title');
          }}
        />
      )}

      {appState === 'gameover' && !gameOverDismissed && (
        <GameOverModal
          termination={termination}
          whiteName={whiteName}
          blackName={blackName}
          totalMoves={moves.length}
          whiteAccuracy={whiteAccuracy}
          blackAccuracy={blackAccuracy}
          onAnalyze={() => {
            setGameOverDismissed(true);
            setActiveMode('analysis');
            setShowBestArrow(true);
            setRightTab('engine');
            handleRunGameReview();
          }}
          onPlayAgain={() => startMatch()}
          onDismiss={() => setGameOverDismissed(true)}
        />
      )}

      {showNewMatchModal && (
        <NewMatchModal
          settings={matchSettings}
          onChangeSettings={setMatchSettings}
          onConfirm={() => startMatch()}
          onCancel={() => setShowNewMatchModal(false)}
        />
      )}
    </div>
  );
}

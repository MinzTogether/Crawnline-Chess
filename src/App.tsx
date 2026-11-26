import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { Color, PieceSymbol, Square } from 'chess.js';
import { ArrowUpDown, Home, Pause, Plus, Settings, Volume2, VolumeX } from 'lucide-react';
import {
  STOCKFISH_LEVELS,
  TIME_CONTROLS,
  type AppState,
  type BoardArrow,
  type ClassicStudy,
  type EngineAnalysis,
  type EvalScore,
  type GameMode,
  type MatchSettings,
  type MoveRecord,
} from './types/chess';
import {
  loadPreferences,
  loadProfile,
  loadSavedMatches,
  saveMatches,
  savePreferences,
  saveProfile,
  type AppPreferences,
  type SavedMatch,
  type UserProfile,
} from './types/preferences';
import { StockfishAnalyzer, StockfishOpponent } from './engine/stockfishService';
import { buildMatchRatingReport } from './engine/matchRating';
import { calculateAverageAccuracy, classifyMove } from './engine/uciParser';
import { buildPgn, evaluateGameTermination, getMaterialSummary, parsePgnOrFen } from './game/chessLogic';
import { detectOpening } from './game/openings';
import { playChessSound } from './utils/sound';
import { AppLogoIcon, syncBrowserFavicon } from './components/AppIcons';
import { ChessBoard } from './components/ChessBoard';
import { PlayerBar } from './components/PlayerBar';
import { RightPanel, type RightPanelTab } from './components/RightPanel';
import { MainHub, type HubSection } from './components/MainHub';
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
  // Persisted Preferences, Profile, and Saved Match Archive
  const [preferences, setPreferences] = useState<AppPreferences>(() => loadPreferences());
  const [profile, setProfile] = useState<UserProfile>(() => loadProfile());
  const [savedMatches, setSavedMatches] = useState<SavedMatch[]>(() => loadSavedMatches());
  const [hubSection, setHubSection] = useState<HubSection>('home');

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
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);

  // Termination flags
  const [resignedBy, setResignedBy] = useState<Color | null>(null);
  const [timeoutLoser, setTimeoutLoser] = useState<Color | null>(null);
  const [agreedDraw, setAgreedDraw] = useState<boolean>(false);

  // Clocks (in seconds; null if unlimited or analysis mode)
  const [whiteClock, setWhiteClock] = useState<number | null>(600);
  const [blackClock, setBlackClock] = useState<number | null>(600);
  const [incrementSec, setIncrementSec] = useState<number>(0);

  // Arena UI State
  const [rightTab, setRightTab] = useState<RightPanelTab>('moves');
  const [showBestArrow, setShowBestArrow] = useState(false);
  const [hintArrow, setHintArrow] = useState<BoardArrow | null>(null);

  // Stockfish Engine State
  const [engineEnabled, setEngineEnabled] = useState(true);
  const [engineAnalysis, setEngineAnalysis] = useState<EngineAnalysis | null>(null);
  const [isBotThinking, setIsBotThinking] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewProgress, setReviewProgress] = useState(0);

  const analyzerRef = useRef<StockfishAnalyzer | null>(null);
  const opponentRef = useRef<StockfishOpponent | null>(null);
  const latestAnalysisRef = useRef<EngineAnalysis | null>(null);
  const archivedMatchRef = useRef<string | null>(null);

  // Apply App Theme & Browser Favicon whenever preferences change
  useEffect(() => {
    document.documentElement.dataset.appTheme = preferences.appTheme;
    syncBrowserFavicon(preferences.appIcon);
    savePreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    saveProfile(profile);
  }, [profile]);

  useEffect(() => {
    saveMatches(savedMatches);
  }, [savedMatches]);

  useEffect(() => {
    latestAnalysisRef.current = engineAnalysis;
  }, [engineAnalysis]);

  useEffect(() => {
    document.body.dataset.state = appState;
  }, [appState]);

  useEffect(() => {
    return () => {
      analyzerRef.current?.terminate();
      opponentRef.current?.terminate();
    };
  }, []);

  const updatePreferences = useCallback((patch: Partial<AppPreferences>) => {
    setPreferences((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateProfile = useCallback((patch: Partial<UserProfile>) => {
    setProfile((prev) => ({ ...prev, ...patch }));
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

  const fullGameOpening = useMemo(() => detectOpening(moves.map((m) => m.san)), [moves]);

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

  // Player display names
  const whiteName =
    activeMode === 'stockfish'
      ? humanColor === 'w'
        ? profile.displayName
        : `Stockfish (${activeLevel.name})`
      : activeMode === 'analysis'
        ? 'White'
        : `${profile.displayName} (W)`;

  const blackName =
    activeMode === 'stockfish'
      ? humanColor === 'b'
        ? profile.displayName
        : `Stockfish (${activeLevel.name})`
      : activeMode === 'analysis'
        ? 'Black'
        : 'Player 2 (B)';

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

  // Start / Restart a match
  const startMatch = useCallback(
    (customSettings?: MatchSettings) => {
      const cfg = customSettings ?? matchSettings;
      const tc = TIME_CONTROLS.find((t) => t.id === cfg.timeControlId) ?? TIME_CONTROLS[4];
      const chosenSide = cfg.mode === 'stockfish' ? resolvePlayerColor(cfg.playerSide) : 'w';
      const newMatchId = `match-${Date.now()}`;

      opponentRef.current?.cancel();
      analyzerRef.current?.stop();

      setActiveMode(cfg.mode);
      setHumanColor(chosenSide);
      setOrientation(chosenSide);
      setInitialFen(INITIAL_FEN);
      setPositionLabel(null);
      setActiveMatchId(newMatchId);
      archivedMatchRef.current = null;
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

      setShowBestArrow(cfg.mode === 'analysis');
      setRightTab(cfg.mode === 'analysis' ? 'rating' : 'moves');
      setAppState('playing');

      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    },
    [matchSettings]
  );

  // Core move application
  const applyMove = useCallback(
    (from: Square, to: Square, promotion?: PieceSymbol): boolean => {
      if (appState !== 'playing' && activeMode !== 'analysis') return false;
      if (termination.isOver && activeMode !== 'analysis') return false;

      const baseMoves = isViewingLatest ? moves : moves.slice(0, viewPly);
      const baseFen = baseMoves.length > 0 ? baseMoves[baseMoves.length - 1].fenAfter : initialFen;

      const game = new Chess(baseFen);
      let played;
      try {
        played = game.move({ from, to, promotion: promotion ?? 'q' });
      } catch {
        playChessSound('illegal', preferences.muted);
        return false;
      }
      if (!played) {
        playChessSound('illegal', preferences.muted);
        return false;
      }

      const fenAfter = game.fen();
      const moveNum = parseInt(baseFen.split(' ')[5] || '1', 10) || Math.floor(baseMoves.length / 2) + 1;

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

      if (incrementSec > 0 && activeMode !== 'analysis') {
        if (played.color === 'w') {
          setWhiteClock((c) => (c !== null ? c + incrementSec : null));
        } else {
          setBlackClock((c) => (c !== null ? c + incrementSec : null));
        }
      }

      if (game.isCheckmate() || game.isDraw()) {
        playChessSound('gameover', preferences.muted);
      } else if (game.inCheck()) {
        playChessSound('check', preferences.muted);
      } else if (played.flags.includes('p')) {
        playChessSound('promote', preferences.muted);
      } else if (played.flags.includes('k') || played.flags.includes('q')) {
        playChessSound('castle', preferences.muted);
      } else if (played.captured || played.flags.includes('e')) {
        playChessSound('capture', preferences.muted);
      } else {
        playChessSound('move', preferences.muted);
      }

      return true;
    },
    [
      appState,
      activeMode,
      termination.isOver,
      isViewingLatest,
      moves,
      viewPly,
      initialFen,
      incrementSec,
      preferences.muted,
    ]
  );

  // Trigger game-over state and archive completed match to Profile history
  useEffect(() => {
    if (appState === 'playing' && termination.isOver && activeMode !== 'analysis') {
      setAppState('gameover');
      setGameOverDismissed(false);
      opponentRef.current?.cancel();
      setIsBotThinking(false);

      if (moves.length >= 2 && activeMatchId && archivedMatchRef.current !== activeMatchId) {
        archivedMatchRef.current = activeMatchId;
        const report = buildMatchRatingReport(moves);
        const entry: SavedMatch = {
          id: activeMatchId,
          date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          whiteName,
          blackName,
          result: termination.resultString,
          reason: termination.reason,
          openingName: fullGameOpening ? `${fullGameOpening.eco} · ${fullGameOpening.name}` : 'Standard Game',
          movesCount: Math.ceil(moves.length / 2),
          pgn: pgnText,
          whiteAccuracy: report.white.accuracy,
          blackAccuracy: report.black.accuracy,
          whiteGameElo: report.white.estimatedElo,
          blackGameElo: report.black.estimatedElo,
          userSide: activeMode === 'stockfish' ? humanColor : 'both',
        };
        setSavedMatches((prev) => [entry, ...prev.filter((m) => m.id !== activeMatchId)].slice(0, 25));
      }
    }
  }, [
    appState,
    termination,
    activeMode,
    moves,
    activeMatchId,
    whiteName,
    blackName,
    fullGameOpening,
    pgnText,
    humanColor,
  ]);

  // Real-time Stockfish Analysis Worker trigger whenever viewedFen changes
  useEffect(() => {
    if (appState === 'title' || !engineEnabled || isReviewing) {
      analyzerRef.current?.stop();
      return;
    }

    let cancelled = false;
    const analyzer = ensureAnalyzer();

    if (viewedChess.isGameOver()) {
      const mateScore: EvalScore = viewedChess.isCheckmate()
        ? { type: 'mate', value: viewedChess.turn() === 'w' ? -1 : 1 }
        : { type: 'cp', value: 0 };
      setEngineAnalysis({
        fen: viewedFen,
        depth: 0,
        nodes: 0,
        nps: 0,
        bestMoveUci: null,
        ponderUci: null,
        lines: [
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
      .analyzePosition(
        viewedFen,
        { depth: preferences.analysisDepth, multiPv: preferences.multiPv },
        (snapshot) => {
          if (cancelled) return;
          setEngineAnalysis(snapshot);

          if (snapshot.depth >= 10 && snapshot.lines[0]?.score) {
            const score = snapshot.lines[0].score;
            setMoves((prev) => {
              const idx = prev.findIndex((m) => m.fenAfter === snapshot.fen);
              if (idx === -1) return prev;
              const target = prev[idx];
              const prevEval: EvalScore =
                idx > 0 && prev[idx - 1].evalAfter ? prev[idx - 1].evalAfter! : { type: 'cp', value: 20 };
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
        }
      )
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [
    appState,
    engineEnabled,
    isReviewing,
    viewedFen,
    viewedChess,
    preferences.analysisDepth,
    preferences.multiPv,
    ensureAnalyzer,
  ]);

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

  // Active Match Clocks Ticker
  useEffect(() => {
    if (appState !== 'playing') return;
    if (activeMode === 'analysis') return;
    if (termination.isOver) return;
    if (whiteClock === null || blackClock === null) return;
    if (moves.length === 0) return;

    const activeTurn = latestChess.turn();
    const timer = window.setInterval(() => {
      if (activeTurn === 'w') {
        setWhiteClock((prev) => {
          if (prev === null) return null;
          const next = Math.max(0, prev - 0.1);
          if (next <= 0) {
            setTimeoutLoser('w');
            playChessSound('gameover', preferences.muted);
          }
          return next;
        });
      } else {
        setBlackClock((prev) => {
          if (prev === null) return null;
          const next = Math.max(0, prev - 0.1);
          if (next <= 0) {
            setTimeoutLoser('b');
            playChessSound('gameover', preferences.muted);
          }
          return next;
        });
      }
    }, 100);

    return () => window.clearInterval(timer);
  }, [
    appState,
    activeMode,
    termination.isOver,
    whiteClock === null,
    blackClock === null,
    moves.length,
    latestChess,
    preferences.muted,
  ]);

  // Full Match Rating / Game Review pass across explicit or current moves
  const runMatchRatingPass = useCallback(
    async (targetInitialFen: string, targetMoves: MoveRecord[], matchIdToUpdate?: string | null) => {
      if (targetMoves.length === 0) return;
      setIsReviewing(true);
      setReviewProgress(0);
      setRightTab('rating');

      const analyzer = ensureAnalyzer();
      const reviewed: MoveRecord[] = [...targetMoves];

      try {
        let prevResult = await analyzer.evaluateOnce(targetInitialFen, 10);

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

        // Update saved match entry with exact Stockfish accuracy & Game Elo
        if (matchIdToUpdate) {
          const report = buildMatchRatingReport(reviewed);
          setSavedMatches((prev) =>
            prev.map((item) =>
              item.id === matchIdToUpdate
                ? {
                    ...item,
                    whiteAccuracy: report.white.accuracy,
                    blackAccuracy: report.black.accuracy,
                    whiteGameElo: report.white.estimatedElo,
                    blackGameElo: report.black.estimatedElo,
                  }
                : item
            )
          );
        }
      } finally {
        setIsReviewing(false);
      }
    },
    [ensureAnalyzer]
  );

  const handleRunGameReview = useCallback(() => {
    if (moves.length === 0 || isReviewing) return;
    runMatchRatingPass(initialFen, moves, activeMatchId);
  }, [moves, isReviewing, runMatchRatingPass, initialFen, activeMatchId]);

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

    const popCount = activeMode === 'stockfish' && latestChess.turn() === humanColor && moves.length >= 2 ? 2 : 1;
    const nextMoves = moves.slice(0, Math.max(0, moves.length - popCount));
    setMoves(nextMoves);
    setViewPly(nextMoves.length);
    if (appState === 'gameover') {
      setAppState('playing');
    }
  }, [moves, activeMode, latestChess, humanColor, appState]);

  const handleImportPgnOrFen = useCallback(
    (text: string, label?: string, autoRate = false): { ok: boolean; error?: string } => {
      const parsed = parsePgnOrFen(text);
      if (!parsed.ok) return parsed;

      opponentRef.current?.cancel();
      setIsBotThinking(false);
      setActiveMode('analysis');
      setInitialFen(parsed.initialFen);
      setPositionLabel(label ?? (parsed.initialFen !== INITIAL_FEN ? 'Custom FEN Position' : 'Imported Match'));
      setActiveMatchId(null);
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
      setRightTab(autoRate ? 'rating' : 'moves');

      if (autoRate && parsed.moves.length > 0) {
        window.setTimeout(() => {
          runMatchRatingPass(parsed.initialFen, parsed.moves, null);
        }, 50);
      }

      return { ok: true };
    },
    [runMatchRatingPass]
  );

  // Open dedicated Match Rating Analysis Mode from MainHub Home or Profile
  const handleOpenMatchRating = useCallback(
    (pgn?: string, title?: string) => {
      if (pgn) {
        handleImportPgnOrFen(pgn, title ?? 'Match Rating Review', true);
      } else {
        startMatch({ ...matchSettings, mode: 'analysis' });
      }
    },
    [handleImportPgnOrFen, startMatch, matchSettings]
  );

  const handleLoadStudy = useCallback(
    (study: ClassicStudy) => {
      const payload = study.pgn ?? study.fen ?? INITIAL_FEN;
      const res = handleImportPgnOrFen(payload, study.title, Boolean(study.pgn));
      if (res.ok && !study.pgn) {
        setRightTab('engine');
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
        updatePreferences({ muted: !preferences.muted });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [appState, moves.length, showNewMatchModal, handleRequestHint, updatePreferences, preferences.muted]);

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

  // Main Chess.com-style Hub (Home, Settings, Profile) before choosing a play mode
  if (appState === 'title') {
    return (
      <MainHub
        section={hubSection}
        onChangeSection={setHubSection}
        preferences={preferences}
        onUpdatePreferences={updatePreferences}
        profile={profile}
        onUpdateProfile={updateProfile}
        savedMatches={savedMatches}
        matchSettings={matchSettings}
        onChangeMatchSettings={setMatchSettings}
        onStartMatch={startMatch}
        onOpenMatchRating={handleOpenMatchRating}
      />
    );
  }

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

  const returnToHub = (targetSection: HubSection) => {
    opponentRef.current?.cancel();
    setHubSection(targetSection);
    setAppState('title');
  };

  return (
    <div className="min-h-screen w-full bg-[var(--app-bg)] text-[var(--app-text)] flex flex-col">
      {/* Compact Arena Utility Strip */}
      <div className="w-full max-w-[1320px] mx-auto px-4 sm:px-6 pt-3 pb-1 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => returnToHub('home')}
          className="flex items-center gap-2.5 text-left group cursor-pointer"
        >
          <AppLogoIcon iconId={preferences.appIcon} className="w-8 h-8 shrink-0" />
          <span className="text-base font-extrabold tracking-tight text-[var(--app-text)] whitespace-nowrap">
            Crownline Chess
          </span>
          <span className="hidden sm:inline text-xs text-[var(--app-text-muted)] whitespace-nowrap">
            ·{' '}
            {activeMode === 'stockfish'
              ? `vs Stockfish ${activeLevel.elo}`
              : activeMode === 'local'
                ? 'Pass & Play'
                : 'Analysis & Match Rating'}
          </span>
        </button>

        {/* Compact Utility Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Home lobby"
            title="Home Lobby"
            onClick={(e) => {
              e.currentTarget.blur();
              returnToHub('home');
            }}
            className="w-8 h-8 rounded-md bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-[var(--app-text)] flex items-center justify-center transition-colors cursor-pointer"
          >
            <Home className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label="New match"
            title="New Match"
            onClick={(e) => {
              e.currentTarget.blur();
              setShowNewMatchModal(true);
            }}
            className="h-8 px-2.5 rounded-md bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-xs font-semibold text-[var(--app-text)] flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 text-[var(--app-accent)]" />
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
            className="w-8 h-8 rounded-md bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-[var(--app-text)] flex items-center justify-center transition-colors cursor-pointer"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label={preferences.muted ? 'Unmute audio' : 'Mute audio'}
            title="Mute / Unmute (M)"
            onClick={(e) => {
              e.currentTarget.blur();
              updatePreferences({ muted: !preferences.muted });
            }}
            className="w-8 h-8 rounded-md bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-[var(--app-text)] flex items-center justify-center transition-colors cursor-pointer"
          >
            {preferences.muted ? (
              <VolumeX className="w-3.5 h-3.5 text-[var(--app-text-muted)]" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label="Open settings"
            title="App Settings"
            onClick={(e) => {
              e.currentTarget.blur();
              returnToHub('settings');
            }}
            className="w-8 h-8 rounded-md bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-[var(--app-text)] flex items-center justify-center transition-colors cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
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
            className="w-8 h-8 rounded-md bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-[var(--app-text)] flex items-center justify-center transition-colors cursor-pointer"
          >
            <Pause className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Arena: Centered Chessboard + Right Dock */}
      <main className="flex-1 w-full max-w-[1320px] mx-auto px-4 sm:px-6 py-3 flex flex-col lg:flex-row items-center lg:items-start justify-center gap-6">
        <section aria-label="Chessboard arena" className="w-full max-w-[660px] flex flex-col">
          <PlayerBar
            name={topColor === 'w' ? whiteName : blackName}
            subtitle={topColor === 'w' ? whiteSubtitle : blackSubtitle}
            color={topColor}
            avatarImage={
              (activeMode === 'stockfish' && topColor === humanColor) || (activeMode === 'local' && topColor === 'w')
                ? profile.avatarImage
                : null
            }
            isActiveTurn={!termination.isOver && viewedChess.turn() === topColor}
            isEngineThinking={activeMode === 'stockfish' && isBotThinking && topColor !== humanColor}
            capturedPieces={topColor === 'w' ? material.capturedByWhite : material.capturedByBlack}
            materialAdvantage={topColor === 'w' ? material.advantage : -material.advantage}
            clockSeconds={topColor === 'w' ? whiteClock : blackClock}
            accuracy={topColor === 'w' ? whiteAccuracy : blackAccuracy}
          />

          <ChessBoard
            fen={viewedFen}
            orientation={orientation}
            themeId={preferences.boardTheme}
            pieceStyle={preferences.pieceStyle}
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
            showCoordinates={preferences.showCoordinates}
            showLegalMoves={preferences.showLegalMoves}
            showEvalBar={preferences.showEvalBar}
            evalScore={activeEvalScore}
            onMove={applyMove}
          />

          <PlayerBar
            name={bottomColor === 'w' ? whiteName : blackName}
            subtitle={bottomColor === 'w' ? whiteSubtitle : blackSubtitle}
            color={bottomColor}
            avatarImage={
              (activeMode === 'stockfish' && bottomColor === humanColor) ||
              (activeMode === 'local' && bottomColor === 'w')
                ? profile.avatarImage
                : null
            }
            isActiveTurn={!termination.isOver && viewedChess.turn() === bottomColor}
            isEngineThinking={activeMode === 'stockfish' && isBotThinking && bottomColor !== humanColor}
            capturedPieces={bottomColor === 'w' ? material.capturedByWhite : material.capturedByBlack}
            materialAdvantage={bottomColor === 'w' ? material.advantage : -material.advantage}
            clockSeconds={bottomColor === 'w' ? whiteClock : blackClock}
            accuracy={bottomColor === 'w' ? whiteAccuracy : blackAccuracy}
          />

          {!isViewingLatest && activeMode !== 'analysis' && (
            <div className="mt-1 px-3 py-2 rounded-lg bg-[var(--app-surface)] border border-[#E6A832]/40 flex items-center justify-between text-xs">
              <span className="text-[var(--app-text)]">
                Viewing move {Math.ceil(viewPly / 2)} of {Math.ceil(moves.length / 2)}
              </span>
              <button
                type="button"
                onClick={() => setViewPly(moves.length)}
                className="font-semibold text-[var(--app-accent)] hover:underline cursor-pointer"
              >
                Return to Live Position
              </button>
            </div>
          )}
        </section>

        <RightPanel
          activeTab={rightTab}
          onTabChange={setRightTab}
          mode={activeMode}
          moves={moves}
          viewPly={viewPly}
          currentFen={viewedFen}
          opening={opening}
          positionLabel={positionLabel}
          whiteName={whiteName}
          blackName={blackName}
          engineAnalysis={engineAnalysis}
          engineEnabled={engineEnabled}
          onToggleEngine={setEngineEnabled}
          multiPv={preferences.multiPv}
          onChangeMultiPv={(n) => updatePreferences({ multiPv: n })}
          analysisDepth={preferences.analysisDepth}
          showBestArrow={showBestArrow}
          onToggleBestArrow={(val) => {
            setShowBestArrow(val);
            if (!val) setHintArrow(null);
          }}
          isGameOver={termination.isOver}
          isReviewing={isReviewing}
          reviewProgress={reviewProgress}
          onSelectPly={(ply) => {
            setViewPly(ply);
            setHintArrow(null);
          }}
          onFlipBoard={() => setOrientation((o) => (o === 'w' ? 'b' : 'w'))}
          onRequestHint={handleRequestHint}
          onTakeback={handleTakeback}
          onOfferDraw={() => {
            setAgreedDraw(true);
            playChessSound('gameover', preferences.muted);
          }}
          onResign={() => {
            const resigner: Color = activeMode === 'stockfish' ? humanColor : latestChess.turn();
            setResignedBy(resigner);
            playChessSound('gameover', preferences.muted);
          }}
          onNewMatch={() => setShowNewMatchModal(true)}
          onRunGameReview={handleRunGameReview}
          onPlayEngineMove={handlePlayEngineMove}
          onImportPgnOrFen={(txt) => handleImportPgnOrFen(txt, undefined, false)}
          onImportAndRatePgn={(txt) => handleImportPgnOrFen(txt, 'Rated Match Review', true)}
          onLoadStudy={handleLoadStudy}
          pgnText={pgnText}
        />
      </main>

      {appState === 'paused' && (
        <PauseModal
          onResume={() => setAppState('playing')}
          onRestart={() => startMatch()}
          onReturnHome={() => returnToHub('home')}
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
          onRateMatch={() => {
            setGameOverDismissed(true);
            setActiveMode('analysis');
            setShowBestArrow(true);
            setRightTab('rating');
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

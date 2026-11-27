import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { Color, PieceSymbol, Square } from 'chess.js';
import { ArrowUpDown, Home, Pause, Plus, Settings, Shuffle, Volume2, VolumeX } from 'lucide-react';
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
  type MatchVariant,
  type MoveRecord,
  type RandomChessStyle,
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
import {
  MAX_EVAL_CACHE_SIZE,
  positionKeyFromFen,
  stabilizeEvaluation,
  type CachedEvalEntry,
} from './engine/evalStabilizer';
import { calculateAverageAccuracy, classifyMove } from './engine/uciParser';
import {
  applyRuleMove,
  buildChessWithHistory,
  buildPgn,
  evaluateGameTermination,
  getMaterialSummary,
  isTacticalPieceSacrifice,
  parsePgnOrFen,
  stripCastlingRights,
} from './game/chessLogic';
import {
  commitMoveClock,
  createClockState,
  getClockRemaining,
  pauseClockState,
  quantizeClockDisplay,
  resumeClockState,
  type ClockState,
} from './game/clock';
import { generateRandomChessFen, generateStandardRandomFen } from './game/customPosition';
import { createChess960Position } from './game/chess960';
import { detectOpening } from './game/openings';
import { playChessSound } from './utils/sound';
import { resolveAnimationTokens } from './utils/animationConfig';
import { AppLogoIcon, syncBrowserFavicon } from './components/AppIcons';
import { ChessBoard } from './components/ChessBoard';
import { MobileMoveBar } from './components/MobileMoveBar';
import { PlayerBar } from './components/PlayerBar';
import { RightPanel, type RightPanelTab } from './components/RightPanel';
import { LanguageProvider } from './i18n/LanguageContext';
import { translate } from './i18n/translations';
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

function scoresEqual(a: EvalScore | undefined, b: EvalScore): boolean {
  return Boolean(a && a.type === b.type && a.value === b.value);
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
  const [activeVariant, setActiveVariant] = useState<MatchVariant>('standard');
  const [activeRandomStyle, setActiveRandomStyle] = useState<RandomChessStyle>('all');
  const [activeChess960Id, setActiveChess960Id] = useState<number | null>(null);
  const [positionLabel, setPositionLabel] = useState<string | null>(null);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(() =>
    getAutostartFlag() ? `match-${Date.now()}` : null
  );

  // Termination flags
  const [resignedBy, setResignedBy] = useState<Color | null>(null);
  const [timeoutLoser, setTimeoutLoser] = useState<Color | null>(null);
  const [agreedDraw, setAgreedDraw] = useState<boolean>(false);

  // Clocks (in seconds; null if unlimited or analysis mode)
  const [whiteClock, setWhiteClock] = useState<number | null>(600);
  const [blackClock, setBlackClock] = useState<number | null>(600);
  const [incrementSec, setIncrementSec] = useState<number>(0);
  const clockRef = useRef<ClockState | null>(
    getAutostartFlag() ? createClockState(600, 'w', Date.now()) : null
  );

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
  const reviewRunIdRef = useRef(0);
  const delayedReviewTimerRef = useRef<number | null>(null);
  const evalCacheRef = useRef<Map<string, CachedEvalEntry>>(new Map());
  const displayedEvalRef = useRef<{ fen: string | null; score: EvalScore | null; depth: number }>({
    fen: null,
    score: null,
    depth: 0,
  });

  // Apply App Theme, Advanced Animation tokens, Language attribute & Browser Favicon whenever preferences change
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.appTheme = preferences.appTheme;
    const animTokens = resolveAnimationTokens(preferences);
    for (const [prop, value] of Object.entries(animTokens.cssVars)) {
      root.style.setProperty(prop, value);
    }
    root.dataset.animationLevel = animTokens.dataset.animationLevel;
    root.dataset.pieceMotion = animTokens.dataset.pieceMotion;
    root.dataset.badgeMotion = animTokens.dataset.badgeMotion;
    root.dataset.highlightMotion = animTokens.dataset.highlightMotion;
    root.dataset.evalMotion = animTokens.dataset.evalMotion;
    root.dataset.uiTransitions = animTokens.dataset.uiTransitions;
    root.dataset.pieceLift = animTokens.dataset.pieceLift;
    root.lang = preferences.language;
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

  const cancelOngoingReview = useCallback(() => {
    reviewRunIdRef.current += 1;
    if (delayedReviewTimerRef.current !== null) {
      window.clearTimeout(delayedReviewTimerRef.current);
      delayedReviewTimerRef.current = null;
    }
    setIsReviewing(false);
  }, []);

  useEffect(() => {
    return () => {
      reviewRunIdRef.current += 1;
      if (delayedReviewTimerRef.current !== null) {
        window.clearTimeout(delayedReviewTimerRef.current);
        delayedReviewTimerRef.current = null;
      }
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

  // Derived board positions & rules
  const allowCastling = activeVariant === 'standard';
  const isChess960 = activeVariant === 'chess960';
  const latestFen = moves.length > 0 ? moves[moves.length - 1].fenAfter : initialFen;
  const viewedFen = viewPly === 0 ? initialFen : moves[viewPly - 1]?.fenAfter ?? latestFen;
  const isViewingLatest = viewPly === moves.length;

  // Primitive turn/FEN signals decouple bot-turn, clock, and analyzer effects from evalAfter updates.
  const latestTurn = useMemo<Color>(() => (latestFen.split(' ')[1] === 'b' ? 'b' : 'w'), [latestFen]);
  const viewedTurn = useMemo<Color>(() => (viewedFen.split(' ')[1] === 'b' ? 'b' : 'w'), [viewedFen]);

  const viewedBoardChess = useMemo(() => {
    try {
      return new Chess(allowCastling ? viewedFen : stripCastlingRights(viewedFen, 'both'));
    } catch {
      return new Chess();
    }
  }, [viewedFen, allowCastling]);

  const latestChess = useMemo(
    () => buildChessWithHistory(initialFen, moves, allowCastling),
    [initialFen, moves, allowCastling]
  );

  const termination = useMemo(
    () =>
      evaluateGameTermination({
        fen: latestFen,
        initialFen,
        moves,
        chess: latestChess,
        allowCastling,
        timeoutLoser,
        resignedBy,
        agreedDraw,
      }),
    [latestFen, initialFen, moves, latestChess, allowCastling, timeoutLoser, resignedBy, agreedDraw]
  );

  const opening = useMemo(() => {
    if (activeVariant !== 'standard') return null;
    const sanList = moves.slice(0, viewPly).map((m) => m.san);
    return detectOpening(sanList);
  }, [moves, viewPly, activeVariant]);

  const fullGameOpening = useMemo(
    () => (activeVariant === 'standard' ? detectOpening(moves.map((m) => m.san)) : null),
    [moves, activeVariant]
  );

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
  const playerDisplayName = profile.displayName.trim() || 'Player';
  const whiteName =
    activeMode === 'stockfish'
      ? humanColor === 'w'
        ? playerDisplayName
        : `Stockfish (${activeLevel.name})`
      : activeMode === 'analysis'
        ? 'White'
        : humanColor === 'w'
          ? `${playerDisplayName} (W)`
          : 'Player 2 (W)';

  const blackName =
    activeMode === 'stockfish'
      ? humanColor === 'b'
        ? playerDisplayName
        : `Stockfish (${activeLevel.name})`
      : activeMode === 'analysis'
        ? 'Black'
        : humanColor === 'b'
          ? `${playerDisplayName} (B)`
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
        variant: isChess960 ? 'Chess960' : undefined,
        pgnInitialFen: initialFen,
      }),
    [initialFen, isChess960, moves, whiteName, blackName, termination.resultString]
  );

  // Start / Restart a match
  const startMatch = useCallback(
    (customSettings?: MatchSettings) => {
      const cfg = customSettings ?? matchSettings;
      if (customSettings) {
        setMatchSettings(customSettings);
      }
      const variant: MatchVariant = cfg.variant ?? 'standard';
      const tc = TIME_CONTROLS.find((t) => t.id === cfg.timeControlId) ?? TIME_CONTROLS[4];
      const chosenSide = cfg.mode === 'analysis' ? 'w' : resolvePlayerColor(cfg.playerSide);
      const newMatchId = `match-${Date.now()}`;

      let resolvedFen = INITIAL_FEN;
      let resolvedLabel: string | null = null;
      let resolvedRandomStyle: RandomChessStyle = cfg.randomStyle ?? 'all';
      let resolved960Id: number | null = null;

      if (variant === 'random') {
        resolvedFen =
          resolvedRandomStyle === 'standard' ? generateStandardRandomFen() : generateRandomChessFen();
        const styleName =
          resolvedRandomStyle === 'standard'
            ? translate(preferences.language, 'randomStyleStandardTitle')
            : translate(preferences.language, 'randomStyleAllTitle');
        resolvedLabel = `${translate(preferences.language, 'modeRandomTitle')} · ${styleName}`;
      } else if (variant === 'chess960') {
        const pos960 = createChess960Position(cfg.chess960Id ?? undefined);
        resolvedFen = pos960.fen;
        resolved960Id = pos960.id;
        resolvedLabel = `Chess960 #${pos960.id}`;
      } else if (variant === 'custom' && cfg.customFen) {
        try {
          const check = new Chess(stripCastlingRights(cfg.customFen, 'both'));
          resolvedFen = check.fen();
          resolvedLabel = translate(preferences.language, 'modeCustomTitle');
        } catch {
          resolvedFen = stripCastlingRights(INITIAL_FEN, 'both');
        }
      }

      // Castling is only allowed in Classic ('standard') mode
      if (variant !== 'standard') {
        resolvedFen = stripCastlingRights(resolvedFen, 'both');
      }

      cancelOngoingReview();
      opponentRef.current?.cancel();
      analyzerRef.current?.stop();

      setActiveMode(cfg.mode);
      setActiveVariant(variant);
      setActiveRandomStyle(resolvedRandomStyle);
      setActiveChess960Id(resolved960Id);
      setHumanColor(chosenSide);
      setOrientation(chosenSide);
      setInitialFen(resolvedFen);
      setPositionLabel(resolvedLabel);
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
      displayedEvalRef.current = {
        fen: resolvedFen,
        score: { type: 'cp', value: variant === 'standard' ? 20 : 0 },
        depth: 0,
      };
      setShowNewMatchModal(false);

      const initialTurn = new Chess(resolvedFen).turn();
      if (cfg.mode === 'analysis' || tc.initialSeconds === 0) {
        clockRef.current = null;
        setWhiteClock(null);
        setBlackClock(null);
        setIncrementSec(0);
      } else {
        // Start timestamp-based clock immediately upon entering 'playing'
        clockRef.current = createClockState(tc.initialSeconds, initialTurn, Date.now());
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
    [matchSettings, preferences.language, cancelOngoingReview]
  );

  // Core move application
  const applyMove = useCallback(
    (from: Square, to: Square, promotion?: PieceSymbol): boolean => {
      if (appState !== 'playing' && activeMode !== 'analysis') return false;
      if (termination.isOver && activeMode !== 'analysis') return false;

      const baseMoves = isViewingLatest ? moves : moves.slice(0, viewPly);
      const baseFen = baseMoves.length > 0 ? baseMoves[baseMoves.length - 1].fenAfter : initialFen;

      const prevAnalysis = latestAnalysisRef.current;
      const bestBefore = prevAnalysis && prevAnalysis.fen === baseFen ? prevAnalysis.bestMoveUci ?? undefined : undefined;
      const evalBefore = prevAnalysis && prevAnalysis.fen === baseFen ? prevAnalysis.lines[0]?.score : undefined;

      const applied = applyRuleMove({
        initialFen,
        moves: baseMoves,
        from,
        to,
        promotion,
        allowCastling,
      });

      if (!applied) {
        playChessSound('illegal', preferences.muted);
        return false;
      }

      const movedColor = applied.color;
      const newRecord: MoveRecord = {
        ply: baseMoves.length + 1,
        moveNumber: applied.moveNumber,
        color: applied.color,
        san: applied.san,
        uci: applied.uci,
        from: applied.from,
        to: applied.to,
        piece: applied.piece,
        captured: applied.captured,
        promotion: applied.promotion,
        fenBefore: applied.fenBefore,
        fenAfter: applied.fenAfter,
        bestMoveBefore: bestBefore,
      };

      const soundKind: 'gameover' | 'check' | 'promote' | 'castle' | 'capture' | 'move' =
        applied.isCheckmate || applied.isDraw
          ? 'gameover'
          : applied.isCheck
            ? 'check'
            : applied.isPromotion
              ? 'promote'
              : applied.isCastle
                ? 'castle'
                : applied.isCapture
                  ? 'capture'
                  : 'move';

      const nextMoves = [...baseMoves, newRecord];
      if (evalBefore && nextMoves.length >= 2 && !nextMoves[nextMoves.length - 2].evalAfter) {
        nextMoves[nextMoves.length - 2] = {
          ...nextMoves[nextMoves.length - 2],
          evalAfter: evalBefore,
        };
      }

      if (isReviewing) {
        cancelOngoingReview();
      }
      setMoves(nextMoves);
      setViewPly(nextMoves.length);
      setHintArrow(null);

      // Commit elapsed timestamp on mover's clock, add increment, and start next turn timestamp
      if (activeMode !== 'analysis' && clockRef.current !== null) {
        const nextTurn: Color = movedColor === 'w' ? 'b' : 'w';
        const gameEnded = applied.isCheckmate || applied.isDraw;
        const { nextState, expiredColor } = commitMoveClock(
          clockRef.current,
          movedColor,
          nextTurn,
          incrementSec,
          Date.now(),
          gameEnded
        );
        clockRef.current = nextState;
        setWhiteClock(quantizeClockDisplay(nextState.w));
        setBlackClock(quantizeClockDisplay(nextState.b));
        if (expiredColor) {
          setTimeoutLoser(expiredColor);
          playChessSound('gameover', preferences.muted);
          return true;
        }
      }

      playChessSound(soundKind, preferences.muted);
      return true;
    },
    [
      appState,
      activeMode,
      allowCastling,
      termination.isOver,
      isViewingLatest,
      moves,
      viewPly,
      initialFen,
      incrementSec,
      preferences.muted,
      isReviewing,
      cancelOngoingReview,
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
          openingName: fullGameOpening
            ? `${fullGameOpening.eco} · ${fullGameOpening.name}`
            : positionLabel ?? 'Standard Game',
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
    positionLabel,
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

    if (viewedBoardChess.isGameOver()) {
      const mateScore: EvalScore = viewedBoardChess.isCheckmate()
        ? { type: 'mate', value: viewedBoardChess.turn() === 'w' ? -1 : 1 }
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
        {
          depth: preferences.analysisDepth,
          multiPv: preferences.multiPv,
          chess960: false,
          engineFen: viewedFen,
        },
        (snapshot) => {
          if (cancelled) return;
          setEngineAnalysis(snapshot);

          if (snapshot.depth >= 10 && snapshot.lines[0]?.score) {
            const score = snapshot.lines[0].score;
            setMoves((prev) => {
              // Prefer the exact viewed ply so repeated positions update the right move
              let idx = viewPly - 1;
              if (idx < 0 || idx >= prev.length || prev[idx].fenAfter !== snapshot.fen) {
                idx = -1;
                for (let i = prev.length - 1; i >= 0; i--) {
                  if (prev[i].fenAfter === snapshot.fen) {
                    idx = i;
                    break;
                  }
                }
              }
              if (idx === -1) return prev;
              const target = prev[idx];
              const prevEval: EvalScore =
                idx > 0 && prev[idx - 1].evalAfter ? prev[idx - 1].evalAfter! : { type: 'cp', value: 20 };
              const isBook =
                activeVariant === 'standard' &&
                idx < 6 &&
                Boolean(detectOpening(prev.slice(0, idx + 1).map((x) => x.san)));
              const classified = classifyMove({
                evalBefore: prevEval,
                evalAfter: score,
                mover: target.color,
                playedUci: target.uci,
                bestUci: target.bestMoveBefore,
                isBook,
                isSacrifice: isTacticalPieceSacrifice(target),
              });
              // Skip state update when eval and classification are unchanged
              if (
                scoresEqual(target.evalAfter, score) &&
                target.classification === classified.classification &&
                target.accuracy === classified.accuracy
              ) {
                return prev;
              }
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
    viewPly,
    viewedBoardChess,
    activeVariant,
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
    if (latestTurn !== botColor) return;

    let cancelled = false;
    let botMoveTimer: number | null = null;
    setIsBotThinking(true);
    const opponent = ensureOpponent();
    const startedAt = performance.now();

    opponent
      .computeMove(latestFen, activeLevel, false)
      .then((uciMove) => {
        if (cancelled || !uciMove || uciMove.length < 4) return;
        const elapsed = performance.now() - startedAt;
        const minDelay = Math.max(0, 340 - elapsed);

        botMoveTimer = window.setTimeout(() => {
          botMoveTimer = null;
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
      if (botMoveTimer !== null) {
        window.clearTimeout(botMoveTimer);
      }
      opponent.cancel();
      setIsBotThinking(false);
    };
  }, [
    appState,
    activeMode,
    termination.isOver,
    isViewingLatest,
    humanColor,
    latestTurn,
    latestFen,
    activeLevel,
    ensureOpponent,
    applyMove,
  ]);

  // Active Match Timestamp-Based Clock (starts immediately upon entering 'playing')
  const hasTimedClock = whiteClock !== null && blackClock !== null;
  const shouldClockRun =
    appState === 'playing' && activeMode !== 'analysis' && !termination.isOver && hasTimedClock;
  const activeClockTurn = latestTurn;

  useEffect(() => {
    if (!shouldClockRun) {
      if (clockRef.current && clockRef.current.turnStartedAtMs !== null) {
        const paused = pauseClockState(clockRef.current, Date.now());
        clockRef.current = paused;
        setWhiteClock(quantizeClockDisplay(paused.w));
        setBlackClock(quantizeClockDisplay(paused.b));
      }
      return;
    }

    const now = Date.now();
    if (!clockRef.current) {
      clockRef.current = {
        w: whiteClock ?? 600,
        b: blackClock ?? 600,
        activeTurn: activeClockTurn,
        turnStartedAtMs: now,
      };
    } else if (
      clockRef.current.turnStartedAtMs === null ||
      clockRef.current.activeTurn !== activeClockTurn
    ) {
      clockRef.current = resumeClockState(clockRef.current, activeClockTurn, now);
    }

    let timer: number | null = null;
    const syncFromTimestamp = () => {
      const snap = clockRef.current;
      if (!snap) return;
      const tickNow = Date.now();
      const rem = getClockRemaining(snap, tickNow);
      const nextW = quantizeClockDisplay(rem.w);
      const nextB = quantizeClockDisplay(rem.b);
      setWhiteClock((prev) => (prev === nextW ? prev : nextW));
      setBlackClock((prev) => (prev === nextB ? prev : nextB));
      if (rem.expiredColor) {
        if (timer !== null) {
          window.clearInterval(timer);
          timer = null;
        }
        clockRef.current = pauseClockState(snap, tickNow);
        setTimeoutLoser(rem.expiredColor);
        playChessSound('gameover', preferences.muted);
      }
    };

    timer = window.setInterval(syncFromTimestamp, 100);
    return () => {
      if (timer !== null) window.clearInterval(timer);
    };
  }, [shouldClockRun, activeClockTurn, preferences.muted]);

  // Full Match Rating / Game Review pass across explicit or current moves
  const runMatchRatingPass = useCallback(
    async (
      targetInitialFen: string,
      targetMoves: MoveRecord[],
      matchIdToUpdate?: string | null,
      isStandardVariant = activeVariant === 'standard'
    ) => {
      if (targetMoves.length === 0) return;
      reviewRunIdRef.current += 1;
      const runId = reviewRunIdRef.current;

      setIsReviewing(true);
      setReviewProgress(0);
      setRightTab('rating');

      const analyzer = ensureAnalyzer();
      const reviewed: MoveRecord[] = [...targetMoves];

      try {
        let prevResult = await analyzer.evaluateOnce(targetInitialFen, 10, {
          chess960: false,
          engineFen: targetInitialFen,
        });
        if (reviewRunIdRef.current !== runId) return;

        for (let i = 0; i < reviewed.length; i++) {
          const m = reviewed[i];
          const afterResult = await analyzer.evaluateOnce(m.fenAfter, 10, {
            chess960: false,
            engineFen: m.fenAfter,
          });
          if (reviewRunIdRef.current !== runId) return;

          const isBook =
            isStandardVariant &&
            i < 6 &&
            Boolean(detectOpening(reviewed.slice(0, i + 1).map((x) => x.san)));

          const classified = classifyMove({
            evalBefore: prevResult.score,
            evalAfter: afterResult.score,
            mover: m.color,
            playedUci: m.uci,
            bestUci: prevResult.bestMove,
            isBook,
            isSacrifice: isTacticalPieceSacrifice(m),
          });

          const cacheKey = positionKeyFromFen(m.fenAfter);
          if (evalCacheRef.current.has(cacheKey)) {
            evalCacheRef.current.delete(cacheKey);
          } else if (evalCacheRef.current.size >= MAX_EVAL_CACHE_SIZE) {
            const oldestKey = evalCacheRef.current.keys().next().value;
            if (oldestKey !== undefined) evalCacheRef.current.delete(oldestKey);
          }
          evalCacheRef.current.set(cacheKey, {
            score: afterResult.score,
            depth: 10,
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
        if (matchIdToUpdate && reviewRunIdRef.current === runId) {
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
        if (reviewRunIdRef.current === runId) {
          setIsReviewing(false);
        }
      }
    },
    [ensureAnalyzer, activeVariant]
  );

  const handleRunGameReview = useCallback(() => {
    if (moves.length === 0 || isReviewing) return;
    runMatchRatingPass(initialFen, moves, activeMatchId, activeVariant === 'standard');
  }, [moves, isReviewing, runMatchRatingPass, initialFen, activeMatchId, activeVariant]);

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
    cancelOngoingReview();
    opponentRef.current?.cancel();
    setIsBotThinking(false);
    setResignedBy(null);
    setTimeoutLoser(null);
    setAgreedDraw(false);
    setHintArrow(null);

    const popCount = activeMode === 'stockfish' && latestTurn === humanColor && moves.length >= 2 ? 2 : 1;
    const nextMoves = moves.slice(0, Math.max(0, moves.length - popCount));
    setMoves(nextMoves);
    setViewPly(nextMoves.length);
    if (clockRef.current && activeMode !== 'analysis') {
      const nextFen = nextMoves.length > 0 ? nextMoves[nextMoves.length - 1].fenAfter : initialFen;
      const nextTurn: Color = nextFen.split(' ')[1] === 'b' ? 'b' : 'w';
      clockRef.current = resumeClockState(clockRef.current, nextTurn, Date.now());
      setWhiteClock(quantizeClockDisplay(clockRef.current.w));
      setBlackClock(quantizeClockDisplay(clockRef.current.b));
    }
    if (appState === 'gameover') {
      setAppState('playing');
    }
  }, [moves, activeMode, latestTurn, humanColor, appState, initialFen, cancelOngoingReview]);

  const handleImportPgnOrFen = useCallback(
    (text: string, label?: string, autoRate = false): { ok: boolean; error?: string } => {
      const parsed = parsePgnOrFen(text);
      if (!parsed.ok) return parsed;

      cancelOngoingReview();
      opponentRef.current?.cancel();
      analyzerRef.current?.stop();
      setIsBotThinking(false);

      const importedVariant: MatchVariant =
        parsed.variant === 'Chess960'
          ? 'chess960'
          : parsed.initialFen !== INITIAL_FEN
            ? 'custom'
            : 'standard';

      setActiveMode('analysis');
      setActiveVariant(importedVariant);
      setActiveChess960Id(null);
      setInitialFen(parsed.initialFen);
      setPositionLabel(label ?? (parsed.initialFen !== INITIAL_FEN ? 'Custom FEN Position' : 'Imported Match'));
      setActiveMatchId(null);
      setMoves(parsed.moves);
      setViewPly(parsed.moves.length);
      setResignedBy(null);
      setTimeoutLoser(null);
      setAgreedDraw(false);
      clockRef.current = null;
      setWhiteClock(null);
      setBlackClock(null);
      setHintArrow(null);
      setShowBestArrow(true);
      displayedEvalRef.current = { fen: null, score: null, depth: 0 };
      setAppState('playing');
      setRightTab(autoRate ? 'rating' : 'moves');

      if (autoRate && parsed.moves.length > 0) {
        const isStd = importedVariant === 'standard';
        delayedReviewTimerRef.current = window.setTimeout(() => {
          delayedReviewTimerRef.current = null;
          runMatchRatingPass(parsed.initialFen, parsed.moves, null, isStd);
        }, 50);
      }

      return { ok: true };
    },
    [runMatchRatingPass, cancelOngoingReview]
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
        if (e.key === 'Escape' && appState === 'gameover' && !gameOverDismissed) {
          setGameOverDismissed(true);
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
  }, [
    appState,
    gameOverDismissed,
    moves.length,
    showNewMatchModal,
    handleRequestHint,
    updatePreferences,
    preferences.muted,
  ]);

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

  const viewedLastMove = viewPly > 0 ? moves[viewPly - 1] : null;
  const matchingEngineLine =
    engineAnalysis && engineAnalysis.fen === viewedFen ? engineAnalysis.lines[0] ?? null : null;

  const stabilizedEval = useMemo(() => {
    if (appState === 'title') {
      return {
        score: null,
        depth: 0,
        isStabilizing: false,
        nextDisplayed: displayedEvalRef.current,
      };
    }
    return stabilizeEvaluation({
      fen: viewedFen,
      incomingScore: matchingEngineLine?.score ?? null,
      incomingDepth: matchingEngineLine ? engineAnalysis?.depth ?? matchingEngineLine.depth : 0,
      isSearching: Boolean(engineAnalysis && engineAnalysis.fen === viewedFen && engineAnalysis.isSearching),
      storedMoveEval: viewedLastMove?.evalAfter ?? null,
      cache: evalCacheRef.current,
      displayed: displayedEvalRef.current,
    });
  }, [appState, viewedFen, matchingEngineLine, engineAnalysis, viewedLastMove?.evalAfter]);

  useEffect(() => {
    displayedEvalRef.current = stabilizedEval.nextDisplayed;
  }, [stabilizedEval.nextDisplayed]);

  const showMoveEvaluationBadges = activeMode === 'analysis';

  const boardLastMove = useMemo(
    () =>
      viewedLastMove
        ? {
            from: viewedLastMove.from,
            to: viewedLastMove.to,
            classification: showMoveEvaluationBadges ? viewedLastMove.classification : undefined,
          }
        : null,
    [viewedLastMove, showMoveEvaluationBadges]
  );

  const handleSelectPly = useCallback((ply: number) => {
    setViewPly(ply);
    setHintArrow(null);
  }, []);

  const handleJumpToMoveList = useCallback(() => {
    setRightTab('moves');
    document.getElementById('right-panel-dock')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleFlipBoard = useCallback(() => {
    setOrientation((o) => (o === 'w' ? 'b' : 'w'));
  }, []);

  const handleChangeMultiPv = useCallback(
    (n: number) => {
      updatePreferences({ multiPv: n });
    },
    [updatePreferences]
  );

  const handleToggleBestArrow = useCallback((val: boolean) => {
    setShowBestArrow(val);
    if (!val) setHintArrow(null);
  }, []);

  const handleOfferDraw = useCallback(() => {
    setAgreedDraw(true);
    playChessSound('gameover', preferences.muted);
  }, [preferences.muted]);

  const handleResign = useCallback(() => {
    const resigner: Color = activeMode === 'stockfish' ? humanColor : latestTurn;
    setResignedBy(resigner);
    playChessSound('gameover', preferences.muted);
  }, [activeMode, humanColor, latestTurn, preferences.muted]);

  const handleOpenNewMatchModal = useCallback(() => {
    setShowNewMatchModal(true);
  }, []);

  const handleImportPlain = useCallback(
    (txt: string) => handleImportPgnOrFen(txt, undefined, false),
    [handleImportPgnOrFen]
  );

  const handleImportAndRate = useCallback(
    (txt: string) => handleImportPgnOrFen(txt, 'Rated Match Review', true),
    [handleImportPgnOrFen]
  );

  const returnToHub = useCallback(
    (targetSection: HubSection) => {
      cancelOngoingReview();
      opponentRef.current?.cancel();
      analyzerRef.current?.stop();
      clockRef.current = null;
      setHubSection(targetSection);
      setAppState('title');
    },
    [cancelOngoingReview]
  );

  // Main Chess.com-style Hub (Home, Settings, Profile) before choosing a play mode
  if (appState === 'title') {
    return (
      <LanguageProvider lang={preferences.language}>
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
      </LanguageProvider>
    );
  }

  const topColor: Color = orientation === 'w' ? 'b' : 'w';
  const bottomColor: Color = orientation;

  const activeEvalScore = stabilizedEval.score;

  const canInteractWithBoard =
    appState === 'playing' &&
    (!termination.isOver || activeMode === 'analysis') &&
    (isViewingLatest || activeMode === 'analysis') &&
    !isBotThinking;

  const allowedBoardTurn: Color | 'both' = activeMode === 'stockfish' ? humanColor : 'both';

  return (
    <LanguageProvider lang={preferences.language}>
      <div className="arena-shell min-h-screen w-full bg-[var(--app-bg)] text-[var(--app-text)] flex flex-col anim-view-enter">
        {/* Compact Arena Utility Strip */}
        <div className="arena-topbar w-full max-w-[1320px] mx-auto px-4 sm:px-6 pt-3 pb-1 flex items-center justify-between gap-4 shrink-0">
          <button
            type="button"
            onClick={() => returnToHub('home')}
            className="flex items-center gap-2.5 text-left group cursor-pointer anim-interactive min-w-0"
          >
            <AppLogoIcon iconId={preferences.appIcon} className="w-7 h-7 sm:w-8 sm:h-8 shrink-0" />
            <span className="text-sm sm:text-base font-extrabold tracking-tight text-[var(--app-text)] whitespace-nowrap">
              Crownline Chess
            </span>
            <span className="hidden sm:inline text-xs text-[var(--app-text-muted)] whitespace-nowrap truncate" data-testid="arena-mode-label">
              ·{' '}
              {activeVariant === 'custom'
                ? `${translate(preferences.language, 'modeCustomTitle')} · `
                : activeVariant === 'random'
                  ? `${
                      activeRandomStyle === 'standard'
                        ? translate(preferences.language, 'randomStyleStandardTitle')
                        : translate(preferences.language, 'randomStyleAllTitle')
                    } · `
                  : activeVariant === 'chess960'
                    ? `Chess960${activeChess960Id !== null ? ` #${activeChess960Id}` : ''} · `
                    : ''}
              {activeMode === 'stockfish'
                ? `${translate(preferences.language, 'arenaVsStockfish')} ${activeLevel.elo}`
                : activeMode === 'local'
                  ? translate(preferences.language, 'modeLocalTitle')
                  : translate(preferences.language, 'modeAnalysisTitle')}
            </span>
          </button>

          {/* Compact Utility Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              tabIndex={-1}
              aria-label={translate(preferences.language, 'navHome')}
              title={translate(preferences.language, 'navHome')}
              onClick={(e) => {
                e.currentTarget.blur();
                returnToHub('home');
              }}
              className="arena-topbar-btn w-8 h-8 rounded-md bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-[var(--app-text)] flex items-center justify-center transition-colors cursor-pointer anim-interactive"
            >
              <Home className="w-3.5 h-3.5" />
            </button>

            {(activeVariant === 'random' || activeVariant === 'chess960') && activeMode !== 'analysis' && (
              <button
                type="button"
                tabIndex={-1}
                data-testid="arena-reshuffle-btn"
                aria-label={translate(preferences.language, 'arenaReshuffleBtn')}
                title={translate(preferences.language, 'arenaReshuffleBtn')}
                onClick={(e) => {
                  e.currentTarget.blur();
                  if (activeVariant === 'chess960') {
                    startMatch({
                      ...matchSettings,
                      mode: activeMode,
                      variant: 'chess960',
                      chess960Id: null,
                      customFen: undefined,
                    });
                  } else {
                    startMatch({
                      ...matchSettings,
                      mode: activeMode,
                      variant: 'random',
                      randomStyle: activeRandomStyle,
                      customFen: undefined,
                    });
                  }
                }}
                className="arena-topbar-btn h-8 px-2.5 rounded-md bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-xs font-semibold text-[var(--app-text)] flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap anim-interactive"
              >
                <Shuffle className="w-3.5 h-3.5 text-[#9C7EE6]" />
                <span className="hidden sm:inline">{translate(preferences.language, 'arenaReshuffleBtn')}</span>
              </button>
            )}

            <button
              type="button"
              tabIndex={-1}
              aria-label={translate(preferences.language, 'newMatchTitle')}
              title={translate(preferences.language, 'newMatchTitle')}
              onClick={(e) => {
                e.currentTarget.blur();
                setShowNewMatchModal(true);
              }}
              className="arena-topbar-btn h-8 px-2.5 rounded-md bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-xs font-semibold text-[var(--app-text)] flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap anim-interactive"
            >
              <Plus className="w-3.5 h-3.5 text-[var(--app-accent)]" />
              <span className="hidden sm:inline">{translate(preferences.language, 'arenaNewBtn')}</span>
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
            className="arena-topbar-btn w-8 h-8 rounded-md bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-[var(--app-text)] flex items-center justify-center transition-colors cursor-pointer"
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
            className="arena-topbar-btn w-8 h-8 rounded-md bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-[var(--app-text)] flex items-center justify-center transition-colors cursor-pointer"
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
            className="arena-topbar-btn w-8 h-8 rounded-md bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-[var(--app-text)] flex items-center justify-center transition-colors cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            tabIndex={-1}
            disabled={appState === 'gameover'}
            aria-label="Pause match"
            title="Pause (P / Esc)"
            onClick={(e) => {
              e.currentTarget.blur();
              setAppState((s) => (s === 'paused' ? 'playing' : s === 'playing' ? 'paused' : s));
            }}
            className="arena-topbar-btn w-8 h-8 rounded-md bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] disabled:opacity-40 disabled:cursor-not-allowed text-[var(--app-text)] flex items-center justify-center transition-colors cursor-pointer"
          >
            <Pause className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Arena: Centered Chessboard + Right Dock */}
      <main className="arena-main flex-1 w-full max-w-[1320px] mx-auto px-3 sm:px-6 py-2 sm:py-3 flex flex-col lg:flex-row items-center lg:items-start justify-center gap-4 lg:gap-6">
        <section aria-label="Chessboard arena" className="arena-board-col w-full max-w-[660px] flex flex-col">
          {/* Mobile & Tablet Horizontal Move History Ribbon — stays in view with the board */}
          <MobileMoveBar
            moves={moves}
            viewPly={viewPly}
            opening={opening}
            showMoveBadges={showMoveEvaluationBadges}
            onSelectPly={handleSelectPly}
            onJumpToMoveList={handleJumpToMoveList}
          />

          <PlayerBar
            name={topColor === 'w' ? whiteName : blackName}
            subtitle={topColor === 'w' ? whiteSubtitle : blackSubtitle}
            color={topColor}
            avatarImage={
              (activeMode === 'stockfish' || activeMode === 'local') && topColor === humanColor
                ? profile.avatarImage
                : null
            }
            isActiveTurn={!termination.isOver && viewedTurn === topColor}
            isEngineThinking={activeMode === 'stockfish' && isBotThinking && topColor !== humanColor}
            capturedPieces={topColor === 'w' ? material.capturedByWhite : material.capturedByBlack}
            materialAdvantage={topColor === 'w' ? material.advantage : -material.advantage}
            showMaterialDifference={preferences.showMaterialDifference}
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
            lastMove={boardLastMove}
            engineArrows={engineArrows}
            showCoordinates={preferences.showCoordinates}
            showLegalMoves={preferences.showLegalMoves}
            showEvalBar={preferences.showEvalBar}
            evalScore={activeEvalScore}
            evalDepth={stabilizedEval.depth}
            evalStabilizing={stabilizedEval.isStabilizing}
            allowCastling={allowCastling}
            chess960Rights={null}
            onMove={applyMove}
          />

          <PlayerBar
            name={bottomColor === 'w' ? whiteName : blackName}
            subtitle={bottomColor === 'w' ? whiteSubtitle : blackSubtitle}
            color={bottomColor}
            avatarImage={
              (activeMode === 'stockfish' || activeMode === 'local') && bottomColor === humanColor
                ? profile.avatarImage
                : null
            }
            isActiveTurn={!termination.isOver && viewedTurn === bottomColor}
            isEngineThinking={activeMode === 'stockfish' && isBotThinking && bottomColor !== humanColor}
            capturedPieces={bottomColor === 'w' ? material.capturedByWhite : material.capturedByBlack}
            materialAdvantage={bottomColor === 'w' ? material.advantage : -material.advantage}
            showMaterialDifference={preferences.showMaterialDifference}
            clockSeconds={bottomColor === 'w' ? whiteClock : blackClock}
            accuracy={bottomColor === 'w' ? whiteAccuracy : blackAccuracy}
          />

          {appState === 'gameover' && gameOverDismissed && (
            <div className="mt-1.5 px-3 py-2 rounded-lg bg-[var(--app-surface)] border border-[var(--app-border-strong)] flex items-center justify-between gap-3 text-xs">
              <span className="font-bold text-[var(--app-text)] truncate">
                {termination.winner === 'draw'
                  ? translate(preferences.language, 'drawResult')
                  : termination.winner === 'w'
                    ? translate(preferences.language, 'whiteWins')
                    : translate(preferences.language, 'blackWins')}{' '}
                · <span className="font-normal text-[var(--app-text-muted)]">{termination.reason}</span>
              </span>
              <button
                type="button"
                data-testid="reopen-gameover-btn"
                onClick={() => setGameOverDismissed(false)}
                className="font-bold text-[var(--app-accent)] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
              >
                {translate(preferences.language, 'showResultBanner')}
              </button>
            </div>
          )}

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
          showMoveBadges={showMoveEvaluationBadges}
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
          onChangeMultiPv={handleChangeMultiPv}
          analysisDepth={preferences.analysisDepth}
          showBestArrow={showBestArrow}
          onToggleBestArrow={handleToggleBestArrow}
          isGameOver={termination.isOver}
          isReviewing={isReviewing}
          reviewProgress={reviewProgress}
          onSelectPly={handleSelectPly}
          onFlipBoard={handleFlipBoard}
          onRequestHint={handleRequestHint}
          onTakeback={handleTakeback}
          onOfferDraw={handleOfferDraw}
          onResign={handleResign}
          onNewMatch={handleOpenNewMatchModal}
          onRunGameReview={handleRunGameReview}
          onPlayEngineMove={handlePlayEngineMove}
          onImportPgnOrFen={handleImportPlain}
          onImportAndRatePgn={handleImportAndRate}
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
          whiteAvatarImage={
            (activeMode === 'stockfish' || activeMode === 'local') && humanColor === 'w'
              ? profile.avatarImage
              : null
          }
          blackAvatarImage={
            (activeMode === 'stockfish' || activeMode === 'local') && humanColor === 'b'
              ? profile.avatarImage
              : null
          }
          moves={moves}
          finalFen={latestFen}
          onAnalysis={() => {
            setGameOverDismissed(true);
            clockRef.current = null;
            setWhiteClock(null);
            setBlackClock(null);
            setActiveMode('analysis');
            setAppState('playing');
            setShowBestArrow(true);
            setRightTab('rating');
            if (moves.length > 0) {
              handleRunGameReview();
            }
          }}
          onNewMatch={() => {
            setGameOverDismissed(true);
            setShowNewMatchModal(true);
          }}
          onReturnHome={() => returnToHub('home')}
          onDismiss={() => setGameOverDismissed(true)}
        />
      )}

        {showNewMatchModal && (
          <NewMatchModal
            settings={matchSettings}
            onChangeSettings={setMatchSettings}
            onConfirm={() =>
              startMatch({
                ...matchSettings,
                chess960Id: matchSettings.variant === 'chess960' ? null : matchSettings.chess960Id,
              })
            }
            onCancel={() => setShowNewMatchModal(false)}
          />
        )}
      </div>
    </LanguageProvider>
  );
}

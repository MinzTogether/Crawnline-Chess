import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  type StorageWriteResult,
  type UserProfile,
} from './types/preferences';
import { StockfishAnalyzer, StockfishOpponent } from './engine/stockfishService';
import { buildMatchRatingReport } from './engine/matchRating';
import {
  positionKeyFromFen,
  stabilizeEvaluation,
  writeCachedEval,
  type CachedEvalEntry,
} from './engine/evalStabilizer';
import { calculateAverageAccuracy, classifyMove } from './engine/uciParser';
import {
  applyRuleMove,
  buildChessWithHistory,
  buildPgn,
  evaluateGameTermination,
  getMaterialSummary,
  hasThreefoldRepetitionInHistory,
  isTacticalPieceSacrifice,
  parsePgnOrFen,
  stripCastlingRights,
} from './game/chessLogic';
import {
  checkClockBeforeMove,
  commitMoveClock,
  createClockState,
  getClockRemaining,
  pauseClockState,
  quantizeClockDisplay,
  resumeClockState,
  type ClockState,
} from './game/clock';
import { executeMatchReviewPass } from './game/matchReview';
import { generateRandomChessFen, generateStandardRandomFen } from './game/customPosition';
import {
  applyChess960Move,
  canCastleChess960,
  createChess960Position,
  toShredderFen,
  type Chess960CastlingRights,
} from './game/chess960';
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

function resolveMoveSoundKind(flags: {
  gameEnded: boolean;
  isCheck: boolean;
  isPromotion: boolean;
  isCastle: boolean;
  isCapture: boolean;
}): 'gameover' | 'check' | 'promote' | 'castle' | 'capture' | 'move' {
  if (flags.gameEnded) return 'gameover';
  if (flags.isCheck) return 'check';
  if (flags.isPromotion) return 'promote';
  if (flags.isCastle) return 'castle';
  if (flags.isCapture) return 'capture';
  return 'move';
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
  // Incremented only when move history topology changes (new match, move, takeback, import),
  // decoupling expensive chess history/termination/opening/material/PGN memos from evalAfter ticks.
  const [historyVersion, setHistoryVersion] = useState<number>(0);
  const [viewPly, setViewPly] = useState<number>(0);
  const [isDocumentHidden, setIsDocumentHidden] = useState<boolean>(
    () => typeof document !== 'undefined' && document.visibilityState === 'hidden'
  );
  const [humanColor, setHumanColor] = useState<Color>('w');
  const [orientation, setOrientation] = useState<Color>('w');
  const [activeMode, setActiveMode] = useState<GameMode>('stockfish');
  const [activeVariant, setActiveVariant] = useState<MatchVariant>('standard');
  const [activeRandomStyle, setActiveRandomStyle] = useState<RandomChessStyle>('all');
  const [activeChess960Id, setActiveChess960Id] = useState<number | null>(null);
  const [initialChess960Rights, setInitialChess960Rights] = useState<Chess960CastlingRights | null>(null);
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
  const [reviewError, setReviewError] = useState<string | null>(null);

  const analyzerRef = useRef<StockfishAnalyzer | null>(null);
  const opponentRef = useRef<StockfishOpponent | null>(null);
  const latestAnalysisRef = useRef<EngineAnalysis | null>(null);
  const archivedMatchRef = useRef<string | null>(null);
  const reviewRunIdRef = useRef(0);
  const isReviewingRef = useRef(false);
  const matchSessionIdRef = useRef(0);
  const evalCacheRef = useRef<Map<string, CachedEvalEntry>>(new Map());
  const displayedEvalRef = useRef<{ fen: string | null; score: EvalScore | null; depth: number }>({
    fen: null,
    score: null,
    depth: 0,
  });

  const prefsMountedRef = useRef(false);
  const matchesMountedRef = useRef(false);
  const pendingPrefsSaveRef = useRef<AppPreferences | null>(null);
  const prefsSaveTimerRef = useRef<number | null>(null);
  const movesRef = useRef<MoveRecord[]>(moves);
  movesRef.current = moves;
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const mutedRef = useRef(preferences.muted);
  mutedRef.current = preferences.muted;
  const clockDisplayRef = useRef<{ w: number | null; b: number | null }>({
    w: whiteClock,
    b: blackClock,
  });
  clockDisplayRef.current = { w: whiteClock, b: blackClock };

  const flushPendingPreferencesSave = useCallback(() => {
    if (prefsSaveTimerRef.current !== null) {
      window.clearTimeout(prefsSaveTimerRef.current);
      prefsSaveTimerRef.current = null;
    }
    if (pendingPrefsSaveRef.current) {
      const toSave = pendingPrefsSaveRef.current;
      pendingPrefsSaveRef.current = null;
      savePreferences(toSave);
    }
  }, []);

  // Apply App Theme, Advanced Animation tokens, Language attribute & Browser Favicon whenever preferences change.
  // Never overwrite LocalStorage on initial mount so corrupted/unreadable stored data is preserved untouched.
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

    if (prefsMountedRef.current) {
      // Debounce synchronous LocalStorage writes while keeping DOM visual feedback immediate
      pendingPrefsSaveRef.current = preferences;
      if (prefsSaveTimerRef.current !== null) {
        window.clearTimeout(prefsSaveTimerRef.current);
      }
      prefsSaveTimerRef.current = window.setTimeout(() => {
        prefsSaveTimerRef.current = null;
        if (pendingPrefsSaveRef.current) {
          const toSave = pendingPrefsSaveRef.current;
          pendingPrefsSaveRef.current = null;
          savePreferences(toSave);
        }
      }, 150);
    } else {
      prefsMountedRef.current = true;
    }
  }, [preferences]);

  useEffect(() => {
    if (matchesMountedRef.current) {
      saveMatches(savedMatches);
    } else {
      matchesMountedRef.current = true;
    }
  }, [savedMatches]);

  useEffect(() => {
    latestAnalysisRef.current = engineAnalysis;
  }, [engineAnalysis]);

  useEffect(() => {
    document.body.dataset.state = appState;
  }, [appState]);

  const cancelOngoingReview = useCallback(() => {
    reviewRunIdRef.current += 1;
    isReviewingRef.current = false;
    analyzerRef.current?.stop();
    setIsReviewing(false);
    setReviewProgress(0);
    setReviewError(null);
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const hidden = document.visibilityState === 'hidden';
      setIsDocumentHidden(hidden);
      if (hidden) {
        flushPendingPreferencesSave();
      }
    };
    const handlePageHide = () => {
      flushPendingPreferencesSave();
      analyzerRef.current?.terminate();
      opponentRef.current?.terminate();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      flushPendingPreferencesSave();
      reviewRunIdRef.current += 1;
      isReviewingRef.current = false;
      matchSessionIdRef.current += 1;
      analyzerRef.current?.terminate();
      opponentRef.current?.terminate();
    };
  }, [flushPendingPreferencesSave]);

  const updatePreferences = useCallback((patch: Partial<AppPreferences>) => {
    setPreferences((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateProfile = useCallback((patch: Partial<UserProfile>): StorageWriteResult => {
    const nextProfile: UserProfile = { ...profileRef.current, ...patch };
    const writeResult = saveProfile(nextProfile);
    // If an avatar upload specifically overflows browser storage quota, keep the previous valid avatar
    // intact rather than leaving the user with an unsaved photo that vanishes on reload.
    if (!writeResult.ok && writeResult.error === 'quota_exceeded' && patch.avatarImage) {
      return writeResult;
    }
    profileRef.current = nextProfile;
    setProfile(nextProfile);
    return writeResult;
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

  const initialEngineFen = useMemo(
    () => (isChess960 && initialChess960Rights ? toShredderFen(initialFen, initialChess960Rights) : initialFen),
    [isChess960, initialFen, initialChess960Rights]
  );

  const viewedChess960Rights = useMemo<Chess960CastlingRights | null>(() => {
    void historyVersion;
    if (!isChess960 || !initialChess960Rights) return null;
    if (viewPly === 0) return initialChess960Rights;
    return movesRef.current[viewPly - 1]?.castlingRights960 ?? initialChess960Rights;
  }, [isChess960, initialChess960Rights, viewPly, historyVersion]);

  const latestChess960Rights = useMemo<Chess960CastlingRights | null>(() => {
    void historyVersion;
    if (!isChess960 || !initialChess960Rights) return null;
    const currentMoves = movesRef.current;
    if (currentMoves.length === 0) return initialChess960Rights;
    return currentMoves[currentMoves.length - 1]?.castlingRights960 ?? initialChess960Rights;
  }, [isChess960, initialChess960Rights, historyVersion]);

  const viewedEngineFen = useMemo(() => {
    void historyVersion;
    if (!isChess960) return viewedFen;
    if (viewPly === 0) return initialEngineFen;
    return (
      movesRef.current[viewPly - 1]?.engineFenAfter ??
      (viewedChess960Rights ? toShredderFen(viewedFen, viewedChess960Rights) : viewedFen)
    );
  }, [isChess960, viewPly, initialEngineFen, historyVersion, viewedChess960Rights, viewedFen]);

  const latestEngineFen = useMemo(() => {
    void historyVersion;
    if (!isChess960) return latestFen;
    const currentMoves = movesRef.current;
    if (currentMoves.length === 0) return initialEngineFen;
    return (
      currentMoves[currentMoves.length - 1]?.engineFenAfter ??
      (latestChess960Rights ? toShredderFen(latestFen, latestChess960Rights) : latestFen)
    );
  }, [isChess960, historyVersion, initialEngineFen, latestChess960Rights, latestFen]);

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

  const latestChess = useMemo(() => {
    void historyVersion;
    return buildChessWithHistory(initialFen, movesRef.current, allowCastling);
  }, [initialFen, historyVersion, allowCastling]);

  const termination = useMemo(() => {
    void historyVersion;
    return evaluateGameTermination({
      fen: latestFen,
      initialFen,
      initialEngineFen,
      moves: movesRef.current,
      chess: latestChess,
      allowCastling,
      chess960Rights: latestChess960Rights,
      timeoutLoser,
      resignedBy,
      agreedDraw,
    });
  }, [
    latestFen,
    initialFen,
    initialEngineFen,
    historyVersion,
    latestChess,
    allowCastling,
    latestChess960Rights,
    timeoutLoser,
    resignedBy,
    agreedDraw,
  ]);

  const opening = useMemo(() => {
    void historyVersion;
    if (activeVariant !== 'standard') return null;
    const sanList = movesRef.current.slice(0, viewPly).map((m) => m.san);
    return detectOpening(sanList);
  }, [historyVersion, viewPly, activeVariant]);

  const fullGameOpening = useMemo(() => {
    void historyVersion;
    return activeVariant === 'standard' ? detectOpening(movesRef.current.map((m) => m.san)) : null;
  }, [historyVersion, activeVariant]);

  const material = useMemo(() => {
    void historyVersion;
    const currentMoves = movesRef.current;
    return getMaterialSummary(viewedFen, {
      initialFen,
      moves: viewPly === currentMoves.length ? currentMoves : currentMoves.slice(0, viewPly),
    });
  }, [viewedFen, initialFen, historyVersion, viewPly]);

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

  const pgnText = useMemo(() => {
    void historyVersion;
    return buildPgn({
      initialFen,
      moves: movesRef.current,
      whiteName,
      blackName,
      result: termination.resultString,
      variant: isChess960 ? 'Chess960' : undefined,
      pgnInitialFen: isChess960 ? initialEngineFen : initialFen,
    });
  }, [initialFen, initialEngineFen, isChess960, historyVersion, whiteName, blackName, termination.resultString]);

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
      let resolved960Rights: Chess960CastlingRights | null = null;

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
        resolved960Rights = pos960.castlingRights;
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

      // Random and Custom modes strip castling rights; Standard uses standard FEN rights;
      // Chess960 tracks full Shredder-FEN castling rights via initialChess960Rights.
      if (variant === 'random' || variant === 'custom') {
        resolvedFen = stripCastlingRights(resolvedFen, 'both');
      }

      matchSessionIdRef.current += 1;
      cancelOngoingReview();
      if (cfg.mode === 'stockfish') {
        opponentRef.current?.cancel();
      } else {
        opponentRef.current?.terminate();
      }
      analyzerRef.current?.stop();

      setActiveMode(cfg.mode);
      setActiveVariant(variant);
      setActiveRandomStyle(resolvedRandomStyle);
      setActiveChess960Id(resolved960Id);
      setInitialChess960Rights(resolved960Rights);
      setHumanColor(chosenSide);
      setOrientation(chosenSide);
      setInitialFen(resolvedFen);
      setPositionLabel(resolvedLabel);
      setActiveMatchId(newMatchId);
      archivedMatchRef.current = null;
      setMoves([]);
      setHistoryVersion((v) => v + 1);
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
        fen:
          variant === 'chess960' && resolved960Rights
            ? toShredderFen(resolvedFen, resolved960Rights)
            : resolvedFen,
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

  // Keep mutable move context in a ref so applyMove keeps a stable identity across evalAfter ticks,
  // preserving React.memo(ChessBoard) and preventing bot-turn effect teardowns mid-search.
  const moveContextRef = useRef({
    appState,
    activeMode,
    allowCastling,
    isChess960,
    initialChess960Rights,
    initialEngineFen,
    isGameOver: termination.isOver,
    isViewingLatest,
    moves,
    viewPly,
    initialFen,
    incrementSec,
    muted: preferences.muted,
    isReviewing,
  });
  moveContextRef.current = {
    appState,
    activeMode,
    allowCastling,
    isChess960,
    initialChess960Rights,
    initialEngineFen,
    isGameOver: termination.isOver,
    isViewingLatest,
    moves,
    viewPly,
    initialFen,
    incrementSec,
    muted: preferences.muted,
    isReviewing,
  };

  // Core move application
  const applyMove = useCallback(
    (from: Square, to: Square, promotion?: PieceSymbol): boolean => {
      const ctx = moveContextRef.current;
      if (ctx.appState !== 'playing' && ctx.activeMode !== 'analysis') return false;
      if (ctx.isGameOver && ctx.activeMode !== 'analysis') return false;

      const baseMoves = ctx.isViewingLatest ? ctx.moves : ctx.moves.slice(0, ctx.viewPly);
      const baseFen = baseMoves.length > 0 ? baseMoves[baseMoves.length - 1].fenAfter : ctx.initialFen;
      const movingColor: Color = baseFen.split(' ')[1] === 'b' ? 'b' : 'w';
      const moveNowMs = Date.now();

      // Check clock BEFORE applying or committing the move so flagged players cannot play after timeout
      if (ctx.activeMode !== 'analysis' && clockRef.current !== null) {
        const preCheck = checkClockBeforeMove(clockRef.current, movingColor, moveNowMs);
        if (!preCheck.allowed) {
          clockRef.current = preCheck.nextState;
          setWhiteClock(quantizeClockDisplay(preCheck.nextState.w));
          setBlackClock(quantizeClockDisplay(preCheck.nextState.b));
          setTimeoutLoser(preCheck.expiredColor);
          playChessSound('gameover', ctx.muted);
          return false;
        }
      }

      const prevAnalysis = latestAnalysisRef.current;
      const bestBefore = prevAnalysis && prevAnalysis.fen === baseFen ? prevAnalysis.bestMoveUci ?? undefined : undefined;
      const evalBefore = prevAnalysis && prevAnalysis.fen === baseFen ? prevAnalysis.lines[0]?.score : undefined;

      let newRecord: MoveRecord;
      let movedColor: Color;
      let gameEnded: boolean;
      let soundKind: 'gameover' | 'check' | 'promote' | 'castle' | 'capture' | 'move';

      if (ctx.isChess960 && ctx.initialChess960Rights) {
        const baseRights =
          baseMoves.length > 0
            ? baseMoves[baseMoves.length - 1].castlingRights960 ?? ctx.initialChess960Rights
            : ctx.initialChess960Rights;
        const moveNumber =
          parseInt(baseFen.split(' ')[5] || '1', 10) || Math.floor(baseMoves.length / 2) + 1;
        const applied960 = applyChess960Move(baseFen, baseRights, from, to, promotion);
        if (!applied960) {
          playChessSound('illegal', ctx.muted);
          return false;
        }
        movedColor = applied960.color;
        newRecord = {
          ply: baseMoves.length + 1,
          moveNumber,
          color: applied960.color,
          san: applied960.san,
          uci: applied960.uci,
          from: applied960.from,
          to: applied960.to,
          piece: applied960.piece,
          captured: applied960.captured,
          promotion: applied960.promotion,
          fenBefore: baseFen,
          fenAfter: applied960.fenAfter,
          engineFenAfter: applied960.shredderFenAfter,
          castlingRights960: applied960.castlingRightsAfter,
          bestMoveBefore: bestBefore,
        };
        const isThreefold = hasThreefoldRepetitionInHistory(ctx.initialEngineFen, [...baseMoves, newRecord]);
        gameEnded = applied960.isCheckmate || applied960.isDraw || isThreefold;
        soundKind = resolveMoveSoundKind({
          gameEnded,
          isCheck: applied960.isCheck,
          isPromotion: applied960.isPromotion,
          isCastle: applied960.isCastle,
          isCapture: applied960.isCapture,
        });
      } else {
        const applied = applyRuleMove({
          initialFen: ctx.initialFen,
          moves: baseMoves,
          from,
          to,
          promotion,
          allowCastling: ctx.allowCastling,
        });

        if (!applied) {
          playChessSound('illegal', ctx.muted);
          return false;
        }

        movedColor = applied.color;
        gameEnded = applied.isCheckmate || applied.isDraw;
        newRecord = {
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
        soundKind = resolveMoveSoundKind({
          gameEnded,
          isCheck: applied.isCheck,
          isPromotion: applied.isPromotion,
          isCastle: applied.isCastle,
          isCapture: applied.isCapture,
        });
      }

      // Compute & verify final clock commit BEFORE mutating moves state
      let committedClock: ClockState | null = null;
      if (ctx.activeMode !== 'analysis' && clockRef.current !== null) {
        const nextTurn: Color = movedColor === 'w' ? 'b' : 'w';
        const { nextState, expiredColor } = commitMoveClock(
          clockRef.current,
          movedColor,
          nextTurn,
          ctx.incrementSec,
          moveNowMs,
          gameEnded
        );
        if (expiredColor) {
          clockRef.current = nextState;
          setWhiteClock(quantizeClockDisplay(nextState.w));
          setBlackClock(quantizeClockDisplay(nextState.b));
          setTimeoutLoser(expiredColor);
          playChessSound('gameover', ctx.muted);
          return false;
        }
        committedClock = nextState;
      }

      const nextMoves = [...baseMoves, newRecord];
      if (evalBefore && nextMoves.length >= 2 && !nextMoves[nextMoves.length - 2].evalAfter) {
        nextMoves[nextMoves.length - 2] = {
          ...nextMoves[nextMoves.length - 2],
          evalAfter: evalBefore,
        };
      }

      if (ctx.isReviewing || isReviewingRef.current) {
        cancelOngoingReview();
      }
      if (committedClock !== null) {
        clockRef.current = committedClock;
        setWhiteClock(quantizeClockDisplay(committedClock.w));
        setBlackClock(quantizeClockDisplay(committedClock.b));
      }
      setMoves(nextMoves);
      setHistoryVersion((v) => v + 1);
      setViewPly(nextMoves.length);
      setHintArrow(null);

      playChessSound(soundKind, ctx.muted);
      return true;
    },
    [cancelOngoingReview]
  );

  // Trigger game-over state and archive completed match to Profile history
  useEffect(() => {
    if (appState === 'playing' && termination.isOver && activeMode !== 'analysis') {
      setAppState('gameover');
      setGameOverDismissed(false);
      opponentRef.current?.terminate();
      setIsBotThinking(false);

      if (moves.length >= 2 && activeMatchId && archivedMatchRef.current !== activeMatchId) {
        archivedMatchRef.current = activeMatchId;
        const report = buildMatchRatingReport(moves, { result: termination.resultString });
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
    if (appState === 'title') {
      analyzerRef.current?.terminate();
      return;
    }
    if (isReviewing) {
      // Game Review owns the analyzer worker; do not stop or terminate it here.
      return;
    }
    if (!engineEnabled) {
      analyzerRef.current?.terminate();
      setEngineAnalysis((prev) => (prev ? { ...prev, isSearching: false } : prev));
      return;
    }
    if (appState === 'paused' || isDocumentHidden) {
      // Suspend realtime Stockfish CPU usage while paused or backgrounded; worker stays warm for instant resume.
      analyzerRef.current?.stop();
      setEngineAnalysis((prev) => (prev && prev.isSearching ? { ...prev, isSearching: false } : prev));
      return;
    }

    let cancelled = false;
    const sessionId = matchSessionIdRef.current;
    const analyzer = ensureAnalyzer();

    const canViewedCastle960 =
      isChess960 &&
      viewedChess960Rights !== null &&
      (canCastleChess960(viewedFen, viewedChess960Rights, 'k').legal ||
        canCastleChess960(viewedFen, viewedChess960Rights, 'q').legal);
    const isViewedPositionOver =
      viewedBoardChess.isGameOver() && !(viewedBoardChess.isStalemate() && canViewedCastle960);

    if (isViewedPositionOver) {
      analyzerRef.current?.stop();
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
          chess960: isChess960,
          engineFen: viewedEngineFen,
          chess960Rights: viewedChess960Rights ?? undefined,
        },
        (snapshot) => {
          if (cancelled || isReviewingRef.current || matchSessionIdRef.current !== sessionId) return;
          setEngineAnalysis(snapshot);

          if (snapshot.depth >= 10 && snapshot.lines[0]?.score) {
            const score = snapshot.lines[0].score;
            setMoves((prev) => {
              if (isReviewingRef.current || matchSessionIdRef.current !== sessionId) return prev;
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
        },
        () => {
          if (cancelled || isReviewingRef.current || matchSessionIdRef.current !== sessionId) return;
          // Engine fault: stop spinning indicator without injecting any fake 0.00 evaluation
          setEngineAnalysis((prev) => (prev ? { ...prev, isSearching: false } : prev));
        }
      )
      .catch(() => {
        if (cancelled || isReviewingRef.current || matchSessionIdRef.current !== sessionId) return;
        setEngineAnalysis((prev) => (prev ? { ...prev, isSearching: false } : prev));
      });

    return () => {
      cancelled = true;
    };
  }, [
    appState,
    engineEnabled,
    isReviewing,
    isDocumentHidden,
    viewedFen,
    viewedEngineFen,
    viewedChess960Rights,
    isChess960,
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
      .computeMove(latestEngineFen, activeLevel, isChess960)
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
    latestEngineFen,
    isChess960,
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
        w: clockDisplayRef.current.w ?? 600,
        b: clockDisplayRef.current.b ?? 600,
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
        playChessSound('gameover', mutedRef.current);
      }
    };

    timer = window.setInterval(syncFromTimestamp, 100);
    return () => {
      if (timer !== null) window.clearInterval(timer);
    };
  }, [shouldClockRun, activeClockTurn]);

  // Full Match Rating / Game Review pass across explicit or current moves
  const runMatchRatingPass = useCallback(
    async (
      targetInitialFen: string,
      targetMoves: MoveRecord[],
      matchIdToUpdate?: string | null,
      targetVariant: MatchVariant = activeVariant,
      targetInitialRights: Chess960CastlingRights | null = initialChess960Rights
    ) => {
      if (targetMoves.length === 0) return;
      reviewRunIdRef.current += 1;
      const runId = reviewRunIdRef.current;
      isReviewingRef.current = true;

      setIsReviewing(true);
      setReviewProgress(0);
      setReviewError(null);
      setRightTab('rating');
      setEngineAnalysis((prev) => (prev ? { ...prev, isSearching: false } : prev));

      const targetIsStandard = targetVariant === 'standard';
      const targetIsChess960 = targetVariant === 'chess960';
      const targetInitialEngineFen =
        targetIsChess960 && targetInitialRights
          ? toShredderFen(targetInitialFen, targetInitialRights)
          : targetInitialFen;

      const analyzer = ensureAnalyzer();
      // Cancel any in-flight realtime search or prior review job before starting this review pass
      analyzer.stop();

      try {
        const result = await executeMatchReviewPass({
          initialFen: targetInitialFen,
          initialEngineFen: targetInitialEngineFen,
          moves: targetMoves,
          isStandardVariant: targetIsStandard,
          depth: 10,
          evaluatePosition: (fen, depth, engineFen) =>
            analyzer.evaluateOnce(fen, depth, {
              chess960: targetIsChess960,
              engineFen: engineFen ?? fen,
            }),
          isCancelled: () => reviewRunIdRef.current !== runId,
          onMoveReviewed: ({ reviewedMoves, progressPct, engineFen, score, depth }) => {
            if (reviewRunIdRef.current !== runId) return;
            writeCachedEval(evalCacheRef.current, positionKeyFromFen(engineFen), { score, depth });
            setReviewProgress(progressPct);
            setMoves(reviewedMoves);
          },
        });

        if (reviewRunIdRef.current !== runId) return;

        if (result.error) {
          setReviewError(result.error);
          setReviewProgress(0);
          return;
        }

        // Update saved match entry with exact Stockfish accuracy & Estimated Game Elo
        if (result.completed && matchIdToUpdate) {
          setSavedMatches((prev) =>
            prev.map((item) => {
              if (item.id !== matchIdToUpdate) return item;
              const report = buildMatchRatingReport(result.reviewedMoves, { result: item.result });
              return {
                ...item,
                whiteAccuracy: report.white.accuracy,
                blackAccuracy: report.black.accuracy,
                whiteGameElo: report.white.estimatedElo,
                blackGameElo: report.black.estimatedElo,
              };
            })
          );
        }
      } catch (err) {
        if (reviewRunIdRef.current === runId) {
          setReviewError(err instanceof Error ? err.message : 'Stockfish engine error');
          setReviewProgress(0);
        }
      } finally {
        if (reviewRunIdRef.current === runId) {
          isReviewingRef.current = false;
          setIsReviewing(false);
        }
      }
    },
    [ensureAnalyzer, activeVariant, initialChess960Rights]
  );

  const handleRunGameReview = useCallback(() => {
    if (moves.length === 0 || isReviewing || isReviewingRef.current) return;
    runMatchRatingPass(initialFen, moves, activeMatchId, activeVariant, initialChess960Rights);
  }, [moves, isReviewing, runMatchRatingPass, initialFen, activeMatchId, activeVariant, initialChess960Rights]);

  const handleRequestHint = useCallback(() => {
    const latestAnalysis = latestAnalysisRef.current;
    const bestUci = latestAnalysis?.bestMoveUci ?? latestAnalysis?.lines[0]?.pvUci[0];
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
  }, []);

  const handleTakeback = useCallback(() => {
    if (moves.length === 0) return;
    matchSessionIdRef.current += 1;
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
    setHistoryVersion((v) => v + 1);
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

      matchSessionIdRef.current += 1;
      cancelOngoingReview();
      opponentRef.current?.terminate();
      analyzerRef.current?.stop();
      setIsBotThinking(false);

      const importedVariant: MatchVariant =
        parsed.variant === 'Chess960'
          ? 'chess960'
          : parsed.initialFen !== INITIAL_FEN
            ? 'custom'
            : 'standard';
      const imported960Rights =
        importedVariant === 'chess960' ? parsed.initialChess960Rights ?? null : null;

      setActiveMode('analysis');
      setActiveVariant(importedVariant);
      setActiveChess960Id(null);
      setInitialChess960Rights(imported960Rights);
      setInitialFen(parsed.initialFen);
      setPositionLabel(
        label ??
          (importedVariant === 'chess960'
            ? 'Chess960 Match'
            : parsed.initialFen !== INITIAL_FEN
              ? 'Custom FEN Position'
              : 'Imported Match')
      );
      setActiveMatchId(null);
      setMoves(parsed.moves);
      setHistoryVersion((v) => v + 1);
      setViewPly(parsed.moves.length);
      setResignedBy(null);
      setTimeoutLoser(null);
      setAgreedDraw(false);
      clockRef.current = null;
      setWhiteClock(null);
      setBlackClock(null);
      setHintArrow(null);
      setShowBestArrow(true);
      setEngineAnalysis(null);
      displayedEvalRef.current = { fen: null, score: null, depth: 0 };
      setAppState('playing');
      setRightTab(autoRate ? 'rating' : 'moves');

      if (autoRate && parsed.moves.length > 0) {
        // Start Review synchronously in the same render batch so realtime analysis never races ahead
        void runMatchRatingPass(
          parsed.initialFen,
          parsed.moves,
          null,
          importedVariant,
          imported960Rights
        );
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
        setViewPly((p) => Math.min(movesRef.current.length, p + 1));
      } else if (e.key === 'Home') {
        e.preventDefault();
        setViewPly(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setViewPly(movesRef.current.length);
      } else if (e.key.toLowerCase() === 'f') {
        setOrientation((o) => (o === 'w' ? 'b' : 'w'));
      } else if (e.key.toLowerCase() === 'h') {
        handleRequestHint();
      } else if (e.key.toLowerCase() === 'm') {
        updatePreferences({ muted: !mutedRef.current });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    appState,
    gameOverDismissed,
    showNewMatchModal,
    handleRequestHint,
    updatePreferences,
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
      fen: viewedEngineFen,
      incomingScore: matchingEngineLine?.score ?? null,
      incomingDepth: matchingEngineLine ? engineAnalysis?.depth ?? matchingEngineLine.depth : 0,
      isSearching: Boolean(engineAnalysis && engineAnalysis.fen === viewedFen && engineAnalysis.isSearching),
      storedMoveEval: viewedLastMove?.evalAfter ?? null,
      cache: evalCacheRef.current,
      displayed: displayedEvalRef.current,
    });
  }, [appState, viewedFen, viewedEngineFen, matchingEngineLine, engineAnalysis, viewedLastMove?.evalAfter]);

  useEffect(() => {
    displayedEvalRef.current = stabilizedEval.nextDisplayed;
  }, [stabilizedEval.nextDisplayed]);

  const showMoveEvaluationBadges = activeMode === 'analysis';

  const viewedLastFrom = viewedLastMove?.from;
  const viewedLastTo = viewedLastMove?.to;
  const viewedLastClassification = showMoveEvaluationBadges ? viewedLastMove?.classification : undefined;

  const boardLastMove = useMemo(
    () =>
      viewedLastFrom && viewedLastTo
        ? {
            from: viewedLastFrom,
            to: viewedLastTo,
            classification: viewedLastClassification,
          }
        : null,
    [viewedLastFrom, viewedLastTo, viewedLastClassification]
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
      matchSessionIdRef.current += 1;
      cancelOngoingReview();
      opponentRef.current?.terminate();
      analyzerRef.current?.terminate();
      clockRef.current = null;
      setEngineAnalysis(null);
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
            chess960Rights={viewedChess960Rights}
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
          displayFen={viewedEngineFen}
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
          resultString={termination.resultString}
          isReviewing={isReviewing}
          reviewProgress={reviewProgress}
          reviewError={reviewError}
          onSelectPly={handleSelectPly}
          onFlipBoard={handleFlipBoard}
          onRequestHint={handleRequestHint}
          onTakeback={handleTakeback}
          onOfferDraw={handleOfferDraw}
          onResign={handleResign}
          onNewMatch={handleOpenNewMatchModal}
          onRunGameReview={handleRunGameReview}
          onCancelGameReview={cancelOngoingReview}
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
            opponentRef.current?.terminate();
            clockRef.current = null;
            setWhiteClock(null);
            setBlackClock(null);
            setActiveMode('analysis');
            setAppState('playing');
            setShowBestArrow(true);
            setRightTab('rating');
            if (moves.length > 0) {
              void runMatchRatingPass(initialFen, moves, activeMatchId, activeVariant, initialChess960Rights);
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

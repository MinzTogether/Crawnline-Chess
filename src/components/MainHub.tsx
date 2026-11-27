import React, { useMemo, useState } from 'react';
import type { Color } from 'chess.js';
import {
  ArrowLeft,
  Award,
  ChevronRight,
  Cpu,
  Globe,
  Home,
  Lock,
  Settings,
  Shuffle,
  SlidersHorizontal,
  Swords,
  User,
  Users,
} from 'lucide-react';
import {
  BOARD_THEMES,
  STOCKFISH_LEVELS,
  type MatchSettings,
  type RandomChessStyle,
} from '../types/chess';
import {
  type AppPreferences,
  type SavedMatch,
  type UserProfile,
} from '../types/preferences';
import {
  BOARD_FILES,
  STANDARD_START_FEN,
  fenToBoardMap,
  validateCustomPosition,
  type BoardMap,
} from '../game/customPosition';
import { createChess960Position, getChess960BackRank } from '../game/chess960';
import { useI18n } from '../i18n/LanguageContext';
import { AppLogoIcon } from './AppIcons';
import { ChessPiece } from './ChessPieces';
import { CustomBoardEditor } from './CustomBoardEditor';
import {
  OpponentSelector,
  PlaySideSelector,
  StockfishStrengthSelector,
  TimeControlSelector,
} from './MatchSetupControls';
import { ProfileSection } from './ProfileSection';
import { SettingsSection, type SettingsSubPage } from './SettingsSection';

export type HubSection = 'home' | 'settings' | 'profile';
type HomeStep =
  | 'root'
  | 'stockfish-setup'
  | 'person-select'
  | 'person-offline-setup'
  | 'chess960-setup'
  | 'custom-setup'
  | 'random-setup'
  | 'analysis-setup';

function getProfileInitials(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return 'PL';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

interface MainHubProps {
  section: HubSection;
  onChangeSection: (section: HubSection) => void;
  preferences: AppPreferences;
  onUpdatePreferences: (patch: Partial<AppPreferences>) => void;
  profile: UserProfile;
  onUpdateProfile: (patch: Partial<UserProfile>) => void;
  savedMatches: SavedMatch[];
  matchSettings: MatchSettings;
  onChangeMatchSettings: (next: MatchSettings) => void;
  onStartMatch: (overrideSettings?: MatchSettings) => void;
  onOpenMatchRating: (pgn?: string, title?: string) => void;
}

export const MainHub: React.FC<MainHubProps> = ({
  section,
  onChangeSection,
  preferences,
  onUpdatePreferences,
  profile,
  onUpdateProfile,
  savedMatches,
  matchSettings,
  onChangeMatchSettings,
  onStartMatch,
  onOpenMatchRating,
}) => {
  const { t } = useI18n();
  const [pgnQuickInput, setPgnQuickInput] = useState('');
  const [pgnQuickError, setPgnQuickError] = useState<string | null>(null);
  const [settingsSubPage, setSettingsSubPage] = useState<SettingsSubPage>('root');
  const [homeStep, setHomeStep] = useState<HomeStep>('root');
  const [customBoard, setCustomBoard] = useState<BoardMap>(() => fenToBoardMap(STANDARD_START_FEN));
  const [customTurn, setCustomTurn] = useState<Color>('w');
  const [variantOpponent, setVariantOpponent] = useState<'stockfish' | 'local'>('stockfish');
  const [randomStyle, setRandomStyle] = useState<RandomChessStyle>('all');
  const [chess960RandomMode, setChess960RandomMode] = useState<boolean>(true);
  const [chess960PreviewId, setChess960PreviewId] = useState<number>(() => createChess960Position().id);
  const chess960PreviewRank = useMemo(
    () => getChess960BackRank(chess960PreviewId),
    [chess960PreviewId]
  );
  const previewBoardTheme = BOARD_THEMES[preferences.boardTheme] ?? BOARD_THEMES.tournament;
  const customValidation = useMemo(
    () => validateCustomPosition(customBoard, customTurn),
    [customBoard, customTurn]
  );
  const safeDisplayName = profile.displayName.trim() || 'Player';
  const safeTitle = profile.title.trim() || 'Chess Player';
  const profileInitials = getProfileInitials(safeDisplayName);

  const handleSelectNavSection = (next: HubSection) => {
    if (next === 'settings') {
      setSettingsSubPage('root');
    } else if (next === 'home') {
      setHomeStep('root');
    }
    onChangeSection(next);
  };

  const activeLevel =
    STOCKFISH_LEVELS.find((l) => l.id === matchSettings.stockfishLevelId) ?? STOCKFISH_LEVELS[2];

  // Profile aggregate metrics computed live from savedMatches
  const profileStats = useMemo(() => {
    let wins = 0;
    let draws = 0;
    let losses = 0;
    const accuracies: number[] = [];
    let bestElo = 0;

    for (const m of savedMatches) {
      if (m.result === '1/2-1/2') {
        draws += 1;
      } else if (m.userSide === 'b') {
        if (m.result === '0-1') wins += 1;
        else if (m.result === '1-0') losses += 1;
      } else {
        if (m.result === '1-0') wins += 1;
        else if (m.result === '0-1') losses += 1;
      }

      const acc = m.userSide === 'b' ? m.blackAccuracy : m.whiteAccuracy;
      const elo = m.userSide === 'b' ? m.blackGameElo : m.whiteGameElo;
      if (typeof acc === 'number') accuracies.push(acc);
      if (typeof elo === 'number' && elo > bestElo) bestElo = elo;
    }

    const avgAcc =
      accuracies.length > 0
        ? Math.round((accuracies.reduce((a, b) => a + b, 0) / accuracies.length) * 10) / 10
        : null;

    return {
      total: savedMatches.length,
      wins,
      draws,
      losses,
      avgAcc,
      bestElo: bestElo > 0 ? bestElo : null,
    };
  }, [savedMatches]);

  const navItems: { id: HubSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'home', label: t('navHome'), icon: Home },
    { id: 'settings', label: t('navSettings'), icon: Settings },
    { id: 'profile', label: t('navProfile'), icon: User },
  ];

  const handleQuickRateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pgnQuickInput.trim()) {
      setPgnQuickError(t('pgnEmptyError'));
      return;
    }
    setPgnQuickError(null);
    onOpenMatchRating(pgnQuickInput.trim(), t('modeAnalysisTitle'));
  };

  return (
    <div className="hub-shell min-h-screen w-full bg-[var(--app-bg)] text-[var(--app-text)] flex flex-col md:flex-row">
      {/* Left Vertical Chess.com-style Sidebar Rail (Tablet/Desktop/Landscape) — Strictly Home, Settings, Profile */}
      <aside
        aria-label="Main navigation"
        className="hub-rail hidden md:flex md:flex-col md:w-[208px] lg:w-[244px] shrink-0 bg-[var(--app-rail)] border-r border-[var(--app-border)] p-4 justify-between sticky top-0 h-screen"
      >
        <div className="flex flex-col gap-5">
          {/* Brand Lockup with Customizable App Icon */}
          <div className="flex items-center gap-3 px-1.5 pt-1">
            <AppLogoIcon iconId={preferences.appIcon} className="w-9 h-9 lg:w-10 lg:h-10 shrink-0" />
            <div className="hub-rail-text min-w-0">
              <div className="text-base lg:text-lg font-extrabold tracking-tight text-[var(--app-text)] leading-none truncate">
                Crownline
              </div>
              <div className="text-[11px] text-[var(--app-text-muted)] mt-1 truncate">
                {t('brandSubtitle')}
              </div>
            </div>
          </div>

          {/* Navigation Links: Strictly Home, Settings, Profile */}
          <nav className="flex flex-col gap-1" aria-label="Primary sections">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  aria-label={item.label}
                  title={item.label}
                  onClick={() => handleSelectNavSection(item.id)}
                  className={`hub-rail-nav-btn flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-bold transition-colors cursor-pointer whitespace-nowrap anim-interactive ${
                    active
                      ? 'bg-[var(--app-surface)] text-[var(--app-text)] shadow-sm border border-[var(--app-border)]'
                      : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--app-surface-hover)] border border-transparent'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 shrink-0 ${
                      active ? 'text-[var(--app-accent)]' : 'text-[var(--app-text-muted)]'
                    }`}
                  />
                  <span className="hub-rail-text">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Compact Profile Card */}
        <button
          type="button"
          onClick={() => handleSelectNavSection('profile')}
          aria-label={safeDisplayName}
          className="w-full overflow-hidden flex items-center gap-2.5 p-2 rounded-xl bg-[var(--app-surface)] border border-[var(--app-border)] hover:border-[var(--app-border-strong)] transition-colors text-left cursor-pointer anim-interactive"
        >
          {profile.avatarImage ? (
            <img
              src={profile.avatarImage}
              alt={safeDisplayName}
              className="w-9 h-9 rounded-lg shrink-0 object-cover border border-[var(--app-border-strong)]"
            />
          ) : (
            <div
              className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center font-extrabold text-sm text-[#12160D]"
              style={{ backgroundColor: profile.avatarColor }}
            >
              {profileInitials}
            </div>
          )}
          <div className="hub-rail-text min-w-0 flex-1">
            <div className="text-xs font-bold text-[var(--app-text)] truncate">{safeDisplayName}</div>
            <div className="text-[11px] text-[var(--app-text-muted)] truncate">{safeTitle}</div>
          </div>
        </button>
      </aside>

      {/* Mobile Portrait Top Brand Bar */}
      <div className="hub-mobile-topbar md:hidden flex items-center justify-between gap-3 px-4 py-3 bg-[var(--app-rail)] border-b border-[var(--app-border)]">
        <div className="flex items-center gap-2.5 shrink-0">
          <AppLogoIcon iconId={preferences.appIcon} className="w-8 h-8 shrink-0" />
          <span className="text-base font-extrabold tracking-tight text-[var(--app-text)] whitespace-nowrap">
            Crownline
          </span>
        </div>
        <button
          type="button"
          onClick={() => handleSelectNavSection('profile')}
          className="flex items-center gap-2 min-w-0 cursor-pointer"
        >
          {profile.avatarImage ? (
            <img
              src={profile.avatarImage}
              alt={safeDisplayName}
              className="w-6 h-6 rounded-md object-cover border border-[var(--app-border-strong)] shrink-0"
            />
          ) : (
            <div
              className="w-6 h-6 rounded-md shrink-0 flex items-center justify-center font-extrabold text-[10px] text-[#12160D]"
              style={{ backgroundColor: profile.avatarColor }}
            >
              {profileInitials}
            </div>
          )}
          <span className="text-xs font-bold text-[var(--app-text)] truncate max-w-[160px]">
            {safeDisplayName}
          </span>
        </button>
      </div>

      {/* Main Content Area */}
      <main className="hub-main flex-1 min-w-0 pb-20 md:pb-8">
        {/* ================= HOME VIEW (CHESS.COM-STYLE MODE LAUNCHER, NO BOARD) ================= */}
        {section === 'home' && (
          <div
            key="hub-home"
            className="hub-content-pad max-w-[1120px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 flex flex-col gap-6 anim-view-enter"
            data-testid="home-mode-hub"
          >
            {/* Compact Player Header Row (Chess.com Home style) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[var(--app-border)]">
              <div className="flex items-center gap-3.5 min-w-0">
                <button
                  type="button"
                  onClick={() => handleSelectNavSection('profile')}
                  aria-label={`Open profile for ${safeDisplayName}`}
                  className="shrink-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] cursor-pointer anim-interactive"
                >
                  {profile.avatarImage ? (
                    <img
                      src={profile.avatarImage}
                      alt={safeDisplayName}
                      className="w-12 h-12 rounded-xl object-cover border border-[var(--app-border-strong)]"
                    />
                  ) : (
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center font-extrabold text-base text-[#12160D]"
                      style={{ backgroundColor: profile.avatarColor }}
                    >
                      {profileInitials}
                    </div>
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <h1
                    data-testid="home-profile-name"
                    className="text-2xl sm:text-[28px] font-extrabold tracking-tight text-[var(--app-text)] leading-tight truncate"
                  >
                    {safeDisplayName}
                  </h1>
                  <p className="text-sm text-[var(--app-text-muted)] mt-0.5 truncate">
                    {safeTitle} · {t('homeSubtitleSuffix')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-[var(--app-text-muted)] font-mono tabular-nums shrink-0">
                <span>
                  {profileStats.total} {t('matchesCount')}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {t('avgAcc')}: {profileStats.avgAcc !== null ? `${profileStats.avgAcc}%` : '—'}
                </span>
                {profileStats.bestElo && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-[var(--app-accent)] font-bold">
                      {t('peakElo')} {profileStats.bestElo} Elo
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* ================= HOME ROOT: SELECT MODE + HISTORY ONLY ================= */}
            {homeStep === 'root' && (
              <div
                key="home-step-root"
                className="hub-home-grid grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start anim-view-enter"
                data-testid="home-root-view"
              >
                {/* Left Column: Select Mode */}
                <section
                  aria-label={t('selectMode')}
                  className="hub-home-left lg:col-span-7 flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-bold tracking-wide text-[var(--app-text-muted)]">
                      {t('selectMode')}
                    </h2>
                    <span className="text-xs text-[var(--app-text-subtle)]">{t('poweredByStockfish')}</span>
                  </div>

                  <div className="flex flex-col gap-3">
                    {(
                      [
                        {
                          id: 'stockfish',
                          testId: 'mode-card-stockfish',
                          title: t('modeStockfishTitle'),
                          subtitle: t('modeStockfishDesc'),
                          meta: `${activeLevel.name} · ${activeLevel.elo} Elo`,
                          iconBg: 'rgba(129, 182, 76, 0.16)',
                          iconColor: '#81B64C',
                          icon: Cpu,
                          onSelect: () => {
                            onChangeMatchSettings({
                              ...matchSettings,
                              mode: 'stockfish',
                              variant: 'standard',
                              customFen: undefined,
                            });
                            setHomeStep('stockfish-setup');
                          },
                        },
                        {
                          id: 'local',
                          testId: 'mode-card-person',
                          title: t('modeLocalTitle'),
                          subtitle: t('modeLocalDesc'),
                          meta: t('modeLocalMeta'),
                          iconBg: 'rgba(80, 137, 198, 0.16)',
                          iconColor: '#5089C6',
                          icon: Users,
                          onSelect: () => {
                            onChangeMatchSettings({
                              ...matchSettings,
                              mode: 'local',
                              variant: 'standard',
                              customFen: undefined,
                            });
                            setHomeStep('person-select');
                          },
                        },
                        {
                          id: 'chess960',
                          testId: 'mode-card-chess960',
                          title: t('modeChess960Title'),
                          subtitle: t('modeChess960Desc'),
                          meta: t('modeChess960Meta'),
                          iconBg: 'rgba(232, 111, 81, 0.16)',
                          iconColor: '#E86F51',
                          icon: null as React.ComponentType<{ className?: string; style?: React.CSSProperties }> | null,
                          badgeText: '960',
                          onSelect: () => {
                            setHomeStep('chess960-setup');
                          },
                        },
                        {
                          id: 'custom',
                          testId: 'mode-card-custom',
                          title: t('modeCustomTitle'),
                          subtitle: t('modeCustomDesc'),
                          meta: t('modeCustomMeta'),
                          iconBg: 'rgba(217, 155, 60, 0.16)',
                          iconColor: '#D99B3C',
                          icon: SlidersHorizontal,
                          badgeText: null as string | null,
                          onSelect: () => {
                            setHomeStep('custom-setup');
                          },
                        },
                        {
                          id: 'random',
                          testId: 'mode-card-random',
                          title: t('modeRandomTitle'),
                          subtitle: t('modeRandomDesc'),
                          meta: t('modeRandomMeta'),
                          iconBg: 'rgba(156, 126, 230, 0.16)',
                          iconColor: '#9C7EE6',
                          icon: Shuffle,
                          badgeText: null as string | null,
                          onSelect: () => {
                            setHomeStep('random-setup');
                          },
                        },
                        {
                          id: 'analysis',
                          testId: 'mode-card-analysis',
                          title: t('modeAnalysisTitle'),
                          subtitle: t('modeAnalysisDesc'),
                          meta: t('modeAnalysisMeta'),
                          iconBg: 'rgba(27, 173, 166, 0.16)',
                          iconColor: '#1BADA6',
                          icon: Award,
                          badgeText: null as string | null,
                          onSelect: () => {
                            onChangeMatchSettings({
                              ...matchSettings,
                              mode: 'analysis',
                              variant: 'standard',
                              customFen: undefined,
                            });
                            setHomeStep('analysis-setup');
                          },
                        },
                      ]
                    ).map((card, idx) => {
                      const Icon = card.icon;
                      return (
                        <button
                          key={card.id}
                          type="button"
                          data-testid={card.testId}
                          onClick={card.onSelect}
                          style={{ '--stagger': idx } as React.CSSProperties}
                          className="w-full p-4 sm:p-5 rounded-xl border bg-[var(--app-surface)] border-[var(--app-border)] hover:border-[var(--app-accent)] hover:bg-[var(--app-surface-hover)] text-left transition-all cursor-pointer flex items-center justify-between gap-4 group anim-card-stagger anim-interactive"
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <div
                              className="w-13 h-13 rounded-xl flex items-center justify-center shrink-0 border border-white/10"
                              style={{ backgroundColor: card.iconBg }}
                            >
                              {Icon ? (
                                <Icon className="w-6 h-6" style={{ color: card.iconColor }} />
                              ) : (
                                <span
                                  className="text-sm font-mono font-black tracking-tighter"
                                  style={{ color: card.iconColor }}
                                >
                                  {'badgeText' in card ? card.badgeText : ''}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="text-base sm:text-lg font-extrabold text-[var(--app-text)] leading-tight truncate">
                                {card.title}
                              </div>
                              <p className="text-xs sm:text-[13px] text-[var(--app-text-muted)] mt-1 leading-snug">
                                {card.subtitle}
                              </p>
                              <div className="text-[11px] font-mono tabular-nums text-[var(--app-text-subtle)] mt-1.5">
                                {card.meta}
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg">
                            <ChevronRight className="w-5 h-5 text-[var(--app-text-subtle)] group-hover:text-[var(--app-accent)] group-hover:translate-x-0.5 transition-all" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Right Column: Match History */}
                <section
                  aria-label={t('recentMatches')}
                  style={{ '--stagger': 3 } as React.CSSProperties}
                  className="hub-home-right lg:col-span-5 bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl p-5 flex flex-col gap-3 anim-card-stagger"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-[var(--app-text)]">{t('recentMatches')}</h2>
                    <button
                      type="button"
                      onClick={() => onChangeSection('profile')}
                      className="text-xs font-semibold text-[var(--app-accent)] hover:underline cursor-pointer"
                    >
                      {t('viewAll')} →
                    </button>
                  </div>
                  <div className="flex flex-col divide-y divide-[var(--app-border)]">
                    {savedMatches.slice(0, 5).map((m) => (
                      <div key={m.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm font-bold text-[var(--app-text)] truncate">
                            {m.whiteName} vs {m.blackName}
                          </div>
                          <div className="text-[11px] text-[var(--app-text-muted)] flex items-center gap-1.5 font-mono tabular-nums mt-0.5">
                            <span className="font-bold text-[var(--app-text)]">{m.result}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-sans truncate">{m.openingName}</span>
                            {typeof m.whiteAccuracy === 'number' && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{m.whiteAccuracy.toFixed(0)}%</span>
                              </>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onOpenMatchRating(m.pgn, `${m.whiteName} vs ${m.blackName}`)}
                          className="px-3.5 py-2 rounded-lg bg-[var(--app-surface-2)] hover:bg-[var(--app-accent)] hover:text-[var(--app-accent-fg)] border border-[var(--app-border)] text-xs font-bold text-[var(--app-text)] transition-colors whitespace-nowrap shrink-0 cursor-pointer anim-interactive"
                        >
                          {t('rateMatch')}
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {/* ================= STEP: CHALLENGE STOCKFISH BOT -> ENGINE MATCH SETUP ================= */}
            {homeStep === 'stockfish-setup' && (
              <div
                key="home-step-stockfish"
                className="max-w-[680px] w-full mx-auto flex flex-col gap-4 anim-view-enter"
                data-testid="stockfish-setup-view"
              >
                <div>
                  <button
                    type="button"
                    onClick={() => setHomeStep('root')}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-xs font-bold text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors cursor-pointer anim-interactive"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{t('backToModes')}</span>
                  </button>
                </div>

                <div className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl p-5 sm:p-6 flex flex-col gap-5 shadow-sm">
                  <div className="pb-4 border-b border-[var(--app-border)] flex items-center gap-3.5">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border border-white/10"
                      style={{ backgroundColor: 'rgba(129, 182, 76, 0.16)' }}
                    >
                      <Cpu className="w-5 h-5 text-[#81B64C]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[var(--app-accent)]">{t('setupEngineLabel')}</div>
                      <h2 className="text-lg sm:text-xl font-extrabold text-[var(--app-text)] mt-0.5 truncate">
                        {t('modeStockfishTitle')}
                      </h2>
                    </div>
                  </div>

                  {/* Stockfish Engine Strength */}
                  <StockfishStrengthSelector
                    levelId={matchSettings.stockfishLevelId}
                    testId="stockfish-strength-section"
                    onChange={(levelId) =>
                      onChangeMatchSettings({
                        ...matchSettings,
                        mode: 'stockfish',
                        stockfishLevelId: levelId,
                      })
                    }
                  />

                  {/* Time Control */}
                  <TimeControlSelector
                    timeControlId={matchSettings.timeControlId}
                    onChange={(timeControlId) =>
                      onChangeMatchSettings({ ...matchSettings, mode: 'stockfish', timeControlId })
                    }
                  />

                  {/* Play As */}
                  <PlaySideSelector
                    playerSide={matchSettings.playerSide}
                    onChange={(playerSide) =>
                      onChangeMatchSettings({ ...matchSettings, mode: 'stockfish', playerSide })
                    }
                  />

                  <button
                    type="button"
                    data-start="true"
                    data-testid="start-stockfish-match"
                    onClick={() =>
                      onStartMatch({
                        ...matchSettings,
                        mode: 'stockfish',
                        variant: 'standard',
                        customFen: undefined,
                      })
                    }
                    className="w-full py-3.5 px-5 rounded-xl bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-[var(--app-accent-fg)] font-extrabold text-base tracking-tight transition-all shadow-[0_4px_0_var(--app-accent-shadow)] cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap mt-1 anim-interactive"
                  >
                    <Swords className="w-4 h-4" />
                    <span>{t('startMatch')}</span>
                  </button>
                </div>
              </div>
            )}

            {/* ================= STEP: PLAY WITH PERSON -> OFFLINE vs ONLINE (LOCKED) ================= */}
            {homeStep === 'person-select' && (
              <div
                key="home-step-person-select"
                className="max-w-[760px] w-full mx-auto flex flex-col gap-5 anim-view-enter"
                data-testid="person-mode-select-view"
              >
                <div>
                  <button
                    type="button"
                    onClick={() => setHomeStep('root')}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-xs font-bold text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors cursor-pointer anim-interactive"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{t('backToModes')}</span>
                  </button>
                </div>

                <div>
                  <div className="text-xs font-semibold text-[var(--app-accent)]">{t('modeLocalTitle')}</div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-[var(--app-text)] mt-0.5">
                    {t('personModeHeading')}
                  </h2>
                  <p className="text-sm text-[var(--app-text-muted)] mt-1">{t('personModeSubtitle')}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Offline Mode (Unlocked) */}
                  <button
                    type="button"
                    data-testid="person-mode-offline"
                    onClick={() => {
                      onChangeMatchSettings({ ...matchSettings, mode: 'local' });
                      setHomeStep('person-offline-setup');
                    }}
                    className="p-5 sm:p-6 rounded-xl border bg-[var(--app-surface)] border-[var(--app-border)] hover:border-[var(--app-accent)] hover:bg-[var(--app-surface-hover)] text-left transition-all cursor-pointer flex flex-col justify-between gap-5 group anim-interactive"
                  >
                    <div className="flex flex-col gap-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border border-white/10"
                          style={{ backgroundColor: 'rgba(80, 137, 198, 0.16)' }}
                        >
                          <Users className="w-6 h-6 text-[#5089C6]" />
                        </div>
                        <ChevronRight className="w-5 h-5 text-[var(--app-text-subtle)] group-hover:text-[var(--app-accent)] group-hover:translate-x-0.5 transition-all" />
                      </div>
                      <div>
                        <div className="text-lg font-extrabold text-[var(--app-text)]">
                          {t('personOfflineTitle')}
                        </div>
                        <p className="text-xs sm:text-[13px] text-[var(--app-text-muted)] mt-1.5 leading-relaxed">
                          {t('personOfflineDesc')}
                        </p>
                      </div>
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-[var(--app-accent)] font-semibold">
                      {t('personOfflineMeta')}
                    </div>
                  </button>

                  {/* Online Mode (Locked) */}
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    data-testid="person-mode-online"
                    className="p-5 sm:p-6 rounded-xl border bg-[var(--app-surface)]/70 border-[var(--app-border)] text-left flex flex-col justify-between gap-5 opacity-60 cursor-not-allowed select-none"
                  >
                    <div className="flex flex-col gap-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-[var(--app-surface-2)] border border-[var(--app-border)]">
                          <Globe className="w-6 h-6 text-[var(--app-text-subtle)]" />
                        </div>
                        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--app-text-muted)]">
                          <Lock className="w-4 h-4" />
                          <span>{t('modeLockedLabel')}</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-lg font-extrabold text-[var(--app-text)]">
                          {t('personOnlineTitle')}
                        </div>
                        <p className="text-xs sm:text-[13px] text-[var(--app-text-muted)] mt-1.5 leading-relaxed">
                          {t('personOnlineDesc')}
                        </p>
                      </div>
                    </div>
                    <div className="text-[11px] font-mono text-[var(--app-text-subtle)] flex items-center gap-1.5">
                      <Lock className="w-3 h-3 shrink-0" />
                      <span>{t('modeLockedHint')}</span>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* ================= STEP: PLAY WITH PERSON (OFFLINE) -> MATCH SETUP (NO STOCKFISH STRENGTH) ================= */}
            {homeStep === 'person-offline-setup' && (
              <div
                key="home-step-person-offline-setup"
                className="max-w-[680px] w-full mx-auto flex flex-col gap-4 anim-view-enter"
                data-testid="person-offline-setup-view"
              >
                <div>
                  <button
                    type="button"
                    onClick={() => setHomeStep('person-select')}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-xs font-bold text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors cursor-pointer anim-interactive"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{t('backToPlayWithPerson')}</span>
                  </button>
                </div>

                <div className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl p-5 sm:p-6 flex flex-col gap-5 shadow-sm">
                  <div className="pb-4 border-b border-[var(--app-border)] flex items-center gap-3.5">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border border-white/10"
                      style={{ backgroundColor: 'rgba(80, 137, 198, 0.16)' }}
                    >
                      <Users className="w-5 h-5 text-[#5089C6]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[var(--app-accent)]">{t('setupLocalLabel')}</div>
                      <h2 className="text-lg sm:text-xl font-extrabold text-[var(--app-text)] mt-0.5 truncate">
                        {t('modeLocalTitle')} · {t('personOfflineTitle')}
                      </h2>
                    </div>
                  </div>

                  {/* Time Control */}
                  <TimeControlSelector
                    timeControlId={matchSettings.timeControlId}
                    onChange={(timeControlId) =>
                      onChangeMatchSettings({ ...matchSettings, mode: 'local', timeControlId })
                    }
                  />

                  {/* Play As */}
                  <PlaySideSelector
                    playerSide={matchSettings.playerSide}
                    onChange={(playerSide) =>
                      onChangeMatchSettings({ ...matchSettings, mode: 'local', playerSide })
                    }
                  />

                  <button
                    type="button"
                    data-start="true"
                    data-testid="start-person-offline-match"
                    onClick={() =>
                      onStartMatch({
                        ...matchSettings,
                        mode: 'local',
                        variant: 'standard',
                        customFen: undefined,
                      })
                    }
                    className="w-full py-3.5 px-5 rounded-xl bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-[var(--app-accent-fg)] font-extrabold text-base tracking-tight transition-all shadow-[0_4px_0_var(--app-accent-shadow)] cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap mt-1 anim-interactive"
                  >
                    <Swords className="w-4 h-4" />
                    <span>{t('startMatch')}</span>
                  </button>
                </div>
              </div>
            )}

            {/* ================= STEP: ANALYSIS & MATCH RATING SETUP ================= */}
            {homeStep === 'analysis-setup' && (
              <div
                key="home-step-analysis"
                className="max-w-[680px] w-full mx-auto flex flex-col gap-4 anim-view-enter"
                data-testid="analysis-setup-view"
              >
                <div>
                  <button
                    type="button"
                    onClick={() => setHomeStep('root')}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-xs font-bold text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors cursor-pointer anim-interactive"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{t('backToModes')}</span>
                  </button>
                </div>

                <div className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl p-5 sm:p-6 flex flex-col gap-5 shadow-sm">
                  <div className="pb-4 border-b border-[var(--app-border)] flex items-center gap-3.5">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border border-white/10"
                      style={{ backgroundColor: 'rgba(27, 173, 166, 0.16)' }}
                    >
                      <Award className="w-5 h-5 text-[#1BADA6]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[var(--app-accent)]">{t('setupReviewLabel')}</div>
                      <h2 className="text-lg sm:text-xl font-extrabold text-[var(--app-text)] mt-0.5 truncate">
                        {t('modeAnalysisTitle')}
                      </h2>
                    </div>
                  </div>

                  <p className="text-xs text-[var(--app-text-muted)] leading-relaxed -mt-1">{t('analysisIntro')}</p>

                  <form onSubmit={handleQuickRateSubmit} className="flex flex-col gap-3">
                    <label htmlFor="hub-pgn-rate" className="text-xs font-semibold text-[var(--app-text-muted)]">
                      {t('pgnToRateOptional')}
                    </label>
                    <textarea
                      id="hub-pgn-rate"
                      rows={5}
                      value={pgnQuickInput}
                      onChange={(e) => {
                        setPgnQuickInput(e.target.value);
                        if (pgnQuickError) setPgnQuickError(null);
                      }}
                      placeholder="1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5..."
                      className="w-full rounded-lg bg-[var(--app-surface-2)] border border-[var(--app-border-strong)] focus:border-[var(--app-accent)] focus:outline-none p-3 text-xs font-mono text-[var(--app-text)] resize-none"
                    />
                    {pgnQuickError && <p className="text-xs text-[#E04F4F]">{pgnQuickError}</p>}

                    <div className="flex flex-col gap-2.5 pt-1">
                      <button
                        type="submit"
                        className="w-full py-3.5 px-5 rounded-xl bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-[var(--app-accent-fg)] font-extrabold text-sm transition-colors shadow-[0_4px_0_var(--app-accent-shadow)] cursor-pointer whitespace-nowrap anim-interactive"
                      >
                        {t('ratePgnMatch')}
                      </button>
                      <button
                        type="button"
                        data-start="true"
                        onClick={() => onOpenMatchRating()}
                        className="w-full py-3 px-4 rounded-xl bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border-strong)] text-[var(--app-text)] font-bold text-sm transition-colors cursor-pointer whitespace-nowrap anim-interactive"
                      >
                        {t('openAnalysisBoard')}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* ================= STEP: CUSTOM POSITION SETUP (INTERACTIVE BOARD EDITOR) ================= */}
            {homeStep === 'custom-setup' && (
              <div
                key="home-step-custom"
                className="max-w-[1060px] w-full mx-auto flex flex-col gap-4 anim-view-enter"
                data-testid="custom-setup-view"
              >
                <div>
                  <button
                    type="button"
                    onClick={() => setHomeStep('root')}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-xs font-bold text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors cursor-pointer anim-interactive"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{t('backToModes')}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  {/* Left: Interactive Custom Board Position Editor */}
                  <div className="lg:col-span-7 bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl p-4 sm:p-5 shadow-sm">
                    <CustomBoardEditor
                      board={customBoard}
                      turn={customTurn}
                      validation={customValidation}
                      boardTheme={preferences.boardTheme}
                      pieceStyle={preferences.pieceStyle}
                      onChangeBoard={setCustomBoard}
                      onChangeTurn={setCustomTurn}
                    />
                  </div>

                  {/* Right: Match Settings for Custom Position */}
                  <div className="lg:col-span-5 bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl p-5 flex flex-col gap-5 shadow-sm">
                    <div className="pb-4 border-b border-[var(--app-border)] flex items-center gap-3.5">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border border-white/10"
                        style={{ backgroundColor: 'rgba(217, 155, 60, 0.16)' }}
                      >
                        <SlidersHorizontal className="w-5 h-5 text-[#D99B3C]" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[var(--app-accent)]">{t('setupCustomLabel')}</div>
                        <h2 className="text-lg font-extrabold text-[var(--app-text)] mt-0.5 truncate">
                          {t('modeCustomTitle')}
                        </h2>
                      </div>
                    </div>

                    {/* Opponent Selector */}
                    <OpponentSelector
                      value={variantOpponent}
                      onChange={setVariantOpponent}
                      testIdPrefix="custom"
                      compact
                    />

                    {/* Stockfish Strength (only when playing vs Stockfish Bot) */}
                    {variantOpponent === 'stockfish' && (
                      <StockfishStrengthSelector
                        levelId={matchSettings.stockfishLevelId}
                        onChange={(stockfishLevelId) =>
                          onChangeMatchSettings({ ...matchSettings, stockfishLevelId })
                        }
                        compact
                      />
                    )}

                    {/* Time Control */}
                    <TimeControlSelector
                      timeControlId={matchSettings.timeControlId}
                      onChange={(timeControlId) =>
                        onChangeMatchSettings({ ...matchSettings, timeControlId })
                      }
                    />

                    {/* Play As */}
                    <PlaySideSelector
                      playerSide={matchSettings.playerSide}
                      onChange={(playerSide) =>
                        onChangeMatchSettings({ ...matchSettings, playerSide })
                      }
                      compact
                    />

                    <button
                      type="button"
                      data-start="true"
                      data-testid="start-custom-match"
                      disabled={!customValidation.valid}
                      onClick={() => {
                        if (!customValidation.valid) return;
                        onStartMatch({
                          ...matchSettings,
                          mode: variantOpponent,
                          variant: 'custom',
                          customFen: customValidation.fen,
                        });
                      }}
                      className="w-full py-3.5 px-5 rounded-xl bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] disabled:opacity-45 disabled:cursor-not-allowed text-[var(--app-accent-fg)] font-extrabold text-base tracking-tight transition-all shadow-[0_4px_0_var(--app-accent-shadow)] cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap mt-1 anim-interactive"
                    >
                      <Swords className="w-4 h-4" />
                      <span>{t('startMatch')}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ================= STEP: RANDOM CHESS SETUP (CHAOS SHUFFLE) ================= */}
            {homeStep === 'random-setup' && (
              <div
                key="home-step-random"
                className="max-w-[680px] w-full mx-auto flex flex-col gap-4 anim-view-enter"
                data-testid="random-setup-view"
              >
                <div>
                  <button
                    type="button"
                    onClick={() => setHomeStep('root')}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-xs font-bold text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors cursor-pointer anim-interactive"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{t('backToModes')}</span>
                  </button>
                </div>

                <div className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl p-5 sm:p-6 flex flex-col gap-5 shadow-sm">
                  <div className="pb-4 border-b border-[var(--app-border)] flex items-center gap-3.5">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border border-white/10"
                      style={{ backgroundColor: 'rgba(156, 126, 230, 0.16)' }}
                    >
                      <Shuffle className="w-5 h-5 text-[#9C7EE6]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[var(--app-accent)]">{t('setupRandomLabel')}</div>
                      <h2 className="text-lg sm:text-xl font-extrabold text-[var(--app-text)] mt-0.5 truncate">
                        {t('modeRandomTitle')}
                      </h2>
                    </div>
                  </div>

                  {/* Random Chess Sub-Mode Selector: Random All vs Standard Random */}
                  <div>
                    <span className="block text-xs font-semibold text-[var(--app-text-muted)] mb-2">
                      {t('randomStyleHeading')}
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {(
                        [
                          {
                            id: 'all' as RandomChessStyle,
                            testId: 'random-style-all',
                            title: t('randomStyleAllTitle'),
                            desc: t('randomStyleAllDesc'),
                          },
                          {
                            id: 'standard' as RandomChessStyle,
                            testId: 'random-style-standard',
                            title: t('randomStyleStandardTitle'),
                            desc: t('randomStyleStandardDesc'),
                          },
                        ]
                      ).map((opt) => {
                        const selected = randomStyle === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            data-testid={opt.testId}
                            aria-pressed={selected}
                            onClick={() => setRandomStyle(opt.id)}
                            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer anim-interactive ${
                              selected
                                ? 'bg-[var(--app-accent-soft)] border-[var(--app-accent)] text-[var(--app-text)]'
                                : 'bg-[var(--app-surface-2)] border-[var(--app-border)] text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:border-[var(--app-border-strong)]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-extrabold text-[var(--app-text)]">{opt.title}</span>
                              <span
                                className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 ${
                                  selected
                                    ? 'border-[var(--app-accent)] bg-[var(--app-accent)]'
                                    : 'border-[var(--app-border-strong)]'
                                }`}
                              />
                            </div>
                            <p className="text-xs text-[var(--app-text-muted)] mt-1.5 leading-relaxed">{opt.desc}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Active Random Style Summary */}
                  <div className="p-3.5 rounded-lg bg-[var(--app-surface-2)] border border-[var(--app-border)]">
                    <div className="text-xs font-bold text-[var(--app-text)]">
                      {randomStyle === 'all' ? t('randomModeInfoTitle') : t('randomStandardInfoTitle')}
                    </div>
                    <p className="text-xs text-[var(--app-text-muted)] mt-1 leading-relaxed">
                      {randomStyle === 'all' ? t('randomModeInfoDesc') : t('randomStandardInfoDesc')}
                    </p>
                  </div>

                  {/* Opponent Selector */}
                  <OpponentSelector
                    value={variantOpponent}
                    onChange={setVariantOpponent}
                    testIdPrefix="random"
                  />

                  {/* Stockfish Strength (when opponent is Stockfish Bot) */}
                  {variantOpponent === 'stockfish' && (
                    <StockfishStrengthSelector
                      levelId={matchSettings.stockfishLevelId}
                      onChange={(stockfishLevelId) =>
                        onChangeMatchSettings({ ...matchSettings, stockfishLevelId })
                      }
                    />
                  )}

                  {/* Time Control */}
                  <TimeControlSelector
                    timeControlId={matchSettings.timeControlId}
                    onChange={(timeControlId) =>
                      onChangeMatchSettings({ ...matchSettings, timeControlId })
                    }
                  />

                  {/* Play As */}
                  <PlaySideSelector
                    playerSide={matchSettings.playerSide}
                    onChange={(playerSide) =>
                      onChangeMatchSettings({ ...matchSettings, playerSide })
                    }
                  />

                  <button
                    type="button"
                    data-start="true"
                    data-testid="start-random-match"
                    onClick={() =>
                      onStartMatch({
                        ...matchSettings,
                        mode: variantOpponent,
                        variant: 'random',
                        randomStyle,
                        customFen: undefined,
                      })
                    }
                    className="w-full py-3.5 px-5 rounded-xl bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-[var(--app-accent-fg)] font-extrabold text-base tracking-tight transition-all shadow-[0_4px_0_var(--app-accent-shadow)] cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap mt-1 anim-interactive"
                  >
                    <Shuffle className="w-4 h-4" />
                    <span>{t('startMatch')}</span>
                  </button>
                </div>
              </div>
            )}

            {/* ================= STEP: CHESS960 (FISCHER RANDOM — CHESS.COM RULES) ================= */}
            {homeStep === 'chess960-setup' && (
              <div
                key="home-step-chess960"
                className="max-w-[680px] w-full mx-auto flex flex-col gap-4 anim-view-enter"
                data-testid="chess960-setup-view"
              >
                <div>
                  <button
                    type="button"
                    onClick={() => setHomeStep('root')}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-xs font-bold text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors cursor-pointer anim-interactive"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{t('backToModes')}</span>
                  </button>
                </div>

                <div className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl p-5 sm:p-6 flex flex-col gap-5 shadow-sm">
                  <div className="pb-4 border-b border-[var(--app-border)] flex items-center gap-3.5">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border border-white/10"
                      style={{ backgroundColor: 'rgba(232, 111, 81, 0.16)' }}
                    >
                      <span className="text-sm font-mono font-black tracking-tighter text-[#E86F51]">960</span>
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[var(--app-accent)]">{t('setupChess960Label')}</div>
                      <h2 className="text-lg sm:text-xl font-extrabold text-[var(--app-text)] mt-0.5 truncate">
                        {t('modeChess960Title')}
                      </h2>
                    </div>
                  </div>

                  {/* Chess.com Chess960 Rules Summary */}
                  <div className="p-3.5 rounded-lg bg-[var(--app-surface-2)] border border-[var(--app-border)]">
                    <div className="text-xs font-bold text-[var(--app-text)]">{t('chess960RulesTitle')}</div>
                    <p className="text-xs text-[var(--app-text-muted)] mt-1 leading-relaxed">
                      {t('chess960RulesDesc')}
                    </p>
                  </div>

                  {/* Chess960 Starting Position Mode + Live Back-Rank Preview */}
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[var(--app-text-muted)]">
                        {t('chess960PositionLabel')}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          data-testid="chess960-mode-random"
                          onClick={() => setChess960RandomMode(true)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer anim-interactive ${
                            chess960RandomMode
                              ? 'bg-[var(--app-accent-soft)] border-[var(--app-accent)] text-[var(--app-text)]'
                              : 'bg-[var(--app-surface-2)] border-[var(--app-border)] text-[var(--app-text-muted)]'
                          }`}
                        >
                          {t('chess960RandomEachMatch')}
                        </button>
                        <button
                          type="button"
                          data-testid="chess960-mode-custom-id"
                          onClick={() => setChess960RandomMode(false)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer anim-interactive ${
                            !chess960RandomMode
                              ? 'bg-[var(--app-accent-soft)] border-[var(--app-accent)] text-[var(--app-text)]'
                              : 'bg-[var(--app-surface-2)] border-[var(--app-border)] text-[var(--app-text-muted)]'
                          }`}
                        >
                          {t('chess960CustomIdLabel')}
                        </button>
                      </div>
                    </div>

                    {/* Visual Back-Rank Preview Strip */}
                    <div className="p-3 rounded-xl bg-[var(--app-surface-2)] border border-[var(--app-border)] flex flex-col gap-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-[var(--app-text)]" data-testid="chess960-preview-id">
                            SP #{chess960PreviewId}
                          </span>
                          <span className="text-[11px] font-mono uppercase tracking-widest text-[var(--app-text-muted)]">
                            {chess960PreviewRank.join('')}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {!chess960RandomMode && (
                            <input
                              type="number"
                              min={0}
                              max={959}
                              aria-label="Chess960 position number"
                              data-testid="chess960-id-input"
                              value={chess960PreviewId}
                              onChange={(e) => {
                                const parsed = parseInt(e.target.value, 10);
                                if (!Number.isNaN(parsed)) {
                                  setChess960PreviewId(Math.max(0, Math.min(959, parsed)));
                                }
                              }}
                              className="w-16 px-2 py-1 rounded-md bg-[var(--app-surface)] border border-[var(--app-border-strong)] text-xs font-mono font-bold text-[var(--app-text)] text-center focus:outline-none focus:border-[var(--app-accent)]"
                            />
                          )}
                          <button
                            type="button"
                            data-testid="chess960-reroll-btn"
                            onClick={() => setChess960PreviewId(createChess960Position().id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[var(--app-surface)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-[11px] font-semibold text-[var(--app-text)] cursor-pointer anim-interactive"
                          >
                            <Shuffle className="w-3 h-3 text-[#E86F51]" />
                            <span>{t('chess960RerollBtn')}</span>
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-8 rounded-md overflow-hidden ring-1 ring-white/10">
                        {chess960PreviewRank.map((piece, idx) => {
                          const isLight = idx % 2 === 1;
                          return (
                            <div
                              key={`${BOARD_FILES[idx]}-${idx}`}
                              className="relative aspect-square flex items-center justify-center p-1"
                              style={{ backgroundColor: isLight ? previewBoardTheme.light : previewBoardTheme.dark }}
                            >
                              <div className="w-[88%] h-[88%]">
                                <ChessPiece type={piece} color="w" pieceStyle={preferences.pieceStyle} />
                              </div>
                              <span
                                className="absolute bottom-0.5 right-1 text-[9px] font-mono font-bold leading-none opacity-85"
                                style={{ color: isLight ? previewBoardTheme.coordLight : previewBoardTheme.coordDark }}
                              >
                                {BOARD_FILES[idx]}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Opponent Selector */}
                  <OpponentSelector
                    value={variantOpponent}
                    onChange={setVariantOpponent}
                    testIdPrefix="chess960"
                  />

                  {/* Stockfish Strength */}
                  {variantOpponent === 'stockfish' && (
                    <StockfishStrengthSelector
                      levelId={matchSettings.stockfishLevelId}
                      onChange={(stockfishLevelId) =>
                        onChangeMatchSettings({ ...matchSettings, stockfishLevelId })
                      }
                    />
                  )}

                  {/* Time Control */}
                  <TimeControlSelector
                    timeControlId={matchSettings.timeControlId}
                    onChange={(timeControlId) =>
                      onChangeMatchSettings({ ...matchSettings, timeControlId })
                    }
                  />

                  {/* Play As */}
                  <PlaySideSelector
                    playerSide={matchSettings.playerSide}
                    onChange={(playerSide) =>
                      onChangeMatchSettings({ ...matchSettings, playerSide })
                    }
                  />

                  <button
                    type="button"
                    data-start="true"
                    data-testid="start-chess960-match"
                    onClick={() =>
                      onStartMatch({
                        ...matchSettings,
                        mode: variantOpponent,
                        variant: 'chess960',
                        chess960Id: chess960RandomMode ? null : chess960PreviewId,
                        customFen: undefined,
                      })
                    }
                    className="w-full py-3.5 px-5 rounded-xl bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-[var(--app-accent-fg)] font-extrabold text-base tracking-tight transition-all shadow-[0_4px_0_var(--app-accent-shadow)] cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap mt-1 anim-interactive"
                  >
                    <Swords className="w-4 h-4" />
                    <span>{t('startMatch')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= SETTINGS VIEW (CATEGORIZED SUB-PAGES) ================= */}
        {section === 'settings' && (
          <SettingsSection
            subPage={settingsSubPage}
            onChangeSubPage={setSettingsSubPage}
            preferences={preferences}
            onUpdatePreferences={onUpdatePreferences}
          />
        )}

        {/* ================= PROFILE VIEW ================= */}
        {section === 'profile' && (
          <ProfileSection
            profile={profile}
            safeDisplayName={safeDisplayName}
            profileInitials={profileInitials}
            profileStats={profileStats}
            savedMatches={savedMatches}
            onUpdateProfile={onUpdateProfile}
            onOpenMatchRating={onOpenMatchRating}
          />
        )}
      </main>

      {/* Mobile Portrait Bottom Navigation Bar — Strictly Home, Settings, Profile (<= 10% height) */}
      <nav
        aria-label="Mobile navigation"
        className="hub-mobile-bottomnav md:hidden fixed bottom-0 inset-x-0 z-30 bg-[var(--app-rail)] border-t border-[var(--app-border)] grid grid-cols-3 h-14"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = section === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => handleSelectNavSection(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold transition-colors cursor-pointer ${
                active ? 'text-[var(--app-accent)]' : 'text-[var(--app-text-muted)]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

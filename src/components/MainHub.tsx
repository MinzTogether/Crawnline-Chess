import React, { useMemo, useState } from 'react';
import {
  Award,
  Check,
  ChevronRight,
  Cpu,
  Home,
  Settings,
  Swords,
  User,
  Users,
} from 'lucide-react';
import {
  BOARD_THEMES,
  STOCKFISH_LEVELS,
  TIME_CONTROLS,
  type BoardThemeId,
  type GameMode,
  type MatchSettings,
  type PlayerSideChoice,
} from '../types/chess';
import {
  APP_THEMES,
  PIECE_STYLES,
  type AppPreferences,
  type PieceStyleId,
  type SavedMatch,
  type UserProfile,
} from '../types/preferences';
import { APP_ICONS, AppLogoIcon } from './AppIcons';
import { ChessBoard } from './ChessBoard';
import { ChessPiece } from './ChessPieces';

export type HubSection = 'home' | 'settings' | 'profile';

const SHOWCASE_FEN = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R w KQkq - 1 5';

const AVATAR_COLORS = ['#81B64C', '#5C9CE6', '#D99B3C', '#26C2A3', '#D96666', '#9C7EE6'];

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
  const [pgnQuickInput, setPgnQuickInput] = useState('');
  const [pgnQuickError, setPgnQuickError] = useState<string | null>(null);
  const [profileSavedToast, setProfileSavedToast] = useState(false);

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
    { id: 'home', label: 'Home', icon: Home },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  const handleQuickRateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pgnQuickInput.trim()) {
      setPgnQuickError('Paste a PGN move list or pick a match below to rate.');
      return;
    }
    setPgnQuickError(null);
    onOpenMatchRating(pgnQuickInput.trim(), 'Rated Match Review');
  };

  return (
    <div className="min-h-screen w-full bg-[var(--app-bg)] text-[var(--app-text)] flex flex-col md:flex-row">
      {/* Left Vertical Chess.com-style Sidebar Rail (Desktop) — Strictly Home, Settings, Profile */}
      <aside
        aria-label="Main navigation"
        className="hidden md:flex md:flex-col md:w-[228px] lg:w-[244px] shrink-0 bg-[var(--app-rail)] border-r border-[var(--app-border)] p-4 justify-between sticky top-0 h-screen"
      >
        <div className="flex flex-col gap-6">
          {/* Brand Lockup with Customizable App Icon */}
          <div className="flex items-center gap-3 px-2 pt-1">
            <AppLogoIcon iconId={preferences.appIcon} className="w-10 h-10 shrink-0" />
            <div className="min-w-0">
              <div className="text-lg font-extrabold tracking-tight text-[var(--app-text)] leading-none truncate">
                Crownline
              </div>
              <div className="text-[11px] text-[var(--app-text-muted)] mt-1 truncate">
                Chess &amp; Stockfish
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
                  onClick={() => onChangeSection(item.id)}
                  className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-bold transition-colors cursor-pointer whitespace-nowrap ${
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
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Compact Profile Card */}
        <button
          type="button"
          onClick={() => onChangeSection('profile')}
          className="flex items-center gap-3 p-2.5 rounded-xl bg-[var(--app-surface)] border border-[var(--app-border)] hover:border-[var(--app-border-strong)] transition-colors text-left cursor-pointer"
        >
          <div
            className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center font-extrabold text-sm text-[#12160D]"
            style={{ backgroundColor: profile.avatarColor }}
          >
            {profile.displayName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-[var(--app-text)] truncate">{profile.displayName}</div>
            <div className="text-[11px] text-[var(--app-text-muted)] truncate">{profile.title}</div>
          </div>
        </button>
      </aside>

      {/* Mobile Top Brand Bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-[var(--app-rail)] border-b border-[var(--app-border)]">
        <div className="flex items-center gap-2.5">
          <AppLogoIcon iconId={preferences.appIcon} className="w-8 h-8 shrink-0" />
          <span className="text-base font-extrabold tracking-tight text-[var(--app-text)]">Crownline Chess</span>
        </div>
        <span className="text-xs font-semibold text-[var(--app-text-muted)] truncate max-w-[140px]">
          {profile.displayName}
        </span>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 pb-20 md:pb-8">
        {/* ================= HOME VIEW ================= */}
        {section === 'home' && (
          <div className="max-w-[1160px] mx-auto px-4 sm:px-8 py-6 sm:py-8 flex flex-col gap-8">
            {/* Greeting Row */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--app-text)]">
                  Welcome back, {profile.displayName}
                </h1>
                <p className="text-sm text-[var(--app-text-muted)] mt-1">
                  Choose a play mode or launch Stockfish Match Rating to review any game.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-[var(--app-text-muted)] font-mono tabular-nums">
                <span>{profileStats.total} Matches</span>
                <span aria-hidden="true">·</span>
                <span>Avg Acc: {profileStats.avgAcc !== null ? `${profileStats.avgAcc}%` : '—'}</span>
                {profileStats.bestElo && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-[var(--app-accent)] font-bold">Best {profileStats.bestElo} Elo</span>
                  </>
                )}
              </div>
            </div>

            {/* Chess.com-style 2-Column Lobby: Board Preview Left + Mode Chooser Right */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-7 items-start">
              {/* Left Column: Board Centerpiece + Quick Mode Cards */}
              <div className="xl:col-span-6 flex flex-col gap-5">
                <div className="w-full max-w-[520px] mx-auto xl:mx-0">
                  <ChessBoard
                    fen={SHOWCASE_FEN}
                    orientation="w"
                    themeId={preferences.boardTheme}
                    pieceStyle={preferences.pieceStyle}
                    interactive={false}
                    showCoordinates={preferences.showCoordinates}
                    showLegalMoves={false}
                    showEvalBar={preferences.showEvalBar}
                    evalScore={{ type: 'cp', value: 42 }}
                    lastMove={{ from: 'c2', to: 'c3' }}
                    engineArrows={[
                      { from: 'd2', to: 'd4', color: 'rgba(129, 182, 76, 0.88)', kind: 'best' },
                    ]}
                    onMove={() => false}
                  />
                </div>
              </div>

              {/* Right Column: Mode Cards + Quick Match Launch */}
              <div className="xl:col-span-6 flex flex-col gap-4">
                {/* 3 Core Mode Cards (NO Puzzles, NO Daily Puzzles, NO Learning Mode) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {(
                    [
                      {
                        id: 'stockfish' as GameMode,
                        title: 'Play Stockfish',
                        desc: '800–3100 Elo engine',
                        icon: Cpu,
                      },
                      {
                        id: 'local' as GameMode,
                        title: 'Pass & Play',
                        desc: '2 players, 1 board',
                        icon: Users,
                      },
                      {
                        id: 'analysis' as GameMode,
                        title: 'Rate Match',
                        desc: 'Stockfish game rating',
                        icon: Award,
                      },
                    ]
                  ).map((card) => {
                    const Icon = card.icon;
                    const active = matchSettings.mode === card.id;
                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => onChangeMatchSettings({ ...matchSettings, mode: card.id })}
                        className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer flex flex-col gap-2 ${
                          active
                            ? 'bg-[var(--app-surface)] border-[var(--app-accent)] shadow-sm'
                            : 'bg-[var(--app-surface-2)] border-[var(--app-border)] hover:bg-[var(--app-surface)]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <Icon
                            className={`w-5 h-5 ${
                              active ? 'text-[var(--app-accent)]' : 'text-[var(--app-text-muted)]'
                            }`}
                          />
                          {active && <Check className="w-4 h-4 text-[var(--app-accent)]" />}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-[var(--app-text)] leading-tight">
                            {card.title}
                          </div>
                          <div className="text-[11px] text-[var(--app-text-muted)] mt-0.5">{card.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Active Mode Config Panel */}
                <div className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl p-5 flex flex-col gap-4 shadow-sm">
                  {matchSettings.mode === 'analysis' ? (
                    <>
                      <div>
                        <h2 className="text-base font-extrabold text-[var(--app-text)]">
                          Analysis &amp; Match Rating Mode
                        </h2>
                        <p className="text-xs text-[var(--app-text-muted)] mt-1">
                          Paste a PGN to calculate White &amp; Black Accuracy %, Estimated Game Elo, Phase Ratings, and Key Moments — or open an empty Stockfish Analysis Board.
                        </p>
                      </div>

                      <form onSubmit={handleQuickRateSubmit} className="flex flex-col gap-2.5">
                        <label htmlFor="hub-pgn-rate" className="text-xs font-semibold text-[var(--app-text-muted)]">
                          PGN to Rate (Optional)
                        </label>
                        <textarea
                          id="hub-pgn-rate"
                          rows={3}
                          value={pgnQuickInput}
                          onChange={(e) => {
                            setPgnQuickInput(e.target.value);
                            if (pgnQuickError) setPgnQuickError(null);
                          }}
                          placeholder="1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5..."
                          className="w-full rounded-lg bg-[var(--app-surface-2)] border border-[var(--app-border-strong)] focus:border-[var(--app-accent)] focus:outline-none p-2.5 text-xs font-mono text-[var(--app-text)] resize-none"
                        />
                        {pgnQuickError && <p className="text-xs text-[#E04F4F]">{pgnQuickError}</p>}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                          <button
                            type="submit"
                            className="py-3 px-4 rounded-lg bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-[var(--app-accent-fg)] font-extrabold text-sm transition-colors shadow-[0_3px_0_var(--app-accent-shadow)] cursor-pointer whitespace-nowrap"
                          >
                            Rate PGN Match
                          </button>
                          <button
                            type="button"
                            data-start="true"
                            onClick={() => onOpenMatchRating()}
                            className="py-3 px-4 rounded-lg bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border-strong)] text-[var(--app-text)] font-bold text-sm transition-colors cursor-pointer whitespace-nowrap"
                          >
                            Open Analysis Board
                          </button>
                        </div>
                      </form>
                    </>
                  ) : (
                    <>
                      {/* Stockfish Strength Picker */}
                      {matchSettings.mode === 'stockfish' && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-[var(--app-text-muted)]">
                              Stockfish Engine Strength
                            </span>
                            <span className="text-xs font-mono tabular-nums font-bold text-[var(--app-accent)]">
                              {activeLevel.name} · {activeLevel.elo} Elo
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5">
                            {STOCKFISH_LEVELS.map((lvl) => {
                              const selected = lvl.id === matchSettings.stockfishLevelId;
                              return (
                                <button
                                  key={lvl.id}
                                  type="button"
                                  onClick={() =>
                                    onChangeMatchSettings({ ...matchSettings, stockfishLevelId: lvl.id })
                                  }
                                  className={`py-2 px-2.5 rounded-lg text-left border transition-colors cursor-pointer ${
                                    selected
                                      ? 'bg-[var(--app-accent-soft)] border-[var(--app-accent)] text-[var(--app-text)]'
                                      : 'bg-[var(--app-surface-2)] border-[var(--app-border)] text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
                                  }`}
                                >
                                  <div className="text-xs font-mono font-bold tabular-nums">{lvl.elo}</div>
                                  <div className="text-[11px] truncate opacity-85">{lvl.name}</div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Time Control */}
                      <div>
                        <span className="block text-xs font-semibold text-[var(--app-text-muted)] mb-2">
                          Time Control
                        </span>
                        <div className="grid grid-cols-4 gap-1.5">
                          {TIME_CONTROLS.map((tc) => {
                            const selected = tc.id === matchSettings.timeControlId;
                            return (
                              <button
                                key={tc.id}
                                type="button"
                                onClick={() => onChangeMatchSettings({ ...matchSettings, timeControlId: tc.id })}
                                className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap cursor-pointer ${
                                  selected
                                    ? 'bg-[var(--app-accent-soft)] border-[var(--app-accent)] text-[var(--app-text)]'
                                    : 'bg-[var(--app-surface-2)] border-[var(--app-border)] text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
                                }`}
                              >
                                {tc.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Side Selection */}
                      {matchSettings.mode === 'stockfish' && (
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold text-[var(--app-text-muted)]">Play As</span>
                          <div className="flex items-center gap-1.5">
                            {(
                              [
                                { id: 'w', label: 'White' },
                                { id: 'random', label: 'Random' },
                                { id: 'b', label: 'Black' },
                              ] as { id: PlayerSideChoice; label: string }[]
                            ).map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => onChangeMatchSettings({ ...matchSettings, playerSide: s.id })}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                                  matchSettings.playerSide === s.id
                                    ? 'bg-[var(--app-accent-soft)] border-[var(--app-accent)] text-[var(--app-text)]'
                                    : 'bg-[var(--app-surface-2)] border-[var(--app-border)] text-[var(--app-text-muted)]'
                                }`}
                              >
                                {s.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        data-start="true"
                        onClick={() => onStartMatch()}
                        className="w-full py-3.5 px-5 rounded-xl bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] active:scale-[0.99] text-[var(--app-accent-fg)] font-extrabold text-base tracking-tight transition-all shadow-[0_4px_0_var(--app-accent-shadow)] cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
                      >
                        <Swords className="w-4 h-4" />
                        <span>{matchSettings.mode === 'stockfish' ? 'Play Stockfish' : 'Start Pass & Play'}</span>
                      </button>
                    </>
                  )}
                </div>

                {/* Recent Matches Strip with One-Click "Rate Match" */}
                <div className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-[var(--app-text)]">Recent Matches</h2>
                    <button
                      type="button"
                      onClick={() => onChangeSection('profile')}
                      className="text-xs font-semibold text-[var(--app-accent)] hover:underline cursor-pointer"
                    >
                      View All →
                    </button>
                  </div>
                  <div className="flex flex-col divide-y divide-[var(--app-border)]">
                    {savedMatches.slice(0, 3).map((m) => (
                      <div key={m.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[var(--app-text)] truncate">
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
                          className="px-3 py-1.5 rounded-lg bg-[var(--app-surface-2)] hover:bg-[var(--app-accent)] hover:text-[var(--app-accent-fg)] border border-[var(--app-border)] text-xs font-bold text-[var(--app-text)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Rate Match
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= SETTINGS VIEW ================= */}
        {section === 'settings' && (
          <div className="max-w-[920px] mx-auto px-4 sm:px-8 py-6 sm:py-8 flex flex-col gap-7" data-testid="settings-view">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--app-text)]">
                Settings
              </h1>
              <p className="text-sm text-[var(--app-text-muted)] mt-1">
                Customize your interface theme, app icon, chessboard materials, and Stockfish engine defaults.
              </p>
            </div>

            {/* 1. Interface Theme */}
            <section className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl p-5 flex flex-col gap-4">
              <div>
                <h2 className="text-base font-bold text-[var(--app-text)]">App Theme</h2>
                <p className="text-xs text-[var(--app-text-muted)] mt-0.5">
                  Applies immediately across Home, Profile, and the playing arena.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {APP_THEMES.map((t) => {
                  const active = preferences.appTheme === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onUpdatePreferences({ appTheme: t.id })}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-2.5 ${
                        active
                          ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)]'
                          : 'border-[var(--app-border)] bg-[var(--app-surface-2)] hover:border-[var(--app-border-strong)]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-5 h-5 rounded-md border border-black/25"
                            style={{ backgroundColor: t.swatchBg }}
                          />
                          <span
                            className="w-5 h-5 rounded-md border border-black/25"
                            style={{ backgroundColor: t.swatchSurface }}
                          />
                          <span
                            className="w-5 h-5 rounded-md border border-black/20"
                            style={{ backgroundColor: t.swatchAccent }}
                          />
                        </div>
                        {active && <Check className="w-4 h-4 text-[var(--app-accent)]" />}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-[var(--app-text)]">{t.name}</div>
                        <div className="text-[11px] text-[var(--app-text-muted)] mt-0.5 leading-snug">
                          {t.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 2. App Icon Picker */}
            <section className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl p-5 flex flex-col gap-4">
              <div>
                <h2 className="text-base font-bold text-[var(--app-text)]">App Icon</h2>
                <p className="text-xs text-[var(--app-text-muted)] mt-0.5">
                  Updates the Crownline emblem across the sidebar, arena header, and browser tab icon.
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {APP_ICONS.map((ic) => {
                  const active = preferences.appIcon === ic.id;
                  return (
                    <button
                      key={ic.id}
                      type="button"
                      onClick={() => onUpdatePreferences({ appIcon: ic.id })}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-colors cursor-pointer ${
                        active
                          ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)]'
                          : 'border-[var(--app-border)] bg-[var(--app-surface-2)] hover:border-[var(--app-border-strong)]'
                      }`}
                    >
                      <AppLogoIcon iconId={ic.id} className="w-12 h-12" />
                      <span className="text-xs font-semibold text-[var(--app-text)] text-center leading-tight">
                        {ic.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 3. Board Theme & Piece Style */}
            <section className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-3">
                <h2 className="text-base font-bold text-[var(--app-text)]">Board Theme</h2>
                <div className="grid grid-cols-2 gap-2.5">
                  {Object.values(BOARD_THEMES).map((b) => {
                    const active = preferences.boardTheme === b.id;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => onUpdatePreferences({ boardTheme: b.id as BoardThemeId })}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-colors cursor-pointer ${
                          active
                            ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)]'
                            : 'border-[var(--app-border)] bg-[var(--app-surface-2)] hover:border-[var(--app-border-strong)]'
                        }`}
                      >
                        <span className="w-8 h-8 rounded overflow-hidden grid grid-cols-2 grid-rows-2 shrink-0 border border-black/25">
                          <span style={{ backgroundColor: b.light }} />
                          <span style={{ backgroundColor: b.dark }} />
                          <span style={{ backgroundColor: b.dark }} />
                          <span style={{ backgroundColor: b.light }} />
                        </span>
                        <span className="text-xs font-bold text-[var(--app-text)] truncate">{b.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <h2 className="text-base font-bold text-[var(--app-text)]">Piece Style</h2>
                <div className="grid grid-cols-3 gap-2.5">
                  {(Object.keys(PIECE_STYLES) as PieceStyleId[]).map((pid) => {
                    const style = PIECE_STYLES[pid];
                    const active = preferences.pieceStyle === pid;
                    return (
                      <button
                        key={pid}
                        type="button"
                        onClick={() => onUpdatePreferences({ pieceStyle: pid })}
                        className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-colors cursor-pointer ${
                          active
                            ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)]'
                            : 'border-[var(--app-border)] bg-[var(--app-surface-2)] hover:border-[var(--app-border-strong)]'
                        }`}
                      >
                        <div className="flex items-center -space-x-2">
                          <div className="w-9 h-9">
                            <ChessPiece type="n" color="w" pieceStyle={pid} />
                          </div>
                          <div className="w-9 h-9">
                            <ChessPiece type="k" color="b" pieceStyle={pid} />
                          </div>
                        </div>
                        <span className="text-xs font-bold text-[var(--app-text)] text-center leading-tight">
                          {style.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* 4. Gameplay & Stockfish Defaults */}
            <section className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl p-5 flex flex-col gap-4">
              <h2 className="text-base font-bold text-[var(--app-text)]">Gameplay &amp; Stockfish Defaults</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  {
                    label: 'Show Evaluation Bar',
                    checked: preferences.showEvalBar,
                    toggle: () => onUpdatePreferences({ showEvalBar: !preferences.showEvalBar }),
                  },
                  {
                    label: 'Board Coordinates',
                    checked: preferences.showCoordinates,
                    toggle: () => onUpdatePreferences({ showCoordinates: !preferences.showCoordinates }),
                  },
                  {
                    label: 'Legal Move Dots',
                    checked: preferences.showLegalMoves,
                    toggle: () => onUpdatePreferences({ showLegalMoves: !preferences.showLegalMoves }),
                  },
                  {
                    label: 'Piece Sound Effects',
                    checked: !preferences.muted,
                    toggle: () => onUpdatePreferences({ muted: !preferences.muted }),
                  },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    role="switch"
                    aria-checked={opt.checked}
                    onClick={opt.toggle}
                    className="flex items-center justify-between px-3.5 py-3 rounded-xl bg-[var(--app-surface-2)] border border-[var(--app-border)] hover:border-[var(--app-border-strong)] transition-colors cursor-pointer"
                  >
                    <span className="text-xs font-semibold text-[var(--app-text)]">{opt.label}</span>
                    <span
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors flex items-center ${
                        opt.checked ? 'bg-[var(--app-accent)] justify-end' : 'bg-black/30 justify-start'
                      }`}
                    >
                      <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
                    </span>
                  </button>
                ))}
              </div>

              <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-5 items-center">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="pref-depth-slider" className="text-xs font-bold text-[var(--app-text)]">
                      Default Stockfish Depth
                    </label>
                    <span className="text-xs font-mono tabular-nums font-bold text-[var(--app-accent)]">
                      Depth {preferences.analysisDepth}
                    </span>
                  </div>
                  <input
                    id="pref-depth-slider"
                    type="range"
                    min={10}
                    max={20}
                    step={1}
                    value={preferences.analysisDepth}
                    onChange={(e) => onUpdatePreferences({ analysisDepth: Number(e.target.value) })}
                    className="w-full accent-[var(--app-accent)] cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--app-text)]">MultiPV Analysis Lines</span>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => onUpdatePreferences({ multiPv: n })}
                        className={`w-8 h-8 rounded-lg font-mono text-xs font-bold cursor-pointer ${
                          preferences.multiPv === n
                            ? 'bg-[var(--app-accent)] text-[var(--app-accent-fg)]'
                            : 'bg-[var(--app-surface-2)] text-[var(--app-text-muted)] border border-[var(--app-border)]'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ================= PROFILE VIEW ================= */}
        {section === 'profile' && (
          <div className="max-w-[920px] mx-auto px-4 sm:px-8 py-6 sm:py-8 flex flex-col gap-7" data-testid="profile-view">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--app-text)]">
                Player Profile
              </h1>
              <p className="text-sm text-[var(--app-text-muted)] mt-1">
                Manage your chess identity and inspect your Stockfish-rated match archive.
              </p>
            </div>

            {/* Identity Editor Card */}
            <section className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl p-5 flex flex-col md:flex-row gap-6 items-start">
              <div className="flex flex-col items-center gap-3 shrink-0">
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-extrabold text-[#12160D] shadow-md"
                  style={{ backgroundColor: profile.avatarColor }}
                >
                  {profile.displayName.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex items-center gap-1.5">
                  {AVATAR_COLORS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      aria-label={`Select avatar color ${hex}`}
                      onClick={() => onUpdateProfile({ avatarColor: hex })}
                      className={`w-5 h-5 rounded-full cursor-pointer border-2 ${
                        profile.avatarColor === hex ? 'border-[var(--app-text)] scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setProfileSavedToast(true);
                  setTimeout(() => setProfileSavedToast(false), 1800);
                }}
                className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-4"
              >
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="profile-name" className="text-xs font-bold text-[var(--app-text-muted)]">
                    Display Name
                  </label>
                  <input
                    id="profile-name"
                    type="text"
                    value={profile.displayName}
                    onChange={(e) => onUpdateProfile({ displayName: e.target.value || 'Player' })}
                    className="rounded-lg bg-[var(--app-surface-2)] border border-[var(--app-border-strong)] focus:border-[var(--app-accent)] focus:outline-none px-3 py-2 text-sm font-semibold text-[var(--app-text)]"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="profile-title" className="text-xs font-bold text-[var(--app-text-muted)]">
                    Player Title
                  </label>
                  <input
                    id="profile-title"
                    type="text"
                    value={profile.title}
                    onChange={(e) => onUpdateProfile({ title: e.target.value })}
                    className="rounded-lg bg-[var(--app-surface-2)] border border-[var(--app-border-strong)] focus:border-[var(--app-accent)] focus:outline-none px-3 py-2 text-sm text-[var(--app-text)]"
                  />
                </div>

                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <label htmlFor="profile-bio" className="text-xs font-bold text-[var(--app-text-muted)]">
                    Bio
                  </label>
                  <input
                    id="profile-bio"
                    type="text"
                    value={profile.bio}
                    onChange={(e) => onUpdateProfile({ bio: e.target.value })}
                    className="rounded-lg bg-[var(--app-surface-2)] border border-[var(--app-border-strong)] focus:border-[var(--app-accent)] focus:outline-none px-3 py-2 text-sm text-[var(--app-text)]"
                  />
                </div>

                <div className="sm:col-span-2 flex items-center justify-between">
                  <span className="text-xs text-[var(--app-accent)] font-semibold">
                    {profileSavedToast ? 'Profile saved locally.' : ''}
                  </span>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-[var(--app-accent-fg)] text-xs font-extrabold cursor-pointer"
                  >
                    Save Profile
                  </button>
                </div>
              </form>
            </section>

            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Matches Played', value: String(profileStats.total) },
                {
                  label: 'Record (W-D-L)',
                  value: `${profileStats.wins}-${profileStats.draws}-${profileStats.losses}`,
                },
                {
                  label: 'Avg Accuracy',
                  value: profileStats.avgAcc !== null ? `${profileStats.avgAcc}%` : '—',
                },
                {
                  label: 'Peak Game Elo',
                  value: profileStats.bestElo !== null ? String(profileStats.bestElo) : '—',
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl p-4"
                >
                  <div className="text-xs text-[var(--app-text-muted)]">{stat.label}</div>
                  <div className="text-2xl font-mono font-extrabold tabular-nums text-[var(--app-text)] mt-1">
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Full Saved Match Archive */}
            <section className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-[var(--app-text)]">Match History</h2>
                <span className="text-xs text-[var(--app-text-muted)]">Click any match to run Stockfish Rating</span>
              </div>
              <div className="flex flex-col divide-y divide-[var(--app-border)]">
                {savedMatches.map((m) => (
                  <div key={m.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-[var(--app-text)] truncate">
                        {m.whiteName} vs {m.blackName}
                      </div>
                      <div className="text-xs text-[var(--app-text-muted)] flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 font-mono tabular-nums">
                        <span className="font-bold text-[var(--app-text)]">{m.result}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-sans">{m.reason}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-sans">{m.openingName}</span>
                        <span aria-hidden="true">·</span>
                        <span>{m.movesCount} moves</span>
                        {typeof m.whiteGameElo === 'number' && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-[var(--app-accent)]">Est. {m.whiteGameElo} Elo</span>
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenMatchRating(m.pgn, `${m.whiteName} vs ${m.blackName}`)}
                      className="px-3.5 py-2 rounded-lg bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-[var(--app-accent-fg)] text-xs font-extrabold transition-colors flex items-center justify-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <span>Rate Match</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar — Strictly Home, Settings, Profile (<= 10% height) */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-[var(--app-rail)] border-t border-[var(--app-border)] grid grid-cols-3 h-14"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = section === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => onChangeSection(item.id)}
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

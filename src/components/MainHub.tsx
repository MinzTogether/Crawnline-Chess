import React, { useMemo, useRef, useState } from 'react';
import {
  Award,
  Camera,
  Check,
  ChevronRight,
  Cpu,
  Home,
  Settings,
  Swords,
  Trash2,
  Upload,
  User,
  Users,
} from 'lucide-react';
import {
  STOCKFISH_LEVELS,
  TIME_CONTROLS,
  type GameMode,
  type MatchSettings,
  type PlayerSideChoice,
} from '../types/chess';
import {
  type AppPreferences,
  type SavedMatch,
  type UserProfile,
} from '../types/preferences';
import { useI18n } from '../i18n/LanguageContext';
import { AppLogoIcon } from './AppIcons';
import { SettingsSection, type SettingsSubPage } from './SettingsSection';

export type HubSection = 'home' | 'settings' | 'profile';

const AVATAR_COLORS = ['#81B64C', '#5C9CE6', '#D99B3C', '#26C2A3', '#D96666', '#9C7EE6'];

function getProfileInitials(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return 'PL';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

/** Center-crops and compresses an uploaded image file to a 256x256 JPEG data URL for localStorage. */
function processAvatarFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose a valid image file (PNG, JPG, WebP, or GIF).'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected image file.'));
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : '';
      if (!src) {
        reject(new Error('Empty image data.'));
        return;
      }
      const img = new Image();
      img.onerror = () => reject(new Error('Unsupported image format.'));
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(src);
          return;
        }
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(canvas.toDataURL('image/webp', 0.88));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
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
  const [profileSavedToast, setProfileSavedToast] = useState(false);
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null);
  const [settingsSubPage, setSettingsSubPage] = useState<SettingsSubPage>('root');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const safeDisplayName = profile.displayName.trim() || 'Player';
  const safeTitle = profile.title.trim() || 'Chess Player';
  const profileInitials = getProfileInitials(safeDisplayName);

  const handleSelectNavSection = (next: HubSection) => {
    if (next === 'settings') {
      setSettingsSubPage('root');
    }
    onChangeSection(next);
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await processAvatarFile(file);
      onUpdateProfile({ avatarImage: dataUrl });
      setAvatarUploadError(null);
    } catch (err) {
      setAvatarUploadError(err instanceof Error ? err.message : 'Failed to upload image.');
    }
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
                  onClick={() => handleSelectNavSection(item.id)}
                  className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-bold transition-colors cursor-pointer whitespace-nowrap anim-interactive ${
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
          onClick={() => handleSelectNavSection('profile')}
          className="w-full overflow-hidden flex items-center gap-3 p-2.5 rounded-xl bg-[var(--app-surface)] border border-[var(--app-border)] hover:border-[var(--app-border-strong)] transition-colors text-left cursor-pointer anim-interactive"
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
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-[var(--app-text)] truncate">{safeDisplayName}</div>
            <div className="text-[11px] text-[var(--app-text-muted)] truncate">{safeTitle}</div>
          </div>
        </button>
      </aside>

      {/* Mobile Top Brand Bar */}
      <div className="md:hidden flex items-center justify-between gap-3 px-4 py-3 bg-[var(--app-rail)] border-b border-[var(--app-border)]">
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
      <main className="flex-1 min-w-0 pb-20 md:pb-8">
        {/* ================= HOME VIEW (CHESS.COM-STYLE MODE LAUNCHER, NO BOARD) ================= */}
        {section === 'home' && (
          <div
            key="hub-home"
            className="max-w-[1120px] mx-auto px-4 sm:px-8 py-6 sm:py-9 flex flex-col gap-7 anim-view-enter"
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

            {/* Chess.com-style 2-Column Mode Launcher (NO Chessboard): Mode List Left + Setup Panel Right */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Chess.com-Style Stacked Mode Selection Cards + Recent Matches */}
              <div className="lg:col-span-7 flex flex-col gap-6">
                <section aria-label={t('selectMode')} className="flex flex-col gap-3">
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
                          id: 'stockfish' as GameMode,
                          title: t('modeStockfishTitle'),
                          subtitle: t('modeStockfishDesc'),
                          meta: `${activeLevel.name} · ${activeLevel.elo} Elo`,
                          iconBg: 'rgba(129, 182, 76, 0.16)',
                          iconColor: '#81B64C',
                          icon: Cpu,
                        },
                        {
                          id: 'local' as GameMode,
                          title: t('modeLocalTitle'),
                          subtitle: t('modeLocalDesc'),
                          meta: t('modeLocalMeta'),
                          iconBg: 'rgba(80, 137, 198, 0.16)',
                          iconColor: '#5089C6',
                          icon: Users,
                        },
                        {
                          id: 'analysis' as GameMode,
                          title: t('modeAnalysisTitle'),
                          subtitle: t('modeAnalysisDesc'),
                          meta: t('modeAnalysisMeta'),
                          iconBg: 'rgba(27, 173, 166, 0.16)',
                          iconColor: '#1BADA6',
                          icon: Award,
                        },
                      ]
                    ).map((card, idx) => {
                      const Icon = card.icon;
                      const active = matchSettings.mode === card.id;
                      return (
                        <button
                          key={card.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => onChangeMatchSettings({ ...matchSettings, mode: card.id })}
                          style={{ '--stagger': idx } as React.CSSProperties}
                          className={`w-full p-4 sm:p-5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-4 group anim-card-stagger anim-interactive ${
                            active
                              ? 'bg-[var(--app-surface)] border-[var(--app-accent)] shadow-sm'
                              : 'bg-[var(--app-surface)] border-[var(--app-border)] hover:border-[var(--app-border-strong)] hover:bg-[var(--app-surface-hover)]'
                          }`}
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <div
                              className="w-13 h-13 rounded-xl flex items-center justify-center shrink-0 border border-white/10"
                              style={{ backgroundColor: card.iconBg }}
                            >
                              <Icon className="w-6 h-6" style={{ color: card.iconColor }} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-base sm:text-lg font-extrabold text-[var(--app-text)] leading-tight truncate">
                                  {card.title}
                                </span>
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
                            {active ? (
                              <Check className="w-5 h-5 text-[var(--app-accent)]" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-[var(--app-text-subtle)] group-hover:text-[var(--app-text)] transition-colors" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Recent Matches Strip with One-Click "Rate Match" */}
                <section
                  style={{ '--stagger': 3 } as React.CSSProperties}
                  className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl p-5 flex flex-col gap-3 anim-card-stagger"
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
                    {savedMatches.slice(0, 3).map((m) => (
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

              {/* Right Column: Sticky Chess.com-Style Match Setup & Launch Panel */}
              <div className="lg:col-span-5 lg:sticky lg:top-6">
                <div
                  key={`setup-${matchSettings.mode}`}
                  className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl p-5 sm:p-6 flex flex-col gap-5 shadow-sm anim-view-enter"
                >
                  {/* Panel Header */}
                  <div className="pb-4 border-b border-[var(--app-border)]">
                    <div className="text-xs font-semibold text-[var(--app-accent)]">
                      {matchSettings.mode === 'stockfish'
                        ? t('setupEngineLabel')
                        : matchSettings.mode === 'local'
                          ? t('setupLocalLabel')
                          : t('setupReviewLabel')}
                    </div>
                    <h2 className="text-lg font-extrabold text-[var(--app-text)] mt-0.5">
                      {matchSettings.mode === 'stockfish'
                        ? t('modeStockfishTitle')
                        : matchSettings.mode === 'local'
                          ? t('modeLocalTitle')
                          : t('modeAnalysisTitle')}
                    </h2>
                  </div>

                  {matchSettings.mode === 'analysis' ? (
                    <>
                      <p className="text-xs text-[var(--app-text-muted)] leading-relaxed -mt-1">
                        {t('analysisIntro')}
                      </p>

                      <form onSubmit={handleQuickRateSubmit} className="flex flex-col gap-3">
                        <label htmlFor="hub-pgn-rate" className="text-xs font-semibold text-[var(--app-text-muted)]">
                          {t('pgnToRateOptional')}
                        </label>
                        <textarea
                          id="hub-pgn-rate"
                          rows={4}
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
                    </>
                  ) : (
                    <>
                      {/* Stockfish Strength Picker */}
                      {matchSettings.mode === 'stockfish' && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-[var(--app-text-muted)]">
                              {t('stockfishStrength')}
                            </span>
                            <span className="text-xs font-mono tabular-nums font-bold text-[var(--app-accent)]">
                              {activeLevel.name} · {activeLevel.elo}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {STOCKFISH_LEVELS.map((lvl) => {
                              const selected = lvl.id === matchSettings.stockfishLevelId;
                              return (
                                <button
                                  key={lvl.id}
                                  type="button"
                                  onClick={() =>
                                    onChangeMatchSettings({ ...matchSettings, stockfishLevelId: lvl.id })
                                  }
                                  className={`py-2.5 px-2.5 rounded-lg text-left border transition-colors cursor-pointer anim-interactive ${
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
                          {t('timeControl')}
                        </span>
                        <div className="grid grid-cols-4 gap-1.5">
                          {TIME_CONTROLS.map((tc) => {
                            const selected = tc.id === matchSettings.timeControlId;
                            return (
                              <button
                                key={tc.id}
                                type="button"
                                onClick={() => onChangeMatchSettings({ ...matchSettings, timeControlId: tc.id })}
                                className={`py-2 px-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap truncate cursor-pointer anim-interactive ${
                                  tc.id === 'unlimited' ? 'col-span-2' : ''
                                } ${
                                  selected
                                    ? 'bg-[var(--app-accent-soft)] border-[var(--app-accent)] text-[var(--app-text)]'
                                    : 'bg-[var(--app-surface-2)] border-[var(--app-border)] text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
                                }`}
                              >
                                {tc.id === 'unlimited' ? t('unlimited') : tc.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Side Selection */}
                      {matchSettings.mode === 'stockfish' && (
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold text-[var(--app-text-muted)]">{t('playAs')}</span>
                          <div className="flex items-center gap-1.5">
                            {(
                              [
                                { id: 'w', label: t('white') },
                                { id: 'random', label: t('random') },
                                { id: 'b', label: t('black') },
                              ] as { id: PlayerSideChoice; label: string }[]
                            ).map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => onChangeMatchSettings({ ...matchSettings, playerSide: s.id })}
                                className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer anim-interactive ${
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
                        className="w-full py-3.5 px-5 rounded-xl bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-[var(--app-accent-fg)] font-extrabold text-base tracking-tight transition-all shadow-[0_4px_0_var(--app-accent-shadow)] cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap mt-1 anim-interactive"
                      >
                        <Swords className="w-4 h-4" />
                        <span>
                          {matchSettings.mode === 'stockfish' ? t('startPlayStockfish') : t('startPassPlay')}
                        </span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
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
          <div
            key="hub-profile"
            className="max-w-[920px] mx-auto px-4 sm:px-8 py-6 sm:py-8 flex flex-col gap-7 anim-view-enter"
            data-testid="profile-view"
          >
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--app-text)]">
                {t('profileTitle')}
              </h1>
              <p className="text-sm text-[var(--app-text-muted)] mt-1">{t('profileSubtitle')}</p>
            </div>

            {/* Identity Editor Card */}
            <section className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl p-5 flex flex-col md:flex-row gap-6 items-start">
              <div className="flex flex-col items-center gap-3 shrink-0 w-full md:w-auto">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  aria-label={t('uploadPhoto')}
                  onChange={handleAvatarFileChange}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title={t('uploadPhoto')}
                  className="relative group w-24 h-24 rounded-2xl overflow-hidden shadow-md border border-[var(--app-border-strong)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--app-accent)] anim-interactive"
                >
                  {profile.avatarImage ? (
                    <img
                      src={profile.avatarImage}
                      alt={safeDisplayName}
                      data-testid="profile-avatar-img"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center text-2xl font-extrabold text-[#12160D]"
                      style={{ backgroundColor: profile.avatarColor }}
                    >
                      {profileInitials}
                    </div>
                  )}
                  <span className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-white text-[11px] font-bold">
                    <Camera className="w-5 h-5" />
                    <span>{t('changePhoto')}</span>
                  </span>
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-hover)] border border-[var(--app-border-strong)] text-xs font-semibold text-[var(--app-text)] transition-colors cursor-pointer whitespace-nowrap anim-interactive"
                  >
                    <Upload className="w-3.5 h-3.5 text-[var(--app-accent)]" />
                    <span>{t('uploadPhoto')}</span>
                  </button>
                  {profile.avatarImage && (
                    <button
                      type="button"
                      aria-label={t('removePhoto')}
                      title={t('removePhoto')}
                      onClick={() => {
                        onUpdateProfile({ avatarImage: null });
                        setAvatarUploadError(null);
                      }}
                      className="p-1.5 rounded-lg bg-[var(--app-surface-2)] hover:bg-[#C94A4A]/20 border border-[var(--app-border-strong)] text-[var(--app-text-muted)] hover:text-[#E04F4F] transition-colors cursor-pointer anim-interactive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {avatarUploadError && (
                  <p className="text-[11px] text-[#E04F4F] text-center max-w-[160px]">{avatarUploadError}</p>
                )}

                {!profile.avatarImage && (
                  <div className="flex items-center gap-1.5">
                    {AVATAR_COLORS.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        aria-label={`Select avatar color ${hex}`}
                        onClick={() => onUpdateProfile({ avatarColor: hex })}
                        className={`w-5 h-5 rounded-full cursor-pointer border-2 anim-interactive ${
                          profile.avatarColor === hex ? 'border-[var(--app-text)] scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </div>
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onUpdateProfile({
                    displayName: profile.displayName.trim() || 'Player',
                    title: profile.title.trim() || 'Club Player',
                  });
                  setProfileSavedToast(true);
                  setTimeout(() => setProfileSavedToast(false), 1800);
                }}
                className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-4"
              >
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="profile-name" className="text-xs font-bold text-[var(--app-text-muted)]">
                    {t('displayNameLabel')}
                  </label>
                  <input
                    id="profile-name"
                    type="text"
                    maxLength={40}
                    placeholder={t('displayNamePlaceholder')}
                    value={profile.displayName}
                    onChange={(e) => onUpdateProfile({ displayName: e.target.value })}
                    onBlur={() => {
                      if (!profile.displayName.trim()) {
                        onUpdateProfile({ displayName: 'Player' });
                      }
                    }}
                    className="rounded-lg bg-[var(--app-surface-2)] border border-[var(--app-border-strong)] focus:border-[var(--app-accent)] focus:outline-none px-3 py-2 text-sm font-semibold text-[var(--app-text)]"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="profile-title" className="text-xs font-bold text-[var(--app-text-muted)]">
                    {t('playerTitleLabel')}
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
                    {t('bioLabel')}
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
                    {profileSavedToast ? t('profileSavedLocally') : ''}
                  </span>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-[var(--app-accent-fg)] text-xs font-extrabold cursor-pointer anim-interactive"
                  >
                    {t('saveProfile')}
                  </button>
                </div>
              </form>
            </section>

            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: t('matchesPlayed'), value: String(profileStats.total) },
                {
                  label: t('recordWDL'),
                  value: `${profileStats.wins}-${profileStats.draws}-${profileStats.losses}`,
                },
                {
                  label: t('avgAccuracy'),
                  value: profileStats.avgAcc !== null ? `${profileStats.avgAcc}%` : '—',
                },
                {
                  label: t('peakGameElo'),
                  value: profileStats.bestElo !== null ? String(profileStats.bestElo) : '—',
                },
              ].map((stat, idx) => (
                <div
                  key={stat.label}
                  style={{ '--stagger': idx } as React.CSSProperties}
                  className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl p-4 anim-card-stagger"
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
                <h2 className="text-base font-bold text-[var(--app-text)]">{t('matchHistory')}</h2>
                <span className="text-xs text-[var(--app-text-muted)]">{t('clickToRateHint')}</span>
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
                        <span>
                          {m.movesCount} {t('movesUnit')}
                        </span>
                        {typeof m.whiteGameElo === 'number' && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-[var(--app-accent)]">
                              {t('estEloPrefix')} {m.whiteGameElo} Elo
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenMatchRating(m.pgn, `${m.whiteName} vs ${m.blackName}`)}
                      className="px-3.5 py-2 rounded-lg bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-[var(--app-accent-fg)] text-xs font-extrabold transition-colors flex items-center justify-center gap-1 whitespace-nowrap shrink-0 cursor-pointer anim-interactive"
                    >
                      <span>{t('rateMatch')}</span>
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

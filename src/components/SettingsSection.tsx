import React, { useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Crown,
  Globe,
  Grid2x2,
  Palette,
  Play,
  SlidersHorizontal,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { BOARD_THEMES, type BoardThemeCategory, type BoardThemeId } from '../types/chess';
import {
  APP_THEMES,
  PIECE_STYLES,
  type AnimationLevelId,
  type AppPreferences,
  type PieceStyleId,
} from '../types/preferences';
import { LANGUAGE_OPTIONS } from '../i18n/translations';
import { useI18n } from '../i18n/LanguageContext';
import { APP_ICONS, AppLogoIcon } from './AppIcons';
import { ChessPiece } from './ChessPieces';
import { MoveBadge } from './MoveBadge';

export type SettingsSubPage =
  | 'root'
  | 'app-theme'
  | 'app-icon'
  | 'board-theme'
  | 'piece-style'
  | 'animations'
  | 'language'
  | 'gameplay';

interface SettingsSectionProps {
  subPage: SettingsSubPage;
  onChangeSubPage: (page: SettingsSubPage) => void;
  preferences: AppPreferences;
  onUpdatePreferences: (patch: Partial<AppPreferences>) => void;
}

const PREVIEW_ROW_PIECES: Array<{ type: 'r' | 'n' | 'b' | 'q' | 'k' | 'p'; color: 'w' | 'b' }> = [
  { type: 'r', color: 'w' },
  { type: 'n', color: 'w' },
  { type: 'b', color: 'w' },
  { type: 'q', color: 'w' },
  { type: 'k', color: 'w' },
  { type: 'p', color: 'w' },
  { type: 'r', color: 'b' },
  { type: 'n', color: 'b' },
  { type: 'b', color: 'b' },
  { type: 'q', color: 'b' },
  { type: 'k', color: 'b' },
  { type: 'p', color: 'b' },
];

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  subPage,
  onChangeSubPage,
  preferences,
  onUpdatePreferences,
}) => {
  const { t } = useI18n();
  const [themeFilter, setThemeFilter] = useState<'all' | 'chesscom' | 'dark' | 'light'>('all');
  const [boardCategoryFilter, setBoardCategoryFilter] = useState<'All' | BoardThemeCategory>('All');
  const [previewStep, setPreviewStep] = useState<number>(0);

  const activeTheme = APP_THEMES.find((item) => item.id === preferences.appTheme) ?? APP_THEMES[0];
  const activeIcon = APP_ICONS.find((item) => item.id === preferences.appIcon) ?? APP_ICONS[0];
  const activeBoard = BOARD_THEMES[preferences.boardTheme] ?? BOARD_THEMES.tournament;
  const activePiece = PIECE_STYLES[preferences.pieceStyle] ?? PIECE_STYLES.classic;
  const activeLangOption =
    LANGUAGE_OPTIONS.find((item) => item.id === preferences.language) ?? LANGUAGE_OPTIONS[1];

  const animationPresets: Array<{ id: AnimationLevelId; name: string; desc: string }> = [
    { id: 'off', name: t('animOff'), desc: t('animOffDesc') },
    { id: 'subtle', name: t('animSubtle'), desc: t('animSubtleDesc') },
    { id: 'smooth', name: t('animSmooth'), desc: t('animSmoothDesc') },
    { id: 'expressive', name: t('animExpressive'), desc: t('animExpressiveDesc') },
  ];
  const activeAnimPreset =
    animationPresets.find((p) => p.id === preferences.animationLevel) ?? animationPresets[2];

  const chessComThemes = APP_THEMES.filter((item) => item.isChessCom);
  const darkThemes = APP_THEMES.filter((item) => !item.isLight && !item.isChessCom);
  const lightThemes = APP_THEMES.filter((item) => item.isLight && !item.isChessCom);
  const allDarkCount = APP_THEMES.filter((item) => !item.isLight).length;
  const allLightCount = APP_THEMES.filter((item) => item.isLight).length;
  const allBoards = [
    ...Object.values(BOARD_THEMES).filter((b) => b.category === 'Chess.com'),
    ...Object.values(BOARD_THEMES).filter((b) => b.category !== 'Chess.com'),
  ];
  const filteredBoards =
    boardCategoryFilter === 'All'
      ? allBoards
      : allBoards.filter((b) => b.category === boardCategoryFilter);

  if (subPage === 'root') {
    return (
      <div
        key="settings-root"
        className="max-w-[920px] mx-auto px-4 sm:px-8 py-6 sm:py-8 flex flex-col gap-6 anim-view-enter"
        data-testid="settings-view"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--app-text)]">
            {t('settingsTitle')}
          </h1>
          <p className="text-sm text-[var(--app-text-muted)] mt-1">{t('settingsSubtitle')}</p>
        </div>

        {/* Categorized Drill-Down Setting Sections */}
        <div className="flex flex-col gap-3">
          {/* 1. App Theme */}
          <button
            type="button"
            onClick={() => onChangeSubPage('app-theme')}
            style={{ '--stagger': 0 } as React.CSSProperties}
            className="w-full p-4 sm:p-5 rounded-xl bg-[var(--app-surface)] border border-[var(--app-border)] hover:border-[var(--app-accent)] hover:bg-[var(--app-surface-hover)] transition-all flex items-center justify-between gap-4 text-left cursor-pointer group anim-card-stagger anim-interactive"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-[var(--app-surface-2)] border border-[var(--app-border)] flex items-center justify-center shrink-0">
                <Palette className="w-5 h-5 text-[var(--app-accent)]" />
              </div>
              <div className="min-w-0">
                <div className="text-base font-bold text-[var(--app-text)]">{t('catAppTheme')}</div>
                <div className="text-xs text-[var(--app-text-muted)] mt-0.5 truncate">
                  {t('currentLabel')}:{' '}
                  <span className="font-semibold text-[var(--app-text)]">{activeTheme.name}</span> ·{' '}
                  {APP_THEMES.length} {t('catAppThemeUnit')}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="hidden sm:flex items-center gap-1">
                <span className="w-4 h-4 rounded border border-black/25" style={{ backgroundColor: activeTheme.swatchBg }} />
                <span className="w-4 h-4 rounded border border-black/25" style={{ backgroundColor: activeTheme.swatchSurface }} />
                <span className="w-4 h-4 rounded border border-black/20" style={{ backgroundColor: activeTheme.swatchAccent }} />
              </div>
              <ChevronRight className="w-5 h-5 text-[var(--app-text-muted)] group-hover:text-[var(--app-accent)] transition-colors" />
            </div>
          </button>

          {/* 2. App Icon */}
          <button
            type="button"
            onClick={() => onChangeSubPage('app-icon')}
            style={{ '--stagger': 1 } as React.CSSProperties}
            className="w-full p-4 sm:p-5 rounded-xl bg-[var(--app-surface)] border border-[var(--app-border)] hover:border-[var(--app-accent)] hover:bg-[var(--app-surface-hover)] transition-all flex items-center justify-between gap-4 text-left cursor-pointer group anim-card-stagger anim-interactive"
          >
            <div className="flex items-center gap-4 min-w-0">
              <AppLogoIcon iconId={preferences.appIcon} className="w-12 h-12 shrink-0" />
              <div className="min-w-0">
                <div className="text-base font-bold text-[var(--app-text)]">{t('catAppIcon')}</div>
                <div className="text-xs text-[var(--app-text-muted)] mt-0.5 truncate">
                  {t('currentLabel')}:{' '}
                  <span className="font-semibold text-[var(--app-text)]">{activeIcon.name}</span> ·{' '}
                  {APP_ICONS.length} {t('catAppIconUnit')}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="hidden sm:inline text-xs font-medium text-[var(--app-text-muted)]">
                {activeIcon.subtitle}
              </span>
              <ChevronRight className="w-5 h-5 text-[var(--app-text-muted)] group-hover:text-[var(--app-accent)] transition-colors" />
            </div>
          </button>

          {/* 3. Board Theme */}
          <button
            type="button"
            onClick={() => onChangeSubPage('board-theme')}
            style={{ '--stagger': 2 } as React.CSSProperties}
            className="w-full p-4 sm:p-5 rounded-xl bg-[var(--app-surface)] border border-[var(--app-border)] hover:border-[var(--app-accent)] hover:bg-[var(--app-surface-hover)] transition-all flex items-center justify-between gap-4 text-left cursor-pointer group anim-card-stagger anim-interactive"
          >
            <div className="flex items-center gap-4 min-w-0">
              <span className="w-12 h-12 rounded-xl overflow-hidden grid grid-cols-2 grid-rows-2 shrink-0 border border-black/25 shadow-sm">
                <span style={{ backgroundColor: activeBoard.light }} />
                <span style={{ backgroundColor: activeBoard.dark }} />
                <span style={{ backgroundColor: activeBoard.dark }} />
                <span style={{ backgroundColor: activeBoard.light }} />
              </span>
              <div className="min-w-0">
                <div className="text-base font-bold text-[var(--app-text)]">{t('catBoardTheme')}</div>
                <div className="text-xs text-[var(--app-text-muted)] mt-0.5 truncate">
                  {t('currentLabel')}:{' '}
                  <span className="font-semibold text-[var(--app-text)]">{activeBoard.name}</span> ·{' '}
                  {Object.keys(BOARD_THEMES).length} {t('catBoardThemeUnit')}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Grid2x2 className="hidden sm:block w-4 h-4 text-[var(--app-text-subtle)]" />
              <ChevronRight className="w-5 h-5 text-[var(--app-text-muted)] group-hover:text-[var(--app-accent)] transition-colors" />
            </div>
          </button>

          {/* 4. Piece Style */}
          <button
            type="button"
            onClick={() => onChangeSubPage('piece-style')}
            style={{ '--stagger': 3 } as React.CSSProperties}
            className="w-full p-4 sm:p-5 rounded-xl bg-[var(--app-surface)] border border-[var(--app-border)] hover:border-[var(--app-accent)] hover:bg-[var(--app-surface-hover)] transition-all flex items-center justify-between gap-4 text-left cursor-pointer group anim-card-stagger anim-interactive"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-[var(--app-surface-2)] border border-[var(--app-border)] flex items-center justify-center -space-x-2 shrink-0 px-1">
                <div className="w-7 h-7">
                  <ChessPiece type="n" color="w" pieceStyle={preferences.pieceStyle} />
                </div>
                <div className="w-7 h-7">
                  <ChessPiece type="k" color="b" pieceStyle={preferences.pieceStyle} />
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-base font-bold text-[var(--app-text)]">{t('catPieceStyle')}</div>
                <div className="text-xs text-[var(--app-text-muted)] mt-0.5 truncate">
                  {t('currentLabel')}:{' '}
                  <span className="font-semibold text-[var(--app-text)]">{activePiece.name}</span> ·{' '}
                  {Object.keys(PIECE_STYLES).length} {t('catPieceStyleUnit')}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Crown className="hidden sm:block w-4 h-4 text-[var(--app-text-subtle)]" />
              <ChevronRight className="w-5 h-5 text-[var(--app-text-muted)] group-hover:text-[var(--app-accent)] transition-colors" />
            </div>
          </button>

          {/* 5. Animations & Motion */}
          <button
            type="button"
            data-testid="settings-row-animations"
            onClick={() => onChangeSubPage('animations')}
            style={{ '--stagger': 4 } as React.CSSProperties}
            className="w-full p-4 sm:p-5 rounded-xl bg-[var(--app-surface)] border border-[var(--app-border)] hover:border-[var(--app-accent)] hover:bg-[var(--app-surface-hover)] transition-all flex items-center justify-between gap-4 text-left cursor-pointer group anim-card-stagger anim-interactive"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-[var(--app-surface-2)] border border-[var(--app-border)] flex items-center justify-center shrink-0">
                <Wand2 className="w-5 h-5 text-[var(--app-accent)]" />
              </div>
              <div className="min-w-0">
                <div className="text-base font-bold text-[var(--app-text)]">{t('catAnimations')}</div>
                <div className="text-xs text-[var(--app-text-muted)] mt-0.5 truncate">
                  {t('currentLabel')}:{' '}
                  <span className="font-semibold text-[var(--app-text)]">{activeAnimPreset.name}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Sparkles className="hidden sm:block w-4 h-4 text-[var(--app-text-subtle)]" />
              <ChevronRight className="w-5 h-5 text-[var(--app-text-muted)] group-hover:text-[var(--app-accent)] transition-colors" />
            </div>
          </button>

          {/* 6. Language (VN / EN / TW / JP) */}
          <button
            type="button"
            data-testid="settings-row-language"
            onClick={() => onChangeSubPage('language')}
            style={{ '--stagger': 5 } as React.CSSProperties}
            className="w-full p-4 sm:p-5 rounded-xl bg-[var(--app-surface)] border border-[var(--app-border)] hover:border-[var(--app-accent)] hover:bg-[var(--app-surface-hover)] transition-all flex items-center justify-between gap-4 text-left cursor-pointer group anim-card-stagger anim-interactive"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-[var(--app-surface-2)] border border-[var(--app-border)] flex items-center justify-center shrink-0">
                <Globe className="w-5 h-5 text-[var(--app-accent)]" />
              </div>
              <div className="min-w-0">
                <div className="text-base font-bold text-[var(--app-text)]">{t('catLanguage')}</div>
                <div className="text-xs text-[var(--app-text-muted)] mt-0.5 truncate">
                  {t('currentLabel')}:{' '}
                  <span className="font-semibold text-[var(--app-text)]">
                    {activeLangOption.nativeName}
                  </span>{' '}
                  · VN / EN / TW / JP
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="px-2 py-0.5 rounded-md bg-[var(--app-surface-2)] border border-[var(--app-border)] text-xs font-mono font-bold text-[var(--app-accent)]">
                {activeLangOption.code}
              </span>
              <ChevronRight className="w-5 h-5 text-[var(--app-text-muted)] group-hover:text-[var(--app-accent)] transition-colors" />
            </div>
          </button>

          {/* 7. Gameplay & Stockfish */}
          <button
            type="button"
            onClick={() => onChangeSubPage('gameplay')}
            style={{ '--stagger': 6 } as React.CSSProperties}
            className="w-full p-4 sm:p-5 rounded-xl bg-[var(--app-surface)] border border-[var(--app-border)] hover:border-[var(--app-accent)] hover:bg-[var(--app-surface-hover)] transition-all flex items-center justify-between gap-4 text-left cursor-pointer group anim-card-stagger anim-interactive"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-[var(--app-surface-2)] border border-[var(--app-border)] flex items-center justify-center shrink-0">
                <SlidersHorizontal className="w-5 h-5 text-[var(--app-accent)]" />
              </div>
              <div className="min-w-0">
                <div className="text-base font-bold text-[var(--app-text)]">{t('catGameplay')}</div>
                <div className="text-xs text-[var(--app-text-muted)] mt-0.5 font-mono tabular-nums truncate">
                  {t('depthLabel')} {preferences.analysisDepth} · {preferences.multiPv} {t('pvLinesUnit')} ·{' '}
                  {preferences.muted ? t('audioMuted') : t('audioOn')}
                </div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[var(--app-text-muted)] group-hover:text-[var(--app-accent)] transition-colors shrink-0" />
          </button>
        </div>
      </div>
    );
  }

  // Knight preview coordinates on a 4x2 mini board: jumps between (col 0, row 1) and (col 2, row 0)
  const previewAtDest = previewStep % 2 === 1;
  const knightDestCol = previewAtDest ? 2 : 0;
  const knightDestRow = previewAtDest ? 0 : 1;
  const knightSlideX = previewAtDest ? -2 : 2;
  const knightSlideY = previewAtDest ? 1 : -1;

  return (
    <div
      key={`settings-subpage-${subPage}`}
      className="max-w-[960px] mx-auto px-4 sm:px-8 py-6 sm:py-8 flex flex-col gap-6 anim-view-enter"
      data-testid={`settings-subpage-${subPage}`}
    >
      {/* Sub-page Back Header */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => onChangeSubPage('root')}
          className="self-start inline-flex items-center gap-1.5 text-xs font-bold text-[var(--app-accent)] hover:underline cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{t('backToSettings')}</span>
        </button>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--app-text)]">
              {subPage === 'app-theme' && t('catAppTheme')}
              {subPage === 'app-icon' && t('catAppIcon')}
              {subPage === 'board-theme' && t('catBoardTheme')}
              {subPage === 'piece-style' && t('catPieceStyle')}
              {subPage === 'animations' && t('catAnimations')}
              {subPage === 'language' && t('catLanguage')}
              {subPage === 'gameplay' && t('catGameplay')}
            </h1>
            <p className="text-sm text-[var(--app-text-muted)] mt-1">
              {subPage === 'app-theme' && t('catAppThemeSub', { count: APP_THEMES.length })}
              {subPage === 'app-icon' && t('catAppIconSub')}
              {subPage === 'board-theme' && t('catBoardThemeSub', { count: allBoards.length })}
              {subPage === 'piece-style' && t('catPieceStyleSub')}
              {subPage === 'animations' && t('catAnimationsSub')}
              {subPage === 'language' && t('catLanguageSub')}
              {subPage === 'gameplay' && t('catGameplaySub')}
            </p>
          </div>
        </div>
      </div>

      {/* SUB-PAGE 1: APP THEME */}
      {subPage === 'app-theme' && (
        <div className="flex flex-col gap-5">
          <div
            role="group"
            aria-label="Filter app themes"
            className="self-start inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[var(--app-surface)] border border-[var(--app-border)]"
          >
            {(
              [
                { id: 'all', label: `${t('filterAll')} (${APP_THEMES.length})` },
                { id: 'chesscom', label: `Chess.com (${chessComThemes.length})` },
                { id: 'dark', label: `${t('filterDark')} (${allDarkCount})` },
                { id: 'light', label: `${t('filterLight')} (${allLightCount})` },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                aria-pressed={themeFilter === opt.id}
                onClick={() => setThemeFilter(opt.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  themeFilter === opt.id
                    ? 'bg-[var(--app-accent)] text-[var(--app-accent-fg)]'
                    : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {(themeFilter === 'all' || themeFilter === 'chesscom') && (
            <section className="flex flex-col gap-3">
              <h2 className="text-xs font-bold tracking-wide text-[var(--app-text-muted)]">
                {t('chessComThemesHeading')} ({chessComThemes.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {chessComThemes.map((item) => {
                  const active = preferences.appTheme === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onUpdatePreferences({ appTheme: item.id })}
                      className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-3 anim-interactive ${
                        active
                          ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)]'
                          : 'border-[var(--app-border)] bg-[var(--app-surface)] hover:border-[var(--app-border-strong)]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-6 h-6 rounded-md border border-black/20" style={{ backgroundColor: item.swatchBg }} />
                          <span className="w-6 h-6 rounded-md border border-black/20" style={{ backgroundColor: item.swatchSurface }} />
                          <span className="w-6 h-6 rounded-md border border-black/20" style={{ backgroundColor: item.swatchAccent }} />
                        </div>
                        {active && <Check className="w-4 h-4 text-[var(--app-accent)]" />}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-[var(--app-text)]">{item.name}</div>
                        <div className="text-xs text-[var(--app-text-muted)] mt-0.5 leading-snug">{item.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {(themeFilter === 'all' || themeFilter === 'dark') && (
            <section className="flex flex-col gap-3">
              <h2 className="text-xs font-bold tracking-wide text-[var(--app-text-muted)]">
                {t('darkThemesHeading')} ({themeFilter === 'dark' ? allDarkCount : darkThemes.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(themeFilter === 'dark' ? APP_THEMES.filter((item) => !item.isLight) : darkThemes).map((item) => {
                  const active = preferences.appTheme === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onUpdatePreferences({ appTheme: item.id })}
                      className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-3 anim-interactive ${
                        active
                          ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)]'
                          : 'border-[var(--app-border)] bg-[var(--app-surface)] hover:border-[var(--app-border-strong)]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-6 h-6 rounded-md border border-white/15" style={{ backgroundColor: item.swatchBg }} />
                          <span className="w-6 h-6 rounded-md border border-white/15" style={{ backgroundColor: item.swatchSurface }} />
                          <span className="w-6 h-6 rounded-md border border-black/20" style={{ backgroundColor: item.swatchAccent }} />
                        </div>
                        {active && <Check className="w-4 h-4 text-[var(--app-accent)]" />}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-[var(--app-text)]">{item.name}</div>
                        <div className="text-xs text-[var(--app-text-muted)] mt-0.5 leading-snug">{item.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {(themeFilter === 'all' || themeFilter === 'light') && (
            <section className="flex flex-col gap-3">
              <h2 className="text-xs font-bold tracking-wide text-[var(--app-text-muted)]">
                {t('lightThemesHeading')} ({themeFilter === 'light' ? allLightCount : lightThemes.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(themeFilter === 'light' ? APP_THEMES.filter((item) => item.isLight) : lightThemes).map((item) => {
                  const active = preferences.appTheme === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onUpdatePreferences({ appTheme: item.id })}
                      className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-3 anim-interactive ${
                        active
                          ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)]'
                          : 'border-[var(--app-border)] bg-[var(--app-surface)] hover:border-[var(--app-border-strong)]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-6 h-6 rounded-md border border-black/20" style={{ backgroundColor: item.swatchBg }} />
                          <span className="w-6 h-6 rounded-md border border-black/20" style={{ backgroundColor: item.swatchSurface }} />
                          <span className="w-6 h-6 rounded-md border border-black/20" style={{ backgroundColor: item.swatchAccent }} />
                        </div>
                        {active && <Check className="w-4 h-4 text-[var(--app-accent)]" />}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-[var(--app-text)]">{item.name}</div>
                        <div className="text-xs text-[var(--app-text-muted)] mt-0.5 leading-snug">{item.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {/* SUB-PAGE 2: FUTURISTIC FROSTED-JADE APP ICON */}
      {subPage === 'app-icon' && (
        <div className="flex flex-col gap-5">
          <div className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <AppLogoIcon iconId={preferences.appIcon} className="w-14 h-14 shrink-0" />
              <div>
                <div className="text-xs font-semibold text-[var(--app-accent)] flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t('activeAppEmblem')}</span>
                </div>
                <div className="text-lg font-extrabold text-[var(--app-text)] leading-tight mt-0.5">
                  {activeIcon.name}
                </div>
                <div className="text-xs text-[var(--app-text-muted)]">{activeIcon.subtitle}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {APP_ICONS.map((ic) => {
              const active = preferences.appIcon === ic.id;
              return (
                <button
                  key={ic.id}
                  type="button"
                  onClick={() => onUpdatePreferences({ appIcon: ic.id })}
                  className={`p-4 rounded-xl border flex flex-col items-center gap-3 transition-all cursor-pointer relative anim-interactive ${
                    active
                      ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)]'
                      : 'border-[var(--app-border)] bg-[var(--app-surface)] hover:border-[var(--app-border-strong)]'
                  }`}
                >
                  {active && (
                    <span className="absolute top-2.5 right-2.5 text-[var(--app-accent)]">
                      <Check className="w-4 h-4" />
                    </span>
                  )}
                  <AppLogoIcon iconId={ic.id} className="w-16 h-16" />
                  <div className="text-center">
                    <div className="text-sm font-bold text-[var(--app-text)] leading-tight">{ic.name}</div>
                    <div className="text-[11px] text-[var(--app-text-muted)] mt-0.5">{ic.subtitle}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-PAGE 3: BOARD THEME */}
      {subPage === 'board-theme' && (
        <div className="flex flex-col gap-5">
          <div className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[var(--app-text)]">
                {t('livePreview')} · {activeBoard.name}
              </span>
              <span className="text-[var(--app-text-muted)]">
                {t('piecesLabel')}: {activePiece.name}
              </span>
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-12 rounded-lg overflow-hidden border border-black/25">
              {PREVIEW_ROW_PIECES.map((item, idx) => {
                const isLight = idx % 2 === 0;
                const isLastMove = idx === 3 || idx === 4;
                const bg = isLastMove
                  ? isLight
                    ? activeBoard.lastMoveLight
                    : activeBoard.lastMoveDark
                  : isLight
                    ? activeBoard.light
                    : activeBoard.dark;
                return (
                  <div
                    key={`${item.color}-${item.type}-${idx}`}
                    className="aspect-square flex items-center justify-center p-1"
                    style={{ backgroundColor: bg }}
                  >
                    <ChessPiece type={item.type} color={item.color} pieceStyle={preferences.pieceStyle} />
                  </div>
                );
              })}
            </div>
          </div>

          <div
            role="group"
            aria-label="Filter board themes by material"
            className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[var(--app-surface)] border border-[var(--app-border)] self-start"
          >
            {(['All', 'Chess.com', 'Classic', 'Wood', 'Stone', 'Modern'] as const).map((cat) => {
              const count = cat === 'All' ? allBoards.length : allBoards.filter((b) => b.category === cat).length;
              return (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={boardCategoryFilter === cat}
                  onClick={() => setBoardCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    boardCategoryFilter === cat
                      ? 'bg-[var(--app-accent)] text-[var(--app-accent-fg)]'
                      : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
                  }`}
                >
                  {cat === 'All' ? t('filterAll') : cat} ({count})
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredBoards.map((b) => {
              const active = preferences.boardTheme === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => onUpdatePreferences({ boardTheme: b.id as BoardThemeId })}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-2.5 anim-interactive ${
                    active
                      ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)]'
                      : 'border-[var(--app-border)] bg-[var(--app-surface)] hover:border-[var(--app-border-strong)]'
                  }`}
                >
                  <div className="w-full aspect-[2/1] rounded-lg overflow-hidden grid grid-cols-4 grid-rows-2 border border-black/25">
                    {[0, 1, 2, 3, 4, 5, 6, 7].map((cell) => {
                      const row = Math.floor(cell / 4);
                      const col = cell % 4;
                      const light = (row + col) % 2 === 0;
                      const isHighlight = cell === 2 || cell === 5;
                      const bg = isHighlight
                        ? light
                          ? b.lastMoveLight
                          : b.lastMoveDark
                        : light
                          ? b.light
                          : b.dark;
                      return <span key={cell} style={{ backgroundColor: bg }} />;
                    })}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="block text-xs font-bold text-[var(--app-text)] truncate">{b.name}</span>
                      <span className="block text-[10px] text-[var(--app-text-subtle)]">{b.category}</span>
                    </div>
                    {active && <Check className="w-4 h-4 text-[var(--app-accent)] shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-PAGE 4: PIECE STYLE */}
      {subPage === 'piece-style' && (
        <div className="flex flex-col gap-5">
          <div className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[var(--app-text)]">
                {t('livePreview')} · {activePiece.name}
              </span>
              <span className="text-[var(--app-text-muted)]">
                {t('boardLabel')}: {activeBoard.name}
              </span>
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-12 rounded-lg overflow-hidden border border-black/25">
              {PREVIEW_ROW_PIECES.map((item, idx) => {
                const isLight = idx % 2 === 0;
                return (
                  <div
                    key={`${item.color}-${item.type}-${idx}`}
                    className="aspect-square flex items-center justify-center p-1"
                    style={{ backgroundColor: isLight ? activeBoard.light : activeBoard.dark }}
                  >
                    <ChessPiece type={item.type} color={item.color} pieceStyle={preferences.pieceStyle} />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {(Object.keys(PIECE_STYLES) as PieceStyleId[]).map((pid) => {
              const style = PIECE_STYLES[pid];
              const active = preferences.pieceStyle === pid;
              return (
                <button
                  key={pid}
                  type="button"
                  onClick={() => onUpdatePreferences({ pieceStyle: pid })}
                  className={`p-3.5 rounded-xl border flex flex-col items-center gap-2.5 transition-all cursor-pointer anim-interactive ${
                    active
                      ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)]'
                      : 'border-[var(--app-border)] bg-[var(--app-surface)] hover:border-[var(--app-border-strong)]'
                  }`}
                >
                  <div
                    className="w-full py-2.5 rounded-lg flex items-center justify-center gap-1 border border-black/20"
                    style={{
                      background: `linear-gradient(90deg, ${activeBoard.light} 50%, ${activeBoard.dark} 50%)`,
                    }}
                  >
                    <div className="w-10 h-10">
                      <ChessPiece type="q" color="w" pieceStyle={pid} />
                    </div>
                    <div className="w-10 h-10">
                      <ChessPiece type="n" color="b" pieceStyle={pid} />
                    </div>
                  </div>
                  <div className="w-full flex items-center justify-between gap-1.5">
                    <span className="text-xs font-bold text-[var(--app-text)] truncate">{style.name}</span>
                    {active && <Check className="w-4 h-4 text-[var(--app-accent)] shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-PAGE 5: ANIMATIONS & MOTION */}
      {subPage === 'animations' && (
        <div className="flex flex-col gap-5">
          {/* Interactive Live Motion Preview */}
          <div className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-col gap-2">
              <div className="text-xs font-bold text-[var(--app-text)]">{t('animPreviewTitle')}</div>
              <p className="text-xs text-[var(--app-text-muted)] max-w-[340px]">
                {activeAnimPreset.name} · {activeAnimPreset.desc}
              </p>
              <button
                type="button"
                data-testid="replay-animation-preview"
                onClick={() => setPreviewStep((s) => s + 1)}
                className="self-start mt-1 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-[var(--app-accent-fg)] text-xs font-extrabold cursor-pointer anim-interactive"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{t('animPreviewReplay')}</span>
              </button>
            </div>

            <div className="w-full sm:w-[240px] shrink-0 grid grid-cols-4 grid-rows-2 rounded-lg overflow-hidden border border-black/25 shadow-sm">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((idx) => {
                const row = Math.floor(idx / 4);
                const col = idx % 4;
                const isLight = (row + col) % 2 === 0;
                const isKnightHere = row === knightDestRow && col === knightDestCol;
                const isOriginHere =
                  previewStep > 0 &&
                  row === (previewAtDest ? 1 : 0) &&
                  col === (previewAtDest ? 0 : 2);
                const bg =
                  isKnightHere || isOriginHere
                    ? isLight
                      ? activeBoard.lastMoveLight
                      : activeBoard.lastMoveDark
                    : isLight
                      ? activeBoard.light
                      : activeBoard.dark;

                return (
                  <div
                    key={idx}
                    className="relative aspect-square flex items-center justify-center p-1"
                    style={{ backgroundColor: bg }}
                  >
                    {isKnightHere && (
                      <div
                        key={`knight-${previewStep}`}
                        style={
                          previewStep > 0
                            ? ({
                                '--slide-x': knightSlideX,
                                '--slide-y': knightSlideY,
                              } as React.CSSProperties)
                            : undefined
                        }
                        className={`w-[84%] h-[84%] ${previewStep > 0 ? 'anim-piece-slide' : ''}`}
                      >
                        <ChessPiece type="n" color="w" pieceStyle={preferences.pieceStyle} />
                      </div>
                    )}
                    {isKnightHere && previewStep > 0 && (
                      <div
                        key={`badge-${previewStep}`}
                        className="absolute top-0.5 right-0.5 z-10 pointer-events-none anim-badge-pop"
                      >
                        <MoveBadge
                          classification={previewAtDest ? 'brilliant' : 'best'}
                          variant="board"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4 Intensity Presets */}
          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-bold tracking-wide text-[var(--app-text-muted)]">
              {t('animIntensityHeading')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {animationPresets.map((preset, idx) => {
                const active = preferences.animationLevel === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    data-testid={`anim-preset-${preset.id}`}
                    aria-pressed={active}
                    onClick={() => {
                      onUpdatePreferences({ animationLevel: preset.id });
                      setPreviewStep((s) => s + 1);
                    }}
                    style={{ '--stagger': idx } as React.CSSProperties}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 anim-card-stagger anim-interactive ${
                      active
                        ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)]'
                        : 'border-[var(--app-border)] bg-[var(--app-surface)] hover:border-[var(--app-border-strong)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-extrabold text-[var(--app-text)]">{preset.name}</span>
                      {active && <Check className="w-4 h-4 text-[var(--app-accent)] shrink-0" />}
                    </div>
                    <p className="text-xs text-[var(--app-text-muted)] leading-snug">{preset.desc}</p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Granular Motion Channel Toggles */}
          <section className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl p-5 flex flex-col gap-3">
            <h2 className="text-xs font-bold tracking-wide text-[var(--app-text-muted)]">
              {t('animTogglesHeading')}
            </h2>
            <div className="flex flex-col gap-2.5">
              {[
                {
                  id: 'piece-motion',
                  label: t('animPieceSlideToggle'),
                  desc: t('animPieceSlideDesc'),
                  checked: preferences.pieceMoveAnimation,
                  toggle: () => {
                    onUpdatePreferences({ pieceMoveAnimation: !preferences.pieceMoveAnimation });
                    setPreviewStep((s) => s + 1);
                  },
                },
                {
                  id: 'ui-transitions',
                  label: t('animUiTransitionsToggle'),
                  desc: t('animUiTransitionsDesc'),
                  checked: preferences.uiTransitions,
                  toggle: () => onUpdatePreferences({ uiTransitions: !preferences.uiTransitions }),
                },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="switch"
                  aria-checked={opt.checked}
                  onClick={opt.toggle}
                  className="flex items-center justify-between gap-4 px-4 py-3.5 rounded-xl bg-[var(--app-surface-2)] border border-[var(--app-border)] hover:border-[var(--app-border-strong)] transition-colors text-left cursor-pointer anim-interactive"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[var(--app-text)]">{opt.label}</div>
                    <div className="text-[11px] text-[var(--app-text-muted)] mt-0.5 leading-snug">{opt.desc}</div>
                  </div>
                  <span
                    className={`w-9 h-5 rounded-full p-0.5 transition-colors flex items-center shrink-0 ${
                      opt.checked ? 'bg-[var(--app-accent)] justify-end' : 'bg-black/30 justify-start'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* SUB-PAGE 6: LANGUAGE (VN / EN / TW / JP) */}
      {subPage === 'language' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5" data-testid="language-selector-grid">
          {LANGUAGE_OPTIONS.map((option, idx) => {
            const active = preferences.language === option.id;
            return (
              <button
                key={option.id}
                type="button"
                data-testid={`lang-option-${option.code.toLowerCase()}`}
                aria-pressed={active}
                onClick={() => onUpdatePreferences({ language: option.id })}
                style={{ '--stagger': idx } as React.CSSProperties}
                className={`p-5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-4 anim-card-stagger anim-interactive ${
                  active
                    ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)]'
                    : 'border-[var(--app-border)] bg-[var(--app-surface)] hover:border-[var(--app-border-strong)]'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-12 h-12 rounded-xl border flex items-center justify-center font-mono font-extrabold text-sm shrink-0 ${
                      active
                        ? 'bg-[var(--app-accent)] text-[var(--app-accent-fg)] border-[var(--app-accent)]'
                        : 'bg-[var(--app-surface-2)] text-[var(--app-text)] border-[var(--app-border)]'
                    }`}
                  >
                    {option.code}
                  </div>
                  <div className="min-w-0">
                    <div className="text-base font-extrabold text-[var(--app-text)] leading-tight truncate">
                      {option.nativeName}
                    </div>
                    <div className="text-xs text-[var(--app-text-muted)] mt-0.5 truncate">
                      {option.englishName} · {option.regionLabel}
                    </div>
                  </div>
                </div>
                {active && <Check className="w-5 h-5 text-[var(--app-accent)] shrink-0" />}
              </button>
            );
          })}
        </div>
      )}

      {/* SUB-PAGE 7: GAMEPLAY & STOCKFISH DEFAULTS */}
      {subPage === 'gameplay' && (
        <section className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl p-5 flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {[
              {
                label: t('toggleEvalBar'),
                checked: preferences.showEvalBar,
                toggle: () => onUpdatePreferences({ showEvalBar: !preferences.showEvalBar }),
              },
              {
                label: t('toggleCoords'),
                checked: preferences.showCoordinates,
                toggle: () => onUpdatePreferences({ showCoordinates: !preferences.showCoordinates }),
              },
              {
                label: t('toggleLegalMoves'),
                checked: preferences.showLegalMoves,
                toggle: () => onUpdatePreferences({ showLegalMoves: !preferences.showLegalMoves }),
              },
              {
                label: t('toggleSounds'),
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
                className="flex items-center justify-between px-4 py-3.5 rounded-xl bg-[var(--app-surface-2)] border border-[var(--app-border)] hover:border-[var(--app-border-strong)] transition-colors cursor-pointer anim-interactive"
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

          <div className="pt-2 border-t border-[var(--app-border)] grid grid-cols-1 sm:grid-cols-2 gap-5 items-center">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="pref-depth-slider" className="text-xs font-bold text-[var(--app-text)]">
                  {t('defaultDepth')}
                </label>
                <span className="text-xs font-mono tabular-nums font-bold text-[var(--app-accent)]">
                  {t('depthLabel')} {preferences.analysisDepth}
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
              <span className="text-xs font-bold text-[var(--app-text)]">{t('multiPvLines')}</span>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => onUpdatePreferences({ multiPv: n })}
                    className={`w-8 h-8 rounded-lg font-mono text-xs font-bold cursor-pointer anim-interactive ${
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
      )}
    </div>
  );
};

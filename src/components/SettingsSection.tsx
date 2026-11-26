import React from 'react';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Crown,
  Grid2x2,
  Palette,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { BOARD_THEMES, type BoardThemeId } from '../types/chess';
import {
  APP_THEMES,
  PIECE_STYLES,
  type AppPreferences,
  type PieceStyleId,
} from '../types/preferences';
import { APP_ICONS, AppLogoIcon } from './AppIcons';
import { ChessPiece } from './ChessPieces';

export type SettingsSubPage = 'root' | 'app-theme' | 'app-icon' | 'board-theme' | 'piece-style' | 'gameplay';

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
  const activeTheme = APP_THEMES.find((t) => t.id === preferences.appTheme) ?? APP_THEMES[0];
  const activeIcon = APP_ICONS.find((i) => i.id === preferences.appIcon) ?? APP_ICONS[0];
  const activeBoard = BOARD_THEMES[preferences.boardTheme] ?? BOARD_THEMES.tournament;
  const activePiece = PIECE_STYLES[preferences.pieceStyle] ?? PIECE_STYLES.classic;

  const darkThemes = APP_THEMES.filter((t) => !t.isLight);
  const lightThemes = APP_THEMES.filter((t) => t.isLight);

  if (subPage === 'root') {
    return (
      <div className="max-w-[920px] mx-auto px-4 sm:px-8 py-6 sm:py-8 flex flex-col gap-6" data-testid="settings-view">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--app-text)]">
            Settings
          </h1>
          <p className="text-sm text-[var(--app-text-muted)] mt-1">
            Select a category to customize interface themes, futuristic glass icons, boards, pieces, and Stockfish defaults.
          </p>
        </div>

        {/* Categorized Drill-Down Setting Sections */}
        <div className="flex flex-col gap-3">
          {/* 1. App Theme */}
          <button
            type="button"
            onClick={() => onChangeSubPage('app-theme')}
            className="w-full p-4 sm:p-5 rounded-xl bg-[var(--app-surface)] border border-[var(--app-border)] hover:border-[var(--app-accent)] hover:bg-[var(--app-surface-hover)] transition-all flex items-center justify-between gap-4 text-left cursor-pointer group"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-[var(--app-surface-2)] border border-[var(--app-border)] flex items-center justify-center shrink-0">
                <Palette className="w-5 h-5 text-[var(--app-accent)]" />
              </div>
              <div className="min-w-0">
                <div className="text-base font-bold text-[var(--app-text)]">App Theme</div>
                <div className="text-xs text-[var(--app-text-muted)] mt-0.5 truncate">
                  Current: <span className="font-semibold text-[var(--app-text)]">{activeTheme.name}</span> · {APP_THEMES.length} themes
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
            className="w-full p-4 sm:p-5 rounded-xl bg-[var(--app-surface)] border border-[var(--app-border)] hover:border-[var(--app-accent)] hover:bg-[var(--app-surface-hover)] transition-all flex items-center justify-between gap-4 text-left cursor-pointer group"
          >
            <div className="flex items-center gap-4 min-w-0">
              <AppLogoIcon iconId={preferences.appIcon} className="w-12 h-12 shrink-0" />
              <div className="min-w-0">
                <div className="text-base font-bold text-[var(--app-text)]">App Icon</div>
                <div className="text-xs text-[var(--app-text-muted)] mt-0.5 truncate">
                  Current: <span className="font-semibold text-[var(--app-text)]">{activeIcon.name}</span> · {APP_ICONS.length} futuristic glass icons
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
            className="w-full p-4 sm:p-5 rounded-xl bg-[var(--app-surface)] border border-[var(--app-border)] hover:border-[var(--app-accent)] hover:bg-[var(--app-surface-hover)] transition-all flex items-center justify-between gap-4 text-left cursor-pointer group"
          >
            <div className="flex items-center gap-4 min-w-0">
              <span className="w-12 h-12 rounded-xl overflow-hidden grid grid-cols-2 grid-rows-2 shrink-0 border border-black/25 shadow-sm">
                <span style={{ backgroundColor: activeBoard.light }} />
                <span style={{ backgroundColor: activeBoard.dark }} />
                <span style={{ backgroundColor: activeBoard.dark }} />
                <span style={{ backgroundColor: activeBoard.light }} />
              </span>
              <div className="min-w-0">
                <div className="text-base font-bold text-[var(--app-text)]">Board Theme</div>
                <div className="text-xs text-[var(--app-text-muted)] mt-0.5 truncate">
                  Current: <span className="font-semibold text-[var(--app-text)]">{activeBoard.name}</span> · {Object.keys(BOARD_THEMES).length} boards
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
            className="w-full p-4 sm:p-5 rounded-xl bg-[var(--app-surface)] border border-[var(--app-border)] hover:border-[var(--app-accent)] hover:bg-[var(--app-surface-hover)] transition-all flex items-center justify-between gap-4 text-left cursor-pointer group"
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
                <div className="text-base font-bold text-[var(--app-text)]">Piece Style</div>
                <div className="text-xs text-[var(--app-text-muted)] mt-0.5 truncate">
                  Current: <span className="font-semibold text-[var(--app-text)]">{activePiece.name}</span> · {Object.keys(PIECE_STYLES).length} piece sets
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Crown className="hidden sm:block w-4 h-4 text-[var(--app-text-subtle)]" />
              <ChevronRight className="w-5 h-5 text-[var(--app-text-muted)] group-hover:text-[var(--app-accent)] transition-colors" />
            </div>
          </button>

          {/* 5. Gameplay & Stockfish */}
          <button
            type="button"
            onClick={() => onChangeSubPage('gameplay')}
            className="w-full p-4 sm:p-5 rounded-xl bg-[var(--app-surface)] border border-[var(--app-border)] hover:border-[var(--app-accent)] hover:bg-[var(--app-surface-hover)] transition-all flex items-center justify-between gap-4 text-left cursor-pointer group"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-[var(--app-surface-2)] border border-[var(--app-border)] flex items-center justify-center shrink-0">
                <SlidersHorizontal className="w-5 h-5 text-[var(--app-accent)]" />
              </div>
              <div className="min-w-0">
                <div className="text-base font-bold text-[var(--app-text)]">Gameplay &amp; Stockfish</div>
                <div className="text-xs text-[var(--app-text-muted)] mt-0.5 font-mono tabular-nums truncate">
                  Depth {preferences.analysisDepth} · {preferences.multiPv} PV lines · {preferences.muted ? 'Audio muted' : 'Audio on'}
                </div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[var(--app-text-muted)] group-hover:text-[var(--app-accent)] transition-colors shrink-0" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[960px] mx-auto px-4 sm:px-8 py-6 sm:py-8 flex flex-col gap-6" data-testid={`settings-subpage-${subPage}`}>
      {/* Sub-page Back Header */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => onChangeSubPage('root')}
          className="self-start inline-flex items-center gap-1.5 text-xs font-bold text-[var(--app-accent)] hover:underline cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Settings</span>
        </button>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--app-text)]">
              {subPage === 'app-theme' && 'App Theme'}
              {subPage === 'app-icon' && 'App Icon'}
              {subPage === 'board-theme' && 'Board Theme'}
              {subPage === 'piece-style' && 'Piece Style'}
              {subPage === 'gameplay' && 'Gameplay & Stockfish'}
            </h1>
            <p className="text-sm text-[var(--app-text-muted)] mt-1">
              {subPage === 'app-theme' && 'Choose from 14 dark and daylight palettes applied immediately across the app.'}
              {subPage === 'app-icon' && 'Futuristic frosted-jade and translucent crystal emblems synced to your sidebar and browser tab.'}
              {subPage === 'board-theme' && 'Select from 14 tournament, wood, stone, and crystal chessboard finishes.'}
              {subPage === 'piece-style' && 'Customize Staunton piece palettes including frosted jade, sapphire ice, and metallic finishes.'}
              {subPage === 'gameplay' && 'Configure board overlays, audio cues, and default Stockfish WASM analysis depth.'}
            </p>
          </div>
        </div>
      </div>

      {/* SUB-PAGE 1: APP THEME */}
      {subPage === 'app-theme' && (
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--app-text-muted)]">
              Dark Themes ({darkThemes.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {darkThemes.map((t) => {
                const active = preferences.appTheme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onUpdatePreferences({ appTheme: t.id })}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-3 ${
                      active
                        ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)]'
                        : 'border-[var(--app-border)] bg-[var(--app-surface)] hover:border-[var(--app-border-strong)]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="w-6 h-6 rounded-md border border-white/15" style={{ backgroundColor: t.swatchBg }} />
                        <span className="w-6 h-6 rounded-md border border-white/15" style={{ backgroundColor: t.swatchSurface }} />
                        <span className="w-6 h-6 rounded-md border border-black/20" style={{ backgroundColor: t.swatchAccent }} />
                      </div>
                      {active && <Check className="w-4 h-4 text-[var(--app-accent)]" />}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[var(--app-text)]">{t.name}</div>
                      <div className="text-xs text-[var(--app-text-muted)] mt-0.5 leading-snug">{t.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--app-text-muted)]">
              Light Themes ({lightThemes.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {lightThemes.map((t) => {
                const active = preferences.appTheme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onUpdatePreferences({ appTheme: t.id })}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-3 ${
                      active
                        ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)]'
                        : 'border-[var(--app-border)] bg-[var(--app-surface)] hover:border-[var(--app-border-strong)]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="w-6 h-6 rounded-md border border-black/20" style={{ backgroundColor: t.swatchBg }} />
                        <span className="w-6 h-6 rounded-md border border-black/20" style={{ backgroundColor: t.swatchSurface }} />
                        <span className="w-6 h-6 rounded-md border border-black/20" style={{ backgroundColor: t.swatchAccent }} />
                      </div>
                      {active && <Check className="w-4 h-4 text-[var(--app-accent)]" />}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[var(--app-text)]">{t.name}</div>
                      <div className="text-xs text-[var(--app-text-muted)] mt-0.5 leading-snug">{t.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* SUB-PAGE 2: FUTURISTIC FROSTED-JADE APP ICON */}
      {subPage === 'app-icon' && (
        <div className="flex flex-col gap-5">
          {/* Live Brand Lockup Preview */}
          <div className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <AppLogoIcon iconId={preferences.appIcon} className="w-14 h-14 shrink-0" />
              <div>
                <div className="text-xs font-semibold text-[var(--app-accent)] flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Active App Emblem</span>
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
                  className={`p-4 rounded-xl border flex flex-col items-center gap-3 transition-all cursor-pointer relative ${
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
          {/* Live 8x2 Board + Active Pieces Preview Strip */}
          <div className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[var(--app-text)]">Live Preview · {activeBoard.name}</span>
              <span className="text-[var(--app-text-muted)]">Pieces: {activePiece.name}</span>
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

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Object.values(BOARD_THEMES).map((b) => {
              const active = preferences.boardTheme === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => onUpdatePreferences({ boardTheme: b.id as BoardThemeId })}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-2.5 ${
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
                    <span className="text-xs font-bold text-[var(--app-text)] truncate">{b.name}</span>
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
          {/* Live All-Pieces Preview on Current Board */}
          <div className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[var(--app-text)]">Live Preview · {activePiece.name}</span>
              <span className="text-[var(--app-text-muted)]">Board: {activeBoard.name}</span>
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
                  className={`p-3.5 rounded-xl border flex flex-col items-center gap-2.5 transition-all cursor-pointer ${
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

      {/* SUB-PAGE 5: GAMEPLAY & STOCKFISH DEFAULTS */}
      {subPage === 'gameplay' && (
        <section className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl p-5 flex flex-col gap-5">
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
                className="flex items-center justify-between px-4 py-3.5 rounded-xl bg-[var(--app-surface-2)] border border-[var(--app-border)] hover:border-[var(--app-border-strong)] transition-colors cursor-pointer"
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
      )}
    </div>
  );
};

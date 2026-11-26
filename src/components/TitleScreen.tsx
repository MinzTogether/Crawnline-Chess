import React, { useEffect } from 'react';
import {
  BOARD_THEMES,
  STOCKFISH_LEVELS,
  TIME_CONTROLS,
  type BoardThemeId,
  type GameMode,
  type MatchSettings,
  type PlayerSideChoice,
} from '../types/chess';
import { ChessBoard } from './ChessBoard';

// Iconic Morphy Opera Game critical position (White about to play 16. Qb8+! Nxb8 17. Rd8#)
const SHOWCASE_FEN = '4kb1r/p2n1ppp/4q3/4p1B1/4P3/1Q6/PPP2PPP/2KR4 w k - 1 16';

interface TitleScreenProps {
  settings: MatchSettings;
  boardTheme: BoardThemeId;
  onChangeSettings: (next: MatchSettings) => void;
  onStart: (overrideMode?: GameMode) => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  settings,
  boardTheme,
  onChangeSettings,
  onStart,
}) => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onStart();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onStart]);

  const activeLevel =
    STOCKFISH_LEVELS.find((l) => l.id === settings.stockfishLevelId) ?? STOCKFISH_LEVELS[2];

  const theme = BOARD_THEMES[boardTheme];

  return (
    <main className="min-h-screen w-full bg-[#181817] text-[#F1EFEA] flex flex-col justify-between px-5 sm:px-8 lg:px-12 py-6">
      <div className="max-w-[1260px] w-full mx-auto my-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left Visual Centerpiece: Showcase Tournament Board */}
        <div className="lg:col-span-7 flex flex-col items-center">
          <div className="w-full max-w-[560px]">
            <ChessBoard
              fen={SHOWCASE_FEN}
              orientation="w"
              themeId={boardTheme}
              interactive={false}
              showCoordinates={true}
              showLegalMoves={false}
              showEvalBar={true}
              evalScore={{ type: 'mate', value: 2 }}
              lastMove={{ from: 'd7', to: 'e6' }}
              engineArrows={[
                { from: 'b3', to: 'b8', color: 'rgba(129, 182, 76, 0.88)', kind: 'best' },
              ]}
              onMove={() => false}
            />
            <div className="mt-3 flex items-center justify-between text-xs text-[#9C9990] px-1">
              <span>Opera Game · Paris, 1858</span>
              <span className="font-mono tabular-nums text-[#81B64C]">16. Qb8+! Nxb8 17. Rd8# · M2</span>
            </div>
          </div>
        </div>

        {/* Right Column: Bespoke SVG Emblem & Match Setup */}
        <div className="lg:col-span-5 flex flex-col gap-6 max-w-[460px] w-full mx-auto lg:mx-0">
          {/* Custom inline SVG brand lockup */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3.5">
              <svg
                viewBox="0 0 44 44"
                className="w-11 h-11 shrink-0"
                aria-hidden="true"
              >
                <rect x="2" y="2" width="40" height="40" rx="9" fill="#242321" stroke="#81B64C" strokeWidth="1.5" />
                <path
                  d="M11 31h22v3H11v-3zm2-3l-2.5-11 6.5 4.5L22 12l5 9.5 6.5-4.5L31 28H13z"
                  fill="#F1EFEA"
                />
                <circle cx="22" cy="10.2" r="2" fill="#81B64C" />
              </svg>
              <div>
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#F6F4EE] leading-none">
                  Crownline Chess
                </h1>
                <p className="text-sm text-[#A5A29B] mt-1.5">
                  Tournament play powered by Stockfish WebAssembly
                </p>
              </div>
            </div>
          </div>

          {/* Setup Card */}
          <div className="bg-[#232220] border border-white/[0.08] rounded-xl p-5 flex flex-col gap-5 shadow-[0_12px_32px_rgba(0,0,0,0.35)]">
            {/* Mode Selector */}
            <div>
              <span className="block text-xs font-semibold text-[#A8A59E] mb-2">Play Mode</span>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#191816] rounded-lg">
                {(
                  [
                    { id: 'stockfish', label: 'Vs Stockfish' },
                    { id: 'local', label: 'Pass & Play' },
                    { id: 'analysis', label: 'Analysis' },
                  ] as { id: GameMode; label: string }[]
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onChangeSettings({ ...settings, mode: m.id })}
                    className={`py-2 px-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      settings.mode === m.id
                        ? 'bg-[#312F2B] text-white shadow-sm'
                        : 'text-[#9A978F] hover:text-[#E5E3DC]'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Stockfish Strength */}
            {settings.mode === 'stockfish' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-[#A8A59E]">Stockfish Strength</span>
                  <span className="text-xs font-mono tabular-nums text-[#81B64C] font-semibold">
                    {activeLevel.name} · {activeLevel.elo} Elo
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {STOCKFISH_LEVELS.map((lvl) => {
                    const active = lvl.id === settings.stockfishLevelId;
                    return (
                      <button
                        key={lvl.id}
                        type="button"
                        onClick={() => onChangeSettings({ ...settings, stockfishLevelId: lvl.id })}
                        className={`py-2 px-2 rounded-lg text-left transition-colors border cursor-pointer ${
                          active
                            ? 'bg-[#81B64C]/18 border-[#81B64C] text-white'
                            : 'bg-[#1B1A18] border-white/[0.06] text-[#B0ADA6] hover:border-white/15'
                        }`}
                      >
                        <div className="text-xs font-mono font-bold tabular-nums">{lvl.elo}</div>
                        <div className="text-[11px] truncate opacity-80">{lvl.name}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Time Control */}
            {settings.mode !== 'analysis' && (
              <div>
                <span className="block text-xs font-semibold text-[#A8A59E] mb-2">Time Control</span>
                <div className="grid grid-cols-4 gap-1.5">
                  {TIME_CONTROLS.slice(0, 7).map((tc) => {
                    const active = tc.id === settings.timeControlId;
                    return (
                      <button
                        key={tc.id}
                        type="button"
                        onClick={() => onChangeSettings({ ...settings, timeControlId: tc.id })}
                        className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-colors border whitespace-nowrap cursor-pointer ${
                          active
                            ? 'bg-[#81B64C]/18 border-[#81B64C] text-white'
                            : 'bg-[#1B1A18] border-white/[0.06] text-[#B0ADA6] hover:border-white/15'
                        }`}
                      >
                        {tc.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Side Choice */}
            {settings.mode === 'stockfish' && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-[#A8A59E]">Play As</span>
                <div className="flex items-center gap-1.5">
                  {(
                    [
                      { id: 'w', label: 'White' },
                      { id: 'random', label: 'Random' },
                      { id: 'b', label: 'Black' },
                    ] as { id: PlayerSideChoice; label: string }[]
                  ).map((side) => (
                    <button
                      key={side.id}
                      type="button"
                      onClick={() => onChangeSettings({ ...settings, playerSide: side.id })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap cursor-pointer ${
                        settings.playerSide === side.id
                          ? 'bg-[#312F2B] border-[#81B64C] text-white'
                          : 'bg-[#1B1A18] border-white/[0.06] text-[#9E9B94] hover:text-white'
                      }`}
                    >
                      {side.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Primary Action CTA */}
            <button
              type="button"
              data-start="true"
              onClick={() => onStart()}
              className="w-full py-3.5 px-5 rounded-lg bg-[#81B64C] hover:bg-[#8FC558] active:scale-[0.99] text-[#12160D] font-extrabold text-base tracking-tight transition-all shadow-[0_4px_0_#5D8933] cursor-pointer whitespace-nowrap"
            >
              {settings.mode === 'analysis' ? 'Open Analysis Board' : 'Start Match'}
            </button>
          </div>
        </div>
      </div>

      {/* Quiet single-line control hint in bottom margin */}
      <div className="max-w-[1260px] w-full mx-auto pt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-[#7E7B74]">
        <span>Enter Start</span>
        <span aria-hidden="true">·</span>
        <span>Click or Drag Pieces</span>
        <span aria-hidden="true">·</span>
        <span>Right-Click Draw Arrows</span>
        <span aria-hidden="true">·</span>
        <span>← / → Step Moves</span>
        <span aria-hidden="true">·</span>
        <span>F Flip Board</span>
        <span aria-hidden="true">·</span>
        <span>Theme: {theme.name}</span>
      </div>
    </main>
  );
};

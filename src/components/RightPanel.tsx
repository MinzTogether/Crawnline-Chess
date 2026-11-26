import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Cpu,
  Flag,
  Handshake,
  Lightbulb,
  RotateCcw,
  Settings,
  Sparkles,
  ArrowUpDown,
  ListOrdered,
  Play,
} from 'lucide-react';
import {
  BOARD_THEMES,
  CLASSIFICATION_META,
  type BoardThemeId,
  type ClassicStudy,
  type EngineAnalysis,
  type GameMode,
  type MoveRecord,
  type OpeningInfo,
} from '../types/chess';
import { evalToWhiteWinProbability, formatEvalScore, formatNodes } from '../engine/uciParser';
import { formatPvSanWithNumbers } from '../game/chessLogic';
import { CLASSIC_STUDIES } from '../game/openings';
import { EvalGraph } from './EvalGraph';

export type RightPanelTab = 'moves' | 'engine' | 'library' | 'settings';

interface RightPanelProps {
  activeTab: RightPanelTab;
  onTabChange: (tab: RightPanelTab) => void;
  mode: GameMode;
  moves: MoveRecord[];
  viewPly: number;
  currentFen: string;
  opening: OpeningInfo | null;
  positionLabel?: string | null;
  engineAnalysis: EngineAnalysis | null;
  engineEnabled: boolean;
  onToggleEngine: (enabled: boolean) => void;
  multiPv: number;
  onChangeMultiPv: (count: number) => void;
  analysisDepth: number;
  onChangeAnalysisDepth: (depth: number) => void;
  showBestArrow: boolean;
  onToggleBestArrow: (show: boolean) => void;
  showEvalBar: boolean;
  onToggleEvalBar: (show: boolean) => void;
  showCoordinates: boolean;
  onToggleCoordinates: (show: boolean) => void;
  showLegalMoves: boolean;
  onToggleLegalMoves: (show: boolean) => void;
  boardTheme: BoardThemeId;
  onChangeBoardTheme: (theme: BoardThemeId) => void;
  muted: boolean;
  onToggleMuted: () => void;
  isGameOver: boolean;
  isReviewing: boolean;
  reviewProgress: number; // 0..100
  whiteAccuracy: number | null;
  blackAccuracy: number | null;
  onSelectPly: (ply: number) => void;
  onFlipBoard: () => void;
  onRequestHint: () => void;
  onTakeback: () => void;
  onOfferDraw: () => void;
  onResign: () => void;
  onNewMatch: () => void;
  onRunGameReview: () => void;
  onPlayEngineMove: (uciMove: string) => void;
  onImportPgnOrFen: (text: string) => { ok: boolean; error?: string };
  onLoadStudy: (study: ClassicStudy) => void;
  pgnText: string;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  activeTab,
  onTabChange,
  mode,
  moves,
  viewPly,
  currentFen,
  opening,
  positionLabel,
  engineAnalysis,
  engineEnabled,
  onToggleEngine,
  multiPv,
  onChangeMultiPv,
  analysisDepth,
  onChangeAnalysisDepth,
  showBestArrow,
  onToggleBestArrow,
  showEvalBar,
  onToggleEvalBar,
  showCoordinates,
  onToggleCoordinates,
  showLegalMoves,
  onToggleLegalMoves,
  boardTheme,
  onChangeBoardTheme,
  muted,
  onToggleMuted,
  isGameOver,
  isReviewing,
  reviewProgress,
  whiteAccuracy,
  blackAccuracy,
  onSelectPly,
  onFlipBoard,
  onRequestHint,
  onTakeback,
  onOfferDraw,
  onResign,
  onNewMatch,
  onRunGameReview,
  onPlayEngineMove,
  onImportPgnOrFen,
  onLoadStudy,
  pgnText,
}) => {
  const moveListEndRef = useRef<HTMLDivElement>(null);
  const [importInput, setImportInput] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<'fen' | 'pgn' | null>(null);

  // Auto-scroll move sheet to latest move when following live play
  useEffect(() => {
    if (activeTab === 'moves' && viewPly === moves.length) {
      moveListEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [moves.length, viewPly, activeTab]);

  // Group moves into full-move pairs for two-column Chess.com move table
  const moveRows: { moveNumber: number; white?: MoveRecord; black?: MoveRecord }[] = [];
  for (const m of moves) {
    const lastRow = moveRows[moveRows.length - 1];
    if (m.color === 'w' || !lastRow || lastRow.moveNumber !== m.moveNumber || lastRow.black) {
      moveRows.push({
        moveNumber: m.moveNumber,
        white: m.color === 'w' ? m : undefined,
        black: m.color === 'b' ? m : undefined,
      });
    } else {
      lastRow.black = m;
    }
  }

  const topScore = engineAnalysis?.lines[0]?.score ?? null;
  const whiteWinProb = topScore ? Math.round(evalToWhiteWinProbability(topScore)) : 50;

  const handleCopy = async (kind: 'fen' | 'pgn') => {
    const value = kind === 'fen' ? currentFen : pgnText;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedType(kind);
      setTimeout(() => setCopiedType(null), 1800);
    } catch {
      setCopiedType(null);
    }
  };

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = onImportPgnOrFen(importInput);
    if (res.ok) {
      setImportError(null);
      setImportSuccess('Position loaded into board.');
      setImportInput('');
      setTimeout(() => setImportSuccess(null), 2200);
    } else {
      setImportSuccess(null);
      setImportError(res.error ?? 'Invalid notation.');
    }
  };

  // Classification counts for review breakdown
  const classificationCounts = moves.reduce(
    (acc, m) => {
      if (m.classification) {
        acc[m.classification] = (acc[m.classification] || 0) + 1;
      }
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <aside
      aria-label="Chess analysis and move history panel"
      className="w-full lg:w-[390px] xl:w-[420px] shrink-0 bg-[#232220] border border-white/[0.08] rounded-xl flex flex-col overflow-hidden lg:h-[calc(100vh-3rem)] lg:max-h-[820px]"
    >
      {/* Tab Bar */}
      <div role="tablist" aria-label="Workspace tabs" className="grid grid-cols-4 bg-[#1B1A18] border-b border-white/[0.07]">
        {(
          [
            { id: 'moves', label: 'Moves', icon: ListOrdered },
            { id: 'engine', label: 'Stockfish', icon: Cpu },
            { id: 'library', label: 'Library', icon: BookOpen },
            { id: 'settings', label: 'Board', icon: Settings },
          ] as { id: RightPanelTab; label: string; icon: React.ComponentType<{ className?: string }> }[]
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center justify-center gap-1.5 py-3 px-2 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer border-b-2 ${
                active
                  ? 'border-[#81B64C] text-white bg-[#232220]'
                  : 'border-transparent text-[#94918A] hover:text-[#E0DDD5]'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: MOVES & GAME CONTROLS */}
      {activeTab === 'moves' && (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Opening & Live Mini Stockfish Strip */}
          <div className="px-4 py-2.5 bg-[#1D1C1A] border-b border-white/[0.06] flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-[#E8E6DF] truncate">
                {opening ? `${opening.eco} · ${opening.name}` : positionLabel ?? 'Starting Position'}
              </div>
              <div className="text-[11px] text-[#8E8B84] flex items-center gap-1.5 font-mono tabular-nums mt-0.5">
                <span>Stockfish</span>
                <span aria-hidden="true">·</span>
                <span>{topScore ? formatEvalScore(topScore, true) : '0.00'}</span>
                {engineAnalysis && engineAnalysis.depth > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>d{engineAnalysis.depth}</span>
                  </>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onTabChange('engine')}
              className="text-xs font-semibold text-[#81B64C] hover:text-[#98CE60] whitespace-nowrap cursor-pointer shrink-0"
            >
              Lines →
            </button>
          </div>

          {/* Advantage Graph */}
          <div className="px-3.5 pt-3">
            <EvalGraph moves={moves} viewPly={viewPly} onSelectPly={onSelectPly} liveEval={topScore} />
          </div>

          {/* Two-Column Algebraic Move List */}
          <div className="flex-1 min-h-[180px] overflow-y-auto px-3.5 py-2.5" data-testid="move-history">
            {moveRows.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-8 px-4">
                <p className="text-sm font-semibold text-[#C8C5BC]">No moves played yet</p>
                <p className="text-xs text-[#87847D] mt-1 max-w-[240px]">
                  Click or drag any piece on the board to begin. Stockfish evaluates every position in real time.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                {moveRows.map((row) => (
                  <div
                    key={row.moveNumber}
                    className="grid grid-cols-[36px_1fr_1fr] items-center rounded px-1.5 py-0.5 odd:bg-white/[0.02]"
                  >
                    <span className="text-xs font-mono tabular-nums text-[#7C7972]">{row.moveNumber}.</span>

                    {/* White move */}
                    {row.white ? (
                      <button
                        type="button"
                        onClick={() => onSelectPly(row.white!.ply)}
                        className={`flex items-center justify-between gap-1 px-2 py-1 rounded text-left font-mono text-xs transition-colors cursor-pointer ${
                          viewPly === row.white.ply
                            ? 'bg-[#81B64C]/25 text-white font-bold'
                            : 'text-[#E5E3DC] hover:bg-white/[0.06]'
                        }`}
                      >
                        <span>{row.white.san}</span>
                        {row.white.classification && (
                          <span
                            className="text-[10px] font-bold"
                            style={{ color: CLASSIFICATION_META[row.white.classification].color }}
                            title={CLASSIFICATION_META[row.white.classification].label}
                          >
                            {CLASSIFICATION_META[row.white.classification].symbol}
                          </span>
                        )}
                      </button>
                    ) : (
                      <span />
                    )}

                    {/* Black move */}
                    {row.black ? (
                      <button
                        type="button"
                        onClick={() => onSelectPly(row.black!.ply)}
                        className={`flex items-center justify-between gap-1 px-2 py-1 rounded text-left font-mono text-xs transition-colors cursor-pointer ${
                          viewPly === row.black.ply
                            ? 'bg-[#81B64C]/25 text-white font-bold'
                            : 'text-[#E5E3DC] hover:bg-white/[0.06]'
                        }`}
                      >
                        <span>{row.black.san}</span>
                        {row.black.classification && (
                          <span
                            className="text-[10px] font-bold"
                            style={{ color: CLASSIFICATION_META[row.black.classification].color }}
                            title={CLASSIFICATION_META[row.black.classification].label}
                          >
                            {CLASSIFICATION_META[row.black.classification].symbol}
                          </span>
                        )}
                      </button>
                    ) : (
                      <span />
                    )}
                  </div>
                ))}
                <div ref={moveListEndRef} />
              </div>
            )}
          </div>

          {/* VCR Move Navigation Controls */}
          <div className="px-3.5 py-2 border-t border-white/[0.07] bg-[#1E1D1B] grid grid-cols-5 gap-1">
            <button
              type="button"
              aria-label="First move"
              disabled={viewPly === 0}
              onClick={() => onSelectPly(0)}
              className="py-2 rounded-md flex items-center justify-center bg-[#2A2926] hover:bg-[#353430] disabled:opacity-35 text-[#E8E6DF] transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronFirst className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label="Previous move"
              disabled={viewPly === 0}
              onClick={() => onSelectPly(Math.max(0, viewPly - 1))}
              className="py-2 rounded-md flex items-center justify-center bg-[#2A2926] hover:bg-[#353430] disabled:opacity-35 text-[#E8E6DF] transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label="Next move"
              disabled={viewPly >= moves.length}
              onClick={() => onSelectPly(Math.min(moves.length, viewPly + 1))}
              className="py-2 rounded-md flex items-center justify-center bg-[#2A2926] hover:bg-[#353430] disabled:opacity-35 text-[#E8E6DF] transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label="Latest move"
              disabled={viewPly >= moves.length}
              onClick={() => onSelectPly(moves.length)}
              className="py-2 rounded-md flex items-center justify-center bg-[#2A2926] hover:bg-[#353430] disabled:opacity-35 text-[#E8E6DF] transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLast className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label="Flip board"
              onClick={onFlipBoard}
              title="Flip Board (F)"
              className="py-2 rounded-md flex items-center justify-center bg-[#2A2926] hover:bg-[#353430] text-[#E8E6DF] transition-colors cursor-pointer"
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>
          </div>

          {/* Primary Match Actions Footer */}
          <div className="p-3.5 border-t border-white/[0.07] bg-[#1A1917] flex flex-col gap-2">
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={onRequestHint}
                disabled={isGameOver}
                className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg bg-[#282724] hover:bg-[#32312D] disabled:opacity-40 text-[#E5E3DC] text-[11px] font-medium transition-colors cursor-pointer"
              >
                <Lightbulb className="w-3.5 h-3.5 text-[#E6A832]" />
                <span>Hint</span>
              </button>
              <button
                type="button"
                onClick={onTakeback}
                disabled={moves.length === 0}
                className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg bg-[#282724] hover:bg-[#32312D] disabled:opacity-40 text-[#E5E3DC] text-[11px] font-medium transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#B8B5AD]" />
                <span>Takeback</span>
              </button>
              <button
                type="button"
                onClick={onOfferDraw}
                disabled={isGameOver || mode === 'analysis'}
                className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg bg-[#282724] hover:bg-[#32312D] disabled:opacity-40 text-[#E5E3DC] text-[11px] font-medium transition-colors cursor-pointer"
              >
                <Handshake className="w-3.5 h-3.5 text-[#B8B5AD]" />
                <span>Draw</span>
              </button>
              <button
                type="button"
                onClick={onResign}
                disabled={isGameOver || mode === 'analysis'}
                className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg bg-[#282724] hover:bg-[#3B2626] disabled:opacity-40 text-[#E5E3DC] text-[11px] font-medium transition-colors cursor-pointer"
              >
                <Flag className="w-3.5 h-3.5 text-[#D96666]" />
                <span>Resign</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onRunGameReview}
                disabled={moves.length === 0 || isReviewing}
                className="py-2.5 px-3 rounded-lg bg-[#2D2C29] hover:bg-[#383632] disabled:opacity-40 text-xs font-semibold text-[#F1EFEA] flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#81B64C]" />
                <span>{isReviewing ? `Reviewing ${reviewProgress}%` : 'Game Review'}</span>
              </button>
              <button
                type="button"
                onClick={onNewMatch}
                className="py-2.5 px-3 rounded-lg bg-[#81B64C] hover:bg-[#8FC558] text-xs font-extrabold text-[#12160D] transition-colors cursor-pointer whitespace-nowrap"
              >
                New Match
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: STOCKFISH UCI ENGINE & GAME REVIEW */}
      {activeTab === 'engine' && (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4" data-testid="stockfish-panel">
          {/* Engine Header & Toggle */}
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/[0.07]">
            <div>
              <h2 className="text-sm font-bold text-[#F3F1EC]">Stockfish WASM Engine</h2>
              <p className="text-xs text-[#9C9990] font-mono tabular-nums mt-0.5">
                {engineEnabled
                  ? `Depth ${engineAnalysis?.depth ?? 0}/${analysisDepth} · ${formatNodes(engineAnalysis?.nodes ?? 0)} nodes · ${formatNodes(engineAnalysis?.nps ?? 0)}/s`
                  : 'Engine paused'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onToggleEngine(!engineEnabled)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                engineEnabled
                  ? 'bg-[#81B64C]/20 text-[#9AD263] border border-[#81B64C]/50'
                  : 'bg-[#2E2D2A] text-[#B0ADA6] border border-white/10'
              }`}
            >
              {engineEnabled ? 'Running' : 'Paused'}
            </button>
          </div>

          {/* Win Probability Bar */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs font-mono tabular-nums">
              <span className="text-[#ECEAE4] font-semibold">White {whiteWinProb}%</span>
              <span className="text-[#81B64C] font-bold text-sm">
                {topScore ? formatEvalScore(topScore, true) : '0.00'}
              </span>
              <span className="text-[#A8A59E] font-semibold">Black {100 - whiteWinProb}%</span>
            </div>
            <div className="h-2.5 w-full rounded-full overflow-hidden bg-[#33322E] flex">
              <div
                className="h-full bg-[#ECEAE4] transition-[width] duration-300"
                style={{ width: `${whiteWinProb}%` }}
              />
            </div>
          </div>

          {/* MultiPV & Arrow Controls */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[#9C9990]">Lines:</span>
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onChangeMultiPv(n)}
                  className={`w-7 h-7 rounded text-xs font-mono font-bold transition-colors cursor-pointer ${
                    multiPv === n
                      ? 'bg-[#81B64C] text-[#12160D]'
                      : 'bg-[#1B1A18] text-[#A8A59E] hover:text-white'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onToggleBestArrow(!showBestArrow)}
              className={`px-2.5 py-1.5 rounded text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                showBestArrow
                  ? 'bg-[#81B64C]/18 border-[#81B64C]/60 text-[#E8E6DF]'
                  : 'bg-[#1B1A18] border-white/10 text-[#9C9990]'
              }`}
            >
              Best Arrow: {showBestArrow ? 'On' : 'Off'}
            </button>
          </div>

          {/* Principal Variation Lines */}
          <div className="flex flex-col gap-2" data-testid="engine-lines">
            {!engineEnabled ? (
              <div className="py-6 text-center text-xs text-[#8E8B84] bg-[#1B1A18] rounded-lg">
                Resume Stockfish to view live top variations.
              </div>
            ) : !engineAnalysis || engineAnalysis.lines.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#9C9990] bg-[#1B1A18] rounded-lg">
                Calculating principal variations…
              </div>
            ) : (
              engineAnalysis.lines.map((line) => {
                const scoreStr = formatEvalScore(line.score, true);
                const isWhiteAdv = line.score.value >= 0;
                const pvText = formatPvSanWithNumbers(engineAnalysis.fen, line.pvSan);
                const firstUci = line.pvUci[0];

                return (
                  <div
                    key={line.multipv}
                    className="bg-[#1B1A18] border border-white/[0.06] rounded-lg p-2.5 flex items-start gap-2.5"
                  >
                    <span
                      className={`font-mono font-bold text-xs tabular-nums px-1.5 py-0.5 rounded shrink-0 ${
                        isWhiteAdv ? 'bg-[#ECEAE4] text-[#181817]' : 'bg-[#363532] text-[#F1EFEA]'
                      }`}
                    >
                      {scoreStr}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs text-[#E0DDD5] leading-relaxed break-words">
                        {pvText || line.pvUci.slice(0, 6).join(' ')}
                      </p>
                      <span className="text-[11px] text-[#7E7B74] font-mono tabular-nums">
                        Line {line.multipv} · depth {line.depth}
                      </span>
                    </div>
                    {firstUci && (
                      <button
                        type="button"
                        aria-label={`Play engine line ${line.multipv}`}
                        title="Play this move on board"
                        onClick={() => onPlayEngineMove(firstUci)}
                        className="p-1.5 rounded bg-[#2A2926] hover:bg-[#81B64C] hover:text-[#12160D] text-[#C8C5BC] transition-colors shrink-0 cursor-pointer"
                      >
                        <Play className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Full Game Review Section */}
          <div className="pt-3 border-t border-white/[0.07] flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#E8E6DF]">Full Game Review</h3>
              <button
                type="button"
                onClick={onRunGameReview}
                disabled={moves.length === 0 || isReviewing}
                className="px-3 py-1.5 rounded-md bg-[#81B64C] hover:bg-[#8FC558] disabled:opacity-40 text-[#12160D] text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
              >
                {isReviewing ? `Analyzing ${reviewProgress}%` : 'Analyze All Moves'}
              </button>
            </div>

            {isReviewing && (
              <div className="w-full h-1.5 bg-[#1B1A18] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#81B64C] transition-[width] duration-200"
                  style={{ width: `${reviewProgress}%` }}
                />
              </div>
            )}

            {(whiteAccuracy !== null || blackAccuracy !== null) && (
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#1B1A18] rounded-lg p-3 border border-white/[0.06]">
                  <span className="text-[11px] text-[#9C9990]">White Accuracy</span>
                  <div className="text-xl font-mono font-bold tabular-nums text-[#F3F1EC] mt-0.5">
                    {whiteAccuracy !== null ? `${whiteAccuracy.toFixed(1)}%` : '—'}
                  </div>
                </div>
                <div className="bg-[#1B1A18] rounded-lg p-3 border border-white/[0.06]">
                  <span className="text-[11px] text-[#9C9990]">Black Accuracy</span>
                  <div className="text-xl font-mono font-bold tabular-nums text-[#F3F1EC] mt-0.5">
                    {blackAccuracy !== null ? `${blackAccuracy.toFixed(1)}%` : '—'}
                  </div>
                </div>
              </div>
            )}

            {Object.keys(classificationCounts).length > 0 && (
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                {(['book', 'best', 'good', 'inaccuracy', 'mistake', 'blunder'] as const).map((key) => {
                  const meta = CLASSIFICATION_META[key];
                  const count = classificationCounts[key] ?? 0;
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded bg-[#1B1A18] border border-white/[0.05]"
                    >
                      <span style={{ color: meta.color }} className="font-semibold">
                        {meta.label}
                      </span>
                      <span className="font-mono tabular-nums text-[#E5E3DC] font-bold">{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: LIBRARY, FEN/PGN IMPORT & EXPORT */}
      {activeTab === 'library' && (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
          {/* Copy FEN / PGN */}
          <div className="flex flex-col gap-2">
            <h2 className="text-xs font-bold text-[#E8E6DF]">Export Current Position</h2>
            <div className="bg-[#1B1A18] border border-white/[0.06] rounded-lg p-2.5 font-mono text-[11px] text-[#B8B5AD] break-all">
              {currentFen}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleCopy('fen')}
                className="py-2 px-3 rounded-lg bg-[#2A2926] hover:bg-[#353430] text-xs font-semibold text-[#F1EFEA] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {copiedType === 'fen' ? <Check className="w-3.5 h-3.5 text-[#81B64C]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedType === 'fen' ? 'Copied FEN' : 'Copy FEN'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleCopy('pgn')}
                className="py-2 px-3 rounded-lg bg-[#2A2926] hover:bg-[#353430] text-xs font-semibold text-[#F1EFEA] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {copiedType === 'pgn' ? <Check className="w-3.5 h-3.5 text-[#81B64C]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedType === 'pgn' ? 'Copied PGN' : 'Copy PGN'}</span>
              </button>
            </div>
          </div>

          {/* Import FEN or PGN */}
          <form onSubmit={handleImportSubmit} className="flex flex-col gap-2">
            <label htmlFor="fen-pgn-input" className="text-xs font-bold text-[#E8E6DF]">
              Load Custom FEN or PGN
            </label>
            <textarea
              id="fen-pgn-input"
              rows={3}
              value={importInput}
              onChange={(e) => {
                setImportInput(e.target.value);
                if (importError) setImportError(null);
              }}
              placeholder="Paste a FEN string or PGN move list (e.g. 1. e4 e5 2. Nf3 Nc6)..."
              className="w-full rounded-lg bg-[#1B1A18] border border-white/[0.1] focus:border-[#81B64C] focus:outline-none p-2.5 text-xs font-mono text-[#F1EFEA] placeholder:text-[#6E6C66] resize-none"
            />
            {importError && <p className="text-xs text-[#E06666]">{importError}</p>}
            {importSuccess && <p className="text-xs text-[#81B64C]">{importSuccess}</p>}
            <button
              type="submit"
              className="py-2 px-3 rounded-lg bg-[#81B64C] hover:bg-[#8FC558] text-[#12160D] text-xs font-bold transition-colors cursor-pointer"
            >
              Load Into Board
            </button>
          </form>

          {/* Curated Famous Games & Tactical Studies */}
          <div className="flex flex-col gap-2">
            <h2 className="text-xs font-bold text-[#E8E6DF]">Classic Games &amp; Tactics</h2>
            <div className="flex flex-col gap-1.5">
              {CLASSIC_STUDIES.map((study) => (
                <button
                  key={study.id}
                  type="button"
                  onClick={() => onLoadStudy(study)}
                  className="w-full text-left p-3 rounded-lg bg-[#1B1A18] hover:bg-[#292825] border border-white/[0.06] hover:border-[#81B64C]/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#F1EFEA]">{study.title}</span>
                    <span className="text-[11px] text-[#81B64C] whitespace-nowrap">{study.category}</span>
                  </div>
                  <p className="text-[11px] text-[#98958E] mt-0.5">{study.subtitle}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: BOARD & ENGINE SETTINGS */}
      {activeTab === 'settings' && (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
          {/* Board Themes */}
          <div>
            <h2 className="text-xs font-bold text-[#E8E6DF] mb-2.5">Board Theme</h2>
            <div className="grid grid-cols-2 gap-2">
              {Object.values(BOARD_THEMES).map((t) => {
                const active = t.id === boardTheme;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onChangeBoardTheme(t.id)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#2C2B28] border-[#81B64C] text-white'
                        : 'bg-[#1B1A18] border-white/[0.06] text-[#B8B5AD] hover:border-white/15'
                    }`}
                  >
                    <span className="w-7 h-7 rounded overflow-hidden grid grid-cols-2 grid-rows-2 shrink-0 border border-black/25">
                      <span style={{ backgroundColor: t.light }} />
                      <span style={{ backgroundColor: t.dark }} />
                      <span style={{ backgroundColor: t.dark }} />
                      <span style={{ backgroundColor: t.light }} />
                    </span>
                    <span className="text-xs font-semibold truncate">{t.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Analysis Depth Slider */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="depth-slider" className="text-xs font-bold text-[#E8E6DF]">
                Stockfish Search Depth
              </label>
              <span className="text-xs font-mono tabular-nums text-[#81B64C] font-bold">Depth {analysisDepth}</span>
            </div>
            <input
              id="depth-slider"
              type="range"
              min={10}
              max={20}
              step={1}
              value={analysisDepth}
              onChange={(e) => onChangeAnalysisDepth(Number(e.target.value))}
              className="w-full accent-[#81B64C] cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-[#7E7B74] font-mono">
              <span>10 (Fast)</span>
              <span>16 (Tournament)</span>
              <span>20 (Deep)</span>
            </div>
          </div>

          {/* Toggle Rows */}
          <div className="flex flex-col gap-2">
            {[
              { label: 'Evaluation Bar', checked: showEvalBar, toggle: () => onToggleEvalBar(!showEvalBar) },
              { label: 'Best Move Arrow', checked: showBestArrow, toggle: () => onToggleBestArrow(!showBestArrow) },
              { label: 'Board Coordinates', checked: showCoordinates, toggle: () => onToggleCoordinates(!showCoordinates) },
              { label: 'Legal Move Guides', checked: showLegalMoves, toggle: () => onToggleLegalMoves(!showLegalMoves) },
              { label: 'Piece Audio Effects', checked: !muted, toggle: onToggleMuted },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                role="switch"
                aria-checked={item.checked}
                onClick={item.toggle}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-[#1B1A18] border border-white/[0.06] hover:border-white/15 transition-colors cursor-pointer"
              >
                <span className="text-xs font-medium text-[#E5E3DC]">{item.label}</span>
                <span
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors flex items-center ${
                    item.checked ? 'bg-[#81B64C] justify-end' : 'bg-[#3A3936] justify-start'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};

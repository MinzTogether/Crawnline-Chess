import React from 'react';
import type { EvalScore, MoveRecord } from '../types/chess';
import { evalToWhiteWinProbability, formatEvalScore } from '../engine/uciParser';

interface EvalGraphProps {
  moves: MoveRecord[];
  viewPly: number;
  onSelectPly: (ply: number) => void;
  liveEval?: EvalScore | null;
}

/**
 * Interactive SVG Advantage Chart (Chess.com Game Review style).
 * Plots Stockfish's White win-probability curve across all plies.
 */
export const EvalGraph: React.FC<EvalGraphProps> = ({ moves, viewPly, onSelectPly, liveEval }) => {
  const width = 320;
  const height = 74;
  const padX = 4;
  const padY = 6;
  const usableW = width - padX * 2;
  const usableH = height - padY * 2;

  const points: { ply: number; prob: number; label: string; score?: EvalScore }[] = [
    { ply: 0, prob: 50, label: 'Start' },
  ];

  let lastKnownProb = 50;
  for (const m of moves) {
    if (m.evalAfter) {
      lastKnownProb = evalToWhiteWinProbability(m.evalAfter);
    } else if (m.ply === viewPly && liveEval) {
      lastKnownProb = evalToWhiteWinProbability(liveEval);
    }
    points.push({
      ply: m.ply,
      prob: lastKnownProb,
      label: `${m.moveNumber}${m.color === 'w' ? '.' : '...'} ${m.san}`,
      score: m.evalAfter,
    });
  }

  const count = Math.max(points.length - 1, 1);
  const coords = points.map((pt, i) => {
    const x = padX + (i / count) * usableW;
    const y = padY + ((100 - pt.prob) / 100) * usableH;
    return { ...pt, x, y };
  });

  const linePath = coords.map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  const midY = padY + usableH / 2;
  const areaPath =
    coords.length > 1
      ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${height - padY} L ${coords[0].x.toFixed(1)} ${height - padY} Z`
      : '';

  const activePoint = coords[Math.min(viewPly, coords.length - 1)];

  return (
    <div className="bg-[#1C1B19] border border-white/[0.07] rounded-lg px-2.5 py-2">
      <div className="flex items-center justify-between text-[11px] text-[#9E9B94] mb-1">
        <span className="font-medium text-[#C8C5BC]">Advantage Graph</span>
        <span className="font-mono tabular-nums">
          {activePoint?.score ? formatEvalScore(activePoint.score) : activePoint?.label ?? '0.0'}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-[74px] block select-none cursor-pointer"
        role="img"
        aria-label="Stockfish evaluation advantage graph"
        onClick={(e) => {
          if (points.length <= 1) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          const targetPly = Math.round(ratio * (points.length - 1));
          onSelectPly(targetPly);
        }}
      >
        {/* Background: dark top half, lighter neutral bottom half */}
        <rect x={padX} y={padY} width={usableW} height={usableH} rx="3" fill="#2A2926" />
        {areaPath && <path d={areaPath} fill="#E7E4DC" fillOpacity="0.88" />}

        {/* Equal 0.0 midline */}
        <line
          x1={padX}
          y1={midY}
          x2={width - padX}
          y2={midY}
          stroke="#81B64C"
          strokeWidth="0.9"
          strokeDasharray="3 3"
          opacity="0.7"
        />

        {/* Curve stroke */}
        {coords.length > 1 && (
          <path d={linePath} fill="none" stroke="#81B64C" strokeWidth="1.75" strokeLinejoin="round" />
        )}

        {/* Active ply indicator */}
        {activePoint && (
          <>
            <line
              x1={activePoint.x}
              y1={padY}
              x2={activePoint.x}
              y2={height - padY}
              stroke="#E6A832"
              strokeWidth="1.2"
              opacity="0.85"
            />
            <circle cx={activePoint.x} cy={activePoint.y} r="3.4" fill="#E6A832" stroke="#181817" strokeWidth="1.2" />
          </>
        )}
      </svg>
    </div>
  );
};

import React, { useMemo } from 'react';
import type { EvalScore, MoveRecord } from '../types/chess';
import { evalToWhiteWinProbability, formatEvalScore } from '../engine/uciParser';

interface EvalGraphProps {
  moves: MoveRecord[];
  viewPly: number;
  onSelectPly: (ply: number) => void;
  liveEval?: EvalScore | null;
}

export const EvalGraph: React.FC<EvalGraphProps> = React.memo(({ moves, viewPly, onSelectPly, liveEval }) => {
  const width = 320;
  const height = 74;
  const padX = 4;
  const padY = 6;
  const usableW = width - padX * 2;
  const usableH = height - padY * 2;
  const midY = padY + usableH / 2;

  const { points, coords, linePath, areaPath, activePoint } = useMemo(() => {
    const pts: { ply: number; prob: number; label: string; score?: EvalScore }[] = [
      { ply: 0, prob: 50, label: 'Start' },
    ];

    let lastKnownProb = 50;
    for (const m of moves) {
      if (m.evalAfter) {
        lastKnownProb = evalToWhiteWinProbability(m.evalAfter);
      } else if (m.ply === viewPly && liveEval) {
        lastKnownProb = evalToWhiteWinProbability(liveEval);
      }
      pts.push({
        ply: m.ply,
        prob: lastKnownProb,
        label: `${m.moveNumber}${m.color === 'w' ? '.' : '...'} ${m.san}`,
        score: m.evalAfter,
      });
    }

    const count = Math.max(pts.length - 1, 1);
    const computedCoords = pts.map((pt, i) => {
      const x = padX + (i / count) * usableW;
      const y = padY + ((100 - pt.prob) / 100) * usableH;
      return { ...pt, x, y };
    });

    const computedLinePath = computedCoords
      .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
      .join(' ');
    const computedAreaPath =
      computedCoords.length > 1
        ? `${computedLinePath} L ${computedCoords[computedCoords.length - 1].x.toFixed(1)} ${height - padY} L ${computedCoords[0].x.toFixed(1)} ${height - padY} Z`
        : '';

    return {
      points: pts,
      coords: computedCoords,
      linePath: computedLinePath,
      areaPath: computedAreaPath,
      activePoint: computedCoords[Math.min(viewPly, computedCoords.length - 1)],
    };
  }, [moves, viewPly, liveEval, padX, padY, usableW, usableH, height]);

  return (
    <div className="bg-[var(--app-surface-2)] border border-[var(--app-border)] rounded-lg px-2.5 py-2">
      <div className="flex items-center justify-between text-[11px] text-[var(--app-text-muted)] mb-1">
        <span className="font-medium text-[var(--app-text)]">Advantage Graph</span>
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
        <rect x={padX} y={padY} width={usableW} height={usableH} rx="3" fill="#2A2926" />
        {areaPath && <path d={areaPath} fill="#E7E4DC" fillOpacity="0.88" />}

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

        {coords.length > 1 && (
          <path d={linePath} fill="none" stroke="#81B64C" strokeWidth="1.75" strokeLinejoin="round" />
        )}

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
});

EvalGraph.displayName = 'EvalGraph';

import { useState, useMemo } from 'react';
import type { Workout, ExerciseLog, ExerciseUnit } from '../types';
import { PHASES } from '../db/seed';

interface ProgressionChartProps {
  workouts: Workout[];
  logs: ExerciseLog[];
  unit: ExerciseUnit;
}

type ChartMode = 'weight' | 'reps' | 'volume';

interface DataPoint {
  date: string;
  dateTs: number;
  phaseId: string;
  maxWeight: number;
  avgReps: number;
  totalVolume: number;
}

const PHASE_COLORS: Record<string, string> = {
  P1: 'rgba(99, 102, 241, 0.15)',
  P2: 'rgba(239, 68, 68, 0.15)',
  P3: 'rgba(245, 158, 11, 0.15)',
  DL: 'rgba(34, 197, 94, 0.15)',
};

const PHASE_BORDER_COLORS: Record<string, string> = {
  P1: '#6366f1',
  P2: '#ef4444',
  P3: '#f59e0b',
  DL: '#22c55e',
};

const LINE_COLOR = '#4f8cff';
const DOT_COLOR = '#4f8cff';

const MODE_LABELS: Record<ChartMode, string> = {
  weight: 'Weight',
  reps: 'Reps',
  volume: 'Volume',
};

function defaultMode(unit: ExerciseUnit): ChartMode {
  if (unit === 'reps-only') return 'reps';
  if (unit === 'seconds') return 'weight'; // "weight" stores seconds
  return 'weight';
}

function availableModes(unit: ExerciseUnit): ChartMode[] {
  if (unit === 'reps-only') return ['reps'];
  if (unit === 'seconds') return ['weight']; // only duration makes sense
  return ['weight', 'reps', 'volume'];
}

export default function ProgressionChart({ workouts, logs, unit }: ProgressionChartProps) {
  const modes = availableModes(unit);
  const [mode, setMode] = useState<ChartMode>(defaultMode(unit));

  const data = useMemo(() => {
    const points: DataPoint[] = [];

    for (const w of workouts) {
      const wLogs = logs.filter((l) => l.workoutId === w.id);
      if (wLogs.length === 0) continue;

      points.push({
        date: w.date,
        dateTs: new Date(w.date).getTime(),
        phaseId: w.phaseId,
        maxWeight: Math.max(...wLogs.map((l) => l.weight)),
        avgReps: wLogs.reduce((a, l) => a + l.reps, 0) / wLogs.length,
        totalVolume: wLogs.reduce((a, l) => a + l.weight * l.reps, 0),
      });
    }

    return points.sort((a, b) => a.dateTs - b.dateTs);
  }, [workouts, logs]);

  if (data.length < 2) return null;

  const getValue = (p: DataPoint) => {
    if (mode === 'reps') return p.avgReps;
    if (mode === 'volume') return p.totalVolume;
    return p.maxWeight;
  };

  const yLabel = (() => {
    if (unit === 'seconds') return 'sec';
    if (mode === 'reps') return 'reps';
    if (mode === 'volume') return 'kg';
    return 'kg';
  })();

  const values = data.map(getValue);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const valRange = maxVal - minVal || 1;

  // Chart dimensions
  const W = 360;
  const H = 200;
  const PAD_L = 44;
  const PAD_R = 12;
  const PAD_T = 16;
  const PAD_B = 40;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const minTs = data[0].dateTs;
  const maxTs = data[data.length - 1].dateTs;
  const tsRange = maxTs - minTs || 1;

  const toX = (ts: number) => PAD_L + ((ts - minTs) / tsRange) * chartW;
  const toY = (v: number) => PAD_T + chartH - ((v - minVal + valRange * 0.1) / (valRange * 1.2)) * chartH;

  // Phase background rects
  const phaseRanges: { phaseId: string; x1: number; x2: number }[] = [];
  let currentPhase = data[0].phaseId;
  let rangeStart = data[0].dateTs;

  for (let i = 1; i < data.length; i++) {
    if (data[i].phaseId !== currentPhase) {
      phaseRanges.push({ phaseId: currentPhase, x1: toX(rangeStart), x2: toX(data[i].dateTs) });
      currentPhase = data[i].phaseId;
      rangeStart = data[i].dateTs;
    }
  }
  phaseRanges.push({ phaseId: currentPhase, x1: toX(rangeStart), x2: toX(maxTs) });

  // Line path
  const linePoints = data.map((p) => `${toX(p.dateTs)},${toY(getValue(p))}`);
  const linePath = `M${linePoints.join(' L')}`;

  // Y-axis ticks
  const yTicks = 4;
  const yStep = valRange / yTicks;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => minVal + i * yStep);

  // X-axis date labels
  const xLabelCount = Math.min(5, data.length);
  const xLabelStep = Math.max(1, Math.floor(data.length / xLabelCount));
  const xLabels = data.filter((_, i) => i % xLabelStep === 0 || i === data.length - 1);

  // Phase legend
  const presentPhases = [...new Set(data.map((d) => d.phaseId))];

  return (
    <div className="progression-chart">
      {modes.length > 1 && (
        <div className="chart-mode-tabs">
          {modes.map((m) => (
            <button
              key={m}
              className={`chart-mode-tab ${m === mode ? 'chart-mode-tab--active' : ''}`}
              onClick={() => setMode(m)}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
      )}

      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg">
        {/* Phase backgrounds */}
        {phaseRanges.map((r, i) => (
          <rect
            key={i}
            x={r.x1}
            y={PAD_T}
            width={Math.max(r.x2 - r.x1, 2)}
            height={chartH}
            fill={PHASE_COLORS[r.phaseId] ?? 'transparent'}
          />
        ))}

        {/* Phase boundary lines */}
        {phaseRanges.slice(1).map((r, i) => (
          <line
            key={`b${i}`}
            x1={r.x1}
            y1={PAD_T}
            x2={r.x1}
            y2={PAD_T + chartH}
            stroke={PHASE_BORDER_COLORS[phaseRanges[i].phaseId] ?? '#666'}
            strokeWidth="1"
            strokeDasharray="4 3"
          />
        ))}

        {/* Y-axis grid + labels */}
        {yTickValues.map((v, i) => (
          <g key={i}>
            <line
              x1={PAD_L}
              y1={toY(v)}
              x2={W - PAD_R}
              y2={toY(v)}
              stroke="#333"
              strokeWidth="0.5"
            />
            <text x={PAD_L - 4} y={toY(v) + 4} textAnchor="end" className="chart-label">
              {mode === 'volume' ? Math.round(v).toLocaleString() : Math.round(v * 10) / 10}
            </text>
          </g>
        ))}

        {/* X-axis date labels */}
        {xLabels.map((p) => (
          <text
            key={p.date}
            x={toX(p.dateTs)}
            y={H - 8}
            textAnchor="middle"
            className="chart-label"
          >
            {p.date.slice(5)}
          </text>
        ))}

        {/* Data line */}
        <path d={linePath} fill="none" stroke={LINE_COLOR} strokeWidth="2" strokeLinejoin="round" />

        {/* Data dots */}
        {data.map((p, i) => (
          <circle
            key={i}
            cx={toX(p.dateTs)}
            cy={toY(getValue(p))}
            r="4"
            fill={DOT_COLOR}
            stroke="#0f0f0f"
            strokeWidth="1.5"
          />
        ))}

        {/* Y-axis unit label */}
        <text x={4} y={PAD_T + 4} className="chart-label chart-label--unit">
          {yLabel}
        </text>
      </svg>

      {/* Phase legend */}
      <div className="chart-legend">
        {presentPhases.map((pid) => {
          const phase = PHASES.find((p) => p.id === pid);
          return (
            <span key={pid} className="chart-legend-item">
              <span
                className="chart-legend-dot"
                style={{ background: PHASE_BORDER_COLORS[pid] }}
              />
              {phase?.name ?? pid}
            </span>
          );
        })}
      </div>
    </div>
  );
}

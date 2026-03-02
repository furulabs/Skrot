import { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceArea,
} from 'recharts';
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
  value: number;
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

const MODE_LABELS: Record<ChartMode, string> = {
  weight: 'Weight',
  reps: 'Reps',
  volume: 'Volume',
};

function defaultMode(unit: ExerciseUnit): ChartMode {
  if (unit === 'reps-only') return 'reps';
  if (unit === 'seconds') return 'weight';
  return 'weight';
}

function availableModes(unit: ExerciseUnit): ChartMode[] {
  if (unit === 'reps-only') return ['reps'];
  if (unit === 'seconds') return ['weight'];
  return ['weight', 'reps', 'volume'];
}

function getValue(
  wLogs: ExerciseLog[],
  mode: ChartMode,
): number {
  if (mode === 'reps') return wLogs.reduce((a, l) => a + l.reps, 0) / wLogs.length;
  if (mode === 'volume') return wLogs.reduce((a, l) => a + l.weight * l.reps, 0);
  return Math.max(...wLogs.map((l) => l.weight));
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

interface PhaseRange {
  phaseId: string;
  x1: number;
  x2: number;
}

export default function ProgressionChart({ workouts, logs, unit }: ProgressionChartProps) {
  const modes = availableModes(unit);
  const [mode, setMode] = useState<ChartMode>(defaultMode(unit));

  const { data, phaseRanges, yLabel } = useMemo(() => {
    const points: DataPoint[] = [];

    for (const w of workouts) {
      const wLogs = logs.filter((l) => l.workoutId === w.id);
      if (wLogs.length === 0) continue;

      points.push({
        date: w.date,
        dateTs: new Date(w.date).getTime(),
        phaseId: w.phaseId,
        value: getValue(wLogs, mode),
      });
    }

    points.sort((a, b) => a.dateTs - b.dateTs);

    // Build phase ranges for background coloring
    const ranges: PhaseRange[] = [];
    if (points.length > 0) {
      let currentPhase = points[0].phaseId;
      let rangeStart = points[0].dateTs;

      for (let i = 1; i < points.length; i++) {
        if (points[i].phaseId !== currentPhase) {
          // Midpoint between last point of old phase and first of new
          const midpoint = (points[i - 1].dateTs + points[i].dateTs) / 2;
          ranges.push({ phaseId: currentPhase, x1: rangeStart, x2: midpoint });
          currentPhase = points[i].phaseId;
          rangeStart = midpoint;
        }
      }
      ranges.push({ phaseId: currentPhase, x1: rangeStart, x2: points[points.length - 1].dateTs });
    }

    const label = (() => {
      if (unit === 'seconds') return 'sec';
      if (mode === 'reps') return 'reps';
      if (mode === 'volume') return 'kg';
      return 'kg';
    })();

    return { data: points, phaseRanges: ranges, yLabel: label };
  }, [workouts, logs, mode, unit]);

  if (data.length < 2) return null;

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

      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          {/* Phase background areas */}
          {phaseRanges.map((r, i) => (
            <ReferenceArea
              key={i}
              x1={r.x1}
              x2={r.x2}
              fill={PHASE_COLORS[r.phaseId] ?? 'transparent'}
              fillOpacity={1}
              ifOverflow="extendDomain"
            />
          ))}

          <XAxis
            dataKey="dateTs"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={formatDate}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={{ stroke: '#333' }}
            tickLine={false}
            tickCount={5}
            scale="time"
          />
          <YAxis
            domain={['auto', 'auto']}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) =>
              mode === 'volume' ? Math.round(v).toLocaleString() : String(Math.round(v * 10) / 10)
            }
            label={{
              value: yLabel,
              position: 'insideTopLeft',
              offset: 10,
              style: { fill: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase' },
            }}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 13,
            }}
            labelFormatter={(ts) => {
              const d = new Date(Number(ts));
              return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            }}
            formatter={(val) => {
              const v = Number(val);
              return [
                mode === 'volume' ? Math.round(v).toLocaleString() : Math.round(v * 10) / 10,
                MODE_LABELS[mode],
              ];
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={LINE_COLOR}
            strokeWidth={2}
            dot={{ fill: LINE_COLOR, stroke: '#0f0f0f', strokeWidth: 1.5, r: 4 }}
            activeDot={{ fill: LINE_COLOR, stroke: '#fff', strokeWidth: 2, r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>

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

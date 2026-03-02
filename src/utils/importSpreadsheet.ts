import { db } from '../db/database';
import type { PhaseId, SessionId } from '../types';

// Maps spreadsheet exercise names to our exercise IDs
const EXERCISE_MAP: Record<string, { id: string; session: SessionId }> = {
  'A1 Bench Press': { id: 'bench', session: 'A' },
  'A2 Squat': { id: 'squat', session: 'A' },
  'A3 Barbell Row': { id: 'row', session: 'A' },
  'A4 Plank': { id: 'plank', session: 'A' },
  'B1 Deadlift': { id: 'deadlift', session: 'B' },
  'B2 Overhead Press': { id: 'ohp', session: 'B' },
  'B3 Lat Pulldown': { id: 'lat-pulldown', session: 'B' },
  'B4 Side Plank': { id: 'side-plank', session: 'B' },
};

const TIMED_EXERCISES = new Set(['plank', 'side-plank']);
const PULLUP_CUTOVER = '2026-02-06';
const PULLUP_BODYWEIGHT = 84; // kg — used as weight for pull-up sets
// Bench was reported as per-dumbbell weight before switching to barbell at Fresh gym
const BARBELL_CUTOVER = '2026-01-26';

function parseDate(raw: string): string | null {
  if (!raw || !raw.trim()) return null;

  // Normalize separators to /
  const normalized = raw.trim().replace(/[-\.]/g, '/');
  const parts = normalized.split('/');
  if (parts.length !== 3) return null;

  let [d, m, y] = parts;
  if (y.length === 2) y = '20' + y;
  d = d.padStart(2, '0');
  m = m.padStart(2, '0');

  return `${y}-${m}-${d}`;
}

interface RawRow {
  date: string;
  phase: string;
  exercise: string;
  reps: string;
  s1: string;
  s2: string;
  s3: string;
  s4: string;
  notes: string;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

// A new gym session starts with A1 Bench Press or B1 Deadlift
const SESSION_STARTERS = new Set(['A1 Bench Press', 'B1 Deadlift']);

function midpointDate(before: string, after: string): string {
  const a = new Date(before).getTime();
  const b = new Date(after).getTime();
  const mid = new Date(a + (b - a) / 2);
  return mid.toISOString().slice(0, 10);
}

export async function importSpreadsheetCSV(csvText: string): Promise<number> {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return 0;

  // First pass: parse all CSV rows into structured data
  interface ParsedLine {
    rawDate: string;
    phase: string;
    exercise: string;
    reps: string;
    s1: string; s2: string; s3: string; s4: string;
    notes: string;
  }
  const parsed: ParsedLine[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 5) continue;

    const exercise = cols[2]?.trim();
    if (!exercise || !EXERCISE_MAP[exercise]) continue;

    const totalLoadRaw = cols[8]?.trim() ?? '';
    const notesCol9 = cols[9]?.trim() ?? '';

    parsed.push({
      rawDate: cols[0]?.trim() ?? '',
      phase: cols[1]?.trim() ?? '',
      exercise,
      reps: cols[3]?.trim() ?? '',
      s1: cols[4]?.trim() ?? '',
      s2: cols[5]?.trim() ?? '',
      s3: cols[6]?.trim() ?? '',
      s4: cols[7]?.trim() ?? '',
      notes: notesCol9 || (isNaN(Number(totalLoadRaw)) ? totalLoadRaw : ''),
    });
  }

  // Second pass: identify session boundaries and assign dates.
  // A session boundary is a SESSION_STARTER exercise.
  // If a session starter has no date, interpolate between the previous and next known dates.
  interface Session { startIdx: number; rawDate: string; }
  const sessions: Session[] = [];

  for (let i = 0; i < parsed.length; i++) {
    if (SESSION_STARTERS.has(parsed[i].exercise)) {
      sessions.push({ startIdx: i, rawDate: parsed[i].rawDate });
    }
  }

  // Resolve dates: carry forward explicit dates, interpolate missing ones
  let lastKnownDate = '';
  for (let si = 0; si < sessions.length; si++) {
    const s = sessions[si];
    const isoDate = parseDate(s.rawDate);

    if (isoDate) {
      lastKnownDate = isoDate;
      s.rawDate = isoDate;
    } else if (lastKnownDate) {
      // Find next session with a known date
      let nextKnownDate = '';
      for (let ni = si + 1; ni < sessions.length; ni++) {
        const nd = parseDate(sessions[ni].rawDate);
        if (nd) { nextKnownDate = nd; break; }
      }
      s.rawDate = nextKnownDate
        ? midpointDate(lastKnownDate, nextKnownDate)
        : lastKnownDate; // fallback: use last known date + assume same day
      lastKnownDate = s.rawDate;
    }
  }

  // Build a map: parsed row index → session date
  const rowDateMap = new Map<number, string>();
  for (let si = 0; si < sessions.length; si++) {
    const endIdx = si + 1 < sessions.length ? sessions[si + 1].startIdx : parsed.length;
    for (let ri = sessions[si].startIdx; ri < endIdx; ri++) {
      rowDateMap.set(ri, sessions[si].rawDate);
    }
  }

  // Third pass: build RawRow array with corrected dates
  const rows: RawRow[] = [];
  let lastPhase = '';

  for (let i = 0; i < parsed.length; i++) {
    const p = parsed[i];
    if (p.phase) lastPhase = p.phase;

    const date = rowDateMap.get(i);
    if (!date) continue;

    rows.push({
      date,
      phase: lastPhase,
      exercise: p.exercise,
      reps: p.reps,
      s1: p.s1, s2: p.s2, s3: p.s3, s4: p.s4,
      notes: p.notes,
    });
  }

  // Group into workouts by date + session
  const workoutMap = new Map<string, {
    date: string;
    phaseId: PhaseId;
    sessionId: SessionId;
    notes: string[];
    logs: { exerciseId: string; setNumber: number; weight: number; reps: number }[];
  }>();

  for (const row of rows) {
    const isoDate = row.date; // already resolved to ISO format
    if (!isoDate) continue;

    const mapped = EXERCISE_MAP[row.exercise];
    if (!mapped) continue;

    // P2 started 11/2/26 (2026-02-11), everything before was P1
    const phaseId: PhaseId = isoDate >= '2026-02-11' ? 'P2' : 'P1';
    const reps = parseInt(row.reps, 10) || 0;

    const exerciseId = mapped.id;

    const isTimed = TIMED_EXERCISES.has(exerciseId);
    // After cutover, lat pulldown entries are actually pull-ups (set values = reps, weight = bodyweight)
    const isPullUp = exerciseId === 'lat-pulldown' && isoDate >= PULLUP_CUTOVER;

    const key = `${isoDate}-${mapped.session}`;

    if (!workoutMap.has(key)) {
      workoutMap.set(key, {
        date: isoDate,
        phaseId,
        sessionId: mapped.session,
        notes: [],
        logs: [],
      });
    }

    const workout = workoutMap.get(key)!;
    if (row.notes) workout.notes.push(`${exerciseId}: ${row.notes}`);

    const loads = [row.s1, row.s2, row.s3, row.s4];

    if (isTimed) {
      // For plank/side plank: values are seconds, fill missing sets with last known value
      let lastVal = 0;
      for (let s = 0; s < 4; s++) {
        const val = parseFloat(loads[s]);
        if (!isNaN(val) && val > 0) {
          lastVal = val;
        }
        if (lastVal > 0) {
          workout.logs.push({
            exerciseId,
            setNumber: s + 1,
            weight: lastVal, // stored as "weight" but means seconds
            reps: 1,
          });
        }
      }
    } else if (isPullUp) {
      // Pull-ups: set values are reps, weight = bodyweight
      for (let s = 0; s < 4; s++) {
        const pullReps = parseFloat(loads[s]);
        if (!isNaN(pullReps) && pullReps > 0) {
          workout.logs.push({
            exerciseId: 'lat-pulldown',
            setNumber: s + 1,
            weight: PULLUP_BODYWEIGHT,
            reps: pullReps,
          });
        }
      }
    } else {
      // Standard: values are weight in kg
      // Bench was per-dumbbell before barbell cutover — double it
      const doubleBench = exerciseId === 'bench' && isoDate < BARBELL_CUTOVER;
      for (let s = 0; s < 4; s++) {
        let weight = parseFloat(loads[s]);
        if (!isNaN(weight) && weight > 0) {
          if (doubleBench) weight *= 2;
          workout.logs.push({
            exerciseId,
            setNumber: s + 1,
            weight,
            reps: reps || 12,
          });
        }
      }
    }
  }

  // Insert into Dexie
  let imported = 0;
  for (const w of workoutMap.values()) {
    if (w.logs.length === 0) continue;

    const workoutId = await db.workouts.add({
      date: w.date,
      phaseId: w.phaseId,
      sessionId: w.sessionId,
      notes: w.notes.join('; '),
      createdAt: new Date().toISOString(),
      synced: 0,
    });

    for (const log of w.logs) {
      await db.exerciseLogs.add({
        workoutId,
        exerciseId: log.exerciseId,
        setNumber: log.setNumber,
        weight: log.weight,
        reps: log.reps,
        synced: 0,
      });
    }
    imported++;
  }

  return imported;
}

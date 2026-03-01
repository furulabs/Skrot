import { db } from '../db/database';
import type { Workout, ExerciseLog } from '../types';
import { EXERCISES } from '../db/seed';

export function exportWorkoutsCSV(
  workouts: Workout[],
  logs: ExerciseLog[]
): string {
  const lines: string[] = ['date,session,phase,exercise,set,weight_kg,reps,notes'];

  for (const w of workouts) {
    const wLogs = logs
      .filter((l) => l.workoutId === w.id)
      .sort((a, b) => {
        const exA = EXERCISES.findIndex((e) => e.id === a.exerciseId);
        const exB = EXERCISES.findIndex((e) => e.id === b.exerciseId);
        if (exA !== exB) return exA - exB;
        return a.setNumber - b.setNumber;
      });

    for (const l of wLogs) {
      const ex = EXERCISES.find((e) => e.id === l.exerciseId);
      lines.push(
        `${w.date},${w.sessionId},${w.phaseId},${ex?.name ?? l.exerciseId},${l.setNumber},${l.weight},${l.reps},"${w.notes.replace(/"/g, '""')}"`
      );
    }
  }

  return lines.join('\n');
}

export async function importWorkoutsCSV(csvText: string): Promise<number> {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return 0;

  // Skip header
  const dataLines = lines.slice(1);

  // Group by date+session to create workouts
  const workoutMap = new Map<string, { date: string; sessionId: string; phaseId: string; notes: string; logs: { exerciseId: string; setNumber: number; weight: number; reps: number }[] }>();

  for (const line of dataLines) {
    const parts = parseCSVLine(line);
    if (parts.length < 7) continue;

    const [date, session, phase, exerciseName, set, weight, reps, notes] = parts;

    // Match exercise by name
    const exercise = EXERCISES.find(
      (e) => e.name.toLowerCase() === exerciseName.toLowerCase()
    );
    if (!exercise) continue;

    const key = `${date}-${session}`;
    if (!workoutMap.has(key)) {
      workoutMap.set(key, {
        date,
        sessionId: session,
        phaseId: phase,
        notes: notes ?? '',
        logs: [],
      });
    }

    workoutMap.get(key)!.logs.push({
      exerciseId: exercise.id,
      setNumber: parseInt(set, 10),
      weight: parseFloat(weight),
      reps: parseInt(reps, 10),
    });
  }

  let imported = 0;

  for (const w of workoutMap.values()) {
    const workoutId = await db.workouts.add({
      date: w.date,
      phaseId: w.phaseId as any,
      sessionId: w.sessionId as any,
      notes: w.notes,
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

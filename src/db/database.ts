import Dexie, { type Table } from 'dexie';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Workout, ExerciseLog, Draft } from '../types';

// --- Dexie (local) ---

class PeriodDB extends Dexie {
  workouts!: Table<Workout, number>;
  exerciseLogs!: Table<ExerciseLog, number>;

  constructor() {
    super('PeriodDB');
    this.version(1).stores({
      workouts: '++id, supabaseId, date, sessionId, phaseId, synced',
      exerciseLogs: '++id, supabaseId, workoutId, exerciseId, synced',
    });
  }
}

export const db = new PeriodDB();

// --- Draft persistence (localStorage) ---

const DRAFT_KEY = 'period_draft';

export function saveDraft(draft: Draft): void {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function loadDraft(): Draft | null {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Draft;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  localStorage.removeItem(DRAFT_KEY);
}

// --- Program settings (localStorage) ---

const PROGRAM_KEY = 'period_program';

export interface ProgramSettings {
  phaseSessions: { P1: number; P2: number; P3: number; DL: number };
  bodyweight: number; // kg, used for pull-up weight tracking
  restSeconds: { P1: number; P2: number; P3: number; DL: number };
  repRanges: { P1: [number, number]; P2: [number, number]; P3: [number, number]; DL: [number, number] };
  deloadWeightPercent: number; // reduce weight by this %
}

const DEFAULT_PROGRAM: ProgramSettings = {
  phaseSessions: { P1: 15, P2: 12, P3: 6, DL: 3 },
  bodyweight: 84,
  restSeconds: { P1: 60, P2: 120, P3: 180, DL: 60 },
  repRanges: { P1: [8, 12], P2: [4, 6], P3: [1, 5], DL: [8, 12] },
  deloadWeightPercent: 50,
};

function deepMerge(target: any, source: any): any {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] !== null &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

export function getProgramSettings(): ProgramSettings {
  const raw = localStorage.getItem(PROGRAM_KEY);
  if (!raw) return DEFAULT_PROGRAM;
  try {
    return deepMerge(DEFAULT_PROGRAM, JSON.parse(raw));
  } catch {
    return DEFAULT_PROGRAM;
  }
}

export function setProgramSettings(settings: Partial<ProgramSettings>): void {
  const current = getProgramSettings();
  localStorage.setItem(PROGRAM_KEY, JSON.stringify(deepMerge(current, settings)));
}

// --- Supabase ---

const SUPABASE_URL_KEY = 'period_supabase_url';
const SUPABASE_ANON_KEY = 'period_supabase_anon_key';

let supabase: SupabaseClient | null = null;

export function getSupabaseConfig(): { url: string; anonKey: string } | null {
  const url = localStorage.getItem(SUPABASE_URL_KEY);
  const anonKey = localStorage.getItem(SUPABASE_ANON_KEY);
  if (url && anonKey) return { url, anonKey };
  return null;
}

export function setSupabaseConfig(url: string, anonKey: string): void {
  localStorage.setItem(SUPABASE_URL_KEY, url);
  localStorage.setItem(SUPABASE_ANON_KEY, anonKey);
  supabase = createClient(url, anonKey);
}

export function getSupabase(): SupabaseClient | null {
  if (supabase) return supabase;
  const config = getSupabaseConfig();
  if (!config) return null;
  supabase = createClient(config.url, config.anonKey);
  return supabase;
}

// --- Sync logic ---

export async function syncToSupabase(): Promise<{ synced: number; errors: number }> {
  const client = getSupabase();
  if (!client) return { synced: 0, errors: 0 };

  let synced = 0;
  let errors = 0;

  // Sync unsynced workouts
  const unsyncedWorkouts = await db.workouts.where('synced').equals(0).toArray();

  for (const workout of unsyncedWorkouts) {
    const { data, error } = await client.from('workouts').insert({
      date: workout.date,
      phase_id: workout.phaseId,
      session_id: workout.sessionId,
      notes: workout.notes,
      created_at: workout.createdAt,
    }).select('id').single();

    if (error) {
      console.error('Workout sync error:', error, 'workout:', workout);
      errors++;
      continue;
    }

    // Update local record with supabase ID
    await db.workouts.update(workout.id!, {
      supabaseId: data.id,
      synced: 1,
    });

    // Sync exercise logs for this workout
    const logs = await db.exerciseLogs.where('workoutId').equals(workout.id!).toArray();
    for (const log of logs) {
      const { error: logError } = await client.from('exercise_logs').insert({
        workout_id: data.id,
        exercise_id: log.exerciseId,
        set_number: log.setNumber,
        weight: log.weight,
        reps: log.reps,
      });

      if (logError) {
        console.error('Log sync error:', logError, 'log:', log);
        errors++;
      } else {
        await db.exerciseLogs.update(log.id!, { synced: 1 });
        synced++;
      }
    }
    synced++;
  }

  return { synced, errors };
}

export async function pullFromSupabase(): Promise<number> {
  const client = getSupabase();
  if (!client) return 0;

  let imported = 0;

  const { data: workouts, error } = await client
    .from('workouts')
    .select('*, exercise_logs(*)')
    .order('date', { ascending: false });

  if (error || !workouts) return 0;

  for (const w of workouts) {
    // Skip if already exists locally
    const existing = await db.workouts.where('supabaseId').equals(w.id).first();
    if (existing) continue;

    const localId = await db.workouts.add({
      supabaseId: w.id,
      date: w.date,
      phaseId: w.phase_id,
      sessionId: w.session_id,
      notes: w.notes || '',
      createdAt: w.created_at,
      synced: 1,
    });

    for (const log of w.exercise_logs || []) {
      await db.exerciseLogs.add({
        supabaseId: log.id,
        workoutId: localId,
        exerciseId: log.exercise_id,
        setNumber: log.set_number,
        weight: log.weight,
        reps: log.reps,
        synced: 1,
      });
    }
    imported++;
  }

  return imported;
}

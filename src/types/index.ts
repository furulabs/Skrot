export type PhaseId = 'P1' | 'P2' | 'P3' | 'DL';
export type SessionId = 'A' | 'B';

export interface Phase {
  id: PhaseId;
  name: string;
  repRange: [number, number];
  defaultReps: number;
}

export type ExerciseUnit = 'kg' | 'seconds' | 'reps-only';

export interface Exercise {
  id: string;
  name: string;
  session: SessionId;
  order: number;
  unit: ExerciseUnit;
  legacy?: boolean;
}

export interface Workout {
  id?: number;
  supabaseId?: string;
  date: string; // ISO date string YYYY-MM-DD
  phaseId: PhaseId;
  sessionId: SessionId;
  notes: string;
  createdAt: string;
  synced: 0 | 1;
}

export interface ExerciseLog {
  id?: number;
  supabaseId?: string;
  workoutId: number;
  exerciseId: string;
  setNumber: number; // 1-4
  weight: number;
  reps: number;
  synced: 0 | 1;
}

export interface Draft {
  sessionId: SessionId;
  phaseId: PhaseId;
  date: string;
  currentExerciseIndex: number;
  currentSetNumber: number;
  completedSets: DraftSet[];
  workoutId?: number;
}

export interface DraftSet {
  exerciseId: string;
  setNumber: number;
  weight: number;
  reps: number;
}

// --- Erg session tracking ---

export type ErgType = 'row' | 'bike' | 'skierg';

export interface ErgSession {
  id?: number;
  date: string; // ISO date string YYYY-MM-DD
  type: ErgType;
  time: string; // total time e.g. "5:05" or "30:00"
  distance: number; // meters
  pace: string; // avg /500m e.g. "2:09.3"
  strokeRate?: number; // strokes/min (or rpm for bike)
  photo?: string; // base64 data URL of the PM5 screen
  notes: string;
  createdAt: string;
}

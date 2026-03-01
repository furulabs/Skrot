export type PhaseId = 'P1' | 'P2' | 'P3' | 'DL';
export type SessionId = 'A' | 'B';

export interface Phase {
  id: PhaseId;
  name: string;
  repRange: [number, number];
  defaultReps: number;
}

export interface Exercise {
  id: string;
  name: string;
  session: SessionId;
  order: number;
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
}

export interface DraftSet {
  exerciseId: string;
  setNumber: number;
  weight: number;
  reps: number;
}

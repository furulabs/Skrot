import type { Phase, Exercise } from '../types';

export const PHASES: Phase[] = [
  { id: 'P1', name: 'Hypertrophy', repRange: [10, 12], defaultReps: 10 },
  { id: 'P2', name: 'Strength', repRange: [6, 8], defaultReps: 8 },
  { id: 'P3', name: 'Power', repRange: [3, 5], defaultReps: 5 },
  { id: 'DL', name: 'Deload', repRange: [8, 10], defaultReps: 8 },
];

export const EXERCISES: Exercise[] = [
  { id: 'bench', name: 'Bench Press', session: 'A', order: 1 },
  { id: 'squat', name: 'Squat', session: 'A', order: 2 },
  { id: 'row', name: 'Row', session: 'A', order: 3 },
  { id: 'plank', name: 'Plank', session: 'A', order: 4 },
  { id: 'deadlift', name: 'Deadlift', session: 'B', order: 1 },
  { id: 'ohp', name: 'OHP', session: 'B', order: 2 },
  { id: 'lat-pulldown', name: 'Lat Pulldown', session: 'B', order: 3 },
  { id: 'side-plank', name: 'Side Plank', session: 'B', order: 4 },
];

export const SETS_PER_EXERCISE = 4;
export const EXERCISES_PER_SESSION = 4;
export const TOTAL_SETS = SETS_PER_EXERCISE * EXERCISES_PER_SESSION; // 16

export function getExercisesForSession(sessionId: 'A' | 'B'): Exercise[] {
  return EXERCISES.filter((e) => e.session === sessionId).sort((a, b) => a.order - b.order);
}

export function getPhase(phaseId: string): Phase {
  return PHASES.find((p) => p.id === phaseId) ?? PHASES[0];
}

export function getExercise(exerciseId: string): Exercise {
  return EXERCISES.find((e) => e.id === exerciseId)!;
}

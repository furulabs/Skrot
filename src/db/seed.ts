import type { Phase, Exercise } from '../types';

export const PHASES: Phase[] = [
  { id: 'P1', name: 'Hypertrophy', repRange: [8, 12], defaultReps: 10 },
  { id: 'P2', name: 'Strength', repRange: [4, 6], defaultReps: 5 },
  { id: 'P3', name: 'Power', repRange: [1, 5], defaultReps: 3 },
  { id: 'DL', name: 'Deload', repRange: [8, 12], defaultReps: 10 },
];

export const EXERCISES: Exercise[] = [
  { id: 'bench', name: 'Bench Press', session: 'A', order: 1, unit: 'kg' },
  { id: 'squat', name: 'Squat', session: 'A', order: 2, unit: 'kg' },
  { id: 'row', name: 'Row', session: 'A', order: 3, unit: 'kg' },
  { id: 'plank', name: 'Plank', session: 'A', order: 4, unit: 'seconds' },
  { id: 'deadlift', name: 'Deadlift', session: 'B', order: 1, unit: 'kg' },
  { id: 'ohp', name: 'OHP', session: 'B', order: 2, unit: 'kg' },
  { id: 'lat-pulldown', name: 'Lat Pulldown / Pull Up', session: 'B', order: 3, unit: 'kg' },
  { id: 'side-plank', name: 'Side Plank', session: 'B', order: 4, unit: 'seconds' },
];

export const SETS_PER_EXERCISE = 4;
export const EXERCISES_PER_SESSION = 4;
export const TOTAL_SETS = SETS_PER_EXERCISE * EXERCISES_PER_SESSION; // 16

export function getExercisesForSession(sessionId: 'A' | 'B'): Exercise[] {
  return EXERCISES.filter((e) => e.session === sessionId && !e.legacy).sort((a, b) => a.order - b.order);
}

export function getPhase(phaseId: string): Phase {
  return PHASES.find((p) => p.id === phaseId) ?? PHASES[0];
}

const PHASE_ORDER: Phase['id'][] = ['P1', 'P2', 'P3', 'DL'];

export function getNextPhase(currentPhaseId: string): Phase['id'] {
  const idx = PHASE_ORDER.indexOf(currentPhaseId as Phase['id']);
  return PHASE_ORDER[(idx + 1) % PHASE_ORDER.length];
}

export function getExercise(exerciseId: string): Exercise {
  return EXERCISES.find((e) => e.id === exerciseId)!;
}

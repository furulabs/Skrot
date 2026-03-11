import { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { SessionId, PhaseId, DraftSet } from '../types';
import { db, saveDraft, clearDraft, syncToSupabase, getProgramSettings } from '../db/database';
import { getExercisesForSession, getPhase, SETS_PER_EXERCISE, getExercise } from '../db/seed';
import SetCard from './SetCard';
import WorkoutSummary from './WorkoutSummary';

type WorkoutState = 'set' | 'summary';

interface ActiveWorkoutProps {
  sessionId: SessionId;
  phaseId: PhaseId;
  initialSets?: DraftSet[];
  initialExerciseIndex?: number;
  initialSetNumber?: number;
  initialWorkoutId?: number;
  onFinish: () => void;
}

export default function ActiveWorkout({
  sessionId,
  phaseId,
  initialSets = [],
  initialExerciseIndex = 0,
  initialSetNumber = 1,
  initialWorkoutId,
  onFinish,
}: ActiveWorkoutProps) {
  const exercises = getExercisesForSession(sessionId);
  const phase = getPhase(phaseId);
  const settings = getProgramSettings();

  const repRange = settings.repRanges[phaseId];

  const [exerciseIndex, setExerciseIndex] = useState(initialExerciseIndex);
  const [setNumber, setSetNumber] = useState(initialSetNumber);
  const [completedSets, setCompletedSets] = useState<DraftSet[]>(initialSets);
  const [workoutState, setWorkoutState] = useState<WorkoutState>('set');
  const [workoutId, setWorkoutId] = useState<number | null>(initialWorkoutId ?? null);
  const [restStartedAt, setRestStartedAt] = useState<number | null>(() => {
    const stored = sessionStorage.getItem('restStartedAt');
    return stored ? Number(stored) : null;
  });

  const currentExercise = exercises[exerciseIndex];

  // Look up last session's data for pre-fill (exclude the current in-progress workout)
  const lastWorkout = useLiveQuery(async () => {
    const all = await db.workouts
      .where('sessionId')
      .equals(sessionId)
      .reverse()
      .sortBy('date');
    // Skip the current workout so pre-fill always uses the previous one
    const prev = all.find((w) => w.id !== workoutId);
    return prev ?? null;
  }, [sessionId, workoutId]);

  const lastLogs = useLiveQuery(async () => {
    if (!lastWorkout?.id) return [];
    return db.exerciseLogs.where('workoutId').equals(lastWorkout.id).toArray();
  }, [lastWorkout?.id]);

  // Pre-fill values
  const getPrefill = useCallback(
    (exerciseId: string, set: number) => {
      const prevLog = lastLogs?.find(
        (l) => l.exerciseId === exerciseId && l.setNumber === set
      );
      const ex = getExercise(exerciseId);
      const defaultWeight = ex?.unit === 'seconds' ? 30 : ex?.id === 'lat-pulldown' ? settings.bodyweight : 0;
      let weight = prevLog?.weight ?? defaultWeight;

      // Deload: reduce weight by configured percentage
      if (phaseId === 'DL' && weight > 0) {
        weight = Math.round(weight * (100 - settings.deloadWeightPercent) / 100);
      }

      return {
        weight,
        reps: prevLog?.reps ?? phase.defaultReps,
      };
    },
    [lastLogs, phase.defaultReps, phaseId, settings.bodyweight, settings.deloadWeightPercent]
  );

  // Persist draft on every change (backup for resuming)
  useEffect(() => {
    saveDraft({
      sessionId,
      phaseId,
      date: new Date().toISOString().slice(0, 10),
      currentExerciseIndex: exerciseIndex,
      currentSetNumber: setNumber,
      completedSets,
      workoutId: workoutId ?? undefined,
    });
  }, [sessionId, phaseId, exerciseIndex, setNumber, completedSets, workoutId]);

  async function handleDone(weight: number, reps: number) {
    // Create workout record on first set
    let wId = workoutId;
    if (wId === null) {
      const now = new Date().toISOString();
      wId = await db.workouts.add({
        date: now.slice(0, 10),
        phaseId,
        sessionId,
        notes: '',
        createdAt: now,
        synced: 0,
      });
      setWorkoutId(wId);
    }

    // Write exercise log to DB immediately
    await db.exerciseLogs.add({
      workoutId: wId,
      exerciseId: currentExercise.id,
      setNumber,
      weight,
      reps,
      synced: 0,
    });

    const newSet: DraftSet = {
      exerciseId: currentExercise.id,
      setNumber,
      weight,
      reps,
    };

    const updated = [...completedSets, newSet];
    setCompletedSets(updated);

    // Determine next position — advance immediately and show inline rest timer
    if (setNumber < SETS_PER_EXERCISE) {
      setSetNumber(setNumber + 1);
      const now = Date.now();
      sessionStorage.setItem('restStartedAt', String(now));
      setRestStartedAt(now);
    } else if (exerciseIndex < exercises.length - 1) {
      setExerciseIndex(exerciseIndex + 1);
      setSetNumber(1);
      const now = Date.now();
      sessionStorage.setItem('restStartedAt', String(now));
      setRestStartedAt(now);
    } else {
      setWorkoutState('summary');
    }
  }

  const handleRestComplete = useCallback(() => {
    sessionStorage.removeItem('restStartedAt');
    setRestStartedAt(null);
  }, []);

  async function handleSave(notes: string) {
    if (workoutId !== null && notes) {
      await db.workouts.update(workoutId, { notes });
    }
    clearDraft();
    syncToSupabase().catch(console.error);
    onFinish();
  }

  async function handleDiscard() {
    // Delete the in-progress workout from DB if it was created
    if (workoutId !== null) {
      await db.exerciseLogs.where('workoutId').equals(workoutId).delete();
      await db.workouts.delete(workoutId);
    }
    clearDraft();
    onFinish();
  }

  if (workoutState === 'summary') {
    return (
      <WorkoutSummary
        sessionId={sessionId}
        phaseId={phaseId}
        completedSets={completedSets}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />
    );
  }

  const prefill = getPrefill(currentExercise.id, setNumber);

  // Build a display phase with settings-driven rep range
  const displayPhase = { ...phase, repRange: repRange as [number, number] };

  return (
    <div className="active-workout">
      <button className="btn btn-ghost active-workout-cancel" onClick={handleDiscard}>
        ✕ Cancel
      </button>
      <SetCard
        key={`${currentExercise.id}-${setNumber}`}
        exercise={currentExercise}
        setNumber={setNumber}
        totalCompletedSets={completedSets.length}
        prefillWeight={prefill.weight}
        prefillReps={prefill.reps}
        phase={displayPhase}
        onDone={handleDone}
        restDuration={settings.restSeconds[phaseId]}
        restStartedAt={restStartedAt}
        onRestComplete={handleRestComplete}
      />
    </div>
  );
}

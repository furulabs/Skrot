import { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { SessionId, PhaseId, DraftSet } from '../types';
import { db, saveDraft, clearDraft, syncToSupabase, getProgramSettings } from '../db/database';
import { getExercisesForSession, getPhase, SETS_PER_EXERCISE, getExercise } from '../db/seed';
import SetCard from './SetCard';
import RestTimer from './RestTimer';
import WorkoutSummary from './WorkoutSummary';

type WorkoutState = 'set' | 'rest' | 'summary';

interface ActiveWorkoutProps {
  sessionId: SessionId;
  phaseId: PhaseId;
  initialSets?: DraftSet[];
  initialExerciseIndex?: number;
  initialSetNumber?: number;
  onFinish: () => void;
}

export default function ActiveWorkout({
  sessionId,
  phaseId,
  initialSets = [],
  initialExerciseIndex = 0,
  initialSetNumber = 1,
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

  // Next set/exercise to advance to after rest timer
  const [pendingExerciseIndex, setPendingExerciseIndex] = useState<number | null>(null);
  const [pendingSetNumber, setPendingSetNumber] = useState<number | null>(null);

  const currentExercise = exercises[exerciseIndex];

  // Look up last session's data for pre-fill
  const lastWorkout = useLiveQuery(async () => {
    const last = await db.workouts
      .where('sessionId')
      .equals(sessionId)
      .reverse()
      .sortBy('date');
    if (last.length === 0) return null;
    return last[0];
  }, [sessionId]);

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

  // Persist draft on every change
  useEffect(() => {
    saveDraft({
      sessionId,
      phaseId,
      date: new Date().toISOString().slice(0, 10),
      currentExerciseIndex: exerciseIndex,
      currentSetNumber: setNumber,
      completedSets,
    });
  }, [sessionId, phaseId, exerciseIndex, setNumber, completedSets]);

  function handleDone(weight: number, reps: number) {
    const newSet: DraftSet = {
      exerciseId: currentExercise.id,
      setNumber,
      weight,
      reps,
    };

    const updated = [...completedSets, newSet];
    setCompletedSets(updated);

    // Determine next position
    if (setNumber < SETS_PER_EXERCISE) {
      // More sets in this exercise — show rest timer
      setPendingExerciseIndex(exerciseIndex);
      setPendingSetNumber(setNumber + 1);
      setWorkoutState('rest');
    } else if (exerciseIndex < exercises.length - 1) {
      // Next exercise — show rest timer
      setPendingExerciseIndex(exerciseIndex + 1);
      setPendingSetNumber(1);
      setWorkoutState('rest');
    } else {
      // Final set — go to summary
      setWorkoutState('summary');
    }
  }

  function handleRestComplete() {
    if (pendingExerciseIndex !== null) setExerciseIndex(pendingExerciseIndex);
    if (pendingSetNumber !== null) setSetNumber(pendingSetNumber);
    setPendingExerciseIndex(null);
    setPendingSetNumber(null);
    setWorkoutState('set');
  }

  async function handleSave(notes: string) {
    const now = new Date().toISOString();
    const workoutId = await db.workouts.add({
      date: now.slice(0, 10),
      phaseId,
      sessionId,
      notes,
      createdAt: now,
      synced: 0,
    });

    for (const s of completedSets) {
      await db.exerciseLogs.add({
        workoutId,
        exerciseId: s.exerciseId,
        setNumber: s.setNumber,
        weight: s.weight,
        reps: s.reps,
        synced: 0,
      });
    }

    clearDraft();
    syncToSupabase().catch(console.error);
    onFinish();
  }

  function handleDiscard() {
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

  if (workoutState === 'rest') {
    return (
      <RestTimer
        duration={settings.restSeconds[phaseId]}
        onComplete={handleRestComplete}
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
      />
    </div>
  );
}

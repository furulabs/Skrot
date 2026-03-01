import { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { SessionId, PhaseId, DraftSet } from '../types';
import { db, saveDraft, clearDraft, syncToSupabase } from '../db/database';
import { getExercisesForSession, getPhase, SETS_PER_EXERCISE } from '../db/seed';
import SetCard from './SetCard';
import WorkoutSummary from './WorkoutSummary';

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

  const [exerciseIndex, setExerciseIndex] = useState(initialExerciseIndex);
  const [setNumber, setSetNumber] = useState(initialSetNumber);
  const [completedSets, setCompletedSets] = useState<DraftSet[]>(initialSets);
  const [showSummary, setShowSummary] = useState(false);

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
      return {
        weight: prevLog?.weight ?? 0,
        reps: prevLog?.reps ?? phase.defaultReps,
      };
    },
    [lastLogs, phase.defaultReps]
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

    // Advance
    if (setNumber < SETS_PER_EXERCISE) {
      setSetNumber(setNumber + 1);
    } else if (exerciseIndex < exercises.length - 1) {
      setExerciseIndex(exerciseIndex + 1);
      setSetNumber(1);
    } else {
      setShowSummary(true);
    }
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

    // Background sync
    syncToSupabase().catch(console.error);

    onFinish();
  }

  function handleDiscard() {
    clearDraft();
    onFinish();
  }

  if (showSummary) {
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
        phase={phase}
        onDone={handleDone}
      />
    </div>
  );
}

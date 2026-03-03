import { useState, useEffect, useRef, useCallback } from 'react';
import type { Exercise, Phase } from '../types';
import { SETS_PER_EXERCISE, TOTAL_SETS } from '../db/seed';
import { formatSet } from '../utils/format';
import SetEditor from './SetEditor';

interface SetCardProps {
  exercise: Exercise;
  setNumber: number;
  totalCompletedSets: number;
  prefillWeight: number;
  prefillReps: number;
  phase: Phase;
  onDone: (weight: number, reps: number) => void;
}

export default function SetCard({
  exercise,
  setNumber,
  totalCompletedSets,
  prefillWeight,
  prefillReps,
  phase,
  onDone,
}: SetCardProps) {
  const [editing, setEditing] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState(prefillWeight); // weight field holds seconds for seconds-unit
  const startTimeRef = useRef(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const isTimedExercise = exercise.unit === 'seconds';
  const timerDuration = prefillWeight; // for seconds-unit exercises, "weight" is the duration

  const handleTimerComplete = useCallback(() => {
    setTimerRunning(false);
    try { navigator.vibrate?.(300); } catch { /* ignore */ }
    onDoneRef.current(timerDuration, prefillReps);
  }, [timerDuration, prefillReps]);

  const handleTimerCompleteRef = useRef(handleTimerComplete);
  handleTimerCompleteRef.current = handleTimerComplete;

  useEffect(() => {
    if (!timerRunning) return;

    startTimeRef.current = Date.now();
    setTimerRemaining(timerDuration);

    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const left = Math.max(0, timerDuration - elapsed);
      setTimerRemaining(Math.ceil(left));

      if (left <= 0) {
        clearInterval(interval);
        handleTimerCompleteRef.current();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [timerRunning, timerDuration]);

  function handleStopTimer() {
    setTimerRunning(false);
    // Record the prefilled time (not elapsed)
    onDone(timerDuration, prefillReps);
  }

  return (
    <div className="set-card">
      <div className="set-card-progress">
        <span className="set-card-progress-text">
          {totalCompletedSets + 1}/{TOTAL_SETS} sets
        </span>
        <div className="progress-bar">
          <div
            className="progress-bar-fill"
            style={{ width: `${(totalCompletedSets / TOTAL_SETS) * 100}%` }}
          />
        </div>
      </div>

      <div className="set-card-phase">{phase.name} · {phase.repRange[0]}-{phase.repRange[1]} reps</div>

      <h2 className="set-card-exercise">{exercise.name}</h2>
      <p className="set-card-set">Set {setNumber} of {SETS_PER_EXERCISE}</p>

      {timerRunning ? (
        <>
          <div className="exercise-timer">
            <span className="exercise-timer-time">{timerRemaining}</span>
            <span className="exercise-timer-unit">seconds</span>
          </div>
          <div className="set-card-actions">
            <button className="btn btn-secondary btn-large" onClick={handleStopTimer}>
              Stop
            </button>
          </div>
        </>
      ) : !editing ? (
        <>
          <div className="set-card-prefill">
            {(prefillWeight > 0 || (exercise.unit === 'reps-only' && prefillReps > 0)) ? (
              <span className="set-card-values">{formatSet(prefillWeight, prefillReps, exercise.unit)}</span>
            ) : (
              <span className="set-card-values set-card-values--empty">Tap Edit to enter values</span>
            )}
          </div>

          <div className="set-card-actions">
            {isTimedExercise && prefillWeight > 0 ? (
              <button
                className="btn btn-primary btn-large"
                onClick={() => setTimerRunning(true)}
              >
                Start Timer
              </button>
            ) : (prefillWeight > 0 || (exercise.unit === 'reps-only' && prefillReps > 0)) ? (
              <button
                className="btn btn-primary btn-large"
                onClick={() => onDone(prefillWeight, prefillReps)}
              >
                Done ✓
              </button>
            ) : null}
            <button
              className="btn btn-secondary btn-large"
              onClick={() => setEditing(true)}
            >
              Edit
            </button>
          </div>
        </>
      ) : (
        <SetEditor
          initialWeight={prefillWeight}
          initialReps={prefillReps}
          unit={exercise.unit}
          onConfirm={(weight, reps) => {
            setEditing(false);
            onDone(weight, reps);
          }}
          onCancel={() => setEditing(false)}
        />
      )}
    </div>
  );
}

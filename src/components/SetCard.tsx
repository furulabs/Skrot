import { useState, useEffect, useRef } from 'react';
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
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef(0);

  const isTimedExercise = exercise.unit === 'seconds';

  useEffect(() => {
    if (!timerRunning) return;

    startTimeRef.current = Date.now();
    setElapsed(0);

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 100);

    return () => clearInterval(interval);
  }, [timerRunning]);

  function handleStopTimer() {
    const seconds = Math.max(1, Math.floor((Date.now() - startTimeRef.current) / 1000));
    setTimerRunning(false);
    try { navigator.vibrate?.(300); } catch { /* ignore */ }
    onDone(seconds, prefillReps);
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
            <span className="exercise-timer-time">{elapsed}</span>
            <span className="exercise-timer-unit">seconds</span>
          </div>
          <div className="set-card-actions">
            <button className="btn btn-primary btn-large" onClick={handleStopTimer}>
              Done ✓
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
            {isTimedExercise ? (
              <button
                className="btn btn-primary btn-large"
                onClick={() => setTimerRunning(true)}
              >
                Start
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

import { useState, useEffect, useRef } from 'react';
import type { Exercise, Phase } from '../types';
import { SETS_PER_EXERCISE, TOTAL_SETS } from '../db/seed';
import { formatSet } from '../utils/format';
import SetEditor from './SetEditor';

const REST_RADIUS = 55;
const REST_CIRCUMFERENCE = 2 * Math.PI * REST_RADIUS;

interface SetCardProps {
  exercise: Exercise;
  setNumber: number;
  totalCompletedSets: number;
  prefillWeight: number;
  prefillReps: number;
  phase: Phase;
  onDone: (weight: number, reps: number) => void;
  restDuration?: number;
  restStartedAt?: number | null;
  onRestComplete?: () => void;
}

export default function SetCard({
  exercise,
  setNumber,
  totalCompletedSets,
  prefillWeight,
  prefillReps,
  phase,
  onDone,
  restDuration,
  restStartedAt,
  onRestComplete,
}: SetCardProps) {
  const [editing, setEditing] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef(0);

  // Rest timer state
  const [restRemaining, setRestRemaining] = useState(0);
  const onRestCompleteRef = useRef(onRestComplete);
  onRestCompleteRef.current = onRestComplete;

  const isTimedExercise = exercise.unit === 'seconds';
  const isResting = restStartedAt != null && restDuration != null;

  // Exercise count-up timer
  useEffect(() => {
    if (!timerRunning) return;

    startTimeRef.current = Date.now();
    setElapsed(0);

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 100);

    return () => clearInterval(interval);
  }, [timerRunning]);

  // Inline rest countdown timer
  useEffect(() => {
    if (!isResting) return;

    // Check if already expired (e.g. screen was off longer than rest)
    const alreadyElapsed = (Date.now() - restStartedAt) / 1000;
    if (alreadyElapsed >= restDuration) {
      onRestCompleteRef.current?.();
      return;
    }

    setRestRemaining(Math.ceil(restDuration - alreadyElapsed));

    const interval = setInterval(() => {
      const elapsed = (Date.now() - restStartedAt) / 1000;
      const left = Math.max(0, restDuration - elapsed);
      setRestRemaining(Math.ceil(left));

      if (left <= 0) {
        clearInterval(interval);
        onRestCompleteRef.current?.();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isResting, restStartedAt, restDuration]);

  function handleStopTimer() {
    const seconds = Math.max(1, Math.floor((Date.now() - startTimeRef.current) / 1000));
    setTimerRunning(false);
    try { navigator.vibrate?.(300); } catch { /* ignore */ }
    onDone(seconds, prefillReps);
  }

  const restProgress = isResting && restDuration > 0 ? restRemaining / restDuration : 0;
  const restDashOffset = REST_CIRCUMFERENCE * (1 - restProgress);

  const restMinutes = Math.floor(restRemaining / 60);
  const restSeconds = restRemaining % 60;
  const restDisplay = restMinutes > 0
    ? `${restMinutes}:${restSeconds.toString().padStart(2, '0')}`
    : `${restRemaining}`;

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

      {isResting ? (
        <div className="set-card-rest">
          <div className="set-card-rest-circle-wrap">
            <svg viewBox="0 0 130 130" className="set-card-rest-svg">
              <circle
                cx="65" cy="65" r={REST_RADIUS}
                fill="none"
                stroke="var(--bg-elevated)"
                strokeWidth="6"
              />
              <circle
                cx="65" cy="65" r={REST_RADIUS}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={REST_CIRCUMFERENCE}
                strokeDashoffset={restDashOffset}
                transform="rotate(-90 65 65)"
                style={{ transition: 'stroke-dashoffset 0.15s linear' }}
              />
            </svg>
            <span className="set-card-rest-time">{restDisplay}</span>
          </div>
          <button className="btn btn-secondary set-card-rest-skip" onClick={onRestComplete}>
            Skip
          </button>
        </div>
      ) : timerRunning ? (
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

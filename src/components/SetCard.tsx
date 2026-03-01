import { useState } from 'react';
import type { Exercise, Phase } from '../types';
import { SETS_PER_EXERCISE, TOTAL_SETS } from '../db/seed';
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

      {!editing ? (
        <>
          <div className="set-card-prefill">
            {prefillWeight > 0 ? (
              <span className="set-card-values">{prefillWeight}kg × {prefillReps}</span>
            ) : (
              <span className="set-card-values set-card-values--empty">Tap Edit to enter weight</span>
            )}
          </div>

          <div className="set-card-actions">
            {prefillWeight > 0 && (
              <button
                className="btn btn-primary btn-large"
                onClick={() => onDone(prefillWeight, prefillReps)}
              >
                Done ✓
              </button>
            )}
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

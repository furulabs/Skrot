import { useState } from 'react';
import type { ExerciseUnit } from '../types';

interface SetEditorProps {
  initialWeight: number;
  initialReps: number;
  unit: ExerciseUnit;
  onConfirm: (weight: number, reps: number) => void;
  onCancel: () => void;
}

export default function SetEditor({ initialWeight, initialReps, unit, onConfirm, onCancel }: SetEditorProps) {
  const [weight, setWeight] = useState(initialWeight);
  const [reps, setReps] = useState(initialReps);
  const [editingField, setEditingField] = useState<'weight' | 'reps' | null>(null);
  const [inputValue, setInputValue] = useState('');

  function startEditing(field: 'weight' | 'reps') {
    setEditingField(field);
    setInputValue(field === 'weight' ? String(weight) : String(reps));
  }

  function commitInput() {
    if (editingField === null) return;
    const val = parseFloat(inputValue);
    if (!isNaN(val) && val >= 0) {
      if (editingField === 'weight') setWeight(val);
      else setReps(Math.round(val));
    }
    setEditingField(null);
  }

  const weightLabel = unit === 'seconds' ? 'Duration (seconds)' : 'Weight (kg)';
  const weightStep = unit === 'seconds' ? 5 : 2.5;

  return (
    <div className="set-editor">
      {unit !== 'reps-only' && (
        <div className="set-editor-field">
          <label>{weightLabel}</label>
          <div className="stepper">
            <button className="btn btn-stepper" onClick={() => setWeight(Math.max(0, weight - weightStep))}>
              −{weightStep}
            </button>
            {editingField === 'weight' ? (
              <input
                type="number"
                className="stepper-input"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onBlur={commitInput}
                onKeyDown={(e) => e.key === 'Enter' && commitInput()}
                autoFocus
                inputMode="decimal"
              />
            ) : (
              <span className="stepper-value" onClick={() => startEditing('weight')}>
                {weight}
              </span>
            )}
            <button className="btn btn-stepper" onClick={() => setWeight(weight + weightStep)}>
              +{weightStep}
            </button>
          </div>
        </div>
      )}

      {unit !== 'seconds' && (
        <div className="set-editor-field">
          <label>Reps</label>
          <div className="stepper">
            <button className="btn btn-stepper" onClick={() => setReps(Math.max(1, reps - 1))}>
              −1
            </button>
            {editingField === 'reps' ? (
              <input
                type="number"
                className="stepper-input"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onBlur={commitInput}
                onKeyDown={(e) => e.key === 'Enter' && commitInput()}
                autoFocus
                inputMode="numeric"
              />
            ) : (
              <span className="stepper-value" onClick={() => startEditing('reps')}>
                {reps}
              </span>
            )}
            <button className="btn btn-stepper" onClick={() => setReps(reps + 1)}>
              +1
            </button>
          </div>
        </div>
      )}

      <div className="set-editor-actions">
        <button className="btn btn-primary btn-large" onClick={() => onConfirm(weight, reps)}>
          Confirm
        </button>
        <button className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

import { useState } from 'react';
import type { DraftSet, SessionId, PhaseId } from '../types';
import { getPhase, SETS_PER_EXERCISE, getExercisesForSession } from '../db/seed';
import { formatNumber, formatSet } from '../utils/format';

interface WorkoutSummaryProps {
  sessionId: SessionId;
  phaseId: PhaseId;
  completedSets: DraftSet[];
  onSave: (notes: string) => void;
  onDiscard: () => void;
}

export default function WorkoutSummary({ sessionId, phaseId, completedSets, onSave, onDiscard }: WorkoutSummaryProps) {
  const [notes, setNotes] = useState('');
  const phase = getPhase(phaseId);
  const exercises = getExercisesForSession(sessionId);

  const totalVolume = completedSets.reduce((sum, s) => sum + s.weight * s.reps, 0);

  return (
    <div className="workout-summary">
      <h2>Workout Complete</h2>
      <p className="summary-subtitle">Session {sessionId} · {phase.name}</p>

      <div className="summary-exercises">
        {exercises.map((ex) => {
          const sets = completedSets
            .filter((s) => s.exerciseId === ex.id)
            .sort((a, b) => a.setNumber - b.setNumber);

          return (
            <div key={ex.id} className="summary-exercise">
              <h3>{ex.name}</h3>
              <div className="summary-sets">
                {sets.map((s) => (
                  <span key={s.setNumber} className="summary-set">
                    {formatSet(s.weight, s.reps, ex.unit)}
                  </span>
                ))}
                {sets.length < SETS_PER_EXERCISE && (
                  <span className="summary-set summary-set--missed">
                    {SETS_PER_EXERCISE - sets.length} skipped
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="summary-volume">Total volume: {formatNumber(totalVolume)}kg</p>

      <div className="summary-notes">
        <label htmlFor="notes">Notes (optional)</label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="How did it feel?"
          rows={3}
        />
      </div>

      <div className="summary-actions">
        <button className="btn btn-primary btn-large" onClick={() => onSave(notes)}>
          Save Workout
        </button>
        <button className="btn btn-ghost" onClick={onDiscard}>
          Discard
        </button>
      </div>
    </div>
  );
}

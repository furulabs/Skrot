import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { getPhase, getExercise, EXERCISES } from '../db/seed';

export default function History() {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filterExercise, setFilterExercise] = useState<string | null>(null);

  const workouts = useLiveQuery(() =>
    db.workouts.orderBy('date').reverse().toArray()
  );

  const allLogs = useLiveQuery(() => db.exerciseLogs.toArray());

  if (!workouts || !allLogs) return <div className="loading">Loading...</div>;

  // If filtering by exercise, show progression
  if (filterExercise) {
    const exerciseLogs = allLogs
      .filter((l) => l.exerciseId === filterExercise)
      .sort((a, b) => {
        const wA = workouts.find((w) => w.id === a.workoutId);
        const wB = workouts.find((w) => w.id === b.workoutId);
        return (wB?.date ?? '').localeCompare(wA?.date ?? '');
      });

    // Group by workout
    const byWorkout = new Map<number, typeof exerciseLogs>();
    for (const log of exerciseLogs) {
      const arr = byWorkout.get(log.workoutId) ?? [];
      arr.push(log);
      byWorkout.set(log.workoutId, arr);
    }

    return (
      <div className="history">
        <div className="history-filter-header">
          <button className="btn btn-ghost" onClick={() => setFilterExercise(null)}>
            ← Back
          </button>
          <h2>{getExercise(filterExercise).name} Progression</h2>
        </div>

        {Array.from(byWorkout.entries()).map(([workoutId, logs]) => {
          const workout = workouts.find((w) => w.id === workoutId);
          if (!workout) return null;
          return (
            <div key={workoutId} className="history-item">
              <div className="history-item-header">
                <span>{workout.date}</span>
                <span>{getPhase(workout.phaseId).name}</span>
              </div>
              <div className="history-sets">
                {logs
                  .sort((a, b) => a.setNumber - b.setNumber)
                  .map((l) => (
                    <span key={l.id} className="summary-set">
                      {l.weight}kg × {l.reps}
                    </span>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="history">
      <h2>History</h2>

      <div className="history-filters">
        <label>Filter by exercise</label>
        <div className="exercise-chips">
          {EXERCISES.map((ex) => (
            <button
              key={ex.id}
              className="chip"
              onClick={() => setFilterExercise(ex.id)}
            >
              {ex.name}
            </button>
          ))}
        </div>
      </div>

      {workouts.length === 0 ? (
        <p className="history-empty">No workouts yet. Start your first session!</p>
      ) : (
        <div className="history-list">
          {workouts.map((w) => {
            const logs = allLogs.filter((l) => l.workoutId === w.id);
            const totalVolume = logs.reduce((sum, l) => sum + l.weight * l.reps, 0);
            const isExpanded = expandedId === w.id;

            return (
              <div
                key={w.id}
                className={`history-item ${isExpanded ? 'history-item--expanded' : ''}`}
                onClick={() => setExpandedId(isExpanded ? null : w.id!)}
              >
                <div className="history-item-header">
                  <div>
                    <strong>{w.date}</strong>
                    <span className="history-item-badge">Session {w.sessionId}</span>
                  </div>
                  <div className="history-item-meta">
                    <span>{getPhase(w.phaseId).name}</span>
                    <span>{totalVolume.toLocaleString()}kg</span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="history-item-detail">
                    {Array.from(new Set(logs.map((l) => l.exerciseId))).map((exId) => {
                      const exLogs = logs
                        .filter((l) => l.exerciseId === exId)
                        .sort((a, b) => a.setNumber - b.setNumber);
                      return (
                        <div key={exId} className="history-exercise">
                          <h4>{getExercise(exId).name}</h4>
                          <div className="history-sets">
                            {exLogs.map((l) => (
                              <span key={l.id} className="summary-set">
                                {l.weight}kg × {l.reps}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {w.notes && <p className="history-notes">{w.notes}</p>}
                    <span className="history-sync-status">
                      {w.synced ? '☁ Synced' : '⏳ Pending sync'}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

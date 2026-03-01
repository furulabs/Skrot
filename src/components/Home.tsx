import { useLiveQuery } from 'dexie-react-hooks';
import type { SessionId, PhaseId } from '../types';
import { db, loadDraft } from '../db/database';
import { getPhase, getExercisesForSession, TOTAL_SETS, PHASES } from '../db/seed';

interface HomeProps {
  onStartWorkout: (sessionId: SessionId, phaseId: PhaseId) => void;
  onResumeDraft: () => void;
}

export default function Home({ onStartWorkout, onResumeDraft }: HomeProps) {
  const lastWorkout = useLiveQuery(async () => {
    const all = await db.workouts.orderBy('date').reverse().first();
    return all ?? null;
  });

  const lastLogs = useLiveQuery(async () => {
    if (!lastWorkout?.id) return [];
    return db.exerciseLogs.where('workoutId').equals(lastWorkout.id).toArray();
  }, [lastWorkout?.id]);

  const draft = loadDraft();

  // Auto-detect next session
  const nextSession: SessionId = lastWorkout?.sessionId === 'A' ? 'B' : 'A';

  // Default to P1 if no last workout
  const currentPhase: PhaseId = lastWorkout?.phaseId ?? 'P1';
  const phase = getPhase(currentPhase);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="home">
      <div className="home-header">
        <h1>Period</h1>
        <p className="home-date">{new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <p className="home-phase">{phase.name} Phase · {phase.repRange[0]}-{phase.repRange[1]} reps</p>
      </div>

      {draft ? (
        <button className="btn btn-primary btn-xl" onClick={onResumeDraft}>
          Continue Session {draft.sessionId}
          <span className="btn-sub">{draft.completedSets.length}/{TOTAL_SETS} sets done</span>
        </button>
      ) : (
        <div className="home-start">
          <button
            className="btn btn-primary btn-xl"
            onClick={() => onStartWorkout(nextSession, currentPhase)}
          >
            Start Session {nextSession}
            <span className="btn-sub">{getExercisesForSession(nextSession).map(e => e.name).join(' · ')}</span>
          </button>

          <div className="home-alt-session">
            <button
              className="btn btn-ghost"
              onClick={() => onStartWorkout(nextSession === 'A' ? 'B' : 'A', currentPhase)}
            >
              Or start Session {nextSession === 'A' ? 'B' : 'A'}
            </button>
          </div>

          <div className="home-phase-picker">
            <label>Phase</label>
            <div className="phase-chips">
              {PHASES.map((p) => (
                <button
                  key={p.id}
                  className={`chip ${p.id === currentPhase ? 'chip--active' : ''}`}
                  onClick={() => onStartWorkout(nextSession, p.id)}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {lastWorkout && lastLogs && (
        <div className="home-last">
          <h3>Last Workout</h3>
          <p>{lastWorkout.date} · Session {lastWorkout.sessionId} · {getPhase(lastWorkout.phaseId).name}</p>
          <p className="home-last-volume">
            Volume: {lastLogs.reduce((sum, l) => sum + l.weight * l.reps, 0).toLocaleString()}kg
          </p>
        </div>
      )}
    </div>
  );
}

import { useLiveQuery } from 'dexie-react-hooks';
import type { SessionId, PhaseId } from '../types';
import { db, loadDraft, getProgramSettings } from '../db/database';
import { getPhase, getExercisesForSession, TOTAL_SETS, PHASES, getNextPhase } from '../db/seed';
import { formatDate, formatDateLong, formatNumber } from '../utils/format';

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

  // Count sessions in the current phase to detect auto-advance
  const sessionsInPhase = useLiveQuery(async () => {
    if (!lastWorkout) return 0;
    const all = await db.workouts.orderBy('date').reverse().toArray();
    let count = 0;
    for (const w of all) {
      if (w.phaseId === lastWorkout.phaseId) count++;
      else break; // stop counting when we hit a different phase
    }
    return count;
  }, [lastWorkout?.phaseId]);

  const draft = loadDraft();
  const settings = getProgramSettings();

  // Auto-detect next session
  const nextSession: SessionId = lastWorkout?.sessionId === 'A' ? 'B' : 'A';

  // Determine current phase — auto-advance if sessions threshold reached
  const lastPhaseId: PhaseId = lastWorkout?.phaseId ?? 'P1';
  const phaseLimit = settings.phaseSessions[lastPhaseId];
  const shouldAdvance = (sessionsInPhase ?? 0) >= phaseLimit;
  const currentPhase: PhaseId = shouldAdvance ? getNextPhase(lastPhaseId) as PhaseId : lastPhaseId;
  const phase = getPhase(currentPhase);
  const currentPhaseLimit = settings.phaseSessions[currentPhase];

  return (
    <div className="home">
      <div className="home-header">
        <h1>Skrot</h1>
        <p className="home-date">{formatDateLong()}</p>
        <p className="home-phase">{phase.name} Phase · {phase.repRange[0]}-{phase.repRange[1]} reps</p>
        <p className="home-phase-count">
          Session {shouldAdvance ? 1 : (sessionsInPhase ?? 0) + 1} of {currentPhaseLimit}
          {shouldAdvance && <span className="home-phase-new"> — new phase!</span>}
        </p>
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
            <label>Override phase</label>
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
          <p>{formatDate(lastWorkout.date)} · Session {lastWorkout.sessionId} · {getPhase(lastWorkout.phaseId).name}</p>
          <p className="home-last-volume">
            Volume: {formatNumber(lastLogs.reduce((sum, l) => sum + l.weight * l.reps, 0))}kg
          </p>
        </div>
      )}
    </div>
  );
}

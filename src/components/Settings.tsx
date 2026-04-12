import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getProgramSettings, setProgramSettings } from '../db/database';

export default function Settings() {
  const program = getProgramSettings();
  const [phaseSessions, setPhaseSessions] = useState(program.phaseSessions);
  const [bodyweight, setBodyweight] = useState(program.bodyweight);
  const [restSeconds, setRestSeconds] = useState(program.restSeconds);
  const [repRanges, setRepRanges] = useState(program.repRanges);
  const [deloadWeightPercent, setDeloadWeightPercent] = useState(program.deloadWeightPercent);

  const workouts = useLiveQuery(() => db.workouts.toArray());
  const logs = useLiveQuery(() => db.exerciseLogs.toArray());

  return (
    <div className="settings">
      <h2>Settings</h2>

      <section className="settings-section">
        <h3>Program</h3>
        <p className="settings-hint">Sessions per phase (P1 → P2 → P3 → Deload → repeat)</p>
        <div className="settings-phases">
          {([['P1', 'Hypertrophy'], ['P2', 'Strength'], ['P3', 'Power'], ['DL', 'Deload']] as const).map(([id, name]) => (
            <div key={id} className="settings-phase-row">
              <label htmlFor={`phase-${id}`}>{name}</label>
              <input
                id={`phase-${id}`}
                type="number"
                inputMode="numeric"
                value={phaseSessions[id]}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (v > 0) {
                    const updated = { ...phaseSessions, [id]: v };
                    setPhaseSessions(updated);
                    setProgramSettings({ phaseSessions: updated });
                  }
                }}
              />
            </div>
          ))}
        </div>
        <div className="settings-field">
          <label htmlFor="bw">Bodyweight (kg)</label>
          <input
            id="bw"
            type="number"
            inputMode="decimal"
            value={bodyweight}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (v > 0) {
                setBodyweight(v);
                setProgramSettings({ bodyweight: v });
              }
            }}
          />
          <p className="settings-hint">Used as weight for pull-up sets</p>
        </div>
      </section>

      <section className="settings-section">
        <h3>Rest Times</h3>
        <p className="settings-hint">Seconds between sets per phase</p>
        <div className="settings-phases">
          {([['P1', 'Hypertrophy'], ['P2', 'Strength'], ['P3', 'Power'], ['DL', 'Deload']] as const).map(([id, name]) => (
            <div key={id} className="settings-phase-row">
              <label htmlFor={`rest-${id}`}>{name}</label>
              <input
                id={`rest-${id}`}
                type="number"
                inputMode="numeric"
                value={restSeconds[id]}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (v >= 0) {
                    const updated = { ...restSeconds, [id]: v };
                    setRestSeconds(updated);
                    setProgramSettings({ restSeconds: updated });
                  }
                }}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h3>Rep Ranges</h3>
        <p className="settings-hint">Min–max reps per phase</p>
        <div className="settings-rep-ranges">
          {([['P1', 'Hypertrophy'], ['P2', 'Strength'], ['P3', 'Power'], ['DL', 'Deload']] as const).map(([id, name]) => (
            <div key={id} className="settings-rep-range-row">
              <label>{name}</label>
              <div className="settings-rep-range-inputs">
                <input
                  type="number"
                  inputMode="numeric"
                  value={repRanges[id][0]}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (v >= 1) {
                      const updated = { ...repRanges, [id]: [v, repRanges[id][1]] as [number, number] };
                      setRepRanges(updated);
                      setProgramSettings({ repRanges: updated });
                    }
                  }}
                />
                <span className="settings-rep-range-sep">–</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={repRanges[id][1]}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (v >= 1) {
                      const updated = { ...repRanges, [id]: [repRanges[id][0], v] as [number, number] };
                      setRepRanges(updated);
                      setProgramSettings({ repRanges: updated });
                    }
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h3>Deload</h3>
        <div className="settings-field">
          <label htmlFor="deload-pct">Weight reduction %</label>
          <input
            id="deload-pct"
            type="number"
            inputMode="numeric"
            value={deloadWeightPercent}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (v >= 0 && v <= 100) {
                setDeloadWeightPercent(v);
                setProgramSettings({ deloadWeightPercent: v });
              }
            }}
          />
          <p className="settings-hint">Deload sets will use {100 - deloadWeightPercent}% of previous weight</p>
        </div>
      </section>

      <section className="settings-section">
        <h3>AI Screen Reader</h3>
        <p className="settings-hint">Auto-read erg screen photos. Get a key at console.anthropic.com</p>
        <div className="settings-field">
          <label htmlFor="anthropic-key">Anthropic API Key</label>
          <input
            id="anthropic-key"
            type="password"
            placeholder="sk-ant-..."
            defaultValue={localStorage.getItem('anthropic_api_key') ?? ''}
            onChange={(e) => {
              const v = e.target.value.trim();
              if (v) {
                localStorage.setItem('anthropic_api_key', v);
              } else {
                localStorage.removeItem('anthropic_api_key');
              }
            }}
          />
        </div>
      </section>

      <section className="settings-section">
        <h3>Data</h3>
        <p className="settings-hint">
          {workouts?.length ?? 0} workouts · {logs?.length ?? 0} exercise logs stored locally
        </p>
        <p className="settings-hint">Syncs automatically with cloud on app launch and after each workout.</p>
      </section>

      <section className="settings-section">
        <h3>App</h3>
        <button
          className="btn btn-secondary"
          onClick={(e) => {
            const btn = e.currentTarget;
            btn.textContent = 'Updating…';
            btn.disabled = true;
            setTimeout(() => window.location.reload(), 500);
          }}
        >
          Check for Updates
        </button>
      </section>
    </div>
  );
}

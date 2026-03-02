import { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, syncToSupabase, pullFromSupabase, getProgramSettings, setProgramSettings } from '../db/database';
import { exportWorkoutsCSV, importWorkoutsCSV } from '../utils/csv';
import { importSpreadsheetCSV } from '../utils/importSpreadsheet';

export default function Settings() {
  const program = getProgramSettings();
  const [phaseSessions, setPhaseSessions] = useState(program.phaseSessions);
  const [bodyweight, setBodyweight] = useState(program.bodyweight);
  const [restSeconds, setRestSeconds] = useState(program.restSeconds);
  const [repRanges, setRepRanges] = useState(program.repRanges);
  const [deloadWeightPercent, setDeloadWeightPercent] = useState(program.deloadWeightPercent);
  const [syncStatus, setSyncStatus] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const workouts = useLiveQuery(() => db.workouts.toArray());
  const logs = useLiveQuery(() => db.exerciseLogs.toArray());

  async function handlePull() {
    setSyncStatus('Pulling...');
    try {
      const pulled = await pullFromSupabase();
      setSyncStatus(`Pulled ${pulled} workouts from Supabase.`);
    } catch (e: any) {
      setSyncStatus(`Error: ${e.message}`);
    }
  }

  async function handleSync() {
    setSyncStatus('Syncing...');
    try {
      const result = await syncToSupabase();
      setSyncStatus(`Synced ${result.synced} items. ${result.errors ? result.errors + ' errors.' : ''}`);
    } catch (e: any) {
      setSyncStatus(`Error: ${e.message}`);
    }
  }

  function handleExport() {
    if (!workouts || !logs) return;
    const csv = exportWorkoutsCSV(workouts, logs);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `skrot-workouts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus('Importing...');
    try {
      const text = await file.text();
      // Detect spreadsheet format (has "S1 load" header) vs Period CSV format
      const isSpreadsheet = text.includes('S1 load') || text.includes('A1 Bench');
      const count = isSpreadsheet
        ? await importSpreadsheetCSV(text)
        : await importWorkoutsCSV(text);
      setImportStatus(`Imported ${count} workouts.`);
    } catch (err: any) {
      setImportStatus(`Error: ${err.message}`);
    }
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

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
        <h3>Data</h3>
        <div className="settings-row">
          <button className="btn btn-secondary" onClick={handleExport}>
            Export CSV
          </button>
          <button className="btn btn-secondary" onClick={handleImportClick}>
            Import CSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleImport}
          />
        </div>
        {importStatus && <p className="settings-status">{importStatus}</p>}
        <p className="settings-hint">
          {workouts?.length ?? 0} workouts · {logs?.length ?? 0} exercise logs stored locally
        </p>
        <button
          className="btn btn-ghost"
          style={{ color: 'var(--danger)' }}
          onClick={async () => {
            if (confirm('Delete all local workout data?')) {
              await db.exerciseLogs.clear();
              await db.workouts.clear();
              setImportStatus('All data cleared.');
            }
          }}
        >
          Clear all data
        </button>
      </section>

      <section className="settings-section">
        <h3>Supabase Sync</h3>
        <div className="settings-row">
          <button className="btn btn-primary" onClick={handlePull}>
            Pull from Cloud
          </button>
          <button className="btn btn-secondary" onClick={handleSync}>
            Push to Cloud
          </button>
        </div>
        {syncStatus && <p className="settings-status">{syncStatus}</p>}
      </section>
    </div>
  );
}

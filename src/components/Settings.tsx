import { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getSupabaseConfig, setSupabaseConfig, syncToSupabase, pullFromSupabase } from '../db/database';
import { exportWorkoutsCSV, importWorkoutsCSV } from '../utils/csv';

export default function Settings() {
  const config = getSupabaseConfig();
  const [url, setUrl] = useState(config?.url ?? '');
  const [anonKey, setAnonKey] = useState(config?.anonKey ?? '');
  const [syncStatus, setSyncStatus] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const workouts = useLiveQuery(() => db.workouts.toArray());
  const logs = useLiveQuery(() => db.exerciseLogs.toArray());

  async function handleSaveConfig() {
    setSupabaseConfig(url, anonKey);
    setSyncStatus('Config saved. Pulling data...');
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
    a.download = `period-workouts-${new Date().toISOString().slice(0, 10)}.csv`;
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
      const count = await importWorkoutsCSV(text);
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
      </section>

      <section className="settings-section">
        <h3>Supabase Sync</h3>
        <div className="settings-field">
          <label htmlFor="sb-url">Project URL</label>
          <input
            id="sb-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://xxx.supabase.co"
          />
        </div>
        <div className="settings-field">
          <label htmlFor="sb-key">Anon Key</label>
          <input
            id="sb-key"
            type="password"
            value={anonKey}
            onChange={(e) => setAnonKey(e.target.value)}
            placeholder="eyJ..."
          />
        </div>
        <div className="settings-row">
          <button className="btn btn-primary" onClick={handleSaveConfig}>
            Save & Pull
          </button>
          {config && (
            <button className="btn btn-secondary" onClick={handleSync}>
              Push to Supabase
            </button>
          )}
        </div>
        {syncStatus && <p className="settings-status">{syncStatus}</p>}
      </section>

      <section className="settings-section">
        <h3>Supabase SQL Migration</h3>
        <p className="settings-hint">Run this SQL in your Supabase SQL editor to create the required tables:</p>
        <pre className="settings-sql">{`CREATE TABLE workouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  phase_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE exercise_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workout_id UUID REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,
  set_number INT NOT NULL,
  weight NUMERIC NOT NULL,
  reps INT NOT NULL
);

-- Open access (no auth)
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow all" ON workouts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all" ON exercise_logs FOR ALL USING (true) WITH CHECK (true);`}</pre>
      </section>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import NoSleep from 'nosleep.js';
import type { SessionId, PhaseId } from './types';
import { loadDraft, pullFromSupabase, syncToSupabase } from './db/database';
import Home from './components/Home';
import ActiveWorkout from './components/ActiveWorkout';
import History from './components/History';
import Settings from './components/Settings';
import './App.css';

type Tab = 'home' | 'history' | 'settings';

export default function App() {
  const [tab, setTab] = useState<Tab>(() => {
    const saved = sessionStorage.getItem('activeTab');
    return (saved as Tab) || 'home';
  });

  // Auto-sync: push unsynced data then pull latest from cloud
  useEffect(() => {
    function sync() {
      syncToSupabase()
        .then(() => pullFromSupabase())
        .catch(() => {});
    }

    sync(); // on mount

    // Also sync when app comes back to foreground (phone wake / tab switch)
    function onVisible() {
      if (document.visibilityState === 'visible') sync();
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  function switchTab(t: Tab) {
    sessionStorage.setItem('activeTab', t);
    setTab(t);
  }
  const [workout, setWorkout] = useState<{
    sessionId: SessionId;
    phaseId: PhaseId;
    resumeDraft?: boolean;
  } | null>(null);

  // NoSleep: must be enabled from a user gesture (click handler)
  const noSleepRef = useRef<NoSleep | null>(null);

  function handleStartWorkout(sessionId: SessionId, phaseId: PhaseId) {
    if (!noSleepRef.current) noSleepRef.current = new NoSleep();
    noSleepRef.current.enable();
    setWorkout({ sessionId, phaseId });
  }

  function handleResumeDraft() {
    const draft = loadDraft();
    if (draft) {
      if (!noSleepRef.current) noSleepRef.current = new NoSleep();
      noSleepRef.current.enable();
      setWorkout({ sessionId: draft.sessionId, phaseId: draft.phaseId, resumeDraft: true });
    }
  }

  function handleFinish() {
    noSleepRef.current?.disable();
    setWorkout(null);
  }

  // Active workout takes over the full screen
  if (workout) {
    const draft = workout.resumeDraft ? loadDraft() : null;
    return (
      <ActiveWorkout
        sessionId={workout.sessionId}
        phaseId={workout.phaseId}
        initialSets={draft?.completedSets}
        initialExerciseIndex={draft?.currentExerciseIndex}
        initialSetNumber={draft?.currentSetNumber}
        onFinish={handleFinish}
      />
    );
  }

  return (
    <div className="app">
      <main className="app-content">
        {tab === 'home' && (
          <Home onStartWorkout={handleStartWorkout} onResumeDraft={handleResumeDraft} />
        )}
        {tab === 'history' && <History />}
        {tab === 'settings' && <Settings />}
      </main>

      <nav className="tab-bar">
        <button
          className={`tab-btn ${tab === 'home' ? 'tab-btn--active' : ''}`}
          onClick={() => switchTab('home')}
        >
          Home
        </button>
        <button
          className={`tab-btn ${tab === 'history' ? 'tab-btn--active' : ''}`}
          onClick={() => switchTab('history')}
        >
          History
        </button>
        <button
          className={`tab-btn ${tab === 'settings' ? 'tab-btn--active' : ''}`}
          onClick={() => switchTab('settings')}
        >
          Settings
        </button>
      </nav>
    </div>
  );
}

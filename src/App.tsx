import { useState, useEffect, useRef } from 'react';
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

    // Also sync and re-acquire wake lock when app comes back to foreground
    function onVisible() {
      if (document.visibilityState === 'visible') {
        sync();
        // Re-acquire wake lock (browser releases it when tab is hidden)
        if (wakeLockRef.current === null && document.querySelector('.active-workout')) {
          requestWakeLock();
        }
      }
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

  // Wake Lock: keep screen on during workout (requires iOS 18.4+ for PWA standalone)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  async function requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      wakeLockRef.current.addEventListener('release', () => { wakeLockRef.current = null; });
    } catch { /* not supported in this context, low battery, etc. */ }
  }

  function handleStartWorkout(sessionId: SessionId, phaseId: PhaseId) {
    requestWakeLock();
    setWorkout({ sessionId, phaseId });
  }

  function handleResumeDraft() {
    const draft = loadDraft();
    if (draft) {
      requestWakeLock();
      setWorkout({ sessionId: draft.sessionId, phaseId: draft.phaseId, resumeDraft: true });
    }
  }

  function handleFinish() {
    wakeLockRef.current?.release();
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

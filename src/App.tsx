import { useState } from 'react';
import type { SessionId, PhaseId } from './types';
import { loadDraft } from './db/database';
import Home from './components/Home';
import ActiveWorkout from './components/ActiveWorkout';
import History from './components/History';
import Settings from './components/Settings';
import './App.css';

type Tab = 'home' | 'history' | 'settings';

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [workout, setWorkout] = useState<{
    sessionId: SessionId;
    phaseId: PhaseId;
    resumeDraft?: boolean;
  } | null>(null);

  function handleStartWorkout(sessionId: SessionId, phaseId: PhaseId) {
    setWorkout({ sessionId, phaseId });
  }

  function handleResumeDraft() {
    const draft = loadDraft();
    if (draft) {
      setWorkout({ sessionId: draft.sessionId, phaseId: draft.phaseId, resumeDraft: true });
    }
  }

  function handleFinish() {
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
          onClick={() => setTab('home')}
        >
          Home
        </button>
        <button
          className={`tab-btn ${tab === 'history' ? 'tab-btn--active' : ''}`}
          onClick={() => setTab('history')}
        >
          History
        </button>
        <button
          className={`tab-btn ${tab === 'settings' ? 'tab-btn--active' : ''}`}
          onClick={() => setTab('settings')}
        >
          Settings
        </button>
      </nav>
    </div>
  );
}

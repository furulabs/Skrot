import { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteErgSession } from '../db/database';
import { formatDate, formatErgType } from '../utils/format';
import type { ErgType, ErgSession } from '../types';

const ERG_TYPES: { value: ErgType; label: string }[] = [
  { value: 'row', label: 'Row' },
  { value: 'bike', label: 'BikeErg' },
  { value: 'skierg', label: 'SkiErg' },
];

function resizeImage(file: File, maxWidth: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function ErgLog() {
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Form state
  const [ergType, setErgType] = useState<ErgType>('row');
  const [time, setTime] = useState('');
  const [distance, setDistance] = useState('');
  const [pace, setPace] = useState('');
  const [strokeRate, setStrokeRate] = useState('');
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sessions = useLiveQuery(() =>
    db.ergSessions.orderBy('date').reverse().toArray()
  );

  function resetForm() {
    setErgType('row');
    setTime('');
    setDistance('');
    setPace('');
    setStrokeRate('');
    setPhoto(undefined);
    setNotes('');
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await resizeImage(file, 800);
    setPhoto(dataUrl);
  }

  async function handleSave() {
    if (!time && !distance) return;

    const session: ErgSession = {
      date: new Date().toISOString().slice(0, 10),
      type: ergType,
      time: time || '0:00',
      distance: Number(distance) || 0,
      pace: pace || '-',
      strokeRate: strokeRate ? Number(strokeRate) : undefined,
      photo,
      notes,
      createdAt: new Date().toISOString(),
    };

    await db.ergSessions.add(session);
    resetForm();
    setShowForm(false);
  }

  if (!sessions) return <div className="loading">Loading...</div>;

  if (showForm) {
    return (
      <div className="erg">
        <div className="erg-form-header">
          <button className="btn btn-ghost" onClick={() => { resetForm(); setShowForm(false); }}>
            ← Back
          </button>
          <h2>Log Erg Session</h2>
        </div>

        {/* Erg type picker */}
        <div className="erg-type-picker">
          <label>Machine</label>
          <div className="phase-chips">
            {ERG_TYPES.map((t) => (
              <button
                key={t.value}
                className={`chip ${ergType === t.value ? 'chip--active' : ''}`}
                onClick={() => setErgType(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Photo upload */}
        <div className="erg-photo-section">
          <label>Screen Photo</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoChange}
            style={{ display: 'none' }}
          />
          {photo ? (
            <div className="erg-photo-preview">
              <img src={photo} alt="Erg screen" />
              <div className="erg-photo-actions">
                <button
                  className="btn btn-ghost"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Retake
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => setPhoto(undefined)}
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <button
              className="btn btn-secondary btn-large erg-photo-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              Take Photo or Choose from Gallery
            </button>
          )}
        </div>

        {/* Metrics form */}
        <div className="erg-fields">
          <div className="erg-fields-row">
            <div className="settings-field">
              <label>Time</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="30:00"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
            <div className="settings-field">
              <label>Distance (m)</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="6737"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
              />
            </div>
          </div>
          <div className="erg-fields-row">
            <div className="settings-field">
              <label>Avg Pace /500m</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="2:09.3"
                value={pace}
                onChange={(e) => setPace(e.target.value)}
              />
            </div>
            <div className="settings-field">
              <label>{ergType === 'bike' ? 'RPM' : 'Stroke Rate'}</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="28"
                value={strokeRate}
                onChange={(e) => setStrokeRate(e.target.value)}
              />
            </div>
          </div>
          <div className="settings-field">
            <label>Notes</label>
            <textarea
              rows={2}
              placeholder="Optional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <button className="btn btn-primary btn-large" onClick={handleSave}>
          Save Session
        </button>
      </div>
    );
  }

  return (
    <div className="erg">
      <h2>Erg Sessions</h2>

      <button
        className="btn btn-primary btn-large"
        onClick={() => setShowForm(true)}
      >
        Log Erg Session
      </button>

      {sessions.length === 0 ? (
        <p className="history-empty">No erg sessions yet. Log your first one!</p>
      ) : (
        <div className="history-list">
          {sessions.map((s) => {
            const isExpanded = expandedId === s.id;
            return (
              <div
                key={s.id}
                className={`history-item ${isExpanded ? 'history-item--expanded' : ''}`}
                onClick={() => setExpandedId(isExpanded ? null : s.id!)}
              >
                <div className="history-item-header">
                  <div>
                    <strong>{formatDate(s.date)}</strong>
                    <span className="history-item-badge">{formatErgType(s.type)}</span>
                  </div>
                  <div className="history-item-meta">
                    <span>{s.distance}m</span>
                    <span>{s.time}</span>
                  </div>
                </div>

                {!isExpanded && (
                  <div className="erg-item-summary">
                    <span className="erg-metric">Pace {s.pace}/500m</span>
                    {s.strokeRate != null && (
                      <span className="erg-metric">
                        {s.strokeRate} {s.type === 'bike' ? 'rpm' : 's/m'}
                      </span>
                    )}
                  </div>
                )}

                {isExpanded && (
                  <div className="history-item-detail">
                    <div className="erg-detail-metrics">
                      <div className="erg-detail-metric">
                        <span className="erg-detail-label">Time</span>
                        <span className="erg-detail-value">{s.time}</span>
                      </div>
                      <div className="erg-detail-metric">
                        <span className="erg-detail-label">Distance</span>
                        <span className="erg-detail-value">{s.distance}m</span>
                      </div>
                      <div className="erg-detail-metric">
                        <span className="erg-detail-label">Avg Pace</span>
                        <span className="erg-detail-value">{s.pace}/500m</span>
                      </div>
                      {s.strokeRate != null && (
                        <div className="erg-detail-metric">
                          <span className="erg-detail-label">
                            {s.type === 'bike' ? 'RPM' : 'Stroke Rate'}
                          </span>
                          <span className="erg-detail-value">
                            {s.strokeRate} {s.type === 'bike' ? 'rpm' : 's/m'}
                          </span>
                        </div>
                      )}
                    </div>

                    {s.photo && (
                      <div className="erg-detail-photo">
                        <img src={s.photo} alt="Erg screen" />
                      </div>
                    )}

                    {s.notes && <p className="history-notes">{s.notes}</p>}

                    <div className="history-item-actions">
                      <span />
                      <button
                        className="btn btn-danger-ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Delete this erg session?')) {
                            deleteErgSession(s.id!);
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
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

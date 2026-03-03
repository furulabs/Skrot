import { useState, useEffect, useRef } from 'react';

interface RestTimerProps {
  duration: number; // seconds
  onComplete: () => void;
}

const RADIUS = 90;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function RestTimer({ duration, onComplete }: RestTimerProps) {
  const [remaining, setRemaining] = useState(duration);
  const startTimeRef = useRef(Date.now());
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    startTimeRef.current = Date.now();

    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const left = Math.max(0, duration - elapsed);
      setRemaining(Math.ceil(left));

      if (left <= 0) {
        clearInterval(interval);
        onCompleteRef.current();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [duration]);

  const progress = remaining / duration;
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const display = minutes > 0
    ? `${minutes}:${seconds.toString().padStart(2, '0')}`
    : `${seconds}`;

  return (
    <div className="rest-timer">
      <p className="rest-timer-label">Rest</p>

      <div className="rest-timer-circle-wrap">
        <svg viewBox="0 0 200 200" className="rest-timer-svg">
          <circle
            cx="100" cy="100" r={RADIUS}
            fill="none"
            stroke="var(--bg-elevated)"
            strokeWidth="8"
          />
          <circle
            cx="100" cy="100" r={RADIUS}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 100 100)"
            style={{ transition: 'stroke-dashoffset 0.15s linear' }}
          />
        </svg>
        <span className="rest-timer-time">{display}</span>
      </div>

      <button className="btn btn-secondary btn-large rest-timer-skip" onClick={onComplete}>
        Skip
      </button>
    </div>
  );
}

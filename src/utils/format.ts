const LOCALE = 'nb-NO';

export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(LOCALE);
}

export function formatDateLong(date: Date = new Date()): string {
  return date.toLocaleDateString(LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function formatNumber(n: number): string {
  return n.toLocaleString(LOCALE);
}

export function formatSet(weight: number, reps: number, unit: 'kg' | 'seconds' | 'reps-only'): string {
  if (unit === 'seconds') return `${weight}s`;
  if (unit === 'reps-only') return `${reps} reps`;
  return `${weight}kg × ${reps}`;
}

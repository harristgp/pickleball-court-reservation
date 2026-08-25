'use client';

import { useEffect, useState } from 'react';
import { AlarmClock } from 'lucide-react';

function remainingMs(deadline: number) {
  return Math.max(0, deadline - Date.now());
}

function format(ms: number) {
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * The hold is enforced server-side by `expiresAt`; this is purely the visible
 * half of that contract. It starts from an ISO string rather than a number so
 * the server render and the first client render agree.
 */
export function ExpiryCountdown({ expiresAt }: { expiresAt: string }) {
  const deadline = new Date(expiresAt).getTime();
  const [left, setLeft] = useState(() => remainingMs(deadline));

  useEffect(() => {
    setLeft(remainingMs(deadline));
    const id = setInterval(() => setLeft(remainingMs(deadline)), 1000);
    return () => clearInterval(id);
  }, [deadline]);

  const expired = left === 0;
  const urgent = !expired && left < 5 * 60 * 1000;

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tabular-nums',
        expired
          ? 'bg-red-50 text-red-700'
          : urgent
            ? 'bg-amber-50 text-amber-700'
            : 'bg-zinc-100 text-zinc-600',
      ].join(' ')}
      role="timer"
      aria-live="off"
    >
      <AlarmClock className="h-3.5 w-3.5" aria-hidden />
      {expired ? 'Hold expired' : `${format(left)} left to pay`}
    </span>
  );
}

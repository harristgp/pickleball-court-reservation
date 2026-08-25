'use client';

import { useCallback, useEffect, useState } from 'react';
import { demoBookings } from './demo';
import { findConflict } from './slots';
import {
  BOOKINGS_CHANGED,
  clearSeeded,
  hasSeeded,
  markSeeded,
  readBookings,
  writeBookings,
} from './storage';
import type { Booking, BookingDraft, SaveResult } from '@/types';

/**
 * The app store: bookings held in React state, mirrored into localStorage.
 *
 * `hydrated` exists because localStorage does not on the server. The first
 * client render has to match the HTML Next.js produced at build time, so state
 * starts empty and the real data is loaded in an effect. Callers render a
 * skeleton until `hydrated` flips.
 */
export interface BookingStore {
  bookings: Booking[];
  hydrated: boolean;
  createBooking: (draft: BookingDraft) => SaveResult;
  cancelBooking: (id: string) => void;
  resetDemoData: () => void;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `bk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function useBookings(): BookingStore {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let initial = readBookings();
    if (initial.length === 0 && !hasSeeded()) {
      initial = demoBookings();
      writeBookings(initial);
      markSeeded();
    }
    setBookings(initial);
    setHydrated(true);
  }, []);

  // `storage` covers other tabs; the custom event covers this one.
  useEffect(() => {
    const sync = () => setBookings(readBookings());
    window.addEventListener('storage', sync);
    window.addEventListener(BOOKINGS_CHANGED, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(BOOKINGS_CHANGED, sync);
    };
  }, []);

  const createBooking = useCallback((draft: BookingDraft): SaveResult => {
    // Re-read instead of trusting React state: another tab may have claimed
    // this slot since the picker rendered. This read is the actual guard
    // against double booking - the disabled buttons are only a hint.
    const latest = readBookings();
    const clash = findConflict(latest, draft.courtId, draft.date, draft.startHour);
    if (clash) {
      return {
        ok: false,
        error: 'That slot was taken a moment ago. Pick another time.',
      };
    }

    const booking: Booking = {
      id: newId(),
      courtId: draft.courtId,
      date: draft.date,
      startHour: draft.startHour,
      endHour: draft.startHour + 1,
      name: draft.name,
      email: draft.email,
      phone: draft.phone,
      skillLevel: draft.skillLevel,
      status: 'CONFIRMED',
      createdAt: new Date().toISOString(),
    };

    const next = [...latest, booking];
    writeBookings(next);
    setBookings(next);
    return { ok: true, booking };
  }, []);

  const cancelBooking = useCallback((id: string) => {
    const next = readBookings().map((booking) =>
      booking.id === id ? { ...booking, status: 'CANCELLED' as const } : booking,
    );
    writeBookings(next);
    setBookings(next);
  }, []);

  const resetDemoData = useCallback(() => {
    const fresh = demoBookings();
    clearSeeded();
    writeBookings(fresh);
    markSeeded();
    setBookings(fresh);
  }, []);

  return { bookings, hydrated, createBooking, cancelBooking, resetDemoData };
}

/**
 * Current time as state, refreshed every minute so slots roll into the past
 * while the tab is open. Starts at epoch: callers gate on `hydrated`, so that
 * placeholder never reaches the DOM, and it keeps the first render pure.
 */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date(0));

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return now;
}

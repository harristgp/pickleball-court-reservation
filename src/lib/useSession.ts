'use client';

import { useCallback, useEffect, useState } from 'react';
import { DEMO_ADMIN, DEMO_USER, readSession, writeSession } from './storage';
import type { Role, Session } from '@/types';

/**
 * Mock authentication.
 *
 * There is no password, no token, and no server check - the role is a value in
 * localStorage that the visitor can flip at will. It exists so the two
 * dashboards can be demonstrated, and every component treats it as a view
 * mode. Swapping this hook for a real session provider is the one change
 * needed to put this behind actual auth.
 */
export interface SessionStore {
  session: Session;
  hydrated: boolean;
  setRole: (role: Role) => void;
}

export function useSession(): SessionStore {
  const [session, setSession] = useState<Session>(DEMO_USER);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSession(readSession());
    setHydrated(true);
  }, []);

  const setRole = useCallback((role: Role) => {
    const next = role === 'ADMIN' ? DEMO_ADMIN : DEMO_USER;
    writeSession(next);
    setSession(next);
  }, []);

  return { session, hydrated, setRole };
}

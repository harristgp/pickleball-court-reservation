import { addDays, todayKey } from './dates';
import { DEMO_USER } from './storage';
import type { Booking, SkillLevel } from '@/types';

/**
 * First-run sample data.
 *
 * Generated relative to the visitor clock rather than hard-coded, so the
 * dashboard is never a wall of dead past dates however long after deploy
 * someone opens it. A couple of rows belong to the demo user so the player
 * view has something in it immediately.
 */

interface Seed {
  dayOffset: number;
  courtId: string;
  startHour: number;
  name: string;
  email: string;
  phone: string;
  skillLevel: SkillLevel;
  cancelled?: boolean;
}

const SEEDS: Seed[] = [
  {
    dayOffset: 1,
    courtId: 'court-1',
    startHour: 7,
    name: 'Priya Raman',
    email: 'priya.raman@example.com',
    phone: '(555) 0188',
    skillLevel: 'ADVANCED',
  },
  {
    dayOffset: 1,
    courtId: 'court-1',
    startHour: 8,
    name: 'Rosa Delgado',
    email: 'rosa.delgado@example.com',
    phone: '(555) 0173',
    skillLevel: 'INTERMEDIATE',
  },
  {
    dayOffset: 1,
    courtId: 'court-2',
    startHour: 18,
    name: 'Marcus Bell',
    email: 'marcus.bell@example.com',
    phone: '(555) 0119',
    skillLevel: 'BEGINNER',
  },
  {
    dayOffset: 1,
    courtId: 'court-3',
    startHour: 9,
    name: 'Dana Whitfield',
    email: 'dana.whitfield@example.com',
    phone: '(555) 0164',
    skillLevel: 'INTERMEDIATE',
  },
  {
    dayOffset: 2,
    courtId: 'court-1',
    startHour: 8,
    name: DEMO_USER.name,
    email: DEMO_USER.email,
    phone: DEMO_USER.phone,
    skillLevel: 'INTERMEDIATE',
  },
  {
    dayOffset: 2,
    courtId: 'court-2',
    startHour: 19,
    name: 'Ingrid Sole',
    email: 'ingrid.sole@example.com',
    phone: '(555) 0155',
    skillLevel: 'PRO',
  },
  {
    dayOffset: 2,
    courtId: 'court-4',
    startHour: 17,
    name: 'Tomas Nkemi',
    email: 'tomas.nkemi@example.com',
    phone: '(555) 0132',
    skillLevel: 'BEGINNER',
    cancelled: true,
  },
  {
    dayOffset: 3,
    courtId: 'court-2',
    startHour: 12,
    name: 'Wei Chen',
    email: 'wei.chen@example.com',
    phone: '(555) 0147',
    skillLevel: 'ADVANCED',
  },
  {
    dayOffset: 4,
    courtId: 'court-3',
    startHour: 20,
    name: DEMO_USER.name,
    email: DEMO_USER.email,
    phone: DEMO_USER.phone,
    skillLevel: 'INTERMEDIATE',
  },
];

export function demoBookings(): Booking[] {
  const today = todayKey();
  const now = Date.now();

  return SEEDS.map((seed, index) => ({
    id: `demo-${index + 1}`,
    courtId: seed.courtId,
    date: addDays(today, seed.dayOffset),
    startHour: seed.startHour,
    endHour: seed.startHour + 1,
    name: seed.name,
    email: seed.email,
    phone: seed.phone,
    skillLevel: seed.skillLevel,
    status: seed.cancelled ? 'CANCELLED' : 'CONFIRMED',
    // Staggered backwards so the admin list has a believable created order.
    createdAt: new Date(now - (SEEDS.length - index) * 45 * 60 * 1000).toISOString(),
  }));
}

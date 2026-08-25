import type { Court } from '@/types';

/** The club opens at 6am and takes its last booking at 9pm (finishing at 10pm). */
export const OPEN_HOUR = 6;
export const CLOSE_HOUR = 22;

export const SLOTS_PER_DAY = CLOSE_HOUR - OPEN_HOUR;

export const COURTS: Court[] = [
  {
    id: 'court-1',
    name: 'Court 1',
    surface: 'INDOOR',
    hourlyRate: 28,
    hasLights: true,
    description: 'Championship court. Cushioned acrylic, permanent net, spectator seating.',
  },
  {
    id: 'court-2',
    name: 'Court 2',
    surface: 'INDOOR',
    hourlyRate: 24,
    hasLights: true,
    description: 'Climate controlled, same cushioned surface as Court 1, no seating.',
  },
  {
    id: 'court-3',
    name: 'Court 3',
    surface: 'OUTDOOR',
    hourlyRate: 18,
    hasLights: true,
    description: 'Post-tension concrete with wind screens on the north side. Lit until close.',
  },
  {
    id: 'court-4',
    name: 'Court 4',
    surface: 'OUTDOOR',
    hourlyRate: 16,
    hasLights: false,
    description: 'Open-air court beside the pro shop. Daylight play only.',
  },
];

/** Falls back to the first court so a stale stored id can never blank the UI. */
export function courtById(id: string): Court {
  return COURTS.find((court) => court.id === id) ?? COURTS[0];
}

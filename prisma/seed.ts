/**
 * Seeds a demo tenant set: one platform admin, two court owners, three players,
 * facilities with courts spread far enough apart that the 10/25/50 km radius
 * filters visibly differ, and bookings in every status so both the player
 * dashboard and the owner approvals queue are populated on first load.
 *
 * Run with: npm run seed
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient, type CourtType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';

const prisma = new PrismaClient();

const PASSWORD = 'password123';
const UPLOAD_ROOT = path.join(process.cwd(), 'public', 'uploads');

function utcDate(daysFromToday: number): Date {
  const now = new Date();
  const base = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(base + daysFromToday * 86_400_000);
}

function slot(day: Date, hour: number): { start: Date; end: Date } {
  const start = new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour, 0, 0, 0),
  );
  return { start, end: new Date(start.getTime() + 3_600_000) };
}

async function writeQr(fileName: string, payload: string): Promise<string> {
  const dir = path.join(UPLOAD_ROOT, 'qr');
  await mkdir(dir, { recursive: true });
  const buffer = await QRCode.toBuffer(payload, {
    width: 512,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#18181b', light: '#ffffff' },
  });
  await writeFile(path.join(dir, fileName), buffer);
  return `/uploads/qr/${fileName}`;
}

async function writeReceipt(fileName: string, lines: string[]): Promise<string> {
  const dir = path.join(UPLOAD_ROOT, 'receipts');
  await mkdir(dir, { recursive: true });
  const body = lines
    .map((line, index) => `<text x="40" y="${150 + index * 46}" font-size="26" fill="#18181b">${line}</text>`)
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="720" viewBox="0 0 520 720">
  <rect width="520" height="720" fill="#f4f4f5"/>
  <rect x="20" y="20" width="480" height="680" rx="24" fill="#ffffff"/>
  <circle cx="260" cy="96" r="34" fill="#75b61d"/>
  <path d="M244 96 l11 11 l21 -22" stroke="#ffffff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="40" y="${150 - 46}" font-size="30" font-weight="700" fill="#18181b">Payment sent</text>
  ${body}
</svg>`;
  await writeFile(path.join(dir, fileName), svg, 'utf8');
  return `/uploads/receipts/${fileName}`;
}

interface CourtSeed {
  name: string;
  type: CourtType;
  hourlyRate: number;
  openHour: number;
  closeHour: number;
  latitude: number;
  longitude: number;
}

interface FacilitySeed {
  name: string;
  description: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  openHour: number;
  closeHour: number;
  accountName: string;
  accountNumber: string;
  instructions: string;
  courts: CourtSeed[];
}

interface OwnerSeed {
  email: string;
  name: string;
  phone: string;
  facilities: FacilitySeed[];
}

const OWNERS: OwnerSeed[] = [
  {
    email: 'owner@smashcity.test',
    name: 'Rina Delgado',
    phone: '0917 555 0142',
    facilities: [
      {
        name: 'Smash City BGC',
        description: 'Premium indoor pickleball facility in the heart of BGC. Four climate-controlled courts with professional-grade lighting and rubber flooring.',
        address: '26th Street, Bonifacio Global City, Taguig',
        city: 'Taguig',
        latitude: 14.5507,
        longitude: 121.0501,
        openHour: 6,
        closeHour: 23,
        accountName: 'Smash City Pickleball Inc.',
        accountNumber: '0917 555 0142',
        instructions:
          'Scan the QR with GCash or Maya and send the exact booking amount. Upload the confirmation screenshot here — we verify within 30 minutes during opening hours.',
        courts: [
          { name: 'Court 1 (Indoor)', type: 'INDOOR', hourlyRate: 750, openHour: 6, closeHour: 23, latitude: 14.5507, longitude: 121.0501 },
          { name: 'Court 2 (Indoor)', type: 'INDOOR', hourlyRate: 750, openHour: 6, closeHour: 23, latitude: 14.5508, longitude: 121.0502 },
          { name: 'Court 3', type: 'OUTDOOR', hourlyRate: 500, openHour: 6, closeHour: 22, latitude: 14.5509, longitude: 121.0503 },
          { name: 'Court 4', type: 'OUTDOOR', hourlyRate: 500, openHour: 6, closeHour: 22, latitude: 14.5510, longitude: 121.0504 },
        ],
      },
      {
        name: 'Smash City Southbay',
        description: 'Outdoor courts along the Southbay promenade. Perfect for sunset games with a sea breeze.',
        address: 'Southbay Boulevard, Muntinlupa',
        city: 'Muntinlupa',
        latitude: 14.4176,
        longitude: 121.0409,
        openHour: 6,
        closeHour: 24,
        accountName: 'Southbay Pickle Club',
        accountNumber: '0995 118 3390',
        instructions:
          'Send payment through the QR below. Include your booking time in the notes of the transfer, then upload the screenshot so we can match it quickly.',
        courts: [
          { name: 'Bay 1', type: 'OUTDOOR', hourlyRate: 450, openHour: 6, closeHour: 24, latitude: 14.4176, longitude: 121.0409 },
          { name: 'Bay 2', type: 'OUTDOOR', hourlyRate: 450, openHour: 6, closeHour: 24, latitude: 14.4177, longitude: 121.0410 },
          { name: 'Bay 3', type: 'OUTDOOR', hourlyRate: 400, openHour: 6, closeHour: 22, latitude: 14.4178, longitude: 121.0411 },
        ],
      },
    ],
  },
  {
    email: 'owner@northsidedinks.test',
    name: 'Marco Lim',
    phone: '0918 220 7781',
    facilities: [
      {
        name: 'Northside Dinks Sports Hub',
        description: 'Three indoor halls with varying court surfaces. Air-conditioned and well-lit for evening play.',
        address: '73oose Avenue, Quezon City',
        city: 'Quezon City',
        latitude: 14.6349,
        longitude: 121.0388,
        openHour: 7,
        closeHour: 23,
        accountName: 'Northside Dinks Sports Hub',
        accountNumber: '0918 220 7781',
        instructions:
          'Transfer via the QR code or to our BPI account, then upload the receipt. Bookings unverified 30 minutes before start time are released to the waitlist.',
        courts: [
          { name: 'Hall A', type: 'INDOOR', hourlyRate: 600, openHour: 7, closeHour: 23, latitude: 14.6349, longitude: 121.0388 },
          { name: 'Hall B', type: 'INDOOR', hourlyRate: 600, openHour: 7, closeHour: 23, latitude: 14.6350, longitude: 121.0389 },
          { name: 'Hall C', type: 'INDOOR', hourlyRate: 550, openHour: 7, closeHour: 21, latitude: 14.6351, longitude: 121.0390 },
        ],
      },
    ],
  },
];

async function main() {
  console.log('› Resetting demo data…');
  await prisma.paymentReceipt.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.bookingGroup.deleteMany();
  await prisma.court.deleteMany();
  await prisma.facility.deleteMany();
  await prisma.paymentMethod.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const [admin, ownerSmash, ownerNorth, alex, bea, caloy] = await Promise.all(
    [
      { email: 'admin@pcourt.test', name: 'Platform Admin', role: 'SUPER_ADMIN' as const, phone: '0917 000 0001' },
      { email: 'owner@smashcity.test', name: 'Rina Delgado', role: 'OWNER' as const, phone: '0917 555 0142' },
      { email: 'owner@northsidedinks.test', name: 'Marco Lim', role: 'OWNER' as const, phone: '0918 220 7781' },
      { email: 'player@pcourt.test', name: 'Alex Ramos', role: 'PLAYER' as const, phone: '0917 300 1122' },
      { email: 'bea@pcourt.test', name: 'Bea Santos', role: 'PLAYER' as const, phone: '0917 300 3344' },
      { email: 'caloy@pcourt.test', name: 'Caloy Uy', role: 'PLAYER' as const, phone: '0917 300 5566' },
    ].map((user) => prisma.user.create({ data: { ...user, passwordHash } })),
  );

  const ownerByEmail: Record<string, string> = {
    'owner@smashcity.test': ownerSmash.id,
    'owner@northsidedinks.test': ownerNorth.id,
  };

  console.log('› Creating owners, facilities, courts, and payment configs…');

  type CourtRecord = { id: string; name: string; rate: number };
  type FacilityRecord = { id: string; name: string; courts: CourtRecord[] };
  const facilities: FacilityRecord[] = [];

  for (const seed of OWNERS) {
    const ownerId = ownerByEmail[seed.email];

    for (const facSeed of seed.facilities) {
      const slug = facSeed.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const qrCodeUrl = await writeQr(
        `${slug}.png`,
        `PAY:${facSeed.accountName}|ACCT:${facSeed.accountNumber}|REF:${slug.toUpperCase()}`,
      );

      const facility = await prisma.facility.create({
        data: {
          ownerId,
          name: facSeed.name,
          description: facSeed.description,
          address: facSeed.address,
          city: facSeed.city,
          latitude: facSeed.latitude,
          longitude: facSeed.longitude,
          openHour: facSeed.openHour,
          closeHour: facSeed.closeHour,
          isActive: true,
        },
      });

      const courts = await Promise.all(
        facSeed.courts.map((court) =>
          prisma.court.create({
            data: {
              facilityId: facility.id,
              name: court.name,
              type: court.type,
              hourlyRate: court.hourlyRate,
              openHour: court.openHour,
              closeHour: court.closeHour,
              latitude: court.latitude,
              longitude: court.longitude,
              isActive: true,
            },
          }),
        ),
      );

      await prisma.paymentMethod.create({
        data: {
          ownerId,
          name: facSeed.accountName.includes('GCash') ? 'GCash' : facSeed.accountName.includes('Maya') ? 'Maya' : 'Default',
          qrCodeUrl,
          accountName: facSeed.accountName,
          accountNumber: facSeed.accountNumber,
          instructions: facSeed.instructions,
          sortOrder: 0,
        },
      });

      facilities.push({
        id: facility.id,
        name: facility.name,
        courts: courts.map((c) => ({ id: c.id, name: c.name, rate: Number(c.hourlyRate) })),
      });
    }
  }

  console.log('› Creating bookings across every status…');
  const smashBgc = facilities.find((f) => f.name === 'Smash City BGC')!;
  const smashSouth = facilities.find((f) => f.name === 'Smash City Southbay')!;
  const northside = facilities.find((f) => f.name === 'Northside Dinks Sports Hub')!;
  const tomorrow = utcDate(1);
  const dayAfter = utcDate(2);
  const today = utcDate(0);

  const courtOf = (facility: FacilityRecord, name: string) => {
    const court = facility.courts.find((c) => c.name === name);
    if (!court) throw new Error(`Seed court missing: ${name}`);
    return court;
  };

  async function bookGroup(params: {
    playerId: string;
    facilityId?: string;
    slots: { court: { id: string; rate: number }; day: Date; hour: number }[];
    status: 'PENDING_PAYMENT' | 'PENDING_VERIFICATION' | 'CONFIRMED' | 'REJECTED';
    notes?: string;
    receipt?: { url: string; reference: string; amount: number; rejectionReason?: string; verifiedById?: string };
  }) {
    const total = params.slots.reduce((sum, s) => sum + s.court.rate, 0);
    const lastSlot = params.slots[params.slots.length - 1];
    const { end: lastEnd } = slot(lastSlot.day, lastSlot.hour);

    const group = await prisma.bookingGroup.create({
      data: {
        playerId: params.playerId,
        facilityId: params.facilityId ?? null,
        totalPrice: total,
        status: params.status,
        expiresAt: params.status === 'PENDING_PAYMENT' ? new Date(Date.now() + 30 * 60_000) : lastEnd,
        notes: params.notes,
      },
    });

    for (const s of params.slots) {
      const { start, end } = slot(s.day, s.hour);
      await prisma.booking.create({
        data: {
          groupId: group.id,
          playerId: params.playerId,
          courtId: s.court.id,
          date: s.day,
          startTime: start,
          endTime: end,
          totalPrice: s.court.rate,
          status: params.status,
        },
      });
    }

    if (params.receipt) {
      await prisma.paymentReceipt.create({
        data: {
          groupId: group.id,
          screenshotUrl: params.receipt.url,
          referenceNumber: params.receipt.reference,
          amountClaimed: params.receipt.amount,
          verifiedAt: params.status === 'PENDING_VERIFICATION' ? null : new Date(),
          verifiedById: params.status === 'PENDING_VERIFICATION' ? null : params.receipt.verifiedById,
          rejectionReason: params.receipt.rejectionReason,
        },
      });
    }

    return group;
  }

  const confirmedReceipt = await writeReceipt('seed-confirmed.svg', [
    'Amount: PHP 500.00',
    'To: Smash City Pickleball',
    'Ref: 0029 8371 2210',
    'Status: Successful',
  ]);
  const pendingReceipt = await writeReceipt('seed-pending.svg', [
    'Amount: PHP 750.00',
    'To: Smash City Pickleball',
    'Ref: 0044 1190 7765',
    'Status: Successful',
  ]);
  const rejectedReceipt = await writeReceipt('seed-rejected.svg', [
    'Amount: PHP 200.00',
    'To: Southbay Pickle Club',
    'Ref: 0088 4412 0031',
    'Status: Successful',
  ]);

  await bookGroup({
    playerId: alex.id,
    facilityId: smashBgc.id,
    slots: [{ court: courtOf(smashBgc, 'Court 3'), day: today, hour: 18 }],
    status: 'CONFIRMED',
    notes: 'Doubles with the Tuesday group.',
    receipt: { url: confirmedReceipt, reference: '0029 8371 2210', amount: 500, verifiedById: ownerSmash.id },
  });

  await bookGroup({
    playerId: bea.id,
    facilityId: smashBgc.id,
    slots: [{ court: courtOf(smashBgc, 'Court 1 (Indoor)'), day: tomorrow, hour: 19 }],
    status: 'PENDING_VERIFICATION',
    notes: 'Please leave the aircon on.',
    receipt: { url: pendingReceipt, reference: '0044 1190 7765', amount: 750 },
  });

  await bookGroup({
    playerId: caloy.id,
    facilityId: northside.id,
    slots: [{ court: courtOf(northside, 'Hall A'), day: tomorrow, hour: 20 }],
    status: 'PENDING_PAYMENT',
  });

  await bookGroup({
    playerId: alex.id,
    facilityId: smashSouth.id,
    slots: [{ court: courtOf(smashSouth, 'Bay 1'), day: dayAfter, hour: 7 }],
    status: 'REJECTED',
    receipt: {
      url: rejectedReceipt,
      reference: '0088 4412 0031',
      amount: 200,
      rejectionReason: 'Screenshot shows ₱200 but the booking is ₱450. Send the difference and re-upload.',
      verifiedById: ownerSmash.id,
    },
  });

  await bookGroup({
    playerId: bea.id,
    facilityId: smashSouth.id,
    slots: [{ court: courtOf(smashSouth, 'Bay 2'), day: tomorrow, hour: 8 }],
    status: 'CONFIRMED',
    receipt: { url: confirmedReceipt, reference: '0091 5510 8842', amount: 450, verifiedById: ownerSmash.id },
  });

  // Multi-hour booking example: Alex books 3 consecutive hours on Court 1 at Smash City BGC
  await bookGroup({
    playerId: alex.id,
    facilityId: smashBgc.id,
    slots: [
      { court: courtOf(smashBgc, 'Court 1 (Indoor)'), day: tomorrow, hour: 14 },
      { court: courtOf(smashBgc, 'Court 1 (Indoor)'), day: tomorrow, hour: 15 },
      { court: courtOf(smashBgc, 'Court 1 (Indoor)'), day: tomorrow, hour: 16 },
    ],
    status: 'CONFIRMED',
    notes: 'Training session with coach.',
    receipt: { url: confirmedReceipt, reference: '0055 1234 5678', amount: 2250, verifiedById: ownerSmash.id },
  });

  console.log('\n✔ Seed complete.');
  console.log(`  Admin   ${admin.email}`);
  console.log(`  Owners  ${ownerSmash.email}, ${ownerNorth.email}`);
  console.log(`  Players ${alex.email}, ${bea.email}, ${caloy.email}`);
  console.log(`  Facilities ${facilities.map((f) => f.name).join(', ')}`);
  console.log(`  Password for every account: ${PASSWORD}\n`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

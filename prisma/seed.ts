/**
 * Seeds a demo tenant set: one platform admin, two court owners, three players,
 * courts spread far enough apart that the 10/25/50 km radius filters visibly
 * differ, and bookings in every status so both the player dashboard and the
 * owner approvals queue are populated on first load.
 *
 * Run with: npm run seed
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient, type CourtType, type Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';

const prisma = new PrismaClient();

const PASSWORD = 'password123';
const UPLOAD_ROOT = path.join(process.cwd(), 'public', 'uploads');

/** Slots are whole hours anchored in UTC — same construction the app uses. */
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

/** Writes a real, scannable QR PNG so the checkout page shows something honest. */
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

/** A placeholder "receipt" screenshot, drawn as an SVG so no binary is vendored. */
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

interface OwnerSeed {
  email: string;
  name: string;
  phone: string;
  accountName: string;
  accountNumber: string;
  instructions: string;
  courts: CourtSeed[];
}

// Coordinates are real Metro Manila locations. BGC → Quezon City is ~13 km and
// BGC → Alabang is ~19 km, so 10 km, 25 km, and 50 km each return a different set.
const OWNERS: OwnerSeed[] = [
  {
    email: 'owner@smashcity.test',
    name: 'Rina Delgado',
    phone: '0917 555 0142',
    accountName: 'Smash City Pickleball Inc.',
    accountNumber: '0917 555 0142',
    instructions:
      'Scan the QR with GCash or Maya and send the exact booking amount. Upload the confirmation screenshot here — we verify within 30 minutes during opening hours. Walk-ins are only accepted if the slot is still open.',
    courts: [
      { name: 'Court 1 (Indoor)', type: 'INDOOR', hourlyRate: 750, openHour: 6, closeHour: 23, latitude: 14.5507, longitude: 121.0501 },
      { name: 'Court 2 (Indoor)', type: 'INDOOR', hourlyRate: 750, openHour: 6, closeHour: 23, latitude: 14.5508, longitude: 121.0502 },
      { name: 'Court 3', type: 'OUTDOOR', hourlyRate: 500, openHour: 6, closeHour: 22, latitude: 14.5509, longitude: 121.0503 },
      { name: 'Court 4', type: 'OUTDOOR', hourlyRate: 500, openHour: 6, closeHour: 22, latitude: 14.5510, longitude: 121.0504 },
    ],
  },
  {
    email: 'owner@northsidedinks.test',
    name: 'Marco Lim',
    phone: '0918 220 7781',
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
  {
    email: 'owner@smashcity.test', // same owner, second set of courts
    name: 'Rina Delgado',
    phone: '0917 555 0142',
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
];

async function main() {
  console.log('› Resetting demo data…');
  // Order matters: receipts reference bookings, bookings reference courts.
  await prisma.paymentReceipt.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.court.deleteMany();
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

  console.log('› Creating owners, courts, and payment configs…');
  const created: { ownerId: string; courts: { id: string; name: string; rate: number }[] }[] = [];

  for (const seed of OWNERS) {
    const ownerId = ownerByEmail[seed.email];
    const slug = seed.courts[0]?.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') ?? 'default';
    const qrCodeUrl = await writeQr(
      `${slug}.png`,
      `PAY:${seed.accountName}|ACCT:${seed.accountNumber}|REF:${slug.toUpperCase()}`,
    );

    const courts = await Promise.all(
      seed.courts.map((court) =>
        prisma.court.create({
          data: {
            ownerId,
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
        name: seed.accountName.includes('GCash') ? 'GCash' : seed.accountName.includes('Maya') ? 'Maya' : 'Default',
        qrCodeUrl,
        accountName: seed.accountName,
        accountNumber: seed.accountNumber,
        instructions: seed.instructions,
        sortOrder: 0,
      },
    });

    created.push({
      ownerId,
      courts: courts.map((court) => ({
        id: court.id,
        name: court.name,
        rate: Number(court.hourlyRate),
      })),
    });
  }

  console.log('› Creating bookings across every status…');
  const [smash, north, south] = created;
  const tomorrow = utcDate(1);
  const dayAfter = utcDate(2);
  const today = utcDate(0);

  const courtOf = (owner: (typeof created)[number], name: string) => {
    const court = owner.courts.find((candidate) => candidate.name === name);
    if (!court) throw new Error(`Seed court missing: ${name}`);
    return court;
  };

  async function book(params: {
    playerId: string;
    court: { id: string; rate: number };
    day: Date;
    hour: number;
    status: 'PENDING_PAYMENT' | 'PENDING_VERIFICATION' | 'CONFIRMED' | 'REJECTED';
    notes?: string;
    receipt?: { url: string; reference: string; amount: number; rejectionReason?: string; verifiedById?: string };
  }) {
    const { start, end } = slot(params.day, params.hour);
    const booking = await prisma.booking.create({
      data: {
        playerId: params.playerId,
        courtId: params.court.id,
        date: params.day,
        startTime: start,
        endTime: end,
        totalPrice: params.court.rate,
        status: params.status,
        notes: params.notes,
        // A live hold expires 30 minutes out; anything already decided keeps the
        // slot until the game itself ends.
        expiresAt: params.status === 'PENDING_PAYMENT' ? new Date(Date.now() + 30 * 60_000) : end,
      },
    });

    if (params.receipt) {
      await prisma.paymentReceipt.create({
        data: {
          bookingId: booking.id,
          screenshotUrl: params.receipt.url,
          referenceNumber: params.receipt.reference,
          amountClaimed: params.receipt.amount,
          verifiedAt: params.status === 'PENDING_VERIFICATION' ? null : new Date(),
          verifiedById: params.status === 'PENDING_VERIFICATION' ? null : params.receipt.verifiedById,
          rejectionReason: params.receipt.rejectionReason,
        },
      });
    }

    return booking;
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

  await book({
    playerId: alex.id,
    court: courtOf(smash, 'Court 3'),
    day: today,
    hour: 18,
    status: 'CONFIRMED',
    notes: 'Doubles with the Tuesday group.',
    receipt: { url: confirmedReceipt, reference: '0029 8371 2210', amount: 500, verifiedById: ownerSmash.id },
  });

  await book({
    playerId: bea.id,
    court: courtOf(smash, 'Court 1 (Indoor)'),
    day: tomorrow,
    hour: 19,
    status: 'PENDING_VERIFICATION',
    notes: 'Please leave the aircon on.',
    receipt: { url: pendingReceipt, reference: '0044 1190 7765', amount: 750 },
  });

  await book({
    playerId: caloy.id,
    court: courtOf(north, 'Hall A'),
    day: tomorrow,
    hour: 20,
    status: 'PENDING_PAYMENT',
  });

  await book({
    playerId: alex.id,
    court: courtOf(south, 'Bay 1'),
    day: dayAfter,
    hour: 7,
    status: 'REJECTED',
    receipt: {
      url: rejectedReceipt,
      reference: '0088 4412 0031',
      amount: 200,
      rejectionReason: 'Screenshot shows ₱200 but the booking is ₱450. Send the difference and re-upload.',
      verifiedById: ownerSmash.id,
    },
  });

  await book({
    playerId: bea.id,
    court: courtOf(south, 'Bay 2'),
    day: tomorrow,
    hour: 8,
    status: 'CONFIRMED',
    receipt: { url: confirmedReceipt, reference: '0091 5510 8842', amount: 450, verifiedById: ownerSmash.id },
  });

  console.log('\n✔ Seed complete.');
  console.log(`  Admin   ${admin.email}`);
  console.log(`  Owners  ${ownerSmash.email}, ${ownerNorth.email}`);
  console.log(`  Players ${alex.email}, ${bea.email}, ${caloy.email}`);
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

/**
 * Seeds a demo tenant set: one platform admin, two club owners, three players,
 * three Metro Manila clubs spread far enough apart that the 10/25/50 km radius
 * filters visibly differ, and bookings in every status so both the player
 * dashboard and the owner approvals queue are populated on first load.
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
}

interface ClubSeed {
  slug: string;
  name: string;
  description: string;
  address: string;
  city: string;
  phone: string;
  latitude: number;
  longitude: number;
  ownerEmail: string;
  accountName: string;
  accountNumber: string;
  instructions: string;
  courts: CourtSeed[];
}

// Coordinates are real Metro Manila locations. BGC → Quezon City is ~13 km and
// BGC → Alabang is ~19 km, so 10 km, 25 km, and 50 km each return a different set.
const CLUBS: ClubSeed[] = [
  {
    slug: 'smash-city-bgc',
    name: 'Smash City BGC',
    description:
      'Four cushioned outdoor courts and two air-conditioned indoor courts a block from High Street. Paddle rental, ball machine, and a coach on duty every evening.',
    address: '7th Avenue corner 29th Street, Bonifacio Global City',
    city: 'Taguig',
    phone: '0917 555 0142',
    latitude: 14.5507,
    longitude: 121.0501,
    ownerEmail: 'owner@smashcity.test',
    accountName: 'Smash City Pickleball Inc.',
    accountNumber: '0917 555 0142',
    instructions:
      'Scan the QR with GCash or Maya and send the exact booking amount. Upload the confirmation screenshot here — we verify within 30 minutes during opening hours. Walk-ins are only accepted if the slot is still open.',
    courts: [
      { name: 'Court 1 (Indoor)', type: 'INDOOR', hourlyRate: 750, openHour: 6, closeHour: 23 },
      { name: 'Court 2 (Indoor)', type: 'INDOOR', hourlyRate: 750, openHour: 6, closeHour: 23 },
      { name: 'Court 3', type: 'OUTDOOR', hourlyRate: 500, openHour: 6, closeHour: 22 },
      { name: 'Court 4', type: 'OUTDOOR', hourlyRate: 500, openHour: 6, closeHour: 22 },
    ],
  },
  {
    slug: 'northside-dinks-qc',
    name: 'Northside Dinks',
    description:
      'A converted badminton hall in Quezon City with three indoor courts, wooden flooring, and league nights every Wednesday and Saturday.',
    address: '18 Mother Ignacia Avenue, Diliman',
    city: 'Quezon City',
    phone: '0918 220 7781',
    latitude: 14.6349,
    longitude: 121.0388,
    ownerEmail: 'owner@northsidedinks.test',
    accountName: 'Northside Dinks Sports Hub',
    accountNumber: '0918 220 7781',
    instructions:
      'Transfer via the QR code or to our BPI account, then upload the receipt. Bookings unverified 30 minutes before start time are released to the waitlist.',
    courts: [
      { name: 'Hall A', type: 'INDOOR', hourlyRate: 600, openHour: 7, closeHour: 23 },
      { name: 'Hall B', type: 'INDOOR', hourlyRate: 600, openHour: 7, closeHour: 23 },
      { name: 'Hall C', type: 'INDOOR', hourlyRate: 550, openHour: 7, closeHour: 21 },
    ],
  },
  {
    slug: 'southbay-pickle-alabang',
    name: 'Southbay Pickle Club',
    description:
      'Six outdoor courts under shade sails in Alabang, floodlit until midnight. Free parking, showers, and a smoothie bar on site.',
    address: 'Southbay Boulevard, Alabang',
    city: 'Muntinlupa',
    phone: '0995 118 3390',
    latitude: 14.4176,
    longitude: 121.0409,
    ownerEmail: 'owner@smashcity.test',
    accountName: 'Southbay Pickle Club',
    accountNumber: '0995 118 3390',
    instructions:
      'Send payment through the QR below. Include your booking time in the notes of the transfer, then upload the screenshot so we can match it quickly.',
    courts: [
      { name: 'Bay 1', type: 'OUTDOOR', hourlyRate: 450, openHour: 6, closeHour: 24 },
      { name: 'Bay 2', type: 'OUTDOOR', hourlyRate: 450, openHour: 6, closeHour: 24 },
      { name: 'Bay 3', type: 'OUTDOOR', hourlyRate: 400, openHour: 6, closeHour: 22 },
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
  await prisma.club.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const [admin, ownerSmash, ownerNorth, alex, bea, caloy] = await Promise.all(
    [
      { email: 'admin@dinkcourt.test', name: 'Platform Admin', role: 'SUPER_ADMIN' as const, phone: '0917 000 0001' },
      { email: 'owner@smashcity.test', name: 'Rina Delgado', role: 'OWNER' as const, phone: '0917 555 0142' },
      { email: 'owner@northsidedinks.test', name: 'Marco Lim', role: 'OWNER' as const, phone: '0918 220 7781' },
      { email: 'player@dinkcourt.test', name: 'Alex Ramos', role: 'PLAYER' as const, phone: '0917 300 1122' },
      { email: 'bea@dinkcourt.test', name: 'Bea Santos', role: 'PLAYER' as const, phone: '0917 300 3344' },
      { email: 'caloy@dinkcourt.test', name: 'Caloy Uy', role: 'PLAYER' as const, phone: '0917 300 5566' },
    ].map((user) => prisma.user.create({ data: { ...user, passwordHash } })),
  );

  const ownerByEmail: Record<string, string> = {
    'owner@smashcity.test': ownerSmash.id,
    'owner@northsidedinks.test': ownerNorth.id,
  };

  console.log('› Creating clubs, courts, and payment configs…');
  const created: { clubId: string; slug: string; courts: { id: string; name: string; rate: number }[] }[] = [];

  for (const seed of CLUBS) {
    const qrCodeUrl = await writeQr(
      `${seed.slug}.png`,
      `PAY:${seed.accountName}|ACCT:${seed.accountNumber}|REF:${seed.slug.toUpperCase()}`,
    );

    const club = await prisma.club.create({
      data: {
        ownerId: ownerByEmail[seed.ownerEmail],
        slug: seed.slug,
        name: seed.name,
        description: seed.description,
        address: seed.address,
        city: seed.city,
        phone: seed.phone,
        latitude: seed.latitude,
        longitude: seed.longitude,
        isActive: true,
        paymentMethods: {
          create: {
            name: seed.accountName.includes('GCash') ? 'GCash' : seed.accountName.includes('Maya') ? 'Maya' : 'Default',
            qrCodeUrl,
            accountName: seed.accountName,
            accountNumber: seed.accountNumber,
            instructions: seed.instructions,
            sortOrder: 0,
          },
        },
        courts: { create: seed.courts.map((court) => ({ ...court })) },
      },
      include: { courts: true },
    });

    created.push({
      clubId: club.id,
      slug: club.slug,
      courts: club.courts.map((court) => ({
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

  const courtOf = (club: (typeof created)[number], name: string) => {
    const court = club.courts.find((candidate) => candidate.name === name);
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

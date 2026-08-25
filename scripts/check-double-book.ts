/**
 * Proves the double-booking guarantee is enforced by PostgreSQL, not by app
 * code. Five concurrent inserts race for the same court-hour; exactly one may
 * win. Then a rejection is applied and the slot must become bookable again,
 * because REJECTED rows fall out of the partial unique index.
 *
 * Run with: npm run check:double-book
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const CONCURRENCY = 5;

function isSlotConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;
  const meta = JSON.stringify(error.meta ?? {});
  return meta.includes('booking_active_slot') || (meta.includes('courtId') && meta.includes('startTime'));
}

async function main() {
  const court = await prisma.court.findFirst({
    where: { isActive: true },
    include: { owner: true },
  });
  const players = await prisma.user.findMany({ where: { role: 'PLAYER' }, take: CONCURRENCY });

  if (!court || players.length === 0) {
    throw new Error('Run `npm run seed` first — the check needs a court and at least one player.');
  }

  // A slot far enough out that the seeded bookings cannot collide with it.
  const day = new Date(Date.now() + 21 * 86_400_000);
  const date = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
  const startTime = new Date(date.getTime() + 9 * 3_600_000);
  const endTime = new Date(startTime.getTime() + 3_600_000);

  await prisma.paymentReceipt.deleteMany({ where: { booking: { courtId: court.id, startTime } } });
  await prisma.booking.deleteMany({ where: { courtId: court.id, startTime } });

  console.log(`› Firing ${CONCURRENCY} concurrent bookings at ${court.owner.name} / ${court.name}`);
  console.log(`  ${startTime.toISOString()} → ${endTime.toISOString()}\n`);

  const results = await Promise.allSettled(
    Array.from({ length: CONCURRENCY }, (_, index) =>
      prisma.booking.create({
        data: {
          playerId: players[index % players.length].id,
          courtId: court.id,
          date,
          startTime,
          endTime,
          totalPrice: court.hourlyRate,
          status: 'PENDING_PAYMENT',
          expiresAt: new Date(Date.now() + 30 * 60_000),
        },
      }),
    ),
  );

  const fulfilled = results.filter((result) => result.status === 'fulfilled');
  const conflicts = results.filter(
    (result) => result.status === 'rejected' && isSlotConflict(result.reason),
  );
  const other = results.filter(
    (result) => result.status === 'rejected' && !isSlotConflict(result.reason),
  );

  const rows = await prisma.booking.count({ where: { courtId: court.id, startTime } });

  console.log(`  succeeded ......... ${fulfilled.length}`);
  console.log(`  slot conflicts .... ${conflicts.length}`);
  console.log(`  other failures .... ${other.length}`);
  console.log(`  rows in database .. ${rows}\n`);

  const failures: string[] = [];
  if (fulfilled.length !== 1) failures.push(`expected exactly 1 winner, got ${fulfilled.length}`);
  if (conflicts.length !== CONCURRENCY - 1) {
    failures.push(`expected ${CONCURRENCY - 1} slot conflicts, got ${conflicts.length}`);
  }
  if (other.length !== 0) {
    failures.push(`unexpected error: ${String((other[0] as PromiseRejectedResult | undefined)?.reason)}`);
  }
  if (rows !== 1) failures.push(`expected 1 row for the slot, found ${rows}`);

  // Second half: rejecting must free the slot with no extra bookkeeping.
  const winner = fulfilled[0]?.status === 'fulfilled' ? fulfilled[0].value : null;
  if (winner) {
    await prisma.booking.update({ where: { id: winner.id }, data: { status: 'REJECTED' } });
    try {
      const replacement = await prisma.booking.create({
        data: {
          playerId: players[0].id,
          courtId: court.id,
          date,
          startTime,
          endTime,
          totalPrice: court.hourlyRate,
          status: 'PENDING_PAYMENT',
          expiresAt: new Date(Date.now() + 30 * 60_000),
        },
      });
      console.log('  rejection freed the slot ✔ (rebooked as ' + replacement.id + ')');
      await prisma.booking.delete({ where: { id: replacement.id } });
    } catch (error) {
      failures.push(`rejection did not free the slot: ${String(error)}`);
    }
    await prisma.booking.delete({ where: { id: winner.id } });
  }

  if (failures.length > 0) {
    console.error('\n✘ FAILED');
    failures.forEach((failure) => console.error(`  - ${failure}`));
    process.exitCode = 1;
    return;
  }

  console.log('\n✔ PASSED — the database allows exactly one live booking per court-hour.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

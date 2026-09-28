import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { decimalToNumber } from '@/lib/money';
import {
  SESSION_REUSE_WINDOW_MS,
  appBaseUrl,
  createXenditSession,
  isXenditConfigured,
  toXenditAmount,
} from '@/lib/xendit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const createSessionSchema = z.object({ groupId: z.string().cuid() });

/** Reject cross-site POSTs that smuggle the session cookie (no token scheme otherwise). */
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // Same-origin navigations/fetches may omit it.
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

/**
 * Create (or reuse) a Xendit Payment Session for a BookingGroup.
 *
 * The amount always comes from the database; the browser only names the group.
 * Returns the hosted `paymentLinkUrl` for the frontend to redirect to.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 });
  }
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Cross-site request rejected.' }, { status: 403 });
  }
  if (!isXenditConfigured()) {
    return NextResponse.json({ error: 'Online payment is not available right now.' }, { status: 503 });
  }

  let groupId: string;
  try {
    groupId = createSessionSchema.parse(await request.json()).groupId;
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const group = await prisma.bookingGroup.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      playerId: true,
      facilityId: true,
      totalPrice: true,
      status: true,
      expiresAt: true,
      player: { select: { email: true, name: true, phone: true } },
      facility: {
        select: {
          owner: { select: { name: true, xenditSubAccountId: true } },
        },
      },
    },
  });
  if (!group || (group.playerId !== session.user.id && session.user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
  }
  if (group.status === 'CONFIRMED') {
    return NextResponse.json({ error: 'This booking is already paid.' }, { status: 409 });
  }
  if (group.status === 'PENDING_VERIFICATION') {
    return NextResponse.json(
      { error: 'Your receipt is already being verified. Online payment is no longer needed.' },
      { status: 409 },
    );
  }
  if (group.status !== 'PENDING_PAYMENT') {
    return NextResponse.json(
      { error: 'This booking can no longer be paid. Please book the slots again.' },
      { status: 409 },
    );
  }
  if (group.expiresAt.getTime() <= Date.now()) {
    return NextResponse.json(
      { error: 'The payment hold expired. Please book the slots again.' },
      { status: 410 },
    );
  }

  // Reuse a fresh PENDING session so double-clicks and refreshes do not mint
  // duplicate Xendit sessions (and duplicate charges) for the same group.
  const reusable = await prisma.xenditPayment.findFirst({
    where: {
      groupId,
      status: 'PENDING',
      paymentSessionId: { not: null },
      checkoutUrl: { not: null },
      createdAt: { gt: new Date(Date.now() - SESSION_REUSE_WINDOW_MS) },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      referenceId: true,
      paymentSessionId: true,
      checkoutUrl: true,
      expiresAt: true,
      settledToOwner: true,
    },
  });
  if (reusable?.checkoutUrl) {
    logger.info('xendit.session reused', { groupId, referenceId: reusable.referenceId });
    return NextResponse.json({
      paymentLinkUrl: reusable.checkoutUrl,
      referenceId: reusable.referenceId,
      expiresAt: reusable.expiresAt?.toISOString() ?? group.expiresAt.toISOString(),
      reused: true,
      routedTo: reusable.settledToOwner ? 'owner' : 'platform',
      recipientName: group.facility?.owner?.name ?? null,
    });
  }

  // XenPlatform routing: an owner with a linked sub-account gets paid
  // directly into their own Xendit balance; everyone else settles to the
  // platform master account (existing behaviour, withdrawn manually).
  const owner = group.facility?.owner ?? null;
  const subAccountId = owner?.xenditSubAccountId ?? null;

  const base = appBaseUrl();
  try {
    const created = await createXenditSession({
      groupId,
      facilityId: group.facilityId,
      totalPrice: group.totalPrice,
      holdExpiresAt: group.expiresAt,
      customer: {
        userId: group.playerId,
        email: group.player.email,
        name: group.player.name,
        phone: group.player.phone,
      },
      successReturnUrl: `${base}/checkout/${groupId}/success`,
      cancelReturnUrl: `${base}/checkout/${groupId}`,
      subAccountId,
    });

    await prisma.xenditPayment.create({
      data: {
        groupId,
        referenceId: created.referenceId,
        paymentSessionId: created.paymentSessionId,
        checkoutUrl: created.paymentLinkUrl,
        amount: toXenditAmount(group.totalPrice),
        currency: 'PHP',
        status: 'PENDING',
        expiresAt: created.expiresAt ?? group.expiresAt,
        settledToOwner: Boolean(subAccountId),
      },
    });

    return NextResponse.json({
      paymentLinkUrl: created.paymentLinkUrl,
      referenceId: created.referenceId,
      expiresAt: (created.expiresAt ?? group.expiresAt).toISOString(),
      reused: false,
      routedTo: subAccountId ? 'owner' : 'platform',
      recipientName: owner?.name ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not start the payment. Please try again.';
    logger.error('xendit.session create failed', { groupId, userId: session.user.id });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

/**
 * Local payment status for a group — what the return page polls after the
 * customer comes back from Xendit. Local data only (webhook is the writer);
 * never treated as proof of payment for fulfilment.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 });
  }

  const groupId = new URL(request.url).searchParams.get('groupId');
  if (!groupId) return NextResponse.json({ error: 'Missing groupId.' }, { status: 400 });

  const group = await prisma.bookingGroup.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      playerId: true,
      status: true,
      totalPrice: true,
      xenditPayments: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { status: true, paymentChannel: true, paidAt: true, createdAt: true },
      },
    },
  });
  if (!group || (group.playerId !== session.user.id && session.user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
  }

  const latest = group.xenditPayments[0] ?? null;
  return NextResponse.json({
    bookingStatus: group.status,
    amount: decimalToNumber(group.totalPrice),
    currency: 'PHP',
    payment: latest
      ? { status: latest.status, channel: latest.paymentChannel, paidAt: latest.paidAt?.toISOString() ?? null }
      : null,
  });
}

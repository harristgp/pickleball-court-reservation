import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  amountsMatch,
  isValidWebhookToken,
  mapSessionOutcome,
  parseXenditWebhook,
  redactForLog,
  webhookFingerprint,
} from '@/lib/xendit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Xendit webhook — the authoritative source for payment status.
 *
 * Security: the `x-callback-token` header is verified before anything else.
 * Idempotency: every delivery is recorded in XenditWebhookEvent keyed by the
 * event id, so duplicate deliveries are acknowledged without touching state
 * twice. Serverless-safe: no in-memory state, everything in Postgres.
 *
 * Always answers 2xx once authenticity is established so Xendit stops
 * retrying events we have consciously accepted, ignored, or rejected on
 * business grounds. Only unauthenticated or unparseable payloads get 4xx.
 */
export async function POST(request: Request) {
  const token = request.headers.get('x-callback-token');
  if (!isValidWebhookToken(token)) {
    logger.warn('xendit.webhook rejected: bad or missing callback token');
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    logger.warn('xendit.webhook rejected: body is not JSON');
    return NextResponse.json({ error: 'Malformed payload.' }, { status: 400 });
  }

  const parsed = parseXenditWebhook(payload);
  if (!parsed) {
    logger.warn('xendit.webhook rejected: unrecognised payload shape');
    return NextResponse.json({ error: 'Unrecognised payload.' }, { status: 400 });
  }

  const fingerprint = webhookFingerprint(payload);
  logger.info('xendit.webhook received', {
    event: parsed.event,
    eventId: parsed.eventId,
    paymentSessionId: parsed.paymentSessionId,
    referenceId: parsed.referenceId,
    businessId: parsed.businessId,
    fingerprint,
  });

  // Record-then-process: the unique constraint on eventId is the duplicate
  // guard. A redelivery hits P2002 here and is acknowledged below.
  try {
    await prisma.xenditWebhookEvent.create({
      data: {
        eventId: parsed.eventId,
        event: parsed.event,
        paymentSessionId: parsed.paymentSessionId,
        referenceId: parsed.referenceId,
        payload: payload as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      logger.info('xendit.webhook duplicate ignored', { eventId: parsed.eventId });
      return NextResponse.json({ ok: true, deduped: true });
    }
    logger.error('xendit.webhook event-store failed', { eventId: parsed.eventId });
    return NextResponse.json({ error: 'Temporary failure.' }, { status: 500 });
  }

  const outcome = mapSessionOutcome(parsed);
  if (!outcome) {
    // Informational events (e.g. session created / still active): stored for
    // audit, nothing to apply.
    return NextResponse.json({ ok: true, ignored: true });
  }

  const payment = parsed.paymentSessionId
    ? await prisma.xenditPayment.findUnique({
        where: { paymentSessionId: parsed.paymentSessionId },
        include: { group: { select: { id: true, status: true, totalPrice: true, expiresAt: true } } },
      })
    : null;

  const byReference =
    !payment && parsed.referenceId
      ? await prisma.xenditPayment.findUnique({
          where: { referenceId: parsed.referenceId },
          include: { group: { select: { id: true, status: true, totalPrice: true, expiresAt: true } } },
        })
      : null;

  const record = payment ?? byReference;
  if (!record) {
    logger.warn('xendit.webhook unknown session', {
      event: parsed.event,
      paymentSessionId: parsed.paymentSessionId,
      referenceId: parsed.referenceId,
    });
    return NextResponse.json({ ok: true, unknown: true });
  }

  // A terminal PAID row is final: stale FAILED/EXPIRED/CANCELLED deliveries
  // must never overwrite it.
  if (record.status === 'PAID') {
    logger.info('xendit.webhook stale event for paid row ignored', {
      referenceId: record.referenceId,
      incoming: outcome,
    });
    return NextResponse.json({ ok: true, alreadyFinal: true });
  }
  if (record.status !== 'PENDING') {
    logger.info('xendit.webhook event for settled row ignored', {
      referenceId: record.referenceId,
      current: record.status,
      incoming: outcome,
    });
    return NextResponse.json({ ok: true, alreadyFinal: true });
  }

  if (outcome === 'PAID') {
    // Trust, then verify: the amount in the webhook must match what the
    // session was created for. A mismatch is never auto-fulfilled — it is
    // logged for manual reconciliation instead.
    if (!amountsMatch(record.amount, parsed.amount)) {
      logger.error('xendit.webhook amount mismatch — not fulfilling', {
        referenceId: record.referenceId,
        expected: String(record.amount),
        received: parsed.amount,
      });
      await prisma.xenditPayment.update({
        where: { id: record.id },
        data: {
          failureCode: 'AMOUNT_MISMATCH',
          paymentChannel: parsed.paymentChannel,
          paymentId: parsed.paymentId,
          paymentRequestId: parsed.paymentRequestId,
          lastWebhookId: parsed.eventId,
        },
      });
      return NextResponse.json({ ok: true, held: true });
    }

    const groupUpdatable =
      record.group.status === 'PENDING_PAYMENT' || record.group.status === 'PENDING_VERIFICATION';

    await prisma.$transaction([
      prisma.xenditPayment.update({
        where: { id: record.id },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          paymentChannel: parsed.paymentChannel,
          paymentId: parsed.paymentId,
          paymentRequestId: parsed.paymentRequestId,
          lastWebhookId: parsed.eventId,
        },
      }),
      // Only advance groups that are still awaiting payment. A hold that
      // already expired (REJECTED) keeps its status so the slots stay free;
      // the PAID row above preserves the money trail for a manual refund.
      ...(groupUpdatable
        ? [
            prisma.bookingGroup.update({
              where: { id: record.group.id },
              data: { status: 'CONFIRMED' },
            }),
            prisma.booking.updateMany({
              where: { groupId: record.group.id },
              data: { status: 'CONFIRMED' },
            }),
          ]
        : []),
    ]);

    if (!groupUpdatable) {
      logger.warn('xendit.webhook paid for non-payable group — needs manual review', {
        referenceId: record.referenceId,
        groupId: record.group.id,
        groupStatus: record.group.status,
      });
    } else {
      logger.info('xendit.webhook booking confirmed', {
        referenceId: record.referenceId,
        groupId: record.group.id,
      });
    }
    return NextResponse.json({ ok: true, status: 'PAID' });
  }

  // FAILED / EXPIRED / CANCELLED: record on the payment row, leave the group
  // alone — the player may retry until the hold sweep releases the slots.
  await prisma.xenditPayment.update({
    where: { id: record.id },
    data: {
      status: outcome,
      paymentChannel: parsed.paymentChannel,
      paymentId: parsed.paymentId,
      paymentRequestId: parsed.paymentRequestId,
      failureCode: parsed.failureCode ?? outcome,
      lastWebhookId: parsed.eventId,
    },
  });
  logger.info('xendit.webhook payment settled non-paid', {
    referenceId: redactForLog(record.referenceId),
    outcome,
  });
  return NextResponse.json({ ok: true, status: outcome });
}

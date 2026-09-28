import { createHash, timingSafeEqual } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import { decimalToNumber } from '@/lib/money';

/**
 * Xendit Payment Session integration (server-only — never import from client
 * components; the secret key must never reach the browser).
 *
 * Flow: PCourt BookingGroup -> Xendit Payment Session (`session_type: PAY`,
 * `mode: PAYMENT_LINK`, `currency: PHP`, `country: PH`) -> redirect the player
 * to `payment_link_url` -> Xendit webhook is the authoritative source of truth
 * for payment status. The browser return URL is UX only.
 *
 * Docs: https://docs.xendit.co/docs/payment-1 (one-time payment via sessions)
 */

const XENDIT_API_BASE = 'https://api.xendit.co';
const XENDIT_CURRENCY = 'PHP';
const XENDIT_COUNTRY = 'PH';

/** Reuse a still-usable PENDING session instead of minting a new one. */
export const SESSION_REUSE_WINDOW_MS = 5 * 60 * 1000;

/** Amounts are compared with a one-centavo tolerance for Decimal noise. */
const AMOUNT_TOLERANCE = 0.009;

export interface XenditCustomerInput {
  userId: string;
  email: string;
  name: string | null;
  phone: string | null;
}

export interface CreateSessionInput {
  groupId: string;
  facilityId: string | null;
  totalPrice: Prisma.Decimal | number | string;
  holdExpiresAt: Date;
  customer: XenditCustomerInput;
  successReturnUrl: string;
  cancelReturnUrl: string;
  /**
   * XenPlatform sub-account Business ID of the facility owner. When set, the
   * session is created `for-user-id` so funds settle into the owner's own
   * Xendit balance instead of the platform master account. Null = master.
   */
  subAccountId?: string | null;
  /**
   * XenPlatform split-rule ID applied via the `with-split-rule` header
   * (e.g. platform commission). Falls back to XENDIT_SPLIT_RULE_ID when omitted.
   */
  splitRuleId?: string | null;
}

export interface CreatedSession {
  referenceId: string;
  paymentSessionId: string;
  paymentLinkUrl: string;
  expiresAt: Date | null;
}

export type XenditTerminalStatus = 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED';

export interface ParsedWebhook {
  eventId: string;
  event: string;
  paymentSessionId: string | null;
  referenceId: string | null;
  /** Xendit business/account id the transaction settled under, when present. */
  businessId: string | null;
  sessionStatus: string | null;
  amount: number | null;
  currency: string | null;
  paymentId: string | null;
  paymentRequestId: string | null;
  paymentChannel: string | null;
  failureCode: string | null;
}

function getSecretKey(): string {
  const key = process.env.XENDIT_SECRET_KEY;
  if (!key) throw new Error('Xendit is not configured (XENDIT_SECRET_KEY is missing).');
  return key;
}

export function getWebhookToken(): string {
  const token = process.env.XENDIT_WEBHOOK_TOKEN;
  if (!token) throw new Error('Xendit is not configured (XENDIT_WEBHOOK_TOKEN is missing).');
  return token;
}

export function isXenditConfigured(): boolean {
  return Boolean(process.env.XENDIT_SECRET_KEY && process.env.XENDIT_WEBHOOK_TOKEN);
}

/**
 * Platform-wide XenPlatform split rule (platform commission), if configured.
 * Applied per transaction via the `with-split-rule` header. Null = no split;
 * the full settled amount stays wherever the session was routed.
 */
export function getSplitRuleId(): string | null {
  const id = process.env.XENDIT_SPLIT_RULE_ID?.trim();
  return id ? id : null;
}

/** Base URL of this deployment, used for Xendit return URLs. */
export function appBaseUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? 'http://localhost:3000';
  return url.replace(/\/$/, '');
}

/**
 * Unique merchant reference tied to the PCourt transaction. Stays within
 * Xendit's 64-char `reference_id` limit: `pcourt_<cuid>_<base36time><rand>`.
 */
export function buildReferenceId(groupId: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `pcourt_${groupId}_${Date.now().toString(36)}${rand}`.slice(0, 64);
}

/** Xendit expects a major-unit number (pesos, up to 2 decimals). */
export function toXenditAmount(totalPrice: Prisma.Decimal | number | string): number {
  const value = decimalToNumber(totalPrice);
  return Math.round(value * 100) / 100;
}

export function amountsMatch(expected: Prisma.Decimal | number | string, actual: number | null): boolean {
  if (actual === null || Number.isNaN(actual)) return false;
  return Math.abs(decimalToNumber(expected) - actual) <= AMOUNT_TOLERANCE;
}

/** Split "Juan Dela Cruz" into Xendit's given_names/surname shape. */
function splitName(fullName: string | null): { given_names: string; surname?: string } {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { given_names: 'PCourt player' };
  if (parts.length === 1) return { given_names: parts[0].slice(0, 50) };
  return {
    given_names: parts.slice(0, -1).join(' ').slice(0, 50),
    surname: parts[parts.length - 1].slice(0, 50),
  };
}

/** Only pass through plausibly-E.164 phone numbers; Xendit rejects the rest. */
function normalisePhone(phone: string | null): string | undefined {
  if (!phone) return undefined;
  const compact = phone.replace(/[\s()-]/g, '');
  return /^\+\d{7,15}$/.test(compact) ? compact : undefined;
}

function authHeader(secret: string): string {
  return `Basic ${Buffer.from(`${secret}:`).toString('base64')}`;
}

/** Redact anything that looks like a credential before it reaches the logs. */
function redactForLog(value: unknown): unknown {
  if (typeof value === 'string') {
    if (/^(xnd_|sk_|Basic )/i.test(value)) return '[redacted]';
    return value.length > 120 ? `${value.slice(0, 120)}…` : value;
  }
  if (Array.isArray(value)) return value.map(redactForLog);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (/secret|token|password|api[_-]?key|authorization|cvv|card[_-]?number/i.test(key)) {
        out[key] = '[redacted]';
      } else {
        out[key] = redactForLog(entry);
      }
    }
    return out;
  }
  return value;
}

/**
 * Create a Xendit Payment Session for a validated BookingGroup.
 * The caller must have already confirmed the group exists, the user may pay
 * it, and the amount comes from the database — never from the browser.
 */
export async function createXenditSession(input: CreateSessionInput): Promise<CreatedSession> {
  const secret = getSecretKey();
  const amount = toXenditAmount(input.totalPrice);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('That booking has an invalid amount for online payment.');
  }

  const mobileNumber = normalisePhone(input.customer.phone);
  const body: Record<string, unknown> = {
    reference_id: buildReferenceId(input.groupId),
    session_type: 'PAY',
    mode: 'PAYMENT_LINK',
    amount,
    currency: XENDIT_CURRENCY,
    country: XENDIT_COUNTRY,
    capture_method: 'AUTOMATIC',
    description: `PCourt booking ${input.groupId}`,
    customer: {
      reference_id: input.customer.userId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 50) || 'pcourtplayer',
      type: 'INDIVIDUAL',
      email: input.customer.email,
      ...(mobileNumber ? { mobile_number: mobileNumber } : {}),
      individual_detail: splitName(input.customer.name),
    },
    items: [
      {
        reference_id: input.groupId.slice(0, 64),
        name: 'Court booking',
        type: 'PHYSICAL_PRODUCT',
        category: 'SPORTS',
        net_unit_amount: amount,
        quantity: 1,
        currency: XENDIT_CURRENCY,
      },
    ],
    metadata: {
      pcourt_group_id: input.groupId,
      ...(input.facilityId ? { pcourt_facility_id: input.facilityId } : {}),
    },
    expires_at: input.holdExpiresAt.toISOString(),
    success_return_url: input.successReturnUrl,
    cancel_return_url: input.cancelReturnUrl,
  };

  const splitRuleId = input.splitRuleId ?? getSplitRuleId();
  const headers: Record<string, string> = {
    Authorization: authHeader(secret),
    'Content-Type': 'application/json',
  };
  // XenPlatform routing: transact on behalf of the owner's sub-account so the
  // money settles into their balance. Without it, funds land on the master.
  if (input.subAccountId) headers['for-user-id'] = input.subAccountId;
  if (splitRuleId) headers['with-split-rule'] = splitRuleId;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  let response: Response;
  try {
    response = await fetch(`${XENDIT_API_BASE}/sessions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    logger.error('xendit.createSession network failed', {
      groupId: input.groupId,
      error: error instanceof Error ? error.message : 'network error',
    });
    throw new Error('Could not reach the payment provider. Please try again.');
  } finally {
    clearTimeout(timeout);
  }

  const referenceId = body.reference_id as string;

  if (!response.ok) {
    let detail = `Xendit rejected the payment request (${response.status}).`;
    try {
      const data = (await response.json()) as { message?: string; error_code?: string };
      if (data?.message) detail = data.message;
      else if (data?.error_code) detail = `Payment provider error: ${data.error_code}`;
    } catch {
      // Keep the generic message; the raw body may contain provider internals.
    }
    logger.error('xendit.createSession rejected', {
      groupId: input.groupId,
      status: response.status,
      detail: redactForLog(detail),
    });
    throw new Error(detail);
  }

  const data = (await response.json()) as {
    payment_session_id?: string;
    payment_link_url?: string;
    expires_at?: string;
  };
  if (!data.payment_session_id || !data.payment_link_url) {
    logger.error('xendit.createSession malformed response', { groupId: input.groupId });
    throw new Error('The payment provider returned an unexpected response. Please try again.');
  }

  logger.info('xendit.createSession ok', {
    groupId: input.groupId,
    referenceId,
    paymentSessionId: data.payment_session_id,
    amount,
    routedTo: input.subAccountId ? 'sub-account' : 'master',
    splitApplied: Boolean(splitRuleId),
  });

  return {
    referenceId,
    paymentSessionId: data.payment_session_id,
    paymentLinkUrl: data.payment_link_url,
    expiresAt: data.expires_at ? new Date(data.expires_at) : null,
  };
}

/** Fetch the live status of a session (server-side only). */
export async function getXenditSession(
  paymentSessionId: string,
  subAccountId?: string | null,
): Promise<{
  status: string | null;
  referenceId: string | null;
  amount: number | null;
}> {
  const secret = getSecretKey();
  const headers: Record<string, string> = { Authorization: authHeader(secret) };
  // Sessions routed to an owner's sub-account must be read in that context.
  if (subAccountId) headers['for-user-id'] = subAccountId;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${XENDIT_API_BASE}/sessions/${paymentSessionId}`, {
      headers,
      signal: controller.signal,
    });
    if (!response.ok) return { status: null, referenceId: null, amount: null };
    const data = (await response.json()) as {
      status?: string;
      reference_id?: string;
      amount?: number;
    };
    return {
      status: data.status ?? null,
      referenceId: data.reference_id ?? null,
      amount: typeof data.amount === 'number' ? data.amount : null,
    };
  } catch {
    return { status: null, referenceId: null, amount: null };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Constant-time comparison of the `x-callback-token` header against the
 * configured webhook token. Fails closed when Xendit is not configured.
 */
export function isValidWebhookToken(provided: string | null): boolean {
  if (!provided) return false;
  let expected: string;
  try {
    expected = getWebhookToken();
  } catch {
    return false;
  }
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Fingerprint a webhook payload for log correlation without storing PII. */
export function webhookFingerprint(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload) ?? '').digest('hex').slice(0, 16);
}

/**
 * Normalise the several webhook shapes Xendit may deliver for a session
 * lifecycle (`payment_session.completed`, `payment_session.expired`,
 * `payment_session.canceled`, plus the nested `data` envelope variants).
 * Returns null when the payload carries no usable identifier at all.
 */
export function parseXenditWebhook(payload: unknown): ParsedWebhook | null {
  if (!payload || typeof payload !== 'object') return null;
  const root = payload as Record<string, unknown>;
  const data =
    root.data && typeof root.data === 'object' ? (root.data as Record<string, unknown>) : root;

  const str = (value: unknown): string | null =>
    typeof value === 'string' && value.length > 0 ? value : null;
  const num = (value: unknown): number | null =>
    typeof value === 'number' && Number.isFinite(value) ? value : null;

  const event = str(root.event) ?? str(root.type) ?? 'unknown';
  const eventId =
    str(root.id) ?? str(data.id) ?? str(data.payment_session_id) ?? str(data.payment_id);
  const paymentSessionId = str(data.payment_session_id) ?? str(data.session_id) ?? str(root.payment_session_id);
  const referenceId = str(data.reference_id) ?? str(root.reference_id);
  if (!eventId && !paymentSessionId && !referenceId) return null;

  return {
    eventId: eventId ?? `noid-${webhookFingerprint(payload)}`,
    event,
    paymentSessionId,
    referenceId,
    businessId: str(data.business_id) ?? str(root.business_id),
    sessionStatus: str(data.status) ?? str(root.status),
    amount: num(data.amount) ?? num(root.amount),
    currency: str(data.currency) ?? str(root.currency),
    paymentId: str(data.payment_id) ?? str(root.payment_id),
    paymentRequestId: str(data.payment_request_id) ?? str(root.payment_request_id),
    paymentChannel:
      str(data.payment_channel) ??
      str(data.channel_code) ??
      (data.payment_method && typeof data.payment_method === 'object'
        ? str((data.payment_method as Record<string, unknown>).type)
        : null),
    failureCode: str(data.failure_code) ?? str(root.failure_code),
  };
}

/**
 * Map a Xendit session outcome to our internal payment status.
 * Returns null for non-terminal / unrecognised outcomes (nothing to apply).
 */
export function mapSessionOutcome(event: ParsedWebhook): XenditTerminalStatus | null {
  const status = (event.sessionStatus ?? '').toUpperCase();
  const eventName = event.event.toLowerCase();

  if (status === 'COMPLETED' || eventName === 'payment_session.completed' || eventName === 'payment.succeeded') {
    return 'PAID';
  }
  if (status === 'EXPIRED' || eventName === 'payment_session.expired') return 'EXPIRED';
  if (status === 'CANCELED' || status === 'CANCELLED' || eventName.includes('cancel')) return 'CANCELLED';
  if (status === 'FAILED' || eventName.includes('fail')) return 'FAILED';
  return null;
}

export { redactForLog };

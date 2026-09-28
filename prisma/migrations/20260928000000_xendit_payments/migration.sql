-- Xendit Payment Session support.
--
-- BookingGroup remains the customer transaction entity with its existing
-- BookingStatus lifecycle. XenditPayment records one row per Payment Session
-- attempt; only the Xendit webhook (never the browser return URL) moves rows
-- to a terminal status. XenditWebhookEvent stores every delivery keyed by
-- Xendit's event id so duplicate deliveries are acknowledged idempotently.
-- Serverless-safe: idempotency lives in these tables, not in memory.

-- Enums
CREATE TYPE "XenditPaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED');

-- Tables
CREATE TABLE "XenditPayment" (
    "id" "TEXT" NOT NULL,
    "groupId" "TEXT" NOT NULL,
    "referenceId" "TEXT" NOT NULL,
    "paymentSessionId" "TEXT",
    "checkoutUrl" "TEXT",
    "settledToOwner" BOOLEAN NOT NULL DEFAULT false,
    "paymentId" "TEXT",
    "paymentRequestId" "TEXT",
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" "TEXT" NOT NULL DEFAULT 'PHP',
    "status" "XenditPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentChannel" "TEXT",
    "failureCode" "TEXT",
    "expiresAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "lastWebhookId" "TEXT",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XenditPayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "XenditWebhookEvent" (
    "id" "TEXT" NOT NULL,
    "eventId" "TEXT" NOT NULL,
    "event" "TEXT" NOT NULL,
    "paymentSessionId" "TEXT",
    "referenceId" "TEXT",
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XenditWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- Constraints
CREATE UNIQUE INDEX "XenditPayment_referenceId_key" ON "XenditPayment"("referenceId");
CREATE UNIQUE INDEX "XenditPayment_paymentSessionId_key" ON "XenditPayment"("paymentSessionId");
CREATE UNIQUE INDEX "XenditWebhookEvent_eventId_key" ON "XenditWebhookEvent"("eventId");

ALTER TABLE "XenditPayment" ADD CONSTRAINT "XenditPayment_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "BookingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "XenditPayment_groupId_status_idx" ON "XenditPayment"("groupId", "status");
CREATE INDEX "XenditPayment_groupId_createdAt_idx" ON "XenditPayment"("groupId", "createdAt");
CREATE INDEX "XenditPayment_status_idx" ON "XenditPayment"("status");
CREATE INDEX "XenditWebhookEvent_paymentSessionId_idx" ON "XenditWebhookEvent"("paymentSessionId");
CREATE INDEX "XenditWebhookEvent_referenceId_idx" ON "XenditWebhookEvent"("referenceId");

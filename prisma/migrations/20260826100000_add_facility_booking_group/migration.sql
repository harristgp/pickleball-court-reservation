-- Phase 1: Create Facility table
CREATE TABLE "Facility" (
  "id"          TEXT NOT NULL,
  "ownerId"     TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "address"     TEXT NOT NULL DEFAULT '',
  "city"        TEXT NOT NULL DEFAULT '',
  "latitude"    DOUBLE PRECISION,
  "longitude"   DOUBLE PRECISION,
  "photos"      TEXT[] NOT NULL DEFAULT '{}',
  "openHour"    INTEGER NOT NULL DEFAULT 6,
  "closeHour"   INTEGER NOT NULL DEFAULT 22,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Facility_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Facility_ownerId_idx" ON "Facility"("ownerId");
CREATE INDEX "Facility_isActive_idx" ON "Facility"("isActive");
CREATE INDEX "Facility_latitude_longitude_idx" ON "Facility"("latitude", "longitude");

ALTER TABLE "Facility" ADD CONSTRAINT "Facility_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Phase 2: Create BookingGroup table
CREATE TABLE "BookingGroup" (
  "id"              TEXT NOT NULL,
  "playerId"        TEXT NOT NULL,
  "facilityId"      TEXT,
  "totalPrice"      DECIMAL(10,2) NOT NULL,
  "status"          "BookingStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
  "expiresAt"       TIMESTAMP(3) NOT NULL,
  "notes"           TEXT,
  "paymentMethodId" TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BookingGroup_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BookingGroup_playerId_createdAt_idx" ON "BookingGroup"("playerId", "createdAt");
CREATE INDEX "BookingGroup_status_idx" ON "BookingGroup"("status");
CREATE INDEX "BookingGroup_expiresAt_idx" ON "BookingGroup"("expiresAt");
CREATE INDEX "BookingGroup_paymentMethodId_idx" ON "BookingGroup"("paymentMethodId");

ALTER TABLE "BookingGroup" ADD CONSTRAINT "BookingGroup_playerId_fkey"
  FOREIGN KEY ("playerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingGroup" ADD CONSTRAINT "BookingGroup_facilityId_fkey"
  FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BookingGroup" ADD CONSTRAINT "BookingGroup_paymentMethodId_fkey"
  FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Phase 3: Add facilityId to Court
DO $$ BEGIN
  ALTER TABLE "Court" ADD COLUMN "facilityId" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Create a default facility for each existing owner
INSERT INTO "Facility" ("id", "ownerId", "name", "description", "address", "city", "latitude", "longitude", "openHour", "closeHour", "isActive", "createdAt", "updatedAt")
SELECT
  'fac_' || u."id",
  u."id",
  u."name" || '''s Courts',
  NULL,
  '',
  '',
  NULL,
  NULL,
  6,
  22,
  true,
  NOW(),
  NOW()
FROM "User" u
WHERE u."role" = 'OWNER'
ON CONFLICT ("id") DO NOTHING;

-- Point each court to its owner's default facility
UPDATE "Court" c
SET "facilityId" = 'fac_' || c."ownerId";

-- Make facilityId NOT NULL
ALTER TABLE "Court" ALTER COLUMN "facilityId" SET NOT NULL;

-- Phase 4: Add groupId to Booking
DO $$ BEGIN
  ALTER TABLE "Booking" ADD COLUMN "groupId" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Phase 5: Migrate PaymentReceipt from bookingId to groupId
-- Add groupId column first
DO $$ BEGIN
  ALTER TABLE "PaymentReceipt" ADD COLUMN "groupId" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Since all existing receipts link to bookings, and we need to create groups for them,
-- we create a BookingGroup for each existing receipt's booking
INSERT INTO "BookingGroup" ("id", "playerId", "totalPrice", "status", "expiresAt", "notes", "paymentMethodId", "createdAt", "updatedAt")
SELECT
  'bg_' || b."id",
  b."playerId",
  b."totalPrice",
  b."status",
  b."expiresAt",
  b."notes",
  b."paymentMethodId",
  b."createdAt",
  b."updatedAt"
FROM "Booking" b
INNER JOIN "PaymentReceipt" pr ON pr."bookingId" = b."id"
ON CONFLICT ("id") DO NOTHING;

-- Link bookings to their new groups
UPDATE "Booking" b
SET "groupId" = 'bg_' || b."id"
FROM "PaymentReceipt" pr
WHERE pr."bookingId" = b."id";

-- Link receipts to groups
UPDATE "PaymentReceipt" pr
SET "groupId" = 'bg_' || pr."bookingId";

-- Phase 6: Drop old constraints and indexes
-- Drop PaymentReceipt.bookingId FK and unique constraint
ALTER TABLE "PaymentReceipt" DROP CONSTRAINT IF EXISTS "PaymentReceipt_bookingId_fkey";
ALTER TABLE "PaymentReceipt" DROP CONSTRAINT IF EXISTS "PaymentReceipt_bookingId_key";

-- Drop old Booking indexes that reference paymentMethodId (moved to BookingGroup)
DROP INDEX IF EXISTS "Booking_paymentMethodId_idx";

-- Drop old Court constraints
ALTER TABLE "Court" DROP CONSTRAINT IF EXISTS "Court_ownerId_name_key";
DROP INDEX IF EXISTS "Court_ownerId_idx";

-- Phase 7: Drop columns
ALTER TABLE "Court" DROP COLUMN IF EXISTS "ownerId";
ALTER TABLE "PaymentReceipt" DROP COLUMN IF EXISTS "bookingId";

-- Phase 8: Add new constraints
-- Court -> Facility FK
DO $$ BEGIN
  ALTER TABLE "Court" ADD CONSTRAINT "Court_facilityId_fkey"
    FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Booking -> BookingGroup FK
DO $$ BEGIN
  ALTER TABLE "Booking" ADD CONSTRAINT "Booking_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "BookingGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- PaymentReceipt -> BookingGroup FK
DO $$ BEGIN
  ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "BookingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Phase 9: Create new indexes
CREATE UNIQUE INDEX IF NOT EXISTS "Court_facilityId_name_key" ON "Court"("facilityId", "name");
CREATE INDEX IF NOT EXISTS "Court_facilityId_idx" ON "Court"("facilityId");
CREATE INDEX IF NOT EXISTS "Booking_groupId_idx" ON "Booking"("groupId");

-- Add BookingGroup back-reference from Facility (Prisma expects it)
-- Note: Existing Booking.expiresAt, Booking.notes, Booking.paymentMethodId columns
-- are kept in the database for safety; Prisma ignores columns not in the schema.

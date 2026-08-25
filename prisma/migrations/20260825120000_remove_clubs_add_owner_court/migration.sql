-- AlterTable: Add columns to Court for location (nullable, copied from Club)
ALTER TABLE "Court" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "Court" ADD COLUMN "longitude" DOUBLE PRECISION;

-- AlterTable: Add isActive to User
ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Step 1: Copy Club location data to Court
UPDATE "Court" SET
  "latitude" = "Club"."latitude",
  "longitude" = "Club"."longitude"
FROM "Club"
WHERE "Court"."clubId" = "Club"."id";

-- Step 2: Migrate Court.clubId → Court.ownerId
-- First add ownerId column
ALTER TABLE "Court" ADD COLUMN "ownerId" TEXT;

-- Copy ownerId from Club to Court
UPDATE "Court" SET "ownerId" = "Club"."ownerId"
FROM "Club"
WHERE "Court"."clubId" = "Club"."id";

-- Make ownerId NOT NULL after data migration
ALTER TABLE "Court" ALTER COLUMN "ownerId" SET NOT NULL;

-- Step 3: Migrate PaymentMethod.clubId → PaymentMethod.ownerId
ALTER TABLE "PaymentMethod" ADD COLUMN "ownerId" TEXT;

UPDATE "PaymentMethod" SET "ownerId" = "Club"."ownerId"
FROM "Club"
WHERE "PaymentMethod"."clubId" = "Club"."id";

ALTER TABLE "PaymentMethod" ALTER COLUMN "ownerId" SET NOT NULL;

-- Step 4: Drop old foreign keys and indexes
ALTER TABLE "PaymentMethod" DROP CONSTRAINT "PaymentMethod_clubId_fkey";
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_courtId_fkey";
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_paymentMethodId_fkey";

DROP INDEX "Court_clubId_idx";
DROP INDEX "Court_clubId_name_key";
DROP INDEX "PaymentMethod_clubId_idx";

-- Step 5: Drop old columns
ALTER TABLE "Court" DROP COLUMN "clubId";
ALTER TABLE "PaymentMethod" DROP COLUMN "clubId";

-- Step 6: Create new indexes and constraints
CREATE UNIQUE INDEX "Court_ownerId_name_key" ON "Court"("ownerId", "name");
CREATE INDEX "Court_ownerId_idx" ON "Court"("ownerId");
CREATE INDEX "Court_isActive_idx" ON "Court"("isActive");
CREATE INDEX "Court_latitude_longitude_idx" ON "Court"("latitude", "longitude");
CREATE INDEX "PaymentMethod_ownerId_idx" ON "PaymentMethod"("ownerId");

-- Step 7: Add new foreign keys
ALTER TABLE "Court" ADD CONSTRAINT "Court_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 8: Drop Club table
DROP TABLE "Club";

-- CreateIndex for User
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

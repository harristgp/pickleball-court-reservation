-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountNumber" TEXT,
    "qrCodeUrl" TEXT,
    "instructions" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "PaymentMethod_clubId_idx" ON "PaymentMethod"("clubId");

-- Add paymentMethodId column to Booking
ALTER TABLE "Booking" ADD COLUMN "paymentMethodId" TEXT;

-- CreateIndex
CREATE INDEX "Booking_paymentMethodId_idx" ON "Booking"("paymentMethodId");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Migrate existing PaymentConfiguration data into PaymentMethod
INSERT INTO "PaymentMethod" ("id", "clubId", "name", "accountName", "accountNumber", "qrCodeUrl", "instructions", "isActive", "sortOrder", "createdAt", "updatedAt")
SELECT
    "id",
    "clubId",
    'Default',
    "accountName",
    "accountNumber",
    "qrCodeUrl",
    "instructions",
    true,
    0,
    "createdAt",
    "updatedAt"
FROM "PaymentConfiguration";

-- DropForeignKey
ALTER TABLE "PaymentConfiguration" DROP CONSTRAINT "PaymentConfiguration_clubId_fkey";

-- DropTable
DROP TABLE "PaymentConfiguration";

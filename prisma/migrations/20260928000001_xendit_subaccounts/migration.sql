-- XenPlatform routing: link each court owner to their Xendit sub-account.
--
-- When User.xenditSubAccountId is set, Payment Sessions for that owner's
-- facilities are created with the `for-user-id` header so funds settle into
-- the owner's own Xendit balance (withdrawn to their bank from the Xendit
-- dashboard). Null keeps the previous behaviour: settle to the platform
-- master account. The UNIQUE constraint guarantees one owner per sub-account.

ALTER TABLE "User" ADD COLUMN "xenditSubAccountId" TEXT;

CREATE UNIQUE INDEX "User_xenditSubAccountId_key" ON "User"("xenditSubAccountId");

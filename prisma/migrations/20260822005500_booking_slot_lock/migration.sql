-- Database-level guarantee that a court cannot be double-booked.
--
-- Application checks alone cannot prevent this: two requests can both read an
-- empty slot before either writes. A partial UNIQUE index makes the second
-- INSERT fail at the storage layer no matter how the race is timed.
--
-- The predicate deliberately excludes REJECTED, which is what makes rejection
-- free the slot: flipping a booking to REJECTED removes its row from the index
-- in the same transaction, and the hour becomes bookable again with no extra
-- write and no cleanup job.
--
-- Prisma has no schema-level syntax for a partial index, so this migration is
-- hand-written and must be kept in step with ACTIVE_BOOKING_STATUSES in
-- src/lib/slots.ts.

CREATE UNIQUE INDEX "booking_active_slot_unique"
  ON "Booking" ("courtId", "startTime")
  WHERE status IN ('PENDING_PAYMENT', 'PENDING_VERIFICATION', 'CONFIRMED');

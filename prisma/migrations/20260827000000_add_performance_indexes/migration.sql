-- Performance indexes for reduced query execution times.
-- These composite indexes target the most frequent query patterns:
-- 1. BookingGroup player dashboard lookups (playerId + status)
-- 2. BookingGroup owner facility queries (facilityId + status)
-- 3. Booking date-based availability scans (date + status)

-- BookingGroup: player dashboard filtered by status (e.g. PENDING_PAYMENT count)
CREATE INDEX "BookingGroup_playerId_status_idx" ON "BookingGroup" ("playerId", "status");

-- BookingGroup: owner verify page scoped by facility and status
CREATE INDEX "BookingGroup_facilityId_status_idx" ON "BookingGroup" ("facilityId", "status");

-- Booking: availability grid lookups filtered by date and active statuses
CREATE INDEX "Booking_date_status_idx" ON "Booking" ("date", "status");

# DinkCourt — Pickleball Court Reservation SaaS

Multi-tenant court booking for clubs that get paid by QR transfer instead of by card. Players discover clubs on a
map, book an hour, upload a payment screenshot; owners verify the screenshot and approve or reject. Double-booking
is impossible because PostgreSQL refuses it, not because application code remembers to check.

**Stack:** Next.js 14 (App Router, Server Actions) · TypeScript · Tailwind CSS · Prisma 5 + PostgreSQL ·
NextAuth v5 (credentials) · react-leaflet + OpenStreetMap · lucide-react

---

## Quick start

```bash
npm install
cp .env.example .env      # then set DATABASE_URL and AUTH_SECRET
npx prisma migrate deploy
npm run seed
npm run dev
```

Open http://localhost:3000. Every seeded account uses the password `password123`:

| Role | Email |
|---|---|
| Super admin | `admin@dinkcourt.test` |
| Owner (Smash City BGC, Southbay) | `owner@smashcity.test` |
| Owner (Northside Dinks) | `owner@northsidedinks.test` |
| Player | `player@dinkcourt.test` |
| Player | `bea@dinkcourt.test` |
| Player | `caloy@dinkcourt.test` |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | `prisma generate` then a production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:reset` | Drops, re-migrates, re-seeds |
| `npm run seed` | Demo users, clubs, courts, QR codes, bookings in all four statuses |
| `npm run check:double-book` | Fires 5 concurrent bookings at one slot and asserts exactly one wins |

---

## The payment workflow

| Step | Who | What happens | Booking status |
|---|---|---|---|
| 1 | Player | Picks club → court → date → hour, hits **Book now** | `PENDING_PAYMENT` (held 30 min) |
| 2 | Player | Lands on `/checkout/[bookingId]`, sees the club's QR and instructions | `PENDING_PAYMENT` |
| 3 | Player | Uploads the payment screenshot | `PENDING_VERIFICATION` |
| 4a | Owner | Approves in `/owner/verify` | `CONFIRMED` |
| 4b | Owner | Rejects with a reason | `REJECTED` — **slot is free again** |

A hold that is never paid expires after 30 minutes. `releaseExpiredHolds()` in `src/lib/slots.ts` sweeps those rows
to `REJECTED` and runs at the top of every availability read and before every insert, so no cron job is required.

## How double-booking is prevented

The rule lives in the second migration, `prisma/migrations/*_booking_slot_lock/migration.sql`:

```sql
CREATE UNIQUE INDEX "booking_active_slot_unique"
  ON "Booking" ("courtId", "startTime")
  WHERE status IN ('PENDING_PAYMENT', 'PENDING_VERIFICATION', 'CONFIRMED');
```

Two requests that read "slot is free" at the same millisecond will both try to insert; PostgreSQL lets exactly one
through and fails the other with `P2002`, which `isSlotConflict()` turns into *"That slot was just taken."*

Because `REJECTED` rows sit outside the index predicate, rejecting a payment frees the hour with no second write.
`ACTIVE_BOOKING_STATUSES` in `src/lib/slots.ts` mirrors that predicate — change one and you must change the other.

Verify it yourself:

```bash
npm run check:double-book
```

Slots are whole hours built with `Date.UTC(...)`, so a slot key never shifts with server locale or DST.
`src/lib/dates.ts` is the only place that constructs or formats them.

---

## File storage — where `qrCodeUrl` and `screenshotUrl` come from

Uploads go through one small interface in `src/lib/storage/`:

```ts
export interface StorageDriver {
  name: string;
  put(file: File, folder: 'qr' | 'receipts'): Promise<{ url: string; key: string }>;
  /** Takes the key from put() *or* the public url it produced. */
  delete(keyOrUrl: string): Promise<void>;
}
```

Whatever `put()` returns as `url` is written verbatim into `PaymentConfiguration.qrCodeUrl` (owner's QR) or
`PaymentReceipt.screenshotUrl` (player's receipt). Both columns are plain strings, so switching providers needs no
schema change and no migration. Pick one with `STORAGE_DRIVER`:

Only the url is persisted — the key is not stored — so replacing a QR or a receipt hands the driver that url to
clean up the old file. Each driver therefore maps its own url shape back to a key: the last path segment for
UploadThing (`https://<app>.ufs.sh/f/<key>`), everything after the bucket for Supabase
(`…/object/public/<bucket>/<key>`), and the path itself for local. Cleanup is best-effort and never blocks a
booking; a driver that cannot recognise a url simply skips the delete.


### `local` (default)

```env
STORAGE_DRIVER=local
```

Writes to `public/uploads/<folder>/<uuid>.<ext>` and returns `/uploads/...`. No account, works offline. Files live
on the app server's disk, so use it for development and single-box deployments — not for serverless hosting where
the filesystem is ephemeral.

### `uploadthing`

```bash
npm i uploadthing
```

```env
STORAGE_DRIVER=uploadthing
UPLOADTHING_TOKEN=sk_live_...
```

`UTApi.uploadFiles()` returns a CDN URL that lands directly in the column. Add the host to `next.config.mjs`:

```js
images: { remotePatterns: [{ protocol: 'https', hostname: '**.ufs.sh' }] }
```

### `supabase`

```bash
npm i @supabase/supabase-js
```

```env
STORAGE_DRIVER=supabase
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_BUCKET=pickleball
```

Create a **public** bucket named to match, then `getPublicUrl()` supplies the stored URL. Add the host:

```js
images: { remotePatterns: [{ protocol: 'https', hostname: '<project>.supabase.co' }] }
```

Server-side validation is identical for every driver: `image/png`, `image/jpeg`, or `image/webp`, max 5 MB
(`src/lib/validators.ts`). Replacing a QR or a receipt deletes the previous object on a best-effort basis.

---

## Proximity search

`Club` carries `latitude`/`longitude` as `Float`. `findNearbyClubs()` in `src/lib/geo.ts` runs the Haversine
formula in PostgreSQL via `$queryRaw`, with a bounding-box prefilter so the `[latitude, longitude]` index does the
coarse work before any trigonometry:

```sql
6371 * acos(LEAST(1.0,
  cos(radians($lat)) * cos(radians(c.latitude)) *
  cos(radians(c.longitude) - radians($lng)) +
  sin(radians($lat)) * sin(radians(c.latitude))
)) AS "distanceKm"
```

`LEAST(1.0, …)` clamps float overshoot at distance zero, which would otherwise make `acos` return `NaN`.

`/discover` asks for `navigator.geolocation` on demand. Granted, it calls
`GET /api/clubs/nearby?lat=&lng=&radius=` (radius ∈ 10 / 25 / 50 km) and sorts by distance. Denied or unsupported,
it falls back to the unsorted list with an inline notice — never a blank page.

The map is `react-leaflet` 4.2.1 on CartoDB Voyager tiles, loaded through `next/dynamic` with `ssr: false` because
Leaflet touches `window` at module scope. Markers are inline-SVG `divIcon`s, which sidesteps the classic broken
default-marker-asset bug. Each popup carries the club name, court mix, starting rate, distance, and a **Book now**
link.

---

## Routes

**Player** — `/discover`, `/clubs/[id]`, `/checkout/[bookingId]`, `/dashboard`
**Owner** — `/owner`, `/owner/verify`, `/owner/courts`, `/owner/settings`
**Admin** — `/admin/clubs`

`/register` accepts club owners as well as players. An owner who signs up has no club yet, so `/owner` shows the
club setup form (name, description, address, city, coordinates) instead of the dashboard; the browser can fill the
latitude and longitude in one click. Slugs are derived from the name and de-duplicated, so two clubs may share a
name without colliding. One club per owner in this build.

`src/proxy.ts` guards them: `/admin/*` needs `SUPER_ADMIN`, `/owner/*` needs `OWNER` or `SUPER_ADMIN`,
`/dashboard` and `/checkout/*` need any session. Unauthenticated hits redirect to `/login?callbackUrl=…`. The
middleware imports `auth.config.ts` only — Prisma and bcrypt stay in `auth.ts` so the edge bundle stays clean.

Owner queries never take a club id from the request. `requireOwnedClub()` resolves the caller's own club and every
read and write hangs off that id, which is what keeps one tenant out of another tenant's data.

Sessions are JWTs, but `getCurrentUser()` re-reads the user row on every page and server action. A token minted for
a user who was since deleted stops working immediately instead of failing later at a foreign key, and a role change
takes effect without waiting for a new token.

## Environment

```env
DATABASE_URL="postgresql://user:password@localhost:5432/pickleball_reservation"
AUTH_SECRET="<openssl rand -base64 32>"
AUTH_URL="http://localhost:3000"
STORAGE_DRIVER="local"
```

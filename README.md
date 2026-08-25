# Dink Club - Pickleball Court Reservations

A single-page court booking dashboard: four courts, one-hour slots, live availability, and a mock
auth toggle that swaps between the player calendar and the admin reservation list. All data lives in
`localStorage`, so it deploys to Vercel with **zero environment variables and no database**.

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 14 (App Router) |
| Language | TypeScript, `strict` plus `noUnusedLocals` / `noUnusedParameters` |
| Styling | Tailwind CSS 3 |
| Icons | lucide-react |
| Fonts | `next/font/google` (Inter + Outfit, self-hosted at build time) |
| Persistence | `localStorage`, behind a validated read/write module |

## Features

- **Month calendar** with disabled past dates and a density dot on days that already have bookings.
- **Court picker** for all four courts, each showing live open-slot counts for the selected date.
- **Slot grid**, 6am to 10pm in one-hour blocks, with `OPEN` / `BOOKED` / `PAST` states.
- **Double-booking prevention.** Disabled buttons are only a hint; the real guard is in
  `createBooking`, which re-reads storage and re-checks the slot at save time, so a second tab
  cannot slip a booking in behind the first.
- **Reservation form** capturing name, email, phone, and skill level, with inline validation.
- **Mock auth toggle** (Player / Admin) persisted across reloads.
- **Player view**: calendar-driven booking flow plus your own upcoming and past reservations.
- **Admin view**: every reservation as a filterable list (scope, court, free-text search) with stats
  and one-click cancellation. Cancelling releases the slot immediately.
- **Cross-tab sync.** A `storage` listener plus a custom same-tab event keep every open tab current.
- **Responsive** down to 360px: the admin table becomes cards on small screens.

## Run locally

```bash
npm install
```

```bash
npm run dev
```

Open <http://localhost:3000>. Sample reservations are planted on first load; the **Reset demo**
button in the admin view restores them.

Other scripts:

```bash
npm run typecheck
```

```bash
npm run lint
```

```bash
npm run build
```

## Push to GitHub

Run these from the project root. Replace `YOUR-USERNAME` with your GitHub account.

> **Windows PowerShell 5.1 users:** run each command on its own line. The `&&` chaining
> operator is a parser error in that edition; use `;` (unconditional) or
> `cmd-a; if ($?) { cmd-b }` (on success) if you want them on one line.

```bash
git init -b main
```

```bash
git add .
```

```bash
git commit -m "Initial commit: pickleball court reservation dashboard"
```

Create the remote repository on GitHub first (empty, no README), then:

```bash
git remote add origin https://github.com/YOUR-USERNAME/pickleball-court-reservation.git
```

```bash
git push -u origin main
```

If you have the GitHub CLI installed, the last three steps collapse into one:

```bash
gh repo create pickleball-court-reservation --public --source=. --remote=origin --push
```

## Deploy to Vercel

1. Go to <https://vercel.com/new> and click **Import Git Repository**.
2. Pick `pickleball-court-reservation`.
3. Leave every field at its default. Vercel detects Next.js and uses `next build` with the
   `.next` output directory.
4. **Environment variables: none.** There is no database, no API key, and no auth provider.
5. Click **Deploy**.

Every later `git push` to `main` triggers a production deployment; pushes to any other branch get a
preview URL.

CLI alternative:

```bash
npx vercel --prod
```

## Project structure

```
.
├── next.config.mjs
├── package.json
├── postcss.config.mjs
├── tailwind.config.ts
├── tsconfig.json
└── src
    ├── app
    │   ├── globals.css
    │   ├── layout.tsx          Fonts, metadata, viewport
    │   └── page.tsx            Dashboard shell, routes between player and admin views
    ├── components
    │   ├── AdminTable.tsx      Admin list view with filters and stats
    │   ├── AuthSwitcher.tsx    Player / Admin mock auth control
    │   ├── BookingForm.tsx     Reservation form with validation
    │   ├── Calendar.tsx        Month grid date picker
    │   ├── CourtMap.tsx        Four-court selector with availability
    │   ├── SlotPicker.tsx      Hour grid for one court on one date
    │   ├── UserBookings.tsx    Player view of their own reservations
    │   └── ui.tsx              Card, badges, stat tiles, empty state
    ├── lib
    │   ├── courts.ts           Court definitions and opening hours
    │   ├── dates.ts            Local-calendar date helpers
    │   ├── demo.ts             First-run sample reservations
    │   ├── slots.ts            Slot engine and conflict detection
    │   ├── storage.ts          Validated localStorage read/write
    │   ├── useBookings.ts      Booking store hook plus a ticking clock
    │   └── useSession.ts       Mock session hook
    └── types
        └── index.ts            Booking, Court, Slot, Session interfaces
```

## Design notes

**Why the whole page is a client component.** Every view depends on `localStorage` and on the
visitor clock, neither of which exists during the build. State starts empty, real data loads in an
effect, and a skeleton covers the gap - which is what keeps the server-rendered HTML and the first
client render identical.

**Why dates are strings.** Bookings round-trip through `JSON.stringify`, so `Date` objects would
come back as strings anyway. Dates are stored as `YYYY-MM-DD` and times as integer hours, both on
the local calendar. `src/lib/dates.ts` owns every conversion, and it avoids
`toLocaleDateString` because ICU data differs between the build container and the browser.

**Why cancelled bookings are kept.** Deleting them would erase the admin audit trail. Only
`CONFIRMED` rows occupy a slot, so setting the status to `CANCELLED` is what frees the hour.

## Moving to a real database

The storage layer is the only thing to replace. Swap the four functions in `src/lib/storage.ts`
for API calls and change `useBookings` to `async`; nothing in the components reads storage directly.
Add a unique constraint on `(courtId, date, startHour)` for confirmed rows so the server enforces
what `findConflict` currently enforces on the client.

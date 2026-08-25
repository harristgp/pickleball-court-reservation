import Link from 'next/link';
import { CalendarDays, MapPin, QrCode, ShieldCheck } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { homePathForRole } from '@/auth.config';

const STEPS = [
  {
    Icon: MapPin,
    title: 'Find a court nearby',
    body: 'Share your location and see every active club within 10, 25, or 50 km, sorted by real distance.',
  },
  {
    Icon: CalendarDays,
    title: 'Pick your hour',
    body: 'A live grid of every court and every hour. Taken slots are locked at the database level, so a slot you see open is genuinely open.',
  },
  {
    Icon: QrCode,
    title: 'Pay by QR',
    body: 'Scan the club QR code in your banking app, then upload the payment screenshot as proof.',
  },
  {
    Icon: ShieldCheck,
    title: 'Get verified',
    body: 'The club reviews your receipt and confirms. Rejected payments release the slot immediately.',
  },
];

export default async function HomePage() {
  const [user, clubCount, courtCount] = await Promise.all([
    getCurrentUser(),
    prisma.club.count({ where: { isActive: true } }),
    prisma.court.count({ where: { isActive: true, club: { isActive: true } } }),
  ]);

  return (
    <div className="space-y-16">
      <section className="overflow-hidden rounded-2xl bg-zinc-900 px-6 py-16 text-center sm:px-12">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-400">Pickleball, sorted</p>
        <h1 className="mx-auto mt-3 max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Book the court. Pay by QR. Play.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-zinc-300">
          {clubCount} club{clubCount === 1 ? '' : 's'} and {courtCount} court{courtCount === 1 ? '' : 's'} taking
          reservations right now, with payment verified by the club that owns the court.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/discover"
            className="rounded-lg bg-brand-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-400"
          >
            Find courts near me
          </Link>
          <Link
            href={user ? homePathForRole(user.role) : '/register'}
            className="rounded-lg bg-white/10 px-5 py-3 text-sm font-semibold text-white ring-1 ring-inset ring-white/20 transition-colors hover:bg-white/20"
          >
            {user ? 'Go to my dashboard' : 'List your club'}
          </Link>
        </div>
      </section>

      <section>
        <h2 className="text-center text-2xl font-bold tracking-tight text-zinc-900">How a booking works</h2>
        <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ Icon, title, body }, index) => (
            <li key={title} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-card">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-600">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Step {index + 1}
                </span>
              </div>
              <h3 className="mt-4 text-sm font-semibold text-zinc-900">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{body}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

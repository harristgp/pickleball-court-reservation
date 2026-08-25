'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  LayoutGrid,
  MousePointerClick,
  Zap,
} from 'lucide-react';
import { AdminTable } from '@/components/AdminTable';
import { AuthSwitcher } from '@/components/AuthSwitcher';
import { BookingForm } from '@/components/BookingForm';
import { Calendar } from '@/components/Calendar';
import { CourtMap } from '@/components/CourtMap';
import { SlotPicker } from '@/components/SlotPicker';
import { UserBookings } from '@/components/UserBookings';
import { Card, SectionHeading } from '@/components/ui';
import { COURTS, courtById } from '@/lib/courts';
import { formatDateLong, todayKey } from '@/lib/dates';
import { buildSlots, countByDate } from '@/lib/slots';
import { useBookings, useNow } from '@/lib/useBookings';
import { useSession } from '@/lib/useSession';
import type { BookingDraft, SaveResult } from '@/types';

export default function DashboardPage() {
  const { bookings, hydrated, createBooking, cancelBooking, resetDemoData } = useBookings();
  const { session, setRole } = useSession();
  const now = useNow();

  // Set on the client only: the build container clock is not the visitor clock.
  const [today, setToday] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedCourtId, setSelectedCourtId] = useState(COURTS[0].id);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const key = todayKey();
    setToday(key);
    setSelectedDate(key);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Changing court or date invalidates whatever hour was highlighted.
  useEffect(() => {
    setSelectedHour(null);
  }, [selectedCourtId, selectedDate]);

  const counts = useMemo(() => countByDate(bookings), [bookings]);

  const slots = useMemo(() => {
    if (!selectedDate) return [];
    return buildSlots(bookings, selectedCourtId, selectedDate, now);
  }, [bookings, selectedCourtId, selectedDate, now]);

  const ready = hydrated && today !== '' && selectedDate !== '';
  const court = courtById(selectedCourtId);

  function handleSubmit(draft: BookingDraft): SaveResult {
    const result = createBooking(draft);
    if (result.ok) {
      setSelectedHour(null);
      setToast(
        `Booked ${courtById(result.booking.courtId).name} on ${formatDateLong(result.booking.date)}.`,
      );
    }
    return result;
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white shadow-sm">
              <Zap className="h-5 w-5" aria-hidden />
            </span>
            <div className="leading-tight">
              <p className="font-display text-base font-semibold text-slate-900">Dink Club</p>
              <p className="hidden text-xs text-slate-500 sm:block">Court reservations</p>
            </div>
          </div>

          <AuthSwitcher session={session} onChange={setRole} />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {toast ? (
          <p
            role="status"
            className="mb-5 flex items-start gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {toast}
          </p>
        ) : null}

        {!ready ? (
          <LoadingSkeleton />
        ) : session.role === 'ADMIN' ? (
          <Card>
            <SectionHeading
              icon={<ClipboardList className="h-4 w-4" aria-hidden />}
              title="All reservations"
              hint="Every booking across the four courts. Cancelling frees the slot straight away."
            />
            <AdminTable
              bookings={bookings}
              today={today}
              now={now}
              onCancel={cancelBooking}
              onReset={resetDemoData}
            />
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-6">
                <Card>
                  <SectionHeading
                    icon={<CalendarDays className="h-4 w-4" aria-hidden />}
                    title="Pick a date"
                    hint={formatDateLong(selectedDate)}
                  />
                  <Calendar
                    selected={selectedDate}
                    today={today}
                    counts={counts}
                    onSelect={setSelectedDate}
                  />
                </Card>

                <Card>
                  {selectedHour === null ? (
                    <div className="text-center">
                      <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-400">
                        <MousePointerClick className="h-5 w-5" aria-hidden />
                      </span>
                      <p className="font-medium text-slate-800">Choose an open hour</p>
                      <p className="mx-auto mt-1 max-w-xs text-sm text-slate-500">
                        Select a court and an available time slot to fill in your details.
                      </p>
                    </div>
                  ) : (
                    <BookingForm
                      court={court}
                      date={selectedDate}
                      hour={selectedHour}
                      session={session}
                      onSubmit={handleSubmit}
                      onClear={() => setSelectedHour(null)}
                    />
                  )}
                </Card>
              </div>

              <div className="space-y-6 lg:col-span-2">
                <Card>
                  <SectionHeading
                    icon={<LayoutGrid className="h-4 w-4" aria-hidden />}
                    title="Choose a court"
                    hint="Availability shown for the selected date."
                  />
                  <CourtMap
                    bookings={bookings}
                    date={selectedDate}
                    now={now}
                    selectedCourtId={selectedCourtId}
                    onSelect={setSelectedCourtId}
                  />
                </Card>

                <Card>
                  <SectionHeading
                    icon={<Clock3 className="h-4 w-4" aria-hidden />}
                    title={`${court.name} availability`}
                    hint={`${formatDateLong(selectedDate)} - one hour per slot`}
                  />
                  <SlotPicker
                    slots={slots}
                    selectedHour={selectedHour}
                    onSelect={setSelectedHour}
                  />
                </Card>
              </div>
            </div>

            <Card>
              <SectionHeading
                icon={<ClipboardList className="h-4 w-4" aria-hidden />}
                title="My reservations"
                hint={`Matched to ${session.email}`}
              />
              <UserBookings
                bookings={bookings}
                email={session.email}
                now={now}
                onCancel={cancelBooking}
              />
            </Card>
          </div>
        )}
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-10 text-center text-xs text-slate-400 sm:px-6">
        Reservations are stored in this browser only. Clearing site data resets the schedule.
      </footer>
    </div>
  );
}

/** Placeholder shown for the one frame between first paint and localStorage load. */
function LoadingSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-3" aria-hidden>
      <div className="h-80 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      <div className="h-80 animate-pulse rounded-2xl border border-slate-200 bg-white lg:col-span-2" />
    </div>
  );
}

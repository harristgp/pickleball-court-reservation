'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CalendarCheck, X } from 'lucide-react';
import { formatDateLong, formatSlotRange } from '@/lib/dates';
import { cx, SKILL_LABELS } from './ui';
import type { BookingDraft, Court, SaveResult, SkillLevel, Session } from '@/types';

interface BookingFormProps {
  court: Court;
  date: string;
  hour: number;
  session: Session;
  onSubmit: (draft: BookingDraft) => SaveResult;
  onClear: () => void;
}

interface Values {
  name: string;
  email: string;
  phone: string;
  skillLevel: SkillLevel | '';
}

type Errors = Partial<Record<keyof Values, string>>;

const SKILL_ORDER: SkillLevel[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PRO'];

/** Deliberately permissive: enough to catch typos, not enough to reject real addresses. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validate(values: Values): Errors {
  const errors: Errors = {};

  if (values.name.trim().length < 2) {
    errors.name = 'Enter the name the court is reserved under.';
  }
  if (!EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }
  if (values.phone.replace(/\D/g, '').length < 7) {
    errors.phone = 'Enter a phone number we can reach you on.';
  }
  if (values.skillLevel === '') {
    errors.skillLevel = 'Pick a skill level so we can match court partners.';
  }

  return errors;
}

export function BookingForm({
  court,
  date,
  hour,
  session,
  onSubmit,
  onClear,
}: BookingFormProps) {
  const [values, setValues] = useState<Values>({
    name: session.name,
    email: session.email,
    phone: session.phone,
    skillLevel: 'INTERMEDIATE',
  });
  const [errors, setErrors] = useState<Errors>({});
  const [conflict, setConflict] = useState<string | null>(null);

  // Re-prefill when the signed-in identity changes.
  useEffect(() => {
    setValues((current) => ({
      ...current,
      name: session.name,
      email: session.email,
      phone: session.phone,
    }));
  }, [session]);

  // A fresh slot clears a stale conflict warning from the previous attempt.
  useEffect(() => {
    setConflict(null);
  }, [court.id, date, hour]);

  function update<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setConflict(null);

    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const result = onSubmit({
      courtId: court.id,
      date,
      startHour: hour,
      name: values.name.trim(),
      email: values.email.trim().toLowerCase(),
      phone: values.phone.trim(),
      skillLevel: values.skillLevel as SkillLevel,
    });

    if (!result.ok) setConflict(result.error);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="rounded-xl border border-brand-200 bg-brand-50/70 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-sm font-semibold text-brand-900">
              {court.name} &middot; {formatSlotRange(hour)}
            </p>
            <p className="mt-0.5 text-xs text-brand-800/80">{formatDateLong(date)}</p>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-brand-700 transition-colors hover:bg-brand-100"
            aria-label="Clear selected slot"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <p className="mt-3 border-t border-brand-200 pt-3 text-sm text-brand-900">
          Total{' '}
          <span className="font-display text-lg font-semibold tabular-nums">
            ${court.hourlyRate}
          </span>{' '}
          <span className="text-xs text-brand-800/80">for 1 hour</span>
        </p>
      </div>

      {conflict ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2.5 text-sm text-rose-700 ring-1 ring-inset ring-rose-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {conflict}
        </p>
      ) : null}

      <TextField
        id="name"
        label="Full name"
        value={values.name}
        error={errors.name}
        autoComplete="name"
        onChange={(value) => update('name', value)}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="email"
          label="Email"
          type="email"
          value={values.email}
          error={errors.email}
          autoComplete="email"
          onChange={(value) => update('email', value)}
        />
        <TextField
          id="phone"
          label="Phone"
          type="tel"
          value={values.phone}
          error={errors.phone}
          autoComplete="tel"
          onChange={(value) => update('phone', value)}
        />
      </div>

      <div>
        <label htmlFor="skillLevel" className="mb-1.5 block text-sm font-medium text-slate-700">
          Skill level
        </label>
        <select
          id="skillLevel"
          value={values.skillLevel}
          onChange={(event) => update('skillLevel', event.target.value as SkillLevel | '')}
          aria-invalid={Boolean(errors.skillLevel)}
          className={cx(
            'w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-colors focus:ring-2',
            errors.skillLevel
              ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-200'
              : 'border-slate-300 focus:border-brand-500 focus:ring-brand-200',
          )}
        >
          <option value="">Select a level</option>
          {SKILL_ORDER.map((level) => (
            <option key={level} value={level}>
              {SKILL_LABELS[level]}
            </option>
          ))}
        </select>
        {errors.skillLevel ? (
          <p className="mt-1.5 text-xs text-rose-600">{errors.skillLevel}</p>
        ) : null}
      </div>

      <button
        type="submit"
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
      >
        <CalendarCheck className="h-4 w-4" aria-hidden />
        Confirm reservation
      </button>
    </form>
  );
}

function TextField({
  id,
  label,
  value,
  error,
  type = 'text',
  autoComplete,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  type?: string;
  autoComplete?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
        className={cx(
          'w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:ring-2',
          error
            ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-200'
            : 'border-slate-300 focus:border-brand-500 focus:ring-brand-200',
        )}
      />
      {error ? <p className="mt-1.5 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}

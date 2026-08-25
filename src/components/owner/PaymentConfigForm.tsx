'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState } from 'react-dom';
import { Check, ImageUp, Plus, QrCode, Save, Trash2, X } from 'lucide-react';
import { savePaymentMethodAction, deletePaymentMethodAction } from '@/actions/owner';
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from '@/lib/validators';
import { IDLE_ACTION_STATE } from '@/lib/types';
import { Alert, Badge, Button, Field, Input, SubmitButton, Textarea } from '@/components/ui';
import type { PaymentMethodSummary } from '@/lib/types';

export interface PaymentMethodFormDefaults {
  id: string;
  name: string;
  accountName: string;
  accountNumber: string | null;
  qrCodeUrl: string | null;
  instructions: string;
}

const FALLBACK_INSTRUCTIONS =
  'Scan the QR with your e-wallet, send the exact amount, then upload the confirmation screenshot here. Bookings are confirmed once we verify the payment.';

const COMMON_METHODS = ['GCash', 'Maya', 'BPI', 'BDO', 'Landbank', 'Other'];

export function PaymentConfigForm({ methods }: { methods: PaymentMethodFormDefaults[] }) {
  const [editing, setEditing] = useState<PaymentMethodFormDefaults | null>(null);
  const [creating, setCreating] = useState(methods.length === 0);

  const open = creating || editing !== null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-zinc-500">
          {methods.length} payment method{methods.length === 1 ? '' : 's'} · players choose which one to pay to.
        </p>
        {!open && (
          <Button onClick={() => { setEditing(null); setCreating(true); }}>
            <Plus className="h-4 w-4" aria-hidden />
            Add method
          </Button>
        )}
      </div>

      {open && (
        <MethodForm
          key={editing?.id ?? 'new'}
          defaults={editing}
          onDone={() => { setEditing(null); setCreating(false); }}
        />
      )}

      {methods.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50/60 px-6 py-12 text-center">
          <QrCode className="mb-3 h-6 w-6 text-zinc-400" aria-hidden />
          <p className="text-sm font-semibold text-zinc-800">No payment methods yet</p>
          <p className="mt-1 max-w-sm text-sm text-zinc-500">
            Add your GCash, Maya, or bank account so players can pay you.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {methods.map((method) => (
            <MethodCard
              key={method.id}
              method={method}
              onEdit={() => { setCreating(false); setEditing(method); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MethodCard({
  method,
  onEdit,
}: {
  method: PaymentMethodFormDefaults;
  onEdit: () => void;
}) {
  const [state, formAction] = useFormState(deletePaymentMethodAction, IDLE_ACTION_STATE);

  return (
    <div className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-card">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-50 ring-1 ring-zinc-200">
        {method.qrCodeUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={method.qrCodeUrl} alt={method.name} className="h-full w-full object-contain p-1" />
        ) : (
          <QrCode className="h-5 w-5 text-zinc-400" aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-zinc-900">{method.name}</p>
          <Badge tone="neutral">{method.accountNumber || 'No number'}</Badge>
        </div>
        <p className="mt-0.5 truncate text-sm text-zinc-500">{method.accountName}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
        >
          Edit
        </button>
        <form action={formAction} className="inline-flex items-center">
          <input type="hidden" name="paymentMethodId" value={method.id} />
          {state.message && <span className="text-xs text-zinc-500">{state.message}</span>}
          <SubmitButton variant="ghost" size="sm" pendingLabel="…" className="text-red-600 hover:bg-red-50">
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Remove
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}

function MethodForm({
  defaults,
  onDone,
}: {
  defaults: PaymentMethodFormDefaults | null;
  onDone: () => void;
}) {
  const [state, formAction] = useFormState(savePaymentMethodAction, IDLE_ACTION_STATE);
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sizeError, setSizeError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const shown = preview ?? defaults?.qrCodeUrl ?? null;

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-5">
      <form action={formAction} className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <input type="hidden" name="id" value={defaults?.id ?? ''} />

        <div className="space-y-3">
          <div className="flex h-52 w-52 items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-white">
            {shown ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shown} alt="Payment QR code" className="h-full w-full object-contain p-2" />
            ) : (
              <span className="flex flex-col items-center gap-2 text-zinc-400">
                <QrCode className="h-8 w-8" aria-hidden />
                <span className="text-xs">No QR yet</span>
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex w-52 items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-zinc-800 shadow-sm ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50"
          >
            <ImageUp className="h-3.5 w-3.5" aria-hidden />
            {defaults?.qrCodeUrl ? 'Replace QR image' : 'Upload QR image'}
          </button>
          <p className="w-52 text-xs text-zinc-500">
            PNG, JPEG, or WebP up to {(MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(0)} MB. Players scan this to pay you.
          </p>
          <input
            ref={inputRef}
            type="file"
            name="qrCode"
            accept={ALLOWED_IMAGE_TYPES.join(',')}
            className="sr-only"
            onChange={(event) => {
              const candidate = event.target.files?.[0] ?? null;
              if (candidate && candidate.size > MAX_UPLOAD_BYTES) {
                setSizeError('That image is larger than the 5 MB limit.');
                event.target.value = '';
                setFile(null);
                return;
              }
              setSizeError(null);
              setFile(candidate);
            }}
          />
          {sizeError && <p className="w-52 text-xs font-medium text-red-600">{sizeError}</p>}
          {state.fieldErrors?.qrCode?.length ? (
            <p className="w-52 text-xs font-medium text-red-600">{state.fieldErrors.qrCode[0]}</p>
          ) : null}
        </div>

        <div className="space-y-4">
          {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}

          <Field label="Payment method" htmlFor="name" error={state.fieldErrors?.name}>
            <div className="flex flex-wrap gap-2">
              {COMMON_METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    const input = document.getElementById('payment-method-name') as HTMLInputElement | null;
                    if (input) input.value = m;
                  }}
                  className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  {m}
                </button>
              ))}
            </div>
            <Input
              id="payment-method-name"
              name="name"
              required
              defaultValue={defaults?.name ?? ''}
              placeholder="e.g. GCash, Maya, BPI"
              maxLength={40}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Account name" htmlFor="accountName" error={state.fieldErrors?.accountName}>
              <Input
                id="accountName"
                name="accountName"
                required
                defaultValue={defaults?.accountName ?? ''}
                placeholder="Smash City Pickleball Inc."
              />
            </Field>
            <Field
              label="Account number"
              htmlFor="accountNumber"
              hint="Optional — shown next to the QR."
              error={state.fieldErrors?.accountNumber}
            >
              <Input
                id="accountNumber"
                name="accountNumber"
                defaultValue={defaults?.accountNumber ?? ''}
                placeholder="0917 000 0000"
              />
            </Field>
          </div>

          <Field
            label="Payment instructions"
            htmlFor="instructions"
            hint="Shown on the checkout page above the upload box."
            error={state.fieldErrors?.instructions}
          >
            <Textarea
              id="instructions"
              name="instructions"
              required
              rows={5}
              defaultValue={defaults?.instructions ?? FALLBACK_INSTRUCTIONS}
            />
          </Field>

          <div className="flex flex-wrap items-center gap-2">
            <SubmitButton pendingLabel="Saving…">
              <Save className="h-4 w-4" aria-hidden />
              {defaults ? 'Save changes' : 'Add payment method'}
            </SubmitButton>
            <button
              type="button"
              onClick={onDone}
              className="inline-flex h-10 items-center rounded-lg px-3 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
            >
              {state.ok ? 'Close' : 'Cancel'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState } from 'react-dom';
import { CloudUpload, FileImage, RotateCcw, ShieldCheck, X } from 'lucide-react';
import { uploadReceiptAction } from '@/actions/booking';
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from '@/lib/validators';
import { IDLE_ACTION_STATE } from '@/lib/types';
import { Alert, Field, Input, SubmitButton } from '@/components/ui';

const ACCEPT = ALLOWED_IMAGE_TYPES.join(',');

function humanSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ReceiptUploader({
  bookingId,
  amount,
  existingUrl,
}: {
  bookingId: string;
  amount: number;
  existingUrl: string | null;
}) {
  const [state, formAction] = useFormState(uploadReceiptAction, IDLE_ACTION_STATE);
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Object URLs leak until revoked, and a new one is minted per selection.
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function accept(candidate: File | undefined) {
    if (!candidate) return;
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(candidate.type)) {
      setLocalError('Upload a PNG, JPEG, or WebP screenshot.');
      return;
    }
    if (candidate.size > MAX_UPLOAD_BYTES) {
      setLocalError(`That file is ${humanSize(candidate.size)}. Maximum is ${humanSize(MAX_UPLOAD_BYTES)}.`);
      return;
    }
    setLocalError(null);
    setFile(candidate);
  }

  function clear() {
    setFile(null);
    setLocalError(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="bookingId" value={bookingId} />

      {existingUrl && !file && (
        <Alert tone="neutral">
          A receipt is already on file and waiting for the club to review it. Uploading a new image replaces it.
        </Alert>
      )}
      {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}
      {localError && <Alert tone="error">{localError}</Alert>}

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          accept(event.dataTransfer.files?.[0]);
        }}
        className={[
          'relative rounded-xl border-2 border-dashed p-5 transition-colors',
          dragging ? 'border-brand-500 bg-brand-50' : 'border-zinc-300 bg-zinc-50/60',
        ].join(' ')}
      >
        {preview ? (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Receipt preview"
              className="mx-auto max-h-72 w-auto rounded-lg object-contain shadow-card"
            />
            <div className="flex items-center justify-between gap-3 text-xs text-zinc-600">
              <span className="flex min-w-0 items-center gap-1.5">
                <FileImage className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate">{file?.name}</span>
                {file && <span className="shrink-0 text-zinc-400">({humanSize(file.size)})</span>}
              </span>
              <button
                type="button"
                onClick={clear}
                className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 font-medium text-zinc-600 hover:bg-zinc-200"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <CloudUpload className="h-8 w-8 text-zinc-400" aria-hidden />
            <p className="text-sm font-medium text-zinc-700">Drop your payment screenshot here</p>
            <p className="text-xs text-zinc-500">PNG, JPEG, or WebP · up to {humanSize(MAX_UPLOAD_BYTES)}</p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-1 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 shadow-sm ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50"
            >
              Choose file
            </button>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          name="screenshot"
          accept={ACCEPT}
          className="sr-only"
          onChange={(event) => accept(event.target.files?.[0])}
        />
      </div>

      {state.fieldErrors?.screenshot?.length ? (
        <p className="text-xs font-medium text-red-600">{state.fieldErrors.screenshot[0]}</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Reference number"
          htmlFor="referenceNumber"
          hint="Optional, but it speeds up verification."
          error={state.fieldErrors?.referenceNumber}
        >
          <Input id="referenceNumber" name="referenceNumber" placeholder="e.g. 0029 8371 2210" />
        </Field>
        <Field label="Amount sent" htmlFor="amountClaimed" error={state.fieldErrors?.amountClaimed}>
          <Input
            id="amountClaimed"
            name="amountClaimed"
            type="number"
            step="0.01"
            min="0"
            defaultValue={amount.toFixed(2)}
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton size="lg" pendingLabel="Uploading…" disabled={!file}>
          {existingUrl ? (
            <>
              <RotateCcw className="h-4 w-4" aria-hidden />
              Replace receipt
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4" aria-hidden />
              Submit for verification
            </>
          )}
        </SubmitButton>
        <p className="text-xs text-zinc-500">The club reviews it and confirms or rejects your booking.</p>
      </div>
    </form>
  );
}

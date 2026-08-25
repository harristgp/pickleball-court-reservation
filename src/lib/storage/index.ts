import { localDriver } from './local';
import { supabaseDriver } from './supabase';
import { uploadthingDriver } from './uploadthing';
import type { StorageDriver } from './types';

export type { StorageDriver, StoredFile, UploadFolder } from './types';

const DRIVERS: Record<string, StorageDriver> = {
  local: localDriver,
  uploadthing: uploadthingDriver,
  supabase: supabaseDriver,
};

/**
 * The one place the app decides where bytes go.
 *
 * Every driver returns { url, key }. The url string is what lands in
 * PaymentMethod.qrCodeUrl and PaymentReceipt.screenshotUrl. Both are
 * plain string columns, so changing STORAGE_DRIVER needs no schema change and
 * no data migration: rows written by a previous driver keep resolving because
 * they store a complete URL rather than a driver-relative path.
 */
export const storage: StorageDriver = DRIVERS[process.env.STORAGE_DRIVER ?? 'local'] ?? localDriver;

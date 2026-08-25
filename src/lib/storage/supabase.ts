import { randomUUID } from 'node:crypto';
import { extensionFor, urlPath, type StorageDriver, type StoredFile, type UploadFolder } from './types';

/**
 * Supabase Storage driver.
 *
 * Setup:
 *   1. npm i @supabase/supabase-js
 *   2. Create a project, then Storage -> New bucket -> "pickleball" -> Public
 *   3. Settings -> API -> copy URL + service_role key (server-only, never expose)
 *   4. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_BUCKET and
 *      STORAGE_DRIVER=supabase
 *
 * getPublicUrl returns a permanent https://<project>.supabase.co/... URL,
 * already allow-listed in next.config.mjs images.remotePatterns. For a private
 * bucket, swap getPublicUrl for createSignedUrl and refresh it on read.
 *
 * The client is imported lazily so the app still builds with STORAGE_DRIVER=local.
 */
export const supabaseDriver: StorageDriver = {
  name: 'supabase',

  async put(file: File, folder: UploadFolder): Promise<StoredFile> {
    const { client, bucket } = await getClient();
    const key = `${folder}/${randomUUID()}.${extensionFor(file)}`;

    const { error } = await client.storage
      .from(bucket)
      .upload(key, await file.arrayBuffer(), { contentType: file.type, upsert: false });
    if (error) throw new Error(`Supabase upload failed: ${error.message}`);

    const { data } = client.storage.from(bucket).getPublicUrl(key);
    return { url: data.publicUrl, key };
  },

  async delete(keyOrUrl: string): Promise<void> {
    const { client, bucket } = await getClient();
    const key = objectKey(keyOrUrl, bucket);
    if (!key) return;
    await client.storage.from(bucket).remove([key]);
  },
};

/**
 * Public urls look like
 * https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<folder>/<file>,
 * so the key is whatever follows the bucket name.
 */
function objectKey(keyOrUrl: string, bucket: string): string | null {
  const path = urlPath(keyOrUrl);
  if (path === null) return keyOrUrl || null;

  const marker = `/${bucket}/`;
  const at = path.indexOf(marker);
  if (at === -1) return null;
  return decodeURIComponent(path.slice(at + marker.length)) || null;
}

async function getClient(): Promise<{ client: any; bucket: string }> {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_BUCKET ?? 'pickleball';

  if (!url || !serviceKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required when STORAGE_DRIVER=supabase');
  }

  let createClient: (url: string, key: string, options?: unknown) => any;
  try {
    // Kept non-literal so the optional dependency is not required at build time.
    const specifier = '@supabase/supabase-js';
    ({ createClient } = (await import(/* webpackIgnore: true */ specifier)) as any);
  } catch {
    throw new Error('STORAGE_DRIVER=supabase requires @supabase/supabase-js. Run: npm i @supabase/supabase-js');
  }

  return {
    client: createClient(url, serviceKey, { auth: { persistSession: false } }),
    bucket,
  };
}

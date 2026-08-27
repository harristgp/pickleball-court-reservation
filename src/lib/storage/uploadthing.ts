import { extensionFor, urlPath, type StorageDriver, type StoredFile, type UploadFolder } from './types';

/**
 * UploadThing driver.
 *
 * Setup:
 *   1. npm i uploadthing
 *   2. Create an app at https://uploadthing.com/dashboard
 *   3. Put the app token in UPLOADTHING_TOKEN
 *   4. Set STORAGE_DRIVER=uploadthing
 *
 * The returned url is a ufs.sh URL, already allow-listed in next.config.mjs
 * under images.remotePatterns.
 *
 * The uploadthing package is imported lazily so the app still builds and runs
 * with STORAGE_DRIVER=local without that dependency installed.
 */
export const uploadthingDriver: StorageDriver = {
  name: 'uploadthing',

  async put(file: File, folder: UploadFolder): Promise<StoredFile> {
    const { UTApi } = await importUploadThing();
    const api = new UTApi({ token: requireToken() });

    // Prefix the name so QR codes and receipts stay distinguishable in the dashboard.
    const renamed = new File([await file.arrayBuffer()], `${folder}-${Date.now()}.${extensionFor(file)}`, {
      type: file.type,
    });

    const result = await api.uploadFiles(renamed);
    if (result.error) throw new Error(`UploadThing upload failed: ${result.error.message}`);

    return { url: result.data.ufsUrl ?? result.data.url, key: result.data.key };
  },

  async delete(keyOrUrl: string): Promise<void> {
    const key = fileKey(keyOrUrl);
    if (!key) return;
    const { UTApi } = await importUploadThing();
    await new UTApi({ token: requireToken() }).deleteFiles(key);
  },
};

/**
 * Both the current https://<appId>.ufs.sh/f/<key> urls and the legacy
 * https://utfs.io/f/<key> ones put the file key in the last path segment.
 */
function fileKey(keyOrUrl: string): string | null {
  const path = urlPath(keyOrUrl);
  if (path === null) return keyOrUrl || null;
  const segment = path.split('/').filter(Boolean).pop();
  return segment ? decodeURIComponent(segment) : null;
}

function requireToken(): string {
  const token = process.env.UPLOADTHING_TOKEN;
  if (!token) throw new Error('UPLOADTHING_TOKEN is not set but STORAGE_DRIVER=uploadthing');
  return token;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic import of optional peer dependency
async function importUploadThing(): Promise<{ UTApi: any }> {
  try {
    // The specifier goes through a variable on purpose: uploadthing is an
    // optional peer, and a literal here would make TypeScript demand the types
    // and webpack demand the module even when the driver is never selected.
    const specifier = 'uploadthing/server';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic import of optional peer dependency
    return (await import(/* webpackIgnore: true */ specifier)) as { UTApi: any };
  } catch {
    throw new Error('STORAGE_DRIVER=uploadthing requires the uploadthing package. Run: npm i uploadthing');
  }
}

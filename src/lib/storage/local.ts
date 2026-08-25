import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { extensionFor, urlPath, type StorageDriver, type StoredFile, type UploadFolder } from './types';

const PUBLIC_ROOT = path.join(process.cwd(), 'public');

/**
 * Writes into ./public/uploads/<folder>/ and serves the file back through the
 * Next static file handler. Zero configuration, works offline.
 *
 * Not suitable for serverless or multi-instance deployments: the filesystem is
 * per-instance and ephemeral. Switch STORAGE_DRIVER to uploadthing or supabase
 * before deploying to Vercel/Lambda-style infrastructure.
 */
export const localDriver: StorageDriver = {
  name: 'local',

  async put(file: File, folder: UploadFolder): Promise<StoredFile> {
    const key = `uploads/${folder}/${randomUUID()}.${extensionFor(file)}`;
    const absolute = path.join(PUBLIC_ROOT, key);

    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, Buffer.from(await file.arrayBuffer()));

    return { url: `/${key}`, key };
  },

  async delete(keyOrUrl: string): Promise<void> {
    // Accept either the stored key or the public URL it produced.
    const relative = (urlPath(keyOrUrl) ?? keyOrUrl).replace(/^\//, '');
    if (!relative.startsWith('uploads/')) return;

    // Resolve before touching the disk: a key is only ever produced by put(),
    // but this is the one place a stored string reaches unlink().
    const absolute = path.resolve(PUBLIC_ROOT, relative);
    if (!absolute.startsWith(path.join(PUBLIC_ROOT, 'uploads') + path.sep)) return;

    try {
      await unlink(absolute);
    } catch (error) {
      // A missing file is the desired end state; anything else is worth knowing.
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  },
};

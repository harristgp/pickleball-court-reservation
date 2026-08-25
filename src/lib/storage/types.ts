export type UploadFolder = 'qr' | 'receipts';

export interface StoredFile {
  /** Public URL written verbatim into qrCodeUrl / screenshotUrl. */
  url: string;
  /** Driver-specific handle used to delete the object later. */
  key: string;
}

export interface StorageDriver {
  readonly name: string;
  put(file: File, folder: UploadFolder): Promise<StoredFile>;
  /**
   * Accepts either the key returned by put() or the public url it produced.
   *
   * Only the url is persisted (qrCodeUrl / screenshotUrl), so every driver has
   * to be able to get back to its own key from that url or replaced files leak.
   */
  delete(keyOrUrl: string): Promise<void>;
}

/** Splits a stored value into its url path, or null when it is already a key. */
export function urlPath(keyOrUrl: string): string | null {
  if (!/^https?:\/\//i.test(keyOrUrl)) return null;
  try {
    return new URL(keyOrUrl).pathname;
  } catch {
    return null;
  }
}

export function extensionFor(file: File): string {
  switch (file.type) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    default: {
      const fromName = file.name.split('.').pop();
      return fromName && fromName.length <= 5 ? fromName.toLowerCase() : 'bin';
    }
  }
}

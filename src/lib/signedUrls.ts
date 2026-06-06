import { supabase } from '@/integrations/supabase/client';

// Default signed URL expiration time in seconds (1 hour)
const DEFAULT_EXPIRY = 3600;

const STORAGE_BUCKETS = ['deposit-proofs', 'payment-proofs', 'cash-signatures'] as const;

/**
 * Check if a value references one of our storage buckets (and therefore needs
 * to be signed before display).
 */
export function isStoragePath(url: string): boolean {
  return parseStoragePath(url) !== null;
}

/**
 * Extract { bucket, path } from ANY stored/displayed value that references one
 * of our buckets:
 *   - raw path:    "payment-proofs/beneficiary/<id>/qr.jpg"
 *   - public URL:  "https://x/storage/v1/object/public/payment-proofs/.../qr.jpg"
 *   - signed URL:  "https://x/storage/v1/object/sign/payment-proofs/.../qr.jpg?token=..."
 *
 * Crucially this lets us re-sign a value that was mistakenly stored as a signed
 * URL: we drop the host AND the (expiring) "?token=..." query so the path is
 * clean. Returns null when no known bucket is referenced.
 */
export function parseStoragePath(stored: string): { bucket: string; path: string } | null {
  for (const bucket of STORAGE_BUCKETS) {
    const marker = `${bucket}/`;
    const idx = stored.lastIndexOf(marker);
    if (idx !== -1) {
      const path = stored.slice(idx + marker.length).split('?')[0];
      if (path) return { bucket, path };
    }
  }
  return null;
}

/**
 * Canonical "<bucket>/<path>" form to PERSIST in the database. Accepts a raw
 * path, a public URL, or a (temporary) signed URL and strips the host + token,
 * so we never store an expiring URL. Returns the input unchanged when it does
 * not reference a known bucket (e.g. a legacy external URL).
 *
 * Use this at every write site that saves a QR / proof URL.
 */
export function toStoredPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = parseStoragePath(value);
  return parsed ? `${parsed.bucket}/${parsed.path}` : value;
}

/**
 * Heal-on-read signer: given any stored/displayed value, extract the storage
 * path and mint a FRESH signed URL with the provided client's storage. Works
 * for raw paths, public URLs and (expired) signed URLs alike, so rows that were
 * previously corrupted with a signed URL display correctly again.
 *
 * Pass `supabase.storage` for the client app, `supabaseAdmin.storage` for admin.
 */
export async function signStored(
  storage: typeof supabase.storage,
  value: string | null | undefined,
  expiresIn: number = DEFAULT_EXPIRY,
): Promise<string | null> {
  if (!value) return null;
  const parsed = parseStoragePath(value);
  if (!parsed) {
    // Unknown form: keep a usable external URL, otherwise nothing to show.
    return value.startsWith('http') ? value : null;
  }
  const { data, error } = await storage.from(parsed.bucket).createSignedUrl(parsed.path, expiresIn);
  if (error) {
    console.error('[signStored] failed to sign', parsed, error);
    return null;
  }
  return data.signedUrl;
}

/**
 * Create a signed URL for a file in a private storage bucket.
 * This provides secure, time-limited access to files.
 * 
 * @param bucket - The storage bucket name
 * @param path - The file path within the bucket
 * @param expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns The signed URL or null if creation fails
 */
export async function createSignedUrl(
  bucket: string,
  path: string,
  expiresIn: number = DEFAULT_EXPIRY
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error) {
    console.error('Error creating signed URL:', error);
    return null;
  }

  return data.signedUrl;
}

/**
 * Resolve a stored file URL to a displayable URL.
 * For storage paths, creates a signed URL. For regular URLs, returns as-is.
 * 
 * @param storedUrl - The stored URL or path
 * @param expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns The displayable URL
 */
export async function resolveFileUrl(
  storedUrl: string | null | undefined,
  expiresIn: number = DEFAULT_EXPIRY
): Promise<string | null> {
  if (!storedUrl) return null;
  
  // Check if it's a storage path
  const parsed = parseStoragePath(storedUrl);
  if (parsed) {
    return createSignedUrl(parsed.bucket, parsed.path, expiresIn);
  }
  
  // It's already a full URL (legacy data)
  return storedUrl;
}

/**
 * Resolve multiple stored file URLs to displayable URLs.
 * 
 * @param storedUrls - Array of stored URLs or paths
 * @param expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns Array of displayable URLs
 */
export async function resolveFileUrls(
  storedUrls: (string | null | undefined)[],
  expiresIn: number = DEFAULT_EXPIRY
): Promise<(string | null)[]> {
  return Promise.all(storedUrls.map(url => resolveFileUrl(url, expiresIn)));
}

/**
 * Create multiple signed URLs for files in a private storage bucket.
 * 
 * @param bucket - The storage bucket name
 * @param paths - Array of file paths within the bucket
 * @param expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns Array of signed URLs (null for any that failed)
 */
export async function createSignedUrls(
  bucket: string,
  paths: string[],
  expiresIn: number = DEFAULT_EXPIRY
): Promise<(string | null)[]> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(paths, expiresIn);

  if (error) {
    console.error('Error creating signed URLs:', error);
    return paths.map(() => null);
  }

  return data.map(item => item.signedUrl || null);
}

/**
 * Upload a file and immediately return a signed URL.
 * Useful for upload flows where we need to store and access the file.
 * 
 * @param bucket - The storage bucket name
 * @param path - The file path within the bucket
 * @param file - The file to upload
 * @param expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns Object with signedUrl and error (if any)
 */
export async function uploadAndGetSignedUrl(
  bucket: string,
  path: string,
  file: File,
  expiresIn: number = DEFAULT_EXPIRY
): Promise<{ signedUrl: string | null; error: Error | null }> {
  // Upload the file
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, file);

  if (uploadError) {
    return { signedUrl: null, error: uploadError };
  }

  // Get signed URL
  const signedUrl = await createSignedUrl(bucket, path, expiresIn);
  
  return { signedUrl, error: null };
}
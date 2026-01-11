import { supabase } from '@/integrations/supabase/client';

// Default signed URL expiration time in seconds (1 hour)
const DEFAULT_EXPIRY = 3600;

/**
 * Check if a URL is a storage path (bucket/path format) that needs signing
 */
export function isStoragePath(url: string): boolean {
  // Storage paths start with bucket names
  return url.startsWith('deposit-proofs/') || 
         url.startsWith('payment-proofs/') || 
         url.startsWith('cash-signatures/');
}

/**
 * Parse a stored path into bucket and file path
 */
export function parseStoragePath(storedPath: string): { bucket: string; path: string } | null {
  const buckets = ['deposit-proofs', 'payment-proofs', 'cash-signatures'];
  
  for (const bucket of buckets) {
    if (storedPath.startsWith(`${bucket}/`)) {
      return {
        bucket,
        path: storedPath.substring(bucket.length + 1),
      };
    }
  }
  
  return null;
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
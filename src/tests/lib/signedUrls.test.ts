import { describe, it, expect } from 'vitest';
import { parseStoragePath, toStoredPath, isStoragePath } from '@/lib/signedUrls';

// These pure helpers are the heart of the proof/QR fix: every stored value
// must resolve to a clean "<bucket>/<path>" so we can (re)sign it, and we must
// never persist a temporary signed URL. The regression we guard against:
// editing a beneficiary used to save the signed URL back into the DB, so the
// QR broke ~1h later when the token expired.

const HOST = 'https://fmhsohrgbznqmcvqktjw.supabase.co/storage/v1';

describe('parseStoragePath', () => {
  it('parses a raw stored path', () => {
    expect(parseStoragePath('payment-proofs/beneficiary/PID/123_qr.jpg')).toEqual({
      bucket: 'payment-proofs',
      path: 'beneficiary/PID/123_qr.jpg',
    });
  });

  it('parses a signed URL and DROPS the expiring token', () => {
    const signed = `${HOST}/object/sign/payment-proofs/beneficiary/PID/123_qr.jpg?token=eyJhbGciOi.JUNK`;
    expect(parseStoragePath(signed)).toEqual({
      bucket: 'payment-proofs',
      path: 'beneficiary/PID/123_qr.jpg',
    });
  });

  it('parses a public URL (public-bucket era)', () => {
    const pub = `${HOST}/object/public/deposit-proofs/UID/DID/file.png`;
    expect(parseStoragePath(pub)).toEqual({ bucket: 'deposit-proofs', path: 'UID/DID/file.png' });
  });

  it('returns null for an unrelated URL', () => {
    expect(parseStoragePath('https://example.com/some/image.png')).toBeNull();
  });
});

describe('toStoredPath (write normalization)', () => {
  it('converts a signed URL back to the durable bucket/path', () => {
    const signed = `${HOST}/object/sign/payment-proofs/beneficiary/PID/123_qr.jpg?token=ABC`;
    expect(toStoredPath(signed)).toBe('payment-proofs/beneficiary/PID/123_qr.jpg');
  });

  it('leaves a raw path unchanged', () => {
    expect(toStoredPath('payment-proofs/x/y.jpg')).toBe('payment-proofs/x/y.jpg');
  });

  it('passes through null/empty', () => {
    expect(toStoredPath(null)).toBeNull();
    expect(toStoredPath('')).toBeNull();
    expect(toStoredPath(undefined)).toBeNull();
  });

  it('leaves a non-bucket external URL unchanged', () => {
    expect(toStoredPath('https://example.com/x.png')).toBe('https://example.com/x.png');
  });
});

describe('isStoragePath', () => {
  it('is true for raw paths and storage URLs, false otherwise', () => {
    expect(isStoragePath('deposit-proofs/a/b.png')).toBe(true);
    expect(isStoragePath(`${HOST}/object/sign/payment-proofs/a/b.png?token=x`)).toBe(true);
    expect(isStoragePath('https://example.com/a.png')).toBe(false);
  });
});

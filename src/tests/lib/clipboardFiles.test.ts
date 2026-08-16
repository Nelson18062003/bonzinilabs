/**
 * Guards on the paste path. The subtle one is naming: a pasted blob carries no
 * filename, and `useAdminCreateDeposit` builds its storage key from
 * `file.name.split('.').pop()` — an anonymous blob would produce a broken path.
 */
import { describe, it, expect } from 'vitest';
import {
  toUploadFile,
  partitionUploadFiles,
  rejectionMessage,
  isSupportedUploadType,
} from '@/lib/clipboardFiles';

const AT = new Date(2026, 7, 16, 14, 23, 5); // 2026-08-16 14:23:05

describe('toUploadFile', () => {
  it('names an anonymous clipboard blob with a real extension', () => {
    const file = toUploadFile(new Blob(['x'], { type: 'image/png' }), 0, AT);
    expect(file.name).toBe('colle_2026-08-16_14-23-05.png');
    expect(file.type).toBe('image/png');
  });

  it('renames Chrome\'s generic "image.png" — the user never chose that name', () => {
    const pasted = new File(['x'], 'image.png', { type: 'image/png' });
    expect(toUploadFile(pasted, 0, AT).name).toBe('colle_2026-08-16_14-23-05.png');
  });

  it('preserves a real filename picked from disk', () => {
    const picked = new File(['x'], 'recu-banque.pdf', { type: 'application/pdf' });
    expect(toUploadFile(picked, 0, AT).name).toBe('recu-banque.pdf');
  });

  it('keeps several blobs pasted in the same second distinct', () => {
    const a = toUploadFile(new Blob(['a'], { type: 'image/png' }), 0, AT);
    const b = toUploadFile(new Blob(['b'], { type: 'image/png' }), 1, AT);
    expect(a.name).not.toBe(b.name);
  });

  it('always produces a name with an extension the storage path can split', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp', 'application/pdf']) {
      const name = toUploadFile(new Blob(['x'], { type }), 0, AT).name;
      expect(name.split('.').pop()).toMatch(/^[a-z]+$/);
    }
  });
});

describe('partitionUploadFiles', () => {
  const png = (size: number) => new File([new Uint8Array(size)], 'a.png', { type: 'image/png' });

  it('accepts the four types storage actually allows', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']) {
      expect(isSupportedUploadType(type)).toBe(true);
    }
    expect(isSupportedUploadType('image/heic')).toBe(false);
  });

  it('rejects an unsupported type at the edge rather than mid-upload', () => {
    const heic = new File(['x'], 'IMG.heic', { type: 'image/heic' });
    const { accepted, rejected } = partitionUploadFiles([heic]);
    expect(accepted).toHaveLength(0);
    expect(rejected[0].reason).toBe('type');
  });

  it('rejects a file over the 10 Mo cap', () => {
    const { accepted, rejected } = partitionUploadFiles([png(11 * 1024 * 1024)]);
    expect(accepted).toHaveLength(0);
    expect(rejected[0].reason).toBe('size');
  });

  it('lets the good files through when only some are bad', () => {
    const good = png(1024);
    const bad = new File(['x'], 'x.heic', { type: 'image/heic' });
    const { accepted, rejected } = partitionUploadFiles([good, bad]);
    expect(accepted).toEqual([good]);
    expect(rejected).toHaveLength(1);
  });
});

describe('rejectionMessage', () => {
  it('is silent when nothing was refused', () => {
    expect(rejectionMessage([])).toBeNull();
  });

  it('names the offending file when there is exactly one', () => {
    const file = new File(['x'], 'IMG.heic', { type: 'image/heic' });
    expect(rejectionMessage([{ file, reason: 'type' }])).toContain('IMG.heic');
  });

  it('mentions the 10 Mo limit on an oversize refusal', () => {
    const file = new File(['x'], 'big.png', { type: 'image/png' });
    expect(rejectionMessage([{ file, reason: 'size' }])).toContain('10 Mo');
  });
});

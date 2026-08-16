/**
 * Clipboard → File plumbing shared by every upload zone (dépôts & paiements).
 *
 * Admins live on screenshots: they capture an Alipay/WeChat QR or a bank
 * confirmation with Win+Shift+S / Cmd+Ctrl+Shift+4 and expect to drop it
 * straight into the form. Before this helper the only way in was the OS file
 * picker — the screenshot had to be saved to disk first, which is the single
 * most repeated friction point in the admin app.
 *
 * Two independent entry points, because browsers expose two very different
 * clipboard APIs:
 *
 *   1. `filesFromDataTransfer` — the *event* path (Ctrl+V, right-click ▸ Paste,
 *      drag & drop). Works everywhere, no permission prompt, but only fires
 *      inside a real user paste/drop event.
 *   2. `readClipboardFiles` — the *async* path (`navigator.clipboard.read()`),
 *      behind a "Coller" button. Needed on touch devices where there is no
 *      Ctrl+V, and as a fallback when the user's paste lands on a target that
 *      swallows the event. Requires a secure context + user permission.
 *
 * Both funnel through `toUploadFile` so a pasted blob — which carries **no
 * filename at all** — comes out with a real, sanitized, extension-bearing name.
 * That matters downstream: deposit proof paths are built with
 * `file.name.split('.').pop()`, so a nameless blob would produce a broken
 * storage key.
 */

import { ALLOWED_UPLOAD_MIME_TYPES, MAX_UPLOAD_FILE_SIZE } from '@/lib/utils';

/**
 * `accept` for every upload input in the app.
 *
 * Kept in lockstep with `ALLOWED_UPLOAD_MIME_TYPES`: an input advertising
 * `image/*` lets the OS picker offer HEIC and GIF that `partitionUploadFiles`
 * then refuses — the user picks a file and is told no, instead of the picker
 * greying it out up front.
 */
export const ACCEPT_UPLOAD = 'image/jpeg,image/png,image/webp,application/pdf';

/** `accept` for image-only slots (QR codes). */
export const ACCEPT_IMAGE = 'image/jpeg,image/png,image/webp';

/** MIME → extension for the names we mint for pasted blobs. */
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
};

/** `2026-08-16_14-23-05` — sortable, filesystem-safe, readable in the proof list. */
function stamp(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}` +
    `_${p(now.getHours())}-${p(now.getMinutes())}-${p(now.getSeconds())}`
  );
}

/**
 * Wrap a clipboard/drop blob into a `File` that always has a usable name.
 *
 * Files coming from the OS picker already have one and keep it. Clipboard
 * blobs are named `colle_<horodatage>[-n].<ext>` so several screenshots pasted
 * in a row never collide and stay readable in the proof gallery.
 */
export function toUploadFile(blob: Blob | File, index = 0, now = new Date()): File {
  const existingName = blob instanceof File ? blob.name : '';
  // Chrome hands pasted images over as a File literally named "image.png".
  // That is not a name a human chose — treat it as anonymous and re-mint it.
  const isAnonymous =
    !existingName || existingName === 'image.png' || existingName === 'blob' || !existingName.includes('.');

  if (!isAnonymous) return blob as File;

  const ext = EXT_BY_MIME[blob.type] ?? (blob.type.startsWith('image/') ? blob.type.slice(6) : 'bin');
  const suffix = index > 0 ? `-${index + 1}` : '';
  return new File([blob], `colle_${stamp(now)}${suffix}.${ext}`, {
    type: blob.type,
    lastModified: now.getTime(),
  });
}

/** Types we are willing to pull off the clipboard, in priority order. */
const PASTE_PRIORITY = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];

/** `true` when the MIME type is one the storage layer will actually accept. */
export function isSupportedUploadType(type: string): boolean {
  return ALLOWED_UPLOAD_MIME_TYPES.includes(type);
}

/**
 * Pull every usable file out of a paste event's or a drop event's DataTransfer.
 *
 * Returns `[]` when the clipboard only holds text — the caller must treat that
 * as "not for me" and let the browser perform its normal text paste.
 */
export function filesFromDataTransfer(dt: DataTransfer | null, now = new Date()): File[] {
  if (!dt) return [];

  const out: File[] = [];

  // `dt.files` is the reliable path for drops and for most paste sources.
  for (const file of Array.from(dt.files)) {
    if (file.size > 0) out.push(file);
  }

  // Some browsers only expose a pasted screenshot through `items`, never
  // through `files`. Walk them too, skipping anything already collected.
  if (out.length === 0 && dt.items) {
    for (const item of Array.from(dt.items)) {
      if (item.kind !== 'file') continue;
      const file = item.getAsFile();
      if (file && file.size > 0) out.push(file);
    }
  }

  return out.map((file, i) => toUploadFile(file, i, now));
}

/** Outcome of an explicit "Coller" tap — distinguishes the failure modes. */
export type ClipboardReadResult =
  | { ok: true; files: File[] }
  | { ok: false; reason: 'unsupported' | 'denied' | 'empty' };

/** `true` when `navigator.clipboard.read()` exists in this browser/context. */
export function canReadClipboard(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.clipboard?.read;
}

/**
 * Read image/PDF items straight from the system clipboard.
 *
 * Backs the "Coller" button: the async Clipboard API is the only way to reach
 * the clipboard without a paste event, which is what makes the feature usable
 * on a phone or tablet where Ctrl+V does not exist.
 */
export async function readClipboardFiles(now = new Date()): Promise<ClipboardReadResult> {
  if (!canReadClipboard()) return { ok: false, reason: 'unsupported' };

  let items: ClipboardItem[];
  try {
    items = await navigator.clipboard.read();
  } catch {
    // Permission refused, insecure context, or an empty clipboard on Safari —
    // all indistinguishable here, and all mean "ask the user to click instead".
    return { ok: false, reason: 'denied' };
  }

  const files: File[] = [];
  for (const item of items) {
    const type =
      PASTE_PRIORITY.find((candidate) => item.types.includes(candidate)) ??
      item.types.find((candidate) => candidate.startsWith('image/'));
    if (!type) continue;
    try {
      const blob = await item.getType(type);
      if (blob.size > 0) files.push(toUploadFile(blob, files.length, now));
    } catch {
      // A single unreadable item must not sink the whole paste.
    }
  }

  return files.length > 0 ? { ok: true, files } : { ok: false, reason: 'empty' };
}

/** A file rejected by `partitionUploadFiles`, with the reason to show the user. */
export interface RejectedFile {
  file: File;
  reason: 'type' | 'size';
}

/**
 * Split incoming files into what storage will take and what it will refuse.
 *
 * Filtering here — at the edge, before any state is set — means a 30 MB PDF or
 * a `.heic` from an iPhone produces one clear French toast instead of a failed
 * upload three clicks later.
 */
export function partitionUploadFiles(files: File[]): { accepted: File[]; rejected: RejectedFile[] } {
  const accepted: File[] = [];
  const rejected: RejectedFile[] = [];

  for (const file of files) {
    if (!isSupportedUploadType(file.type)) rejected.push({ file, reason: 'type' });
    else if (file.size > MAX_UPLOAD_FILE_SIZE) rejected.push({ file, reason: 'size' });
    else accepted.push(file);
  }

  return { accepted, rejected };
}

/** One-line French summary of what was refused, ready for `toast.error`. */
export function rejectionMessage(rejected: RejectedFile[]): string | null {
  if (rejected.length === 0) return null;

  const badType = rejected.filter((r) => r.reason === 'type');
  const tooBig = rejected.filter((r) => r.reason === 'size');

  if (badType.length > 0 && tooBig.length === 0) {
    return badType.length === 1
      ? `« ${badType[0].file.name} » : format non accepté (JPG, PNG, WebP ou PDF).`
      : `${badType.length} fichiers ignorés : format non accepté (JPG, PNG, WebP ou PDF).`;
  }
  if (tooBig.length > 0 && badType.length === 0) {
    return tooBig.length === 1
      ? `« ${tooBig[0].file.name} » dépasse 10 Mo.`
      : `${tooBig.length} fichiers ignorés : plus de 10 Mo.`;
  }
  return `${rejected.length} fichiers ignorés (format non accepté ou plus de 10 Mo).`;
}

/** Human-readable size — pasted screenshots are usually a few hundred Ko. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

/**
 * Stable object URLs for staged (not-yet-uploaded) files.
 *
 * Split out of the component that uses it so the preview thumbnails file stays
 * a pure component module (Fast Refresh only works when a file exports nothing
 * but components).
 */

import { useEffect, useMemo } from 'react';

/**
 * One blob URL per image file, revoked when the list changes or on unmount.
 * Non-images map to `null` so callers can render a document glyph instead.
 *
 * The screens this replaces called `URL.createObjectURL(file)` inline in JSX,
 * minting a fresh URL on every render and revoking none of them.
 */
export function useFilePreviews(files: File[]): (string | null)[] {
  const urls = useMemo(
    () => files.map((file) => (file.type.startsWith('image/') ? URL.createObjectURL(file) : null)),
    [files],
  );

  useEffect(
    () => () => {
      for (const url of urls) if (url) URL.revokeObjectURL(url);
    },
    [urls],
  );

  return urls;
}

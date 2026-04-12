import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface UtmParams {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
}

const STORAGE_KEY = 'bonzini_utm';
const UTM_KEYS: Array<keyof UtmParams> = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
];

/**
 * Hook to call inside a component that lives within <BrowserRouter>.
 * Reads UTM params from the URL on first mount and writes them to localStorage.
 * First-touch attribution: never overwrites an existing stored value.
 */
export function useCaptureUtm(): void {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const incoming: Partial<UtmParams> = {};
    let hasUtm = false;

    for (const key of UTM_KEYS) {
      const val = searchParams.get(key);
      if (val) {
        incoming[key] = val;
        hasUtm = true;
      }
    }

    if (!hasUtm) return;

    // First-touch: only write if nothing stored yet
    const existing = localStorage.getItem(STORAGE_KEY);
    if (!existing) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(incoming));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * Read UTM params previously stored by useCaptureUtm.
 * Returns null if no UTM data is in localStorage.
 */
export function getStoredUtm(): UtmParams | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UtmParams>;
    return {
      utm_source:   parsed.utm_source   ?? null,
      utm_medium:   parsed.utm_medium   ?? null,
      utm_campaign: parsed.utm_campaign ?? null,
      utm_content:  parsed.utm_content  ?? null,
      utm_term:     parsed.utm_term     ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Clear stored UTM params from localStorage.
 * Call this after a successful signup so stale attribution data is not reused.
 */
export function clearStoredUtm(): void {
  localStorage.removeItem(STORAGE_KEY);
}

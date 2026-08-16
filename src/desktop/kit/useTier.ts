/**
 * Which width tier the viewport is in, and its live width.
 *
 * `useIsDesktop` answers one boolean — mobile or not — which is why a 13" laptop
 * and a 34" ultrawide currently render identically. This is the finer-grained
 * question the desktop layout actually needs.
 */

import { useEffect, useState } from 'react';
import { tierFor, type Tier } from './tokens';

export function useTier(): { tier: Tier; viewportWidth: number } {
  const [width, setWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1440,
  );

  useEffect(() => {
    // A plain resize listener rather than three matchMedia queries: the
    // Inspector needs the actual pixel width to decide whether it can dock, not
    // just which bucket it falls in.
    let frame = 0;
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setWidth(window.innerWidth));
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return { tier: tierFor(width), viewportWidth: width };
}

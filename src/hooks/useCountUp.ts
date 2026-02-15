import { useState, useEffect, useRef } from 'react';

interface UseCountUpOptions {
  duration?: number;
  enabled?: boolean;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function useCountUp(target: number, options?: UseCountUpOptions): number {
  const { duration = 600, enabled = true } = options || {};
  const [current, setCurrent] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setCurrent(0);
      return;
    }

    if (target === fromRef.current) return;

    const from = fromRef.current;
    fromRef.current = target;
    startRef.current = null;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const animate = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      const value = Math.round(from + (target - from) * eased);

      setCurrent(value);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, enabled]);

  return current;
}

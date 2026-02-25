// ============================================================
// LIQUID GLASS NAVIGATION BAR
// Shared component for client + admin bottom navigation
// ============================================================
import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useLocation, matchPath } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { LiquidTabBarProps } from './types';

export function LiquidTabBar({ items, className }: LiquidTabBarProps) {
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0 });
  const [pillVisible, setPillVisible] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [bouncingIndex, setBouncingIndex] = useState(-1);
  const prevActiveRef = useRef(-1);
  const mountedRef = useRef(false);

  // ── Determine active tab from route ──────────────────────────
  const activeIndex = useMemo(() => {
    return items.findIndex((item) =>
      matchPath(
        { path: item.to, end: item.end ?? false },
        location.pathname,
      ) !== null,
    );
  }, [items, location.pathname]);

  // ── Measure tab positions ────────────────────────────────────
  const measure = useCallback(() => {
    if (!containerRef.current || activeIndex < 0) return;
    const container = containerRef.current.getBoundingClientRect();
    const tab = tabRefs.current[activeIndex];
    if (!tab) return;
    const tabRect = tab.getBoundingClientRect();
    setPillStyle({
      left: tabRect.left - container.left,
      width: tabRect.width,
    });
  }, [activeIndex]);

  // ── Initial measurement (after first paint) ──────────────────
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      measure();
      setPillVisible(true);
      mountedRef.current = true;
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Re-measure + animate on active tab change ────────────────
  useEffect(() => {
    measure();

    if (mountedRef.current && prevActiveRef.current !== activeIndex && activeIndex >= 0) {
      setIsMoving(true);
      setBouncingIndex(activeIndex);
      const timer = setTimeout(() => setBouncingIndex(-1), 450);
      prevActiveRef.current = activeIndex;
      return () => { clearTimeout(timer); };
    }

    prevActiveRef.current = activeIndex;
    return undefined;
  }, [activeIndex, measure]);

  // ── Debounced resize handler ─────────────────────────────────
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(measure, 100);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      clearTimeout(timeoutId);
    };
  }, [measure]);

  return (
    <nav className={cn('liquid-nav', className)} aria-label="Navigation principale">
      {/* Glass overlays */}
      <div className="liquid-nav-noise" aria-hidden="true" />
      <div className="liquid-nav-tint" aria-hidden="true" />

      {/* Animated pill */}
      {activeIndex >= 0 && (
        <div
          className={cn('liquid-pill-track', isMoving && 'liquid-pill-moving')}
          style={{
            transform: `translateX(${pillStyle.left}px)`,
            width: `${pillStyle.width}px`,
            opacity: pillVisible ? 1 : 0,
          }}
          aria-hidden="true"
          onTransitionEnd={() => setIsMoving(false)}
        >
          <div className="liquid-pill-body" />
        </div>
      )}

      {/* Tab items */}
      <div ref={containerRef} className="flex items-center justify-around relative py-1.5">
        {items.map((item, i) => (
          <Link
            key={item.to}
            to={item.to}
            ref={(el) => { tabRefs.current[i] = el; }}
            className={cn(
              'liquid-tab',
              i === activeIndex && 'liquid-tab-active',
              i === bouncingIndex && 'liquid-tab-bounce',
            )}
            aria-current={i === activeIndex ? 'page' : undefined}
          >
            <item.icon className="liquid-tab-icon" />
            <span className="liquid-tab-label">{item.label}</span>
            {item.badgeCount != null && item.badgeCount > 0 && (
              <span className="liquid-badge liquid-badge-enter">
                {item.badgeCount > 9 ? '9+' : item.badgeCount}
              </span>
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
}

import * as React from "react";

/** Desktop admin kicks in at Tailwind's `lg` breakpoint. */
const DESKTOP_BREAKPOINT = 1024;

/**
 * True when the viewport is wide enough for the dedicated desktop admin
 * (`src/desktop`). Below this, the mobile admin (`src/mobile`) is used.
 *
 * Initialised synchronously from `window.innerWidth` (the app is a client-only
 * SPA) so the very first paint already picks the right shell — no mobile→desktop
 * flash on load.
 */
export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = React.useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth >= DESKTOP_BREAKPOINT : false,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);
    const onChange = () => setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT);
    mql.addEventListener("change", onChange);
    onChange();
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isDesktop;
}

import { ReactNode } from 'react';
import { useIsDesktop } from '@/hooks/use-desktop';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ProtectedAdminRoute } from '@/components/admin/ProtectedAdminRoute';
import { MobileRouteWrapper } from '@/mobile/components/MobileRouteWrapper';
import { DesktopAppShell } from './layout/DesktopAppShell';

interface AdminRouteWrapperProps {
  /** The mobile screen for this route (always required). */
  children: ReactNode;
  /** The dedicated desktop screen, when one has been built for this route. */
  desktop?: ReactNode;
  requireAuth?: boolean;
  showTabBar?: boolean;
}

/**
 * Viewport-aware wrapper for admin routes. Above `lg` it renders the dedicated
 * desktop app (sidebar shell + the `desktop` screen); below `lg`, or for the
 * unauthenticated login screen, it falls back to the existing mobile shell.
 *
 * Routes that don't yet have a desktop screen simply omit `desktop` — the mobile
 * screen is then shown centred inside the desktop chrome until it's migrated.
 */
export function AdminRouteWrapper({
  children,
  desktop,
  requireAuth = true,
  showTabBar = true,
}: AdminRouteWrapperProps) {
  const isDesktop = useIsDesktop();

  if (isDesktop && requireAuth) {
    return (
      <ErrorBoundary>
        <ProtectedAdminRoute>
          <DesktopAppShell>
            {desktop ?? <div className="mx-auto max-w-2xl">{children}</div>}
          </DesktopAppShell>
        </ProtectedAdminRoute>
      </ErrorBoundary>
    );
  }

  return (
    <MobileRouteWrapper requireAuth={requireAuth} showTabBar={showTabBar}>
      {children}
    </MobileRouteWrapper>
  );
}

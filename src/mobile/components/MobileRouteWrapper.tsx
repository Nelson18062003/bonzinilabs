import { ReactNode } from 'react';
import { ProtectedAdminRoute } from '@/components/admin/ProtectedAdminRoute';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { MobileAppShell } from './layout/MobileAppShell';

interface MobileRouteWrapperProps {
  children: ReactNode;
  requireAuth?: boolean;
  showTabBar?: boolean;
}

/**
 * Wrapper for mobile admin routes.
 * Auth context (AdminAuthProvider) is mounted once at the app shell in
 * App.tsx so navigation does not remount the provider on every route change.
 */
export function MobileRouteWrapper({
  children,
  requireAuth = true,
  showTabBar = true,
}: MobileRouteWrapperProps) {
  return (
    <ErrorBoundary>
      {requireAuth ? (
        <ProtectedAdminRoute>
          <MobileAppShell showTabBar={showTabBar}>{children}</MobileAppShell>
        </ProtectedAdminRoute>
      ) : (
        <MobileAppShell showTabBar={false}>{children}</MobileAppShell>
      )}
    </ErrorBoundary>
  );
}

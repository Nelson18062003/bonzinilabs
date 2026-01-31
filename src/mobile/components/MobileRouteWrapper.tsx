import { ReactNode } from 'react';
import { AdminAuthProvider } from '@/contexts/AdminAuthContext';
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
 * Provides AdminAuthProvider context, authentication protection,
 * and the mobile app shell with tab bar.
 */
export function MobileRouteWrapper({
  children,
  requireAuth = true,
  showTabBar = true
}: MobileRouteWrapperProps) {
  return (
    <AdminAuthProvider>
      <ErrorBoundary>
        {requireAuth ? (
          <ProtectedAdminRoute>
            <MobileAppShell showTabBar={showTabBar}>
              {children}
            </MobileAppShell>
          </ProtectedAdminRoute>
        ) : (
          <MobileAppShell showTabBar={false}>
            {children}
          </MobileAppShell>
        )}
      </ErrorBoundary>
    </AdminAuthProvider>
  );
}

import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { AdminAuthProvider, useAdminAuth } from '@/contexts/AdminAuthContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AgentCashShell } from './AgentCashShell';
import { Loader2 } from 'lucide-react';

interface AgentCashRouteWrapperProps {
  children: ReactNode;
  requireAuth?: boolean;
  showTabBar?: boolean;
}

function ProtectedAgentCashRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, currentUser } = useAdminAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/a/login" replace />;
  }

  // Only cash_agent role allowed
  if (currentUser?.role !== 'cash_agent') {
    return <Navigate to="/a/login" replace />;
  }

  return <>{children}</>;
}

export function AgentCashRouteWrapper({
  children,
  requireAuth = true,
  showTabBar = true,
}: AgentCashRouteWrapperProps) {
  return (
    <AdminAuthProvider>
      <LanguageProvider>
        <ErrorBoundary onError={(error, info) => console.error('[AgentCash] Route error:', error.message, error.stack, info.componentStack)}>
          {requireAuth ? (
            <ProtectedAgentCashRoute>
              <AgentCashShell showTabBar={showTabBar}>
                {children}
              </AgentCashShell>
            </ProtectedAgentCashRoute>
          ) : (
            <AgentCashShell showTabBar={false}>
              {children}
            </AgentCashShell>
          )}
        </ErrorBoundary>
      </LanguageProvider>
    </AdminAuthProvider>
  );
}

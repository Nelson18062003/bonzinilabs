import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAgentAuth } from '@/contexts/AgentAuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedAgentRouteProps {
  children: ReactNode;
}

export function ProtectedAgentRoute({ children }: ProtectedAgentRouteProps) {
  const { user, loading, isCashAgent } = useAgentAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/agent/login" replace />;
  }

  if (!isCashAgent) {
    return <Navigate to="/agent/login" replace />;
  }

  return <>{children}</>;
}

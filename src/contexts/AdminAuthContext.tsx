import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AdminUser, AdminRole, ROLE_PERMISSIONS, RolePermission, AdminLogEntry, AdminActionType } from '@/types/admin';
import { adminUsers as mockAdminUsers } from '@/data/adminMockData';

interface AdminAuthContextType {
  currentUser: AdminUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  permissions: RolePermission | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  hasPermission: (permission: keyof RolePermission) => boolean;
  logAction: (actionType: AdminActionType, targetType: AdminLogEntry['targetType'], description: string, targetId?: string, metadata?: Record<string, any>) => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

// Mock credentials for demo
const MOCK_CREDENTIALS: Record<string, string> = {
  'admin@bonzini.com': 'admin123',
  'ops@bonzini.com': 'ops123',
  'support@bonzini.com': 'support123',
  'account@bonzini.com': 'account123',
};

const SESSION_KEY = 'bonzini_admin_session';

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLogs, setActionLogs] = useState<AdminLogEntry[]>([]);

  // Check for existing session on mount
  useEffect(() => {
    const savedSession = localStorage.getItem(SESSION_KEY);
    if (savedSession) {
      try {
        const sessionData = JSON.parse(savedSession);
        const user = mockAdminUsers.find(u => u.id === sessionData.userId && u.isActive);
        if (user) {
          setCurrentUser(user);
        } else {
          localStorage.removeItem(SESSION_KEY);
        }
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const normalizedEmail = email.toLowerCase().trim();
    
    // Check credentials
    if (MOCK_CREDENTIALS[normalizedEmail] !== password) {
      return { success: false, error: 'Email ou mot de passe incorrect' };
    }

    // Find user
    const user = mockAdminUsers.find(u => u.email.toLowerCase() === normalizedEmail);
    if (!user) {
      return { success: false, error: 'Utilisateur non trouvé' };
    }

    if (!user.isActive) {
      return { success: false, error: 'Ce compte est désactivé' };
    }

    // Save session
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id, loginAt: new Date().toISOString() }));
    setCurrentUser({ ...user, lastLogin: new Date() });

    // Log the login action
    logAction('LOGIN', 'AUTH', `Connexion de ${user.firstName} ${user.lastName}`);

    return { success: true };
  };

  const logout = () => {
    if (currentUser) {
      logAction('LOGOUT', 'AUTH', `Déconnexion de ${currentUser.firstName} ${currentUser.lastName}`);
    }
    localStorage.removeItem(SESSION_KEY);
    setCurrentUser(null);
  };

  const permissions = currentUser ? ROLE_PERMISSIONS[currentUser.role] : null;

  const hasPermission = (permission: keyof RolePermission): boolean => {
    if (!permissions) return false;
    const value = permissions[permission];
    return typeof value === 'boolean' ? value : false;
  };

  const logAction = (
    actionType: AdminActionType, 
    targetType: AdminLogEntry['targetType'], 
    description: string, 
    targetId?: string, 
    metadata?: Record<string, any>
  ) => {
    if (!currentUser) return;
    
    const logEntry: AdminLogEntry = {
      id: `log-${Date.now()}`,
      adminUserId: currentUser.id,
      adminUserName: `${currentUser.firstName} ${currentUser.lastName}`,
      actionType,
      targetType,
      targetId,
      description,
      metadata,
      ipAddress: '127.0.0.1', // Mock IP
      createdAt: new Date(),
    };

    setActionLogs(prev => [logEntry, ...prev]);
    
    // In a real app, this would send to the server
    console.log('[ADMIN LOG]', logEntry);
  };

  return (
    <AdminAuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        isLoading,
        permissions,
        login,
        logout,
        hasPermission,
        logAction,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}

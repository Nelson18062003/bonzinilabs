import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/integrations/supabase/client';

// Types based on database app_role enum
export type AppRole = 'super_admin' | 'ops' | 'support' | 'customer_success' | 'cash_agent';

// Admin account status
export type AdminStatus = 'ACTIVE' | 'DISABLED';

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: AppRole;
}

export interface RolePermission {
  canViewClients: boolean;
  canEditClients: boolean;
  canViewDeposits: boolean;
  canProcessDeposits: boolean;
  canViewPayments: boolean;
  canProcessPayments: boolean;
  canManageRates: boolean;
  canViewLogs: boolean;
  canManageUsers: boolean;
}

export const ROLE_PERMISSIONS: Record<AppRole, RolePermission> = {
  super_admin: {
    canViewClients: true,
    canEditClients: true,
    canViewDeposits: true,
    canProcessDeposits: true,
    canViewPayments: true,
    canProcessPayments: true,
    canManageRates: true,
    canViewLogs: true,
    canManageUsers: true,
  },
  ops: {
    canViewClients: true,
    canEditClients: false,
    canViewDeposits: true,
    canProcessDeposits: true,
    canViewPayments: true,
    canProcessPayments: true,
    canManageRates: true,
    canViewLogs: true,
    canManageUsers: false,
  },
  support: {
    canViewClients: true,
    canEditClients: true,
    canViewDeposits: true,
    canProcessDeposits: false,
    canViewPayments: true,
    canProcessPayments: false,
    canManageRates: false,
    canViewLogs: true,
    canManageUsers: false,
  },
  customer_success: {
    canViewClients: true,
    canEditClients: true,
    canViewDeposits: true,
    canProcessDeposits: true,
    canViewPayments: true,
    canProcessPayments: false,
    canManageRates: false,
    canViewLogs: false,
    canManageUsers: false,
  },
  cash_agent: {
    canViewClients: false,
    canEditClients: false,
    canViewDeposits: false,
    canProcessDeposits: false,
    canViewPayments: true,
    canProcessPayments: true,
    canManageRates: false,
    canViewLogs: false,
    canManageUsers: false,
  },
};

export const ADMIN_ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  ops: 'Opérations',
  support: 'Support',
  customer_success: 'Chargé de clientèle',
  cash_agent: 'Agent Cash',
};

interface AdminAuthContextType {
  currentUser: AdminUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  permissions: RolePermission | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  hasPermission: (permission: keyof RolePermission) => boolean;
  logAction: (actionType: string, targetType: string, description: string, targetId?: string, metadata?: Record<string, any>) => void;
  profile: { first_name: string; last_name: string } | null;
  canManageUsers: boolean;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAdminData = async (user: User) => {
    try {
      const { data: roleData, error: roleError } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (roleError) {
        console.error('Error fetching role:', roleError);
        return null;
      }

      if (!roleData) return null;

      // Fetch profile for name
      const { data: profileData } = await supabaseAdmin
        .from('profiles')
        .select('first_name, last_name')
        .eq('user_id', user.id)
        .maybeSingle();

      const adminUser: AdminUser = {
        id: user.id,
        email: user.email || '',
        firstName: profileData?.first_name || 'Admin',
        lastName: profileData?.last_name || '',
        role: roleData.role as AppRole,
      };

      return adminUser;
    } catch (error) {
      console.error('Error in fetchAdminData:', error);
      return null;
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabaseAdmin.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setTimeout(async () => {
            const adminData = await fetchAdminData(session.user);
            setCurrentUser(adminData);
            setIsLoading(false);
          }, 0);
        } else {
          setCurrentUser(null);
          setIsLoading(false);
        }
      }
    );

    supabaseAdmin.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const adminData = await fetchAdminData(session.user);
        setCurrentUser(adminData);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (error) return { success: false, error: error.message };
      if (!data.user) return { success: false, error: 'Connexion échouée' };

      const adminData = await fetchAdminData(data.user);
      
      if (!adminData) {
        await supabaseAdmin.auth.signOut();
        return { success: false, error: 'Accès non autorisé. Vous n\'êtes pas administrateur.' };
      }

      setCurrentUser(adminData);
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Une erreur est survenue' };
    }
  };

  const logout = async () => {
    await supabaseAdmin.auth.signOut();
    setCurrentUser(null);
  };

  const permissions = currentUser ? ROLE_PERMISSIONS[currentUser.role] : null;

  const hasPermission = (permission: keyof RolePermission): boolean => {
    if (!permissions) return false;
    return permissions[permission] === true;
  };

  const logAction = async (
    actionType: string,
    targetType: string,
    description: string,
    targetId?: string,
    metadata?: Record<string, any>
  ) => {
    if (!currentUser) return;
    try {
      await supabaseAdmin.from('admin_audit_logs').insert({
        admin_user_id: currentUser.id,
        action_type: actionType,
        target_type: targetType,
        target_id: targetId,
        details: metadata ? { description, ...metadata } : { description },
      });
    } catch (error) {
      console.error('[ADMIN LOG ERROR]', error);
    }
  };

  const profile = currentUser
    ? { first_name: currentUser.firstName, last_name: currentUser.lastName }
    : null;
  const canManageUsers = hasPermission('canManageUsers');

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
        profile,
        canManageUsers,
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

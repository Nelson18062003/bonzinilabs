import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// Types based on database app_role enum
export type AppRole = 'super_admin' | 'ops' | 'support' | 'customer_success';

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
};

export const ADMIN_ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  ops: 'Opérations',
  support: 'Support',
  customer_success: 'Chargé de clientèle',
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
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user role and profile after login
  const fetchAdminData = async (user: User) => {
    try {
      // Check if user has an admin role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (roleError) {
        console.error('Error fetching role:', roleError);
        return null;
      }

      if (!roleData) {
        // User is not an admin
        return null;
      }

      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
      }

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
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        
        if (session?.user) {
          // Defer Supabase calls with setTimeout to avoid deadlock
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

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
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
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data.user) {
        return { success: false, error: 'Connexion échouée' };
      }

      // Check if user is an admin
      const adminData = await fetchAdminData(data.user);
      
      if (!adminData) {
        // User exists but is not an admin - sign them out
        await supabase.auth.signOut();
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
    await supabase.auth.signOut();
    setCurrentUser(null);
    setSession(null);
  };

  const permissions = currentUser ? ROLE_PERMISSIONS[currentUser.role] : null;

  const hasPermission = (permission: keyof RolePermission): boolean => {
    if (!permissions) return false;
    return permissions[permission] === true;
  };

  // Log admin actions to audit log table
  const logAction = async (
    actionType: string,
    targetType: string,
    description: string,
    targetId?: string,
    metadata?: Record<string, any>
  ) => {
    if (!currentUser) return;
    
    try {
      await supabase.from('admin_audit_logs').insert({
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

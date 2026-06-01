import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/integrations/supabase/client';

// Types based on database app_role enum
export type AppRole = 'super_admin' | 'ops' | 'support' | 'customer_success' | 'cash_agent' | 'treasurer';

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
  canViewTreasury: boolean;
  canManageTreasury: boolean;
  canAccessSupportChat: boolean;
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
    canViewTreasury: true,
    canManageTreasury: true,
    canAccessSupportChat: true,
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
    canViewTreasury: false,
    canManageTreasury: false,
    canAccessSupportChat: true,
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
    canViewTreasury: false,
    canManageTreasury: false,
    canAccessSupportChat: true,
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
    canViewTreasury: false,
    canManageTreasury: false,
    canAccessSupportChat: true,
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
    canViewTreasury: false,
    canManageTreasury: false,
    canAccessSupportChat: false,
  },
  treasurer: {
    canViewClients: false,
    canEditClients: false,
    canViewDeposits: false,
    canProcessDeposits: false,
    canViewPayments: false,
    canProcessPayments: false,
    canManageRates: false,
    canViewLogs: false,
    canManageUsers: false,
    canViewTreasury: true,
    canManageTreasury: true,
    canAccessSupportChat: false,
  },
};

export const ADMIN_ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  ops: 'Opérations',
  support: 'Support',
  customer_success: 'Chargé de clientèle',
  cash_agent: 'Agent Cash',
  treasurer: 'Trésorier',
};

interface AdminAuthContextType {
  currentUser: AdminUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  permissions: RolePermission | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  hasPermission: (permission: keyof RolePermission) => boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logAction: (actionType: string, targetType: string, description: string, targetId?: string, metadata?: Record<string, any>) => void;
  // Convenience properties
  profile: { first_name: string; last_name: string } | null;
  canManageUsers: boolean;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

// Garde-fou : empêche une requête réseau de rester bloquée indéfiniment.
function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Délai dépassé (${label}). Vérifie ta connexion internet.`)), ms)),
  ]);
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user role and profile after login
  const fetchAdminData = async (user: User) => {
    try {
      // Check if user has an admin role (avec timeout pour ne jamais rester bloqué)
      const { data: roleData, error: roleError } = await withTimeout(
        supabaseAdmin
          .from('user_roles')
          .select('role, first_name, last_name, is_disabled')
          .eq('user_id', user.id)
          .maybeSingle(),
        10000,
        'chargement du rôle',
      );

      if (roleError) {
        console.error('Error fetching role:', roleError);
        return null;
      }

      if (!roleData) {
        // User is not an admin/agent
        return null;
      }

      // Check if account is disabled
      if (roleData.is_disabled) {
        return { disabled: true as const };
      }

      const adminUser: AdminUser = {
        id: user.id,
        email: user.email || '',
        firstName: roleData.first_name || 'Admin',
        lastName: roleData.last_name || '',
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
    const { data: { subscription } } = supabaseAdmin.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        
        if (session?.user) {
          // Defer Supabase calls with setTimeout to avoid deadlock
          setTimeout(async () => {
            const adminData = await fetchAdminData(session.user);
            setCurrentUser(adminData && !('disabled' in adminData) ? adminData : null);
            setIsLoading(false);
          }, 0);
        } else {
          setCurrentUser(null);
          setIsLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabaseAdmin.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        const adminData = await fetchAdminData(session.user);
        setCurrentUser(adminData && !('disabled' in adminData) ? adminData : null);
      }
      setIsLoading(false);
    }).catch((err) => {
      // Ne JAMAIS laisser le spinner tourner indéfiniment si getSession/fetch échoue.
      console.error('Admin auth init error:', err);
      setIsLoading(false);
    });

    // Filet de sécurité : au pire, on débloque l'écran après 8s (puis l'app
    // redirigera vers /m/login si la session n'a pas pu être chargée).
    const safety = setTimeout(() => setIsLoading(false), 8000);

    return () => {
      clearTimeout(safety);
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await withTimeout(
        supabaseAdmin.auth.signInWithPassword({
          email: email.toLowerCase().trim(),
          password,
        }),
        15000,
        'connexion',
      );

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data.user) {
        return { success: false, error: 'Login failed' };
      }

      // Check if user is an admin/agent
      const adminData = await fetchAdminData(data.user);

      if (!adminData) {
        await supabaseAdmin.auth.signOut();
        return { success: false, error: 'Unauthorized access. No role assigned to this account.' };
      }

      if ('disabled' in adminData) {
        await supabaseAdmin.auth.signOut();
        return { success: false, error: 'This account has been disabled. Contact an administrator.' };
      }

      setCurrentUser(adminData);
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      // Remonter la vraie cause au lieu d'un message générique muet.
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Erreur de connexion : ${msg}` };
    }
  };

  const logout = async () => {
    await supabaseAdmin.auth.signOut();
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  // Convenience properties
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

// ============================================================
// Les rôles du personnel — miroir de ROLE_PERMISSIONS du site
// (src/contexts/AdminAuthContext.tsx). Seules les permissions dont l'app a
// besoin pour ses écrans natifs sont reprises ; la sécurité réelle reste
// côté serveur (admin_has_permission dans chaque RPC).
// ============================================================
export type StaffRole = 'super_admin' | 'ops' | 'support' | 'customer_success' | 'cash_agent' | 'treasurer' | 'receptionist' | 'warehouse_agent';

export interface StaffUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: StaffRole;
}

export const ROLE_LABEL: Record<StaffRole, string> = {
  super_admin: 'Super admin',
  ops: 'Opérations',
  support: 'Support',
  customer_success: 'Chargé de clientèle',
  cash_agent: 'Agent cash',
  treasurer: 'Trésorier',
  receptionist: 'Réceptionnaire',
  warehouse_agent: "Agent d'entrepôt",
};

type Perm = 'viewClients' | 'viewDeposits' | 'viewPayments' | 'manageRates' | 'viewTreasury' | 'supportChat' | 'viewCargo' | 'receiveParcels' | 'destination';
const PERMS: Record<StaffRole, Perm[]> = {
  super_admin: ['viewClients', 'viewDeposits', 'viewPayments', 'manageRates', 'viewTreasury', 'supportChat', 'viewCargo', 'receiveParcels', 'destination'],
  ops: ['viewClients', 'viewDeposits', 'viewPayments', 'manageRates', 'supportChat', 'viewCargo', 'receiveParcels', 'destination'],
  support: ['viewClients', 'viewDeposits', 'viewPayments', 'supportChat', 'viewCargo'],
  customer_success: ['viewClients', 'viewDeposits', 'viewPayments', 'supportChat', 'viewCargo'],
  cash_agent: ['viewPayments'],
  treasurer: ['viewTreasury'],
  receptionist: ['receiveParcels'],
  warehouse_agent: ['destination'],
};

export function can(role: StaffRole | undefined, perm: Perm): boolean {
  return !!role && PERMS[role].includes(perm);
}

export function isStaffRole(v: unknown): v is StaffRole {
  return typeof v === 'string' && v in ROLE_LABEL;
}

/** Même règle que staffHomeFor() du site. */
export function staffHome(role: StaffRole): string {
  if (role === 'cash_agent') return '/a';
  if (role === 'receptionist') return '/r';
  if (role === 'warehouse_agent') return '/w';
  return '/m';
}

export function firstName(u: StaffUser | null | undefined): string {
  return (u?.firstName || u?.email?.split('@')[0] || '').trim();
}

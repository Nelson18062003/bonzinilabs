/**
 * Navigation model for the dedicated DESKTOP admin sidebar.
 *
 * Mirrors the destinations of the mobile tab bar (src/mobile/.../MobileTabBar)
 * but, with the room a sidebar affords, also surfaces the secondary modules that
 * live behind "Plus" on mobile. Each item is permission-gated exactly like the
 * routes it links to (see ROLE_PERMISSIONS) so an operator only sees what they
 * can actually open. Routes stay on the existing `/m/*` paths.
 */
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Bot,
  ArrowDownToLine,
  ArrowUpFromLine,
  Users,
  Landmark,
  Percent,
  LifeBuoy,
  Shield,
  ScrollText,
  Settings,
  LayoutGrid,
} from 'lucide-react';
import type { RolePermission } from '@/contexts/AdminAuthContext';

export interface DesktopNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Exact-match the active route (used for the index route `/m`). */
  end?: boolean;
  /** Required permission to see the item (omit = always visible). */
  perm?: keyof RolePermission;
  /** Actionable-count badge to show (from useAdminActionableCounts). */
  badge?: 'deposits' | 'payments';
  /** Render the Mola mascot image as the icon (falls back to `icon`). */
  mascot?: boolean;
}

export interface DesktopNavGroup {
  label: string;
  items: DesktopNavItem[];
}

export const DESKTOP_NAV: DesktopNavGroup[] = [
  {
    label: 'Principal',
    items: [
      { to: '/m', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
      { to: '/m/assistant', label: 'Mola', icon: Bot, mascot: true },
      { to: '/m/deposits', label: 'Dépôts', icon: ArrowDownToLine, perm: 'canViewDeposits', badge: 'deposits' },
      { to: '/m/payments', label: 'Paiements', icon: ArrowUpFromLine, perm: 'canViewPayments', badge: 'payments' },
      { to: '/m/clients', label: 'Clients', icon: Users, perm: 'canViewClients' },
    ],
  },
  {
    label: 'Opérations',
    items: [
      { to: '/m/more/treasury', label: 'Trésorerie', icon: Landmark, perm: 'canViewTreasury' },
      { to: '/m/more/rates', label: 'Taux de change', icon: Percent, perm: 'canManageRates' },
      { to: '/m/support', label: 'Support', icon: LifeBuoy, perm: 'canAccessSupportChat' },
    ],
  },
  {
    label: 'Système',
    items: [
      { to: '/m/more/admins', label: 'Administrateurs', icon: Shield, perm: 'canManageUsers' },
      { to: '/m/more/history', label: 'Journaux', icon: ScrollText, perm: 'canViewLogs' },
      { to: '/m/more/settings', label: 'Paramètres', icon: Settings },
      { to: '/m/more', label: 'Tous les outils', icon: LayoutGrid, end: true },
    ],
  },
];

/** Resolve the human title of the section that owns `pathname` (for the topbar). */
export function activeNavTitle(pathname: string): string {
  const all = DESKTOP_NAV.flatMap((g) => g.items);
  // Longest matching `to` wins so `/m/more/rates` beats `/m`.
  const match = all
    .filter((it) => (it.end ? pathname === it.to : pathname === it.to || pathname.startsWith(it.to + '/')))
    .sort((a, b) => b.to.length - a.to.length)[0];
  return match?.label ?? 'Administration';
}

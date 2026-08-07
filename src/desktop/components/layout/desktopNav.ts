/**
 * Navigation model for the desktop admin console.
 *
 * WHY THIS SHAPE
 * The mobile app can only show five tabs, so everything else was pushed behind
 * a "Plus" hub: eleven treasury screens, five support screens and eight system
 * screens all lived two or three taps deep. Transplanted to a 1440px screen
 * that hub became the app's biggest usability problem — the sidebar advertised
 * nine destinations while the product actually had thirty.
 *
 * On desktop there is room, so the rule is now: **every screen an operator can
 * open is in this file, and nothing is more than two clicks away.** Sections
 * map to how the business actually works (piloter · opérer · financer ·
 * relation · système) rather than to the old tab bar, and each one collapses so
 * the rail stays short for the modules a given role never touches.
 *
 * Permission gating is declarative here and mirrors the route guards, so an
 * operator only ever sees what they can actually open (see ROLE_PERMISSIONS).
 */
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  BarChart3,
  Bell,
  Bot,
  Boxes,
  Building2,
  FileCheck2,
  Gauge,
  LayoutDashboard,
  LifeBuoy,
  MessageSquareQuote,
  Newspaper,
  Percent,
  PieChart,
  ScrollText,
  Settings,
  Shield,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import type { RolePermission } from '@/contexts/AdminAuthContext';

export interface DesktopNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Exact-match the active route (used for index routes like `/m`). */
  end?: boolean;
  /** Required permission to see the item (omit = always visible). */
  perm?: keyof RolePermission;
  /** Actionable-count badge (from useAdminActionableCounts / support unread). */
  badge?: 'deposits' | 'payments' | 'support';
  /** Render the Mola mascot image as the icon (falls back to `icon`). */
  mascot?: boolean;
  /** Short description — shown in the command palette, not in the rail. */
  hint?: string;
}

export interface DesktopNavSection {
  id: string;
  label: string;
  /** Hide the whole section unless the role has this permission. */
  perm?: keyof RolePermission;
  /** Sections pinned open never collapse — the daily-driver modules. */
  pinned?: boolean;
  items: DesktopNavItem[];
}

export const DESKTOP_NAV: DesktopNavSection[] = [
  {
    id: 'pilotage',
    label: 'Pilotage',
    pinned: true,
    items: [
      { to: '/m', label: 'Tableau de bord', icon: LayoutDashboard, end: true, hint: "Vue opérationnelle du jour" },
      { to: '/m/assistant', label: 'Mola', icon: Bot, mascot: true, hint: 'Directeur des opérations IA' },
      { to: '/m/dashboard', label: 'Analytics', icon: BarChart3, hint: 'Rapports, cohortes, entonnoirs' },
    ],
  },
  {
    id: 'operations',
    label: 'Opérations',
    pinned: true,
    items: [
      { to: '/m/deposits', label: 'Dépôts', icon: ArrowDownToLine, perm: 'canViewDeposits', badge: 'deposits', hint: 'Valider les entrées de fonds' },
      { to: '/m/payments', label: 'Paiements', icon: ArrowUpFromLine, perm: 'canViewPayments', badge: 'payments', hint: 'Régler les fournisseurs chinois' },
      { to: '/m/clients', label: 'Clients', icon: Users, perm: 'canViewClients', hint: 'Fiches, wallets, bénéficiaires' },
    ],
  },
  {
    id: 'tresorerie',
    label: 'Trésorerie',
    perm: 'canViewTreasury',
    items: [
      { to: '/m/more/treasury', label: "Vue d'ensemble", icon: Wallet, end: true, perm: 'canViewTreasury', hint: 'Soldes, WAC, stock USDT' },
      { to: '/m/more/treasury/dashboard', label: 'Analyse', icon: PieChart, perm: 'canViewTreasury', hint: 'Bénéfice, taux de revient, marges' },
      { to: '/m/more/treasury/purchases', label: 'Achats USDT', icon: TrendingUp, perm: 'canViewTreasury', hint: 'XAF → USDT' },
      { to: '/m/more/treasury/sales', label: 'Ventes USDT', icon: TrendingDown, perm: 'canViewTreasury', hint: 'USDT → CNY' },
      { to: '/m/more/treasury/accounts', label: 'Comptes & soldes', icon: Building2, perm: 'canViewTreasury' },
      { to: '/m/more/treasury/inventory', label: 'Inventaire', icon: Boxes, perm: 'canViewTreasury', hint: 'Rapprochement caisse' },
      { to: '/m/more/treasury/counterparties', label: 'Contreparties', icon: ArrowLeftRight, perm: 'canViewTreasury' },
      { to: '/m/more/treasury/operations', label: 'Journal des opérations', icon: Activity, perm: 'canViewTreasury' },
    ],
  },
  {
    id: 'marche',
    label: 'Marché',
    items: [
      { to: '/m/more/rates', label: 'Taux de change', icon: Percent, perm: 'canManageRates', hint: 'Publier les taux du jour' },
      { to: '/m/more/briefs', label: 'Veille macro', icon: Newspaper, hint: 'Brent, DXY, USD/CNY, prédictions' },
    ],
  },
  {
    id: 'relation',
    label: 'Relation client',
    perm: 'canAccessSupportChat',
    items: [
      { to: '/m/support', label: 'Conversations', icon: LifeBuoy, end: true, perm: 'canAccessSupportChat', badge: 'support' },
      { to: '/m/support/stats', label: 'Statistiques support', icon: Gauge, perm: 'canAccessSupportChat' },
      { to: '/m/more/canned-responses', label: 'Modèles de réponse', icon: MessageSquareQuote, perm: 'canAccessSupportChat' },
      { to: '/m/more/quick-replies', label: 'Réponses rapides', icon: Sparkles, perm: 'canAccessSupportChat' },
    ],
  },
  {
    id: 'systeme',
    label: 'Système',
    items: [
      { to: '/m/more/proofs', label: 'Justificatifs', icon: FileCheck2, hint: 'Preuves de dépôt' },
      { to: '/m/more/notifications', label: 'Notifications', icon: Bell },
      { to: '/m/more/admins', label: 'Administrateurs', icon: Shield, perm: 'canManageUsers' },
      { to: '/m/more/history', label: "Journal d'audit", icon: ScrollText, perm: 'canViewLogs' },
      { to: '/m/more/settings', label: 'Paramètres', icon: Settings },
    ],
  },
];

/** Flat list of every destination — used by the command palette. */
export const ALL_NAV_ITEMS: (DesktopNavItem & { section: string })[] = DESKTOP_NAV.flatMap((s) =>
  s.items.map((it) => ({ ...it, section: s.label })),
);

/** Does `pathname` sit inside this item's subtree? */
export function isItemActive(item: DesktopNavItem, pathname: string): boolean {
  return item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(item.to + '/');
}

/** The section that owns `pathname`, if any. */
export function activeSectionId(pathname: string): string | null {
  for (const section of DESKTOP_NAV) {
    if (section.items.some((it) => isItemActive(it, pathname))) return section.id;
  }
  return null;
}

/**
 * Breadcrumb for the topbar: [section, page]. Longest matching `to` wins so
 * `/m/more/treasury/sales` resolves to "Ventes USDT", not "Vue d'ensemble".
 */
export function activeTrail(pathname: string): { section: string; page: string } {
  let best: { section: string; page: string; len: number } | null = null;
  for (const section of DESKTOP_NAV) {
    for (const item of section.items) {
      if (!isItemActive(item, pathname)) continue;
      if (!best || item.to.length > best.len) best = { section: section.label, page: item.label, len: item.to.length };
    }
  }
  return best ? { section: best.section, page: best.page } : { section: 'Administration', page: 'Console' };
}

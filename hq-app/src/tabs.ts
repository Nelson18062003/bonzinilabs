// ============================================================
// La barre d'onglets NATIVE, par rôle. Un onglet est soit un écran natif
// (accueil, scanner, moi), soit une page du site (path) — la même WebView
// persistante y navigue, sans rechargement.
// Mêmes entrées que les barres du site (MobileTabBar, ReceptionTabBar,
// WarehouseTabBar, AgentCashTabBar), avec le scanner au centre.
// ============================================================
import type { ComponentProps } from 'react';
import type Ionicons from '@expo/vector-icons/Ionicons';
import { can, type StaffRole } from './roles';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export interface Tab {
  key: string;
  label: string;
  icon: IconName;
  /** Écran natif… */
  native?: 'home' | 'scan' | 'me';
  /** …ou page du site. */
  path?: string;
  /** Préfixes de chemin qui allument cet onglet (par défaut : path). `exact` : chemin exact. */
  match?: string[];
  exact?: boolean;
}

const HOME: Tab = { key: 'home', label: 'Accueil', icon: 'home', native: 'home' };
const SCAN: Tab = { key: 'scan', label: 'Scanner', icon: 'scan', native: 'scan' };
const ME: Tab = { key: 'me', label: 'Moi', icon: 'person-circle', native: 'me' };

export function tabsFor(role: StaffRole): Tab[] {
  switch (role) {
    case 'cash_agent':
      return [
        { key: 'payments', label: 'Paiements', icon: 'cash', path: '/a', match: ['/a'] },
        SCAN,
        ME,
      ];
    case 'receptionist':
      return [
        { key: 'today', label: "Aujourd'hui", icon: 'today', path: '/r', exact: true, match: ['/r', '/r/deposit'] },
        { key: 'clients', label: 'Clients', icon: 'people', path: '/r/clients', match: ['/r/clients'] },
        SCAN,
        { key: 'pending', label: 'En attente', icon: 'file-tray-full', path: '/r/pending', match: ['/r/pending'] },
        ME,
      ];
    case 'warehouse_agent':
      return [
        { key: 'day', label: 'Journée', icon: 'today', path: '/w', exact: true, match: ['/w', '/w/bon'] },
        { key: 'checkin', label: 'Pointer', icon: 'checkbox', path: '/w/arrivees', match: ['/w/arrivees'] },
        SCAN,
        { key: 'handover', label: 'Remettre', icon: 'hand-left', path: '/w/remise/liste', match: ['/w/remise'] },
        ME,
      ];
    case 'customs_broker':
      return [
        { key: 'review', label: 'À signer', icon: 'document-text', path: '/m/douane', exact: true, match: ['/m/douane', '/m/douane/revue'] },
        { key: 'simulator', label: 'Simulateur', icon: 'calculator', path: '/m/douane/simulateur', match: ['/m/douane/simulateur'] },
        ME,
      ];
    case 'treasurer':
      return [
        HOME,
        { key: 'treasury', label: 'Trésorerie', icon: 'wallet', path: '/m/more/treasury', match: ['/m/more/treasury'] },
        { key: 'more', label: 'Plus', icon: 'grid', path: '/m/more', match: ['/m/more'] },
      ];
    default: {
      const tabs: Tab[] = [
        HOME,
        { key: 'ops', label: 'Opérations', icon: 'swap-horizontal', path: '/m/ops', match: ['/m/ops', '/m/deposits', '/m/payments'] },
        SCAN,
        { key: 'clients', label: 'Clients', icon: 'people', path: '/m/clients', match: ['/m/clients'] },
        { key: 'more', label: 'Plus', icon: 'grid', path: '/m/more', match: ['/m/more', '/m/assistant', '/m/cargo', '/m/support', '/m/dashboard'] },
      ];
      return can(role, 'viewPayments') ? tabs : tabs.filter((t) => t.key !== 'ops');
    }
  }
}

/** L'onglet d'une page du site (le plus précis l'emporte), ou null. */
export function tabForPath(tabs: Tab[], path: string): Tab | null {
  const clean = path.split('?')[0].replace(/\/+$/, '') || '/';
  let best: { tab: Tab; len: number } | null = null;
  for (const t of tabs) {
    for (const m of t.match ?? (t.path ? [t.path] : [])) {
      const hit = t.exact && m === t.path ? clean === m : clean === m || clean.startsWith(m + '/');
      if (hit && (!best || m.length > best.len)) best = { tab: t, len: m.length };
    }
  }
  return best?.tab ?? null;
}

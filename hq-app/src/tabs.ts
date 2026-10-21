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
  native?: 'scan';
  /** …ou page du site. */
  path?: string;
  /** Préfixes de chemin qui allument cet onglet (par défaut : path). `exact` : chemin exact. */
  match?: string[];
  exact?: boolean;
}

const SCAN: Tab = { key: 'scan', label: 'Scanner', icon: 'scan', native: 'scan' };
/** « Plus » : une page du site, avec en tête la carte « Moi » (écran natif). */
const plus = (path: string, match: string[] = [path]): Tab => ({ key: 'more', label: 'Plus', icon: 'ellipsis-horizontal-circle', path, match });

// Refonte v2 (21/10/2026, maquette 01-navigation/10) : Moi n'est plus un
// onglet, il est en tête de « Plus » pour TOUS les rôles ; l'équipe retrouve
// un Accueil du site (le chiffre du jour, les ronds, la liste) et l'onglet Cargo.
export function tabsFor(role: StaffRole): Tab[] {
  switch (role) {
    case 'cash_agent':
      return [
        { key: 'payments', label: 'Paiements', icon: 'cash', path: '/a', exact: true, match: ['/a', '/a/payment'] },
        SCAN,
        plus('/a/plus'),
      ];
    case 'receptionist':
      return [
        { key: 'today', label: "Aujourd'hui", icon: 'today', path: '/r', exact: true, match: ['/r', '/r/deposit', '/r/new', '/r/pending'] },
        // Les paquets avion de 32 kg (le bureau) : les colis à emballer, les paquets en cours.
        { key: 'packages', label: 'Paquets', icon: 'cube', path: '/r/paquets', match: ['/r/paquets'] },
        SCAN,
        { key: 'clients', label: 'Clients', icon: 'people', path: '/r/clients', match: ['/r/clients'] },
        plus('/r/plus'),
      ];
    case 'warehouse_agent':
      return [
        { key: 'day', label: 'Journée', icon: 'today', path: '/w', exact: true, match: ['/w', '/w/bon'] },
        { key: 'checkin', label: 'Pointer', icon: 'checkbox', path: '/w/arrivees', match: ['/w/arrivees'] },
        SCAN,
        { key: 'handover', label: 'Remettre', icon: 'hand-left', path: '/w/remise/liste', match: ['/w/remise'] },
        plus('/w/plus'),
      ];
    case 'customs_broker':
      return [
        { key: 'review', label: 'À signer', icon: 'document-text', path: '/m/douane', exact: true, match: ['/m/douane', '/m/douane/revue', '/m/douane/audit'] },
        { key: 'simulator', label: 'Simulateur', icon: 'calculator', path: '/m/douane/simulateur', match: ['/m/douane/simulateur'] },
        plus('/m/more', ['/m/more', '/m/douane/veille', '/m/douane/routes']),
      ];
    case 'commercial':
      return [
        { key: 'sales', label: 'Mon mois', icon: 'trending-up', path: '/v', exact: true, match: ['/v'] },
        { key: 'prospects', label: 'Prospects', icon: 'person-add', path: '/v/prospects', match: ['/v/prospects'] },
        { key: 'clients', label: 'Mes clients', icon: 'people', path: '/v/clients', match: ['/v/clients'] },
        plus('/v/plus', ['/v/plus', '/v/password']),
      ];
    case 'treasurer':
      return [
        { key: 'home', label: 'Accueil', icon: 'home', path: '/m', exact: true, match: ['/m'] },
        { key: 'treasury', label: 'Trésorerie', icon: 'wallet', path: '/m/more/treasury', match: ['/m/more/treasury'] },
        plus('/m/more'),
      ];
    default: {
      const tabs: Tab[] = [
        { key: 'home', label: 'Accueil', icon: 'home', path: '/m', exact: true, match: ['/m'] },
        { key: 'ops', label: 'Opérations', icon: 'swap-horizontal', path: '/m/ops', match: ['/m/ops', '/m/deposits', '/m/payments'] },
        { key: 'clients', label: 'Clients', icon: 'people', path: '/m/clients', match: ['/m/clients'] },
        { key: 'cargo', label: 'Cargo', icon: 'boat', path: '/m/cargo', match: ['/m/cargo'] },
        plus('/m/more', ['/m/more', '/m/assistant', '/m/support', '/m/dashboard', '/m/douane', '/m/equipe']),
      ];
      return tabs.filter((t) => (t.key === 'ops' ? can(role, 'viewPayments') : t.key === 'cargo' ? can(role, 'viewCargo') : t.key === 'clients' ? can(role, 'viewClients') : true));
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

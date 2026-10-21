// ============================================================
// Les pastilles des onglets natifs : ce qui attend la personne, par rôle.
// Mêmes sources que les barres du site :
//   · admin    → « Opérations » : lib/actionable.ts (dépôts + paiements à traiter)
//   · réception → « Aujourd'hui » (les dépôts en attente, comme ReceptionTabBar) : reception_my_day.pending ; « Paquets » : air_package_packable, AU BUREAU
//     seulement (le lieu de ce téléphone, dit par le site) — comme ReceptionTabBar : à l'entrepôt, l'onglet
//     n'a rien à faire, la pastille ne doit rien annoncer
//   · Douala   → « Pointer » / « Remettre » : warehouse_day (WarehouseTabBar)
//   · agent cash → « Paiements » : paiements cash en attente (useAgentCashPayments)
// Le total s'affiche aussi sur l'icône de l'app. Rafraîchies toutes les
// minutes, au retour dans l'app, à chaque notification reçue et quelques secondes après chaque changement de page
// (un dépôt validé fait baisser la pastille sans attendre).
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { db, hasFreshToken } from './supabase';
import { can, staffHome, type StaffRole } from './roles';
import { CASH_PENDING, DEPOSITS_TO_PROCESS, PAYMENTS_TO_PROCESS } from './statuses';
import type { ReceptionLocation } from './bridge';

export type Badges = Record<string, number>;


type Rpc = { success?: boolean } & Record<string, unknown>;

async function rpc(name: string): Promise<Rpc | null> {
  const { data, error } = await db.rpc(name);
  const res = data as Rpc | null;
  return error || !res || res.success !== true ? null : res;
}

async function count(table: 'deposits' | 'payments', statuses: string[], cashOnly = false): Promise<number> {
  let q = db.from(table).select('id', { count: 'exact', head: true }).in('status', statuses);
  if (cashOnly) q = q.eq('method', 'cash');
  const { count: n, error } = await q;
  return error ? 0 : n ?? 0;
}

/** Les colis qui attendent un paquet : les compteurs seuls (p_limit = 0), pas la liste. */
async function packableCount(): Promise<number> {
  const { data, error } = await db.rpc('air_package_packable', { p_limit: 0 });
  const p = (error ? null : data) as { success?: boolean; ready_count?: number; to_fix_count?: number } | null;
  return p?.success ? Number(p.ready_count ?? 0) + Number(p.to_fix_count ?? 0) : 0;
}

/** Les pastilles du rôle, par clé d'onglet (voir tabs.ts). */
export async function fetchBadges(role: StaffRole, location: ReceptionLocation = null): Promise<Badges> {
  switch (role) {
    case 'receptionist': {
      const [day, packages] = await Promise.all([rpc('reception_my_day'), location === 'office' ? packableCount() : 0]);
      return { today: Number(day?.pending ?? 0), packages };
    }
    case 'warehouse_agent': {
      const day = await rpc('warehouse_day');
      const stats = day?.stats as { to_checkin?: number } | undefined;
      const waiting = day?.waiting_by_client as unknown[] | undefined;
      return { checkin: Number(stats?.to_checkin ?? 0), handover: waiting?.length ?? 0 };
    }
    case 'cash_agent':
      return { payments: await count('payments', CASH_PENDING, true) };
    default: {
      if (staffHome(role) !== '/m' || !can(role, 'viewPayments')) return {};
      const [d, p] = await Promise.all([
        can(role, 'viewDeposits') ? count('deposits', DEPOSITS_TO_PROCESS) : 0,
        count('payments', PAYMENTS_TO_PROCESS),
      ]);
      return { ops: d + p };
    }
  }
}

export function useBadges(role: StaffRole | null, route: string, location: ReceptionLocation = null): Badges {
  const [badges, setBadges] = useState<Badges>({});
  // Le lieu est lu au moment du chargement (pas une dépendance de `load`) : un changement
  // de lieu recharge UNE fois, sans relancer la minuterie ni le rechargement de page.
  const locationRef = useRef(location);
  locationRef.current = location;

  const load = useCallback(async () => {
    if (!role || !hasFreshToken()) return;
    try {
      const next = await fetchBadges(role, locationRef.current);
      setBadges(next);
      // Le même total sur l'icône de l'app (écran d'accueil du téléphone).
      void Notifications.setBadgeCountAsync(Object.values(next).reduce((a, b) => a + b, 0)).catch(() => {});
    } catch {
      // Réseau coupé : on garde les derniers chiffres.
    }
  }, [role]);

  // Le lieu a changé (« Où êtes-vous ? », « Changer ») : la pastille Paquets suit aussitôt.
  const seenLocation = useRef(location);
  useEffect(() => {
    if (seenLocation.current === location) return;
    seenLocation.current = location;
    void load();
  }, [location, load]);

  useEffect(() => {
    if (!role) {
      setBadges({});
      void Notifications.setBadgeCountAsync(0).catch(() => {});
      return;
    }
    void load();
    const timer = setInterval(() => void load(), 60_000);
    const app = AppState.addEventListener('change', (s) => {
      if (s === 'active') void load();
    });
    const push = Notifications.addNotificationReceivedListener(() => void load());
    return () => {
      clearInterval(timer);
      app.remove();
      push.remove();
    };
  }, [role, load]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 2_500);
    return () => clearTimeout(t);
  }, [route, load]);

  return badges;
}

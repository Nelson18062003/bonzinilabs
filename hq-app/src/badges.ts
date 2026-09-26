// ============================================================
// Les pastilles des onglets natifs : ce qui attend la personne, par rôle.
// Mêmes sources que les barres du site :
//   · admin    → « Opérations » : lib/actionable.ts (dépôts + paiements à traiter)
//   · réception → « En attente » : reception_my_day.pending (ReceptionTabBar)
//   · Douala   → « Pointer » / « Remettre » : warehouse_day (WarehouseTabBar)
//   · agent cash → « Paiements » : paiements cash en attente (useAgentCashPayments)
// Rafraîchies toutes les minutes, au retour dans l'app, à chaque
// notification reçue et quelques secondes après chaque changement de page
// (un dépôt validé fait baisser la pastille sans attendre).
// ============================================================
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { db, hasFreshToken } from './supabase';
import { can, staffHome, type StaffRole } from './roles';
import { CASH_PENDING, DEPOSITS_TO_PROCESS, PAYMENTS_TO_PROCESS } from './statuses';

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

/** Les pastilles du rôle, par clé d'onglet (voir tabs.ts). */
export async function fetchBadges(role: StaffRole): Promise<Badges> {
  switch (role) {
    case 'receptionist': {
      const day = await rpc('reception_my_day');
      return { pending: Number(day?.pending ?? 0) };
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

export function useBadges(role: StaffRole | null, route: string): Badges {
  const [badges, setBadges] = useState<Badges>({});

  const load = useCallback(async () => {
    if (!role || !hasFreshToken()) return;
    try {
      setBadges(await fetchBadges(role));
    } catch {
      // Réseau coupé : on garde les derniers chiffres.
    }
  }, [role]);

  useEffect(() => {
    if (!role) {
      setBadges({});
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

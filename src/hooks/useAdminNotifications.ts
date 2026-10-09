// ============================================================
// Admin Notifications — Actionable items needing attention
// Uses supabaseAdmin (admin session)
//
// Depuis le 07/10, la direction (canManageSales) y lit aussi les fiches
// « À vérifier » : un commercial a saisi le numéro d'un client Bonzini —
// une entrée par fiche, vers l'écran où elle décide. Lues par
// `useProspectClaims` (clé ['sales', 'claims']) : une décision prise sur
// l'écran rafraîchit la cloche d'elle-même. Les autres rôles n'envoient
// AUCUNE requête (le serveur la refuserait de toute façon).
// ============================================================
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ACTIONABLE_DEPOSIT_STATUSES, ACTIONABLE_PAYMENT_STATUSES } from '@/lib/actionable';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { CACHE_CONFIG } from '@/lib/constants';
import i18n from '@/i18n';
import { alertLevel } from '@/lib/cargo/palette';
import { arrivalSentence, delaySentence } from '@/lib/cargo/plain';
import { daysUntilArrival } from '@/lib/cargo/model';
import type { CargoShipment } from '@/lib/cargo/model';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useProspectClaims, type ProspectClaim } from '@/hooks/useSales';

export type AdminNotificationType =
  | 'deposit_needs_review'
  | 'deposit_needs_correction'
  | 'payment_ready'
  | 'payment_processing'
  | 'cargo_late'
  | 'cargo_arriving'
  | 'prospect_to_verify';

export interface AdminNotification {
  id: string;
  type: AdminNotificationType;
  title: string;
  subtitle: string;
  /** Absent pour un conteneur : il n'y a pas de montant à montrer. */
  amount?: number;
  currency?: 'XAF' | 'RMB';
  createdAt: string;
  targetPath: string;
}

/**
 * Cargo : une boîte mérite une notification quand elle est en retard (l'app
 * la classe « late ») ou quand elle arrive sous 7 jours — c'est là que le
 * fret, le télex et le BESC doivent être réglés. RLS ne renvoie les lignes
 * qu'aux rôles qui ont canViewCargo : les autres ne voient rien de plus.
 */
const CARGO_ARRIVING_DAYS = 7;

async function fetchCargoAlerts(): Promise<CargoShipment[]> {
  const { data, error } = await supabaseAdmin
    .from('cargo_shipments')
    .select('*')
    .neq('status', 'DELIVERED')
    .limit(200);
  if (error) return [];
  return (data ?? []) as CargoShipment[];
}

function cargoAlertKind(s: CargoShipment): 'cargo_late' | 'cargo_arriving' | null {
  if (alertLevel(s) === 'late') return 'cargo_late';
  const days = daysUntilArrival(s);
  if (days != null && days >= 0 && days <= CARGO_ARRIVING_DAYS) return 'cargo_arriving';
  return null;
}

function cargoNotifications(shipments: CargoShipment[]): AdminNotification[] {
  const out: AdminNotification[] = [];
  for (const s of shipments) {
    const kind = cargoAlertKind(s);
    if (!kind) continue;
    const delay = delaySentence(s);
    out.push({
      id: `cargo-${s.id}`,
      type: kind,
      title: kind === 'cargo_late' ? `Conteneur de ${s.client_label} en retard` : `Conteneur de ${s.client_label} arrive bientôt`,
      subtitle: `${arrivalSentence(s)}.${delay ? ` ${delay}.` : ''}`,
      createdAt: s.last_event_at ?? s.updated_at,
      targetPath: `/m/cargo/${s.id}`,
    });
  }
  return out;
}

/** L'écran « À vérifier » de la direction (Mes équipes › Les commerciaux). */
export const PROSPECT_CLAIMS_PATH = '/m/equipe/ventes/a-verifier';

/** Les vérifications en attente, regroupées par fiche prospect (plusieurs clients peuvent être reconnus pour une fiche). */
export function groupClaimsByProspect(claims: readonly ProspectClaim[]): ProspectClaim[][] {
  const groups = new Map<string, ProspectClaim[]>();
  for (const c of claims) {
    const id = c.prospect?.id ?? c.claim_id;
    const g = groups.get(id);
    if (g) g.push(c);
    else groups.set(id, [c]);
  }
  return [...groups.values()];
}

/**
 * Une notification par fiche « À vérifier » : « Numéro déjà client ·
 * <commercial> », le prospect saisi et le client reconnu, vers l'écran de
 * décision (la fiche y est mise en évidence).
 */
export function prospectClaimNotifications(claims: readonly ProspectClaim[]): AdminNotification[] {
  return groupClaimsByProspect(claims).map((group) => {
    const first = group[0];
    const p = first.prospect;
    const prospect = [p?.first_name, p?.last_name].filter(Boolean).join(' ') || '—';
    const subtitle =
      group.length > 1
        ? i18n.t('hooks.adminNotifications.prospectToVerifyMany', { ns: 'common', prospect, count: group.length, defaultValue: `${prospect} · ${group.length} clients reconnus` })
        : i18n.t('hooks.adminNotifications.prospectToVerifyOne', {
            ns: 'common',
            prospect,
            client: first.client.name,
            defaultValue: `${prospect} · client reconnu : ${first.client.name}`,
          });
    const createdAt = group.reduce((latest, c) => (c.created_at > latest ? c.created_at : latest), first.created_at);
    return {
      id: `prospect-claim-${p?.id ?? first.claim_id}`,
      type: 'prospect_to_verify' as const,
      title: i18n.t('hooks.adminNotifications.prospectToVerify', {
        ns: 'common',
        commercial: first.source_label,
        defaultValue: `Numéro déjà client · ${first.source_label}`,
      }),
      subtitle,
      createdAt,
      targetPath: p?.id ? `${PROSPECT_CLAIMS_PATH}?fiche=${encodeURIComponent(p.id)}` : PROSPECT_CLAIMS_PATH,
    };
  });
}

const NO_CLAIMS: readonly ProspectClaim[] = [];

/** Les fiches « À vérifier », pour la direction seulement (sinon : aucune requête, rien). */
function usePendingClaims() {
  const { hasPermission } = useAdminAuth();
  const canManageSales = hasPermission('canManageSales');
  const claims = useProspectClaims(canManageSales);
  return { canManageSales, claims, rows: canManageSales ? claims.data ?? NO_CLAIMS : NO_CLAIMS };
}

/**
 * Fetches all actionable items for the admin notification center.
 */
export function useAdminNotifications() {
  const pending = usePendingClaims();
  const base = useAdminActionNotifications();
  const { refetch: refetchBase } = base;
  const { refetch: refetchClaims } = pending.claims;
  const canManageSales = pending.canManageSales;
  const claimRows = pending.rows;
  const data = useMemo(() => {
    if (!base.data) return base.data;
    if (claimRows.length === 0) return base.data;
    return [...base.data, ...prospectClaimNotifications(claimRows)].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [base.data, claimRows]);
  return {
    data,
    isLoading: base.isLoading,
    isError: base.isError,
    refetch: async () => {
      await Promise.all([refetchBase(), canManageSales ? refetchClaims() : undefined]);
    },
  };
}

/** Dépôts, paiements et conteneurs à traiter (le fil commun à tous les rôles). */
function useAdminActionNotifications() {
  return useQuery({
    queryKey: ['admin-notifications'],
    staleTime: CACHE_CONFIG.STALE_TIME.LISTS,
    gcTime: CACHE_CONFIG.GC_TIME,
    queryFn: async () => {
      const [depositsRes, paymentsRes, cargo] = await Promise.all([
        supabaseAdmin
          .from('deposits')
          .select('id, user_id, status, amount_xaf, reference, created_at')
          .in('status', ACTIONABLE_DEPOSIT_STATUSES)
          .order('created_at', { ascending: false })
          .limit(50),
        supabaseAdmin
          .from('payments')
          .select('id, user_id, status, amount_xaf, amount_rmb, reference, method, created_at')
          .in('status', ACTIONABLE_PAYMENT_STATUSES)
          .order('created_at', { ascending: false })
          .limit(50),
        fetchCargoAlerts(),
      ]);

      if (depositsRes.error) throw depositsRes.error;
      if (paymentsRes.error) throw paymentsRes.error;

      const deposits = depositsRes.data || [];
      const payments = paymentsRes.data || [];

      const allUserIds = [
        ...new Set([
          ...deposits.map(d => d.user_id),
          ...payments.map(p => p.user_id),
        ]),
      ];

      let clientMap = new Map<string, { first_name: string; last_name: string }>();
      if (allUserIds.length > 0) {
        const { data: clients } = await supabaseAdmin
          .from('clients')
          .select('user_id, first_name, last_name')
          .in('user_id', allUserIds);
        clientMap = new Map(clients?.map(c => [c.user_id, c]) || []);
      }

      const getClientName = (userId: string) => {
        const client = clientMap.get(userId);
        return client ? `${client.first_name} ${client.last_name}` : i18n.t('hooks.adminNotifications.unknownClient', { ns: 'common', defaultValue: 'Client inconnu' });
      };

      const depositNotifications: AdminNotification[] = deposits.map(d => ({
        id: `deposit-${d.id}`,
        type: 'deposit_needs_review' as const,
        title: i18n.t('hooks.adminNotifications.depositNeedsReview', { ns: 'common', defaultValue: 'Dépôt à examiner' }),
        subtitle: `${getClientName(d.user_id)} — ${d.reference || ''}`,
        amount: d.amount_xaf,
        currency: 'XAF' as const,
        createdAt: d.created_at,
        targetPath: `/m/deposits/${d.id}`,
      }));

      const paymentNotifications: AdminNotification[] = payments.map(p => ({
        id: `payment-${p.id}`,
        type: p.status === 'processing'
          ? 'payment_processing' as const
          : 'payment_ready' as const,
        title: p.status === 'processing'
          ? i18n.t('hooks.adminNotifications.paymentProcessing', { ns: 'common', defaultValue: 'Paiement en cours' })
          : i18n.t('hooks.adminNotifications.paymentReady', { ns: 'common', defaultValue: 'Paiement à traiter' }),
        subtitle: `${getClientName(p.user_id)} — ${p.reference || ''}`,
        amount: p.amount_xaf,
        currency: 'XAF' as const,
        createdAt: p.created_at,
        targetPath: `/m/payments/${p.id}`,
      }));

      return [...depositNotifications, ...paymentNotifications, ...cargoNotifications(cargo)]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
  });
}

/**
 * Count of all actionable items (for badge display) — fiches « À vérifier »
 * comprises pour la direction (une par fiche, comme la liste).
 */
export function useAdminNotificationCount() {
  const pending = usePendingClaims();
  const base = useAdminActionCount();
  const claims = useMemo(() => groupClaimsByProspect(pending.rows).length, [pending.rows]);
  return {
    data: base.data === undefined && claims === 0 ? undefined : (base.data ?? 0) + claims,
    isLoading: base.isLoading,
  };
}

function useAdminActionCount() {
  return useQuery({
    queryKey: ['admin-notification-count'],
    staleTime: CACHE_CONFIG.STALE_TIME.LISTS,
    gcTime: CACHE_CONFIG.GC_TIME,
    queryFn: async () => {
      const [depositsRes, paymentsRes, cargo] = await Promise.all([
        supabaseAdmin
          .from('deposits')
          .select('id', { count: 'exact', head: true })
          .in('status', ACTIONABLE_DEPOSIT_STATUSES),
        supabaseAdmin
          .from('payments')
          .select('id', { count: 'exact', head: true })
          .in('status', ACTIONABLE_PAYMENT_STATUSES),
        fetchCargoAlerts(),
      ]);

      return (depositsRes.count || 0) + (paymentsRes.count || 0) + cargo.filter((s) => cargoAlertKind(s) !== null).length;
    },
  });
}

/**
 * Split counts of actionable deposits and payments
 */
/** Les compteurs à rafraîchir après tout geste d'argent (badges des onglets, cloche). */
export const ACTION_BADGE_KEYS: ReadonlyArray<readonly string[]> = [['admin-notification-count'], ['admin-notifications'], ['admin-actionable-counts']];
export function invalidateActionBadges(qc: { invalidateQueries: (o: { queryKey: readonly unknown[] }) => unknown }): void {
  for (const k of ACTION_BADGE_KEYS) qc.invalidateQueries({ queryKey: k });
}

export function useAdminActionableCounts() {
  return useQuery({
    queryKey: ['admin-actionable-counts'],
    staleTime: CACHE_CONFIG.STALE_TIME.LISTS,
    gcTime: CACHE_CONFIG.GC_TIME,
    queryFn: async () => {
      const [depositsRes, paymentsRes] = await Promise.all([
        supabaseAdmin
          .from('deposits')
          .select('id', { count: 'exact', head: true })
          .in('status', ACTIONABLE_DEPOSIT_STATUSES),
        supabaseAdmin
          .from('payments')
          .select('id', { count: 'exact', head: true })
          .in('status', ACTIONABLE_PAYMENT_STATUSES),
      ]);

      return {
        deposits: depositsRes.count || 0,
        payments: paymentsRes.count || 0,
      };
    },
  });
}
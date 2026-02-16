// ============================================================
// Admin Notifications — Actionable items needing attention
// Uses supabaseAdmin (admin session)
// ============================================================
import { useQuery } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { CACHE_CONFIG } from '@/lib/constants';
import type { Enums } from '@/integrations/supabase/types';

export type AdminNotificationType =
  | 'deposit_needs_review'
  | 'deposit_needs_correction'
  | 'payment_ready'
  | 'payment_processing';

export interface AdminNotification {
  id: string;
  type: AdminNotificationType;
  title: string;
  subtitle: string;
  amount: number;
  currency: 'XAF' | 'RMB';
  createdAt: string;
  targetPath: string;
}

const ACTIONABLE_DEPOSIT_STATUSES: Enums<'deposit_status'>[] = ['proof_submitted', 'admin_review'];
const ACTIONABLE_PAYMENT_STATUSES: Enums<'payment_status'>[] = ['ready_for_payment', 'cash_scanned', 'processing'];

/**
 * Fetches all actionable items for the admin notification center.
 */
export function useAdminNotifications() {
  return useQuery({
    queryKey: ['admin-notifications'],
    staleTime: CACHE_CONFIG.STALE_TIME.LISTS,
    gcTime: CACHE_CONFIG.GC_TIME,
    queryFn: async () => {
      const [depositsRes, paymentsRes] = await Promise.all([
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

      let profileMap = new Map<string, { first_name: string; last_name: string }>();
      if (allUserIds.length > 0) {
        const { data: profiles } = await supabaseAdmin
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', allUserIds);
        profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      }

      const getClientName = (userId: string) => {
        const profile = profileMap.get(userId);
        return profile ? `${profile.first_name} ${profile.last_name}` : 'Client inconnu';
      };

      const depositNotifications: AdminNotification[] = deposits.map(d => ({
        id: `deposit-${d.id}`,
        type: 'deposit_needs_review' as const,
        title: 'Dépôt à examiner',
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
          ? 'Paiement en cours'
          : 'Paiement à traiter',
        subtitle: `${getClientName(p.user_id)} — ${p.reference || ''}`,
        amount: p.amount_xaf,
        currency: 'XAF' as const,
        createdAt: p.created_at,
        targetPath: `/m/payments/${p.id}`,
      }));

      return [...depositNotifications, ...paymentNotifications]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
  });
}

/**
 * Count of all actionable items (for badge display)
 */
export function useAdminNotificationCount() {
  return useQuery({
    queryKey: ['admin-notification-count'],
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

      return (depositsRes.count || 0) + (paymentsRes.count || 0);
    },
  });
}

/**
 * Split counts of actionable deposits and payments
 */
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
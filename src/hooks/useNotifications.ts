// ============================================================
// Notifications du client (app client). La table `notifications` est
// alimentée par les RPC métier (validate_deposit, process_payment…) avec
// `user_id` = le client ; RLS « Users can view/update own notifications ».
// Ce hook était resté un bouchon (« table doesn't exist yet ») alors que la
// table, ses politiques et l'abonnement Realtime (useRealtimeInvalidation)
// existaient : la cloche, la pastille et la page restaient vides.
// ============================================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

/** Types écrits par les RPC (cf. migrations) — les inconnus retombent sur « bell ». */
export type NotificationType =
  | 'deposit_validated'
  | 'deposit_rejected'
  | 'deposit_correction_needed'
  | 'deposit_correction_requested'
  | 'payment_created'
  | 'payment_processing'
  | 'payment_completed'
  | 'payment_rejected'
  | 'payment_awaiting_beneficiary'
  | 'cash_payment_ready'
  | 'kyc_approved'
  | (string & {});

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata: {
    deposit_id?: string;
    payment_id?: string;
    reference?: string;
    amount_xaf?: number;
    new_balance?: number;
    reason?: string;
  };
  is_read: boolean;
  created_at: string;
}

const NOTIFICATIONS_KEY = ['my-notifications'] as const;
const UNREAD_KEY = ['unread-notification-count'] as const;

export function useMyNotifications() {
  return useQuery({
    queryKey: NOTIFICATIONS_KEY,
    staleTime: 10_000,
    queryFn: async () => {
      const user = await getCurrentUser();
      if (!user) return [] as Notification[];
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []).map((n) => ({ ...n, metadata: (n.metadata ?? {}) as Notification['metadata'] })) as Notification[];
    },
  });
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: UNREAD_KEY,
    staleTime: 10_000,
    queryFn: async () => {
      const user = await getCurrentUser();
      if (!user) return 0;
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId);
      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      queryClient.invalidateQueries({ queryKey: UNREAD_KEY });
    },
  });
}

export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const user = await getCurrentUser();
      if (!user) return { success: false };
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      queryClient.invalidateQueries({ queryKey: UNREAD_KEY });
    },
  });
}

export function getNotificationStyle(type: NotificationType) {
  switch (type) {
    case 'deposit_validated':
    case 'payment_completed':
    case 'kyc_approved':
      return { icon: 'check-circle', color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' };
    case 'deposit_rejected':
    case 'payment_rejected':
      return { icon: 'x-circle', color: 'text-red-500', bgColor: 'bg-red-500/10' };
    case 'deposit_correction_needed':
    case 'deposit_correction_requested':
    case 'payment_awaiting_beneficiary':
      return { icon: 'alert-circle', color: 'text-amber-500', bgColor: 'bg-amber-500/10' };
    default:
      return { icon: 'bell', color: 'text-primary', bgColor: 'bg-primary/10' };
  }
}

export function getNotificationPath(notification: Notification): string {
  const { type, metadata } = notification;
  if (type.startsWith('deposit_') && metadata.deposit_id) return `/deposits/${metadata.deposit_id}`;
  if ((type.startsWith('payment_') || type === 'cash_payment_ready') && metadata.payment_id) return `/payments/${metadata.payment_id}`;
  return '/notifications';
}

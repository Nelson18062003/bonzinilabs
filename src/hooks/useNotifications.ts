import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type NotificationType =
  | 'deposit_validated'
  | 'deposit_rejected'
  | 'deposit_correction_needed'
  | 'deposit_correction_requested'
  | 'payment_created'
  | 'payment_processing'
  | 'payment_completed'
  | 'payment_rejected';

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

export function useMyNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Notification[];
    },
    enabled: !!user,
  });
}

export function useUnreadNotificationCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['unread-notification-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('is_read', false);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user,
  });
}

export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-notification-count'] });
    },
  });
}

export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('is_read', false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-notification-count'] });
    },
  });
}

export function getNotificationStyle(type: NotificationType) {
  switch (type) {
    case 'deposit_validated':
    case 'payment_completed':
      return { icon: 'check-circle', color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' };
    case 'deposit_rejected':
    case 'payment_rejected':
      return { icon: 'x-circle', color: 'text-red-500', bgColor: 'bg-red-500/10' };
    case 'deposit_correction_needed':
    case 'deposit_correction_requested':
      return { icon: 'alert-circle', color: 'text-amber-500', bgColor: 'bg-amber-500/10' };
    case 'payment_created':
      return { icon: 'plus-circle', color: 'text-blue-500', bgColor: 'bg-blue-500/10' };
    case 'payment_processing':
      return { icon: 'loader', color: 'text-violet-500', bgColor: 'bg-violet-500/10' };
    default:
      return { icon: 'bell', color: 'text-primary', bgColor: 'bg-primary/10' };
  }
}

export function getNotificationPath(notification: Notification): string {
  const { type, metadata } = notification;
  if (type.startsWith('deposit_') && metadata.deposit_id) return `/deposits/${metadata.deposit_id}`;
  if (type.startsWith('payment_') && metadata.payment_id) return `/payments/${metadata.payment_id}`;
  return '/notifications';
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Cache configuration
const STALE_TIME = 30 * 1000; // 30 seconds
const CACHE_TIME = 5 * 60 * 1000; // 5 minutes

export type NotificationType =
  | 'deposit_validated'
  | 'deposit_rejected'
  | 'deposit_correction_needed'
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

// Helper to get current user
async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

/**
 * Fetch all notifications for the current user
 */
export function useMyNotifications() {
  return useQuery({
    queryKey: ['my-notifications'],
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    queryFn: async () => {
      const user = await getCurrentUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as Notification[];
    },
  });
}

/**
 * Get count of unread notifications for badge display
 */
export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ['unread-notification-count'],
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    queryFn: async () => {
      const user = await getCurrentUser();
      if (!user) return 0;

      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;
      return count ?? 0;
    },
  });
}

/**
 * Mark a single notification as read
 */
export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-notification-count'] });
    },
  });
}

/**
 * Mark all notifications as read
 */
export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const user = await getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-notification-count'] });
    },
  });
}

/**
 * Get icon and color for notification type
 */
export function getNotificationStyle(type: NotificationType) {
  switch (type) {
    case 'deposit_validated':
      return {
        icon: 'check-circle',
        color: 'text-emerald-500',
        bgColor: 'bg-emerald-500/10',
      };
    case 'deposit_rejected':
      return {
        icon: 'x-circle',
        color: 'text-red-500',
        bgColor: 'bg-red-500/10',
      };
    case 'deposit_correction_needed':
      return {
        icon: 'alert-circle',
        color: 'text-amber-500',
        bgColor: 'bg-amber-500/10',
      };
    case 'payment_completed':
      return {
        icon: 'check-circle',
        color: 'text-emerald-500',
        bgColor: 'bg-emerald-500/10',
      };
    case 'payment_rejected':
      return {
        icon: 'x-circle',
        color: 'text-red-500',
        bgColor: 'bg-red-500/10',
      };
    default:
      return {
        icon: 'bell',
        color: 'text-primary',
        bgColor: 'bg-primary/10',
      };
  }
}

/**
 * Get navigation path for notification click
 */
export function getNotificationPath(notification: Notification): string {
  const { type, metadata } = notification;

  if (type.startsWith('deposit_') && metadata.deposit_id) {
    return `/deposits/${metadata.deposit_id}`;
  }

  if (type.startsWith('payment_') && metadata.payment_id) {
    return `/payments/${metadata.payment_id}`;
  }

  return '/notifications';
}

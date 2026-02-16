// Client notifications - stub until notifications table exists
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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

// Notifications table doesn't exist yet - return empty arrays
export function useMyNotifications() {
  return useQuery({
    queryKey: ['my-notifications'],
    queryFn: async () => [] as Notification[],
  });
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ['unread-notification-count'],
    queryFn: async () => 0,
  });
}

export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (_notificationId: string) => ({ success: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-notification-count'] });
    },
  });
}

export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => ({ success: true }),
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
      return { icon: 'alert-circle', color: 'text-amber-500', bgColor: 'bg-amber-500/10' };
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
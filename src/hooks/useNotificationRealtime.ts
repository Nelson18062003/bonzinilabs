import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

/**
 * Subscribes to realtime INSERT events on the notifications table
 * for the current user. Invalidates query caches and shows a toast.
 * Mount once in MobileLayout so it runs while the client is logged in.
 */
export function useNotificationRealtime() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('client-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const notification = payload.new as { title?: string; message?: string };
          queryClient.invalidateQueries({ queryKey: ['my-notifications'] });
          queryClient.invalidateQueries({ queryKey: ['unread-notification-count'] });
          toast(notification.title ?? 'Nouvelle notification', {
            description: notification.message,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);
}

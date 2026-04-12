-- Enable Supabase Realtime on the notifications table
-- RLS is already active, so each client only receives their own notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

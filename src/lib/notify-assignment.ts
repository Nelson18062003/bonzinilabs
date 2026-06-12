// ============================================================
// Helper : appel fire-and-forget de l'Edge Function notify-admin-assignment
// pour pinger le groupe Telegram admin à chaque claim/assign/unassign.
// ============================================================
import { supabaseAdmin } from '@/integrations/supabase/client';

interface AssignmentNotificationPayload {
  conversation_id: string;
  event_type: 'claim' | 'assign' | 'unassign';
  new_admin_user_role_id: string | null;
  changed_by_admin_user_id: string;
}

export async function notifyAssignment(payload: AssignmentNotificationPayload): Promise<void> {
  try {
    // Note : on appelle via supabaseAdmin.functions.invoke pour bénéficier
    // de l'auth automatique. Si ça échoue silencieusement, le claim reste
    // valide en BDD — la notif Telegram est juste une amélioration UX.
    const { error } = await supabaseAdmin.functions.invoke('notify-admin-assignment', {
      body: payload,
    });
    if (error) console.warn('notify-admin-assignment failed', error);
  } catch (e) {
    console.warn('notify-admin-assignment threw', e);
  }
}

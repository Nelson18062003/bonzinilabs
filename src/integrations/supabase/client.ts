// Supabase clients with SEPARATE session storage for Client and Admin
import { createClient, processLock } from '@supabase/supabase-js';
import type { Database } from './types';
import { VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY } from '@/lib/env';

/**
 * Supabase client for CLIENT app
 * Uses a unique storageKey to avoid GoTrueClient instance conflicts
 */
export const supabase = createClient<Database>(
  VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storageKey: 'bonzini-client-auth',
      persistSession: true,
      autoRefreshToken: true,
      // OAuth (Google): PKCE + lecture du ?code= au retour sur /auth/callback.
      flowType: 'pkce',
      detectSessionInUrl: true,
      // Verrou en mémoire (processLock) au lieu du Navigator LockManager :
      // le LockManager se bloque sur Safari iOS et fait échouer la connexion
      // ("Acquiring an exclusive Navigator LockManager lock ... timed out").
      lock: processLock,
    },
  }
);

/**
 * Supabase client for ADMIN app
 * Uses a different storageKey to completely isolate Admin sessions from Client sessions
 */
export const supabaseAdmin = createClient<Database>(
  VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storageKey: 'bonzini-admin-auth',
      persistSession: true,
      autoRefreshToken: true,
      // L'app admin n'utilise PAS l'OAuth. On désactive la détection du
      // ?code= pour éviter toute course avec le client sur /auth/callback.
      // (Mitigation complémentaire ; la garde primaire est de ne jamais
      // monter supabaseAdmin sur la route de callback — cf. design-social-login.md §2.)
      detectSessionInUrl: false,
      // Idem côté admin : évite le blocage du Navigator LockManager sur iOS.
      lock: processLock,
    },
  }
);

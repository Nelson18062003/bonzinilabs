// Supabase clients with SEPARATE session storage for Client and Admin
import { createClient } from '@supabase/supabase-js';
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
    },
  }
);

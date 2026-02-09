// Supabase clients with SEPARATE session storage for Client and Admin
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY } from '@/lib/env';

// Custom storage adapter for CLIENT sessions
const clientStorage = {
  getItem: (key: string) => localStorage.getItem(`client-${key}`),
  setItem: (key: string, value: string) => localStorage.setItem(`client-${key}`, value),
  removeItem: (key: string) => localStorage.removeItem(`client-${key}`),
};

// Custom storage adapter for ADMIN sessions
const adminStorage = {
  getItem: (key: string) => localStorage.getItem(`admin-${key}`),
  setItem: (key: string, value: string) => localStorage.setItem(`admin-${key}`, value),
  removeItem: (key: string) => localStorage.removeItem(`admin-${key}`),
};

/**
 * Supabase client for CLIENT app
 * Sessions are stored with 'client-' prefix in localStorage
 */
export const supabase = createClient<Database>(
  VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: clientStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

/**
 * Supabase client for ADMIN app
 * Sessions are stored with 'admin-' prefix in localStorage
 * This ensures Admin and Client sessions are completely isolated
 */
export const supabaseAdmin = createClient<Database>(
  VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: adminStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

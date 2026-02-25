/**
 * Environment variable access
 * Lovable Cloud automatically provides these variables.
 */

export const VITE_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const VITE_SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
export const VITE_SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || '';

export const env = {
  VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY,
  VITE_SUPABASE_PROJECT_ID,
};

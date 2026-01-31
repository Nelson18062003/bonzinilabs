import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Environment Validation', () => {
  const originalEnv = { ...import.meta.env };

  beforeEach(() => {
    // Reset module cache
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original env
    Object.assign(import.meta.env, originalEnv);
  });

  it('should validate successfully with all required env vars', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'test-key');
    vi.stubEnv('VITE_SUPABASE_PROJECT_ID', 'test-project');

    expect(() => import('@/lib/env')).not.toThrow();
  });

  it('should have exported env variables', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'test-key');
    vi.stubEnv('VITE_SUPABASE_PROJECT_ID', 'test-project');

    const { VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_PROJECT_ID } =
      await import('@/lib/env');

    expect(VITE_SUPABASE_URL).toBe('https://test.supabase.co');
    expect(VITE_SUPABASE_PUBLISHABLE_KEY).toBe('test-key');
    expect(VITE_SUPABASE_PROJECT_ID).toBe('test-project');
  });
});

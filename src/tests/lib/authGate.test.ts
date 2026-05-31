import { describe, it, expect } from 'vitest';
import { isProviderEmailVerified, isProfileComplete } from '@/lib/authGate';

describe('isProviderEmailVerified (finding H2 — fail-closed)', () => {
  it('accepts a Google identity with email_verified === true', () => {
    expect(
      isProviderEmailVerified({
        identities: [{ provider: 'google', identity_data: { email_verified: true } }],
      }),
    ).toBe(true);
  });

  it('REJECTS Google email_verified === false', () => {
    expect(
      isProviderEmailVerified({
        identities: [{ provider: 'google', identity_data: { email_verified: false } }],
      }),
    ).toBe(false);
  });

  it('REJECTS the string "true" (must be strict boolean — anti-spoof)', () => {
    expect(
      isProviderEmailVerified({
        identities: [{ provider: 'google', identity_data: { email_verified: 'true' } }],
      }),
    ).toBe(false);
  });

  it('REJECTS a missing email_verified claim', () => {
    expect(
      isProviderEmailVerified({
        identities: [{ provider: 'google', identity_data: {} }],
      }),
    ).toBe(false);
  });

  it('REJECTS when identity_data is null/undefined', () => {
    expect(
      isProviderEmailVerified({ identities: [{ provider: 'google', identity_data: null }] }),
    ).toBe(false);
    expect(isProviderEmailVerified({ identities: [{ provider: 'google' }] })).toBe(false);
  });

  it('treats a pure email/password account (no OAuth identity) as verified — Supabase handles it', () => {
    expect(
      isProviderEmailVerified({ identities: [{ provider: 'email', identity_data: {} }] }),
    ).toBe(true);
  });

  it('treats no identities at all as verified (not the OAuth path)', () => {
    expect(isProviderEmailVerified({})).toBe(true);
    expect(isProviderEmailVerified({ identities: null })).toBe(true);
    expect(isProviderEmailVerified({ identities: [] })).toBe(true);
  });

  it('accepts when at least one OAuth identity is verified among several', () => {
    expect(
      isProviderEmailVerified({
        identities: [
          { provider: 'email', identity_data: {} },
          { provider: 'google', identity_data: { email_verified: true } },
        ],
      }),
    ).toBe(true);
  });
});

describe('isProfileComplete (finding M1 — phone is the gate, fail-closed)', () => {
  it('is complete when phone is present', () => {
    expect(isProfileComplete({ phone: '+237699000000' })).toBe(true);
  });

  it('is complete with phone even if country is absent (legacy admin-created clients)', () => {
    // country is intentionally NOT part of the gate
    expect(isProfileComplete({ phone: '+237699000000' })).toBe(true);
  });

  it('is INCOMPLETE when phone is missing/empty/null', () => {
    expect(isProfileComplete({ phone: '' })).toBe(false);
    expect(isProfileComplete({ phone: null })).toBe(false);
    expect(isProfileComplete({})).toBe(false);
  });

  it('FAIL-CLOSED: incomplete when profile is null/undefined (fetch error)', () => {
    expect(isProfileComplete(null)).toBe(false);
    expect(isProfileComplete(undefined)).toBe(false);
  });
});

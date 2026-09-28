import { describe, it, expect, afterEach, vi } from 'vitest';
import { staffHomeFor } from '@/lib/staffHome';
import { isNativeApp } from '@/lib/nativeApp';
import { ROLE_PERMISSIONS, type AppRole } from '@/contexts/AdminAuthContext';

describe('staffHomeFor — une connexion, chacun chez soi', () => {
  it('envoie chaque rôle vers son espace', () => {
    expect(staffHomeFor('cash_agent')).toBe('/a');
    expect(staffHomeFor('receptionist')).toBe('/r');
    expect(staffHomeFor('warehouse_agent')).toBe('/w');
    for (const r of ['super_admin', 'ops', 'support', 'customer_success', 'treasurer'] as AppRole[]) expect(staffHomeFor(r)).toBe('/m');
    expect(staffHomeFor(null)).toBe('/m');
  });

  // Pas de boucle : l'espace choisi doit accepter le rôle (mêmes règles que les gardes de route).
  it('chaque rôle a le droit d’entrer dans l’espace où on l’envoie', () => {
    for (const role of Object.keys(ROLE_PERMISSIONS) as AppRole[]) {
      const p = ROLE_PERMISSIONS[role];
      const home = staffHomeFor(role);
      if (home === '/a') expect(role).toBe('cash_agent');
      if (home === '/r') expect(p.canReceiveParcels).toBe(true);
      if (home === '/w') expect(p.canReceiveAtDestination || p.canReleaseParcels).toBe(true);
      if (home === '/m') expect(['receptionist', 'warehouse_agent']).not.toContain(role);
    }
  });
});

describe('isNativeApp', () => {
  afterEach(() => { vi.unstubAllGlobals(); delete (window as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView; });
  it('faux dans un navigateur ordinaire', () => expect(isNativeApp()).toBe(false));
  it('vrai dans la WebView de l’app', () => {
    (window as unknown as { ReactNativeWebView: unknown }).ReactNativeWebView = { postMessage: () => {} };
    expect(isNativeApp()).toBe(true);
  });
  it('vrai avec l’agent utilisateur de l’app', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone) AppleWebKit Mobile BonziniHQ/1.0.0' });
    expect(isNativeApp()).toBe(true);
  });
});

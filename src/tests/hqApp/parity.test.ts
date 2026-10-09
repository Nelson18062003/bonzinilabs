// L'app BONZINI HQ (hq-app/) recopie quelques règles du site : elles ne
// doivent jamais diverger (espace de départ par rôle, permissions utiles aux
// écrans natifs, lecture des codes scannés).
import { describe, it, expect } from 'vitest';
import { ROLE_PERMISSIONS, type AppRole } from '@/contexts/AdminAuthContext';
import { staffHomeFor, staffLoginFor } from '@/lib/staffHome';
import { normalizeCustomerCode } from '@/lib/customerCode';
import { parseCashQRCode } from '@/hooks/useCashPayment';
import { can, staffHome, ROLE_LABEL } from '../../../hq-app/src/roles';
import { cashPaymentId, customerCode, packageCode, routeScan } from '../../../hq-app/src/scan';
import { parsePackageCode } from '@/lib/airPackage';
import { ACTIONABLE_DEPOSIT_STATUSES, ACTIONABLE_PAYMENT_STATUSES } from '@/lib/actionable';
import { CASH_TO_HAND_OVER_STATUSES } from '@/hooks/useAgentCashPayments';
import { BADGE_TABS, CASH_PENDING, DEPOSITS_TO_PROCESS, PAYMENTS_TO_PROCESS } from '../../../hq-app/src/statuses';
import { tabsFor } from '../../../hq-app/src/tabs';
import { LOGIN_PATHS, sitePathFromUrl, staffPath } from '../../../hq-app/src/links';

const ROLES = Object.keys(ROLE_PERMISSIONS) as AppRole[];

describe('BONZINI HQ ↔ site', () => {
  it('connaît tous les rôles du site', () => {
    expect(Object.keys(ROLE_LABEL).sort()).toEqual([...ROLES].sort());
  });

  it('envoie chaque rôle au même espace que le site', () => {
    for (const r of ROLES) expect(staffHome(r)).toBe(staffHomeFor(r));
  });

  it('reconnaît la page de connexion de chaque rôle (commercial : « /v/login »)', () => {
    for (const r of ROLES) expect(LOGIN_PATHS, r).toContain(staffLoginFor(r));
  });

  it('a les mêmes permissions que le site pour ses écrans natifs', () => {
    const map = { viewClients: 'canViewClients', viewDeposits: 'canViewDeposits', viewPayments: 'canViewPayments', manageRates: 'canManageRates', viewTreasury: 'canViewTreasury', supportChat: 'canAccessSupportChat', viewCargo: 'canViewCargo', receiveParcels: 'canReceiveParcels', destination: 'canReceiveAtDestination' } as const;
    for (const r of ROLES) for (const [k, web] of Object.entries(map)) {
      expect(can(r, k as keyof typeof map), `${r} · ${k}`).toBe(ROLE_PERMISSIONS[r][web]);
    }
  });

  it('lit les codes clients comme le site', () => {
    for (const s of ['BZ-482913', 'bz 482913', 'https://bonzinilabs.com/c/BZ-482913', 'BZ482913']) {
      expect(customerCode(s), s).toBe(normalizeCustomerCode(s));
    }
    expect(customerCode('SF1234567890')).toBeNull();
  });

  it('lit les numéros de paquet comme le site', () => {
    for (const s of ['PQ-000123', 'pq 12', 'PQ1234567', 'BZ-482913', 'RC-000123-01']) {
      expect(packageCode(s), s).toBe(parsePackageCode(s));
    }
  });

  it('lit les QR de paiement cash comme le site', () => {
    const id = '0f8fad5b-d9cb-469f-a165-70867728950e';
    for (const s of [JSON.stringify({ type: 'BONZINI_CASH_PAYMENT', id, v: 1 }), `https://bonzinilabs.com/pay?paymentId=${id}`]) {
      expect(cashPaymentId(s)).toBe(parseCashQRCode(s).isValid ? parseCashQRCode(s).paymentId : null);
    }
  });

  it('oriente un scan selon le rôle', () => {
    const cash = JSON.stringify({ type: 'BONZINI_CASH_PAYMENT', id: '0f8fad5b-d9cb-469f-a165-70867728950e', v: 1 });
    expect(routeScan('cash_agent', cash)).toEqual({ kind: 'open', path: '/a/payment/0f8fad5b-d9cb-469f-a165-70867728950e' });
    expect(routeScan('ops', cash)).toEqual({ kind: 'open', path: '/m/payments/0f8fad5b-d9cb-469f-a165-70867728950e' });
    expect(routeScan('receptionist', 'https://bonzinilabs.com/c/BZ-482913')).toEqual({ kind: 'deliver', path: '/r/new', text: 'BZ-482913' });
    expect(routeScan('receptionist', 'SF1234567890')).toEqual({ kind: 'deliver', path: '/r/new', text: 'SF1234567890' });
    expect(routeScan('warehouse_agent', 'BZ-482913')).toEqual({ kind: 'deliver', path: '/w/remise', text: 'BZ-482913' });
    expect(routeScan('super_admin', 'BZ-482913')).toEqual({ kind: 'open', path: '/m/clients/scan?code=BZ-482913' });
    expect(routeScan('treasurer', 'BZ-482913').kind).toBe('unknown');
    expect(routeScan('commercial', 'BZ-482913').kind).toBe('unknown');
    expect(routeScan('commercial', cash).kind).toBe('unknown');
    // Paquet avion : la réception (et ops) ouvre sa fiche, Douala le reçoit.
    expect(routeScan('receptionist', 'PQ-000123')).toEqual({ kind: 'open', path: '/r/paquets?code=PQ-000123' });
    expect(routeScan('ops', 'pq 123')).toEqual({ kind: 'open', path: '/r/paquets?code=PQ-000123' });
    expect(routeScan('warehouse_agent', 'PQ-000123')).toEqual({ kind: 'open', path: '/w/arrivees?paquet=PQ-000123' });
    expect(routeScan('commercial', 'PQ-000123').kind).toBe('unknown');
    expect(routeScan('receptionist', 'RC-000123-01')).toEqual({ kind: 'deliver', path: '/r/new', text: 'RC-000123-01' });
  });

  it('compte « à traiter » avec les mêmes statuts que le site', () => {
    expect([...DEPOSITS_TO_PROCESS].sort()).toEqual([...ACTIONABLE_DEPOSIT_STATUSES].sort());
    expect([...PAYMENTS_TO_PROCESS].sort()).toEqual([...ACTIONABLE_PAYMENT_STATUSES].sort());
    expect([...CASH_PENDING].sort()).toEqual([...CASH_TO_HAND_OVER_STATUSES].sort());
  });

  it('pose chaque pastille sur un onglet qui existe', () => {
    const keys = (r: AppRole) => tabsFor(r).map((t) => t.key);
    expect(keys('super_admin')).toEqual(expect.arrayContaining([...BADGE_TABS.admin]));
    for (const r of ['receptionist', 'warehouse_agent', 'cash_agent'] as const) {
      expect(keys(r)).toEqual(expect.arrayContaining([...BADGE_TABS[r]]));
    }
  });

  it('ouvre les liens entrants vers une page du personnel, et rien d’autre', () => {
    const id = '0b9f6f0e-1c1a-4c3e-9b1e-2f6a7d9c1e55';
    expect(sitePathFromUrl(`bonzinihq://open?path=${encodeURIComponent(`/m/deposits/${id}`)}`)).toBe(`/m/deposits/${id}`);
    expect(sitePathFromUrl(`bonzinihq:///m/payments/${id}`)).toBe(`/m/payments/${id}`);
    expect(sitePathFromUrl(`bonzinihq://a/payment/${id}`)).toBe(`/a/payment/${id}`);
    expect(sitePathFromUrl('https://www.bonzinilabs.com/m/cargo/track?ref=BZ-123')).toBe('/m/cargo/track?ref=BZ-123');
    expect(sitePathFromUrl('/w/arrivees')).toBe('/w/arrivees');
    // Refusés : autre site, espace client, connexion, remontée, javascript.
    expect(sitePathFromUrl('https://evil.example/m/deposits')).toBeNull();
    expect(sitePathFromUrl('https://www.bonzinilabs.com/wallet')).toBeNull();
    expect(sitePathFromUrl('bonzinihq://open?path=/m/login')).toBeNull();
    expect(sitePathFromUrl('bonzinihq://open?path=/m/../wallet')).toBeNull();
    expect(sitePathFromUrl('javascript:alert(1)')).toBeNull();
    expect(sitePathFromUrl('bonzinihq://open?path=//evil.example')).toBeNull();
  });

  it('accepte chaque page ouverte par une notification', () => {
    const id = '0b9f6f0e-1c1a-4c3e-9b1e-2f6a7d9c1e55';
    for (const p of [`/m/deposits/${id}`, `/m/payments/${id}`, `/a/payment/${id}`, `/m/support/${id}`, '/w/arrivees', '/v/prospects']) {
      expect(staffPath(p), p).toBe(p);
    }
  });
});

// L'app BONZINI HQ (hq-app/) recopie quelques règles du site : elles ne
// doivent jamais diverger (espace de départ par rôle, permissions utiles aux
// écrans natifs, lecture des codes scannés).
import { describe, it, expect } from 'vitest';
import { ROLE_PERMISSIONS, type AppRole } from '@/contexts/AdminAuthContext';
import { staffHomeFor } from '@/lib/staffHome';
import { normalizeCustomerCode } from '@/lib/customerCode';
import { parseCashQRCode } from '@/hooks/useCashPayment';
import { can, staffHome, ROLE_LABEL } from '../../../hq-app/src/roles';
import { cashPaymentId, customerCode, routeScan } from '../../../hq-app/src/scan';

const ROLES = Object.keys(ROLE_PERMISSIONS) as AppRole[];

describe('BONZINI HQ ↔ site', () => {
  it('connaît tous les rôles du site', () => {
    expect(Object.keys(ROLE_LABEL).sort()).toEqual([...ROLES].sort());
  });

  it('envoie chaque rôle au même espace que le site', () => {
    for (const r of ROLES) expect(staffHome(r)).toBe(staffHomeFor(r));
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
  });
});

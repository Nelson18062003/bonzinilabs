import { describe, it, expect } from 'vitest';
import { isAssignable, packageClientCodes, parsePackageCode, weightGauge } from '@/lib/airPackage';
import { parseWarehouseScan } from '@/lib/warehouse';
import { awbLabel, formatAwb, isProvisionalAwb } from '@/lib/airShipment';

describe('Paquets avion — lecture des codes', () => {
  it('lit un numéro de paquet comme le serveur (air_package_code)', () => {
    expect(parsePackageCode('PQ-000123')).toBe('PQ-000123');
    expect(parsePackageCode('pq 12')).toBe('PQ-000012');
    expect(parsePackageCode('PQ1234567')).toBe('PQ-1234567');
    expect(parsePackageCode('BZ-100045')).toBeNull();
  });

  it('un paquet n’est jamais pris pour un client (six chiffres) ni pour un colis', () => {
    expect(parseWarehouseScan('PQ-100045')).toEqual({ kind: 'package', no: 'PQ-100045' });
    expect(parseWarehouseScan('PQ-000045')).toEqual({ kind: 'package', no: 'PQ-000045' });
    expect(parseWarehouseScan('RC-000123-01')).toEqual({ kind: 'parcel', no: 'RC-000123-01' });
    expect(parseWarehouseScan('https://bonzinilabs.com/c/BZ-482913?p=RC-000123-03')).toEqual({ kind: 'parcel', no: 'RC-000123-03' });
    expect(parseWarehouseScan('BZ-482913')).toEqual({ kind: 'customer', code: 'BZ-482913' });
  });
});

describe('Paquets avion — poids et état', () => {
  it('jauge de 32 kg', () => {
    expect(weightGauge({ net_weight_kg: 16, max_weight_kg: 32 })).toMatchObject({ ratio: 0.5, left: 16, tone: 'ok' });
    expect(weightGauge({ net_weight_kg: 28, max_weight_kg: 32 }).tone).toBe('near');
    expect(weightGauge({ net_weight_kg: 32, max_weight_kg: 32 })).toMatchObject({ ratio: 1, left: 0, tone: 'full' });
  });

  it('seul un paquet fermé (ou refusé) et libre part', () => {
    expect(isAssignable({ status: 'sealed', air_shipment_id: null })).toBe(true);
    expect(isAssignable({ status: 'refused', air_shipment_id: null })).toBe(true);
    expect(isAssignable({ status: 'open', air_shipment_id: null })).toBe(false);
    expect(isAssignable({ status: 'sealed', air_shipment_id: 'a1' })).toBe(false);
  });

  it('liste les clients d’un paquet une seule fois', () => {
    const c = (code: string) => ({ client: { customer_code: code } as never });
    expect(packageClientCodes([c('BZ-1'), c('BZ-2'), c('BZ-1')])).toEqual(['BZ-1', 'BZ-2']);
  });
});

describe('LTA provisoire', () => {
  it('se dit « à venir »', () => {
    expect(isProvisionalAwb('PROV-AB12CD')).toBe(true);
    expect(awbLabel({ awb_number: 'PROV-AB12CD' })).toBe('LTA à venir');
    expect(formatAwb('PROV-AB12CD')).toBe('à venir');
    expect(awbLabel({ awb_number: '07112345675' })).toBe('LTA 071-12345675');
  });
});

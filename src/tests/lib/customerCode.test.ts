import { describe, it, expect } from 'vitest';
import {
  normalizeCustomerCode,
  isCustomerCode,
  customerQrPayload,
  isLocationConfigured,
  parseShippingSettings,
  DEFAULT_SHIPPING_SETTINGS,
} from '@/lib/customerCode';

describe('normalizeCustomerCode', () => {
  it('accepte la forme canonique', () => {
    expect(normalizeCustomerCode('BZ-482913')).toBe('BZ-482913');
  });
  it('tolère casse, espaces et tiret oublié', () => {
    expect(normalizeCustomerCode(' bz 482913 ')).toBe('BZ-482913');
    expect(normalizeCustomerCode('bz482913')).toBe('BZ-482913');
    expect(normalizeCustomerCode('BZ - 482913')).toBe('BZ-482913');
  });
  it('extrait le code de l’URL encodée dans le QR', () => {
    expect(normalizeCustomerCode(customerQrPayload('BZ-482913'))).toBe('BZ-482913');
  });
  it('accepte six chiffres nus (relevé bancaire sans préfixe)', () => {
    expect(normalizeCustomerCode('482913')).toBe('BZ-482913');
  });
  it('refuse ce qui n’est pas un code', () => {
    expect(normalizeCustomerCode('')).toBeNull();
    expect(normalizeCustomerCode(null)).toBeNull();
    expect(normalizeCustomerCode('BZ-DP-2026-0042')).toBeNull();
    expect(normalizeCustomerCode('BZ-012345')).toBeNull(); // premier chiffre nul
    expect(normalizeCustomerCode('BZ-4829131')).toBeNull(); // sept chiffres
    expect(normalizeCustomerCode('Jean Dupont')).toBeNull();
  });
});

describe('isCustomerCode', () => {
  it('ne valide que la forme canonique', () => {
    expect(isCustomerCode('BZ-482913')).toBe(true);
    expect(isCustomerCode('bz-482913')).toBe(false);
    expect(isCustomerCode(undefined)).toBe(false);
  });
});

describe('réglages d’expédition', () => {
  it('les valeurs de départ ont deux destinations utilisables', () => {
    expect(isLocationConfigured(DEFAULT_SHIPPING_SETTINGS.warehouse)).toBe(true);
    expect(isLocationConfigured(DEFAULT_SHIPPING_SETTINGS.office)).toBe(true);
    expect(isLocationConfigured({ ...DEFAULT_SHIPPING_SETTINGS.office, addressZh: '  ' })).toBe(false);
  });
  it('un jsonb partiel ou mal formé retombe sur les valeurs de départ, champ par champ', () => {
    const parsed = parseShippingSettings({ company: { email: 'ops@example.com' }, warehouse: { phone: 42 }, office: null });
    expect(parsed.company.email).toBe('ops@example.com');
    expect(parsed.company.nameEn).toBe('Bonzini Labs');
    expect(parsed.warehouse.phone).toBe(DEFAULT_SHIPPING_SETTINGS.warehouse.phone);
    expect(parsed.office).toEqual(DEFAULT_SHIPPING_SETTINGS.office);
    expect(parseShippingSettings(undefined)).toEqual(DEFAULT_SHIPPING_SETTINGS);
  });
});

describe('recherche client par identifiant', () => {
  it('trouve un client par son code, avec ou sans préfixe', async () => {
    const { matchesClientSearch } = await import('@/lib/clientSearch');
    const c = { firstName: 'Jean', lastName: 'Dupont', phone: '+237 677 12 34 56', customerCode: 'BZ-482913' };
    expect(matchesClientSearch(c, 'BZ-482913')).toBe(true);
    expect(matchesClientSearch(c, 'bz482913')).toBe(true);
    expect(matchesClientSearch(c, '4829')).toBe(true);
    expect(matchesClientSearch(c, 'BZ-999999')).toBe(false);
  });
});

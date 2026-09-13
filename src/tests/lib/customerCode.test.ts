import { describe, it, expect } from 'vitest';
import {
  normalizeCustomerCode,
  isCustomerCode,
  customerQrPayload,
  isAddressConfigured,
  CHINA_RECEIVING_ADDRESSES,
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

describe('adresses de réception', () => {
  it('un placeholder entre crochets n’est pas une adresse configurée', () => {
    expect(isAddressConfigured(CHINA_RECEIVING_ADDRESSES[0])).toBe(false);
    expect(
      isAddressConfigured({
        label: { fr: 'x', zh: 'x', en: 'x' },
        addressZh: '广东省广州市…',
        recipientZh: 'Bonzini',
        phone: '+86 138 0000 0000',
      }),
    ).toBe(true);
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

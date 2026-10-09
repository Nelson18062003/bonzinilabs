// Mes équipes — sites et numéros du personnel (06/10) : les règles pures.
//   · le site proposé à la création dépend du rôle ;
//   · une réponse ancienne (sans `phones`) garde son numéro unique ;
//   · la recherche porte sur le site et sur tous les numéros ;
//   · l'éditeur de numéros accepte un principal vide pour un collaborateur,
//     et seulement pour lui.
import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { compareSites, defaultSiteFor, matchesMember, memberPhones, phoneCountry, profileFailedMessage } from '@/lib/team';
import { useClientPhonesEditor } from '@/components/clients/useClientPhonesEditor';
import type { StaffSite } from '@/hooks/useTeam';

const SITES: StaffSite[] = [
  { id: 's-gz', code: 'gz_office', label: 'Guangzhou · bureau', country_iso: 'CN', is_active: true },
  { id: 's-gzw', code: 'gz_warehouse', label: 'Guangzhou · entrepôt', country_iso: 'CN', is_active: true },
  { id: 's-dla', code: 'douala', label: 'Douala', country_iso: 'CM', is_active: true },
  { id: 's-yde', code: 'yaounde', label: 'Yaoundé', country_iso: 'CM', is_active: true },
  { id: 's-baf', code: null, label: 'Bafoussam', country_iso: 'CM', is_active: true },
];

describe('Mes équipes — le site proposé selon le rôle', () => {
  it('réceptionnaire → Guangzhou · bureau, agent d’entrepôt → Douala, aucun pour les autres', () => {
    expect(defaultSiteFor('receptionist', SITES)?.id).toBe('s-gz');
    expect(defaultSiteFor('warehouse_agent', SITES)?.id).toBe('s-dla');
    for (const role of ['super_admin', 'ops', 'commercial', 'cash_agent', 'treasurer', 'customs_broker'] as const) {
      expect(defaultSiteFor(role, SITES), role).toBeNull();
    }
  });

  it('rien tant que les sites ne sont pas chargés, ni si le site proposé est retiré', () => {
    expect(defaultSiteFor('receptionist', undefined)).toBeNull();
    expect(defaultSiteFor('receptionist', [{ ...SITES[0], is_active: false }])).toBeNull();
  });

  it('range les sites de départ d’abord, puis les sites ajoutés par nom', () => {
    const shuffled = [SITES[4], SITES[3], SITES[0], SITES[2], SITES[1]];
    expect([...shuffled].sort(compareSites).map((s) => s.label)).toEqual([
      'Guangzhou · bureau', 'Guangzhou · entrepôt', 'Douala', 'Yaoundé', 'Bafoussam',
    ]);
  });
});

describe('Mes équipes — les numéros d’un membre', () => {
  it('tous les numéros, principal d’abord', () => {
    const phones = [
      { phone_e164: '+8613826047731', country_iso: 'CN', label: null },
      { phone_e164: '+237671513376', country_iso: 'CM', label: 'MTN' },
    ];
    expect(memberPhones({ phone: '+8613826047731', phones })).toEqual(phones);
  });

  it('une réponse ancienne, sans `phones` : son numéro unique, tel quel', () => {
    expect(memberPhones({ phone: '+237 670 64 13 92' })).toEqual([{ phone_e164: '+237 670 64 13 92', country_iso: null, label: null }]);
    expect(memberPhones({ phone: null })).toEqual([]);
    expect(memberPhones({ phone: '  ', phones: [] })).toEqual([]);
  });

  it('le drapeau d’un numéro sans pays enregistré vient de son indicatif', () => {
    expect(phoneCountry({ phone_e164: '+8613826047731', country_iso: null })).toBe('CN');
    expect(phoneCountry({ phone_e164: '+237 670 64 13 92', country_iso: null })).toBe('CM');
    expect(phoneCountry({ phone_e164: '+237671513376', country_iso: 'CM' })).toBe('CM');
    expect(phoneCountry({ phone_e164: '6 71 51 33 76', country_iso: null })).toBeNull();
  });
});

describe('Mes équipes — la recherche', () => {
  const kevin = {
    first_name: 'Kevin', last_name: 'Nkolo', email: 'kevin.nkolo@bonzinilabs.com', phone: '+8613826047731',
    phones: [
      { phone_e164: '+8613826047731', country_iso: 'CN', label: null },
      { phone_e164: '+237671513376', country_iso: 'CM', label: 'WeChat' },
    ],
    site: { label: 'Guangzhou · bureau' },
  };

  it('trouve par le site, sans accents ni majuscules', () => {
    expect(matchesMember(kevin, 'guangzhou')).toBe(true);
    expect(matchesMember(kevin, 'kevin bureau')).toBe(true);
    expect(matchesMember(kevin, 'douala')).toBe(false);
    expect(matchesMember({ ...kevin, site: { label: 'Yaoundé' } }, 'yaounde')).toBe(true);
  });

  it('trouve par n’importe lequel de ses numéros, tapé avec ou sans espaces', () => {
    expect(matchesMember(kevin, '2604')).toBe(true);
    expect(matchesMember(kevin, '6 71 51 33 76')).toBe(true);
    expect(matchesMember(kevin, '+237 671')).toBe(true);
    expect(matchesMember(kevin, '699 00')).toBe(false);
  });

  it('trouve par le libellé d’un numéro, et par un ancien numéro unique', () => {
    expect(matchesMember(kevin, 'wechat')).toBe(true);
    expect(matchesMember({ first_name: 'Paul', last_name: 'Nana', email: null, phone: '+237 670 64 13 92' }, '670 64')).toBe(true);
  });
});

describe('Mes équipes — numéros ou site perdus à la création', () => {
  it('dit exactement quoi refaire, accordé', () => {
    expect(profileFailedMessage({ phones: true, site: true })).toMatch(/ses numéros et son site n’ont pas pu être enregistrés.*les saisir/);
    expect(profileFailedMessage({ phones: true, site: false })).toMatch(/ses numéros n’ont pas pu être enregistrés/);
    expect(profileFailedMessage({ phones: false, site: true })).toMatch(/son site n’a pas pu être enregistré\..*le choisir/);
    expect(profileFailedMessage({ phones: false, site: true })).toMatch(/^L’accès est créé/);
  });
});

describe('Éditeur de numéros — principal facultatif pour un collaborateur', () => {
  it('collaborateur : part d’une ligne vide, acceptée, qui n’envoie rien', () => {
    const { result } = renderHook(() => useClientPhonesEditor({ primaryOptional: true }));
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.primaryInvalid).toBe(false);
    expect(result.current.extrasInvalid).toBe(false);
    expect(result.current.toInputs()).toEqual([]);
    expect(result.current.changed).toBe(false);
  });

  it('collaborateur : un principal commencé doit être complet', () => {
    const { result } = renderHook(() => useClientPhonesEditor({ primaryOptional: true }));
    const key = result.current.rows[0].key;
    act(() => result.current.setPhone(key, { value: { country: 'CM', national: '6 77' } }));
    expect(result.current.primaryInvalid).toBe(true);
    act(() => result.current.setPhone(key, { value: { country: 'CM', national: '6 77 21 45 98' } }));
    expect(result.current.primaryInvalid).toBe(false);
    expect(result.current.changed).toBe(true);
    expect(result.current.toInputs()).toEqual([{ phone_e164: '+237677214598', country_iso: 'CM', label: null }]);
  });

  it('collaborateur : deux numéros, dont un chinois « WeChat », au format attendu par team_set_member_profile', () => {
    const { result } = renderHook(() => useClientPhonesEditor({ primaryOptional: true }));
    act(() => result.current.setPhone(result.current.rows[0].key, { value: { country: 'CM', national: '677214598' } }));
    act(() => result.current.addPhone());
    act(() => result.current.setPhone(result.current.rows[1].key, { value: { country: 'CN', national: '139 2214 5530' }, label: ' WeChat ' }));
    expect(result.current.toInputs()).toEqual([
      { phone_e164: '+237677214598', country_iso: 'CM', label: null },
      { phone_e164: '+8613922145530', country_iso: 'CN', label: 'WeChat' },
    ]);
  });

  it('collaborateur : vider tous ses numéros est un changement (liste vide)', () => {
    const { result } = renderHook(() => useClientPhonesEditor({ primaryOptional: true }));
    act(() => result.current.reset([{ phoneE164: '+237671513376', label: null }], null));
    expect(result.current.changed).toBe(false);
    act(() => result.current.setPhone(result.current.rows[0].key, { value: { country: 'CM', national: '' } }));
    expect(result.current.primaryInvalid).toBe(false);
    expect(result.current.changed).toBe(true);
    expect(result.current.toInputs()).toEqual([]);
  });

  it('collaborateur : principal vide mais un autre numéro rempli — signalé, pas envoyé en douce comme principal', () => {
    const { result } = renderHook(() => useClientPhonesEditor({ primaryOptional: true }));
    act(() => result.current.addPhone());
    act(() => result.current.setPhone(result.current.rows[1].key, { value: { country: 'CN', national: '139 2214 5530' } }));
    expect(result.current.primaryMissing).toBe(true);
    expect(result.current.primaryInvalid).toBe(true);
    act(() => result.current.makePrimary(result.current.rows[1].key));
    expect(result.current.primaryMissing).toBe(false);
    expect(result.current.primaryInvalid).toBe(false);
  });

  it('client : inchangé — aucun numéro avant `reset`, et le principal reste obligatoire', () => {
    const { result } = renderHook(() => useClientPhonesEditor());
    expect(result.current.rows).toHaveLength(0);
    expect(result.current.primaryInvalid).toBe(true);
    act(() => result.current.reset([], null));
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.primaryInvalid).toBe(true);
  });
});

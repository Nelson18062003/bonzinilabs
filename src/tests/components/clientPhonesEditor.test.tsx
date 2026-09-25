import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useClientPhonesEditor } from '@/components/clients/useClientPhonesEditor';
import type { ClientPhone } from '@/hooks/useClientPhones';

const saved: ClientPhone[] = [
  { id: 'a', phoneE164: '+237683728216', countryIso: 'CM', label: null, isPrimary: true },
  { id: 'b', phoneE164: '+237699000000', countryIso: 'CM', label: 'MTN', isPrimary: false },
];

describe('useClientPhonesEditor — numéros d’un client existant', () => {
  it('reprend les numéros enregistrés, principal d’abord, sans rien marquer comme modifié', () => {
    const { result } = renderHook(() => useClientPhonesEditor());
    act(() => result.current.reset(saved, '+237683728216', 'Cameroun'));
    expect(result.current.rows).toHaveLength(2);
    expect(result.current.changed).toBe(false);
    expect(result.current.primaryInvalid).toBe(false);
    expect(result.current.toInputs().map((p) => [p.phone_e164, p.label])).toEqual([['+237683728216', null], ['+237699000000', 'MTN']]);
  });

  it('ancien client sans liste : repart du numéro de la fiche, même saisi sans indicatif', () => {
    const { result } = renderHook(() => useClientPhonesEditor());
    act(() => result.current.reset([], '683728216', 'Cameroun'));
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.toInputs()[0].phone_e164).toBe('+237683728216');
    expect(result.current.changed).toBe(false);
  });

  it('ajoute un numéro après coup : le lot change, le principal reste en tête', () => {
    const { result } = renderHook(() => useClientPhonesEditor());
    act(() => result.current.reset([], '+237683728216', 'Cameroun'));
    act(() => result.current.addPhone());
    // Une ligne ajoutée puis laissée vide ne bloque rien et n'est pas envoyée.
    expect(result.current.extrasInvalid).toBe(false);
    expect(result.current.changed).toBe(false);
    const key = result.current.rows[1].key;
    act(() => result.current.setPhone(key, { value: { country: 'CN', national: '138 2229 7518' }, label: 'Chine' }));
    expect(result.current.changed).toBe(true);
    expect(result.current.toInputs().map((p) => p.phone_e164)).toEqual(['+237683728216', '+8613822297518']);
  });

  it('« Mettre en principal » fait passer le numéro en tête', () => {
    const { result } = renderHook(() => useClientPhonesEditor());
    act(() => result.current.reset(saved, null));
    act(() => result.current.makePrimary(result.current.rows[1].key));
    expect(result.current.toInputs()[0].phone_e164).toBe('+237699000000');
    expect(result.current.changed).toBe(true);
  });

  it('refuse un numéro commencé mais incomplet, et ne garde pas les doublons', () => {
    const { result } = renderHook(() => useClientPhonesEditor());
    act(() => result.current.reset(saved, null));
    act(() => result.current.addPhone());
    const key = result.current.rows[2].key;
    act(() => result.current.setPhone(key, { value: { country: 'CM', national: '6 99' } }));
    expect(result.current.extrasInvalid).toBe(true);
    act(() => result.current.setPhone(key, { value: { country: 'CM', national: '6 99 00 00 00' } }));
    expect(result.current.extrasInvalid).toBe(false);
    expect(result.current.toInputs()).toHaveLength(2);
  });

  it('on ne peut pas retirer le dernier numéro', () => {
    const { result } = renderHook(() => useClientPhonesEditor());
    act(() => result.current.reset([], '+237683728216'));
    act(() => result.current.removePhone(result.current.rows[0].key));
    expect(result.current.rows).toHaveLength(1);
  });
});

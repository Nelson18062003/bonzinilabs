// ============================================================
// La logique des numéros d'un client EXISTANT (« Modifier le profil »).
// Le rendu est dans ClientPhonesEditor.tsx. Le PREMIER numéro est le
// principal ; `toInputs()` donne le lot tel que l'attend
// `admin_set_client_phones`, et `changed` dit s'il faut l'envoyer.
// ============================================================
import { useCallback, useState } from 'react';
import { EMPTY_PHONE, fromE164, isPhoneComplete, toE164 } from '@/components/form/PhoneNumberInput';
import { normalizePhone } from '@/lib/phone';
import type { ClientPhone, ClientPhoneInput } from '@/hooks/useClientPhones';
import { MAX_PHONES, type PhoneRow } from './useCreateClientForm';

const rowKey = () => Math.random().toString(36).slice(2);

/** Le lot tel qu'il est en base, dans l'ordre (principal d'abord), pour savoir si on l'a changé. */
function signature(list: { e164: string | null; label: string }[]): string {
  return JSON.stringify(list.map((p) => [p.e164, p.label.trim()]));
}

export function useClientPhonesEditor() {
  const [rows, setRows] = useState<PhoneRow[]>([]);
  const [initial, setInitial] = useState('');

  /**
   * À l'ouverture : les numéros enregistrés (principal d'abord) ; à défaut
   * (ancien client sans liste), le numéro de la fiche, relu avec son pays.
   */
  const reset = useCallback((saved: ClientPhone[] | undefined, fallbackPhone: string | null | undefined, countryHint?: string | null) => {
    let next: PhoneRow[];
    if (saved && saved.length > 0) {
      next = saved.map((p) => ({ key: rowKey(), value: fromE164(p.phoneE164), label: p.label ?? '' }));
    } else {
      const e164 = normalizePhone(fallbackPhone ?? '', countryHint)?.e164 ?? null;
      next = [{ key: rowKey(), value: e164 ? fromE164(e164) : EMPTY_PHONE, label: '' }];
    }
    setRows(next);
    setInitial(signature(next.map((r) => ({ e164: toE164(r.value), label: r.label }))));
  }, []);

  const setPhone = useCallback((key: string, patch: Partial<PhoneRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }, []);
  const addPhone = useCallback(() => {
    setRows((prev) => (prev.length >= MAX_PHONES ? prev : [...prev, { key: rowKey(), value: { country: prev[0]?.value.country ?? EMPTY_PHONE.country, national: '' }, label: '' }]));
  }, []);
  const removePhone = useCallback((key: string) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.key !== key)));
  }, []);
  const makePrimary = useCallback((key: string) => {
    setRows((prev) => {
      const row = prev.find((r) => r.key === key);
      return row ? [row, ...prev.filter((r) => r.key !== key)] : prev;
    });
  }, []);

  // Une ligne vide (ajoutée puis laissée) est ignorée ; une ligne commencée doit être complète.
  const filled = rows.filter((r, i) => i === 0 || r.value.national.replace(/\D/g, '') !== '');
  const primaryInvalid = !rows[0] || !isPhoneComplete(rows[0].value);
  const extrasInvalid = !filled.slice(1).every((r) => isPhoneComplete(r.value));

  /** Le lot à envoyer : numéros complets, sans doublon, principal en tête. */
  const toInputs = (): ClientPhoneInput[] => {
    const seen = new Set<string>();
    return filled.flatMap((r) => {
      const e164 = toE164(r.value);
      if (!e164 || seen.has(e164)) return [];
      seen.add(e164);
      return [{ phone_e164: e164, country_iso: r.value.country, label: r.label.trim() || null }];
    });
  };
  const changed = signature(filled.map((r) => ({ e164: toE164(r.value), label: r.label }))) !== initial;

  return { rows, reset, setPhone, addPhone, removePhone, makePrimary, primaryInvalid, extrasInvalid, toInputs, changed };
}

export type ClientPhonesEditorApi = ReturnType<typeof useClientPhonesEditor>;

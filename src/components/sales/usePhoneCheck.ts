// ============================================================
// ESPACE COMMERCIAL — un numéro vérifié EN DIRECT pendant la saisie
// (07/10). Complet, après une courte pause de frappe, il part à
// `prospect_phone_check`, qui dit seulement ce que le commercial peut
// savoir : libre, un client Bonzini (lequel : il ne le sait pas), un de
// SES clients, un de SES prospects, suivi par un autre commercial.
// La réponse remonte à l'assistant (`onResult`), qui s'en sert pour arrêter
// « Continuer » ; elle ne vaut que pour le numéro vérifié (un numéro changé
// depuis attend sa propre réponse). Une erreur réseau ne bloque rien : le
// serveur tranche à l'enregistrement.
// ============================================================
import { useEffect, useMemo } from 'react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useProspectPhoneCheck } from '@/hooks/useSales';
import type { PhoneCheckResult } from './prospectDraft';

/** La pause de frappe avant de vérifier (comme la recherche du prospect au bureau). */
export const PHONE_CHECK_DELAY = 400;

export type OnPhoneCheck = (fieldId: string, result: PhoneCheckResult) => void;

/**
 * La réponse pour `e164` (null : rien à vérifier, frappe en cours, réponse
 * pas encore là ou en erreur). `excludeId` : en modification, la fiche
 * elle-même (ses propres numéros ne sont pas un doublon).
 */
export function useLivePhoneCheck(fieldId: string, e164: string | null, excludeId: string | null, onResult?: OnPhoneCheck): PhoneCheckResult | null {
  const settled = useDebouncedValue(e164, PHONE_CHECK_DELAY);
  const query = useProspectPhoneCheck(settled, excludeId);
  const status = e164 && settled === e164 ? query.data?.status : undefined;
  const prospectId = status ? (query.data?.prospect_id ?? null) : null;
  const result = useMemo<PhoneCheckResult | null>(() => (e164 && status ? { e164, status, prospectId } : null), [e164, status, prospectId]);
  useEffect(() => {
    if (result) onResult?.(fieldId, result);
  }, [fieldId, result, onResult]);
  return result;
}

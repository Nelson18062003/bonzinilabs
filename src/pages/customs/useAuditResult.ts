/** Le rapport d'un audit, recalculé à l'affichage à partir de ce que l'IA a lu. */
import { useMemo } from 'react';
import { auditDau, cleanExtraction } from '@/lib/customs/audit';
import type { AuditRecord } from '@/lib/customs/files';
import type { Nomenclature } from '@/lib/customs/nomenclature';

export function useAuditResult(audit: AuditRecord | undefined, nom: Nomenclature | undefined) {
  const extraction = audit?.extraction;
  const paidOn = audit?.paid_on;
  return useMemo(() => {
    if (!extraction || !nom) return null;
    const read = cleanExtraction(extraction);
    // La date de paiement saisie par le client l'emporte sur la lecture.
    const ext = { ...read, paid_on: paidOn ?? read.paid_on };
    return { ext, result: auditDau(ext, nom) };
  }, [extraction, paidOn, nom]);
}

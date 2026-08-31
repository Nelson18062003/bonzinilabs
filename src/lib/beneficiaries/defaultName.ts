// Nom par défaut proposé quand l'admin crée un NOUVEAU bénéficiaire depuis
// le flux de paiement (Alipay / WeChat). Le nom est requis mais souvent
// inconnu au moment du paiement : on préremplit « Supplier NN » et l'admin
// peut le remplacer librement.

const SUPPLIER_RE = /^supplier\s*0*(\d+)$/i;

/**
 * Next available "Supplier NN" for a client — scans the names AND aliases of
 * the existing beneficiaries (alias is copied from name when saving from the
 * payment flow) and returns max + 1, zero-padded to 2 digits.
 */
export function nextSupplierName(
  existing: ReadonlyArray<{ name?: string | null; alias?: string | null }> | undefined,
): string {
  let max = 0;
  for (const b of existing ?? []) {
    for (const label of [b.name, b.alias]) {
      const m = label?.trim().match(SUPPLIER_RE);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
  }
  return `Supplier ${String(max + 1).padStart(2, '0')}`;
}

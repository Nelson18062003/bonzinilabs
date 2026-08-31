// ============================================================
// Recherche & tri des clients — côté client, sur la liste chargée.
//
// L'ancienne recherche serveur (`.or(first_name.ilike…)`) échouait sur les
// cas les plus courants d'un annuaire francophone :
//   · « Jean Dupont » (prénom + nom) ne matchait AUCUNE colonne seule ;
//   · « herve » ne trouvait pas « Hervé » (accents) ;
//   · « 677 12 » ne trouvait pas « +23767712… » (espaces/format) ;
//   · une virgule ou un % dans la saisie cassait le filtre PostgREST.
// Ici : normalisation (casse + accents), multi-jetons en ET, téléphone
// comparé chiffres-à-chiffres, e-mail et entreprise inclus.
// ============================================================

export interface SearchableClient {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
  companyName?: string | null;
}

/** minuscules + accents retirés + espaces normalisés. */
export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function digitsOnly(s: string): string {
  return s.replace(/\D+/g, '');
}

/**
 * True si CHAQUE jeton de la requête matche le client : dans le texte
 * normalisé (prénom+nom, e-mail, entreprise) ou, pour un jeton chiffré,
 * dans les chiffres du téléphone.
 */
export function matchesClientSearch(client: SearchableClient, query: string): boolean {
  const tokens = normalizeText(query).split(' ').filter(Boolean);
  if (tokens.length === 0) return true;

  const haystack = normalizeText(
    `${client.firstName} ${client.lastName} ${client.email ?? ''} ${client.companyName ?? ''}`,
  );
  const phoneDigits = digitsOnly(client.phone ?? '');

  return tokens.every((token) => {
    if (haystack.includes(token)) return true;
    const tokenDigits = digitsOnly(token);
    return tokenDigits.length >= 2 && phoneDigits.includes(tokenDigits);
  });
}

// ── Tri ─────────────────────────────────────────────────────────

export type ClientSortField = 'name' | 'balance' | 'deposits' | 'payments' | 'created';

export interface SortableClient extends SearchableClient {
  walletBalance: number;
  totalDeposits: number;
  totalPayments: number;
  createdAt: string;
}

/** Comparateur stable pour un champ + une direction (fr, insensible aux accents). */
export function compareClients(field: ClientSortField, ascending: boolean) {
  const dir = ascending ? 1 : -1;
  return (a: SortableClient, b: SortableClient): number => {
    switch (field) {
      case 'name': {
        const an = `${a.firstName} ${a.lastName}`.trim();
        const bn = `${b.firstName} ${b.lastName}`.trim();
        return dir * an.localeCompare(bn, 'fr', { sensitivity: 'base' });
      }
      case 'balance':
        return dir * ((a.walletBalance || 0) - (b.walletBalance || 0));
      case 'deposits':
        return dir * ((a.totalDeposits || 0) - (b.totalDeposits || 0));
      case 'payments':
        return dir * ((a.totalPayments || 0) - (b.totalPayments || 0));
      case 'created':
        return dir * (Date.parse(a.createdAt) - Date.parse(b.createdAt));
    }
  };
}

// ============================================================================
// Le brouillon d'une remise, entre trois écrans : les colis choisis, qui
// emporte, son téléphone. Dans sessionStorage : un rechargement ne perd rien,
// fermer l'onglet efface tout. Un brouillon ne vaut que pour SON client.
// ============================================================================
const KEY = 'bonzini-warehouse-release';

export interface ReleaseDraft {
  code: string;
  ids: string[];
  who?: string;
  phone?: string;
  note?: string;
}

export function readReleaseDraft(code: string | undefined): ReleaseDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as ReleaseDraft;
    return d && d.code === code && Array.isArray(d.ids) ? d : null;
  } catch { return null; }
}

export function writeReleaseDraft(d: ReleaseDraft | null): void {
  try {
    if (d) sessionStorage.setItem(KEY, JSON.stringify(d));
    else sessionStorage.removeItem(KEY);
  } catch { /* privé */ }
}

// Les sélections des listes (colis, dépôts, paquets) : des ensembles d'identifiants.

/** Cocher ou décocher un identifiant dans une sélection. */
export function toggleId(set: ReadonlySet<string>, id: string): Set<string> {
  const n = new Set(set);
  if (n.has(id)) n.delete(id); else n.add(id);
  return n;
}

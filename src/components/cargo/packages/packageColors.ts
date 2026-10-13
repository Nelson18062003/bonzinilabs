// Une teinte par client dans la jauge d'un paquet avion — lisibles en clair comme en
// sombre (PackageGauge, PackageWorkbench). La teinte vient du client lui-même, pas de
// sa place dans la liste : elle ne change pas quand un autre client entre dans le paquet.
// Ni rouge ni vert : ils disent « de trop » et « il tient » dans la même jauge.
const CLIENT_FILL = ['bg-indigo-500', 'bg-teal-500', 'bg-amber-500', 'bg-sky-500', 'bg-violet-500', 'bg-orange-500', 'bg-fuchsia-500', 'bg-slate-500'];

const hash = (s: string) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);

/** La teinte de chaque client d'un paquet : sa teinte à lui, ou la suivante libre si un autre client du paquet l'a déjà. */
export function clientFills(keys: readonly string[]): Map<string, string> {
  const taken = new Set<number>();
  const out = new Map<string, string>();
  for (const key of [...keys].sort()) {
    let i = hash(key) % CLIENT_FILL.length;
    for (let tries = 0; taken.has(i) && tries < CLIENT_FILL.length; tries += 1) i = (i + 1) % CLIENT_FILL.length;
    taken.add(i);
    out.set(key, CLIENT_FILL[i]);
  }
  return out;
}

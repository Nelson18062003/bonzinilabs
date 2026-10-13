// ============================================================
// Les données de la mise en paquets avion (Cargo › Réception, ordinateur) :
// les paquets, les colis avion du bureau à emballer, et ce que contient
// chaque paquet tel que la réception le voit (la liste des paquets ne porte
// pas ses colis).
// ============================================================
import { useMemo } from 'react';
import { useReceptionBoard } from '@/hooks/useReception';
import { useAirPackages } from '@/hooks/useAirPackages';
import { packableParcels, type AirPackage, type PackableBoard } from '@/lib/airPackage';

export type PackageScope = 'bureau' | 'all';

/** Les clients et les colis d'un paquet, d'après les dépôts en stock au bureau. */
export type PackageContents = Map<string, { codes: Set<string>; parcels: string[] }>;

/**
 * `enabled` : la personne voit le cargo (la liste des paquets, pour le compteur
 * de l'onglet). `boardEnabled` : on a besoin des colis du bureau (vue Paquets,
 * « Bureau · Air », fiche d'un paquet ouverte). Les dépôts se lisent TOUJOURS
 * au bureau seul : la liste de la page (500 dépôts au plus, entrepôt compris)
 * pourrait en laisser de côté ; la même clé qu'elle quand elle montre le
 * bureau, donc une seule lecture.
 */
export function usePackingBoard({ scope = 'bureau', enabled, boardEnabled }: { scope?: PackageScope; enabled: boolean; boardEnabled: boolean }) {
  const on = enabled && boardEnabled;
  const board = useReceptionBoard({ scope: 'stock', location: 'office', from: null, to: null }, on);
  const deposits = on ? board.data?.deposits ?? null : null;
  const packages = useAirPackages(scope, null, enabled);
  const packable = useMemo<PackableBoard | null>(() => (deposits ? packableParcels(deposits) : null), [deposits]);
  // Les clients et les colis de chaque paquet, tels que la réception les voit (la liste des paquets ne les porte pas).
  const contents = useMemo<PackageContents>(() => {
    const m: PackageContents = new Map();
    for (const d of deposits ?? []) {
      for (const p of d.parcels) {
        if (!p.air_package_id) continue;
        const e = m.get(p.air_package_id) ?? { codes: new Set<string>(), parcels: [] };
        if (d.client?.customer_code) e.codes.add(d.client.customer_code);
        e.parcels.push(p.parcel_no);
        m.set(p.air_package_id, e);
      }
    }
    return m;
  }, [deposits]);
  const openCount = useMemo(() => (packages.data ?? []).filter((p) => p.status === 'open').length, [packages.data]);
  return { packages, packable, contents, openCount, truncated: on && !!board.data?.truncated };
}

/**
 * Les codes clients d'un paquet, seulement s'ils sont tous connus : un paquet
 * parti n'a plus ses colis dans le stock du bureau, une liste partielle
 * tromperait.
 */
export function knownClientCodes(p: Pick<AirPackage, 'id' | 'client_count'>, contents: PackageContents): string[] | null {
  const c = contents.get(p.id);
  return c && c.codes.size === Number(p.client_count) ? [...c.codes] : null;
}

/** La recherche dans les paquets : numéro, LTA, vol, motif de refus — et ses clients et colis quand on les connaît. */
export function filterPackages(list: readonly AirPackage[], contents: PackageContents, query: string): AirPackage[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...list];
  return list.filter((p) => {
    const c = contents.get(p.id);
    const hay = [p.package_no, p.awb_number, p.flight_no, p.refusal_reason, ...(c ? [...c.codes, ...c.parcels] : [])].filter(Boolean).join(' ').toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

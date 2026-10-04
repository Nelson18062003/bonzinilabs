/**
 * Les clients d'un conteneur de groupage : à qui est chaque lot, combien de
 * place il prend, et sa part du fret.
 *
 * Bonzini remplit lui-même ses conteneurs (docs/cargo/MODELE-OPERATIONNEL.md) :
 * un conteneur « de GAUSS » est en fait un groupage, et les vrais clients
 * sont les propriétaires des lots — le nom porté sur les colis (owner_label),
 * rattaché quand c'est possible à une fiche client Bonzini (client_id).
 * La part de chacun se mesure au VOLUME : c'est ainsi que se facture le
 * maritime en groupage.
 */
import { lotVolumeM3 } from '@/lib/cargo/loadplan';
import type { CargoPackage } from '@/lib/cargo/model';

export interface GroupageOwner {
  /** client_id, ou le nom en minuscules, ou « none » pour les lots sans propriétaire. */
  key: string;
  label: string;
  clientId: string | null;
  lots: CargoPackage[];
  colis: number;
  cbm: number;
  /** Part du volume total du conteneur, 0 → 1. */
  share: number;
}

export function ownerKey(p: Pick<CargoPackage, 'client_id' | 'owner_label'>): string {
  if (p.client_id) return `client:${p.client_id}`;
  const l = p.owner_label?.trim().toLowerCase();
  return l ? `label:${l}` : 'none';
}

export function groupOwners(packages: CargoPackage[]): { owners: GroupageOwner[]; unassigned: GroupageOwner | null; totalCbm: number } {
  const totalCbm = packages.reduce((v, p) => v + lotVolumeM3(p), 0);
  const map = new Map<string, GroupageOwner>();
  for (const p of packages) {
    const key = ownerKey(p);
    const g = map.get(key) ?? { key, label: p.owner_label?.trim() || '', clientId: p.client_id, lots: [], colis: 0, cbm: 0, share: 0 };
    if (!g.label && p.owner_label?.trim()) g.label = p.owner_label.trim();
    g.lots.push(p);
    g.colis += p.qty;
    g.cbm += lotVolumeM3(p);
    map.set(key, g);
  }
  for (const g of map.values()) g.share = totalCbm > 0 ? g.cbm / totalCbm : 0;
  const unassigned = map.get('none') ?? null;
  map.delete('none');
  const owners = [...map.values()].sort((a, b) => b.cbm - a.cbm);
  return { owners, unassigned, totalCbm };
}

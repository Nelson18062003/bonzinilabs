// ============================================================
// La marque d'un mode d'envoi dans l'app : la silhouette (cargo, avion —
// exactement les formes peintes sur l'étiquette, ICON_PATHS) sur une
// pastille de SA couleur, puis le nom. Ce qu'on choisit ressemble à ce
// qu'on envoie, et on ne prend plus l'une pour l'autre.
// ============================================================
import type { ReactNode } from 'react';
import { DESTINATION_THEME, type ShippingDestination } from '@/lib/customerCode';
import { ICON_PATHS } from '@/lib/shippingLabelCanvas';

export function DestinationMark({ destination, children }: { destination: ShippingDestination; children: ReactNode }) {
  const theme = DESTINATION_THEME[destination];
  const icon = ICON_PATHS[theme.icon];
  return (
    <>
      <span aria-hidden="true" className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md" style={{ background: theme.color }}>
        <svg viewBox={`0 0 ${icon.grid} ${icon.grid}`} width={22} height={22} fill="#FFFFFF"><path d={icon.d} /></svg>
      </span>
      <span>{children}</span>
    </>
  );
}

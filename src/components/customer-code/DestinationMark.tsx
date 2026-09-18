// ============================================================
// La marque d'un mode d'envoi dans l'app : le pictogramme (bateau, avion)
// sur une pastille de SA couleur, puis le nom. La même identité que sur
// l'étiquette (DESTINATION_THEME) : ce qu'on choisit ressemble à ce qu'on
// envoie, et on ne prend plus l'une pour l'autre.
// ============================================================
import type { ReactNode } from 'react';
import { Plane, Ship } from 'lucide-react';
import { DESTINATION_THEME, type ShippingDestination } from '@/lib/customerCode';

export function DestinationMark({ destination, children }: { destination: ShippingDestination; children: ReactNode }) {
  const theme = DESTINATION_THEME[destination];
  const Icon = theme.icon === 'ship' ? Ship : Plane;
  return (
    <>
      <span aria-hidden="true" className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md" style={{ background: theme.color }}>
        <Icon className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
      </span>
      <span>{children}</span>
    </>
  );
}

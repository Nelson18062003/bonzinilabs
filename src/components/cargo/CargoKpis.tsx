/** Les quatre chiffres qui résument la flotte — alertes en orange. */
import { cn } from '@/lib/utils';
import { SURFACE, TEXT } from '@/desktop/designKit';
import { computeKpis } from '@/lib/cargo/kpis';
import { fmtUsd } from '@/lib/cargo/model';
import type { CargoShipment } from '@/lib/cargo/model';

function Tile({ value, label, alert }: { value: string; label: string; alert?: boolean }) {
  return (
    <div className={cn('rounded-xl px-4 py-3', SURFACE.card, alert ? 'ring-1 ring-bonzini-orange/60' : SURFACE.shadow)}>
      <div className={cn('text-[24px] font-extrabold leading-none tabular-nums', alert ? 'text-bonzini-orange' : TEXT.strong)}>{value}</div>
      <div className={cn('mt-1.5 text-[12px] font-medium', TEXT.muted)}>{label}</div>
    </div>
  );
}

export function CargoKpis({ shipments, className }: { shipments: CargoShipment[]; className?: string }) {
  const k = computeKpis(shipments);
  return (
    <div className={cn('grid gap-3', className)}>
      <Tile value={String(k.total)} label="conteneurs en cours" />
      <Tile value={String(k.soon)} label="arrivent sous 7 jours" alert={k.soon > 0} />
      <Tile value={fmtUsd(k.unpaid)} label="de fret à régler" alert={k.unpaid > 0} />
      <Tile value={`${k.noTelex} / ${k.total}`} label="sans télex release" alert={k.noTelex > 0} />
    </div>
  );
}

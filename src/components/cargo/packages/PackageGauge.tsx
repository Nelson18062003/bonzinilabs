// ============================================================
// La jauge d'un paquet avion, côté ordinateur : les 32 kg comme une bande où
// chaque colis prend sa place, une couleur par client — on voit d'un coup
// d'œil à qui appartient le paquet et ce qu'il reste. Le colis que l'on
// s'apprête à ajouter (survol de « Ajouter ») s'y dessine en pointillé : vert
// s'il tient, rouge s'il déborde.
// ============================================================
import { cn } from '@/lib/utils';
import { weightGauge, type AirPackage, type PackageClientGroup } from '@/lib/airPackage';
import { formatKg } from '@/lib/reception';
import { TEXT } from '@/desktop/designKit';
import { clientFills } from './packageColors';


/** Les kilos encore libres : des hachures, pour qu'on ne les prenne pas pour une barre vide. */
const FREE = { backgroundImage: 'repeating-linear-gradient(135deg, hsl(var(--muted)) 0 6px, hsl(var(--muted-foreground) / 0.14) 6px 8px)' };

export interface GaugePreview {
  kg: number;
  fits: boolean;
}

export function PackageGauge({ pkg, groups, preview, className }: {
  pkg: Pick<AirPackage, 'net_weight_kg' | 'max_weight_kg'>;
  groups: readonly PackageClientGroup[];
  preview?: GaugePreview | null;
  className?: string;
}) {
  const g = weightGauge(pkg);
  const fills = clientFills(groups.map((x) => x.key));
  const pct = (kg: number) => `${Math.max(0, (kg / g.max) * 100)}%`;
  const free = Math.max(0, g.max - g.net);
  const ghost = preview ? Math.min(preview.kg, preview.fits ? preview.kg : free) : 0;
  return (
    <div
      role="meter"
      aria-label="Poids des colis dans le paquet"
      aria-valuemin={0}
      aria-valuemax={g.max}
      aria-valuenow={g.net}
      aria-valuetext={`${formatKg(g.net)} sur ${formatKg(g.max)}`}
      className={cn('relative flex h-9 w-full overflow-hidden rounded-md ring-1 ring-border', className)}
      style={FREE}
    >
      {groups.map((grp) => grp.parcels.map((p) => (
        <span
          key={p.id}
          title={`${p.parcel_no} · ${formatKg(p.weight_kg)}${grp.client?.customer_code ? ` · ${grp.client.customer_code}` : ''}`}
          className={cn('h-full shrink-0 border-r-2 border-card transition-[width] duration-300 ease-out last:border-r-0', fills.get(grp.key))}
          style={{ width: pct(Number(p.weight_kg) || 0) }}
        />
      )))}
      {preview && ghost > 0 && (
        <span
          aria-hidden="true"
          className={cn('h-full shrink-0 border-2 border-dashed', preview.fits ? 'border-emerald-600 bg-emerald-500/25' : 'border-destructive bg-destructive/25')}
          style={{ width: pct(ghost) }}
        />
      )}
      {/* Les repères tous les 8 kg, en encoches au pied de la bande : on lit « un quart », « la moitié » sans chiffres. */}
      {[8, 16, 24].filter((k) => k < g.max).map((k) => (
        <span key={k} aria-hidden="true" className="pointer-events-none absolute bottom-0 h-1.5 w-px bg-foreground/40" style={{ left: pct(k) }} />
      ))}
    </div>
  );
}

/** La légende de la jauge : une pastille par client, ses colis et ses kilos. */
export function GaugeLegend({ groups }: { groups: readonly PackageClientGroup[] }) {
  if (groups.length === 0) return null;
  const fills = clientFills(groups.map((x) => x.key));
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
      {groups.map((grp) => (
        <li key={grp.key} className={cn('inline-flex items-center gap-1.5 text-[12px] tabular-nums', TEXT.body)}>
          <span aria-hidden="true" className={cn('h-2.5 w-2.5 shrink-0 rounded-sm', fills.get(grp.key))} />
          <span className={cn('font-semibold', TEXT.strong)}>{grp.client?.customer_code ?? 'Sans client'}</span>
          <span className={TEXT.muted}>{grp.parcels.length} colis · {formatKg(grp.kg)}</span>
        </li>
      ))}
    </ul>
  );
}

/** La petite jauge d'une ligne de liste (sans le détail des colis) : verte, ambre près des 32 kg, encre une fois fermé. */
export function MiniGauge({ pkg, sealed }: { pkg: Pick<AirPackage, 'net_weight_kg' | 'max_weight_kg'>; sealed: boolean }) {
  const g = weightGauge(pkg);
  const fill = sealed ? 'bg-foreground/70' : g.tone === 'full' ? 'bg-destructive' : g.tone === 'near' ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
      <span className={cn('block h-full rounded-full', fill)} style={{ width: `${g.net > 0 ? Math.max(g.ratio * 100, 3) : 0}%` }} />
    </span>
  );
}

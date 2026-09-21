// ============================================================
// Bonzini Cargo a TROIS parties, et l'entrée du module le dit en premier :
//   · Container — les boîtes : suivi, dossiers, papiers, argent, chargement ;
//   · Avion — les expéditions aériennes : LTA, vol, manifeste, jalons ;
//   · Réception — les colis enregistrés à l'entrepôt et au bureau, avant
//     la boîte ou l'avion (le travail du réceptionnaire, vu par l'équipe).
// Un seul sélecteur, le même sur mobile et sur desktop, avec les chiffres
// qui comptent : les conteneurs suivis, les colis qui attendent, les
// dépôts à attribuer. Une route par partie : /m/cargo et /m/cargo/reception.
// ============================================================
import { useNavigate } from 'react-router-dom';
import { Ship, Plane, PackageOpen } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCargoPartsSummary } from '@/hooks/useReception';
import { cn } from '@/lib/utils';
import { Segmented } from '@/mobile/designKit';

export type CargoPart = 'container' | 'air' | 'reception';

export const CARGO_PARTS: ReadonlyArray<{ key: CargoPart; to: string; label: string }> = [
  { key: 'container', to: '/m/cargo', label: 'Container' },
  { key: 'air', to: '/m/cargo/avion', label: 'Avion' },
  { key: 'reception', to: '/m/cargo/reception', label: 'Réception' },
];

const PART_ICON: Record<CargoPart, typeof Ship> = { container: Ship, air: Plane, reception: PackageOpen };

export function cargoPartPath(part: CargoPart): string {
  return CARGO_PARTS.find((p) => p.key === part)!.to;
}

/** Mobile : deux gros segments sous l'en-tête « Cargo ». */
export function MobileCargoParts({ active, className }: { active: CargoPart; className?: string }) {
  const navigate = useNavigate();
  const { data } = useCargoPartsSummary();
  return (
    <div className={cn('px-4 pt-3', className)}>
      <Segmented<CargoPart>
        value={active}
        onChange={(part) => { if (part !== active) navigate(cargoPartPath(part)); }}
        options={[
          { value: 'container', label: <span className="inline-flex items-center gap-1.5"><Ship className="h-5 w-5" /> Container</span>, count: data?.containers ?? null },
          { value: 'air', label: <span className="inline-flex items-center gap-1.5"><Plane className="h-5 w-5" /> Avion</span>, count: data?.air_open ?? null },
          { value: 'reception', label: <span className="inline-flex items-center gap-1.5"><PackageOpen className="h-5 w-5" /> Réception</span>, count: data?.parcels_waiting ?? null },
        ]}
      />
    </div>
  );
}

/** Desktop : la barre d'onglets du module, même grammaire que le dossier (Radix, soulignement). */
export function DesktopCargoParts({ active, className }: { active: CargoPart; className?: string }) {
  const navigate = useNavigate();
  const { data } = useCargoPartsSummary();
  const meta: Record<CargoPart, string | null> = {
    container: data ? `${data.containers} suivi${data.containers > 1 ? 's' : ''}${data.containers_at_sea > 0 ? ` · ${data.containers_at_sea} en mer` : ''}` : null,
    air: data ? `${data.air_open ?? 0} en cours${(data.air_in_flight ?? 0) > 0 ? ` · ${data.air_in_flight} en vol` : ''}` : null,
    reception: data ? `${data.parcels_waiting} colis à l'entrepôt${data.deposits_pending > 0 ? ` · ${data.deposits_pending} à attribuer` : ''}` : null,
  };
  return (
    <Tabs value={active} onValueChange={(v) => { if (v !== active) navigate(cargoPartPath(v as CargoPart)); }} className={className}>
      <TabsList aria-label="Parties du module Cargo" className="h-auto w-full justify-start gap-8 rounded-none border-b border-border bg-transparent p-0">
        {CARGO_PARTS.map((p) => (
          <TabsTrigger
            key={p.key}
            value={p.key}
            className={cn(
              '-mb-px flex shrink-0 items-center gap-2.5 rounded-none border-b-2 border-transparent bg-transparent px-0 pb-3 pt-0 text-[15px] font-medium text-muted-foreground shadow-none transition-colors',
              'hover:text-foreground',
              'data-[state=active]:border-foreground data-[state=active]:font-bold data-[state=active]:text-foreground data-[state=active]:shadow-none',
            )}
          >
            {(() => { const Icon = PART_ICON[p.key]; return <Icon className="h-4 w-4" />; })()}
            {p.label}
            {meta[p.key] && <span className="text-[12px] font-normal tabular-nums text-muted-foreground">{meta[p.key]}</span>}
            {p.key === 'reception' && (data?.deposits_pending ?? 0) > 0 && (
              <span className="rounded-md bg-amber-500/15 px-1.5 py-px text-[10.5px] font-extrabold tabular-nums text-amber-700 dark:text-amber-400">{data!.deposits_pending}</span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

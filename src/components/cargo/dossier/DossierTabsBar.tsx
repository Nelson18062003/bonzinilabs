/**
 * Barre d'onglets du dossier — même grammaire que la Trésorerie : primitives
 * Radix (rôle tablist, flèches au clavier), soulignement maison, filet continu
 * sous la barre. Chaque onglet porte son icône : on retrouve « Documents »
 * ou « Douane » d'un coup d'œil, sans lire.
 */
import type { ElementType } from 'react';
import { FolderOpen, Handshake, Landmark, LayoutDashboard, PackageOpen, Route, StickyNote, UserRound, Wallet } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DOSSIER_TABS, type DossierTab } from '@/lib/cargo/dossierNav';
import { cn } from '@/lib/utils';

export const TAB_ICON: Record<DossierTab, ElementType> = {
  apercu: LayoutDashboard,
  suivi: Route,
  chargement: PackageOpen,
  documents: FolderOpen,
  douane: Landmark,
  couts: Wallet,
  client: UserRound,
  intervenants: Handshake,
  notes: StickyNote,
};

export function DossierTabsBar({ value, onChange, counts }: { value: DossierTab; onChange: (t: DossierTab) => void; counts?: Partial<Record<DossierTab, number>> }) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as DossierTab)}>
      <TabsList
        aria-label="Sections du dossier"
        className="h-auto w-full justify-start gap-5 overflow-x-auto rounded-none border-b border-border bg-transparent p-0"
      >
        {DOSSIER_TABS.map((t) => {
          const Icon = TAB_ICON[t.key];
          const n = counts?.[t.key];
          return (
            <TabsTrigger
              key={t.key}
              value={t.key}
              className={cn(
                'group -mb-px flex shrink-0 items-center gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-0.5 pb-2.5 pt-0 text-[13.5px] max-lg:text-[16px] font-medium text-muted-foreground shadow-none transition-colors',
                'hover:text-foreground',
                'data-[state=active]:border-foreground data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none',
              )}
            >
              <Icon className="h-4 w-4 opacity-70 group-data-[state=active]:opacity-100" />
              {t.label}
              {n != null && n > 0 && (
                <span className="rounded-md bg-muted px-1.5 py-px text-[10.5px] font-bold tabular-nums text-muted-foreground group-data-[state=active]:bg-foreground group-data-[state=active]:text-background">{n}</span>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}

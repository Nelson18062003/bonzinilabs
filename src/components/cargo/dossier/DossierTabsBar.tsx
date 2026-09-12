/**
 * Barre d'onglets du dossier — même grammaire que la Trésorerie : primitives
 * Radix (rôle tablist, flèches au clavier), soulignement maison, filet continu
 * sous la barre.
 */
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DOSSIER_TABS, type DossierTab } from '@/lib/cargo/dossierNav';
import { cn } from '@/lib/utils';

export function DossierTabsBar({ value, onChange }: { value: DossierTab; onChange: (t: DossierTab) => void }) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as DossierTab)}>
      <TabsList
        aria-label="Sections du dossier"
        className="h-auto w-full justify-start gap-6 overflow-x-auto rounded-none border-b border-border bg-transparent p-0"
      >
        {DOSSIER_TABS.map((t) => (
          <TabsTrigger
            key={t.key}
            value={t.key}
            className={cn(
              '-mb-px shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-0 pb-2.5 pt-0 text-[14px] font-medium text-muted-foreground shadow-none transition-colors',
              'hover:text-foreground',
              'data-[state=active]:border-foreground data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none',
            )}
          >
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

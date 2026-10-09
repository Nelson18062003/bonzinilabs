// ============================================================
// Mes équipes — le site d'un collaborateur (Guangzhou · bureau, Douala…).
// Une puce par site ; toucher la puce choisie la retire (aucun site).
// « Ajouter un site… » : un nom et, si l'on veut, un pays — le site est créé
// (team_create_site, super admin) puis choisi. Sert à la création d'un accès
// et à la fenêtre « Modifier » de la fiche.
// ============================================================
import { useState, type ReactNode } from 'react';
import { Check, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCreateTeamSite, useTeamSites } from '@/hooks/useTeam';
import { CountryCombobox } from '@/components/form/CountryCombobox';
import { CountryFlag } from '@/components/form/CountryFlag';
import type { CountryIso } from '@/data/countries';
import { BTN_PRIMARY, BTN_SOFT, Field } from './TeamBits';

const CHIP = 'inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-[13.5px] font-medium transition-colors disabled:opacity-40';
const CHIP_OFF = 'bg-card ring-1 ring-black/10 hover:bg-accent dark:ring-white/15';
const CHIP_ON = 'bg-primary text-primary-foreground';

export function TeamSitePicker({ value, onChange, hint }: { value: string | null; onChange: (id: string | null) => void; hint?: ReactNode }) {
  const sites = useTeamSites();
  const create = useCreateTeamSite();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [country, setCountry] = useState<CountryIso | null>(null);

  // Un site retiré du service reste visible s'il est encore celui du membre.
  const list = (sites.data ?? []).filter((s) => s.is_active !== false || s.id === value);
  const name = label.trim().replace(/\s+/g, ' ');

  const closeAdd = () => {
    setAdding(false);
    setLabel('');
    setCountry(null);
  };
  const addSite = () => {
    if (name.length < 2 || create.isPending) return;
    // Déjà là (même nom, casse comprise) : on le choisit plutôt que d'essuyer un refus.
    const existing = (sites.data ?? []).find((s) => s.label.trim().toLowerCase() === name.toLowerCase());
    if (existing) {
      onChange(existing.id);
      closeAdd();
      return;
    }
    create.mutate({ label: name, countryIso: country }, { onSuccess: (r) => { onChange(r.id); closeAdd(); } });
  };

  return (
    <div className="space-y-2.5">
      <div>
        <div className="text-[16px] font-semibold">Site</div>
        {hint && <p className="text-[12.5px] leading-relaxed text-muted-foreground">{hint}</p>}
      </div>

      {sites.isLoading ? (
        <div className="h-9 w-2/3 animate-pulse rounded-full bg-muted" />
      ) : sites.isError ? (
        <p className="text-[13px] text-muted-foreground">
          Les sites n’ont pas pu être chargés.{' '}
          <button type="button" onClick={() => void sites.refetch()} className="font-semibold text-foreground underline">
            Réessayer
          </button>
        </p>
      ) : (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Site">
          {list.map((s) => {
            const on = value === s.id;
            return (
              <button key={s.id} type="button" aria-pressed={on} onClick={() => onChange(on ? null : s.id)} className={cn(CHIP, on ? CHIP_ON : CHIP_OFF)}>
                {s.country_iso && <CountryFlag iso={s.country_iso} size={18} />}
                {s.label}
                {on && <Check className="h-3.5 w-3.5" />}
              </button>
            );
          })}
          {!adding && (
            <button type="button" onClick={() => setAdding(true)} className={cn(CHIP, 'border border-dashed border-black/25 font-semibold text-primary hover:bg-accent dark:border-white/25')}>
              <Plus className="h-4 w-4" /> Ajouter un site…
            </button>
          )}
        </div>
      )}

      {adding && (
        <div className="space-y-3 rounded-2xl bg-muted/50 p-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,230px)]">
            <Field label="Nom du site" value={label} onChange={setLabel} placeholder="Bafoussam, Lagos…" maxLength={60} autoFocus autoComplete="off" />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="team-site-country" className="text-sm font-medium leading-none">
                Pays (facultatif)
              </label>
              <CountryCombobox id="team-site-country" value={country} onChange={(iso) => setCountry(iso)} className="h-12 rounded-xl md:h-11" />
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={closeAdd} className={BTN_SOFT}>
              Annuler
            </button>
            <button type="button" onClick={addSite} disabled={name.length < 2 || create.isPending} className={BTN_PRIMARY}>
              {create.isPending ? 'Ajout…' : 'Ajouter et choisir'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

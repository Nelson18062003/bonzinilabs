// ============================================================
// « Origine du client » — le sélecteur de source, partagé par la création
// de client (admin desktop, admin mobile, réception) et par la fiche client.
//
// Les sources sont RÉUTILISABLES : un commercial s'ajoute une fois (« + Ajouter
// une source »), puis se choisit pour chaque client qu'il apporte. Rangées par
// catégorie, avec une recherche ; « Je ne sais pas » est toujours proposée —
// le champ est obligatoire, mais on ne force pas une réponse inventée.
//
// Rendu EN LIGNE (pas de portail) : il vit dans des formulaires mobiles et
// desktop, des panneaux et des fenêtres, sans souci de superposition.
// ============================================================
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, Plus, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeText } from '@/lib/clientSearch';
import { TextInput } from '@/mobile/designKit';
import {
  SOURCE_KINDS,
  useClientSources,
  useCreateClientSource,
  type ClientSource,
  type ClientSourceKind,
} from '@/hooks/useClientSources';

type CreatableKind = Exclude<ClientSourceKind, 'unknown'>;

export function ClientSourcePicker({
  id,
  value,
  onChange,
  invalid,
  controlClassName,
}: {
  id?: string;
  value: string | null;
  onChange: (sourceId: string) => void;
  invalid?: boolean;
  /** Hauteur / rayon des champs de l'écran hôte (desktop : 48 px). */
  controlClassName?: string;
}) {
  const { t } = useTranslation('common');
  const sources = useClientSources();
  const create = useCreateClientSource();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<CreatableKind>('commercial');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const all = sources.data ?? [];
  const selected = all.find((s) => s.id === value) ?? null;
  const unknown = all.find((s) => s.kind === 'unknown') ?? null;
  const kindLabel = (k: string) => t(`clientForm.sourceKinds.${k}`, { defaultValue: k });
  const display = (s: ClientSource) => (s.kind === 'unknown' ? t('clientForm.sourceUnknown') : `${kindLabel(s.kind)} · ${s.label}`);

  const groups = useMemo(() => {
    const nq = normalizeText(q);
    return SOURCE_KINDS.map((k) => ({
      ...k,
      items: all.filter((s) => s.kind === k.kind && (!nq || normalizeText(`${s.label} ${s.phone ?? ''} ${kindLabel(s.kind)}`).includes(nq))),
    })).filter((g) => g.items.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, q]);

  const pick = (sid: string) => {
    onChange(sid);
    setOpen(false);
    setQ('');
    setAdding(false);
  };

  const startAdding = () => {
    setAdding(true);
    if (q.trim()) setName(q.trim());
  };

  const withPhone = SOURCE_KINDS.find((k) => k.kind === kind)?.withPhone ?? false;
  const canCreate = name.trim().length >= 2 && !create.isPending;
  const submitNew = () => {
    if (!canCreate) return;
    create.mutate(
      { kind, label: name.trim(), phone: withPhone ? phone.trim() || null : null },
      {
        onSuccess: (r) => {
          setName('');
          setPhone('');
          pick(r.id);
        },
      },
    );
  };

  return (
    <div className="space-y-2">
      <button
        id={id}
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-12 w-full items-center gap-2 rounded-2xl border bg-card px-4 text-left text-[16px] transition-colors',
          invalid ? 'border-destructive' : 'border-input hover:border-foreground/30',
          controlClassName,
        )}
      >
        <span className={cn('min-w-0 flex-1 truncate', !selected && 'text-muted-foreground')}>
          {selected ? display(selected) : sources.isLoading ? '…' : t('clientForm.sourcePlaceholder')}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {!adding && (
            <>
              <label className="flex items-center gap-2 border-b border-border px-4">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t('clientForm.sourceSearch')}
                  aria-label={t('clientForm.sourceSearch')}
                  className="h-12 w-full bg-transparent text-[16px] outline-none placeholder:text-muted-foreground"
                />
              </label>
              <div className="max-h-[320px] overflow-y-auto py-1">
                {groups.map((g) => (
                  <div key={g.kind} className="py-1">
                    <div className="px-4 pb-1 pt-2 text-[12px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">{kindLabel(g.kind)}</div>
                    {g.items.map((s) => (
                      <Option key={s.id} active={s.id === value} onClick={() => pick(s.id)} label={s.label} hint={s.phone} />
                    ))}
                  </div>
                ))}
                {groups.length === 0 && q && <div className="px-4 py-3 text-[14px] text-muted-foreground">{t('clientForm.sourceNoResult')}</div>}
                {unknown && (
                  <div className="border-t border-border/70 py-1">
                    <Option active={unknown.id === value} onClick={() => pick(unknown.id)} label={t('clientForm.sourceUnknown')} muted />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={startAdding}
                className="flex w-full items-center gap-2 border-t border-border px-4 py-3.5 text-left text-[15px] font-semibold hover:bg-accent"
              >
                <Plus className="h-4 w-4" /> {t('clientForm.sourceAdd')}
                {q.trim() && <span className="truncate font-normal text-muted-foreground">« {q.trim()} »</span>}
              </button>
            </>
          )}

          {adding && (
            <div className="space-y-4 p-4">
              <div className="flex items-center justify-between">
                <div className="text-[15px] font-semibold">{t('clientForm.sourceAdd')}</div>
                <button type="button" onClick={() => setAdding(false)} aria-label={t('clientForm.sourceCancel')} className="rounded-lg p-1 text-muted-foreground hover:bg-accent">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div>
                <div className="mb-2 text-[13px] font-medium text-muted-foreground">{t('clientForm.sourceKind')}</div>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('clientForm.sourceKind')}>
                  {SOURCE_KINDS.map((k) => (
                    <button
                      key={k.kind}
                      type="button"
                      role="radio"
                      aria-checked={kind === k.kind}
                      onClick={() => setKind(k.kind)}
                      className={cn(
                        'h-9 rounded-full px-3.5 text-[14px] font-medium transition-colors',
                        kind === k.kind ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-accent',
                      )}
                    >
                      {kindLabel(k.kind)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="cs-new-name" className="mb-2 block text-[13px] font-medium text-muted-foreground">
                  {t('clientForm.sourceName')}
                </label>
                <TextInput
                  id="cs-new-name"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={kind === 'commercial' || kind === 'referral' ? t('clientForm.sourceNamePlaceholder') : ''}
                  className={controlClassName}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), submitNew())}
                />
              </div>
              {withPhone && (
                <div>
                  <label htmlFor="cs-new-phone" className="mb-2 block text-[13px] font-medium text-muted-foreground">
                    {t('clientForm.sourcePhone')} <span className="font-normal">{t('clientForm.optional')}</span>
                  </label>
                  <TextInput id="cs-new-phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+237 6…" className={controlClassName} />
                </div>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={() => setAdding(false)} className="h-11 flex-1 rounded-2xl bg-muted text-[15px] font-semibold hover:bg-accent">
                  {t('clientForm.sourceCancel')}
                </button>
                <button
                  type="button"
                  onClick={submitNew}
                  disabled={!canCreate}
                  className="h-11 flex-[1.4] rounded-2xl bg-primary text-[15px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {create.isPending ? '…' : t('clientForm.sourceCreate')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Option({ active, onClick, label, hint, muted }: { active: boolean; onClick: () => void; label: string; hint?: string | null; muted?: boolean }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[15px] hover:bg-accent"
    >
      <Check className={cn('h-4 w-4 shrink-0', active ? 'opacity-100' : 'opacity-0')} />
      <span className={cn('min-w-0 flex-1 truncate', muted && 'text-muted-foreground')}>{label}</span>
      {hint && <span className="shrink-0 text-[13px] text-muted-foreground">{hint}</span>}
    </button>
  );
}

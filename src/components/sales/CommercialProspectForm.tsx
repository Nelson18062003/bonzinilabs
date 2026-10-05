// ============================================================
// ESPACE COMMERCIAL — un prospect : création (« /v/prospects/new ») et
// fiche (« /v/prospects/:id »).
//
// La fiche : appeler / WhatsApp d'un geste, le statut (contacté, intéressé,
// perdu — avec un motif —, rouvrir), puis le formulaire. Un prospect
// « devenu client » ne se pilote plus : son numéro est figé (c'est par lui
// que le compte client a été reconnu).
//
// Le numéro part toujours au format international (+237…) : `toE164`
// complète un numéro camerounais à 9 chiffres. La relance se pose à 9 h,
// heure de Douala. Les erreurs du serveur s'affichent en toast (les hooks
// s'en chargent) et le formulaire garde ce qui a été tapé.
// ============================================================
import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Check, CircleCheck, MessageCircle, Phone, RotateCcw, UserX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCreateProspect, useProspects, useSetProspectStatus, useUpdateProspect, type Prospect } from '@/hooks/useSales';
import { INTERESTS, PROSPECT_STATUS, toE164, whatsappLink, type Interest, type ProspectStatus } from '@/lib/sales';
import { BottomSheet, TextArea, TextInput } from '@/mobile/designKit';
import { formatE164ForDisplay } from '@/components/form/PhoneNumberInput';
import { ListSkeleton, LoadError, ProspectStatusPill, SALES_CARD, ScreenHeader } from './SalesBits';
import { addDays, doualaDay, fmtLongDay, followUpIso, prospectName } from './salesHelpers';

const NOTES_MAX = 1000;
const REASON_MAX = 300;
const FIELD = 'h-12 rounded-xl border-input bg-card dark:bg-card';

interface Draft {
  firstName: string;
  lastName: string;
  phone: string;
  company: string;
  city: string;
  interests: Interest[];
  notes: string;
  /** « AAAA-MM-JJ » à Douala, ou '' (pas de relance). */
  followUp: string;
}

const EMPTY: Draft = { firstName: '', lastName: '', phone: '', company: '', city: '', interests: [], notes: '', followUp: '' };

function draftOf(p: Prospect): Draft {
  return {
    firstName: p.first_name,
    lastName: p.last_name ?? '',
    phone: p.phone,
    company: p.company ?? '',
    city: p.city ?? '',
    interests: [...p.interests],
    notes: p.notes ?? '',
    followUp: p.next_action_at ? doualaDay(p.next_action_at) : '',
  };
}

const sameSet = (a: Interest[], b: Interest[]) => a.length === b.length && a.every((x) => b.includes(x));

/* ── Écran ─────────────────────────────────────────────────────────────── */

export function CommercialProspectForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const prospects = useProspects();
  const back = { label: 'Prospects', onClick: () => navigate('/v/prospects') };

  if (!id) return <ProspectEditor key="new" />;

  if (prospects.isLoading) {
    return (
      <div>
        <ScreenHeader title="Prospect" back={back} />
        <div className="px-4 pt-4 sm:px-6">
          <div className={SALES_CARD}>
            <ListSkeleton rows={3} />
          </div>
        </div>
      </div>
    );
  }
  if (prospects.isError) {
    return (
      <div>
        <ScreenHeader title="Prospect" back={back} />
        <div className="px-4 pt-4 sm:px-6">
          <div className={SALES_CARD}>
            <LoadError message="Ce prospect n’a pas pu être chargé." onRetry={() => void prospects.refetch()} />
          </div>
        </div>
      </div>
    );
  }
  const prospect = prospects.data?.find((p) => p.id === id);
  if (!prospect) {
    return (
      <div>
        <ScreenHeader title="Prospect introuvable" back={back} />
        <p className="px-4 pt-3 text-[14px] text-muted-foreground sm:px-6">Il a peut-être été confié à un autre commercial.</p>
      </div>
    );
  }
  return <ProspectEditor key={prospect.id} prospect={prospect} />;
}

/* ── Formulaire (création ou fiche) ────────────────────────────────────── */

function ProspectEditor({ prospect }: { prospect?: Prospect }) {
  const navigate = useNavigate();
  const create = useCreateProspect();
  const update = useUpdateProspect();
  const setStatus = useSetProspectStatus();
  const [draft, setDraft] = useState<Draft>(() => (prospect ? draftOf(prospect) : EMPTY));
  const [tried, setTried] = useState(false);
  const [losing, setLosing] = useState(false);
  const [reason, setReason] = useState('');

  const isNew = !prospect;
  const won = prospect?.status === 'won';
  const busy = create.isPending || update.isPending || setStatus.isPending;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const e164 = toE164(draft.phone);
  const errors = {
    firstName: draft.firstName.trim() === '' ? 'Le prénom est requis' : null,
    phone: won ? null : draft.phone.trim() === '' ? 'Le numéro est requis' : !e164 ? 'Numéro invalide : indiquez l’indicatif (+237…)' : null,
  };
  const valid = !errors.firstName && !errors.phone;

  const original = prospect ? draftOf(prospect) : EMPTY;
  const phoneChanged = !!prospect && !won && e164 !== prospect.phone_e164;
  const dirty =
    isNew ||
    draft.firstName.trim() !== original.firstName.trim() ||
    draft.lastName.trim() !== original.lastName.trim() ||
    phoneChanged ||
    draft.company.trim() !== original.company.trim() ||
    draft.city.trim() !== original.city.trim() ||
    !sameSet(draft.interests, original.interests) ||
    draft.notes.trim() !== original.notes.trim() ||
    draft.followUp !== original.followUp;

  const submit = () => {
    setTried(true);
    if (!valid || busy) return;
    if (!prospect) {
      create.mutate(
        {
          firstName: draft.firstName,
          lastName: draft.lastName,
          phone: e164 as string,
          company: draft.company,
          city: draft.city,
          notes: draft.notes,
          interests: draft.interests,
          nextActionAt: draft.followUp ? followUpIso(draft.followUp) : null,
        },
        { onSuccess: (r) => navigate(`/v/prospects/${r.id}`, { replace: true }) },
      );
      return;
    }
    if (!dirty) return;
    update.mutate({
      id: prospect.id,
      firstName: draft.firstName.trim(),
      // '' efface un champ facultatif.
      lastName: draft.lastName.trim(),
      company: draft.company.trim(),
      city: draft.city.trim(),
      notes: draft.notes.trim(),
      interests: draft.interests,
      // Inchangés : on ne les envoie pas (un numéro « devenu client » ne change plus ; une relance non touchée garde son heure).
      ...(phoneChanged && e164 ? { phone: e164 } : {}),
      ...(draft.followUp !== original.followUp ? { nextActionAt: draft.followUp ? followUpIso(draft.followUp) : null } : {}),
    });
  };

  const changeStatus = (status: Exclude<ProspectStatus, 'won'>, why?: string) => {
    if (!prospect || busy) return;
    setStatus.mutate(
      { id: prospect.id, status, reason: why },
      {
        onSuccess: () => {
          setLosing(false);
          setReason('');
          toast.success(status === 'new' && prospect.status === 'lost' ? 'Prospect rouvert' : `Statut : ${PROSPECT_STATUS[status].label}`);
        },
      },
    );
  };

  const today = doualaDay();
  const name = prospect ? prospectName(prospect) : '';

  return (
    <div>
      <ScreenHeader
        title={isNew ? 'Nouveau prospect' : name}
        subtitle={prospect ? [prospect.company, prospect.city].filter(Boolean).join(' · ') || undefined : 'Quelqu’un qui pourrait devenir client'}
        back={{ label: 'Prospects', onClick: () => navigate('/v/prospects') }}
        action={prospect && <ProspectStatusPill status={prospect.status} className="h-8 px-3 text-[14px]" />}
      />

      <div className="space-y-5 px-4 pt-4 sm:px-6">
        {prospect && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <a
                href={`tel:${prospect.phone_e164}`}
                className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-primary text-[16px] font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Phone className="h-5 w-5" /> Appeler
              </a>
              <a
                href={whatsappLink(prospect.phone_e164)}
                target="_blank"
                rel="noreferrer"
                className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-[16px] font-semibold text-white hover:bg-[#1DA851] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2"
              >
                <MessageCircle className="h-5 w-5" /> WhatsApp
              </a>
            </div>
            <p className="-mt-2 text-center text-[13px] tabular-nums text-muted-foreground">{formatE164ForDisplay(prospect.phone_e164)}</p>

            {won ? (
              <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 px-4 py-3.5 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:ring-emerald-400/25">
                <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
                <div>
                  <div className="text-[15px] font-semibold text-emerald-900 dark:text-emerald-200">
                    Devenu client{prospect.converted_at ? ` le ${fmtLongDay(prospect.converted_at)}` : ''}
                  </div>
                  <div className="text-[13px] text-emerald-800/80 dark:text-emerald-300/80">Il compte désormais dans « Mes clients ». Son numéro ne change plus ici.</div>
                </div>
              </div>
            ) : prospect.status === 'lost' ? (
              <div className={cn(SALES_CARD, 'flex flex-wrap items-center justify-between gap-3 p-4')}>
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold">Perdu</div>
                  {prospect.lost_reason && <div className="text-[14px] text-muted-foreground">« {prospect.lost_reason} »</div>}
                </div>
                <button
                  type="button"
                  onClick={() => changeStatus('new')}
                  disabled={busy}
                  className="inline-flex h-11 items-center gap-1.5 rounded-xl px-4 text-[15px] font-semibold ring-1 ring-black/10 hover:bg-accent disabled:opacity-50 dark:ring-white/15"
                >
                  <RotateCcw className="h-4 w-4" /> Rouvrir
                </button>
              </div>
            ) : (
              <section className={cn(SALES_CARD, 'space-y-3 p-4')}>
                <div className="text-[13px] font-medium text-muted-foreground">Où en êtes-vous ?</div>
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Statut du prospect">
                  {(['new', 'contacted', 'interested'] as const).map((s) => {
                    const active = prospect.status === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        disabled={busy || active}
                        onClick={() => changeStatus(s)}
                        className={cn(
                          'inline-flex h-11 items-center justify-center gap-1 rounded-xl px-2 text-[14px] font-semibold transition-colors',
                          active ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-accent disabled:opacity-50',
                        )}
                      >
                        {active && <Check className="h-4 w-4 shrink-0" />}
                        <span className="truncate">{PROSPECT_STATUS[s].label}</span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setLosing(true)}
                  disabled={busy}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl px-2 text-[14px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/10"
                >
                  <UserX className="h-4 w-4" /> Marquer perdu
                </button>
              </section>
            )}
          </>
        )}

        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-5"
        >
          <section className={cn(SALES_CARD, 'space-y-4 p-4 sm:p-5')}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Prénom" required htmlFor="pr-first" error={tried ? errors.firstName : null}>
                <TextInput id="pr-first" className={FIELD} value={draft.firstName} onChange={(e) => set('firstName', e.target.value)} maxLength={80} autoCapitalize="words" autoComplete="off" />
              </Field>
              <Field label="Nom" htmlFor="pr-last">
                <TextInput id="pr-last" className={FIELD} value={draft.lastName} onChange={(e) => set('lastName', e.target.value)} maxLength={80} autoCapitalize="words" autoComplete="off" />
              </Field>
            </div>
            <Field
              label="Téléphone"
              required={!won}
              htmlFor="pr-phone"
              error={tried ? errors.phone : null}
              hint={won ? 'Le numéro d’un prospect devenu client ne change plus.' : e164 && draft.phone.trim() !== e164 ? `Sera enregistré : ${formatE164ForDisplay(e164)}` : 'Avec l’indicatif, ex. +237 6 99 12 34 56 (le +237 s’ajoute seul pour un numéro à 9 chiffres).'}
            >
              <TextInput
                id="pr-phone"
                className={FIELD}
                type="tel"
                inputMode="tel"
                autoComplete="off"
                placeholder="+237 6…"
                value={draft.phone}
                onChange={(e) => set('phone', e.target.value)}
                disabled={won}
                maxLength={32}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Entreprise" htmlFor="pr-company">
                <TextInput id="pr-company" className={FIELD} value={draft.company} onChange={(e) => set('company', e.target.value)} maxLength={120} autoComplete="off" />
              </Field>
              <Field label="Ville" htmlFor="pr-city">
                <TextInput id="pr-city" className={FIELD} value={draft.city} onChange={(e) => set('city', e.target.value)} maxLength={80} placeholder="Douala" autoCapitalize="words" autoComplete="off" />
              </Field>
            </div>
          </section>

          <section className={cn(SALES_CARD, 'space-y-4 p-4 sm:p-5')}>
            <div>
              <div className="mb-2 text-[14px] font-semibold">Ce qui l’intéresse</div>
              <div className="flex flex-wrap gap-2">
                {INTERESTS.map((i) => {
                  const on = draft.interests.includes(i.value);
                  return (
                    <button
                      key={i.value}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set('interests', on ? draft.interests.filter((x) => x !== i.value) : [...draft.interests, i.value])}
                      className={cn(
                        'inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        on ? 'bg-primary text-primary-foreground' : 'bg-card ring-1 ring-black/10 hover:bg-accent dark:ring-white/15',
                      )}
                    >
                      {on && <Check className="h-4 w-4" />}
                      {i.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <Field label="Prochaine relance" htmlFor="pr-follow" hint={draft.followUp ? 'À 9 h, heure de Douala.' : 'Vous la retrouverez dans « À relancer » le jour venu.'}>
              <div className="flex flex-wrap items-center gap-2">
                <TextInput
                  id="pr-follow"
                  type="date"
                  className={cn(FIELD, 'w-auto min-w-[11rem] flex-1 sm:flex-none')}
                  value={draft.followUp}
                  onChange={(e) => set('followUp', e.target.value)}
                />
                {draft.followUp ? (
                  <button type="button" onClick={() => set('followUp', '')} className="h-11 rounded-xl px-3 text-[14px] font-semibold text-muted-foreground hover:bg-accent hover:text-foreground">
                    Effacer
                  </button>
                ) : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  { label: 'Demain', days: 1 },
                  { label: 'Dans 3 jours', days: 3 },
                  { label: 'Dans une semaine', days: 7 },
                ].map((q) => {
                  const day = addDays(today, q.days);
                  return (
                    <button
                      key={q.days}
                      type="button"
                      onClick={() => set('followUp', day)}
                      aria-pressed={draft.followUp === day}
                      className={cn(
                        'h-9 rounded-full px-3 text-[13px] font-medium transition-colors',
                        draft.followUp === day ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-accent',
                      )}
                    >
                      {q.label}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Notes" htmlFor="pr-notes" hint={`${draft.notes.length} / ${NOTES_MAX}`}>
              <TextArea
                id="pr-notes"
                rows={4}
                className="rounded-xl border-input bg-card dark:bg-card"
                maxLength={NOTES_MAX}
                value={draft.notes}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="Ce qu’il importe, ses fournisseurs, quand le rappeler…"
              />
            </Field>
          </section>

          <div className="flex flex-col-reverse gap-2 pb-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => navigate('/v/prospects')}
              className="h-12 rounded-xl px-5 text-[15px] font-semibold ring-1 ring-black/10 hover:bg-accent dark:ring-white/15"
            >
              {isNew ? 'Annuler' : 'Retour'}
            </button>
            <button
              type="submit"
              disabled={busy || (!isNew && !dirty)}
              className="h-12 rounded-xl bg-primary px-6 text-[15px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 sm:min-w-[12rem]"
            >
              {create.isPending || update.isPending ? 'Enregistrement…' : isNew ? 'Ajouter le prospect' : dirty ? 'Enregistrer' : 'Enregistré'}
            </button>
          </div>
        </form>
      </div>

      <BottomSheet open={losing} onClose={() => !setStatus.isPending && setLosing(false)} title="Prospect perdu">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (reason.trim().length >= 3) changeStatus('lost', reason);
          }}
          className="space-y-4"
        >
          <Field label="Pourquoi ?" htmlFor="pr-reason" hint="Quelques mots suffisent : prix, délai, a déjà un transitaire…">
            <TextArea id="pr-reason" rows={3} maxLength={REASON_MAX} value={reason} onChange={(e) => setReason(e.target.value)} className="rounded-xl" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setLosing(false)} disabled={setStatus.isPending} className="h-12 rounded-xl text-[15px] font-semibold ring-1 ring-black/10 hover:bg-accent disabled:opacity-50 dark:ring-white/15">
              Annuler
            </button>
            <button
              type="submit"
              disabled={reason.trim().length < 3 || setStatus.isPending}
              className="h-12 rounded-xl bg-red-600 text-[15px] font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {setStatus.isPending ? '…' : 'Marquer perdu'}
            </button>
          </div>
        </form>
      </BottomSheet>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[14px] font-semibold">
        {label}
        {required && <span className="ml-0.5 text-red-600 dark:text-red-400">*</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-[13px] font-medium text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-[13px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

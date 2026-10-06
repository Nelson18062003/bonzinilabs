// ============================================================
// ESPACE COMMERCIAL — la fiche d'un prospect (« /v/prospects/:id »).
//
// En tête : son nom, son entreprise et sa ville, son statut. Puis ses
// numéros — Appeler et WhatsApp pour CHACUN — et son email ; où en est-on
// (À contacter / Contacté / Intéressé, « Marquer perdu » avec un motif,
// « Rouvrir » ; « Devenu client » est figé : c'est le compte créé qui l'a
// posé) ; ses besoins, mis en valeur ; son identité, son activité, la suite.
// « Modifier » sur une section rouvre l'étape de l'assistant
// (« ?modifier=… »). Une fiche à laquelle il manque le nom, le sexe, la
// ville ou « ses plus gros problèmes » (tout le pipeline d'avant le 06/10)
// le dit dans un bandeau « Fiche incomplète » ; « Compléter » enchaîne les
// étapes qui manquent.
// ============================================================
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ChevronLeft, CircleCheck, RotateCcw, TriangleAlert, UserX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSetProspectStatus, type Prospect } from '@/hooks/useSales';
import { PROSPECT_STATUS, type ProspectStatus } from '@/lib/sales';
import { BottomSheet } from '@/mobile/designKit';
import { Field, Segmented, StatusTag } from './SalesUi';
import { AREA, CARD, CHIP, SECTION_TITLE, btn } from './uiClasses';
import { ActivitySection, ContactSection, HelpSection, IdentitySection, NeedsSection, NextSection } from './ProspectSections';
import { draftOf, joinFr, missingOf, type StepId } from './prospectDraft';
import { fmtLongDay, initialsOf, isDue, prospectName } from './salesHelpers';

const REASON_MAX = 300;
const QUICK_REASONS = ['Trouve nos prix trop chers', 'A déjà un transitaire', 'Trouve le délai trop long', 'Pas d’importation en ce moment'];
const OPEN_STEPS = ['new', 'contacted', 'interested'] as const;
type OpenStatus = (typeof OPEN_STEPS)[number];

export function ProspectDetail({ prospect, onEdit, onComplete }: { prospect: Prospect; onEdit: (step: StepId) => void; onComplete: () => void }) {
  const navigate = useNavigate();
  const setStatus = useSetProspectStatus();
  const [losing, setLosing] = useState(false);
  const [reason, setReason] = useState('');

  const d = useMemo(() => draftOf(prospect), [prospect]);
  const won = prospect.status === 'won';
  const busy = setStatus.isPending;
  const name = prospectName(prospect);
  const where = [prospect.company, prospect.city].filter(Boolean).join(' · ');
  const missing = missingOf(prospect);
  const numbers = [
    { e164: prospect.phone_e164, label: null, main: true },
    ...(prospect.phones ?? []).map((p) => ({ e164: p.phone_e164, label: p.label, main: false })),
  ];

  const changeStatus = (status: Exclude<ProspectStatus, 'won'>, why?: string) => {
    if (busy) return;
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

  return (
    <div className="pb-8">
      <header className="px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] sm:px-6">
        <div className="flex h-11 items-center justify-between gap-3">
          <button type="button" onClick={() => navigate('/v/prospects')} className={btn('ghost', 'sm', '-ml-2 gap-1 pl-1.5')}>
            <ChevronLeft className="h-4 w-4" /> Prospects
          </button>
          <StatusTag status={prospect.status} />
        </div>
        <div className="s-enter mt-3 flex items-center gap-4">
          <span
            aria-hidden
            className={cn(
              'flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-[18px] font-semibold',
              won ? 's-good bg-[hsl(var(--s-green-tint))]' : 's-field-bg s-ink',
            )}
          >
            {initialsOf(name)}
          </span>
          <div className="min-w-0">
            <h1 className="break-words text-[26px] font-semibold leading-[1.15] tracking-[-0.02em] s-ink">{name}</h1>
            {where && <p className="mt-1 text-[15px] s-ink-2">{where}</p>}
          </div>
        </div>
      </header>

      <div className="space-y-4 px-4 pt-6 sm:px-6">
        {missing.length > 0 && (
          <div data-tone="warn" className="s-note s-enter flex items-start gap-3 rounded-[16px] py-3 pl-4 pr-2">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 s-warn" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold s-ink">Fiche incomplète</div>
              <div className="mt-0.5 text-[14px] s-ink-2">Il manque {joinFr(missing.map((m) => m.label))}.</div>
            </div>
            <button type="button" onClick={onComplete} className={btn('quiet', 'sm', 'shrink-0')}>
              Compléter
            </button>
          </div>
        )}

        <ContactSection numbers={numbers} email={prospect.email ?? ''} actions onEdit={onEdit} />

        {won ? (
          <div data-tone="good" className="s-note s-enter flex items-start gap-3 rounded-[16px] px-4 py-3.5" style={{ animationDelay: '40ms' }}>
            <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 s-good" aria-hidden />
            <div>
              <div className="text-[15px] font-semibold s-ink">Devenu client{prospect.converted_at ? ` le ${fmtLongDay(prospect.converted_at)}` : ''}</div>
              <div className="mt-0.5 text-[14px] s-ink-2">Il compte désormais dans «&nbsp;Mes clients&nbsp;». Ses numéros ne changent plus ici.</div>
            </div>
          </div>
        ) : prospect.status === 'lost' ? (
          <section className={cn(CARD, 's-enter flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5')} style={{ animationDelay: '40ms' }}>
            <div className="min-w-0">
              <div className={SECTION_TITLE}>Perdu</div>
              {prospect.lost_reason ? <div className="mt-1 text-[15px] s-ink">« {prospect.lost_reason} »</div> : <div className="mt-1 text-[15px] s-ink-3">Sans motif</div>}
            </div>
            <button type="button" onClick={() => changeStatus('new')} disabled={busy} className={btn('quiet', 'md', 'gap-1.5')}>
              <RotateCcw className="h-4 w-4" /> Rouvrir
            </button>
          </section>
        ) : (
          <section className={cn(CARD, 's-enter space-y-3 p-4 sm:p-5')} style={{ animationDelay: '40ms' }}>
            <div className={SECTION_TITLE}>Où en êtes-vous ?</div>
            <Segmented<OpenStatus>
              ariaLabel="Statut du prospect"
              options={OPEN_STEPS.map((st) => ({ value: st, label: PROSPECT_STATUS[st].label }))}
              value={prospect.status as OpenStatus}
              onChange={(st) => changeStatus(st)}
              disabled={busy}
            />
            <button type="button" onClick={() => setLosing(true)} disabled={busy} className={btn('danger', 'sm', '-ml-1 gap-1.5')}>
              <UserX className="h-4 w-4" /> Marquer perdu
            </button>
          </section>
        )}

        <NeedsSection d={d} onEdit={onEdit} delay={80} />
        <HelpSection d={d} onEdit={onEdit} delay={100} />
        <NextSection d={d} onEdit={onEdit} delay={120} due={isDue(prospect)} />
        <IdentitySection d={d} onEdit={onEdit} delay={160} />
        <ActivitySection d={d} onEdit={onEdit} delay={200} />
      </div>

      <BottomSheet open={losing} onClose={() => !busy && setLosing(false)} title="Prospect perdu" className="s-sheet">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (reason.trim().length >= 3) changeStatus('lost', reason);
          }}
          className="space-y-4"
        >
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Motifs fréquents">
            {QUICK_REASONS.map((r) => (
              <button key={r} type="button" aria-pressed={reason === r} onClick={() => setReason(r)} className={cn(CHIP, 'h-9 px-3 text-[14px]')}>
                {r}
              </button>
            ))}
          </div>
          <Field label="Pourquoi ?" htmlFor="pr-reason" hint="Un motif fréquent d’un toucher, ou le vôtre en quelques mots.">
            {/* eslint-disable-next-line no-restricted-syntax -- champ de « /v » à 17 px */}
            <textarea id="pr-reason" rows={3} maxLength={REASON_MAX} value={reason} onChange={(e) => setReason(e.target.value)} className={AREA} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setLosing(false)} disabled={busy} className={btn('quiet', 'lg')}>
              Annuler
            </button>
            <button type="submit" disabled={reason.trim().length < 3 || busy} className={btn('red', 'lg')}>
              {busy ? '…' : 'Marquer perdu'}
            </button>
          </div>
        </form>
      </BottomSheet>
    </div>
  );
}

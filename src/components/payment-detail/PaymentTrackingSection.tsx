// ============================================================
// Suivi du paiement — fiche v7 : 4 jalons (créé · coordonnées du
// bénéficiaire · traitement Bonzini · bénéficiaire payé), états
// dérivés de paymentLifecycle (rouge = à toi d'agir · lilas =
// Bonzini travaille · vert = fait), horodatés depuis les événements
// réels (sortie de buildPaymentTimelineSteps). L'étape courante
// porte l'action quand le client doit agir (« todo » rouge).
// ============================================================
import { AlertCircle, ArrowRight, Check, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Payment } from '@/hooks/usePayments';
import { safeFormatDate, type PaymentTimelineStepUI } from '@/lib/paymentTimeline';
import { paymentLifecycle, LIFECYCLE_COLOR } from '@/lib/paymentLifecycle';
import { SURFACE, TEXT, SectionTitle } from '@/mobile/designKit';

interface Props {
  payment: Payment;
  /** Sortie de buildPaymentTimelineSteps — source des dates réelles. */
  timelineSteps: PaymentTimelineStepUI[];
  timelineLoading: boolean;
  onCompleteBeneficiary: () => void;
}

type StepState = 'done' | 'current-todo' | 'current-progress' | 'failed' | 'pending';

const DATE_FMT = 'd MMM yyyy · HH:mm';

/** Événement de timeline → jalon (0..3) qu'il horodate. */
const EVENT_BUCKET: Record<string, number> = {
  created: 0,
  waiting_info: 1,
  waiting_beneficiary_info: 1,
  info_provided: 1,
  info_updated: 1,
  ready_for_payment: 1,
  cash_pending: 1,
  cash_scanned: 1,
  processing: 2,
  proof_uploaded: 2,
  completed: 3,
  rejected: 3,
};

const STATE_COLOR: Record<Exclude<StepState, 'pending'>, string> = {
  done: LIFECYCLE_COLOR.done,
  'current-progress': LIFECYCLE_COLOR.progress,
  'current-todo': LIFECYCLE_COLOR.todo,
  failed: LIFECYCLE_COLOR.failed,
};

function Dot({ state }: { state: StepState }) {
  if (state === 'pending') {
    return <div className="h-5 w-5 shrink-0 rounded-full border-2 border-black/[0.10] dark:border-white/[0.12]" />;
  }
  const Icon =
    state === 'done' ? Check : state === 'failed' ? X : state === 'current-todo' ? AlertCircle : Loader2;
  return (
    <div
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
      style={{ background: STATE_COLOR[state] }}
    >
      <Icon
        className={cn('h-3 w-3 text-white', state === 'current-progress' && 'animate-spin')}
        strokeWidth={3}
      />
    </div>
  );
}

export function PaymentTrackingSection({
  payment,
  timelineSteps,
  timelineLoading,
  onCompleteBeneficiary,
}: Props) {
  const lc = paymentLifecycle(payment.status);
  const isCash = payment.method === 'cash';
  const failed = lc.kind === 'failed';

  // Horodatage par jalon : le plus récent des événements du bucket gagne
  // (ISO comparable lexicographiquement), avec repli sur les champs du paiement.
  const stamps: (string | undefined)[] = [undefined, undefined, undefined, undefined];
  for (const ev of timelineSteps) {
    if (!ev.timestamp) continue;
    const bucket = EVENT_BUCKET[ev.key];
    if (bucket === undefined) continue;
    if (!stamps[bucket] || ev.timestamp > stamps[bucket]!) stamps[bucket] = ev.timestamp;
  }
  stamps[0] = stamps[0] ?? payment.created_at;
  if (isCash) stamps[1] = stamps[1] ?? payment.cash_scanned_at ?? undefined;
  stamps[3] =
    stamps[3] ?? payment.processed_at ?? (isCash ? payment.cash_paid_at ?? undefined : undefined);

  const labels = [
    'Paiement créé',
    isCash ? 'QR présenté au bureau' : 'Coordonnées du bénéficiaire',
    'Traitement par Bonzini',
    failed
      ? payment.status === 'rejected'
        ? 'Paiement refusé'
        : 'Paiement annulé'
      : isCash
        ? 'Cash remis au bénéficiaire'
        : 'Bénéficiaire payé',
  ];

  const stateOf = (i: number): StepState => {
    if (failed) {
      if (i === 3) return 'failed';
      if (i === 0) return 'done';
      // Honnête : pas de coche verte pour un jalon jamais franchi.
      return stamps[i] ? 'done' : 'pending';
    }
    if (i < lc.step) return 'done';
    if (i > lc.step) return 'pending';
    if (lc.kind === 'done') return 'done';
    return lc.kind === 'todo' ? 'current-todo' : 'current-progress';
  };

  const subOf = (i: number, state: StepState): string | undefined => {
    if (state === 'done' || state === 'failed') {
      const date = safeFormatDate(stamps[i], DATE_FMT);
      if (date) return date;
      return i === 1 ? (isCash ? 'QR scanné' : 'Complétées') : undefined;
    }
    if (state === 'current-todo') {
      return isCash ? 'Présentez ce QR au bureau Bonzini' : 'Coordonnées manquantes';
    }
    if (state === 'current-progress') {
      return i === 2
        ? isCash
          ? 'En cours au bureau Bonzini'
          : 'Bonzini règle votre fournisseur'
        : 'En cours…';
    }
    return undefined;
  };

  const states = labels.map((_, i) => stateOf(i));

  return (
    <section>
      <SectionTitle>Suivi du paiement</SectionTitle>
      <div className={cn('rounded-[22px] p-5', SURFACE.card, SURFACE.shadow)}>
        {timelineLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={cn('h-9 w-full animate-pulse rounded-xl', SURFACE.canvas)} />
            ))}
          </div>
        ) : (
          labels.map((label, i) => {
            const state = states[i];
            const sub = subOf(i, state);
            const last = i === labels.length - 1;
            const next = !last ? states[i + 1] : undefined;
            const lineColor =
              next && next !== 'pending' ? STATE_COLOR[next] : undefined;
            return (
              <div key={label} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <Dot state={state} />
                  {!last && (
                    <div
                      className={cn(
                        'my-1 w-0.5 flex-1',
                        !lineColor && 'bg-black/[0.08] dark:bg-white/[0.10]',
                      )}
                      style={{ minHeight: 16, ...(lineColor ? { background: lineColor } : {}) }}
                    />
                  )}
                </div>
                <div className={cn('min-w-0 flex-1', last ? 'pb-0' : 'pb-3')}>
                  <div
                    className={cn(
                      'text-[14px] font-bold',
                      state === 'pending' ? TEXT.muted : TEXT.strong,
                    )}
                  >
                    {label}
                  </div>
                  {sub && (
                    <div
                      className={cn(
                        'mt-0.5 text-[11px]',
                        state === 'current-todo' ? 'font-semibold' : TEXT.muted,
                      )}
                      style={state === 'current-todo' ? { color: LIFECYCLE_COLOR.todo } : undefined}
                    >
                      {sub}
                    </div>
                  )}
                  {state === 'current-todo' && !isCash && (
                    <button
                      onClick={onCompleteBeneficiary}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-bold text-white transition active:scale-95"
                      style={{ background: LIFECYCLE_COLOR.todo }}
                    >
                      Compléter les coordonnées <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

// ============================================================
// ESPACE COMMERCIAL — l'assistant « prospect », à la Revolut : une idée par
// écran, un grand titre court, une progression fine, « Continuer » en bas
// (collé au-dessus du clavier : le cadre suit la zone visible, cf.
// ViewportShell), retour arrière sans perte.
//
//   · NewProspectWizard (« /v/prospects/new ») : sept étapes, la dernière un
//     récapitulatif dont chaque section se rouvre d'un toucher. Le brouillon
//     est gardé dans le téléphone à chaque frappe, SOUS LE COMPTE du
//     commercial (prospectDraft.ts), et repris à sa prochaine ouverture ; il
//     s'efface à l'enregistrement — même si l'écran a été quitté pendant
//     l'envoi. Un refus du serveur (un de ses clients, prospect déjà
//     suivi, un AUTRE numéro déjà pris) ramène à l'étape et à la ligne
//     concernées, le message sous le champ.
//     Les numéros sont vérifiés EN DIRECT (07/10) : un refus (un de ses
//     clients, un de ses prospects, suivi par un autre commercial) arrête
//     « Continuer » comme un champ en défaut ; le numéro d'un client Bonzini
//     n'arrête rien — le récapitulatif le redit, la fiche s'enregistre
//     « À vérifier » et s'ouvre sur l'explication (la direction décidera).
//   · EditProspectWizard (« /v/prospects/:id?modifier=besoins ») : la même
//     étape, pour une section de la fiche ; n'envoie que ce qui a changé.
//     « ?completer » enchaîne les étapes où il manque quelque chose. Ce qui
//     est tapé est gardé (un retour du téléphone ne perd rien) ; la croix
//     demande avant d'abandonner des changements.
//
// Validation par étape : les champs obligatoires se signalent après
// « Continuer » (pas pendant la frappe) ; une date, un email ou un numéro
// mal formés, dès qu'on quitte le champ. Le focus va au premier en défaut.
// La touche Entrée (« Suivant » du clavier) va au champ suivant de l'étape,
// et ne passe à l'étape suivante que depuis le dernier.
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, CornerDownLeft, Info, RotateCcw, X } from 'lucide-react';
import { ViewportShell } from '@/components/layout/ViewportShell';
import { toE164 } from '@/components/form/PhoneNumberInput';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCreateProspect, useUpdateProspect, type Prospect } from '@/hooks/useSales';
import { BottomSheet } from '@/mobile/designKit';
import { Odometer, Shimmer, StepProgress } from './SalesUi';
import { btn } from './uiClasses';
import { ActivitySection, ContactSection, HelpSection, IdentitySection, NeedsSection, NextSection } from './ProspectSections';
import { BusinessStep, HelpStep, NeedsStep, NextStep, ReachStep, WhoStep, type StepProps } from './ProspectSteps';
import {
  COMPLETE,
  EMPTY_DRAFT,
  STEPS,
  clearDraft,
  clearEditDraft,
  draftOf,
  editSession,
  firstInvalidStep,
  hasClientNumber,
  isDraftEmpty,
  joinFr,
  loadDraft,
  loadEditDraft,
  missingOf,
  otherPhonesOf,
  phoneCheckErrors,
  saveDraft,
  saveEditDraft,
  stepCopy,
  stepErrors,
  stepIndex,
  stepMeta,
  stepOfServerError,
  toCreateInput,
  toPatch,
  type PhoneCheckResult,
  type PhoneChecks,
  type ProspectDraft,
  type StepErrors,
  type StepId,
  type ValidateOptions,
} from './prospectDraft';

const FORM_ID = 'prospect-wizard';

/** L'état de navigation de la fiche juste enregistrée « À vérifier » (elle le dit en tête). */
export interface SavedState {
  saved?: 'to_verify';
}

/* ── L'état commun : brouillon, erreurs montrées, focus ────────────────── */

interface ServerError {
  step: StepId;
  field?: string;
  message: string;
  /** Le brouillon refusé : le message tient tant qu'il n'a pas changé. */
  snapshot: string;
}

function useDraftState(initial: () => ProspectDraft) {
  const [draft, setDraft] = useState<ProspectDraft>(initial);
  const [tried, setTried] = useState<Set<StepId>>(() => new Set());
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const [refusal, setRefusal] = useState<ServerError | null>(null);
  // Le refus du serveur ne vaut que pour le brouillon refusé : une correction l'efface.
  const server = refusal && refusal.snapshot === JSON.stringify(draft) ? refusal : null;
  const setServer = (e: Omit<ServerError, 'snapshot'> | null) => setRefusal(e && { ...e, snapshot: JSON.stringify(draft) });

  const update = (fn: (d: ProspectDraft) => ProspectDraft) => setDraft(fn);
  const set: StepProps['set'] = (k, v) => update((d) => ({ ...d, [k]: v }));
  const touch = (id: string) => setTouched((s) => (s.has(id) ? s : new Set(s).add(id)));
  const markTried = (step: StepId) => setTried((s) => (s.has(step) ? s : new Set(s).add(step)));

  // Les réponses de la vérification en direct, gardées d'une étape à l'autre
  // (chacune ne vaut que pour le numéro qu'elle a vérifié).
  const [checks, setChecks] = useState<PhoneChecks>({});
  const onCheck = useCallback(
    (id: string, r: PhoneCheckResult) =>
      setChecks((c) => (c[id] && c[id].e164 === r.e164 && c[id].status === r.status && c[id].prospectId === r.prospectId ? c : { ...c, [id]: r })),
    [],
  );

  /**
   * Ce qui arrête une étape : ses champs en défaut, et — pour « Comment le
   * joindre ? » — les refus de la vérification en direct (l'étape les
   * affiche elle-même, avec leur lien ; une erreur du champ passe avant).
   */
  const blocking = (step: StepId, o: ValidateOptions): StepErrors => {
    const local = stepErrors(draft, step, o);
    if (step !== 'reach') return local;
    return { ...phoneCheckErrors(draft, checks), ...local };
  };
  /** La première étape (avant le récapitulatif) qui arrête l'enregistrement, parmi `steps`. */
  const firstBlocked = (steps: StepId[], o: ValidateOptions): StepId | null =>
    steps.find((st) => st !== 'review' && Object.keys(blocking(st, o)).length > 0) ?? null;

  /** Les erreurs à montrer sur une étape : toutes après « Continuer », sinon celles des champs quittés ; plus le refus du serveur. */
  const shownErrors = (step: StepId, o: ValidateOptions): StepErrors => {
    const all = stepErrors(draft, step, o);
    const shown: StepErrors = {};
    for (const [id, msg] of Object.entries(all)) if (tried.has(step) || touched.has(id)) shown[id] = msg;
    if (server && server.step === step && server.field) shown[server.field] = server.message;
    return shown;
  };

  /** Un refus du serveur sans champ précis (« Dix numéros au plus »…), sur l'étape affichée : en tête. */
  const unplaced = (step: StepId): string | null => (server && server.step === step && !server.field ? server.message : null);

  return {
    draft,
    setDraft,
    update,
    set,
    touch,
    markTried,
    shownErrors,
    unplaced,
    server,
    setServer,
    setTried,
    setTouched,
    blocking,
    firstBlocked,
    clientNumber: hasClientNumber(draft, checks),
    onCheck,
  };
}

/** Le focus (et l'écran) sur un champ, une fois rendu. Un groupe radio : son choix courant (ou le premier). */
function focusField(id: string) {
  const later = window.requestAnimationFrame ?? ((cb: () => void) => window.setTimeout(cb, 0));
  later(() => {
    const found = document.getElementById(id);
    if (!found) return;
    const el = found.getAttribute('role') === 'radiogroup' ? (found.querySelector<HTMLElement>('[role="radio"][tabindex="0"]') ?? found) : found;
    el.focus({ preventScroll: true });
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    el.scrollIntoView?.({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  });
}

/** Les arrêts de la touche Entrée dans une étape : les champs, et le choix d'un groupe radio. */
const ENTER_STOPS = 'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), [role="radio"][tabindex="0"]';

/**
 * Entrée dans un champ d'une ligne (ou « Suivant » du clavier Android) : le
 * champ suivant de l'étape, sans rien signaler ; depuis le dernier, l'étape
 * suivante. Dans un champ long, elle va à la ligne. Une touche venue d'un
 * portail (la recherche du pays, rendue hors du formulaire mais dont
 * l'événement remonte l'arbre React jusqu'ici) ou déjà consommée (cmdk
 * choisit le pays) n'est pas pour nous.
 */
function enterAdvances(next: () => void) {
  return (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.defaultPrevented) return;
    const t = e.target as HTMLElement;
    if (!(t instanceof Node) || !e.currentTarget.contains(t)) return;
    if (t.tagName !== 'INPUT') return;
    if (['checkbox', 'radio', 'button', 'submit', 'file'].includes((t as HTMLInputElement).type)) return;
    e.preventDefault();
    const stops = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(ENTER_STOPS));
    const after = stops[stops.indexOf(t) + 1];
    if (after) {
      after.focus();
      return;
    }
    next();
  };
}

function StepFields({ step, ...props }: StepProps & { step: StepId }) {
  switch (step) {
    case 'who':
      return <WhoStep {...props} />;
    case 'reach':
      return <ReachStep {...props} />;
    case 'business':
      return <BusinessStep {...props} />;
    case 'needs':
      return <NeedsStep {...props} />;
    case 'help':
      return <HelpStep {...props} />;
    case 'next':
      return <NextStep {...props} />;
    default:
      return null;
  }
}

/* ── Le cadre ──────────────────────────────────────────────────────────── */

function WizardFrame({
  eyebrow,
  progress,
  announce,
  onBack,
  backLabel,
  onClose,
  primary,
  primaryDisabled,
  busy,
  onPrimary,
  scrollRef,
  onKeyDown,
  overlay,
  children,
}: {
  eyebrow: ReactNode;
  progress?: { index: number; count: number };
  /** Lu par un lecteur d'écran à chaque étape (« Étape 2 sur 7 : Comment joindre Gaëlle ? »). */
  announce: string;
  /** Absent : la croix seule (première étape, ou section unique). */
  onBack?: () => void;
  backLabel?: string;
  onClose: () => void;
  primary: string;
  primaryDisabled?: boolean;
  busy?: boolean;
  onPrimary: () => void;
  scrollRef: RefObject<HTMLDivElement>;
  onKeyDown: (e: KeyboardEvent<HTMLFormElement>) => void;
  /** Une feuille (« Abandonner vos modifications ? »), rendue hors du cadre. */
  overlay?: ReactNode;
  children: ReactNode;
}) {
  const header = (
    <div className="s-surface">
      <div className="mx-auto w-full max-w-lg px-3 pt-[calc(0.5rem+env(safe-area-inset-top))] sm:px-4">
        <div className="grid h-12 grid-cols-[44px_1fr_44px] items-center">
          {onBack ? (
            // Pendant l'envoi, ni retour ni fermeture : l'enregistrement va jusqu'au bout sous les yeux.
            <button type="button" onClick={onBack} disabled={busy} aria-label={backLabel ?? 'Étape précédente'} className={btn('ghost', 'icon')}>
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : (
            <span />
          )}
          <div className="truncate text-center text-[13px] font-semibold s-ink-2">{eyebrow}</div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Fermer" className={btn('ghost', 'icon')}>
            <X className="h-5 w-5" />
          </button>
        </div>
        {progress && progress.count > 1 ? <StepProgress index={progress.index} count={progress.count} className="mx-2 mb-1 mt-1" /> : <div className="h-[3px]" />}
        <p className="sr-only" aria-live="polite">
          {announce}
        </p>
      </div>
    </div>
  );
  const footer = (
    <div className="s-surface shadow-[0_-1px_0_hsl(var(--s-line))]">
      <div className="mx-auto w-full max-w-lg px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:px-6">
        <button type="button" onClick={onPrimary} disabled={busy || primaryDisabled} className={btn('ink', 'xl', 'w-full')}>
          {busy ? <Shimmer>Enregistrement…</Shimmer> : primary}
          {!busy && !primaryDisabled && <CornerDownLeft className="hidden h-4 w-4 opacity-50 sm:block" aria-hidden />}
        </button>
      </div>
    </div>
  );
  return (
    <>
      <ViewportShell header={header} footer={footer} scrollRef={scrollRef} className="s-surface">
        <form
          id={FORM_ID}
          noValidate
          onSubmit={(e) => e.preventDefault()}
          onKeyDown={onKeyDown}
          className="mx-auto w-full max-w-lg px-5 pb-10 pt-4 sm:px-6"
        >
          {children}
        </form>
      </ViewportShell>
      {overlay}
    </>
  );
}

/** Le titre d'une étape : grand, court, au prénom du prospect dès qu'on le connaît. */
function StepHeading({ step, d }: { step: StepId; d: ProspectDraft }) {
  const { title, lead } = stepCopy(step, d);
  return (
    <div className="mb-7">
      <h1 className="text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] s-ink">{title}</h1>
      <p className="mt-2 text-[16px] leading-snug s-ink-2">{lead}</p>
    </div>
  );
}

/** Un refus du serveur sans champ précis, en tête de l'étape. */
function Refusal({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" data-tone="warn" className="s-note s-pop mb-6 rounded-[14px] px-4 py-3 text-[15px] font-medium s-ink">
      {message}
    </p>
  );
}

/** « Brouillon repris » / « Modification reprise » : ce qui était tapé est là, rien n'est enregistré ; de quoi repartir de zéro. */
function ResumedNote({ title, action, onReset }: { title: string; action: string; onReset: () => void }) {
  return (
    <div data-tone="accent" className="s-note mb-6 rounded-[14px] px-4 pb-2 pt-3">
      <div className="text-[15px] font-semibold s-ink">{title}</div>
      <div className="text-[14px] leading-snug s-ink-2">Ce que vous aviez saisi est là. Rien n’est encore enregistré.</div>
      <button type="button" onClick={onReset} className={btn('ghost', 'sm', '-ml-3 mt-1 gap-1.5')}>
        <RotateCcw className="h-3.5 w-3.5" aria-hidden /> {action}
      </button>
    </div>
  );
}

const announceOf = (index: number, count: number, step: StepId, d: ProspectDraft) => `Étape ${index + 1} sur ${count} : ${stepCopy(step, d).title}`;

/* ── Création ──────────────────────────────────────────────────────────── */

export function NewProspectWizard() {
  const navigate = useNavigate();
  // Le brouillon est À CE COMPTE : rangé sous son identifiant, relu par lui seul.
  const owner = useAdminAuth().currentUser?.id ?? null;
  // Effacé à la réussite même si l'écran a été quitté pendant l'envoi (rappel de la mutation, pas de l'appel).
  const create = useCreateProspect({ onCreated: () => clearDraft(owner), quietErrors: true });
  const [restored] = useState(() => loadDraft(owner));
  const s = useDraftState(() => restored?.draft ?? EMPTY_DRAFT);
  const { draft } = s;
  const [step, setStep] = useState<StepId>(() => {
    if (!restored) return 'who';
    // On reprend où il en était — pas au-delà de la première étape encore à remplir.
    const bad = firstInvalidStep(restored.draft);
    return bad && stepIndex(bad) < stepIndex(restored.step) ? bad : restored.step;
  });
  const allSteps = STEPS.map((x) => x.id);
  const phoneCheck = useMemo(() => ({ excludeId: null, onResult: s.onCheck }), [s.onCheck]);
  const [dir, setDir] = useState<'fwd' | 'back'>('fwd');
  const [backToReview, setBackToReview] = useState(false);
  const [showRestored, setShowRestored] = useState(() => !!restored && !isDraftEmpty(restored.draft));
  const scrollRef = useRef<HTMLDivElement>(null);
  const saved = useRef(false);
  const index = stepIndex(step);

  // Le brouillon, gardé à chaque changement (et effacé s'il redevient vide).
  useEffect(() => {
    if (saved.current) return;
    if (isDraftEmpty(draft)) clearDraft(owner);
    else saveDraft(owner, draft, step);
  }, [draft, step, owner]);

  const goTo = (to: StepId, direction: 'fwd' | 'back') => {
    setDir(direction);
    setStep(to);
    setShowRestored(false);
    scrollRef.current?.scrollTo?.({ top: 0 });
  };

  const submit = () => {
    if (create.isPending) return;
    const bad = s.firstBlocked(allSteps, {});
    if (bad) {
      s.markTried(bad);
      setBackToReview(true);
      goTo(bad, 'back');
      const first = Object.keys(s.blocking(bad, {}))[0];
      if (first) focusField(first);
      return;
    }
    create.mutate(toCreateInput(draft), {
      onSuccess: (r) => {
        saved.current = true;
        clearDraft(owner);
        // « À vérifier » : la fiche s'ouvre en le disant (la direction est prévenue).
        const state: SavedState | undefined = r.to_verify ? { saved: 'to_verify' } : undefined;
        navigate(`/v/prospects/${r.id}`, { replace: true, state });
      },
      onError: (e: Error) => {
        const t = stepOfServerError(e.message, draft);
        s.setServer({ ...t, message: e.message });
        if (t.step !== 'review') {
          setBackToReview(true);
          goTo(t.step, 'back');
          if (t.field) focusField(t.field);
        }
      },
    });
  };

  const next = () => {
    if (step === 'review') return submit();
    const ids = Object.keys(s.blocking(step, {}));
    if (ids.length) {
      s.markTried(step);
      focusField(ids[0]);
      return;
    }
    if (backToReview) {
      setBackToReview(false);
      goTo('review', 'fwd');
      return;
    }
    goTo(STEPS[index + 1].id, 'fwd');
  };

  const back = () => {
    if (backToReview && step !== 'review') {
      setBackToReview(false);
      goTo('review', 'back');
      return;
    }
    if (index === 0) navigate('/v/prospects');
    else goTo(STEPS[index - 1].id, 'back');
  };

  const restart = () => {
    clearDraft(owner);
    s.setDraft(EMPTY_DRAFT);
    s.setTried(new Set());
    s.setTouched(new Set());
    s.setServer(null);
    setBackToReview(false);
    goTo('who', 'back');
  };

  const edit = (to: StepId) => {
    setBackToReview(true);
    goTo(to, 'back');
  };

  const primary = step === 'review' ? 'Enregistrer le prospect' : backToReview ? 'Revenir au récapitulatif' : 'Continuer';
  const errors = s.shownErrors(step, {});

  return (
    <WizardFrame
      eyebrow={
        <span className="inline-flex items-baseline gap-1 tabular-nums">
          Nouveau prospect · <Odometer value={index + 1} /> / {STEPS.length}
        </span>
      }
      progress={{ index, count: STEPS.length }}
      announce={announceOf(index, STEPS.length, step, draft)}
      onBack={index > 0 ? back : undefined}
      backLabel={backToReview && step !== 'review' ? 'Retour au récapitulatif' : 'Étape précédente'}
      onClose={() => navigate('/v/prospects')}
      primary={primary}
      busy={create.isPending}
      onPrimary={next}
      scrollRef={scrollRef}
      onKeyDown={enterAdvances(next)}
    >
      <div key={step} className={dir === 'fwd' ? 's-step-fwd' : 's-step-back'}>
        {showRestored && <ResumedNote title="Brouillon repris" action="Recommencer" onReset={restart} />}
        <StepHeading step={step} d={draft} />
        <Refusal message={s.unplaced(step)} />
        {step === 'review' ? (
          <>
            {s.clientNumber && <ClientNumberReview />}
            <Review d={draft} onEdit={edit} />
          </>
        ) : (
          <StepFields
            step={step}
            d={draft}
            set={s.set}
            update={s.update}
            errors={errors}
            onTouch={s.touch}
            autoFocus={!showRestored}
            phoneCheck={phoneCheck}
          />
        )}
      </div>
    </WizardFrame>
  );
}

/** Au récapitulatif, un des numéros est celui d'un client Bonzini : ce qui va se passer, avant d'enregistrer. */
function ClientNumberReview() {
  return (
    <div role="status" data-tone="warn" className="s-note s-pop mb-4 flex items-start gap-3 rounded-[14px] px-4 py-3">
      <Info className="mt-0.5 h-5 w-5 shrink-0 s-warn" aria-hidden />
      <div className="min-w-0">
        <div className="text-[15px] font-semibold s-ink">Un numéro est déjà celui d’un client Bonzini</div>
        <div className="mt-0.5 text-[14px] leading-snug s-ink-2">
          La fiche sera enregistrée «&nbsp;À&nbsp;vérifier&nbsp;» et la direction prévenue&nbsp;: elle vous attribuera ce client si c’est bien vous qui
          l’avez convaincu.
        </div>
      </div>
    </div>
  );
}

/** Le récapitulatif : chaque section, « Modifier » pour la rouvrir. */
function Review({ d, onEdit }: { d: ProspectDraft; onEdit: (step: StepId) => void }) {
  const main = toE164(d.phone);
  const numbers = [
    ...(main ? [{ e164: main, label: null, main: true }] : []),
    ...otherPhonesOf(d).map((p) => ({ e164: p.phone_e164, label: p.label, main: false })),
  ];
  return (
    <div className="space-y-4">
      <IdentitySection d={d} onEdit={onEdit} />
      <ContactSection numbers={numbers} email={d.email} onEdit={onEdit} delay={40} />
      <ActivitySection d={d} onEdit={onEdit} delay={80} />
      <NeedsSection d={d} onEdit={onEdit} delay={120} />
      <HelpSection d={d} onEdit={onEdit} delay={160} />
      <NextSection d={d} onEdit={onEdit} delay={200} />
    </div>
  );
}

/* ── Modification d'une section de la fiche ────────────────────────────── */

export function EditProspectWizard({ prospect, requested, onDone }: { prospect: Prospect; requested: StepId | typeof COMPLETE; onDone: () => void }) {
  const owner = useAdminAuth().currentUser?.id ?? null;
  const won = prospect.status === 'won';
  const completing = requested === COMPLETE;
  // La clé de ce qui est gardé : la fiche et la section (« besoins », « completer »).
  const slot = completing ? 'completer' : stepMeta(requested).slug;
  // Enregistré : ce qui était gardé s'efface, même si l'écran a déjà été quitté.
  const update = useUpdateProspect({ quietErrors: true, onUpdated: () => clearEditDraft(owner, prospect.id, slot) });
  const [original] = useState(() => draftOf(prospect));
  const [resumed] = useState(() => loadEditDraft(owner, prospect.id, slot, original));
  const s = useDraftState(() => resumed ?? original);
  const { draft } = s;
  const session = useMemo(() => editSession(requested, prospect), [requested, prospect]);
  const [pos, setPos] = useState(0);
  const [dir, setDir] = useState<'fwd' | 'back'>('fwd');
  const [showResumed, setShowResumed] = useState(!!resumed);
  const [leaving, setLeaving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const saved = useRef(false);
  const step = session[Math.min(pos, session.length - 1)];
  const last = pos >= session.length - 1;
  const missing = missingOf(prospect);
  const opts: ValidateOptions = { original, won };
  // Ses propres numéros ne sont pas un doublon : la fiche est exclue de la vérification.
  const phoneCheck = useMemo(() => ({ excludeId: prospect.id, onResult: s.onCheck }), [prospect.id, s.onCheck]);
  const patch = toPatch(draft, original, prospect.id, { won });
  const dirty = patch !== null;

  // Ce qui est tapé est gardé (un retour du téléphone quitte l'écran sans rien demander).
  useEffect(() => {
    if (saved.current) return;
    if (dirty) saveEditDraft(owner, prospect.id, slot, original, draft);
    else clearEditDraft(owner, prospect.id, slot);
  }, [draft, dirty, owner, prospect.id, slot, original]);

  const goTo = (p: number, direction: 'fwd' | 'back') => {
    setDir(direction);
    setPos(p);
    setShowResumed(false);
    scrollRef.current?.scrollTo?.({ top: 0 });
  };

  const discard = () => {
    saved.current = true;
    clearEditDraft(owner, prospect.id, slot);
    onDone();
  };

  const close = () => (dirty ? setLeaving(true) : onDone());

  const resetChanges = () => {
    clearEditDraft(owner, prospect.id, slot);
    s.setDraft(original);
    s.setTried(new Set());
    s.setTouched(new Set());
    s.setServer(null);
    setShowResumed(false);
  };

  const save = () => {
    if (update.isPending || !patch) return;
    // Toutes les étapes de la séance, en règle.
    const bad = s.firstBlocked(session, opts);
    if (bad) {
      s.markTried(bad);
      goTo(session.indexOf(bad), 'back');
      focusField(Object.keys(s.blocking(bad, opts))[0]);
      return;
    }
    update.mutate(patch, {
      onSuccess: () => {
        saved.current = true;
        clearEditDraft(owner, prospect.id, slot);
        onDone();
      },
      onError: (e: Error) => {
        const t = stepOfServerError(e.message, draft);
        const at = session.indexOf(t.step);
        s.setServer({ step: at >= 0 ? t.step : step, field: at >= 0 ? t.field : undefined, message: e.message });
        if (at >= 0) {
          goTo(at, 'back');
          if (t.field) focusField(t.field);
        }
      },
    });
  };

  const next = () => {
    const ids = Object.keys(s.blocking(step, opts));
    if (ids.length) {
      s.markTried(step);
      focusField(ids[0]);
      return;
    }
    if (last) save();
    else goTo(pos + 1, 'fwd');
  };

  const errors = s.shownErrors(step, opts);

  return (
    <WizardFrame
      eyebrow={completing ? 'Compléter la fiche' : `Modifier · ${stepMeta(step).label}`}
      progress={{ index: pos, count: session.length }}
      announce={announceOf(pos, session.length, step, draft)}
      onBack={pos > 0 ? () => goTo(pos - 1, 'back') : undefined}
      onClose={close}
      // Rien de changé : « Enregistrer » attend (la croix ferme).
      primary={last ? 'Enregistrer' : 'Continuer'}
      primaryDisabled={last && !dirty}
      busy={update.isPending}
      onPrimary={next}
      scrollRef={scrollRef}
      onKeyDown={enterAdvances(next)}
      overlay={
        <BottomSheet open={leaving} onClose={() => setLeaving(false)} title="Abandonner vos modifications ?" className="s-sheet">
          <p className="text-[15px] leading-snug s-ink-2">Ce que vous avez changé ici n’est pas enregistré.</p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setLeaving(false)} className={btn('quiet', 'lg')}>
              Continuer la saisie
            </button>
            <button type="button" onClick={discard} className={btn('red', 'lg')}>
              Abandonner
            </button>
          </div>
        </BottomSheet>
      }
    >
      <div key={step} className={dir === 'fwd' ? 's-step-fwd' : 's-step-back'}>
        {showResumed && <ResumedNote title="Modification reprise" action="Annuler mes changements" onReset={resetChanges} />}
        {completing && missing.length > 0 && (
          <div data-tone="warn" className="s-note mb-6 rounded-[14px] px-4 py-3">
            <div className="text-[15px] font-semibold s-ink">Fiche incomplète</div>
            <div className="mt-0.5 text-[14px] s-ink-2">Il manque {joinFr(missing.map((m) => m.label))}.</div>
          </div>
        )}
        <Refusal message={s.unplaced(step)} />
        <StepHeading step={step} d={draft} />
        <StepFields
          step={step}
          d={draft}
          set={s.set}
          update={s.update}
          errors={errors}
          onTouch={s.touch}
          autoFocus={!showResumed}
          original={original}
          won={won}
          phoneCheck={phoneCheck}
        />
      </div>
    </WizardFrame>
  );
}

/**
 * ADMIN DESKTOP REDESIGN V2 — module Dépôts.
 *
 * Même archétype que la V1 (workbench → détail scindé → création une page),
 * mais composé exclusivement du vocabulaire réel de l'app : DesktopAppShell,
 * kit Ofspace/Mola (cartes 22px, pilules, StatusPill, TextInput, holders),
 * MIcon, typographie des écrans desktop existants. Rien d'inventé.
 */
import { cn } from '@/lib/utils';
import {
  Plus,
  Paperclip,
  Copy,
  X,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Download,
  Upload,
  Bell,
  CheckCircle,
  Wallet,
  ChevronDown,
  Info,
} from 'lucide-react';
import {
  SURFACE,
  TEXT,
  PRIMARY_PILL,
  SOFT_PILL,
  StatusPill,
  Card,
  Amount,
  Avatar,
  Holder,
  TextInput,
  FormField,
  PrimaryPill,
  SoftPill,
} from '@/mobile/designKit';
import {
  Shell,
  MIcon,
  Age,
  Chip,
  DropChip,
  SearchField,
  Th,
  Td,
  PaginationBar,
  RefChip,
  Dialog,
  FakeProofSms,
} from './kit';

/* ── Boutons d'action du détail — mêmes recettes que la fiche réelle ────── */

const EMERALD_PILL = 'rounded-full bg-[#10B981] text-white font-bold';
const DANGER_SOFT_PILL = 'rounded-full bg-[#FBE7E7] font-semibold text-[#C0504D] dark:bg-[#3A2526] dark:text-[#E79A9A]';

/* ── Fixtures ───────────────────────────────────────────────────────────── */

type Tone = 'success' | 'pending' | 'danger' | 'info' | 'neutral';

type Row = {
  ref: string;
  client: string;
  phone: string;
  amount: string;
  family: string;
  methodLabel: string;
  proofs: number;
  rel: string;
  abs: string;
  sla: 'fresh' | 'aging' | 'overdue' | null;
  status: string;
  tone: Tone;
  hover?: boolean;
  selected?: boolean;
};

const QUEUE: Row[] = [
  { ref: 'BZ-DP-2026-0838', client: 'Clarisse Ngo Bell', phone: '+237 699 21 40 88', amount: '2 400 000', family: 'BANK', methodLabel: 'Virement', proofs: 2, rel: '11 h', abs: 'hier 22:41', sla: 'overdue', status: 'Preuve envoyée', tone: 'info' },
  { ref: 'BZ-DP-2026-0841', client: 'Moussa Bah', phone: '+237 677 02 33 19', amount: '780 000', family: 'MTN_MONEY', methodLabel: 'MTN Float', proofs: 1, rel: '9 h', abs: '05:02', sla: 'overdue', status: 'Preuve envoyée', tone: 'info' },
  { ref: 'BZ-DP-2026-0844', client: 'Jean-Paul Mbarga', phone: '+237 655 71 90 02', amount: '5 100 000', family: 'BANK', methodLabel: 'Cash banque', proofs: 1, rel: '6 h', abs: '08:17', sla: 'aging', status: 'En vérification', tone: 'pending' },
  { ref: 'BZ-DP-2026-0846', client: 'Aïcha Diallo', phone: '+237 690 44 12 07', amount: '1 250 000', family: 'ORANGE_MONEY', methodLabel: 'Orange code', proofs: 1, rel: '4 h', abs: '10:09', sla: 'aging', status: 'Preuve envoyée', tone: 'info', hover: true },
  { ref: 'BZ-DP-2026-0847', client: 'Fatou Ndiaye', phone: '+237 696 88 45 31', amount: '850 000', family: 'ORANGE_MONEY', methodLabel: 'Orange code', proofs: 2, rel: '3 h', abs: '11:26', sla: 'aging', status: 'En vérification', tone: 'pending', selected: true },
  { ref: 'BZ-DP-2026-0849', client: 'Ibrahim Touré', phone: '+237 671 55 08 64', amount: '3 400 000', family: 'WAVE', methodLabel: 'Wave', proofs: 1, rel: '1 h', abs: '13:12', sla: 'fresh', status: 'Preuve envoyée', tone: 'info' },
  { ref: 'BZ-DP-2026-0851', client: 'Mariam Koné', phone: '+237 698 30 77 25', amount: '1 050 000', family: 'AGENCY_BONZINI', methodLabel: 'Cash agence', proofs: 1, rel: '25 min', abs: '14:07', sla: 'fresh', status: 'Preuve envoyée', tone: 'info' },
];

const ALL: Row[] = [
  { ref: 'BZ-DP-2026-0851', client: 'Mariam Koné', phone: '+237 698 30 77 25', amount: '1 050 000', family: 'AGENCY_BONZINI', methodLabel: 'Cash agence', proofs: 1, rel: '25 min', abs: '14:07', sla: 'fresh', status: 'Preuve envoyée', tone: 'info' },
  { ref: 'BZ-DP-2026-0850', client: 'Awa Camara', phone: '+237 675 19 22 90', amount: '4 200 000', family: 'BANK', methodLabel: 'Virement', proofs: 3, rel: '45 min', abs: '13:47', sla: null, status: 'Validé', tone: 'success' },
  { ref: 'BZ-DP-2026-0849', client: 'Ibrahim Touré', phone: '+237 671 55 08 64', amount: '3 400 000', family: 'WAVE', methodLabel: 'Wave', proofs: 1, rel: '1 h', abs: '13:12', sla: 'fresh', status: 'Preuve envoyée', tone: 'info' },
  { ref: 'BZ-DP-2026-0848', client: 'Nadia Sow', phone: '+237 693 12 60 44', amount: '250 000', family: 'MTN_MONEY', methodLabel: 'MTN code', proofs: 1, rel: '2 h', abs: '12:31', sla: null, status: 'Validé', tone: 'success' },
  { ref: 'BZ-DP-2026-0847', client: 'Fatou Ndiaye', phone: '+237 696 88 45 31', amount: '850 000', family: 'ORANGE_MONEY', methodLabel: 'Orange code', proofs: 2, rel: '3 h', abs: '11:26', sla: 'aging', status: 'En vérification', tone: 'pending', hover: true },
  { ref: 'BZ-DP-2026-0846', client: 'Aïcha Diallo', phone: '+237 690 44 12 07', amount: '1 250 000', family: 'ORANGE_MONEY', methodLabel: 'Orange code', proofs: 1, rel: '4 h', abs: '10:09', sla: 'aging', status: 'Preuve envoyée', tone: 'info' },
  { ref: 'BZ-DP-2026-0845', client: 'Seydou Traoré', phone: '+237 691 63 55 08', amount: '620 000', family: 'ORANGE_MONEY', methodLabel: 'Orange code', proofs: 1, rel: '5 h', abs: '09:33', sla: null, status: 'Rejeté', tone: 'danger' },
  { ref: 'BZ-DP-2026-0844', client: 'Jean-Paul Mbarga', phone: '+237 655 71 90 02', amount: '5 100 000', family: 'BANK', methodLabel: 'Cash banque', proofs: 1, rel: '6 h', abs: '08:17', sla: 'aging', status: 'En vérification', tone: 'pending' },
  { ref: 'BZ-DP-2026-0843', client: 'Éric Etoundi', phone: '+237 699 05 18 73', amount: '2 000 000', family: 'BANK', methodLabel: 'Virement', proofs: 2, rel: '7 h', abs: '07:22', sla: null, status: 'Validé', tone: 'success' },
  { ref: 'BZ-DP-2026-0842', client: 'Aminata Diop', phone: '+237 672 90 41 55', amount: '450 000', family: 'WAVE', methodLabel: 'Wave', proofs: 0, rel: '8 h', abs: '06:14', sla: null, status: 'En attente de preuve', tone: 'neutral' },
  { ref: 'BZ-DP-2026-0841', client: 'Moussa Bah', phone: '+237 677 02 33 19', amount: '780 000', family: 'MTN_MONEY', methodLabel: 'MTN Float', proofs: 1, rel: '9 h', abs: '05:02', sla: 'overdue', status: 'Preuve envoyée', tone: 'info' },
  { ref: 'BZ-DP-2026-0839', client: 'Oumar Kanté', phone: '+237 676 51 09 82', amount: '9 500 000', family: 'BANK', methodLabel: 'Virement', proofs: 2, rel: '12 h', abs: 'hier 21:40', sla: null, status: 'Validé', tone: 'success' },
  { ref: 'BZ-DP-2026-0838', client: 'Clarisse Ngo Bell', phone: '+237 699 21 40 88', amount: '2 400 000', family: 'BANK', methodLabel: 'Virement', proofs: 2, rel: '11 h', abs: 'hier 22:41', sla: 'overdue', status: 'Preuve envoyée', tone: 'info' },
];

/* ── Table ──────────────────────────────────────────────────────────────── */

function DepositsTable({ compact, view = 'queue' }: { compact?: boolean; view?: 'queue' | 'all' }) {
  const rows = view === 'all' ? ALL : QUEUE;
  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-left">
          <thead className={cn('sticky top-0 z-10', SURFACE.card)}>
            <tr>
              {!compact && <Th first sortable>Référence</Th>}
              <Th first={compact} sortable>Client</Th>
              <Th align="right" sortable>Montant XAF</Th>
              {!compact && <Th>Méthode</Th>}
              <Th sortable sorted={view === 'all' ? 'desc' : 'asc'}>Reçu</Th>
              <Th last={compact}>Statut</Th>
              {!compact && <Th last className="w-[176px]" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.ref}
                className={cn(
                  'cursor-pointer transition',
                  r.selected && compact
                    ? 'bg-[#EDEAFA]/70 dark:bg-white/[0.06]'
                    : r.hover && !compact
                      ? 'bg-[#EDEAFA]/40 dark:bg-white/[0.04]'
                      : 'hover:bg-[#EDEAFA]/40 dark:hover:bg-white/[0.04]',
                )}
              >
                {!compact && (
                  <Td first>
                    <span className="inline-flex items-center gap-1.5">
                      <RefChip>{r.ref}</RefChip>
                      {r.proofs > 0 && (
                        <span className={cn('inline-flex items-center gap-0.5 text-[10px] font-semibold', TEXT.muted)}>
                          <Paperclip className="h-3 w-3" />
                          {r.proofs}
                        </span>
                      )}
                    </span>
                  </Td>
                )}
                <Td first={compact}>
                  <div className="leading-[16px]">
                    <div className={cn('flex items-center gap-1.5 text-[13px] font-semibold', TEXT.strong)}>
                      {r.client}
                      {compact && r.proofs > 0 && (
                        <span className={cn('inline-flex items-center gap-0.5 text-[10px] font-semibold', TEXT.muted)}>
                          <Paperclip className="h-3 w-3" />
                          {r.proofs}
                        </span>
                      )}
                    </div>
                    {!compact && <div className={cn('text-[11px] tabular-nums', TEXT.muted)}>{r.phone}</div>}
                  </div>
                </Td>
                <Td align="right">
                  <Amount value={r.amount} size="md" className="!text-[15px]" />
                </Td>
                {!compact && (
                  <Td>
                    <div className="flex items-center gap-2">
                      <MIcon family={r.family} size={28} />
                      <span className={cn('text-[12px]', TEXT.muted)}>{r.methodLabel}</span>
                    </div>
                  </Td>
                )}
                <Td>
                  <Age rel={r.rel} abs={r.abs} level={r.sla} relOnly={compact} />
                </Td>
                <Td last={compact}>
                  <StatusPill tone={r.tone} label={r.status} />
                </Td>
                {!compact && (
                  <Td last align="right">
                    {r.hover && r.sla != null ? (
                      <span className="inline-flex items-center gap-1.5">
                        <button type="button" className={cn('px-3 py-1.5 text-[12px]', EMERALD_PILL)}>Valider</button>
                        <button type="button" className={cn('px-3 py-1.5 text-[12px]', DANGER_SOFT_PILL)}>Rejeter</button>
                        <Holder icon={MoreHorizontal} size="sm" onClick={() => {}} ariaLabel="Plus" />
                      </span>
                    ) : (
                      <span className="inline-flex h-8 items-center opacity-0" aria-hidden>·</span>
                    )}
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationBar
        range={view === 'all' ? '1–20' : '1–7'}
        total={view === 'all' ? '3 214' : '7'}
        page={1}
        pages={view === 'all' ? 161 : 1}
      />
    </Card>
  );
}

/* ── En-tête + barre de filtres (une seule rangée) ──────────────────────── */

function WorkbenchTop({ compact, view = 'queue' }: { compact?: boolean; view?: 'queue' | 'all' }) {
  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className={cn('text-[26px] font-extrabold tracking-tight', TEXT.strong)}>Dépôts</h2>
          <p className={cn('mt-1 text-[14px]', TEXT.muted)}>
            3 214 dépôts · <span className="font-bold text-[#B47A17] dark:text-[#E7C083]">7 à traiter</span> · plus ancien : 11 h
          </p>
        </div>
        <button type="button" className={cn('inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-bold', PRIMARY_PILL)}>
          <Plus className="h-4 w-4" /> Nouveau dépôt
        </button>
      </header>

      <section className="mt-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Chip label="À traiter" count={7} active={view === 'queue'} />
          <Chip label="À corriger" count={2} />
          <Chip label="Tous" count="3 214" active={view === 'all'} />
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <SearchField placeholder={compact ? 'Rechercher…' : 'Nom, téléphone ou référence…'} className={compact ? 'w-[210px]' : 'w-[300px]'} />
          <DropChip label="Méthode" value="Toutes" />
          <DropChip label="Période" value="30 jours" />
        </div>
      </section>
    </>
  );
}

/* ── Écran A — Workbench (pleine largeur, vue « Tous ») ─────────────────── */

export function DdWorkbench() {
  return (
    <Shell>
      <div className="flex h-[calc(100vh-120px)] min-h-[560px] flex-col">
        <WorkbenchTop view="all" />
        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          <DepositsTable view="all" />
        </div>
      </div>
    </Shell>
  );
}

/* ── Panneau détail ─────────────────────────────────────────────────────── */

function TimelineStep({ label, meta, state, last }: { label: string; meta?: string; state: 'done' | 'current' | 'todo'; last?: boolean }) {
  return (
    <div className="flex gap-2.5">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
            state === 'done'
              ? 'border-[#34d399] bg-[#DEEFE5] text-[#2E7D52] dark:bg-[#1E3A2C] dark:text-[#7FCBA0]'
              : state === 'current'
                ? 'border-[#7C3AED] text-[#7C3AED]'
                : cn('border-black/[0.12] dark:border-white/[0.15]', TEXT.muted),
          )}
        >
          {state === 'done' && <CheckCircle className="h-3 w-3" />}
          {state === 'current' && <span className="h-2 w-2 rounded-full bg-current" />}
        </div>
        {!last && <div className="my-0.5 w-0.5" style={{ height: 8, background: state === 'done' ? '#34d399' : 'rgba(0,0,0,0.08)' }} />}
      </div>
      <div className="flex min-w-0 flex-1 items-baseline justify-between gap-2 pb-0.5">
        <p className={cn('text-[12px] font-semibold', state === 'todo' ? TEXT.muted : TEXT.strong)}>{label}</p>
        {meta && <p className={cn('shrink-0 text-[11px] tabular-nums', TEXT.muted)}>{meta}</p>}
      </div>
    </div>
  );
}

function InfoKV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className={cn('text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>{k}</div>
      <div className={cn('mt-0.5 truncate text-[13px] font-semibold tabular-nums', TEXT.strong)}>{v}</div>
    </div>
  );
}

export function DepositPanel() {
  return (
    <aside
      className={cn(
        'flex w-[560px] shrink-0 flex-col overflow-hidden rounded-[24px]',
        SURFACE.card,
        'shadow-[0_8px_30px_-12px_rgba(46,32,92,0.22)] ring-1 ring-black/[0.05] dark:shadow-none dark:ring-white/[0.06]',
      )}
    >
      {/* En-tête épinglé : identité + LE verdict */}
      <div className="flex items-center gap-2 border-b border-black/[0.06] px-4 py-2.5 dark:border-white/[0.06]">
        <RefChip>BZ-DP-2026-0847</RefChip>
        <StatusPill tone="pending" label="En vérification" />
        <span className="text-[11px] font-bold tabular-nums text-[#B47A17] dark:text-[#E7C083]">3 h</span>
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" className={cn('px-3.5 py-2 text-[12px]', EMERALD_PILL)}>Valider</button>
          <button type="button" className={cn('px-3.5 py-2 text-[12px]', DANGER_SOFT_PILL)}>Rejeter</button>
          <Holder icon={MoreHorizontal} size="sm" onClick={() => {}} ariaLabel="Plus" />
          <Holder icon={X} size="sm" onClick={() => {}} ariaLabel="Fermer" />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3.5">
        {/* Zone de verdict : la preuve à côté des montants qu'elle doit prouver */}
        <div className="grid grid-cols-[244px_1fr] items-start gap-3">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className={cn('text-[13px] font-bold', TEXT.strong)}>Preuves (2)</span>
              <span className={cn('inline-flex items-center gap-1 text-[11px] font-semibold', TEXT.muted)}>
                Client · 11:26 <ChevronLeft className="ml-1 h-3 w-3" /> 1/2 <ChevronRight className="h-3 w-3" />
              </span>
            </div>
            <FakeProofSms amount="850 000" reference="BZ-DP-2026-0847" />
            <div className="mt-2 flex gap-1.5">
              <button type="button" className={cn('flex h-8 flex-1 items-center justify-center gap-1 rounded-lg text-[10px] font-semibold', SOFT_PILL)}>
                <Maximize2 className="h-3 w-3" /> Agrandir
              </button>
              <button type="button" className={cn('flex h-8 flex-1 items-center justify-center gap-1 rounded-lg text-[10px] font-semibold', SOFT_PILL)}>
                <Download className="h-3 w-3" /> Télécharger
              </button>
            </div>
          </div>

          <div className={cn('rounded-2xl p-3', SURFACE.canvas)}>
            <span className={cn('text-[13px] font-bold', TEXT.strong)}>Vérification du montant</span>
            <div className="mt-2 flex items-center justify-between text-[13px]">
              <span className={TEXT.muted}>Montant déclaré</span>
              <span className={cn('font-semibold tabular-nums', TEXT.strong)}>850 000 XAF</span>
            </div>
            <FormField label="Montant confirmé (XAF)" className="mt-1.5">
              <TextInput readOnly value="850 000" className="h-10 font-bold" />
            </FormField>
            <div className="mt-2.5 border-t border-black/[0.06] pt-2 dark:border-white/[0.08]">
              <div className="flex items-center justify-between text-[12px]">
                <span className={cn('inline-flex items-center gap-1', TEXT.muted)}><Wallet className="h-3 w-3" /> Solde wallet</span>
                <span className={cn('font-semibold tabular-nums', TEXT.strong)}>1 213 450</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[12px]">
                <span className={TEXT.muted}>Après validation</span>
                <span className="font-bold tabular-nums text-[#2E7D52] dark:text-[#7FCBA0]">2 063 450</span>
              </div>
            </div>
          </div>
        </div>

        {/* Faits */}
        <div className="mt-3 grid grid-cols-3 gap-x-4 gap-y-2 border-t border-black/[0.06] pt-3 dark:border-white/[0.06]">
          <InfoKV k="Client" v={<span className="text-[#6B5BD2] dark:text-[#A99BF0]">Fatou Ndiaye</span>} />
          <InfoKV k="Téléphone" v="+237 696 88 45 31" />
          <InfoKV k="Société" v="FN Import Sarl" />
          <InfoKV k="Méthode" v={<span className="inline-flex items-center gap-1.5"><MIcon family="ORANGE_MONEY" size={18} /> Orange code</span>} />
          <InfoKV k="Créé le" v="19 août, 11:26" />
          <InfoKV k="Créé par" v="Client (app)" />
        </div>

        {/* Note interne — une ligne */}
        <div className={cn('mt-3 flex items-baseline gap-2.5 rounded-2xl px-3 py-2', SURFACE.canvas)}>
          <span className={cn('shrink-0 text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>Note interne</span>
          <p className={cn('truncate text-[12.5px]', TEXT.strong)}>
            2ᵉ dépôt du mois — la 1ʳᵉ preuve était floue, remplacée à 12:04.
          </p>
        </div>

        {/* Suivi — ouvert, plus caché derrière un clic */}
        <div className="mt-3 border-t border-black/[0.06] pt-2.5 dark:border-white/[0.06]">
          <span className={cn('mb-1.5 block text-[13px] font-bold', TEXT.strong)}>Suivi</span>
          <TimelineStep state="done" label="Demande créée" meta="19 août, 11:26" />
          <TimelineStep state="done" label="Preuve envoyée par le client" meta="11:31" />
          <TimelineStep state="current" label="Vérification en cours — Nelson E." meta="12:04" />
          <TimelineStep state="todo" label="Validation & crédit du wallet" last />
        </div>
      </div>
    </aside>
  );
}

/* ── Écran B — Scindé (file « À traiter ») ──────────────────────────────── */

export function DdSplit() {
  return (
    <Shell>
      <div className="flex h-[calc(100vh-120px)] min-h-[560px] flex-col">
        <WorkbenchTop compact view="queue" />
        <div className="mt-4 flex min-h-0 flex-1 gap-5">
          <DepositsTable compact view="queue" />
          <DepositPanel />
        </div>
      </div>
    </Shell>
  );
}

/* ── Écran B′ — Dialogue de validation centré ───────────────────────────── */

export function DdValidate() {
  return (
    <Shell>
      <div className="flex h-[calc(100vh-120px)] min-h-[560px] flex-col">
        <WorkbenchTop compact view="queue" />
        <div className="mt-4 flex min-h-0 flex-1 gap-5">
          <DepositsTable compact view="queue" />
          <DepositPanel />
        </div>
      </div>
      <Dialog
        title="Valider ce dépôt"
        footer={
          <>
            <SoftPill className="flex-1">Annuler</SoftPill>
            <PrimaryPill className="flex-[1.4] bg-[#10B981] text-white dark:bg-[#10B981] dark:text-white">
              Créditer 850 000 XAF
            </PrimaryPill>
          </>
        }
      >
        <div className="space-y-4">
          <div className={cn('space-y-2 rounded-2xl p-3', SURFACE.canvas)}>
            <div className="flex items-center justify-between text-[13px]">
              <span className={TEXT.muted}>Montant déclaré</span>
              <span className={cn('font-semibold tabular-nums', TEXT.strong)}>850 000 XAF</span>
            </div>
            <FormField label="Montant confirmé (XAF)">
              <TextInput readOnly value="850 000" className="font-bold" />
            </FormField>
          </div>
          <div className="rounded-2xl bg-[#DEEFE5] p-4 dark:bg-[#1E3A2C]">
            <p className="text-[13px] text-[#2E7D52] dark:text-[#7FCBA0]">
              Le wallet sera crédité de <strong>850 000 XAF</strong>
            </p>
            <p className="mt-1 text-[12px] text-[#2E7D52] dark:text-[#7FCBA0]">
              Nouveau solde estimé : 2 063 450 XAF
            </p>
          </div>
          <FormField label="Note interne (optionnel)">
            <div className={cn('h-[52px] w-full rounded-2xl p-3 text-[13px]', SURFACE.card, SURFACE.shadow, TEXT.muted)}>
              Commentaire visible uniquement par les admins…
            </div>
          </FormField>
          <div className={cn('flex w-full items-center justify-between rounded-2xl p-3', SURFACE.canvas)}>
            <span className={cn('inline-flex items-center gap-2 text-[13px]', TEXT.strong)}>
              <Bell className="h-4 w-4 text-[#5B4CC4] dark:text-[#B5AAF0]" /> Notifier le client
            </span>
            <span className="relative h-6 w-10 rounded-full bg-[#10B981]">
              <span className="absolute left-[18px] top-0.5 h-5 w-5 rounded-full bg-white" />
            </span>
          </div>
          <p className={cn('text-center text-[11px]', TEXT.muted)}>⌘⏎ pour confirmer · Esc pour annuler</p>
        </div>
      </Dialog>
    </Shell>
  );
}

/* ── Écran C — Création une page (zéro wizard) ──────────────────────────── */

const FAMILY_CHIPS = [
  { key: 'BANK', label: 'Banque' },
  { key: 'ORANGE_MONEY', label: 'Orange' },
  { key: 'MTN_MONEY', label: 'MTN' },
  { key: 'WAVE', label: 'Wave' },
  { key: 'AGENCY_BONZINI', label: 'Agence' },
];

function SelectBox({ children }: { children: React.ReactNode }) {
  return (
    <div className={cn('flex h-12 w-full items-center justify-between rounded-2xl px-4 text-[14px]', SURFACE.card, SURFACE.shadow, TEXT.strong)}>
      {children}
    </div>
  );
}

export function DdCreate() {
  return (
    <Shell>
      <div className="mx-auto max-w-[1120px]">
        <header className="flex items-center gap-2">
          <span className={cn('text-[13px] font-semibold', TEXT.muted)}>Dépôts</span>
          <ChevronRight className={cn('h-3.5 w-3.5', TEXT.muted)} />
          <h2 className={cn('text-[26px] font-extrabold tracking-tight', TEXT.strong)}>Nouveau dépôt</h2>
        </header>

        <div className="mt-5 grid grid-cols-[1fr_360px] items-start gap-5">
          {/* Colonne principale — toutes les décisions visibles */}
          <div className="space-y-4">
            <Card>
              <span className={cn('text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>1 · Client & montant</span>
              <div className="mt-3 grid grid-cols-2 gap-4">
                <FormField label="Client">
                  <SelectBox>
                    <span className="inline-flex min-w-0 items-center gap-2.5">
                      <Avatar name="Fatou Ndiaye" size="sm" />
                      <span className="truncate font-bold">Fatou Ndiaye</span>
                      <span className={cn('truncate text-[12px] font-normal tabular-nums', TEXT.muted)}>+237 696 88 45 31</span>
                    </span>
                    <ChevronDown className={cn('h-4 w-4 shrink-0', TEXT.muted)} />
                  </SelectBox>
                </FormField>
                <FormField label="Montant (XAF)" hint="Min 1 000 · Max 50 000 000">
                  <TextInput readOnly value="850 000" className="font-extrabold" />
                </FormField>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {['100K', '250K', '500K', '1M', '2M'].map((p) => (
                  <button key={p} type="button" className={cn('rounded-full px-3 py-1.5 text-[12px] font-semibold', SOFT_PILL)}>{p}</button>
                ))}
                <span className={cn('ml-2 inline-flex items-center gap-1.5 text-[12px]', TEXT.muted)}>
                  <Wallet className="h-3.5 w-3.5" /> Solde actuel : <b className={cn('tabular-nums', TEXT.strong)}>1 213 450 XAF</b>
                </span>
              </div>
            </Card>

            <Card>
              <span className={cn('text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>2 · Méthode de dépôt</span>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {FAMILY_CHIPS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[12px] font-semibold',
                      f.key === 'ORANGE_MONEY' ? PRIMARY_PILL : SOFT_PILL,
                    )}
                  >
                    <MIcon family={f.key} size={18} />
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="mt-3.5 grid grid-cols-2 gap-4">
                <FormField label="Type d'opération">
                  <SelectBox>
                    <span className="font-semibold">Retrait par code marchand</span>
                    <ChevronDown className={cn('h-4 w-4', TEXT.muted)} />
                  </SelectBox>
                </FormField>
                <FormField label="Téléphone du client (émetteur)">
                  <TextInput readOnly value="+237 696 88 45 31" />
                </FormField>
              </div>
            </Card>

            <Card>
              <span className={cn('text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>3 · Preuves & note (optionnel)</span>
              <div className="mt-3 grid grid-cols-2 gap-4">
                <div className="flex h-[110px] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-black/10 dark:border-white/10">
                  <Upload className={cn('h-5 w-5', TEXT.muted)} />
                  <p className={cn('text-[12px] font-bold', TEXT.muted)}>Collez (Ctrl+V), glissez ou cliquez</p>
                  <p className={cn('text-[11px]', TEXT.muted)}>Images ou PDF · 10 Mo max</p>
                </div>
                <div className={cn('h-[110px] rounded-2xl p-3 text-[13px]', SURFACE.canvas, TEXT.muted)}>
                  Note interne — visible uniquement par les admins…
                </div>
              </div>
            </Card>
          </div>

          {/* Rail : coordonnées à dicter + récap + CTA */}
          <div className="space-y-4">
            <Card>
              <div className="flex items-center justify-between">
                <span className={cn('text-[13px] font-bold', TEXT.strong)}>Coordonnées à communiquer</span>
                <MIcon family="ORANGE_MONEY" size={20} />
              </div>
              <div className="mt-3 space-y-2">
                <div className={cn('rounded-2xl p-3', SURFACE.canvas)}>
                  <div className={cn('text-[11px]', TEXT.muted)}>Code marchand</div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className={cn('font-mono text-[13px] font-bold', TEXT.strong)}>#150*47*712 447*850000#</span>
                    <Copy className={cn('h-3.5 w-3.5 shrink-0', TEXT.muted)} />
                  </div>
                </div>
                <div className={cn('flex items-center justify-between rounded-2xl p-3', SURFACE.canvas)}>
                  <span className={cn('text-[11px]', TEXT.muted)}>Titulaire</span>
                  <span className={cn('inline-flex items-center gap-1.5 text-[13px] font-bold', TEXT.strong)}>
                    BONZINI LABS SARL <Copy className={cn('h-3.5 w-3.5', TEXT.muted)} />
                  </span>
                </div>
              </div>
              <ol className="mt-3 space-y-2">
                {['Le client compose le code marchand', 'Il valide avec son PIN Orange Money', "Capture d'écran du SMS → preuve"].map((s, i) => (
                  <li key={s} className="flex gap-2.5">
                    <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold', SURFACE.holder)}>{i + 1}</span>
                    <span className={cn('text-[12.5px]', TEXT.muted)}>{s}</span>
                  </li>
                ))}
              </ol>
            </Card>

            <Card>
              <span className={cn('text-[13px] font-bold', TEXT.strong)}>Récapitulatif</span>
              <div className="mt-2.5 space-y-2 text-[13px]">
                <div className="flex justify-between"><span className={TEXT.muted}>Client</span><span className={cn('font-semibold', TEXT.strong)}>Fatou Ndiaye</span></div>
                <div className="flex justify-between"><span className={TEXT.muted}>Montant</span><span className={cn('font-bold tabular-nums', TEXT.strong)}>850 000 XAF</span></div>
                <div className="flex justify-between"><span className={TEXT.muted}>Méthode</span><span className={cn('font-semibold', TEXT.strong)}>Orange · code marchand</span></div>
                <div className="flex items-center justify-between"><span className={TEXT.muted}>Statut initial</span><StatusPill tone="neutral" label="Demande créée" /></div>
              </div>
              <div className="mt-3 flex items-start gap-2 rounded-2xl bg-[#EAE7FA] p-3 dark:bg-[#272252]">
                <Info className="mt-px h-3.5 w-3.5 shrink-0 text-[#5B4CC4] dark:text-[#B5AAF0]" />
                <p className="text-[12px] leading-[16px] text-[#5B4CC4] dark:text-[#B5AAF0]">
                  Le wallet n'est crédité qu'à la validation de la preuve.
                </p>
              </div>
              <PrimaryPill className="mt-4 w-full">Créer le dépôt</PrimaryPill>
              <SoftPill className="mt-2 w-full">Annuler</SoftPill>
            </Card>
          </div>
        </div>
      </div>
    </Shell>
  );
}

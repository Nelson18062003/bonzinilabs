/**
 * ADMIN DESKTOP REDESIGN — module Dépôts (mockups).
 *
 * Instantiates the module archetype (02-foundation.md §2/§3):
 *   A. Workbench   — queue tabs + one-row filter bar + sortable dense table + pagination
 *   B. Split       — detail panel (~560px) with pinned actions, verdict zone, facts, timeline
 *   C. Create      — one-page form (no wizard): decisions left, coordinates/recap rail right
 *
 * Static fixtures, real domain vocabulary (statuses, methods, BZ-DP-YYYY-NNNN,
 * SLA 2h/8h). Default view mocked = « À traiter », oldest first.
 */
import { cn } from '@/lib/utils';
import {
  Plus,
  Paperclip,
  Copy,
  X,
  MoreHorizontal,
  Check,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Download,
  FileText,
  Upload,
  Bell,
  CircleCheck,
  CircleDashed,
  Wallet,
  ChevronDown,
  Info,
} from 'lucide-react';
import {
  D,
  Shell,
  Btn,
  IconBtn,
  StatusPill,
  QueueTabs,
  SearchField,
  Select,
  Th,
  Td,
  Age,
  MethodMark,
  PaginationBar,
  KV,
  SectionLabel,
  Dialog,
  FakeProofSms,
  type Tone,
} from './kit';

/* ── Fixtures ───────────────────────────────────────────────────────────── */

const METHOD: Record<string, { mark: string; bg: string; dark?: boolean; label: string }> = {
  om: { mark: 'O', bg: '#FF6600', label: 'Orange code' },
  mtn: { mark: 'M', bg: '#FFCB05', dark: true, label: 'MTN Float' },
  bank: { mark: 'B', bg: '#1E3A5F', label: 'Virement' },
  bankCash: { mark: 'B', bg: '#1E3A5F', label: 'Cash banque' },
  agency: { mark: 'A', bg: '#A947FE', label: 'Cash agence' },
  wave: { mark: 'W', bg: '#1DC3E3', label: 'Wave' },
};

type Row = {
  ref: string;
  client: string;
  phone: string;
  amount: string;
  method: keyof typeof METHOD;
  proofs: number;
  rel: string;
  abs: string;
  sla: 'fresh' | 'aging' | 'overdue' | null;
  status: string;
  tone: Tone;
  hover?: boolean;
  selected?: boolean;
};

const ROWS: Row[] = [
  { ref: 'BZ-DP-2026-0838', client: 'Clarisse Ngo Bell', phone: '+237 699 21 40 88', amount: '2 400 000', method: 'bank', proofs: 2, rel: '11 h', abs: 'hier 22:41', sla: 'overdue', status: 'Preuve envoyée', tone: 'info' },
  { ref: 'BZ-DP-2026-0841', client: 'Moussa Bah', phone: '+237 677 02 33 19', amount: '780 000', method: 'mtn', proofs: 1, rel: '9 h', abs: '05:02', sla: 'overdue', status: 'Preuve envoyée', tone: 'info' },
  { ref: 'BZ-DP-2026-0844', client: 'Jean-Paul Mbarga', phone: '+237 655 71 90 02', amount: '5 100 000', method: 'bankCash', proofs: 1, rel: '6 h', abs: '08:17', sla: 'aging', status: 'En vérification', tone: 'pending' },
  { ref: 'BZ-DP-2026-0846', client: 'Aïcha Diallo', phone: '+237 690 44 12 07', amount: '1 250 000', method: 'om', proofs: 1, rel: '4 h', abs: '10:09', sla: 'aging', status: 'Preuve envoyée', tone: 'info', hover: true },
  { ref: 'BZ-DP-2026-0847', client: 'Fatou Ndiaye', phone: '+237 696 88 45 31', amount: '850 000', method: 'om', proofs: 2, rel: '3 h', abs: '11:26', sla: 'aging', status: 'En vérification', tone: 'pending', selected: true },
  { ref: 'BZ-DP-2026-0849', client: 'Ibrahim Touré', phone: '+237 671 55 08 64', amount: '3 400 000', method: 'wave', proofs: 1, rel: '1 h', abs: '13:12', sla: 'fresh', status: 'Preuve envoyée', tone: 'info' },
  { ref: 'BZ-DP-2026-0851', client: 'Mariam Koné', phone: '+237 698 30 77 25', amount: '1 050 000', method: 'agency', proofs: 1, rel: '25 min', abs: '14:07', sla: 'fresh', status: 'Preuve envoyée', tone: 'info' },
];

/** « Tous » view — newest first, mixed statuses, the density demonstration. */
const ALL_ROWS: Row[] = [
  { ref: 'BZ-DP-2026-0851', client: 'Mariam Koné', phone: '+237 698 30 77 25', amount: '1 050 000', method: 'agency', proofs: 1, rel: '25 min', abs: '14:07', sla: 'fresh', status: 'Preuve envoyée', tone: 'info' },
  { ref: 'BZ-DP-2026-0850', client: 'Awa Camara', phone: '+237 675 19 22 90', amount: '4 200 000', method: 'bank', proofs: 3, rel: '45 min', abs: '13:47', sla: null, status: 'Validé', tone: 'success' },
  { ref: 'BZ-DP-2026-0849', client: 'Ibrahim Touré', phone: '+237 671 55 08 64', amount: '3 400 000', method: 'wave', proofs: 1, rel: '1 h', abs: '13:12', sla: 'fresh', status: 'Preuve envoyée', tone: 'info' },
  { ref: 'BZ-DP-2026-0848', client: 'Nadia Sow', phone: '+237 693 12 60 44', amount: '250 000', method: 'mtn', proofs: 1, rel: '2 h', abs: '12:31', sla: null, status: 'Validé', tone: 'success' },
  { ref: 'BZ-DP-2026-0847', client: 'Fatou Ndiaye', phone: '+237 696 88 45 31', amount: '850 000', method: 'om', proofs: 2, rel: '3 h', abs: '11:26', sla: 'aging', status: 'En vérification', tone: 'pending', hover: true },
  { ref: 'BZ-DP-2026-0846', client: 'Aïcha Diallo', phone: '+237 690 44 12 07', amount: '1 250 000', method: 'om', proofs: 1, rel: '4 h', abs: '10:09', sla: 'aging', status: 'Preuve envoyée', tone: 'info' },
  { ref: 'BZ-DP-2026-0845', client: 'Seydou Traoré', phone: '+237 691 63 55 08', amount: '620 000', method: 'om', proofs: 1, rel: '5 h', abs: '09:33', sla: null, status: 'Rejeté', tone: 'danger' },
  { ref: 'BZ-DP-2026-0844', client: 'Jean-Paul Mbarga', phone: '+237 655 71 90 02', amount: '5 100 000', method: 'bankCash', proofs: 1, rel: '6 h', abs: '08:17', sla: 'aging', status: 'En vérification', tone: 'pending' },
  { ref: 'BZ-DP-2026-0843', client: 'Éric Etoundi', phone: '+237 699 05 18 73', amount: '2 000 000', method: 'bank', proofs: 2, rel: '7 h', abs: '07:22', sla: null, status: 'Validé', tone: 'success' },
  { ref: 'BZ-DP-2026-0842', client: 'Aminata Diop', phone: '+237 672 90 41 55', amount: '450 000', method: 'wave', proofs: 0, rel: '8 h', abs: '06:14', sla: null, status: 'En attente de preuve', tone: 'neutral' },
  { ref: 'BZ-DP-2026-0841', client: 'Moussa Bah', phone: '+237 677 02 33 19', amount: '780 000', method: 'mtn', proofs: 1, rel: '9 h', abs: '05:02', sla: 'overdue', status: 'Preuve envoyée', tone: 'info' },
  { ref: 'BZ-DP-2026-0840', client: 'Chantal Fouda', phone: '+237 694 77 20 16', amount: '1 800 000', method: 'agency', proofs: 1, rel: '13 h', abs: 'hier 20:55', sla: null, status: 'Validé', tone: 'success' },
  { ref: 'BZ-DP-2026-0839', client: 'Oumar Kanté', phone: '+237 676 51 09 82', amount: '9 500 000', method: 'bank', proofs: 2, rel: '12 h', abs: 'hier 21:40', sla: null, status: 'Validé', tone: 'success' },
  { ref: 'BZ-DP-2026-0838', client: 'Clarisse Ngo Bell', phone: '+237 699 21 40 88', amount: '2 400 000', method: 'bank', proofs: 2, rel: '11 h', abs: 'hier 22:41', sla: 'overdue', status: 'Preuve envoyée', tone: 'info' },
];

/* ── Table ──────────────────────────────────────────────────────────────── */

function DepositsTable({ compact, view = 'queue' }: { compact?: boolean; view?: 'queue' | 'all' }) {
  const rows = view === 'all' ? ALL_ROWS : ROWS;
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col overflow-hidden rounded-[14px]', D.surface, D.eCard)}>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-separate border-spacing-0">
          <thead className={cn('sticky top-0 z-10', D.surface2)}>
            <tr>
              {!compact && <Th sortable>Référence</Th>}
              <Th sortable>Client</Th>
              <Th align="right" sortable>Montant XAF</Th>
              {!compact && <Th>Méthode</Th>}
              <Th sortable sorted={view === 'all' ? 'desc' : 'asc'}>Reçu</Th>
              <Th>Statut</Th>
              {!compact && <Th align="right" className="w-[168px]" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const m = METHOD[r.method];
              return (
                <tr
                  key={r.ref}
                  className={cn(
                    'group relative border-t transition-colors',
                    r.selected && compact
                      ? 'bg-[#EDEAFA]/60 shadow-[inset_2px_0_0_#6B5BD2] dark:bg-white/[0.06] dark:shadow-[inset_2px_0_0_#A99BF0]'
                      : r.hover && !compact
                        ? 'bg-[#F6F5FB] dark:bg-white/[0.04]'
                        : 'hover:bg-[#F6F5FB] dark:hover:bg-white/[0.04]',
                  )}
                >
                  {!compact && (
                    <Td className={cn('border-t', D.hairline)}>
                      <span className={cn('inline-flex items-center gap-1.5 text-[12.5px] font-semibold', D.mono, D.body)}>
                        {r.ref}
                        {r.proofs > 0 && (
                          <span className={cn('inline-flex items-center gap-0.5 text-[10.5px] font-bold', D.muted)}>
                            <Paperclip className="h-3 w-3" />
                            {r.proofs}
                          </span>
                        )}
                      </span>
                    </Td>
                  )}
                  <Td className={cn('border-t', D.hairline)}>
                    <div className="leading-[16px]">
                      <div className={cn('flex items-center gap-1.5 text-[13px] font-semibold', D.strong)}>
                        {r.client}
                        {compact && r.proofs > 0 && (
                          <span className={cn('inline-flex items-center gap-0.5 text-[10.5px] font-bold', D.muted)}>
                            <Paperclip className="h-3 w-3" />
                            {r.proofs}
                          </span>
                        )}
                      </div>
                      {!compact && <div className={cn('text-[11px] tabular-nums', D.muted)}>{r.phone}</div>}
                    </div>
                  </Td>
                  <Td align="right" className={cn('border-t', D.hairline)}>
                    <span className={cn('text-[13px] font-bold tabular-nums', D.strong)}>{r.amount}</span>
                  </Td>
                  {!compact && (
                    <Td className={cn('border-t', D.hairline)}>
                      <span className="inline-flex items-center gap-1.5">
                        <MethodMark label={m.mark} bg={m.bg} dark={m.dark} />
                        <span className={cn('text-[12.5px] font-medium', D.body)}>{m.label}</span>
                      </span>
                    </Td>
                  )}
                  <Td className={cn('border-t', D.hairline)}>
                    <Age rel={r.rel} abs={r.abs} level={r.sla} relOnly={compact} />
                  </Td>
                  <Td className={cn('border-t', D.hairline)}>
                    <StatusPill tone={r.tone} label={r.status} />
                  </Td>
                  {!compact && (
                    <Td align="right" className={cn('border-t', D.hairline)}>
                      {r.hover && r.sla != null ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Btn size="sm" variant="success">Valider</Btn>
                          <Btn size="sm" variant="danger">Rejeter</Btn>
                          <IconBtn className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></IconBtn>
                        </span>
                      ) : (
                        <span className="inline-flex h-7 items-center opacity-0" aria-hidden>·</span>
                      )}
                    </Td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <PaginationBar
        range={view === 'all' ? '1–20' : '1–7'}
        total={view === 'all' ? '3 214' : '7'}
        page={1}
        pages={view === 'all' ? 161 : 1}
      />
    </div>
  );
}

/* ── Workbench header + filter bar ──────────────────────────────────────── */

function WorkbenchTop({ compact, view = 'queue' }: { compact?: boolean; view?: 'queue' | 'all' }) {
  return (
    <>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className={cn('text-[20px] font-bold leading-[26px]', D.strong)}>Dépôts</h2>
          <p className={cn('mt-0.5 text-[12px]', D.muted)}>
            3 214 dépôts · <span className="font-semibold text-[#9A6B12] dark:text-[#E7C083]">7 à traiter</span> · plus ancien : 11 h
          </p>
        </div>
        <Btn variant="primary" size="lg"><Plus className="h-4 w-4" /> Nouveau dépôt</Btn>
      </div>

      <div className="mt-4 flex items-center gap-2.5">
        <QueueTabs
          tabs={[
            { label: 'À traiter', count: 7, active: view === 'queue' },
            { label: 'À corriger', count: 2, tone: 'pending' },
            { label: 'Tous', count: '3 214', active: view === 'all' },
          ]}
        />
        <div className="ml-auto flex items-center gap-2">
          <SearchField placeholder="Client, référence, téléphone…" wide={!compact} />
          <Select label="Méthode" value="Toutes" />
          <Select label="Période" value="30 jours" />
        </div>
      </div>
    </>
  );
}

/* ── Screen A — Workbench (full width) ──────────────────────────────────── */

export function DdWorkbench() {
  return (
    <Shell active="Dépôts" title="Dépôts">
      <div className="flex h-full flex-col px-6 pb-6 pt-5">
        <WorkbenchTop view="all" />
        <div className="mt-3 flex min-h-0 flex-1 flex-col">
          <DepositsTable view="all" />
        </div>
      </div>
    </Shell>
  );
}

/* ── Detail panel ───────────────────────────────────────────────────────── */

function CopyValue({ children }: { children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[13px] font-semibold tabular-nums', D.strong)}>
      {children}
      <Copy className={cn('h-3 w-3', D.muted)} />
    </span>
  );
}

function TimelineStep({ label, meta, state }: { label: string; meta?: string; state: 'done' | 'current' | 'todo' }) {
  return (
    <div className="flex items-center gap-2">
      {state === 'done' ? (
        <CircleCheck className="h-3.5 w-3.5 shrink-0 text-[#10B981]" />
      ) : state === 'current' ? (
        <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
          <span className="h-2.5 w-2.5 rounded-full bg-[#6B5BD2] ring-4 ring-[#6B5BD2]/15 dark:bg-[#A99BF0]" />
        </span>
      ) : (
        <CircleDashed className={cn('h-3.5 w-3.5 shrink-0', D.muted)} />
      )}
      <span className={cn('text-[12px] font-semibold', state === 'todo' ? D.muted : D.strong)}>{label}</span>
      {meta && <span className={cn('ml-auto text-[11px] tabular-nums', D.muted)}>{meta}</span>}
    </div>
  );
}

export function DepositPanel() {
  return (
    <aside className={cn('flex w-[560px] shrink-0 flex-col overflow-hidden rounded-[14px]', D.surface, D.eCard)}>
      {/* Pinned header: identity + THE decision */}
      <div className={cn('flex items-center gap-2.5 border-b px-4 py-3', D.hairline)}>
        <span className={cn('text-[13px] font-bold', D.mono, D.strong)}>BZ-DP-2026-0847</span>
        <StatusPill tone="pending" label="En vérification" />
        <span className={cn('text-[11px] font-bold tabular-nums text-[#9A6B12] dark:text-[#E7C083]')}>3 h</span>
        <div className="ml-auto flex items-center gap-1.5">
          <Btn variant="success" size="md">Valider</Btn>
          <Btn variant="danger" size="md">Rejeter</Btn>
          <IconBtn><MoreHorizontal className="h-4 w-4" /></IconBtn>
          <IconBtn><X className="h-4 w-4" /></IconBtn>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5">
        {/* Verdict zone: proof next to the numbers it must match */}
        <div className="grid grid-cols-[248px_1fr] gap-3.5">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <SectionLabel>Preuves · 2</SectionLabel>
              <span className={cn('inline-flex items-center gap-1 text-[11px] font-semibold', D.muted)}>
                Client · 11:26
                <ChevronLeft className="ml-1 h-3 w-3" /> 1/2 <ChevronRight className="h-3 w-3" />
              </span>
            </div>
            <FakeProofSms amount="850 000" reference="BZ-DP-2026-0847" />
            <div className="mt-1.5 flex items-center gap-1">
              <Btn size="sm" variant="ghost"><Maximize2 className="h-3 w-3" /> Agrandir</Btn>
              <Btn size="sm" variant="ghost"><Download className="h-3 w-3" /> Télécharger</Btn>
            </div>
          </div>

          <div className={cn('rounded-[10px] p-3', D.surface2)}>
            <SectionLabel>Vérification du montant</SectionLabel>
            <div className="mt-2 flex items-baseline justify-between">
              <span className={cn('text-[12px]', D.muted)}>Déclaré</span>
              <span className={cn('text-[16px] font-bold tabular-nums', D.strong)}>850 000 <span className={cn('text-[11px] font-semibold', D.muted)}>XAF</span></span>
            </div>
            <div className="mt-2">
              <span className={cn('text-[12px]', D.muted)}>Montant confirmé</span>
              <div className={cn('mt-1 flex h-8 items-center justify-between rounded-[8px] px-2.5', D.surface, 'ring-2 ring-[#6B5BD2]/40 dark:ring-[#A99BF0]/40')}>
                <span className={cn('text-[14px] font-bold tabular-nums', D.strong)}>850 000</span>
                <span className={cn('text-[11px] font-semibold', D.muted)}>XAF</span>
              </div>
            </div>
            <div className={cn('mt-2.5 border-t pt-2', D.hairline)}>
              <div className="flex items-center justify-between text-[12px]">
                <span className={cn('inline-flex items-center gap-1', D.muted)}><Wallet className="h-3 w-3" /> Solde wallet</span>
                <span className={cn('font-semibold tabular-nums', D.body)}>1 213 450</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[12px]">
                <span className={D.muted}>Après validation</span>
                <span className="font-bold tabular-nums text-[#2E7D52] dark:text-[#7FCBA0]">2 063 450</span>
              </div>
            </div>
          </div>
        </div>

        {/* Facts grid */}
        <div className={cn('mt-4 grid grid-cols-3 gap-x-4 gap-y-3 border-t pt-3.5', D.hairline)}>
          <KV k="Client" v={<span className={D.accent}>Fatou Ndiaye</span>} />
          <KV k="Téléphone" v="+237 696 88 45 31" />
          <KV k="Société" v="FN Import Sarl" />
          <KV k="Méthode" v={<span className="inline-flex items-center gap-1.5"><MethodMark label="O" bg="#FF6600" size={16} /> Orange code</span>} />
          <KV k="Créé le" v="19 août, 11:26" />
          <KV k="Créé par" v="Client (app)" />
        </div>

        {/* Internal note */}
        <div className={cn('mt-3.5 rounded-[10px] px-3 py-2.5', D.surface2)}>
          <SectionLabel>Note interne</SectionLabel>
          <p className={cn('mt-1 text-[12.5px] leading-[18px]', D.body)}>
            2ᵉ dépôt du mois — la 1ʳᵉ preuve était floue, remplacée à 12:04.
          </p>
        </div>

        {/* Timeline, open — not behind a click */}
        <div className={cn('mt-3.5 border-t pt-3.5', D.hairline)}>
          <SectionLabel className="mb-2">Suivi</SectionLabel>
          <div className="space-y-2">
            <TimelineStep state="done" label="Demande créée" meta="19 août, 11:26" />
            <TimelineStep state="done" label="Preuve envoyée par le client" meta="11:31" />
            <TimelineStep state="current" label="Vérification en cours — Nelson E." meta="12:04" />
            <TimelineStep state="todo" label="Validation & crédit du wallet" />
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ── Screen B — Split (list + panel) ────────────────────────────────────── */

export function DdSplit() {
  return (
    <Shell active="Dépôts" title="Dépôts">
      <div className="flex h-full flex-col px-6 pb-6 pt-5">
        <WorkbenchTop compact />
        <div className="mt-3 flex min-h-0 flex-1 gap-4">
          <DepositsTable compact />
          <DepositPanel />
        </div>
      </div>
    </Shell>
  );
}

/* ── Screen B' — Validate dialog over the split ─────────────────────────── */

export function DdValidate() {
  return (
    <Shell active="Dépôts" title="Dépôts">
      <div className="flex h-full flex-col px-6 pb-6 pt-5">
        <WorkbenchTop compact />
        <div className="mt-3 flex min-h-0 flex-1 gap-4">
          <DepositsTable compact />
          <DepositPanel />
        </div>
      </div>
      <Dialog
        title="Valider le dépôt BZ-DP-2026-0847"
        footer={
          <>
            <span className={cn('mr-auto text-[11px]', D.muted)}>⌘⏎ pour confirmer</span>
            <Btn variant="ghost">Annuler</Btn>
            <Btn variant="success" size="lg"><Check className="h-4 w-4" /> Créditer 850 000 XAF</Btn>
          </>
        }
      >
        <div className="space-y-3">
          <div className={cn('flex items-center justify-between rounded-[10px] px-3 py-2.5', D.surface2)}>
            <span className={cn('text-[12.5px]', D.muted)}>Montant déclaré</span>
            <span className={cn('text-[13px] font-bold tabular-nums', D.strong)}>850 000 XAF</span>
          </div>
          <div>
            <label className={cn('text-[12.5px] font-semibold', D.strong)}>Montant confirmé (XAF)</label>
            <div className={cn('mt-1 flex h-9 items-center rounded-[8px] px-3 text-[14px] font-bold tabular-nums', D.surface, 'ring-2 ring-[#10B981]/50', D.strong)}>
              850 000
            </div>
            <p className={cn('mt-1 text-[11.5px]', D.muted)}>Wallet de Fatou Ndiaye : 1 213 450 → <b className="text-[#2E7D52] dark:text-[#7FCBA0]">2 063 450 XAF</b></p>
          </div>
          <div>
            <label className={cn('text-[12.5px] font-semibold', D.strong)}>Note interne <span className={cn('font-medium', D.muted)}>(optionnel)</span></label>
            <div className={cn('mt-1 h-[52px] rounded-[8px] px-3 py-2 text-[12.5px]', D.surface2, D.muted)}>Visible uniquement par les admins…</div>
          </div>
          <label className="flex cursor-pointer items-center gap-2.5">
            <span className="flex h-[18px] w-8 items-center rounded-full bg-[#10B981] p-0.5"><span className="ml-auto h-3.5 w-3.5 rounded-full bg-white" /></span>
            <span className={cn('inline-flex items-center gap-1.5 text-[12.5px] font-semibold', D.strong)}><Bell className="h-3.5 w-3.5" /> Notifier le client</span>
          </label>
        </div>
      </Dialog>
    </Shell>
  );
}

/* ── Screen C — Create (one page, no wizard) ────────────────────────────── */

function Field({ label, children, hint, className }: { label: React.ReactNode; children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <div className={className}>
      <label className={cn('text-[12.5px] font-semibold', D.strong)}>{label}</label>
      <div className="mt-1">{children}</div>
      {hint && <p className={cn('mt-1 text-[11.5px]', D.muted)}>{hint}</p>}
    </div>
  );
}

function InputBox({ children, focus, right }: { children: React.ReactNode; focus?: boolean; right?: React.ReactNode }) {
  return (
    <div className={cn('flex h-9 items-center justify-between rounded-[8px] px-3 text-[13.5px]', D.surface, focus ? 'ring-2 ring-[#6B5BD2]/40 dark:ring-[#A99BF0]/40' : 'ring-1 ring-inset ring-[#141029]/[0.09] dark:ring-white/[0.09]')}>
      {children}
      {right}
    </div>
  );
}

const FAMILIES = [
  { key: 'bank', label: 'Banque', mark: 'B', bg: '#1E3A5F' },
  { key: 'om', label: 'Orange', mark: 'O', bg: '#FF6600' },
  { key: 'mtn', label: 'MTN', mark: 'M', bg: '#FFCB05', dark: true },
  { key: 'wave', label: 'Wave', mark: 'W', bg: '#1DC3E3' },
  { key: 'agency', label: 'Agence', mark: 'A', bg: '#A947FE' },
];

export function DdCreate() {
  return (
    <Shell active="Dépôts" title="Dépôts · Nouveau">
      <div className="h-full overflow-y-auto px-6 pb-6 pt-5">
        <div className="mx-auto max-w-[1080px]">
          <div className="flex items-center gap-2">
            <span className={cn('text-[12px] font-semibold', D.muted)}>Dépôts</span>
            <ChevronRight className={cn('h-3 w-3', D.muted)} />
            <h2 className={cn('text-[20px] font-bold leading-[26px]', D.strong)}>Nouveau dépôt</h2>
          </div>

          <div className="mt-4 grid grid-cols-[1fr_340px] items-start gap-5">
            {/* Main form — every decision on one screen */}
            <div className="space-y-4">
              <section className={cn('rounded-[14px] p-4', D.surface, D.eCard)}>
                <SectionLabel>1 · Client & montant</SectionLabel>
                <div className="mt-3 grid grid-cols-2 gap-3.5">
                  <Field label="Client">
                    <InputBox>
                      <span className="inline-flex items-center gap-2">
                        <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold', 'bg-[#EDEAFA] text-[#2C2740] dark:bg-[#2F2C3D] dark:text-[#E7E5F0]')}>FN</span>
                        <span className={cn('font-semibold', D.strong)}>Fatou Ndiaye</span>
                        <span className={cn('text-[11.5px] tabular-nums', D.muted)}>· +237 696 88 45 31</span>
                      </span>
                      <ChevronDown className={cn('h-4 w-4', D.muted)} />
                    </InputBox>
                  </Field>
                  <Field label="Montant (XAF)" hint="Min 1 000 · Max 50 000 000">
                    <InputBox focus>
                      <span className={cn('text-[15px] font-bold tabular-nums', D.strong)}>850 000</span>
                      <span className={cn('inline-flex items-center gap-1', D.muted)}>
                        <span className="text-[11px] font-semibold">XAF</span>
                      </span>
                    </InputBox>
                  </Field>
                </div>
                <div className="mt-2.5 flex items-center gap-1.5">
                  {['100K', '250K', '500K', '1M', '2M'].map((p) => (
                    <span key={p} className={cn('inline-flex h-6 items-center rounded-[6px] px-2 text-[11.5px] font-bold tabular-nums', D.surface2, D.body)}>{p}</span>
                  ))}
                  <span className={cn('ml-2 inline-flex items-center gap-1 text-[11.5px]', D.muted)}><Wallet className="h-3 w-3" /> Solde actuel : <b className={cn('tabular-nums', D.body)}>1 213 450 XAF</b></span>
                </div>
              </section>

              <section className={cn('rounded-[14px] p-4', D.surface, D.eCard)}>
                <SectionLabel>2 · Méthode de dépôt</SectionLabel>
                <div className="mt-3 flex items-center gap-1.5">
                  {FAMILIES.map((f) => (
                    <span
                      key={f.key}
                      className={cn(
                        'inline-flex h-8 items-center gap-1.5 rounded-[8px] px-3 text-[12.5px] font-bold',
                        f.key === 'om' ? 'bg-[#1C1B22] text-white dark:bg-[#F2F1F7] dark:text-[#1B1A24]' : cn(D.surface2, D.body, 'ring-1 ring-inset ring-[#141029]/[0.06] dark:ring-white/[0.07]'),
                      )}
                    >
                      <MethodMark label={f.mark} bg={f.bg} dark={f.dark} size={16} />
                      {f.label}
                    </span>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3.5">
                  <Field label="Type d'opération">
                    <InputBox>
                      <span className={cn('font-semibold', D.strong)}>Retrait par code marchand</span>
                      <ChevronDown className={cn('h-4 w-4', D.muted)} />
                    </InputBox>
                  </Field>
                  <Field label="Téléphone du client (émetteur)">
                    <InputBox>
                      <span className={cn('font-semibold tabular-nums', D.strong)}>+237 696 88 45 31</span>
                    </InputBox>
                  </Field>
                </div>
              </section>

              <section className={cn('rounded-[14px] p-4', D.surface, D.eCard)}>
                <SectionLabel>3 · Preuves & note <span className="normal-case tracking-normal">(optionnel)</span></SectionLabel>
                <div className="mt-3 grid grid-cols-2 gap-3.5">
                  <div className={cn('flex h-[104px] flex-col items-center justify-center gap-1.5 rounded-[10px] border-2 border-dashed', D.hairline, D.surface2)}>
                    <Upload className={cn('h-5 w-5', D.muted)} />
                    <p className={cn('text-[12px] font-semibold', D.body)}>Collez (Ctrl+V), glissez ou cliquez</p>
                    <p className={cn('text-[11px]', D.muted)}>Images ou PDF · 10 Mo max</p>
                  </div>
                  <div className={cn('h-[104px] rounded-[10px] px-3 py-2 text-[12.5px]', D.surface2, D.muted)}>
                    Note interne — visible uniquement par les admins…
                  </div>
                </div>
              </section>
            </div>

            {/* Rail: what the admin reads to the client + recap + CTA */}
            <div className="space-y-4">
              <section className={cn('rounded-[14px] p-4', D.surface, D.eCard)}>
                <div className="flex items-center justify-between">
                  <SectionLabel>Coordonnées à communiquer</SectionLabel>
                  <MethodMark label="O" bg="#FF6600" size={16} />
                </div>
                <div className="mt-2.5 space-y-2">
                  <div className={cn('rounded-[8px] px-2.5 py-2', D.surface2)}>
                    <div className={cn('text-[11px]', D.muted)}>Code marchand</div>
                    <div className="mt-0.5"><CopyValue><span className={D.mono}>#150*47*712 447*850000#</span></CopyValue></div>
                  </div>
                  <div className={cn('flex items-center justify-between rounded-[8px] px-2.5 py-2', D.surface2)}>
                    <span className={cn('text-[11.5px]', D.muted)}>Titulaire</span>
                    <CopyValue>BONZINI LABS SARL</CopyValue>
                  </div>
                </div>
                <ol className={cn('mt-3 list-decimal space-y-1 pl-4 text-[12px] leading-[17px]', D.body)}>
                  <li>Le client compose le code marchand</li>
                  <li>Il valide avec son PIN Orange Money</li>
                  <li>Capture d'écran du SMS → preuve</li>
                </ol>
              </section>

              <section className={cn('rounded-[14px] p-4', D.surface, D.eCard)}>
                <SectionLabel>Récapitulatif</SectionLabel>
                <div className="mt-2.5 space-y-1.5 text-[12.5px]">
                  <div className="flex justify-between"><span className={D.muted}>Client</span><span className={cn('font-semibold', D.strong)}>Fatou Ndiaye</span></div>
                  <div className="flex justify-between"><span className={D.muted}>Montant</span><span className={cn('font-bold tabular-nums', D.strong)}>850 000 XAF</span></div>
                  <div className="flex justify-between"><span className={D.muted}>Méthode</span><span className={cn('font-semibold', D.strong)}>Orange · code marchand</span></div>
                  <div className="flex justify-between"><span className={D.muted}>Statut initial</span><StatusPill tone="neutral" label="Demande créée" /></div>
                </div>
                <div className={cn('mt-3 flex items-start gap-2 rounded-[8px] px-2.5 py-2 text-[11.5px] leading-[16px]', 'bg-[#EAE7FA] text-[#5B4CC4] dark:bg-[#272252] dark:text-[#B5AAF0]')}>
                  <Info className="mt-px h-3.5 w-3.5 shrink-0" />
                  Le wallet n'est crédité qu'à la validation de la preuve.
                </div>
                <Btn variant="primary" size="lg" className="mt-3.5 w-full">Créer le dépôt <span className="ml-1 text-[11px] opacity-70">⌘⏎</span></Btn>
                <Btn variant="ghost" className="mt-1.5 w-full">Annuler</Btn>
              </section>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

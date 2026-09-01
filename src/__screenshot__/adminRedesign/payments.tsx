/**
 * ADMIN DESKTOP REDESIGN V2 — module Paiements.
 *
 * Même archétype instancié pour les paiements, composé du vocabulaire réel :
 * vrais logos de méthode (PaymentMethodLogo), pilules violettes du module,
 * CopyRow-style copiables, cartes/inserts du kit. Rien d'inventé.
 */
import { cn } from '@/lib/utils';
import {
  Plus,
  Layers,
  FileDown,
  Paperclip,
  Copy,
  X,
  MoreHorizontal,
  Play,
  ChevronRight,
  ChevronDown,
  Upload,
  CheckCircle,
  ArrowRight,
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
import { PaymentMethodLogo } from '@/mobile/components/payments/PaymentMethodLogo';
import {
  Shell,
  Age,
  Chip,
  DropChip,
  SearchField,
  CardHeader,
  SecLabel,
  Th,
  Td,
  PaginationBar,
  RefChip,
  FakeQR,
} from './kit';

const VIOLET = '#8B5CF6';
const VIOLET_PILL = 'rounded-full bg-[#8B5CF6] text-white font-bold';
const DANGER_SOFT_PILL = 'rounded-full bg-[#FBE7E7] font-semibold text-[#C0504D] dark:bg-[#3A2526] dark:text-[#E79A9A]';

type LogoMethod = 'alipay' | 'wechat' | 'bank_transfer' | 'cash';
type Tone = 'success' | 'pending' | 'danger' | 'info' | 'neutral';

/* ── Fixtures ───────────────────────────────────────────────────────────── */

type PRow = {
  ref: string;
  client: string;
  benef: string;
  benefMeta: string;
  method: LogoMethod;
  cny: string;
  xaf: string;
  rate: string;
  custom?: boolean;
  proofs: number;
  rel: string;
  abs: string;
  sla: 'fresh' | 'aging' | 'overdue' | null;
  status: string;
  tone: Tone;
  hover?: boolean;
  selected?: boolean;
};

const QUEUE: PRow[] = [
  { ref: 'BZ-PY-2026-1192', client: 'Jean-Paul Mbarga', benef: 'Guangzhou Hongfa Trade', benefMeta: 'Bank of China · 6214 … 5588', method: 'bank_transfer', cny: '¥58 900', xaf: '5 110 000', rate: '11 525', proofs: 1, rel: '14 h', abs: 'hier 23:58', sla: 'overdue', status: 'Prêt à payer', tone: 'info' },
  { ref: 'BZ-PY-2026-1196', client: 'Awa Camara', benef: 'Lin Mei 林梅', benefMeta: 'WeChat · linmei_gz88', method: 'wechat', cny: '¥9 210', xaf: '798 800', rate: '11 530', proofs: 0, rel: '7 h', abs: '07:10', sla: 'aging', status: 'Prêt à payer', tone: 'info', hover: true },
  { ref: 'BZ-PY-2026-1204', client: 'Fatou Ndiaye', benef: 'Zhang Wei 张伟', benefMeta: 'Alipay · zw88@aliyun.com', method: 'alipay', cny: '¥14 380', xaf: '1 250 000', rate: '11 504', custom: true, proofs: 1, rel: '3 h', abs: '11:41', sla: 'fresh', status: 'Prêt à payer', tone: 'info', selected: true },
  { ref: 'BZ-PY-2026-1205', client: 'Ibrahim Touré', benef: 'Ibrahim Touré (le client)', benefMeta: 'Retrait cash · Guangzhou', method: 'cash', cny: '¥23 060', xaf: '2 000 000', rate: '11 530', proofs: 0, rel: '2 h', abs: '12:19', sla: 'fresh', status: 'Cash scanné', tone: 'pending' },
  { ref: 'BZ-PY-2026-1201', client: 'Clarisse Ngo Bell', benef: 'Shenzhen Kaida Electronics', benefMeta: 'Alipay · ID 138 2244 9087', method: 'alipay', cny: '¥31 120', xaf: '2 700 000', rate: '11 526', proofs: 2, rel: '5 h', abs: '09:20', sla: null, status: 'En cours', tone: 'pending' },
  { ref: 'BZ-PY-2026-1199', client: 'Mariam Koné', benef: 'Yiwu Sunrise Import-Export', benefMeta: 'Bank of China · 6217 … 0031', method: 'bank_transfer', cny: '¥120 400', xaf: '10 450 000', rate: '11 522', proofs: 3, rel: '6 h', abs: '08:05', sla: null, status: 'Effectué', tone: 'success' },
  { ref: 'BZ-PY-2026-1188', client: 'Moussa Bah', benef: '—', benefMeta: 'Infos bénéficiaire manquantes', method: 'wechat', cny: '¥4 610', xaf: '400 000', rate: '11 530', proofs: 0, rel: '1 j', abs: '18 août 15:44', sla: null, status: 'Info manquante', tone: 'danger' },
];

const ALL: PRow[] = [
  ...QUEUE,
  { ref: 'BZ-PY-2026-1195', client: 'Nadia Sow', benef: 'Foshan Meubles Co.', benefMeta: 'WeChat · fsmeubles2020', method: 'wechat', cny: '¥6 950', xaf: '602 800', rate: '11 530', proofs: 2, rel: '8 h', abs: '06:40', sla: null, status: 'Effectué', tone: 'success' },
  { ref: 'BZ-PY-2026-1194', client: 'Éric Etoundi', benef: 'Zhejiang Auto Parts', benefMeta: 'Bank of China · 6228 … 4410', method: 'bank_transfer', cny: '¥44 730', xaf: '3 880 000', rate: '11 528', proofs: 1, rel: '9 h', abs: '05:12', sla: null, status: 'Effectué', tone: 'success' },
  { ref: 'BZ-PY-2026-1193', client: 'Aminata Diop', benef: 'Wu Xia 吴霞', benefMeta: 'Alipay · wx_textile', method: 'alipay', cny: '¥2 310', xaf: '200 400', rate: '11 526', proofs: 1, rel: '12 h', abs: 'hier 23:05', sla: null, status: 'Refusé', tone: 'danger' },
  { ref: 'BZ-PY-2026-1191', client: 'Oumar Kanté', benef: 'Hunan Steel Trading', benefMeta: 'Bank of China · 6217 … 8802', method: 'bank_transfer', cny: '¥138 400', xaf: '12 010 000', rate: '11 524', proofs: 3, rel: '15 h', abs: 'hier 22:33', sla: null, status: 'Effectué', tone: 'success' },
  { ref: 'BZ-PY-2026-1190', client: 'Chantal Fouda', benef: 'Lin Mei 林梅', benefMeta: 'WeChat · linmei_gz88', method: 'wechat', cny: '¥11 530', xaf: '1 000 000', rate: '11 530', proofs: 2, rel: '16 h', abs: 'hier 21:58', sla: null, status: 'Effectué', tone: 'success' },
];

/* ── Table ──────────────────────────────────────────────────────────────── */

function PaymentsTable({ compact, view = 'queue' }: { compact?: boolean; view?: 'queue' | 'all' }) {
  const rows = view === 'all' ? ALL : QUEUE;
  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
      <CardHeader
        title={view === 'all' ? 'Tous les paiements' : "File d'attente"}
        meta={view === 'all' ? 'Triés du plus récent au plus ancien' : 'Triée du plus ancien au plus récent'}
      />
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-left">
          <thead className={cn('sticky top-0 z-10', SURFACE.card)}>
            <tr>
              {!compact && <Th first sortable>Référence</Th>}
              <Th first={compact} sortable>Client</Th>
              <Th>Bénéficiaire</Th>
              <Th align="right" sortable>Montant</Th>
              {!compact && <Th align="right">Taux</Th>}
              {!compact && <Th sortable sorted={view === 'all' ? 'desc' : 'asc'}>Créé</Th>}
              <Th last={compact}>Statut</Th>
              {!compact && <Th last className="w-[130px]" />}
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
                          <Paperclip className="h-3 w-3" />{r.proofs}
                        </span>
                      )}
                    </span>
                  </Td>
                )}
                <Td first={compact}>
                  <span className={cn('text-[13px] font-semibold', TEXT.strong, compact && 'inline-block max-w-[118px] truncate align-middle')}>{r.client}</span>
                </Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <PaymentMethodLogo method={r.method} size={26} />
                    <div className="leading-[16px]">
                      <div className={cn('truncate text-[12.5px] font-semibold', compact ? 'max-w-[150px]' : 'max-w-[190px]', r.benef === '—' ? TEXT.muted : TEXT.strong)}>{r.benef}</div>
                      <div className={cn('truncate text-[11px]', compact ? 'max-w-[150px]' : 'max-w-[190px]', r.benef === '—' ? 'font-semibold text-[#C0504D] dark:text-[#E79A9A]' : TEXT.muted)}>{r.benefMeta}</div>
                    </div>
                  </div>
                </Td>
                <Td align="right">
                  <div className="leading-[17px]">
                    <Amount value={r.cny} size="md" className="!text-[15px]" />
                    {!compact && <div className={cn('text-[11px] tabular-nums', TEXT.muted)}>{r.xaf} XAF</div>}
                  </div>
                </Td>
                {!compact && (
                  <Td align="right">
                    <span className={cn('inline-flex items-center gap-1 text-[12px] tabular-nums', TEXT.muted)}>
                      {r.rate}
                      {r.custom && (
                        <span className="rounded-full bg-[#EAE7FA] px-1.5 py-px text-[9px] font-extrabold uppercase text-[#5B4CC4] dark:bg-[#272252] dark:text-[#B5AAF0]">perso</span>
                      )}
                    </span>
                  </Td>
                )}
                {!compact && (
                  <Td>
                    <Age rel={r.rel} abs={r.abs} level={r.sla} />
                  </Td>
                )}
                <Td last={compact}>
                  <StatusPill tone={r.tone} label={r.status} />
                </Td>
                {!compact && (
                  <Td last align="right">
                    {r.hover ? (
                      <span className="inline-flex items-center gap-1.5">
                        <button type="button" className={cn('inline-flex items-center gap-1 px-3 py-1.5 text-[12px]', VIOLET_PILL)}>
                          <Play className="h-3 w-3" /> Traiter
                        </button>
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
        total={view === 'all' ? '5 872' : '7'}
        page={1}
        pages={view === 'all' ? 294 : 1}
      />
    </Card>
  );
}

/* ── En-tête + filtres ──────────────────────────────────────────────────── */

function PWorkbenchTop({ compact, view = 'queue' }: { compact?: boolean; view?: 'queue' | 'all' }) {
  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className={cn('text-[26px] font-extrabold tracking-tight', TEXT.strong)}>Paiements</h2>
          <p className={cn('mt-1 text-[14px]', TEXT.muted)}>
            5 872 paiements · <span className="font-bold text-[#B47A17] dark:text-[#E7C083]">5 à traiter</span> · <span className="font-bold text-[#C0504D] dark:text-[#E79A9A]">1 bloqué (infos)</span>
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button type="button" className={cn('inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-bold', SOFT_PILL)}>
            <FileDown className="h-4 w-4" /> Exporter (PDF)
          </button>
          <button type="button" className={cn('inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-bold', SOFT_PILL)}>
            <Layers className="h-4 w-4" /> Paiement groupé
          </button>
          <button type="button" className={cn('inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-bold', PRIMARY_PILL)}>
            <Plus className="h-4 w-4" /> Nouveau paiement
          </button>
        </div>
      </header>

      <section className="mt-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Chip label="À traiter" count={5} active={view === 'queue'} />
          <Chip label="Info manquante" count={1} />
          <Chip label="En cours" count={3} />
          <Chip label="Tous" count="5 872" active={view === 'all'} />
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <SearchField placeholder={compact ? 'Rechercher…' : 'Nom, bénéficiaire ou référence…'} className={compact ? 'w-[190px]' : 'w-[300px]'} />
          <DropChip label="Méthode" value="Toutes" />
          <DropChip label="Période" value="30 jours" />
        </div>
      </section>
    </>
  );
}

/* ── Écran A — Workbench ────────────────────────────────────────────────── */

export function DpWorkbench() {
  return (
    <Shell>
      <div className="flex h-[calc(100vh-120px)] min-h-[560px] flex-col">
        <PWorkbenchTop view="all" />
        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          <PaymentsTable view="all" />
        </div>
      </div>
    </Shell>
  );
}

/* ── Panneau détail ─────────────────────────────────────────────────────── */

function CopyRow({ k, v, mono, accent }: { k: string; v: string; mono?: boolean; accent?: string }) {
  return (
    <div className={cn('flex h-9 items-center justify-between rounded-2xl px-3', SURFACE.canvas)}>
      <span className={cn('text-[11.5px]', TEXT.muted)}>{k}</span>
      <span
        className={cn('inline-flex items-center gap-1.5 text-[13px] font-bold tabular-nums', TEXT.strong, mono && 'font-mono text-[12.5px]')}
        style={accent ? { color: accent } : undefined}
      >
        {v}
        <Copy className={cn('h-3 w-3', TEXT.muted)} />
      </span>
    </div>
  );
}

function PTimelineStep({ label, meta, state, last }: { label: string; meta?: string; state: 'done' | 'current' | 'todo'; last?: boolean }) {
  return (
    <div className="flex gap-2.5">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
            state === 'done'
              ? 'border-[#34d399] bg-[#DEEFE5] text-[#2E7D52] dark:bg-[#1E3A2C] dark:text-[#7FCBA0]'
              : state === 'current'
                ? 'border-[#8B5CF6] text-[#8B5CF6]'
                : cn('border-black/[0.12] dark:border-white/[0.15]', TEXT.muted),
          )}
        >
          {state === 'done' && <CheckCircle className="h-3 w-3" />}
          {state === 'current' && <span className="h-2 w-2 rounded-full bg-current" />}
        </div>
        {!last && <div className="my-0.5 w-0.5" style={{ height: 6, background: state === 'done' ? '#34d399' : 'rgba(0,0,0,0.08)' }} />}
      </div>
      <div className="flex min-w-0 flex-1 items-baseline justify-between gap-2 pb-1">
        <p className={cn('text-[12px] font-semibold', state === 'todo' ? TEXT.muted : TEXT.strong)}>{label}</p>
        {meta && <p className={cn('shrink-0 text-[11px] tabular-nums', TEXT.muted)}>{meta}</p>}
      </div>
    </div>
  );
}

function PInfoKV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className={cn('text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>{k}</div>
      <div className={cn('mt-0.5 truncate text-[13px] font-semibold tabular-nums', TEXT.strong)}>{v}</div>
    </div>
  );
}

export function PaymentPanel() {
  return (
    <aside
      className={cn(
        'flex w-[560px] shrink-0 flex-col overflow-hidden rounded-[24px]',
        SURFACE.card,
        'ring-1 ring-black/[0.06] dark:ring-white/[0.06]',
      )}
    >
      <div className="flex items-center gap-2 border-b border-black/[0.06] px-4 py-2.5 dark:border-white/[0.06]">
        <RefChip>BZ-PY-2026-1204</RefChip>
        <StatusPill tone="info" label="Prêt à payer" />
        <span className="whitespace-nowrap text-[11px] font-bold tabular-nums text-[#2E7D52] dark:text-[#7FCBA0]">3 h</span>
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" className={cn('inline-flex items-center gap-1 whitespace-nowrap px-3 py-2 text-[12px]', VIOLET_PILL)}>
            <Play className="h-3 w-3" /> Passer en cours
          </button>
          <button type="button" className={cn('px-3 py-2 text-[12px]', DANGER_SOFT_PILL)}>Rejeter</button>
          <Holder icon={MoreHorizontal} size="sm" onClick={() => {}} ariaLabel="Plus" />
          <Holder icon={X} size="sm" onClick={() => {}} ariaLabel="Fermer" />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3.5">
        {/* Les trois grandeurs d'argent, d'un coup d'œil */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className={cn('rounded-2xl px-3 py-2', SURFACE.canvas)}>
            <div className={cn('text-[10.5px] font-bold uppercase tracking-wider', TEXT.muted)}>Fournisseur reçoit</div>
            <Amount value="¥14 380" size="md" className="mt-0.5 !text-[19px]" />
          </div>
          <div className={cn('rounded-2xl px-3 py-2', SURFACE.canvas)}>
            <div className={cn('text-[10.5px] font-bold uppercase tracking-wider', TEXT.muted)}>Client débité</div>
            <div className={cn('mt-1 text-[15px] font-extrabold tabular-nums leading-[24px]', TEXT.strong)}>
              1 250 000 <span className={cn('text-[11px] font-bold', TEXT.muted)}>XAF</span>
            </div>
          </div>
          <div className={cn('rounded-2xl px-3 py-2', SURFACE.canvas)}>
            <div className={cn('text-[10.5px] font-bold uppercase tracking-wider', TEXT.muted)}>Taux</div>
            <div className="mt-1 flex items-center gap-1.5 leading-[24px]">
              <span className={cn('text-[15px] font-extrabold tabular-nums', TEXT.strong)}>11 504</span>
              <span className="rounded-full bg-[#EAE7FA] px-1.5 py-px text-[9px] font-extrabold uppercase text-[#5B4CC4] dark:bg-[#272252] dark:text-[#B5AAF0]">perso</span>
            </div>
          </div>
        </div>

        {/* Zone de verdict : coordonnées à transcrire, au caractère près */}
        <div className="mt-3 grid grid-cols-[1fr_112px] items-start gap-3.5">
          <div>
            <SecLabel
              className="mb-2"
              right={<button type="button" className="text-[12px] font-semibold text-[#6B5BD2] dark:text-[#A99BF0]">Modifier</button>}
            >
              Bénéficiaire · <span style={{ color: '#1677FF' }}>Alipay</span>
            </SecLabel>
            <div className="space-y-2">
              <CopyRow k="Nom" v="Zhang Wei 张伟" />
              <CopyRow k="Alipay ID" v="zw88@aliyun.com" mono accent="#1677FF" />
              <CopyRow k="Téléphone" v="+86 138 0219 4471" mono />
            </div>
          </div>
          <div>
            <div className={cn('mb-2 text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>QR code</div>
            <FakeQR size={112} color="#1677FF" />
          </div>
        </div>

        {/* L'exigence de complétion, énoncée */}
        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-black/10 px-3.5 py-2 dark:border-white/10">
          <div className="flex min-w-0 items-center gap-2.5">
            <Upload className={cn('h-4 w-4 shrink-0', TEXT.muted)} />
            <div className="min-w-0">
              <p className={cn('text-[12.5px] font-bold', TEXT.strong)}>Preuve de paiement admin</p>
              <p className={cn('truncate text-[11px]', TEXT.muted)}>Requise pour « Valider » — Ctrl+V colle une capture</p>
            </div>
          </div>
          <button type="button" className={cn('shrink-0 rounded-full px-3 py-1.5 text-[12px] font-bold', SOFT_PILL)}>Ajouter</button>
        </div>

        {/* Faits */}
        <div className="mt-3 grid grid-cols-3 gap-x-4 gap-y-2 border-t border-black/[0.06] pt-2.5 dark:border-white/[0.06]">
          <PInfoKV k="Client" v={<span className="text-[#6B5BD2] dark:text-[#A99BF0]">Fatou Ndiaye</span>} />
          <PInfoKV k="Solde après débit" v="963 450 XAF" />
          <PInfoKV k="Créé le" v="19 août, 11:41" />
          <PInfoKV k="Créé par" v="Nelson E. (admin)" />
          <PInfoKV k="Carnet" v="Zhang Wei · enregistré" />
          <PInfoKV k="Lot" v="—" />
        </div>

        {/* Suivi */}
        <div className="mt-2.5 border-t border-black/[0.06] pt-2.5 dark:border-white/[0.06]">
          <SecLabel className="mb-1.5">Suivi</SecLabel>
          <PTimelineStep state="done" label="Paiement créé — wallet débité" meta="11:41" />
          <PTimelineStep state="done" label="Bénéficiaire complet" meta="11:41" />
          <PTimelineStep state="current" label="Prêt à payer" />
          <PTimelineStep state="todo" label="Traitement (Alipay)" />
          <PTimelineStep state="todo" label="Effectué — preuve envoyée au client" last />
        </div>
      </div>
    </aside>
  );
}

/* ── Écran B — Scindé ───────────────────────────────────────────────────── */

export function DpSplit() {
  return (
    <Shell>
      <div className="flex h-[calc(100vh-120px)] min-h-[560px] flex-col">
        <PWorkbenchTop compact view="queue" />
        <div className="mt-4 flex min-h-0 flex-1 gap-5">
          <PaymentsTable compact view="queue" />
          <PaymentPanel />
        </div>
      </div>
    </Shell>
  );
}

/* ── Écran C — Création une page ────────────────────────────────────────── */

function SelectBox({ children }: { children: React.ReactNode }) {
  return (
    <div className={cn('flex h-12 w-full items-center justify-between rounded-2xl px-4 text-[14px]', SURFACE.card, SURFACE.shadow, TEXT.strong)}>
      {children}
    </div>
  );
}

const P_METHODS: { m: LogoMethod; label: string }[] = [
  { m: 'alipay', label: 'Alipay' },
  { m: 'wechat', label: 'WeChat Pay' },
  { m: 'bank_transfer', label: 'Virement' },
  { m: 'cash', label: 'Cash' },
];

export function DpCreate() {
  return (
    <Shell>
      <div className="mx-auto max-w-[1120px]">
        <header className="flex items-center gap-2">
          <span className={cn('text-[13px] font-semibold', TEXT.muted)}>Paiements</span>
          <ChevronRight className={cn('h-3.5 w-3.5', TEXT.muted)} />
          <h2 className={cn('text-[26px] font-extrabold tracking-tight', TEXT.strong)}>Nouveau paiement</h2>
        </header>

        <div className="mt-5 grid grid-cols-[1fr_360px] items-start gap-5">
          <div className="space-y-4">
            {/* 1 · Client & montant */}
            <Card>
              <span className={cn('text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>1 · Client & montant</span>
              <div className="mt-3 grid grid-cols-2 gap-4">
                <FormField label="Client" hint="Solde : 2 213 450 XAF">
                  <SelectBox>
                    <span className="inline-flex min-w-0 items-center gap-2.5">
                      <Avatar name="Fatou Ndiaye" size="sm" />
                      <span className="truncate font-bold">Fatou Ndiaye</span>
                    </span>
                    <ChevronDown className={cn('h-4 w-4 shrink-0', TEXT.muted)} />
                  </SelectBox>
                </FormField>
                <FormField label="Date de l'opération">
                  <SelectBox>
                    <span className="font-semibold">Maintenant</span>
                    <span className="text-[12px] font-bold" style={{ color: VIOLET }}>Antidater</span>
                  </SelectBox>
                </FormField>
              </div>

              <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-end gap-3">
                <FormField label="Le client paie (XAF)">
                  <TextInput readOnly value="1 250 000" className="font-extrabold" />
                </FormField>
                <div className={cn('flex h-12 items-center', TEXT.muted)}><ArrowRight className="h-4 w-4" /></div>
                <FormField label="Le fournisseur reçoit (¥)">
                  <TextInput readOnly value="14 380" className="font-extrabold" />
                </FormField>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <p className={cn('text-[12px] tabular-nums', TEXT.muted)}>
                  Taux appliqué : <b className={TEXT.strong}>1M XAF = ¥11 504</b>
                  <span className="ml-1.5 rounded-full bg-[#EAE7FA] px-1.5 py-px text-[9px] font-extrabold uppercase text-[#5B4CC4] dark:bg-[#272252] dark:text-[#B5AAF0]">perso</span>
                  <span className="ml-1.5">· taux du jour ¥11 530</span>
                </p>
                <button type="button" className="text-[12px] font-bold" style={{ color: VIOLET }}>Modifier le taux</button>
              </div>
            </Card>

            {/* 2 · Destination */}
            <Card>
              <span className={cn('text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>2 · Destination</span>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {P_METHODS.map((x) => (
                  <button
                    key={x.m}
                    type="button"
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[12px] font-semibold',
                      x.m === 'alipay' ? PRIMARY_PILL : SOFT_PILL,
                    )}
                  >
                    <PaymentMethodLogo method={x.m} size={18} />
                    {x.label}
                  </button>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <SecLabel right={<button type="button" className="text-[12px] font-bold" style={{ color: VIOLET }}>+ Nouveau</button>}>
                    Carnet de Fatou · Alipay (3)
                  </SecLabel>
                  <div className="mt-2 space-y-2">
                    {[
                      { n: 'Zhang Wei 张伟', m: 'zw88@aliyun.com', sel: true },
                      { n: 'Shenzhen Kaida Electronics', m: 'ID 138 2244 9087' },
                      { n: 'Canton Fair Sourcing Ltd', m: 'QR enregistré' },
                    ].map((b) => (
                      <div
                        key={b.n}
                        className={cn('flex items-center gap-3 rounded-[22px] p-3 text-left', SURFACE.card, SURFACE.shadow)}
                        style={b.sel ? { boxShadow: `0 0 0 2px ${VIOLET}` } : undefined}
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[13px] font-extrabold" style={{ background: `${VIOLET}14`, color: VIOLET }}>
                          {b.n[0]}
                        </div>
                        <div className="min-w-0 flex-1 leading-[16px]">
                          <div className={cn('truncate text-[13px] font-bold', TEXT.strong)}>{b.n}</div>
                          <div className={cn('truncate text-[11px] tabular-nums', TEXT.muted)}>{b.m}</div>
                        </div>
                        {b.sel && <CheckCircle className="h-4 w-4 shrink-0" style={{ color: VIOLET }} />}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <FormField label="QR code Alipay" hint="Ctrl+V colle la capture — prioritaire sur l'ID">
                    <div className="flex h-[76px] items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-black/10 dark:border-white/10">
                      <Upload className={cn('h-4 w-4', TEXT.muted)} />
                      <span className={cn('text-[12px] font-bold', TEXT.muted)}>Coller / glisser le QR</span>
                    </div>
                  </FormField>
                  <div className={cn('flex items-center gap-2.5 rounded-2xl p-3', SURFACE.canvas)}>
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md" style={{ background: VIOLET }}>
                      <CheckCircle className="h-3 w-3 text-white" />
                    </span>
                    <div className="min-w-0 leading-[15px]">
                      <span className={cn('block text-[12px] font-bold', TEXT.strong)}>Bénéficiaire à compléter plus tard</span>
                      <span className={cn('block text-[11px]', TEXT.muted)}>Statut « Info manquante »</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Rail : récap vivant */}
          <Card>
            <SecLabel>Récapitulatif</SecLabel>
            <div className={cn('mt-3 rounded-2xl py-4 text-center', SURFACE.canvas)}>
              <Amount value="¥14 380" size="xl" />
              <div className={cn('mt-1 text-[12px] tabular-nums', TEXT.muted)}>1 250 000 XAF · Alipay</div>
            </div>
            <div className="mt-3 space-y-2 text-[13px]">
              <div className="flex justify-between"><span className={TEXT.muted}>Client</span><span className={cn('font-semibold', TEXT.strong)}>Fatou Ndiaye</span></div>
              <div className="flex justify-between"><span className={TEXT.muted}>Bénéficiaire</span><span className={cn('font-semibold', TEXT.strong)}>Zhang Wei 张伟</span></div>
              <div className="flex justify-between">
                <span className={TEXT.muted}>Taux</span>
                <span className={cn('font-semibold tabular-nums', TEXT.strong)}>
                  11 504 <span className="text-[10px] font-extrabold uppercase text-[#5B4CC4] dark:text-[#B5AAF0]">perso</span>
                </span>
              </div>
              <div className="my-1 border-t border-black/[0.06] dark:border-white/[0.08]" />
              <div className="flex justify-between"><span className={TEXT.muted}>Solde actuel</span><span className={cn('font-semibold tabular-nums', TEXT.strong)}>2 213 450 XAF</span></div>
              <div className="flex justify-between"><span className={TEXT.muted}>Après débit</span><span className="font-bold tabular-nums text-[#2E7D52] dark:text-[#7FCBA0]">963 450 XAF</span></div>
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-2xl bg-[#EAE7FA] p-3 dark:bg-[#272252]">
              <Info className="mt-px h-3.5 w-3.5 shrink-0 text-[#5B4CC4] dark:text-[#B5AAF0]" />
              <p className="text-[12px] leading-[16px] text-[#5B4CC4] dark:text-[#B5AAF0]">
                Le wallet est débité immédiatement. Un rejet rembourse automatiquement.
              </p>
            </div>
            <PrimaryPill className="mt-4 w-full bg-[#8B5CF6] text-white dark:bg-[#8B5CF6] dark:text-white">
              Confirmer le paiement
            </PrimaryPill>
            <SoftPill className="mt-2 w-full">Annuler</SoftPill>
          </Card>
        </div>
      </div>
    </Shell>
  );
}

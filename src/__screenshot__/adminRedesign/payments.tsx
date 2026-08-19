/**
 * ADMIN DESKTOP REDESIGN — module Paiements (mockups).
 *
 * Same archetype as deposits, instantiated for payments (02-foundation.md §4):
 *   workbench with beneficiary + both currencies + rate in the table,
 *   split detail whose verdict zone is the beneficiary's copy-perfect
 *   coordinates + payment proof, one-page create form with live recap rail.
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
  Wallet,
  CircleCheck,
  CircleDashed,
  ArrowRight,
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
  PaginationBar,
  KV,
  SectionLabel,
  FakeQR,
  type Tone,
} from './kit';

/* ── Method logos (text-mark stand-ins, brand colors) ───────────────────── */

const PM: Record<string, { label: string; short: string; color: string }> = {
  alipay: { label: 'Alipay', short: '支', color: '#1677FF' },
  wechat: { label: 'WeChat', short: '微', color: '#07C160' },
  bank: { label: 'Virement', short: '¥', color: '#8B5CF6' },
  cash: { label: 'Cash', short: '现', color: '#E0322B' },
};

function PmMark({ m, size = 18 }: { m: keyof typeof PM; size?: number }) {
  const p = PM[m];
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-[5px] font-black text-white" style={{ width: size, height: size, background: p.color, fontSize: Math.round(size * 0.58) }}>
      {p.short}
    </span>
  );
}

/* ── Fixtures ───────────────────────────────────────────────────────────── */

type PRow = {
  ref: string;
  client: string;
  benef: string;
  benefMeta: string;
  method: keyof typeof PM;
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

const PROWS: PRow[] = [
  { ref: 'BZ-PY-2026-1192', client: 'Jean-Paul Mbarga', benef: 'Guangzhou Hongfa Trade', benefMeta: 'Bank of China ·  6214 … 5588', method: 'bank', cny: '¥58 900', xaf: '5 110 000', rate: '11 525', proofs: 1, rel: '14 h', abs: 'hier 23:58', sla: 'overdue', status: 'Prêt à payer', tone: 'info' },
  { ref: 'BZ-PY-2026-1196', client: 'Awa Camara', benef: 'Lin Mei 林梅', benefMeta: 'WeChat · linmei_gz88', method: 'wechat', cny: '¥9 210', xaf: '798 800', rate: '11 530', proofs: 0, rel: '7 h', abs: '07:10', sla: 'aging', status: 'Prêt à payer', tone: 'info', hover: true },
  { ref: 'BZ-PY-2026-1204', client: 'Fatou Ndiaye', benef: 'Zhang Wei 张伟', benefMeta: 'Alipay · zw88@aliyun.com', method: 'alipay', cny: '¥14 380', xaf: '1 250 000', rate: '11 504', custom: true, proofs: 1, rel: '3 h', abs: '11:41', sla: 'fresh', status: 'Prêt à payer', tone: 'info', selected: true },
  { ref: 'BZ-PY-2026-1205', client: 'Ibrahim Touré', benef: 'Ibrahim Touré (le client)', benefMeta: 'Retrait cash · Guangzhou', method: 'cash', cny: '¥23 060', xaf: '2 000 000', rate: '11 530', proofs: 0, rel: '2 h', abs: '12:19', sla: 'fresh', status: 'Cash scanné', tone: 'pending' },
  { ref: 'BZ-PY-2026-1201', client: 'Clarisse Ngo Bell', benef: 'Shenzhen Kaida Electronics', benefMeta: 'Alipay · ID 138 2244 9087', method: 'alipay', cny: '¥31 120', xaf: '2 700 000', rate: '11 526', proofs: 2, rel: '5 h', abs: '09:20', sla: null, status: 'En cours', tone: 'pending' },
  { ref: 'BZ-PY-2026-1199', client: 'Mariam Koné', benef: 'Yiwu Sunrise Import-Export', benefMeta: 'Bank of China · 6217 …  0031', method: 'bank', cny: '¥120 400', xaf: '10 450 000', rate: '11 522', proofs: 3, rel: '6 h', abs: '08:05', sla: null, status: 'Effectué', tone: 'success' },
  { ref: 'BZ-PY-2026-1188', client: 'Moussa Bah', benef: '—', benefMeta: 'Infos bénéficiaire manquantes', method: 'wechat', cny: '¥4 610', xaf: '400 000', rate: '11 530', proofs: 0, rel: '1 j', abs: '18 août 15:44', sla: null, status: 'Info manquante', tone: 'danger' },
];

/** « Tous » — history rows appended for the density view. */
const PROWS_ALL: PRow[] = [
  ...PROWS,
  { ref: 'BZ-PY-2026-1195', client: 'Nadia Sow', benef: 'Foshan Meubles Co.', benefMeta: 'WeChat · fsmeubles2020', method: 'wechat', cny: '¥6 950', xaf: '602 800', rate: '11 530', proofs: 2, rel: '8 h', abs: '06:40', sla: null, status: 'Effectué', tone: 'success' },
  { ref: 'BZ-PY-2026-1194', client: 'Éric Etoundi', benef: 'Zhejiang Auto Parts', benefMeta: 'Bank of China · 6228 … 4410', method: 'bank', cny: '¥44 730', xaf: '3 880 000', rate: '11 528', proofs: 1, rel: '9 h', abs: '05:12', sla: null, status: 'Effectué', tone: 'success' },
  { ref: 'BZ-PY-2026-1193', client: 'Aminata Diop', benef: 'Wu Xia 吴霞', benefMeta: 'Alipay · wx_textile', method: 'alipay', cny: '¥2 310', xaf: '200 400', rate: '11 526', proofs: 1, rel: '12 h', abs: 'hier 23:05', sla: null, status: 'Refusé', tone: 'danger' },
  { ref: 'BZ-PY-2026-1191', client: 'Oumar Kanté', benef: 'Hunan Steel Trading', benefMeta: 'Bank of China · 6217 … 8802', method: 'bank', cny: '¥138 400', xaf: '12 010 000', rate: '11 524', proofs: 3, rel: '15 h', abs: 'hier 22:33', sla: null, status: 'Effectué', tone: 'success' },
  { ref: 'BZ-PY-2026-1190', client: 'Chantal Fouda', benef: 'Lin Mei 林梅', benefMeta: 'WeChat · linmei_gz88', method: 'wechat', cny: '¥11 530', xaf: '1 000 000', rate: '11 530', proofs: 2, rel: '16 h', abs: 'hier 21:58', sla: null, status: 'Effectué', tone: 'success' },
  { ref: 'BZ-PY-2026-1189', client: 'Fatou Ndiaye', benef: 'Zhang Wei 张伟', benefMeta: 'Alipay · zw88@aliyun.com', method: 'alipay', cny: '¥8 070', xaf: '700 000', rate: '11 530', proofs: 2, rel: '18 h', abs: 'hier 20:12', sla: null, status: 'Effectué', tone: 'success' },
];

/* ── Table ──────────────────────────────────────────────────────────────── */

function PaymentsTable({ compact, view = 'queue' }: { compact?: boolean; view?: 'queue' | 'all' }) {
  const rows = view === 'all' ? PROWS_ALL : PROWS;
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col overflow-hidden rounded-[14px]', D.surface, D.eCard)}>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-separate border-spacing-0">
          <thead className={cn('sticky top-0 z-10', D.surface2)}>
            <tr>
              {!compact && <Th sortable>Référence</Th>}
              <Th sortable>Client</Th>
              <Th>Bénéficiaire</Th>
              <Th align="right" sortable>Montant</Th>
              {!compact && <Th align="right">Taux</Th>}
              {!compact && <Th sortable sorted={view === 'all' ? 'desc' : 'asc'}>Créé</Th>}
              <Th>Statut</Th>
              {!compact && <Th align="right" className="w-[150px]" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.ref}
                className={cn(
                  'group transition-colors',
                  r.selected && compact
                    ? 'bg-[#EDEAFA]/60 shadow-[inset_2px_0_0_#8B5CF6] dark:bg-white/[0.06] dark:shadow-[inset_2px_0_0_#A99BF0]'
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
                          <Paperclip className="h-3 w-3" />{r.proofs}
                        </span>
                      )}
                    </span>
                  </Td>
                )}
                <Td className={cn('border-t', D.hairline)}>
                  <span className={cn('text-[13px] font-semibold', D.strong, compact && 'inline-block max-w-[120px] truncate align-middle')}>{r.client}</span>
                </Td>
                <Td className={cn('border-t', D.hairline)}>
                  <div className="flex items-center gap-2">
                    <PmMark m={r.method} />
                    <div className="leading-[16px]">
                      <div className={cn('truncate text-[12.5px] font-semibold', compact ? 'max-w-[150px]' : 'max-w-[190px]', r.benef === '—' ? D.muted : D.strong)}>{r.benef}</div>
                      <div className={cn('truncate text-[11px]', compact ? 'max-w-[150px]' : 'max-w-[190px]', r.benef === '—' ? 'font-semibold text-[#C0504D] dark:text-[#E79A9A]' : D.muted)}>{r.benefMeta}</div>
                    </div>
                  </div>
                </Td>
                <Td align="right" className={cn('border-t', D.hairline)}>
                  <div className="leading-[16px]">
                    <div className={cn('text-[13px] font-bold tabular-nums', D.strong)}>{r.cny}</div>
                    {!compact && <div className={cn('text-[11px] tabular-nums', D.muted)}>{r.xaf} XAF</div>}
                  </div>
                </Td>
                {!compact && (
                  <Td align="right" className={cn('border-t', D.hairline)}>
                    <span className={cn('inline-flex items-center gap-1 text-[12px] tabular-nums', D.body)}>
                      {r.rate}
                      {r.custom && <span className={cn('rounded-[4px] px-1 py-px text-[9.5px] font-extrabold uppercase', 'bg-[#EAE7FA] text-[#5B4CC4] dark:bg-[#272252] dark:text-[#B5AAF0]')}>perso</span>}
                    </span>
                  </Td>
                )}
                {!compact && (
                  <Td className={cn('border-t', D.hairline)}>
                    <Age rel={r.rel} abs={r.abs} level={r.sla} />
                  </Td>
                )}
                <Td className={cn('border-t', D.hairline)}>
                  <StatusPill tone={r.tone} label={r.status} />
                </Td>
                {!compact && (
                  <Td align="right" className={cn('border-t', D.hairline)}>
                    {r.hover ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Btn size="sm" color="#8B5CF6"><Play className="h-3 w-3" /> Traiter</Btn>
                        <IconBtn className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></IconBtn>
                      </span>
                    ) : (
                      <span className="inline-flex h-7 items-center opacity-0" aria-hidden>·</span>
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
    </div>
  );
}

function PWorkbenchTop({ compact, view = 'queue' }: { compact?: boolean; view?: 'queue' | 'all' }) {
  return (
    <>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className={cn('text-[20px] font-bold leading-[26px]', D.strong)}>Paiements</h2>
          <p className={cn('mt-0.5 text-[12px]', D.muted)}>
            5 872 paiements · <span className="font-semibold text-[#9A6B12] dark:text-[#E7C083]">5 à traiter</span> · <span className="font-semibold text-[#C0504D] dark:text-[#E79A9A]">1 bloqué (infos)</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Btn size="lg"><FileDown className="h-4 w-4" /> Export PDF</Btn>
          <Btn size="lg"><Layers className="h-4 w-4" /> Paiement groupé</Btn>
          <Btn variant="primary" size="lg"><Plus className="h-4 w-4" /> Nouveau paiement</Btn>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2.5">
        <QueueTabs
          tabs={[
            { label: 'À traiter', count: 5, active: view === 'queue' },
            { label: 'Info manquante', count: 1, tone: 'danger' },
            { label: 'En cours', count: 3 },
            { label: 'Tous', count: '5 872', active: view === 'all' },
          ]}
        />
        <div className="ml-auto flex items-center gap-2">
          <SearchField placeholder={compact ? 'Rechercher…' : 'Client, bénéficiaire, référence…'} wide={!compact} />
          <Select label="Méthode" value="Toutes" />
          <Select label="Période" value="30 jours" />
        </div>
      </div>
    </>
  );
}

/* ── Screen A — Workbench ───────────────────────────────────────────────── */

export function DpWorkbench() {
  return (
    <Shell active="Paiements" title="Paiements">
      <div className="flex h-full flex-col px-6 pb-6 pt-5">
        <PWorkbenchTop view="all" />
        <div className="mt-3 flex min-h-0 flex-1 flex-col">
          <PaymentsTable view="all" />
        </div>
      </div>
    </Shell>
  );
}

/* ── Detail panel ───────────────────────────────────────────────────────── */

function CopyRow({ k, v, mono, accent }: { k: string; v: string; mono?: boolean; accent?: string }) {
  return (
    <div className={cn('flex h-9 items-center justify-between rounded-[8px] px-2.5', D.surface2)}>
      <span className={cn('text-[11.5px]', D.muted)}>{k}</span>
      <span className={cn('inline-flex items-center gap-1.5 text-[13px] font-semibold tabular-nums', D.strong, mono && cn(D.mono, 'text-[12.5px]'))} style={accent ? { color: accent } : undefined}>
        {v}
        <Copy className={cn('h-3 w-3', D.muted)} />
      </span>
    </div>
  );
}

function TimelineStep({ label, meta, state }: { label: string; meta?: string; state: 'done' | 'current' | 'todo' }) {
  return (
    <div className="flex items-center gap-2">
      {state === 'done' ? (
        <CircleCheck className="h-3.5 w-3.5 shrink-0 text-[#10B981]" />
      ) : state === 'current' ? (
        <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
          <span className="h-2.5 w-2.5 rounded-full bg-[#8B5CF6] ring-4 ring-[#8B5CF6]/15" />
        </span>
      ) : (
        <CircleDashed className={cn('h-3.5 w-3.5 shrink-0', D.muted)} />
      )}
      <span className={cn('text-[12px] font-semibold', state === 'todo' ? D.muted : D.strong)}>{label}</span>
      {meta && <span className={cn('ml-auto text-[11px] tabular-nums', D.muted)}>{meta}</span>}
    </div>
  );
}

export function PaymentPanel() {
  return (
    <aside className={cn('flex w-[560px] shrink-0 flex-col overflow-hidden rounded-[14px]', D.surface, D.eCard)}>
      <div className={cn('flex items-center gap-2 border-b px-4 py-3', D.hairline)}>
        <span className={cn('whitespace-nowrap text-[12.5px] font-bold', D.mono, D.strong)}>BZ-PY-2026-1204</span>
        <StatusPill tone="info" label="Prêt à payer" />
        <span className="whitespace-nowrap text-[11px] font-bold tabular-nums text-[#2E7D52] dark:text-[#7FCBA0]">3 h</span>
        <div className="ml-auto flex items-center gap-1.5">
          <Btn color="#8B5CF6" size="sm"><Play className="h-3 w-3" /> Passer en cours</Btn>
          <Btn variant="danger" size="sm">Rejeter</Btn>
          <IconBtn className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></IconBtn>
          <IconBtn className="h-7 w-7"><X className="h-4 w-4" /></IconBtn>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {/* Money summary — both legs + rate, one line each */}
        <div className="grid grid-cols-3 gap-3">
          <div className={cn('rounded-[10px] px-3 py-2', D.surface2)}>
            <SectionLabel>Fournisseur reçoit</SectionLabel>
            <div className={cn('mt-0.5 text-[19px] font-extrabold leading-[24px] tabular-nums tracking-tight', D.strong)}>¥14 380</div>
          </div>
          <div className={cn('rounded-[10px] px-3 py-2', D.surface2)}>
            <SectionLabel>Client débité</SectionLabel>
            <div className={cn('mt-0.5 text-[15px] font-bold leading-[24px] tabular-nums', D.strong)}>1 250 000 <span className={cn('text-[11px]', D.muted)}>XAF</span></div>
          </div>
          <div className={cn('rounded-[10px] px-3 py-2', D.surface2)}>
            <SectionLabel>Taux</SectionLabel>
            <div className="mt-0.5 flex items-center gap-1.5 leading-[24px]">
              <span className={cn('text-[15px] font-bold tabular-nums', D.strong)}>11 504</span>
              <span className={cn('rounded-[4px] px-1 py-px text-[9.5px] font-extrabold uppercase', 'bg-[#EAE7FA] text-[#5B4CC4] dark:bg-[#272252] dark:text-[#B5AAF0]')}>perso</span>
            </div>
          </div>
        </div>

        {/* Verdict zone: the coordinates the operator transcribes */}
        <div className="mt-3 grid grid-cols-[1fr_124px] items-start gap-3.5">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <SectionLabel>Bénéficiaire · <span style={{ color: '#1677FF' }}>Alipay</span></SectionLabel>
              <button type="button" className={cn('text-[11.5px] font-bold', D.accent)}>Modifier</button>
            </div>
            <div className="space-y-1.5">
              <CopyRow k="Nom" v="Zhang Wei 张伟" />
              <CopyRow k="Alipay ID" v="zw88@aliyun.com" mono accent="#1677FF" />
              <CopyRow k="Téléphone" v="+86 138 0219 4471" mono />
            </div>
          </div>
          <div>
            <SectionLabel className="mb-1.5">QR code</SectionLabel>
            <FakeQR size={124} color="#1677FF" />
          </div>
        </div>

        {/* Payment proof slot — the completion requirement, stated */}
        <div className={cn('mt-3 flex items-center justify-between rounded-[10px] border-2 border-dashed px-3 py-2', D.hairline, D.surface2)}>
          <div className="flex items-center gap-2">
            <Upload className={cn('h-4 w-4', D.muted)} />
            <div>
              <p className={cn('text-[12.5px] font-bold', D.strong)}>Preuve de paiement admin</p>
              <p className={cn('text-[11px]', D.muted)}>Requise pour « Valider » — Ctrl+V colle une capture</p>
            </div>
          </div>
          <Btn size="sm">Ajouter</Btn>
        </div>

        {/* Facts */}
        <div className={cn('mt-3 grid grid-cols-3 gap-x-4 gap-y-2.5 border-t pt-3', D.hairline)}>
          <KV k="Client" v={<span className={D.accent}>Fatou Ndiaye</span>} />
          <KV k="Solde après débit" v="963 450 XAF" />
          <KV k="Créé le" v="19 août, 11:41" />
          <KV k="Créé par" v="Nelson E. (admin)" />
          <KV k="Carnet" v="Zhang Wei · enregistré" />
          <KV k="Lot" v="—" />
        </div>

        {/* Timeline */}
        <div className={cn('mt-3 border-t pt-3', D.hairline)}>
          <SectionLabel className="mb-1.5">Suivi</SectionLabel>
          <div className="space-y-1.5">
            <TimelineStep state="done" label="Paiement créé — wallet débité" meta="11:41" />
            <TimelineStep state="done" label="Bénéficiaire complet" meta="11:41" />
            <TimelineStep state="current" label="Prêt à payer" />
            <TimelineStep state="todo" label="Traitement (Alipay)" />
            <TimelineStep state="todo" label="Effectué — preuve envoyée au client" />
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ── Screen B — Split ───────────────────────────────────────────────────── */

export function DpSplit() {
  return (
    <Shell active="Paiements" title="Paiements">
      <div className="flex h-full flex-col px-6 pb-6 pt-5">
        <PWorkbenchTop compact />
        <div className="mt-3 flex min-h-0 flex-1 gap-4">
          <PaymentsTable compact />
          <PaymentPanel />
        </div>
      </div>
    </Shell>
  );
}

/* ── Screen C — Create ──────────────────────────────────────────────────── */

function Field({ label, children, hint, className }: { label: React.ReactNode; children: React.ReactNode; hint?: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className={cn('text-[12.5px] font-semibold', D.strong)}>{label}</label>
      <div className="mt-1">{children}</div>
      {hint && <p className={cn('mt-1 text-[11.5px]', D.muted)}>{hint}</p>}
    </div>
  );
}

function InputBox({ children, focus, className }: { children: React.ReactNode; focus?: boolean; className?: string }) {
  return (
    <div className={cn('flex h-9 items-center justify-between rounded-[8px] px-3 text-[13.5px]', D.surface, focus ? 'ring-2 ring-[#8B5CF6]/40' : 'ring-1 ring-inset ring-[#141029]/[0.09] dark:ring-white/[0.09]', className)}>
      {children}
    </div>
  );
}

export function DpCreate() {
  return (
    <Shell active="Paiements" title="Paiements · Nouveau">
      <div className="h-full overflow-y-auto px-6 pb-6 pt-5">
        <div className="mx-auto max-w-[1080px]">
          <div className="flex items-center gap-2">
            <span className={cn('text-[12px] font-semibold', D.muted)}>Paiements</span>
            <ChevronRight className={cn('h-3 w-3', D.muted)} />
            <h2 className={cn('text-[20px] font-bold leading-[26px]', D.strong)}>Nouveau paiement</h2>
          </div>

          <div className="mt-4 grid grid-cols-[1fr_340px] items-start gap-5">
            <div className="space-y-4">
              {/* 1 · Money */}
              <section className={cn('rounded-[14px] p-4', D.surface, D.eCard)}>
                <SectionLabel>1 · Client & montant</SectionLabel>
                <div className="mt-3 grid grid-cols-2 gap-3.5">
                  <Field label="Client" hint={<span className="inline-flex items-center gap-1"><Wallet className="h-3 w-3" /> Solde : <b className={cn('tabular-nums', D.body)}>2 213 450 XAF</b></span>}>
                    <InputBox>
                      <span className="inline-flex items-center gap-2">
                        <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold', 'bg-[#EDEAFA] text-[#2C2740] dark:bg-[#2F2C3D] dark:text-[#E7E5F0]')}>FN</span>
                        <span className={cn('font-semibold', D.strong)}>Fatou Ndiaye</span>
                      </span>
                      <ChevronDown className={cn('h-4 w-4', D.muted)} />
                    </InputBox>
                  </Field>
                  <Field label="Date de l'opération">
                    <InputBox>
                      <span className={cn('font-semibold', D.strong)}>Maintenant</span>
                      <span className={cn('text-[11.5px] font-semibold', D.accent)}>Antidater</span>
                    </InputBox>
                  </Field>
                </div>

                <div className="mt-3.5 grid grid-cols-[1fr_auto_1fr] items-end gap-3">
                  <Field label="Le client paie (XAF)">
                    <InputBox focus>
                      <span className={cn('text-[16px] font-bold tabular-nums', D.strong)}>1 250 000</span>
                      <span className={cn('text-[11px] font-semibold', D.muted)}>XAF</span>
                    </InputBox>
                  </Field>
                  <div className={cn('flex h-9 items-center', D.muted)}><ArrowRight className="h-4 w-4" /></div>
                  <Field label="Le fournisseur reçoit (¥)">
                    <InputBox>
                      <span className={cn('text-[16px] font-bold tabular-nums', D.strong)}>14 380</span>
                      <span className={cn('text-[11px] font-semibold', D.muted)}>CNY</span>
                    </InputBox>
                  </Field>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <p className={cn('text-[11.5px] tabular-nums', D.muted)}>
                    Taux appliqué : <b className={D.body}>1M XAF = ¥11 504</b>
                    <span className={cn('ml-1.5 rounded-[4px] px-1 py-px text-[9.5px] font-extrabold uppercase', 'bg-[#EAE7FA] text-[#5B4CC4] dark:bg-[#272252] dark:text-[#B5AAF0]')}>perso</span>
                    <span className="ml-1.5">· taux du jour ¥11 530</span>
                  </p>
                  <span className={cn('text-[11.5px] font-bold', D.accent)}>Modifier le taux</span>
                </div>
              </section>

              {/* 2 · Destination */}
              <section className={cn('rounded-[14px] p-4', D.surface, D.eCard)}>
                <SectionLabel>2 · Destination</SectionLabel>
                <div className="mt-3 flex items-center gap-1.5">
                  {(['alipay', 'wechat', 'bank', 'cash'] as const).map((m) => (
                    <span
                      key={m}
                      className={cn(
                        'inline-flex h-8 items-center gap-1.5 rounded-[8px] px-3 text-[12.5px] font-bold',
                        m === 'alipay' ? 'bg-[#1C1B22] text-white dark:bg-[#F2F1F7] dark:text-[#1B1A24]' : cn(D.surface2, D.body, 'ring-1 ring-inset ring-[#141029]/[0.06] dark:ring-white/[0.07]'),
                      )}
                    >
                      <PmMark m={m} size={16} />
                      {PM[m].label}
                    </span>
                  ))}
                </div>

                <div className="mt-3.5 grid grid-cols-2 gap-3.5">
                  <div>
                    <div className="flex items-center justify-between">
                      <label className={cn('text-[12.5px] font-semibold', D.strong)}>Carnet de Fatou · Alipay (3)</label>
                      <span className={cn('text-[11.5px] font-bold', D.accent)}>+ Nouveau</span>
                    </div>
                    <div className="mt-1.5 space-y-1.5">
                      {[
                        { n: 'Zhang Wei 张伟', m: 'zw88@aliyun.com', sel: true },
                        { n: 'Shenzhen Kaida Electronics', m: 'ID 138 2244 9087' },
                        { n: 'Canton Fair Sourcing Ltd', m: 'QR enregistré' },
                      ].map((b) => (
                        <div
                          key={b.n}
                          className={cn(
                            'flex items-center gap-2.5 rounded-[8px] px-2.5 py-2',
                            b.sel ? 'bg-[#EDEAFA]/70 ring-2 ring-[#8B5CF6]/50 dark:bg-white/[0.06]' : cn(D.surface2, 'ring-1 ring-inset ring-[#141029]/[0.05] dark:ring-white/[0.06]'),
                          )}
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: '#1677FF14', color: '#1677FF' }}>{b.n[0]}</span>
                          <div className="min-w-0 leading-[15px]">
                            <div className={cn('truncate text-[12.5px] font-bold', D.strong)}>{b.n}</div>
                            <div className={cn('truncate text-[11px] tabular-nums', D.muted)}>{b.m}</div>
                          </div>
                          {b.sel && <CircleCheck className="ml-auto h-4 w-4 shrink-0 text-[#8B5CF6]" />}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    <Field label="QR code Alipay" hint="Ctrl+V colle la capture — prioritaire sur l'ID">
                      <div className={cn('flex h-[72px] items-center justify-center gap-2 rounded-[8px] border-2 border-dashed', D.hairline, D.surface2)}>
                        <Upload className={cn('h-4 w-4', D.muted)} />
                        <span className={cn('text-[12px] font-semibold', D.body)}>Coller / glisser le QR</span>
                      </div>
                    </Field>
                    <label className="flex items-center gap-2">
                      <span className="flex h-4 w-4 items-center justify-center rounded-[4px] bg-[#8B5CF6]"><CircleCheck className="h-3 w-3 text-white" /></span>
                      <span className={cn('text-[12px] font-semibold', D.body)}>Bénéficiaire à compléter plus tard</span>
                      <span className={cn('text-[11px]', D.muted)}>(statut « Info manquante »)</span>
                    </label>
                  </div>
                </div>
              </section>
            </div>

            {/* Rail: live recap */}
            <div className="space-y-4">
              <section className={cn('rounded-[14px] p-4', D.surface, D.eCard)}>
                <SectionLabel>Récapitulatif</SectionLabel>
                <div className={cn('mt-3 rounded-[10px] px-3 py-3 text-center', D.surface2)}>
                  <div className={cn('text-[26px] font-extrabold tracking-tight tabular-nums', D.strong)}>¥14 380</div>
                  <div className={cn('mt-0.5 text-[12px] tabular-nums', D.muted)}>1 250 000 XAF · Alipay</div>
                </div>
                <div className="mt-3 space-y-1.5 text-[12.5px]">
                  <div className="flex justify-between"><span className={D.muted}>Client</span><span className={cn('font-semibold', D.strong)}>Fatou Ndiaye</span></div>
                  <div className="flex justify-between"><span className={D.muted}>Bénéficiaire</span><span className={cn('font-semibold', D.strong)}>Zhang Wei 张伟</span></div>
                  <div className="flex justify-between"><span className={D.muted}>Taux</span><span className={cn('font-semibold tabular-nums', D.strong)}>11 504 <span className="text-[10px] font-extrabold uppercase text-[#5B4CC4] dark:text-[#B5AAF0]">perso</span></span></div>
                  <div className={cn('my-2 border-t', D.hairline)} />
                  <div className="flex justify-between"><span className={D.muted}>Solde actuel</span><span className={cn('font-semibold tabular-nums', D.body)}>2 213 450 XAF</span></div>
                  <div className="flex justify-between"><span className={D.muted}>Après débit</span><span className="font-bold tabular-nums text-[#2E7D52] dark:text-[#7FCBA0]">963 450 XAF</span></div>
                </div>
                <div className={cn('mt-3 flex items-start gap-2 rounded-[8px] px-2.5 py-2 text-[11.5px] leading-[16px]', 'bg-[#EAE7FA] text-[#5B4CC4] dark:bg-[#272252] dark:text-[#B5AAF0]')}>
                  <Info className="mt-px h-3.5 w-3.5 shrink-0" />
                  Le wallet est débité immédiatement. Un rejet rembourse automatiquement.
                </div>
                <Btn size="lg" color="#8B5CF6" className="mt-3.5 w-full font-bold">Créer le paiement <span className="ml-1 text-[11px] opacity-80">⌘⏎</span></Btn>
                <Btn variant="ghost" className="mt-1.5 w-full">Annuler</Btn>
              </section>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

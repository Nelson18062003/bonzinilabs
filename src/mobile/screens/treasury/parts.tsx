/**
 * Trésorerie mobile v2 — les briques propres au module (maquettes
 * docs/mobile-refonte/maquettes-v2/07-tresorerie et 05-tresorerie-taux).
 *
 * Mêmes jetons que le kit (`@/mobile/designKit`) : blanc, filet #D9D9D9,
 * rayon 8, encre #2C2C2C, la couleur au statut et aux vrais logos. Ce qui
 * pourrait servir ailleurs (graphe à barres groupées, pages à balayer,
 * champ de motif, puce de période) est à remonter dans le kit.
 */
import * as React from 'react';
import { forwardRef, useEffect, useRef, useState } from 'react';
import { Banknote, CalendarDays, Check, ChevronRight, Copy, Download, Landmark, Loader2, Smartphone } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { cn } from '@/lib/utils';
import { toBusinessDayString, type PresetId } from '@/lib/analytics/dateRange';
import {
  BigButton, BottomSheet, Chip, ConfirmSheet, FOCUS_RING, IconCircle, ItemRow, MethodCircle, SURFACE, TEXT, Tag, TextArea, TextInput,
  type Tone,
} from '@/mobile/designKit';
import { DepositBankLogo, DepositFamilyLogo } from '@/mobile/components/deposits/DepositLogos';
import { PhoneInputWithCountry } from '@/components/form';
import { useCreateCounterparty, useInventorySnapshots, useTreasuryAccountBalances, useTreasuryLedger, type LedgerEntry } from '@/hooks/useTreasury';
import { canInventory } from '@/desktop/screens/treasury/treasuryLabels';
import { fmtNum } from '@/desktop/screens/treasury/treasuryFormat';
import { receiptNumber, type ReceiptData } from '@/desktop/screens/treasury/receiptData';
import type { CounterpartyFilter } from '@/desktop/screens/treasury/treasuryNav';
import type { OperationView } from '@/desktop/screens/treasury/operationView';
import {
  REASON_MIN, agoLabel, balancesAfter, fmtCur, fmtUsdt, setPeriodCustom, setPeriodPreset, signed, tp, usePeriod, whenFull, withCur, type ReceiptActions,
} from './treasuryMobile';

/* ── Logos ──────────────────────────────────────────────────────────────── */
export function TetherCircle({ size = 44 }: { size?: number }) {
  return (
    <span role="img" aria-label="USDT" className="flex shrink-0 items-center justify-center rounded-full" style={{ width: size, height: size, background: '#26A17B' }}>
      <svg viewBox="0 0 24 24" style={{ width: size * 0.56, height: size * 0.56 }} aria-hidden>
        <path d="M5.5 5.2h13v2.9h-5v2.1c3 .2 5.3.9 5.3 1.8s-2.3 1.6-5.3 1.8v5.4h-3.1V13.8c-3-.2-5.3-.9-5.3-1.8s2.3-1.6 5.3-1.8V8.1h-4.9z" fill="#fff" />
        <path d="M6.6 12c0 .6 2.4 1.1 5.4 1.1s5.4-.5 5.4-1.1" fill="none" stroke="#26A17B" strokeWidth="1" />
      </svg>
    </span>
  );
}

export function BinanceCircle({ size = 44 }: { size?: number }) {
  return (
    <span role="img" aria-label="Binance" className="flex shrink-0 items-center justify-center rounded-full" style={{ width: size, height: size, background: '#1E2329' }}>
      <svg viewBox="0 0 24 24" style={{ width: size * 0.58, height: size * 0.58 }} aria-hidden>
        <g fill="#F3BA2F">
          <path d="M12 9.6 14.4 12 12 14.4 9.6 12z" />
          <path d="M7.9 10.3 9.6 12l-1.7 1.7L6.2 12zM16.1 10.3l1.7 1.7-1.7 1.7-1.7-1.7z" />
          <path d="M12 3.6l4.3 4.3-1.7 1.7L12 7 9.4 9.6 7.7 7.9z" />
          <path d="M12 20.4l-4.3-4.3 1.7-1.7L12 17l2.6-2.6 1.7 1.7z" />
        </g>
      </svg>
    </span>
  );
}

/** Le vrai logo d'un compte de trésorerie (banque, mobile money, Alipay, WeChat, pool USDT, caisse). */
export function AccountLogo({
  kind, label, currency, size = 44,
}: { kind?: string | null; label?: string | null; currency?: string | null; size?: number }) {
  const l = (label ?? '').toLowerCase();
  const r = size / 2;
  if (kind === 'alipay' || l.includes('alipay')) return <MethodCircle method="alipay" size={size} />;
  if (kind === 'wechat' || l.includes('wechat')) return <MethodCircle method="wechat" size={size} />;
  if (kind === 'crypto_pool' || currency === 'USDT') return l.includes('binance') ? <BinanceCircle size={size} /> : <TetherCircle size={size} />;
  if (l.includes('afriland')) return <DepositBankLogo bank="AFRILAND" size={size} radius={r} />;
  if (l.includes('ecobank')) return <DepositBankLogo bank="ECOBANK" size={size} radius={r} />;
  if (l.includes('uba')) return <DepositBankLogo bank="UBA" size={size} radius={r} />;
  if (l.includes('cca')) return <DepositBankLogo bank="CCA" size={size} radius={r} />;
  if (l.includes('orange')) {
    // Le logo carré d'Orange, posé dans un rond blanc à filet (comme les banques).
    return (
      <span className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#D9D9D9] bg-white" style={{ width: size, height: size }}>
        <DepositFamilyLogo family="ORANGE_MONEY" size={Math.round(size * 0.62)} radius={4} />
      </span>
    );
  }
  if (l.includes('mtn')) return <DepositFamilyLogo family="MTN_MONEY" size={size} radius={r} />;
  if (l.includes('wave')) return <DepositFamilyLogo family="WAVE" size={size} radius={r} />;
  if (kind === 'cash') return currency === 'CNY' ? <MethodCircle method="cash" size={size} /> : <IconCircle icon={Banknote} />;
  if (kind === 'mobile_money') return <IconCircle icon={Smartphone} />;
  return <IconCircle icon={Landmark} />;
}

/* ── Petits textes ──────────────────────────────────────────────────────── */
/** L'étiquette en capitales des maquettes (« PAYÉ DEPUIS », « RÉCENTS »). */
export function CapsLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('text-[15px] font-semibold uppercase tracking-[0.06em]', TEXT.muted, className)}>{children}</div>;
}

/** Montant fort et sa ligne grise dessous (contre-valeur, solde après, taux). */
export function AmountStack({ main, sub, strike, tone }: { main: React.ReactNode; sub?: React.ReactNode; strike?: boolean; tone?: Tone }) {
  return (
    <span className="shrink-0 text-right">
      <span className={cn('block text-[17px] font-bold tabular-nums', TEXT.strong, strike && 'line-through opacity-60')}>{main}</span>
      {sub != null && (tone ? <Tag tone={tone} className="mt-[5px]">{sub}</Tag> : <span className={cn('mt-0.5 block text-[15px] tabular-nums', TEXT.muted)}>{sub}</span>)}
    </span>
  );
}

/** Des cases chiffrées 2 × 2 (fiche contrepartie, inventaires passés). */
export function StatGrid({ items, className }: { items: Array<{ label: React.ReactNode; value: React.ReactNode }>; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 gap-2.5', className)}>
      {items.map((it, i) => (
        <div key={i} className={cn('rounded-lg border px-4 py-3', SURFACE.divider)}>
          <div className={cn('text-[15px]', TEXT.muted)}>{it.label}</div>
          <div className={cn('mt-1 truncate text-[22px] font-bold tabular-nums', TEXT.strong)}>{it.value}</div>
        </div>
      ))}
    </div>
  );
}

/** Le bandeau de totaux en 2 ou 3 colonnes (opérations, grand livre). */
export function TotalsStrip({ items, className }: { items: Array<{ label: React.ReactNode; value: React.ReactNode }>; className?: string }) {
  return (
    <div className={cn('grid overflow-hidden rounded-lg border', SURFACE.divider, className)} style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((it, i) => (
        <div key={i} className={cn('min-w-0 px-3 py-2.5', i > 0 && cn('border-l', SURFACE.divider))}>
          <div className={cn('truncate text-[14px]', TEXT.muted)}>{it.label}</div>
          <div className={cn('mt-0.5 truncate text-[16px] font-bold tabular-nums', TEXT.strong)}>{it.value}</div>
        </div>
      ))}
    </div>
  );
}

/** La pastille de période (« Octobre 2026 ») : ouvre la feuille de période. */
export function PeriodChip({ onClick, className }: { onClick: () => void; className?: string }) {
  const p = usePeriod();
  return <Chip icon={CalendarDays} label={p.label} onClick={onClick} className={className} />;
}

/* ── La feuille de période ───────────────────────────────────────────────
 * Les préréglages de l'ordinateur (mois en cours, mois dernier…) et ceux de
 * l'ancien mobile (7 j / 30 j / 90 j / Tout / Perso, jour, trimestre, année). */
const PERIOD_CHOICES: Array<{ preset: PresetId; label: string }> = [
  { preset: 'today', label: 'Aujourd’hui' },
  { preset: 'last_7_days', label: '7 j' },
  { preset: 'last_30_days', label: '30 j' },
  { preset: 'last_90_days', label: '90 j' },
  { preset: 'this_week', label: 'Semaine' },
  { preset: 'this_month', label: 'Ce mois' },
  { preset: 'last_month', label: 'Mois dernier' },
  { preset: 'this_quarter', label: 'Trimestre' },
  { preset: 'this_year', label: 'Année' },
  { preset: 'all_time', label: 'Tout' },
];

export function PeriodSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const p = usePeriod();
  const [custom, setCustom] = useState(p.preset === 'custom');
  const [from, setFrom] = useState(() => toBusinessDayString(p.range.from));
  const [to, setTo] = useState(() => toBusinessDayString(p.range.to));
  useEffect(() => {
    if (!open) return;
    setCustom(p.preset === 'custom');
    setFrom(toBusinessDayString(p.range.from));
    setTo(toBusinessDayString(p.range.to));
  }, [open, p.preset, p.range]);
  const pick = (preset: PresetId) => {
    setPeriodPreset(preset);
    onClose();
  };
  const okCustom = !!from && !!to && from <= to;
  return (
    <BottomSheet open={open} onClose={onClose}>
      <h3 className={cn('text-[22px] font-semibold', TEXT.strong)}>Période</h3>
      <div className="mt-4 flex flex-wrap gap-2">
        {PERIOD_CHOICES.map((c) => (
          <Chip key={c.preset} label={c.label} active={!custom && p.preset === c.preset} onClick={() => pick(c.preset)} />
        ))}
        <Chip label="Perso" active={custom} onClick={() => setCustom(true)} />
      </div>
      {custom && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <DayField label="Du" value={from} onChange={setFrom} />
            <DayField label="Au" value={to} onChange={setTo} />
          </div>
          <BigButton
            className="mt-5"
            disabled={!okCustom}
            onClick={() => {
              setPeriodCustom(from, to);
              onClose();
            }}
          >
            Appliquer
          </BigButton>
        </>
      )}
    </BottomSheet>
  );
}

function DayField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className={cn('mb-1.5 block text-[15px]', TEXT.muted)}>{label}</span>
      <TextInput type="date" value={value} onChange={(e) => onChange(e.target.value)} className="h-14 text-[17px]" />
    </label>
  );
}

/* ── Un champ de saisie avec son étiquette en capitales ─────────────────── */
export function FieldBlock({ label, htmlFor, children, className }: { label: React.ReactNode; htmlFor?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-2 block">
        <CapsLabel>{label}</CapsLabel>
      </label>
      {children}
    </div>
  );
}

/** Le motif obligatoire (ajuster, écart d'inventaire, annuler) : 10 caractères au moins, compteur. */
export function ReasonField({
  id, value, onChange, placeholder, label = 'Motif', autoFocus,
}: { id: string; value: string; onChange: (v: string) => void; placeholder?: string; label?: React.ReactNode; autoFocus?: boolean }) {
  const n = value.trim().length;
  return (
    <FieldBlock label={label} htmlFor={id}>
      <TextArea id={id} value={value} onChange={(e) => onChange(e.target.value)} rows={3} placeholder={placeholder} autoFocus={autoFocus} className="text-[17px]" />
      <div className={cn('mt-1.5 flex justify-between text-[15px]', n > 0 && n < REASON_MIN ? 'text-[#900B09] dark:text-[#FCB3AD]' : TEXT.muted)}>
        <span>{REASON_MIN} caractères au moins</span>
        <span className="tabular-nums">{n}</span>
      </div>
    </FieldBlock>
  );
}

/* ── Une liste à choisir, en feuille (compte, fournisseur, canal, tri) ──── */
export interface PickOption<T extends string> {
  value: T;
  label: React.ReactNode;
  hint?: React.ReactNode;
  leading?: React.ReactNode;
  disabled?: boolean;
  tag?: { tone: Tone; label: React.ReactNode };
}

export function PickerSheet<T extends string>({
  open, onClose, title, options, value, onPick, footer,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  options: PickOption<T>[];
  value?: T | null;
  onPick: (v: T) => void;
  footer?: React.ReactNode;
}) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <h3 className={cn('mb-2 text-[22px] font-semibold', TEXT.strong)}>{title}</h3>
      <PickList options={options} value={value} onPick={(v) => { onPick(v); onClose(); }} />
      {footer}
    </BottomSheet>
  );
}

export function PickList<T extends string>({ options, value, onPick }: { options: PickOption<T>[]; value?: T | null; onPick: (v: T) => void }) {
  return (
    <div>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={o.disabled}
          onClick={() => onPick(o.value)}
          className={cn('flex min-h-[60px] w-full items-center gap-3.5 border-b py-2.5 text-left last:border-b-0 disabled:opacity-40', SURFACE.divider, FOCUS_RING, 'active:bg-[#F5F5F5] dark:active:bg-[#383838]')}
        >
          {o.leading}
          <span className="min-w-0 flex-1">
            <span className={cn('block truncate text-[17px] font-semibold', TEXT.strong)}>{o.label}</span>
            {o.hint != null && <span className={cn('mt-0.5 block truncate text-[15px]', TEXT.muted)}>{o.hint}</span>}
          </span>
          {o.tag && <Tag tone={o.tag.tone}>{o.tag.label}</Tag>}
          {value === o.value && <Check className={cn('h-5 w-5 shrink-0', TEXT.strong)} strokeWidth={2.5} />}
        </button>
      ))}
    </div>
  );
}

/* ── Date, référence, note d'une saisie ─────────────────────────────────── */
function isoToLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DetailsSheet({
  open, onClose, at, onAt, refValue, onRef, notes, onNotes,
}: {
  open: boolean;
  onClose: () => void;
  at: string;
  onAt: (iso: string) => void;
  refValue: string;
  onRef: (v: string) => void;
  notes: string;
  onNotes: (v: string) => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <h3 className={cn('text-[22px] font-semibold', TEXT.strong)}>Date et référence</h3>
      <div className="mt-4 space-y-4">
        <FieldBlock label="Date et heure" htmlFor="tr-at">
          <TextInput
            id="tr-at"
            type="datetime-local"
            value={isoToLocal(at)}
            max={isoToLocal(new Date().toISOString())}
            onChange={(e) => {
              const d = new Date(e.target.value);
              if (!Number.isNaN(d.getTime())) onAt(d.toISOString());
            }}
            className="h-14 text-[17px]"
          />
        </FieldBlock>
        <FieldBlock label="Référence · facultatif" htmlFor="tr-ref">
          <TextInput id="tr-ref" value={refValue} onChange={(e) => onRef(e.target.value)} placeholder="N° de transaction, hash…" className="h-14 text-[17px]" />
        </FieldBlock>
        <FieldBlock label="Note · facultatif" htmlFor="tr-notes">
          <TextArea id="tr-notes" value={notes} onChange={(e) => onNotes(e.target.value)} rows={3} className="text-[17px]" />
        </FieldBlock>
      </div>
      <BigButton className="mt-5" onClick={onClose}>OK</BigButton>
    </BottomSheet>
  );
}

/** La ligne « Date · réf. » d'une confirmation : « Maintenant · Ajouter » (ouvre la feuille des détails). */
export function DateRefValue({ when, refText, onEdit }: { when: string; refText: string; onEdit: () => void }) {
  return (
    <span className="whitespace-nowrap">
      {when} ·{' '}
      <button type="button" onClick={onEdit} className={cn('rounded font-semibold underline underline-offset-[3px]', FOCUS_RING)}>
        {refText || 'Ajouter'}
      </button>
    </span>
  );
}

/** « Abandonner la saisie ? » — le retour d'une saisie entamée. */
export function AbandonSheet({ open, onClose, onLeave }: { open: boolean; onClose: () => void; onLeave: () => void }) {
  return (
    <ConfirmSheet
      open={open}
      onClose={onClose}
      title="Abandonner la saisie ?"
      subtitle="Ce qui est tapé sera perdu."
      confirmLabel="Abandonner"
      cancelLabel="Continuer la saisie"
      onConfirm={onLeave}
    />
  );
}

/* ── Nouveau fournisseur / acheteur rapide (nom + téléphone) ────────────── */
export function QuickCounterpartySheet({
  open, onClose, type, onCreated,
}: { open: boolean; onClose: () => void; type: CounterpartyFilter; onCreated: (id: string) => void }) {
  const create = useCreateCounterparty();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setName('');
      setPhone(null);
    }
  }, [open]);
  const ok = name.trim().length >= 2;
  const supplier = type === 'usdt_supplier';
  const save = () => {
    if (!ok || create.isPending) return;
    create.mutate(
      { type, display_name: name.trim(), phone: phone ?? undefined },
      {
        onSuccess: (r) => {
          if (r.id) onCreated(r.id);
          onClose();
        },
      },
    );
  };
  return (
    <BottomSheet open={open} onClose={create.isPending ? () => undefined : onClose}>
      <h3 className={cn('text-[22px] font-semibold', TEXT.strong)}>{supplier ? 'Nouveau fournisseur' : 'Nouvel acheteur'}</h3>
      <div className="mt-4 space-y-4">
        <FieldBlock label={supplier ? 'Nom du fournisseur' : 'Nom de l’acheteur'} htmlFor="quick-cp">
          <TextInput id="quick-cp" value={name} onChange={(e) => setName(e.target.value)} autoFocus className="h-14 text-[17px]" />
        </FieldBlock>
        <div>
          <CapsLabel className="mb-2">Téléphone · facultatif</CapsLabel>
          <PhoneInputWithCountry label="" value={phone} onValueChange={setPhone} defaultDialCode={supplier ? '+237' : '+86'} />
        </div>
      </div>
      <BigButton className="mt-5" disabled={!ok} loading={create.isPending} onClick={save}>Créer et choisir</BigButton>
    </BottomSheet>
  );
}

/* ── Le reçu d'une opération ─────────────────────────────────────────────
 * C'est une IMAGE avant d'être un écran : on la copie pour WhatsApp ou
 * WeChat. Couleurs écrites en clair (le reçu reste blanc en thème sombre),
 * rien d'interne (ni note, ni coût moyen). */
const R_INK = '#1E1E1E';
const R_MUTED = '#5A5A5A';
const R_LINE = '#D9D9D9';

export const ReceiptCard = forwardRef<HTMLDivElement, { data: ReceiptData; className?: string }>(function ReceiptCard({ data, className }, ref) {
  const purchase = data.kind === 'purchase';
  const counterDecimals = data.counterCur === 'XAF' ? 0 : 2;
  const rows: Array<[string, React.ReactNode]> = [];
  if (data.rate) rows.push(['Taux', `${fmtNum(data.rate, purchase ? 2 : 4)} ${purchase ? 'XAF/USDT' : 'CNY/USDT'}`]);
  if (data.accounts.length > 0) {
    rows.push([
      purchase ? 'Payé depuis' : 'Encaissé sur',
      data.accounts.length === 1 ? data.accounts[0].label : (
        <span className="block">
          {data.accounts.map((a) => (
            <span key={a.label} className="block">{a.label} · {fmtNum(a.amount, counterDecimals)}</span>
          ))}
        </span>
      ),
    ]);
  }
  rows.push(['Date', whenFull(data.at)]);
  if (data.ref) rows.push(['Référence', data.ref]);
  rows.push(['N° d’opération', receiptNumber(data.kind, data.id)]);
  return (
    <div ref={ref} className={cn('overflow-hidden rounded-lg border bg-white', className)} style={{ borderColor: R_LINE, color: R_INK, fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      <div className="flex flex-col items-center px-5 pb-5 pt-6 text-center">
        <TetherCircle size={48} />
        <div className="mt-3 text-[34px] font-bold leading-tight tracking-[-0.02em] tabular-nums" style={{ textDecoration: data.voided ? 'line-through' : undefined }}>
          {fmtNum(data.usdt, 2)} USDT
        </div>
        <div className="mt-1 text-[16px]" style={{ color: R_MUTED }}>
          {data.counterparty?.name ?? '—'} · {data.counterCur === 'CNY' ? `¥ ${fmtNum(data.counter, 2)}` : `${fmtNum(data.counter, counterDecimals)} ${data.counterCur}`}
        </div>
        <span
          className="mt-2.5 rounded-md px-2.5 py-1.5 text-[15px] font-semibold leading-none"
          style={data.voided ? { background: '#FDD3D0', color: '#900B09' } : { background: '#F5F5F5', color: '#303030' }}
        >
          {data.voided ? 'Annulée' : purchase ? 'Achat' : 'Vente'}
        </span>
      </div>
      <div>
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-start justify-between gap-4 border-t px-4 py-3 text-[16px]" style={{ borderColor: R_LINE }}>
            <span style={{ color: R_MUTED }}>{k}</span>
            <span className="text-right font-semibold tabular-nums">{v}</span>
          </div>
        ))}
      </div>
      <div className="border-t px-4 py-2.5 text-center text-[14px]" style={{ borderColor: R_LINE, color: R_MUTED }}>Bonzini Labs</div>
    </div>
  );
});

/** Les deux boutons du reçu, côte à côte : Copier l'image (noir) · Télécharger. */
export function ReceiptButtons({ actions, copyLabel = 'Copier l’image', soft }: { actions: ReceiptActions; copyLabel?: string; soft?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <BigButton variant={soft ? 'soft' : 'primary'} className="gap-1.5 whitespace-nowrap px-2 text-[17px]" onClick={() => void actions.copy()} disabled={!!actions.busy}>
        {actions.busy === 'copy' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Copy className="h-5 w-5" />} {copyLabel}
      </BigButton>
      <BigButton variant="soft" className="gap-1.5 whitespace-nowrap px-2 text-[17px]" onClick={() => void actions.download()} disabled={!!actions.busy}>
        {actions.busy === 'download' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />} Télécharger
      </BigButton>
    </div>
  );
}

/* ── Barres groupées (achats encre / ventes gris) ────────────────────────
 * Ce que BarChart du kit ne fait pas : deux séries côte à côte par
 * semaine. Mêmes règles : encre et gris, grille à peine visible,
 * étiquettes 14 px, toucher un groupe montre ses deux valeurs. */
export function GroupedBarChart({
  groups, height = 200, ticks, formatTick, format, ariaLabel,
}: {
  groups: Array<{ label: string; a: number; b: number }>;
  height?: number;
  ticks?: number[];
  formatTick?: (v: number) => string;
  format?: (v: number) => string;
  ariaLabel?: string;
}) {
  const [sel, setSel] = useState<number | null>(null);
  const W = 300;
  const H = height;
  const max = Math.max(1, ...groups.flatMap((g) => [g.a, g.b]), ...(ticks ?? []));
  const n = Math.max(groups.length, 1);
  const slot = W / n;
  const bw = Math.min(28, slot * 0.36);
  const y = (v: number) => H - (Math.max(v, 0) / max) * (H - 8);
  const fmt = format ?? ((v: number) => v.toLocaleString('fr-FR'));
  return (
    <div className="relative">
      <div className="flex gap-2">
        {ticks && (
          <div className="relative w-11 shrink-0" style={{ height: H }}>
            {ticks.map((t) => (
              <span key={t} className={cn('absolute left-0 -translate-y-1/2 whitespace-nowrap text-[14px] tabular-nums', TEXT.muted)} style={{ top: y(t) }}>
                {(formatTick ?? fmt)(t)}
              </span>
            ))}
          </div>
        )}
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block min-w-0 flex-1" style={{ height: H }} role="img" aria-label={ariaLabel}>
          {(ticks ?? []).map((t) => (
            <line key={t} x1={0} x2={W} y1={y(t)} y2={y(t)} stroke="#EEEEEE" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          ))}
          {groups.map((g, i) => {
            const cx = slot * i + slot / 2;
            const dim = sel != null && sel !== i;
            return (
              <g key={i} onClick={() => setSel(sel === i ? null : i)} style={{ cursor: 'pointer' }} opacity={dim ? 0.25 : 1}>
                <rect x={slot * i} y={0} width={slot} height={H} fill="transparent" />
                <rect x={cx - bw - 2} y={y(g.a)} width={bw} height={Math.max(H - y(g.a), g.a > 0 ? 2 : 0)} rx={3} fill="#2C2C2C" />
                <rect x={cx + 2} y={y(g.b)} width={bw} height={Math.max(H - y(g.b), g.b > 0 ? 2 : 0)} rx={3} fill="#B3B3B3" />
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-2 flex" style={{ marginLeft: ticks ? 52 : 0 }}>
        {groups.map((g, i) => (
          <span key={i} className={cn('flex-1 text-center text-[14px]', TEXT.muted)}>{g.label}</span>
        ))}
      </div>
      {sel != null && groups[sel] && (
        <div
          className="pointer-events-none absolute -top-2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-[#2C2C2C] px-3 py-2 text-[14px] font-semibold text-[#F5F5F5]"
          style={{ left: `calc(${ticks ? 52 : 0}px + (100% - ${ticks ? 52 : 0}px) * ${(sel + 0.5) / n})` }}
        >
          <div className="opacity-80">{groups[sel].label}</div>
          <div className="tabular-nums">Achats {fmt(groups[sel].a)}</div>
          <div className="tabular-nums">Ventes {fmt(groups[sel].b)}</div>
        </div>
      )}
    </div>
  );
}

/** La légende d'un graphe à barres : carré encre, carré gris. */
export function SquareLegend({ items }: { items: Array<{ label: React.ReactNode; tone: 'ink' | 'grey' }> }) {
  return (
    <div className={cn('mt-3 flex flex-wrap gap-x-6 text-[16px]', TEXT.body)}>
      {items.map((it, i) => (
        <span key={i} className="inline-flex items-center gap-2">
          <span className="h-3.5 w-3.5 rounded-[3px]" style={{ background: it.tone === 'ink' ? '#2C2C2C' : '#B3B3B3' }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

/* ── Pages à balayer, avec leurs points ─────────────────────────────────── */
export function Pager({ pages, index, onIndex }: { pages: React.ReactNode[]; index: number; onIndex: (i: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const onScroll = () => {
    const el = ref.current;
    if (!el || el.clientWidth === 0) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== index) onIndex(i);
  };
  const go = (i: number) => {
    const el = ref.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
    onIndex(i);
  };
  return (
    <>
      <div ref={ref} onScroll={onScroll} className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {pages.map((p, i) => (
          <div key={i} className="w-full shrink-0 snap-start" aria-hidden={i !== index}>
            {p}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-1 py-4">
        {pages.map((_, i) => (
          <button key={i} type="button" aria-label={`Graphique ${i + 1}`} onClick={() => go(i)} className={cn('flex h-11 items-center justify-center px-1', FOCUS_RING)}>
            <span className={cn('block h-2 rounded-full transition-all', i === index ? 'w-7 bg-[#2C2C2C] dark:bg-[#E3E3E3]' : 'w-2 bg-[#D9D9D9] dark:bg-[#444444]')} />
          </button>
        ))}
      </div>
    </>
  );
}

/** Une ligne « attendu / compté / écart » en tag : vert si juste, rouge sinon. */
export function GapTag({ gap, text }: { gap: number; text: React.ReactNode }) {
  return <Tag tone={gap === 0 ? 'success' : 'danger'}>{gap === 0 ? 'Juste' : text}</Tag>;
}

/** Un compte touché par une opération : son mouvement, et le solde juste après. */
export function TouchedRow({ e }: { e: LedgerEntry }) {
  const navigate = useNavigate();
  const balances = useTreasuryAccountBalances();
  const ledger = useTreasuryLedger({ accountId: e.account_id ?? undefined, limit: 300 });
  const after = balancesAfter(ledger.data ?? [], balances.data).get(e.id);
  const acc = (balances.data ?? []).find((b) => b.id === e.account_id);
  const amount = Number(e.amount);
  return (
    <button
      type="button"
      onClick={() => e.account && navigate(tp.account(e.account.id))}
      className={cn('flex w-full items-center gap-3.5 border-b py-3.5 text-left last:border-b-0 active:bg-[#F5F5F5] dark:active:bg-[#383838]', SURFACE.divider)}
    >
      <AccountLogo kind={acc?.kind} label={e.account?.label} currency={e.currency} />
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-[17px] font-semibold', TEXT.strong)}>{e.account?.label ?? '—'}</span>
        <span className={cn('block text-[15px] tabular-nums', TEXT.muted)}>Après : {after === undefined ? '—' : fmtCur(after, e.currency)}</span>
      </span>
      <span className={cn('shrink-0 text-[17px] font-bold tabular-nums', TEXT.strong)}>{signed(amount, fmtCur(Math.abs(amount), e.currency))}</span>
      <ChevronRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
    </button>
  );
}

/** La garde du module : `canViewTreasury` pour lire, `canManageTreasury` pour saisir. */
export function TreasuryGate({ manage, children }: { manage?: boolean; children: React.ReactNode }) {
  const { hasPermission } = useAdminAuth();
  if (!hasPermission('canViewTreasury')) return <Navigate to="/m" replace />;
  if (manage && !hasPermission('canManageTreasury')) return <Navigate to="/m/more/treasury" replace />;
  return <>{children}</>;
}

/* ── Une opération en ligne de liste ─────────────────────────────────────
 * Rond (USDT, ou le compte CNY d'une vente), contrepartie, sous-titre,
 * ±USDT et, dessous, la contre-valeur (ou le tag Achat / Vente / Annulée). */
export function OpRow({
  op, subtitle, below = 'counter', onClick,
}: { op: OperationView; subtitle?: React.ReactNode; below?: 'counter' | 'kind' | 'rate'; onClick?: () => void }) {
  const purchase = op.kind === 'purchase';
  const leading = !purchase && op.accounts !== '—' ? <AccountLogo label={op.accounts} currency="CNY" kind={/alipay/i.test(op.accounts) ? 'alipay' : /wechat/i.test(op.accounts) ? 'wechat' : 'cash'} /> : <TetherCircle />;
  const counter = op.counterCur === 'CNY' ? `¥ ${fmtNum(op.counter, 2)}` : `${fmtNum(op.counter, 0)} ${op.counterCur}`;
  return (
    <ItemRow
      leading={leading}
      title={op.counterpartyName}
      subtitle={subtitle}
      onClick={onClick}
      className={op.voided ? 'opacity-70' : undefined}
      right={
        op.voided ? (
          <AmountStack main={`${fmtUsdt(op.usdt)} USDT`} strike sub="Annulée" tone="danger" />
        ) : below === 'kind' ? (
          <AmountStack main={`${purchase ? '+' : '−'}${fmtUsdt(op.usdt)} USDT`} sub={purchase ? 'Achat' : 'Vente'} tone="neutral" />
        ) : below === 'rate' ? (
          <AmountStack main={`${fmtUsdt(op.usdt)} USDT`} sub={fmtNum(op.rate, op.rateDecimals)} />
        ) : (
          <AmountStack main={`${purchase ? '+' : '−'}${fmtUsdt(op.usdt)} USDT`} sub={counter} />
        )
      }
    />
  );
}

/* ── Le chiffre du jour avec ses lignes (stock USDT, valeur totale) ──────
 * HeroFigure du kit, plus une ligne de complément et des lignes
 * étiquette / valeur sous un filet. */
export function HeroCard({
  label, value, unit, line, rows, tag, onClick,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: React.ReactNode;
  line?: React.ReactNode;
  rows?: Array<{ label: React.ReactNode; value: React.ReactNode }>;
  tag?: { tone: Tone; label: React.ReactNode };
  onClick?: () => void;
}) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn('block w-full rounded-lg border px-[18px] pb-4 pt-[18px] text-left', SURFACE.card, SURFACE.divider, onClick && cn('active:bg-[#F5F5F5] dark:active:bg-[#383838]', FOCUS_RING))}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={cn('text-[16px] font-medium', TEXT.muted)}>{label}</div>
        {tag && <Tag tone={tag.tone}>{tag.label}</Tag>}
      </div>
      <div className={cn('mt-1.5 break-words text-[40px] font-bold leading-[1.1] tracking-[-0.02em] tabular-nums', TEXT.strong)}>
        {value}
        {unit != null && <span className={cn('ml-1.5 text-[20px] font-semibold tracking-normal', TEXT.muted)}>{unit}</span>}
      </div>
      {line != null && <div className={cn('mt-2 text-[16px]', TEXT.body)}>{line}</div>}
      {rows && rows.length > 0 && (
        <div className={cn('mt-3.5 space-y-1.5 border-t pt-3', SURFACE.divider)}>
          {rows.map((r, i) => (
            <div key={i} className="flex items-baseline justify-between gap-3 text-[16px]">
              <span className={TEXT.muted}>{r.label}</span>
              <span className={cn('font-semibold tabular-nums', TEXT.strong)}>{r.value}</span>
            </div>
          ))}
        </div>
      )}
    </Wrapper>
  );
}

/* ── Choisir un compte (ajuster, inventorier) ────────────────────────────
 * Le compte d'un geste lancé hors de sa fiche (« … » de la Trésorerie,
 * rond « Inventaire » de l'Accueil). L'inventaire ne propose que la caisse,
 * Alipay et WeChat (une banque se vérifie sur son relevé). */
export function AccountPickSheet({
  open, onClose, mode, onPick, value,
}: { open: boolean; onClose: () => void; mode: 'adjust' | 'inventory'; onPick: (id: string) => void; value?: string | null }) {
  const balances = useTreasuryAccountBalances();
  const snaps = useInventorySnapshots(undefined, 100);
  const accounts = (balances.data ?? []).filter((b) => b.id && b.is_active !== false && (mode === 'adjust' || canInventory(b.kind)));
  const lastCount = (id: string) => (snaps.data ?? []).find((s) => s.account_id === id)?.snapshot_at ?? null;
  return (
    <PickerSheet
      open={open}
      onClose={onClose}
      title={mode === 'adjust' ? 'Ajuster quel compte ?' : 'Compter quel compte ?'}
      value={value}
      onPick={onPick}
      options={accounts.map((a) => ({
        value: a.id as string,
        label: a.label ?? '—',
        leading: <AccountLogo kind={a.kind} label={a.label} currency={a.currency} />,
        hint: mode === 'adjust' ? withCur(Number(a.balance ?? 0), a.currency) : `Dernier inventaire ${agoLabel(lastCount(a.id as string))}`,
      }))}
    />
  );
}

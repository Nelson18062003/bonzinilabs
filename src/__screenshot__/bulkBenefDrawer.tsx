/**
 * MAQUETTE v2 (screenshot-only) — refonte COMPLÈTE du paiement groupé.
 * Statique, sans hooks ni réseau. Deux vues :
 *   • BulkV2Drawer — le drawer « bénéficiaire » (méthode, montant/taux ¥-devant,
 *     QR cliquable, type d'identifiant, alias, relation, commentaire, carnet…)
 *   • BulkV2Flow   — le flux (liste par ligne + total par méthode + récap)
 *
 * Périmètre A+B+C+D validé par le PO. Rendu :
 *   /screenshot.html?screen=bulk-v2-drawer  ·  ?screen=bulk-v2-flow
 */
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, PAYMENT_METHOD } from '@/mobile/designKit';
import { PaymentMethodLogo } from '@/mobile/components/payments/PaymentMethodLogo';
import {
  QrCode, X, Check, Phone, Mail, Hash, Info, Landmark, Banknote, Plus, Pencil, RotateCcw,
  Search, Wallet, Lock, AlertTriangle, Maximize2, Trash2, Copy, ChevronRight, BookUser,
  Users, Download,
} from 'lucide-react';

type Method = 'alipay' | 'wechat' | 'bank_transfer' | 'cash';

const AMBER = '#E8932A';
const VIOLET = '#8B5CF6';
const GREEN = '#2E7D52';
const RED = '#C0504D';

/* ════════════ shared atoms ════════════ */

function Caption({ children }: { children: React.ReactNode }) {
  return (
    <p className={cn('mb-2 ml-1 text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>{children}</p>
  );
}

/** ¥ ALWAYS before the number (amber unit). */
function Yen({ value, big }: { value: string; big?: boolean }) {
  return (
    <span className="inline-flex items-baseline gap-1 tabular-nums">
      <span className={cn('font-extrabold', big ? 'text-[22px]' : 'text-[13px]')} style={{ color: AMBER }}>¥</span>
      <span className={cn('font-extrabold', big ? 'text-[34px] leading-none tracking-tight' : '', TEXT.strong)}>
        {value}
      </span>
    </span>
  );
}

function Sheet({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-[28px] p-5',
        SURFACE.card,
        'shadow-[0_-12px_40px_-12px_rgba(46,32,92,0.30)] dark:shadow-none dark:ring-1 dark:ring-white/[0.06]',
      )}
    >
      <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-black/10 dark:bg-white/15" />
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className={cn('text-[18px] font-extrabold tracking-tight', TEXT.strong)}>{title}</h2>
          {sub && <p className={cn('mt-0.5 text-[12px]', TEXT.muted)}>{sub}</p>}
        </div>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.05] dark:bg-white/[0.06]">
          <X className={cn('h-4 w-4', TEXT.muted)} />
        </span>
      </div>
      {children}
    </div>
  );
}

function SectionLabel({ n, children, hint }: { n: number; children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-2.5 mt-1 flex items-center gap-2">
      <span className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-black text-white" style={{ background: VIOLET }}>
        {n}
      </span>
      <span className={cn('text-[13px] font-extrabold', TEXT.strong)}>{children}</span>
      {hint && <span className={cn('text-[11.5px] font-medium', TEXT.muted)}>· {hint}</span>}
    </div>
  );
}

function Field({ label, children, optional, error }: { label: string; children: React.ReactNode; optional?: boolean; error?: string }) {
  return (
    <div className="mb-3">
      <label className={cn('mb-1.5 ml-0.5 flex items-center gap-1.5 text-[12.5px] font-bold', TEXT.strong)}>
        {label}
        {optional && <span className={cn('text-[11px] font-medium', TEXT.muted)}>(optionnel)</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1 ml-0.5 flex items-center gap-1 text-[11.5px] font-semibold" style={{ color: RED }}>
          <AlertTriangle className="h-3 w-3" /> {error}
        </p>
      )}
    </div>
  );
}

function Input({ value, placeholder, mono, accent }: { value?: string; placeholder?: string; mono?: boolean; accent?: string }) {
  return (
    <div
      className={cn(
        'flex h-[46px] items-center rounded-2xl px-3.5 text-[15px]',
        'bg-black/[0.035] ring-1 ring-inset ring-black/[0.06] dark:bg-white/[0.05] dark:ring-white/[0.08]',
        mono && 'tabular-nums',
        value ? TEXT.strong : TEXT.muted,
      )}
      style={accent ? { boxShadow: `inset 0 0 0 1.5px ${accent}55` } : undefined}
    >
      {value || placeholder}
    </div>
  );
}

function Chip({ icon: Icon, label, on }: { icon?: React.ComponentType<{ className?: string }>; label: string; on?: boolean }) {
  return (
    <span
      className={cn(
        'flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-bold',
        on ? 'text-white' : cn('bg-black/[0.05] dark:bg-white/[0.06]', TEXT.muted),
      )}
      style={on ? { background: VIOLET } : undefined}
    >
      {Icon && <Icon className="h-3 w-3" />} {label}
    </span>
  );
}

/* ════════════ method selector (REAL logos) ════════════ */

function MethodSelector({ active }: { active: Method }) {
  const methods: { key: Method; label: string; colorKey: keyof typeof PAYMENT_METHOD }[] = [
    { key: 'alipay', label: 'Alipay', colorKey: 'alipay' },
    { key: 'wechat', label: 'WeChat', colorKey: 'wechat' },
    { key: 'bank_transfer', label: 'Virement', colorKey: 'virement' },
    { key: 'cash', label: 'Cash', colorKey: 'cash' },
  ];
  return (
    <div className="grid grid-cols-4 gap-2">
      {methods.map((m) => {
        const color = PAYMENT_METHOD[m.colorKey].color;
        const on = active === m.key;
        return (
          <div
            key={m.key}
            className={cn(
              'flex flex-col items-center gap-1.5 rounded-2xl py-2.5 transition',
              on ? 'ring-2' : 'ring-1 ring-inset ring-black/[0.06] dark:ring-white/[0.08]',
            )}
            style={on ? { ['--tw-ring-color' as string]: color, backgroundColor: `${color}12` } : undefined}
          >
            <PaymentMethodLogo method={m.key} size={34} />
            <span className={cn('text-[11px] font-bold', on ? TEXT.strong : TEXT.muted)}>{m.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ════════════ amount + rate (¥ DEVANT, presets, badge auto/manuel) ════════════ */

function AmountRateBlock({ custom = false }: { custom?: boolean }) {
  return (
    <div className="rounded-[22px] bg-black/[0.035] p-3.5 ring-1 ring-inset ring-black/[0.06] dark:bg-white/[0.04] dark:ring-white/[0.08]">
      <div className="mb-3 inline-flex rounded-full bg-black/[0.05] p-0.5 dark:bg-white/[0.06]">
        <span className="rounded-full bg-white px-3.5 py-1 text-[12px] font-bold text-[#1B1A24] shadow-sm dark:bg-[#F2F1F7]">¥ RMB</span>
        <span className={cn('px-3.5 py-1 text-[12px] font-bold', TEXT.muted)}>XAF</span>
      </div>

      {/* hero amount — ¥ before */}
      <Yen value="47 600" big />
      <p className={cn('mt-1.5 text-[13px] font-semibold tabular-nums', TEXT.muted)}>
        ≈ <span style={{ color: VIOLET }}>4 132 000 XAF</span> débités du solde
      </p>

      {/* presets — ¥ before */}
      <div className="mt-3 flex gap-1.5">
        {['¥1K', '¥2,5K', '¥5K', 'Tout'].map((p, i) => (
          <span
            key={p}
            className={cn(
              'flex-1 rounded-xl py-1.5 text-center text-[12px] font-bold',
              i === 2 ? 'text-white' : cn('bg-black/[0.05] dark:bg-white/[0.06]', TEXT.muted),
            )}
            style={i === 2 ? { background: VIOLET } : undefined}
          >
            {p}
          </span>
        ))}
      </div>

      {/* rate */}
      <div className="mt-3 border-t border-black/[0.06] pt-3 dark:border-white/[0.07]">
        {!custom ? (
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className={cn('text-[12.5px] font-bold', TEXT.strong)}>Taux du jour</span>
                <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: `${GREEN}1F`, color: GREEN }}>auto</span>
              </div>
              <p className={cn('text-[12px] tabular-nums', TEXT.muted)}>
                1 000 000 XAF = <span style={{ color: AMBER }} className="font-bold">¥11 530</span>
              </p>
            </div>
            <span className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold" style={{ background: `${VIOLET}1F`, color: VIOLET }}>
              <Pencil className="h-3.5 w-3.5" /> Personnaliser
            </span>
          </div>
        ) : (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className={cn('text-[12.5px] font-bold', TEXT.strong)}>Taux personnalisé</span>
                <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: `${AMBER}26`, color: AMBER }}>manuel</span>
              </div>
              <span className="flex items-center gap-1 text-[11.5px] font-bold" style={{ color: VIOLET }}>
                <RotateCcw className="h-3 w-3" /> Taux du jour
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-[42px] flex-1 items-center gap-1 rounded-xl bg-white px-3 text-[15px] font-bold tabular-nums text-[#1B1A24] dark:bg-[#26242F] dark:text-white" style={{ boxShadow: `inset 0 0 0 1.5px ${AMBER}66` }}>
                <span style={{ color: AMBER }}>¥</span> 11 800
              </div>
              <span className={cn('text-[11px] font-medium leading-tight', TEXT.muted)}>pour<br />1 000 000 XAF</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════ QR — riche (miniature + agrandir + remplacer) ════════════ */

function QrRich() {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-black/[0.035] p-2.5 ring-1 ring-inset ring-black/[0.06] dark:bg-white/[0.05] dark:ring-white/[0.08]">
      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-black/10">
        <QrCode className="h-10 w-10 text-[#1B1A24]" strokeWidth={1.4} />
        <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full text-white ring-2 ring-white dark:ring-[#26242F]" style={{ background: VIOLET }}>
          <Maximize2 className="h-3 w-3" />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn('flex items-center gap-1.5 text-[13px] font-bold', TEXT.strong)}>
          <Check className="h-4 w-4" style={{ color: GREEN }} /> QR code ajouté
        </p>
        <p className="mt-0.5 text-[11.5px] font-semibold" style={{ color: VIOLET }}>Appuyer pour agrandir</p>
        <p className={cn('text-[11px]', TEXT.muted)}>alipay-qr.png · remplacer · retirer</p>
      </div>
    </div>
  );
}

function QrEmpty() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-black/12 bg-black/[0.015] px-3.5 py-3 dark:border-white/15 dark:bg-white/[0.02]">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: `${VIOLET}1A` }}>
        <QrCode className="h-6 w-6" style={{ color: VIOLET }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn('text-[13px] font-bold', TEXT.strong)}>Ajouter le QR code</p>
        <p className={cn('text-[11.5px]', TEXT.muted)}>Le plus fiable pour Alipay / WeChat</p>
      </div>
      <span className="flex h-8 w-8 items-center justify-center rounded-full text-white" style={{ background: VIOLET }}>
        <Plus className="h-4 w-4" />
      </span>
    </div>
  );
}

function IdentifierField() {
  return (
    <div className="mb-3">
      <label className={cn('mb-1.5 ml-0.5 block text-[12.5px] font-bold', TEXT.strong)}>Identifiant</label>
      <div className="mb-2 flex gap-1.5">
        <Chip icon={Hash} label="ID" on />
        <Chip icon={Phone} label="Téléphone" />
        <Chip icon={Mail} label="E-mail" />
      </div>
      <Input value="supplier_gz_8821" placeholder="ID Alipay du fournisseur" />
    </div>
  );
}

function RelationField() {
  return (
    <Field label="Relation">
      <div className="flex gap-1.5">
        <Chip label="Soi-même" />
        <Chip label="Fournisseur" on />
        <Chip label="Autre" />
      </div>
    </Field>
  );
}

function SaveToCarnet() {
  return (
    <div className="mt-1 flex items-center gap-3 rounded-2xl px-3.5 py-3" style={{ background: `${VIOLET}0F` }}>
      <span className="flex h-6 w-6 items-center justify-center rounded-md text-white" style={{ background: VIOLET }}>
        <Check className="h-4 w-4" />
      </span>
      <div className="flex-1">
        <p className={cn('text-[13px] font-bold', TEXT.strong)}>Enregistrer dans le carnet</p>
        <p className={cn('text-[11.5px]', TEXT.muted)}>Réutilisable pour les prochains paiements de ce client</p>
      </div>
    </div>
  );
}

/* ════════════ VIEW 1 — le drawer ════════════ */

function AlipayDrawer() {
  return (
    <Sheet title="Nouveau bénéficiaire" sub="Ligne 3 · paiement groupé">
      {/* carnet shortcut */}
      <button className="mb-5 flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left ring-1 ring-inset ring-black/[0.06] dark:ring-white/[0.08]" style={{ background: `${VIOLET}0D` }}>
        <span className="flex h-9 w-9 items-center justify-center rounded-full text-white" style={{ background: VIOLET }}>
          <BookUser className="h-4.5 w-4.5" />
        </span>
        <div className="flex-1">
          <p className={cn('text-[13.5px] font-bold', TEXT.strong)}>Choisir dans le carnet</p>
          <p className={cn('text-[11.5px]', TEXT.muted)}>12 bénéficiaires enregistrés pour ce client</p>
        </div>
        <ChevronRight className={cn('h-4 w-4', TEXT.muted)} />
      </button>

      <SectionLabel n={1}>Méthode</SectionLabel>
      <div className="mb-5"><MethodSelector active="alipay" /></div>

      <SectionLabel n={2}>Montant &amp; taux</SectionLabel>
      <div className="mb-5"><AmountRateBlock /></div>

      <SectionLabel n={3} hint="QR ou identifiant requis">Bénéficiaire</SectionLabel>
      <Field label="QR code"><QrRich /></Field>
      <IdentifierField />
      <Field label="Alias (libellé court)"><Input value="Textile GZ" /></Field>
      <Field label="Nom du bénéficiaire"><Input value="Guangzhou Textile Co." /></Field>
      <RelationField />
      <Field label="Téléphone" optional><Input placeholder="+86 …" /></Field>
      <Field label="Commentaire visible par le client" optional>
        <Input value="Commande #INV-2291" />
      </Field>
      <SaveToCarnet />

      <div className="mt-4 flex gap-2.5">
        <span className={cn('flex h-12 flex-1 items-center justify-center rounded-full text-[14px] font-bold', 'bg-black/[0.05] dark:bg-white/[0.06]', TEXT.strong)}>Annuler</span>
        <span className="flex h-12 flex-[1.4] items-center justify-center gap-1.5 rounded-full bg-[#1C1B22] text-[14px] font-bold text-white dark:bg-[#F2F1F7] dark:text-[#1B1A24]">
          <Plus className="h-4 w-4" /> Ajouter le bénéficiaire
        </span>
      </div>
    </Sheet>
  );
}

function QrZoom() {
  return (
    <div className={cn('overflow-hidden rounded-[28px] p-5', SURFACE.card, 'dark:ring-1 dark:ring-white/[0.06]')}>
      <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-black/10 dark:bg-white/15" />
      <p className={cn('mb-3 text-center text-[15px] font-bold', TEXT.strong)}>Guangzhou Textile Co.</p>
      <div className="mx-auto flex aspect-square w-52 items-center justify-center rounded-2xl bg-white ring-1 ring-black/10">
        <QrCode className="h-40 w-40 text-[#1B1A24]" strokeWidth={1.1} />
      </div>
      <div className={cn('mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full text-[14px] font-bold', 'bg-black/[0.05] dark:bg-white/[0.06]', TEXT.strong)}>
        <Download className="h-4 w-4" /> Télécharger le QR
      </div>
    </div>
  );
}

function CarnetPicker() {
  const rows = [
    { m: 'alipay' as Method, alias: 'Textile GZ', name: 'Guangzhou Textile Co.', id: 'ID · supplier_gz_8821' },
    { m: 'wechat' as Method, alias: 'Shenzhen Elec', name: 'SZ Electronics Ltd', id: 'WeChat · wxid_88s…' },
    { m: 'bank_transfer' as Method, alias: 'BOC Imp', name: 'Shenzhen Imp. & Exp.', id: 'Compte · 6217 0000 …' },
  ];
  return (
    <Sheet title="Carnet du client" sub="Yao Ming · 12 bénéficiaires">
      <div className="relative mb-3">
        <Search className={cn('pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2', TEXT.muted)} />
        <div className={cn('flex h-[46px] items-center rounded-2xl pl-9 pr-3 text-[14px]', 'bg-black/[0.035] ring-1 ring-inset ring-black/[0.06] dark:bg-white/[0.05] dark:ring-white/[0.08]', TEXT.muted)}>
          Rechercher un bénéficiaire…
        </div>
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.alias} className="flex items-center gap-3 rounded-2xl p-2.5 ring-1 ring-inset ring-black/[0.06] dark:ring-white/[0.08]">
            <PaymentMethodLogo method={r.m} size={38} />
            <div className="min-w-0 flex-1">
              <p className={cn('truncate text-[14px] font-bold', TEXT.strong)}>{r.alias}</p>
              <p className={cn('truncate text-[11.5px]', TEXT.muted)}>{r.name} · {r.id}</p>
            </div>
            <ChevronRight className={cn('h-4 w-4 shrink-0', TEXT.muted)} />
          </div>
        ))}
      </div>
      <div className={cn('mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full text-[14px] font-bold', 'bg-black/[0.05] dark:bg-white/[0.06]', TEXT.strong)}>
        <Plus className="h-4 w-4" /> Saisir un nouveau bénéficiaire
      </div>
    </Sheet>
  );
}

function VirementCash() {
  return (
    <div className="grid grid-cols-1 gap-5">
      <Sheet title="Bénéficiaire — Virement">
        <div className="mb-4"><MethodSelector active="bank_transfer" /></div>
        <Field label="Nom du bénéficiaire"><Input value="Shenzhen Imp. & Exp. Ltd" /></Field>
        <Field label="Banque">
          <div className="flex items-center gap-2">
            <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-2xl" style={{ background: `${VIOLET}1F` }}>
              <Landmark className="h-5 w-5" style={{ color: VIOLET }} />
            </span>
            <div className="flex-1"><Input value="Bank of China" /></div>
          </div>
        </Field>
        <Field label="Numéro de compte / IBAN"><Input value="6217 0000 1234 5678" mono /></Field>
        <Field label="SWIFT / agence" optional><Input placeholder="BKCHCNBJ…" /></Field>
      </Sheet>
      <Sheet title="Bénéficiaire — Cash">
        <div className="mb-4"><MethodSelector active="cash" /></div>
        <Field label="Nom du bénéficiaire"><Input value="Li Wei" /></Field>
        <Field label="Téléphone">
          <div className="flex items-center gap-2">
            <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-2xl" style={{ background: `${PAYMENT_METHOD.cash.color}1F` }}>
              <Banknote className="h-5 w-5" style={{ color: PAYMENT_METHOD.cash.color }} />
            </span>
            <div className="flex-1"><Input value="+86 138 0000 0000" mono /></div>
          </div>
        </Field>
        <div className="mt-2 flex items-start gap-2 rounded-2xl px-3.5 py-3" style={{ background: `${VIOLET}14` }}>
          <Info className="mt-0.5 h-4 w-4 shrink-0" style={{ color: VIOLET }} />
          <p className={cn('text-[12px] leading-snug', TEXT.strong)}>Un QR de retrait est généré automatiquement — rien à joindre.</p>
        </div>
      </Sheet>
    </div>
  );
}

export function BulkV2Drawer() {
  return (
    <div className={cn('min-h-screen w-full px-4 py-6', SURFACE.canvas)}>
      <div className="mx-auto w-full max-w-[420px] space-y-8">
        <Header title="Drawer « bénéficiaire » — v2" sub="Vrais logos · ¥ devant · QR cliquable · carnet · type d'identifiant · alias · relation · commentaire" />
        <div><Caption>Alipay — drawer complet</Caption><AlipayDrawer /></div>
        <div><Caption>QR — agrandi (appui sur la miniature)</Caption><QrZoom /></div>
        <div><Caption>Bloc taux — « personnalisé » (¥ devant)</Caption>
          <div className={cn('rounded-[28px] p-5', SURFACE.card, 'dark:ring-1 dark:ring-white/[0.06]')}><AmountRateBlock custom /></div>
        </div>
        <div><Caption>QR — état vide</Caption>
          <div className={cn('rounded-[28px] p-5', SURFACE.card, 'dark:ring-1 dark:ring-white/[0.06]')}><QrEmpty /></div>
        </div>
        <div><Caption>Carnet — choisir un bénéficiaire enregistré</Caption><CarnetPicker /></div>
        <div><Caption>Virement &amp; Cash</Caption><VirementCash /></div>
      </div>
    </div>
  );
}

/* ════════════ VIEW 2 — le flux (liste + total + récap) ════════════ */

function Header({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <h1 className={cn('text-[20px] font-extrabold tracking-tight', TEXT.strong)}>{title}</h1>
      <p className={cn('mt-0.5 text-[12.5px]', TEXT.muted)}>{sub}</p>
    </div>
  );
}

function LineCard({ m, name, sub, yen, xaf, complete }: { m: Method; name: string; sub: string; yen: string; xaf: string; complete: boolean }) {
  return (
    <div className={cn('flex items-center gap-3 rounded-[20px] p-3', SURFACE.card, 'ring-1 ring-inset ring-black/[0.05] dark:ring-white/[0.07]')}>
      <PaymentMethodLogo method={m} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={cn('truncate text-[14px] font-bold', TEXT.strong)}>{name}</span>
          {complete ? (
            <Check className="h-3.5 w-3.5 shrink-0" style={{ color: GREEN }} />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: AMBER }} />
          )}
        </div>
        <p className={cn('truncate text-[12px]', TEXT.muted)}>{sub}</p>
      </div>
      <div className="text-right">
        <div className="flex items-baseline justify-end gap-0.5">
          <span className="text-[12px] font-extrabold" style={{ color: AMBER }}>¥</span>
          <span className={cn('text-[14px] font-extrabold tabular-nums', TEXT.strong)}>{yen}</span>
        </div>
        <p className={cn('text-[11px] tabular-nums', TEXT.muted)}>{xaf} XAF</p>
      </div>
      <div className="flex shrink-0 flex-col gap-1">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.05] dark:bg-white/[0.06]"><Pencil className={cn('h-3.5 w-3.5', TEXT.muted)} /></span>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.05] dark:bg-white/[0.06]"><Copy className={cn('h-3.5 w-3.5', TEXT.muted)} /></span>
      </div>
    </div>
  );
}

function MethodBreakdown() {
  const seg = [
    { c: PAYMENT_METHOD.alipay.color, pct: 38 },
    { c: PAYMENT_METHOD.wechat.color, pct: 25 },
    { c: PAYMENT_METHOD.virement.color, pct: 28 },
    { c: PAYMENT_METHOD.cash.color, pct: 9 },
  ];
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full">
        {seg.map((s, i) => <span key={i} style={{ width: `${s.pct}%`, background: s.c }} />)}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {[['Alipay', PAYMENT_METHOD.alipay.color, '¥18 100'], ['WeChat', PAYMENT_METHOD.wechat.color, '¥11 900'], ['Virement', PAYMENT_METHOD.virement.color, '¥13 200'], ['Cash', PAYMENT_METHOD.cash.color, '¥4 400']].map(([l, c, v]) => (
          <span key={l} className={cn('flex items-center gap-1 text-[11px] font-semibold', TEXT.muted)}>
            <span className="h-2 w-2 rounded-full" style={{ background: c as string }} /> {l} <span className={cn('font-bold tabular-nums', TEXT.strong)}>{v}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function TotalBar() {
  return (
    <div className={cn('rounded-[24px] p-4', SURFACE.card, 'ring-1 ring-inset ring-black/[0.06] dark:ring-white/[0.07]')}>
      <div className="mb-3 flex items-end justify-between">
        <div>
          <p className={cn('text-[11.5px] font-bold uppercase tracking-wide', TEXT.muted)}>Total du lot · 4 lignes</p>
          <div className="mt-0.5 flex items-baseline gap-2">
            <Yen value="47 600" big />
            <span className={cn('text-[13px] font-semibold tabular-nums', TEXT.muted)}>4 132 000 XAF</span>
          </div>
        </div>
        <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: `${VIOLET}1A`, color: VIOLET }}>
          <Lock className="h-3 w-3" /> solde verrouillé
        </span>
      </div>
      <MethodBreakdown />
      <div className="mt-3 flex items-center justify-between border-t border-black/[0.06] pt-3 dark:border-white/[0.07]">
        <span className={cn('flex items-center gap-1.5 text-[12.5px] font-semibold', TEXT.muted)}>
          <Wallet className="h-4 w-4" /> Restant après le lot
        </span>
        <span className="text-[13px] font-extrabold tabular-nums" style={{ color: GREEN }}>868 000 XAF</span>
      </div>
      <div className="mt-3 flex h-12 w-full items-center justify-center gap-1.5 rounded-full bg-[#1C1B22] text-[14px] font-bold text-white dark:bg-[#F2F1F7] dark:text-[#1B1A24]">
        Vérifier &amp; créer le lot (4)
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className={cn('flex flex-col items-center rounded-[24px] px-5 py-9 text-center', SURFACE.card, 'dark:ring-1 dark:ring-white/[0.06]')}>
      <span className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: `${VIOLET}14` }}>
        <Users className="h-7 w-7" style={{ color: VIOLET }} />
      </span>
      <p className={cn('mt-3 text-[15px] font-extrabold', TEXT.strong)}>Ajoutez votre premier fournisseur</p>
      <p className={cn('mt-1 max-w-[260px] text-[12.5px]', TEXT.muted)}>Chaque ligne devient un paiement à part entière, réglé ensemble depuis le solde du client.</p>
      <span className="mt-4 flex h-11 items-center gap-1.5 rounded-full bg-[#1C1B22] px-5 text-[13.5px] font-bold text-white dark:bg-[#F2F1F7] dark:text-[#1B1A24]">
        <Plus className="h-4 w-4" /> Ajouter un bénéficiaire
      </span>
    </div>
  );
}

function RecapPanel() {
  const rows = [
    { m: 'alipay' as Method, name: 'Guangzhou Textile Co.', yen: '18 100', xaf: '1 570 000' },
    { m: 'wechat' as Method, name: 'SZ Electronics Ltd', yen: '11 900', xaf: '1 032 000' },
    { m: 'bank_transfer' as Method, name: 'Shenzhen Imp. & Exp.', yen: '13 200', xaf: '1 145 000' },
    { m: 'cash' as Method, name: 'Li Wei', yen: '4 400', xaf: '385 000' },
  ];
  return (
    <Sheet title="Vérifier le lot" sub="Yao Ming · 4 bénéficiaires · création atomique">
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center gap-3 rounded-2xl p-2.5 ring-1 ring-inset ring-black/[0.06] dark:ring-white/[0.08]">
            <PaymentMethodLogo method={r.m} size={34} />
            <p className={cn('min-w-0 flex-1 truncate text-[13.5px] font-semibold', TEXT.strong)}>{r.name}</p>
            <div className="text-right">
              <div className="flex items-baseline justify-end gap-0.5">
                <span className="text-[11px] font-extrabold" style={{ color: AMBER }}>¥</span>
                <span className={cn('text-[13px] font-extrabold tabular-nums', TEXT.strong)}>{r.yen}</span>
              </div>
              <p className={cn('text-[10.5px] tabular-nums', TEXT.muted)}>{r.xaf} XAF</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-2xl p-3" style={{ background: `${VIOLET}0F` }}>
        <div className="flex items-center justify-between">
          <span className={cn('text-[12.5px] font-bold', TEXT.strong)}>Total débité</span>
          <Yen value="47 600" />
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className={cn('text-[12px]', TEXT.muted)}>Solde restant</span>
          <span className="text-[12.5px] font-bold tabular-nums" style={{ color: GREEN }}>868 000 XAF</span>
        </div>
      </div>
      <div className="mt-4 flex gap-2.5">
        <span className={cn('flex h-12 flex-1 items-center justify-center rounded-full text-[14px] font-bold', 'bg-black/[0.05] dark:bg-white/[0.06]', TEXT.strong)}>Retour</span>
        <span className="flex h-12 flex-[1.4] items-center justify-center gap-1.5 rounded-full bg-[#1C1B22] text-[14px] font-bold text-white dark:bg-[#F2F1F7] dark:text-[#1B1A24]">
          <Check className="h-4 w-4" /> Créer le lot
        </span>
      </div>
    </Sheet>
  );
}

export function BulkV2Flow() {
  return (
    <div className={cn('min-h-screen w-full px-4 py-6', SURFACE.canvas)}>
      <div className="mx-auto w-full max-w-[420px] space-y-8">
        <Header title="Flux paiement groupé — v2" sub="Cartes par ligne · complétude · total + répartition par méthode · récap avant création" />
        <div>
          <Caption>Liste des bénéficiaires (¥ devant, badge complétude, dupliquer)</Caption>
          <div className="space-y-2.5">
            <LineCard m="alipay" name="Guangzhou Textile Co." sub="ID · supplier_gz_8821" yen="18 100" xaf="1 570 000" complete />
            <LineCard m="wechat" name="SZ Electronics Ltd" sub="WeChat · wxid_88s…" yen="11 900" xaf="1 032 000" complete />
            <LineCard m="bank_transfer" name="Shenzhen Imp. & Exp." sub="Compte · 6217 0000 …" yen="13 200" xaf="1 145 000" complete />
            <LineCard m="cash" name="Li Wei" sub="Identifiant manquant" yen="4 400" xaf="385 000" complete={false} />
          </div>
        </div>
        <div><Caption>Total du lot + répartition par méthode</Caption><TotalBar /></div>
        <div><Caption>État vide (narratif)</Caption><EmptyState /></div>
        <div><Caption>Récap avant création (atomique)</Caption><RecapPanel /></div>
      </div>
    </div>
  );
}

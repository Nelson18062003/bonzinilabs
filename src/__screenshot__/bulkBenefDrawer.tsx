/**
 * MAQUETTE (screenshot-only) — refonte du drawer « Nouveau bénéficiaire »
 * du paiement groupé (BulkPaymentCreate). Statique, sans hooks ni réseau.
 *
 * Objectif : valider la hiérarchie, les vrais logos (PaymentMethodLogo),
 * le bloc Montant/Taux repensé, l'upload QR (Alipay/WeChat) et les champs
 * par méthode — AVANT d'implémenter dans le vrai écran.
 *
 * Rendu via /screenshot.html?screen=bulk-benef  (cf. __screenshot__/main.tsx)
 */
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, PAYMENT_METHOD } from '@/mobile/designKit';
import { PaymentMethodLogo } from '@/mobile/components/payments/PaymentMethodLogo';
import {
  QrCode, X, Check, Phone, Mail, Hash, Info, Landmark, Banknote, Plus, Pencil, RotateCcw,
} from 'lucide-react';

type Method = 'alipay' | 'wechat' | 'bank_transfer' | 'cash';

/* ── small building blocks ────────────────────────────────────────────── */

function Caption({ children }: { children: React.ReactNode }) {
  return (
    <p className={cn('mb-2 ml-1 text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>
      {children}
    </p>
  );
}

/** A standalone "sheet" panel (grabber + title) to read as the bottom-drawer. */
function Sheet({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-[28px] p-5',
        SURFACE.card,
        'shadow-[0_-12px_40px_-12px_rgba(46,32,92,0.30)] dark:shadow-none dark:ring-1 dark:ring-white/[0.06]',
      )}
    >
      <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-black/10 dark:bg-white/15" />
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className={cn('text-[18px] font-extrabold tracking-tight', TEXT.strong)}>{title}</h2>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.05] dark:bg-white/[0.06]">
          <X className={cn('h-4 w-4', TEXT.muted)} />
        </span>
      </div>
      {children}
    </div>
  );
}

/** In-sheet section label with an index dot — gives the form a clear rhythm. */
function SectionLabel({ n, children, hint }: { n: number; children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-2.5 mt-1 flex items-center gap-2">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#8B5CF6] text-[11px] font-black text-white">
        {n}
      </span>
      <span className={cn('text-[13px] font-extrabold', TEXT.strong)}>{children}</span>
      {hint && <span className={cn('text-[11.5px] font-medium', TEXT.muted)}>· {hint}</span>}
    </div>
  );
}

function Field({ label, children, optional }: { label: string; children: React.ReactNode; optional?: boolean }) {
  return (
    <div className="mb-3">
      <label className={cn('mb-1.5 ml-0.5 flex items-center gap-1.5 text-[12.5px] font-bold', TEXT.strong)}>
        {label}
        {optional && <span className={cn('text-[11px] font-medium', TEXT.muted)}>(optionnel)</span>}
      </label>
      {children}
    </div>
  );
}

function Input({ value, placeholder, mono }: { value?: string; placeholder?: string; mono?: boolean }) {
  return (
    <div
      className={cn(
        'flex h-[46px] items-center rounded-2xl px-3.5 text-[15px]',
        'bg-black/[0.035] ring-1 ring-inset ring-black/[0.06] dark:bg-white/[0.05] dark:ring-white/[0.08]',
        mono && 'tabular-nums',
        value ? TEXT.strong : TEXT.muted,
      )}
    >
      {value || placeholder}
    </div>
  );
}

/* ── method selector (REAL logos) ─────────────────────────────────────── */

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

/* ── amount + rate block (the redesigned hierarchy) ───────────────────── */

function AmountRateBlock({ custom = false }: { custom?: boolean }) {
  return (
    <div className="rounded-[22px] bg-black/[0.035] p-3.5 ring-1 ring-inset ring-black/[0.06] dark:bg-white/[0.04] dark:ring-white/[0.08]">
      {/* currency segment */}
      <div className="mb-3 inline-flex rounded-full bg-black/[0.05] p-0.5 dark:bg-white/[0.06]">
        <span className="rounded-full bg-white px-3.5 py-1 text-[12px] font-bold text-[#1B1A24] shadow-sm dark:bg-[#F2F1F7]">
          ¥ RMB
        </span>
        <span className={cn('px-3.5 py-1 text-[12px] font-bold', TEXT.muted)}>XAF</span>
      </div>

      {/* hero amount */}
      <div className="flex items-baseline gap-2">
        <span className={cn('text-[34px] font-extrabold leading-none tracking-tight tabular-nums', TEXT.strong)}>
          47 600
        </span>
        <span className="text-[20px] font-extrabold text-[#E0322B]">¥</span>
      </div>
      <p className={cn('mt-1.5 text-[13px] font-semibold tabular-nums', TEXT.muted)}>
        ≈ <span className="text-[#8B5CF6]">4 132 000 XAF</span> débités du solde
      </p>

      {/* rate control — clear, not a buried link */}
      <div className="mt-3 border-t border-black/[0.06] pt-3 dark:border-white/[0.07]">
        {!custom ? (
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={cn('text-[12.5px] font-bold', TEXT.strong)}>Taux du jour</span>
                <span className="rounded-full bg-[#2E7D52]/12 px-1.5 py-0.5 text-[10px] font-bold text-[#2E7D52]">
                  auto
                </span>
              </div>
              <p className={cn('text-[12px] tabular-nums', TEXT.muted)}>11 530 ¥ / 1 000 000 XAF</p>
            </div>
            <span className="flex items-center gap-1.5 rounded-full bg-[#8B5CF6]/12 px-3 py-1.5 text-[12px] font-bold text-[#8B5CF6]">
              <Pencil className="h-3.5 w-3.5" /> Personnaliser
            </span>
          </div>
        ) : (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className={cn('text-[12.5px] font-bold', TEXT.strong)}>Taux personnalisé</span>
                <span className="rounded-full bg-[#E8932A]/15 px-1.5 py-0.5 text-[10px] font-bold text-[#E8932A]">
                  manuel
                </span>
              </div>
              <span className="flex items-center gap-1 text-[11.5px] font-bold text-[#8B5CF6]">
                <RotateCcw className="h-3 w-3" /> Taux du jour
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-[42px] flex-1 items-center rounded-xl bg-white px-3 text-[15px] font-bold tabular-nums text-[#1B1A24] ring-1 ring-inset ring-[#E8932A]/40 dark:bg-[#26242F] dark:text-white">
                11 800
              </div>
              <span className={cn('text-[11.5px] font-medium', TEXT.muted)}>¥ / 1 000 000<br />XAF</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── QR zone (Alipay / WeChat) ────────────────────────────────────────── */

function QrFilled() {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-black/[0.035] p-2.5 ring-1 ring-inset ring-black/[0.06] dark:bg-white/[0.05] dark:ring-white/[0.08]">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-black/10">
        <QrCode className="h-9 w-9 text-[#1B1A24]" strokeWidth={1.5} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn('flex items-center gap-1.5 text-[13px] font-bold', TEXT.strong)}>
          <Check className="h-4 w-4 text-[#2E7D52]" /> QR code ajouté
        </p>
        <p className={cn('truncate text-[11.5px]', TEXT.muted)}>alipay-qr.png · prêt</p>
      </div>
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.05] dark:bg-white/[0.06]">
        <X className={cn('h-4 w-4', TEXT.muted)} />
      </span>
    </div>
  );
}

function QrEmpty() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-black/12 bg-black/[0.015] px-3.5 py-3 dark:border-white/15 dark:bg-white/[0.02]">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#8B5CF6]/10">
        <QrCode className="h-6 w-6 text-[#8B5CF6]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn('text-[13px] font-bold', TEXT.strong)}>Ajouter le QR code</p>
        <p className={cn('text-[11.5px]', TEXT.muted)}>Le plus fiable pour Alipay / WeChat</p>
      </div>
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#8B5CF6] text-white">
        <Plus className="h-4 w-4" />
      </span>
    </div>
  );
}

/* ── identifier with type chips ───────────────────────────────────────── */

function IdentifierField({ filled }: { filled?: boolean }) {
  const chips = [
    { k: 'id', label: 'ID', icon: Hash, on: true },
    { k: 'phone', label: 'Téléphone', icon: Phone, on: false },
    { k: 'email', label: 'E-mail', icon: Mail, on: false },
  ];
  return (
    <div className="mb-3">
      <label className={cn('mb-1.5 ml-0.5 block text-[12.5px] font-bold', TEXT.strong)}>Identifiant</label>
      <div className="mb-2 flex gap-1.5">
        {chips.map((c) => (
          <span
            key={c.k}
            className={cn(
              'flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-bold',
              c.on
                ? 'bg-[#8B5CF6] text-white'
                : cn('bg-black/[0.05] dark:bg-white/[0.06]', TEXT.muted),
            )}
          >
            <c.icon className="h-3 w-3" /> {c.label}
          </span>
        ))}
      </div>
      <Input value={filled ? 'supplier_gz_8821' : undefined} placeholder="ID Alipay du fournisseur" />
    </div>
  );
}

/* ── full sheets per method ───────────────────────────────────────────── */

function AlipaySheet() {
  return (
    <Sheet title="Nouveau bénéficiaire">
      <SectionLabel n={1}>Méthode</SectionLabel>
      <div className="mb-5">
        <MethodSelector active="alipay" />
      </div>

      <SectionLabel n={2}>Montant &amp; taux</SectionLabel>
      <div className="mb-5">
        <AmountRateBlock />
      </div>

      <SectionLabel n={3} hint="QR ou identifiant requis">Bénéficiaire</SectionLabel>
      <Field label="QR code">
        <QrFilled />
      </Field>
      <IdentifierField filled />
      <Field label="Nom du bénéficiaire">
        <Input value="Guangzhou Textile Co." />
      </Field>
      <Field label="Téléphone" optional>
        <Input placeholder="+86 …" />
      </Field>

      <div className="mt-4 flex gap-2.5">
        <span className={cn('flex h-12 flex-1 items-center justify-center rounded-full text-[14px] font-bold', 'bg-black/[0.05] dark:bg-white/[0.06]', TEXT.strong)}>
          Annuler
        </span>
        <span className="flex h-12 flex-[1.4] items-center justify-center gap-1.5 rounded-full bg-[#1C1B22] text-[14px] font-bold text-white dark:bg-[#F2F1F7] dark:text-[#1B1A24]">
          <Plus className="h-4 w-4" /> Ajouter le bénéficiaire
        </span>
      </div>
    </Sheet>
  );
}

function VirementSheet() {
  return (
    <Sheet title="Nouveau bénéficiaire">
      <SectionLabel n={1}>Méthode</SectionLabel>
      <div className="mb-5">
        <MethodSelector active="bank_transfer" />
      </div>
      <SectionLabel n={3}>Bénéficiaire</SectionLabel>
      <Field label="Nom du bénéficiaire">
        <Input value="Shenzhen Imp. & Exp. Ltd" />
      </Field>
      <Field label="Banque">
        <div className="flex items-center gap-2">
          <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-2xl bg-[#8B5CF6]/12">
            <Landmark className="h-5 w-5 text-[#8B5CF6]" />
          </span>
          <div className="flex-1"><Input value="Bank of China" /></div>
        </div>
      </Field>
      <Field label="Numéro de compte / IBAN">
        <Input value="6217 0000 1234 5678" mono />
      </Field>
      <Field label="SWIFT / agence" optional>
        <Input placeholder="BKCHCNBJ…" />
      </Field>
    </Sheet>
  );
}

function CashSheet() {
  return (
    <Sheet title="Nouveau bénéficiaire">
      <SectionLabel n={1}>Méthode</SectionLabel>
      <div className="mb-5">
        <MethodSelector active="cash" />
      </div>
      <SectionLabel n={3}>Bénéficiaire</SectionLabel>
      <Field label="Nom du bénéficiaire">
        <Input value="Li Wei" />
      </Field>
      <Field label="Téléphone">
        <div className="flex items-center gap-2">
          <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-2xl bg-[#E0322B]/12">
            <Banknote className="h-5 w-5 text-[#E0322B]" />
          </span>
          <div className="flex-1"><Input value="+86 138 0000 0000" mono /></div>
        </div>
      </Field>
      <div className="mt-2 flex items-start gap-2 rounded-2xl bg-[#8B5CF6]/[0.08] px-3.5 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#8B5CF6]" />
        <p className={cn('text-[12px] leading-snug', TEXT.strong)}>
          Un QR de retrait est généré automatiquement pour ce paiement cash — rien à joindre.
        </p>
      </div>
    </Sheet>
  );
}

/* ── exported maquette: stacked states ────────────────────────────────── */

export function BulkBenefDrawerMock() {
  return (
    <div className={cn('min-h-screen w-full px-4 py-6', SURFACE.canvas)}>
      <div className="mx-auto w-full max-w-[420px] space-y-8">
        <div>
          <h1 className={cn('text-[20px] font-extrabold tracking-tight', TEXT.strong)}>
            Refonte — drawer « Nouveau bénéficiaire »
          </h1>
          <p className={cn('mt-0.5 text-[12.5px]', TEXT.muted)}>
            Vrais logos · QR Alipay/WeChat · hiérarchie montant/taux · animation slide-up
          </p>
        </div>

        <div>
          <Caption>Alipay — avec QR code</Caption>
          <AlipaySheet />
        </div>

        <div>
          <Caption>Bloc taux — état « personnalisé »</Caption>
          <div className={cn('rounded-[28px] p-5', SURFACE.card, 'dark:ring-1 dark:ring-white/[0.06]')}>
            <AmountRateBlock custom />
          </div>
        </div>

        <div>
          <Caption>QR — état vide (à joindre)</Caption>
          <div className={cn('rounded-[28px] p-5', SURFACE.card, 'dark:ring-1 dark:ring-white/[0.06]')}>
            <QrEmpty />
          </div>
        </div>

        <div>
          <Caption>Virement</Caption>
          <VirementSheet />
        </div>

        <div>
          <Caption>Cash</Caption>
          <CashSheet />
        </div>
      </div>
    </div>
  );
}

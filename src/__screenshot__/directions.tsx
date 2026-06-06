/**
 * DEV-ONLY visual-direction mockups (static) for the founder to choose an
 * aesthetic. Same screen (Nouvel achat USDT), three distinct design languages.
 * Throwaway preview — the chosen one gets implemented for real.
 */
import { ChevronDown, ChevronRight, ChevronLeft, Plus } from 'lucide-react';

function Header({ title }: { title: string }) {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center border-b border-border bg-background/95 px-2 backdrop-blur-xl">
      <button className="flex h-10 w-10 items-center justify-center rounded-full text-foreground">
        <ChevronLeft className="h-6 w-6" />
      </button>
      <h1 className="flex-1 text-center text-base font-semibold">{title}</h1>
      <div className="w-10" />
    </header>
  );
}

/* ─────────────────── Direction A — Soft / Filled (Revolut-like) ─────────────────── */
export function DirectionA() {
  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label className="mb-2 block text-[13px] font-semibold text-muted-foreground">{label}</label>
      {children}
    </div>
  );
  const Soft = 'flex h-[54px] items-center rounded-2xl bg-muted/70 px-4';
  return (
    <div className="min-h-full bg-background">
      <Header title="Nouvel achat USDT" />
      <div className="space-y-6 px-5 py-6">
        <Field label="Fournisseur">
          <div className={`${Soft} justify-between`}>
            <span className="text-[16px] font-medium">Wang Crypto OTC</span>
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          </div>
        </Field>
        <Field label="Compte XAF débité">
          <div className={`${Soft} justify-between`}>
            <span className="text-[16px] font-medium">UBA XAF principal</span>
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          </div>
        </Field>
        <Field label="XAF payé">
          <div className={`${Soft} justify-between`}>
            <span className="text-[22px] font-bold tabular-nums tracking-tight">15 000 000</span>
            <span className="text-[13px] font-semibold text-muted-foreground">XAF</span>
          </div>
        </Field>
        <Field label="USDT reçu">
          <div className={`${Soft} justify-between`}>
            <span className="text-[22px] font-bold tabular-nums tracking-tight">24 783,15</span>
            <span className="text-[13px] font-semibold text-muted-foreground">USDT</span>
          </div>
        </Field>
        <div className="flex items-center justify-between rounded-2xl bg-muted/40 px-4 py-3 text-[13px]">
          <span className="text-muted-foreground">Taux implicite</span>
          <span className="font-semibold tabular-nums">605,2456 <span className="font-normal text-muted-foreground">XAF/USDT</span></span>
        </div>
        <button className="h-14 w-full rounded-2xl bg-bonzini-violet text-[16px] font-bold text-white shadow-[0_12px_30px_-10px_hsl(258_100%_60%/0.55)]">
          Enregistrer l’achat
        </button>
      </div>
    </div>
  );
}

/* ─────────────────── Direction B — Crisp / Bordered (Linear/Stripe-like) ─────────────────── */
export function DirectionB() {
  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</label>
      {children}
    </div>
  );
  return (
    <div className="min-h-full bg-background">
      <Header title="Nouvel achat USDT" />
      <div className="space-y-4 px-4 py-5">
        <Field label="Fournisseur">
          <div className="flex h-11 items-center justify-between rounded-lg border border-border bg-card px-3">
            <span className="text-[15px] font-medium">Wang Crypto OTC</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </Field>
        <Field label="Compte XAF débité">
          {/* shown with a focus ring to demo the state */}
          <div className="flex h-11 items-center justify-between rounded-lg border-2 border-bonzini-violet bg-card px-3 ring-4 ring-bonzini-violet/15">
            <span className="text-[15px] font-medium">UBA XAF principal</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="XAF payé">
            <div className="flex h-11 items-center justify-between rounded-lg border border-border bg-card px-3">
              <span className="text-[15px] font-bold tabular-nums">15 000 000</span>
              <span className="text-[11px] font-semibold text-muted-foreground">XAF</span>
            </div>
          </Field>
          <Field label="USDT reçu">
            <div className="flex h-11 items-center justify-between rounded-lg border border-border bg-card px-3">
              <span className="text-[15px] font-bold tabular-nums">24 783,15</span>
              <span className="text-[11px] font-semibold text-muted-foreground">USDT</span>
            </div>
          </Field>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-3 text-[13px]">
          <span className="text-muted-foreground">Taux implicite</span>
          <span className="font-semibold tabular-nums">605,2456 XAF/USDT</span>
        </div>
        <button className="mt-1 h-11 w-full rounded-lg bg-bonzini-violet text-[15px] font-semibold text-white">
          Enregistrer l’achat
        </button>
      </div>
    </div>
  );
}

/* ─────────────────── Direction C — Grouped card (Mercury/iOS-like) ─────────────────── */
export function DirectionC() {
  const Row = ({ label, value, unit, chevron, muted }: { label: string; value: string; unit?: string; chevron?: boolean; muted?: boolean }) => (
    <div className="flex items-center justify-between px-4 py-3.5">
      <span className="text-[14px] text-muted-foreground">{label}</span>
      <span className={`flex items-center gap-1.5 text-[15px] tabular-nums ${muted ? 'text-muted-foreground' : 'font-semibold text-foreground'}`}>
        {value}
        {unit && <span className="text-[12px] font-normal text-muted-foreground">{unit}</span>}
        {chevron && <ChevronRight className="h-4 w-4 text-muted-foreground/60" />}
      </span>
    </div>
  );
  return (
    <div className="min-h-full bg-background">
      <Header title="Nouvel achat USDT" />
      <div className="space-y-4 px-4 py-5">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm divide-y divide-border">
          <Row label="Fournisseur" value="Wang Crypto OTC" chevron />
          <Row label="Compte XAF" value="UBA XAF principal" chevron />
          <Row label="XAF payé" value="15 000 000" unit="XAF" />
          <Row label="USDT reçu" value="24 783,15" unit="USDT" />
          <Row label="Taux implicite" value="605,2456" unit="XAF/USDT" muted />
        </div>
        <button className="flex items-center gap-1 px-1 text-[13px] font-semibold text-bonzini-violet">
          <Plus className="h-4 w-4" /> Répartir sur plusieurs comptes
        </button>
        <button className="h-13 w-full rounded-2xl bg-bonzini-violet py-3.5 text-[16px] font-bold text-white">
          Enregistrer l’achat
        </button>
      </div>
    </div>
  );
}

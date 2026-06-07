/**
 * DEV-ONLY maquette — redesign of Mola's in-chat cards with the new flat design
 * language (hairline borders, no gradients/shadows, IconChip, charcoal focal
 * amount, tonal status). Static mock data; rendered by the screenshot harness
 * at /screenshot.html?screen=mola. Never imported by the production app.
 *
 * Keeps the exact data contract of ProposalSummary (title, subtitle, amount,
 * lines, confirmLabel, danger) + states — only the presentation changes.
 */
import type { ReactNode } from 'react';
import {
  ArrowUpFromLine,
  ArrowDownToLine,
  AlertTriangle,
  Check,
  ChevronRight,
  ShieldAlert,
  RotateCw,
  Bot,
} from 'lucide-react';

/* ── shared bits ─────────────────────────────────────────────────────────── */

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/50 py-2 text-[13px] last:border-0">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function Caption({ children }: { children: ReactNode }) {
  return <p className="px-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">{children}</p>;
}

/* ── BEFORE: replica of today's ConfirmationCard ─────────────────────────── */

function OldConfirmCard() {
  const accent = 'hsl(258,100%,60%)';
  return (
    <div
      className="w-full overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
      style={{ borderLeftWidth: 4, borderLeftColor: accent }}
    >
      <div className="px-4 pb-2 pt-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">À confirmer</p>
        <p className="text-[15px] font-semibold">Régler Shenzhen Tech Co.</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Paiement fournisseur</p>
      </div>
      <div className="px-4 pb-1">
        <span className="text-2xl font-extrabold tracking-tight">12 500 000 XAF</span>
      </div>
      <div className="space-y-1.5 px-4 py-2">
        {[['Client', 'Awa Diop'], ['Méthode', 'Alipay'], ['Solde après', '36 250 000 XAF']].map(([l, v]) => (
          <div key={l} className="flex items-center justify-between gap-3 text-[13px]">
            <span className="shrink-0 text-muted-foreground">{l}</span>
            <span className="text-right font-medium">{v}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-2 p-3">
        <button
          className="flex-1 rounded-xl py-3 text-sm font-bold text-white"
          style={{ background: `linear-gradient(135deg, ${accent}, hsl(16,100%,55%))` }}
        >
          Confirmer
        </button>
        <button className="rounded-xl bg-muted px-4 py-3 text-sm font-semibold text-foreground">Annuler</button>
      </div>
    </div>
  );
}

/* ── AFTER: redesigned cards ─────────────────────────────────────────────── */

function ConfirmPayment() {
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card">
      <div className="flex items-start gap-3 p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600">
          <ArrowUpFromLine className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Paiement fournisseur · à confirmer</div>
          <div className="mt-0.5 text-[16px] font-bold leading-tight text-foreground">Régler Shenzhen Tech Co.</div>
        </div>
      </div>

      <div className="mx-4 rounded-2xl bg-muted/60 px-4 py-3">
        <div className="text-[11px] font-medium text-muted-foreground">Montant à débiter</div>
        <div className="mt-0.5 text-[26px] font-extrabold leading-none tracking-tight tabular-nums text-foreground">12 500 000 XAF</div>
        <div className="mt-1 text-[12px] text-muted-foreground">≈ 178 500 CNY · taux 70,03</div>
      </div>

      <div className="px-4 py-3">
        <Row label="Client" value="Awa Diop · BZ-CL-0042" />
        <Row label="Méthode" value="Alipay" />
        <Row label="Solde du client après" value="36 250 000 XAF" />
      </div>

      <div className="flex gap-2 px-4 pb-4">
        <button className="flex-1 rounded-2xl bg-foreground py-3 text-[14px] font-bold text-background">Confirmer le paiement</button>
        <button className="rounded-2xl bg-muted px-5 py-3 text-[14px] font-semibold text-foreground">Annuler</button>
      </div>
    </div>
  );
}

function ConfirmDanger() {
  return (
    <div className="overflow-hidden rounded-3xl border border-orange-500/30 bg-card">
      <div className="flex items-start gap-3 p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-600">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-orange-600">Action sensible</div>
          <div className="mt-0.5 text-[16px] font-bold leading-tight text-foreground">Rejeter le dépôt BZ-DP-0188</div>
        </div>
      </div>

      <div className="mx-4 flex items-start gap-2 rounded-2xl bg-orange-500/10 px-3.5 py-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
        <p className="text-[12px] leading-snug text-orange-700 dark:text-orange-300">
          Le client sera notifié et les fonds ne seront pas crédités. Action irréversible.
        </p>
      </div>

      <div className="px-4 py-3">
        <Row label="Client" value="Jean Kamga" />
        <Row label="Montant" value="2 500 000 XAF" />
        <Row label="Motif" value="Justificatif illisible" />
      </div>

      <div className="flex gap-2 px-4 pb-4">
        <button className="flex-1 rounded-2xl bg-orange-600 py-3 text-[14px] font-bold text-white">Rejeter le dépôt</button>
        <button className="rounded-2xl bg-muted px-5 py-3 text-[14px] font-semibold text-foreground">Annuler</button>
      </div>
    </div>
  );
}

function ResultDone() {
  return (
    <div className="rounded-3xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
          <Check className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-bold text-foreground">Paiement exécuté</div>
          <div className="text-[12px] text-muted-foreground">12 500 000 XAF · réf BZ-PM-2026-0042</div>
        </div>
        <button className="flex items-center gap-0.5 text-[12px] font-semibold text-violet-600">
          Reçu <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function ResultFailed() {
  return (
    <div className="rounded-3xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-600">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-bold text-foreground">Paiement non exécuté</div>
          <div className="text-[12px] text-muted-foreground">Solde insuffisant (manque 1 250 000 XAF)</div>
        </div>
        <button className="flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-[12px] font-semibold text-foreground">
          <RotateCw className="h-3.5 w-3.5" /> Réessayer
        </button>
      </div>
    </div>
  );
}

function DisplayElement() {
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card">
      <div className="flex items-center gap-3 p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
          <ArrowDownToLine className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Dépôt · BZ-DP-2026-0188</div>
          <div className="mt-0.5 text-[16px] font-bold text-foreground">Awa Diop</div>
        </div>
        <span className="shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-600">Validé</span>
      </div>

      <div className="mx-4 rounded-2xl bg-muted/60 px-4 py-3">
        <div className="text-[26px] font-extrabold leading-none tracking-tight tabular-nums text-foreground">2 500 000 XAF</div>
      </div>

      <div className="px-4 py-3">
        <Row label="Méthode" value="Virement bancaire" />
        <Row label="Reçu le" value="7 juin 2026 · 14:32" />
        <Row label="Validé par" value="Demo Admin" />
      </div>

      <button className="flex w-full items-center justify-center gap-1 border-t border-border/60 py-3 text-[13px] font-semibold text-violet-600">
        Ouvrir la fiche <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export function MolaCards() {
  return (
    <div className="min-h-screen space-y-3 bg-muted/30 px-4 py-5">
      <div className="flex items-center gap-2 pb-1">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(258,100%,60%)] to-[hsl(16,100%,55%)] text-white">
          <Bot className="h-4 w-4" />
        </div>
        <span className="text-[13px] font-semibold text-muted-foreground">Mola · cartes (maquette)</span>
      </div>

      <Caption>Aujourd'hui</Caption>
      <OldConfirmCard />

      <Caption>Proposition — confirmation</Caption>
      <ConfirmPayment />

      <Caption>Proposition — action sensible</Caption>
      <ConfirmDanger />

      <Caption>Proposition — résultats</Caption>
      <ResultDone />
      <ResultFailed />

      <Caption>Proposition — affichage d'un élément</Caption>
      <DisplayElement />
    </div>
  );
}

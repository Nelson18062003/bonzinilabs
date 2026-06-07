/**
 * DEV-ONLY maquette — Mola's in-chat cards redrawn in the language of the
 * reference (Ofspace "Banking App UI", dribbble 21114606):
 *   soft lilac canvas · white cards w/ soft diffuse shadow (no hard borders) ·
 *   neutral circular holders (no colored chips) · NO row dividers · no gradients ·
 *   big focal numbers · dark rounded-full pill CTAs · very restrained color.
 *
 * Static mock data; rendered by the harness at /screenshot.html?screen=mola.
 * Keeps the exact ProposalSummary contract (title/subtitle/amount/lines/
 * confirmLabel/danger + states) — only presentation changes.
 */
import type { ReactNode } from 'react';
import { Check, AlertTriangle, ChevronRight, RotateCw, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── primitives ──────────────────────────────────────────────────────────── */

function MCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[26px] bg-white p-5 shadow-[0_8px_30px_-10px_rgba(46,32,92,0.20)] dark:bg-[#211F2B] dark:shadow-none">
      {children}
    </div>
  );
}

const HOLDER_NEUTRAL = 'bg-[#EDEAFA] text-[#2C2740] dark:bg-[#2F2C3D] dark:text-[#E7E5F0]';

function Avatar({ children, tone }: { children: ReactNode; tone?: string }) {
  return (
    <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[15px] font-bold', tone ?? HOLDER_NEUTRAL)}>
      {children}
    </div>
  );
}

function Title({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="truncate text-[16px] font-bold leading-tight text-[#1B1A24] dark:text-[#F2F1F7]">{title}</div>
      <div className="mt-0.5 truncate text-[13px] text-[#8E8BA0] dark:text-[#9B98AD]">{subtitle}</div>
    </div>
  );
}

function Amount({ value, unit }: { value: string; unit: string }) {
  return (
    <div className="text-[30px] font-extrabold leading-none tracking-tight tabular-nums text-[#1B1A24] dark:text-[#F2F1F7]">
      {value}
      <span className="ml-1.5 text-[15px] font-bold text-[#AAA7BD] dark:text-[#6F6C82]">{unit}</span>
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <div className="text-[12px] font-medium text-[#8E8BA0] dark:text-[#9B98AD]">{children}</div>;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-[7px] text-[13.5px]">
      <span className="text-[#8E8BA0] dark:text-[#9B98AD]">{label}</span>
      <span className="text-right font-semibold tabular-nums text-[#1B1A24] dark:text-[#F2F1F7]">{value}</span>
    </div>
  );
}

function PrimaryPill({ children, danger }: { children: ReactNode; danger?: boolean }) {
  return (
    <button
      className={cn(
        'flex-1 rounded-full py-[13px] text-[14px] font-bold',
        danger ? 'bg-[#D14343] text-white' : 'bg-[#1C1B22] text-white dark:bg-[#F2F1F7] dark:text-[#1B1A24]',
      )}
    >
      {children}
    </button>
  );
}

function SoftPill({ children, full }: { children: ReactNode; full?: boolean }) {
  return (
    <button
      className={cn(
        'rounded-full bg-[#EDEAFA] text-[14px] font-semibold text-[#2C2740] dark:bg-[#2F2C3D] dark:text-[#E7E5F0]',
        full ? 'flex w-full items-center justify-center gap-1 py-[13px] text-[13.5px]' : 'px-6 py-[13px]',
      )}
    >
      {children}
    </button>
  );
}

/** A short Mola "chat line" preceding a card, for context. */
function Says({ children }: { children: ReactNode }) {
  return <p className="px-1 pt-1 text-[13.5px] leading-snug text-[#6B6880] dark:text-[#9B98AD]">{children}</p>;
}

/* ── cards ───────────────────────────────────────────────────────────────── */

function ConfirmPayment() {
  return (
    <MCard>
      <div className="flex items-center gap-3">
        <Avatar>ST</Avatar>
        <Title title="Régler Shenzhen Tech Co." subtitle="Paiement fournisseur · pour Awa Diop" />
      </div>
      <div className="mt-5">
        <Label>Montant à débiter</Label>
        <div className="mt-1.5"><Amount value="12 500 000" unit="XAF" /></div>
        <div className="mt-1.5 text-[12px] text-[#8E8BA0] dark:text-[#9B98AD]">≈ 178 500 CNY · taux 70,03</div>
      </div>
      <div className="mt-4">
        <Row label="Client" value="Awa Diop · BZ-CL-0042" />
        <Row label="Méthode" value="Alipay" />
        <Row label="Solde du client après" value="36 250 000 XAF" />
      </div>
      <div className="mt-5 flex gap-2.5">
        <PrimaryPill>Confirmer</PrimaryPill>
        <SoftPill>Annuler</SoftPill>
      </div>
    </MCard>
  );
}

function ConfirmDanger() {
  return (
    <MCard>
      <div className="flex items-center gap-3">
        <Avatar tone="bg-[#FBE7E7] text-[#B23A3A] dark:bg-[#3A2526] dark:text-[#E79A9A]">JK</Avatar>
        <Title title="Rejeter le dépôt" subtitle="Jean Kamga · BZ-DP-0188" />
      </div>
      <div className="mt-4 flex items-start gap-2 rounded-2xl bg-[#FBEFEF] px-3.5 py-2.5 dark:bg-[#2C1F20]">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#C0504D]" />
        <p className="text-[12.5px] leading-snug text-[#9B4A47] dark:text-[#E0A3A1]">
          Action irréversible. Le client sera notifié et les fonds ne seront pas crédités.
        </p>
      </div>
      <div className="mt-3">
        <Row label="Montant" value="2 500 000 XAF" />
        <Row label="Motif" value="Justificatif illisible" />
      </div>
      <div className="mt-5 flex gap-2.5">
        <PrimaryPill danger>Rejeter le dépôt</PrimaryPill>
        <SoftPill>Annuler</SoftPill>
      </div>
    </MCard>
  );
}

function ResultDone() {
  return (
    <MCard>
      <div className="flex items-center gap-3">
        <Avatar tone="bg-[#DEEFE5] text-[#2E7D52] dark:bg-[#1E3A2C] dark:text-[#7FCBA0]">
          <Check className="h-5 w-5" />
        </Avatar>
        <Title title="Paiement exécuté" subtitle="12 500 000 XAF · BZ-PM-2026-0042" />
        <button className="flex shrink-0 items-center gap-0.5 text-[13px] font-semibold text-[#6B5BD2] dark:text-[#A99BF0]">
          Reçu <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </MCard>
  );
}

function ResultFailed() {
  return (
    <MCard>
      <div className="flex items-center gap-3">
        <Avatar tone="bg-[#FBE7E7] text-[#C0504D] dark:bg-[#3A2526] dark:text-[#E79A9A]">
          <AlertTriangle className="h-5 w-5" />
        </Avatar>
        <Title title="Paiement non exécuté" subtitle="Solde insuffisant — manque 1 250 000 XAF" />
        <button className="flex shrink-0 items-center gap-1 rounded-full bg-[#EDEAFA] px-3 py-1.5 text-[12px] font-semibold text-[#2C2740] dark:bg-[#2F2C3D] dark:text-[#E7E5F0]">
          <RotateCw className="h-3.5 w-3.5" /> Réessayer
        </button>
      </div>
    </MCard>
  );
}

function DisplayElement() {
  return (
    <MCard>
      <div className="flex items-center gap-3">
        <Avatar>AD</Avatar>
        <Title title="Awa Diop" subtitle="Dépôt · BZ-DP-2026-0188" />
        <span className="shrink-0 rounded-full bg-[#DEEFE5] px-2.5 py-1 text-[11px] font-bold text-[#2E7D52] dark:bg-[#1E3A2C] dark:text-[#7FCBA0]">
          Validé
        </span>
      </div>
      <div className="mt-5">
        <Label>Montant</Label>
        <div className="mt-1.5"><Amount value="2 500 000" unit="XAF" /></div>
      </div>
      <div className="mt-4">
        <Row label="Méthode" value="Virement bancaire" />
        <Row label="Reçu le" value="7 juin 2026 · 14:32" />
        <Row label="Validé par" value="Demo Admin" />
      </div>
      <div className="mt-5">
        <SoftPill full>Ouvrir la fiche <ChevronRight className="h-4 w-4" /></SoftPill>
      </div>
    </MCard>
  );
}

export function MolaCards() {
  return (
    <div className="min-h-screen space-y-3.5 bg-[#ECEAF7] px-4 py-6 dark:bg-[#141320]">
      {/* Mola header */}
      <div className="flex items-center gap-2.5 pb-1">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#2C2740] shadow-[0_4px_14px_-4px_rgba(46,32,92,0.3)] dark:bg-[#211F2B] dark:text-[#E7E5F0] dark:shadow-none">
          <Bot className="h-4 w-4" />
        </div>
        <div>
          <div className="text-[14px] font-bold text-[#1B1A24] dark:text-[#F2F1F7]">Mola</div>
          <div className="text-[11px] text-[#8E8BA0] dark:text-[#9B98AD]">Directeur des opérations</div>
        </div>
      </div>

      <Says>Voici le paiement à confirmer 👇</Says>
      <ConfirmPayment />

      <Says>Confirme le rejet de ce dépôt.</Says>
      <ConfirmDanger />

      <Says>C'est fait ✅</Says>
      <ResultDone />

      <Says>Ça n'a pas pu aboutir :</Says>
      <ResultFailed />

      <Says>Voici le dépôt BZ-DP-0188.</Says>
      <DisplayElement />
    </div>
  );
}

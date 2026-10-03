// ============================================================
// Logos des moyens de DÉPÔT — vrais logos de marque (premium).
//   · Mobile money : Orange (SVG officiel), Wave (pingouin officiel),
//     MTN (logo officiel 2022 : ovale et lettres noirs sur le jaune MTN).
//   · Banques : vrai logo (wordmark/emblème) sur tuile blanche — Ecobank,
//     UBA, Afriland ; CCA-Bank : son logo sur son fond violet d'origine.
//   · Banque générique : Landmark · Agence Bonzini : Store.
// Assets : src/assets/deposit-logos/* (récupérés via Wikimedia + sites de marque).
// ============================================================
import { Landmark, Store } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DepositMethod, DepositMethodFamily, BankOption } from '@/types/deposit';
import { banks } from '@/data/depositMethodsData';
import orangeLogo from '@/assets/deposit-logos/orange.svg';
import waveLogo from '@/assets/deposit-logos/wave.png';
import ecobankLogo from '@/assets/deposit-logos/ecobank.png';
import ubaLogo from '@/assets/deposit-logos/uba.svg';
import afrilandLogo from '@/assets/deposit-logos/afriland-mark.png';
import ccaLogo from '@/assets/bank-logos/cca.png';
import { MTN_LOGO_PATH, MTN_YELLOW } from '@/lib/brand/mtnLogo';

const tile = (size: number, radius?: number) =>
  ({ width: size, height: size, borderRadius: radius ?? Math.round(size * 0.27) }) as const;

function OrangeTile({ size, radius }: { size: number; radius?: number }) {
  return <img src={orangeLogo} alt="Orange Money" style={tile(size, radius)} className="shrink-0 object-cover" />;
}
function WaveTile({ size, radius }: { size: number; radius?: number }) {
  return <img src={waveLogo} alt="Wave" style={tile(size, radius)} className="shrink-0 object-cover" />;
}
function MtnTile({ size, radius }: { size: number; radius?: number }) {
  return (
    <div style={{ ...tile(size, radius), background: MTN_YELLOW }} className="flex shrink-0 items-center justify-center" role="img" aria-label="MTN Mobile Money">
      <svg viewBox="0 0 1280 640" style={{ width: size * 0.8, height: size * 0.4 }} aria-hidden><path d={MTN_LOGO_PATH} fill="#000" /></svg>
    </div>
  );
}
function AgencyTile({ size, radius }: { size: number; radius?: number }) {
  return (
    <div style={tile(size, radius)} className="flex shrink-0 items-center justify-center bg-[#2C2C2C]">
      <Store style={{ width: size * 0.5, height: size * 0.5 }} className="text-white" strokeWidth={1.9} />
    </div>
  );
}
function BankGenericTile({ size, radius }: { size: number; radius?: number }) {
  return (
    <div style={tile(size, radius)} className="flex shrink-0 items-center justify-center bg-[#3B3E9E]">
      <Landmark style={{ width: size * 0.5, height: size * 0.5 }} className="text-white" strokeWidth={1.9} />
    </div>
  );
}

/* ── Banques : vrai logo sur tuile blanche · CCA monogramme ──────────── */
const BANK_LOGOS: Partial<Record<BankOption, { label: string; src?: string; wide?: boolean; mono?: string; bg?: string; cover?: boolean }>> = {
  ECOBANK: { label: 'Ecobank', src: ecobankLogo, wide: true },
  UBA: { label: 'UBA', src: ubaLogo, wide: true },
  AFRILAND: { label: 'Afriland First Bank', src: afrilandLogo },
  CCA: { label: 'CCA-Bank', src: ccaLogo, cover: true, bg: '#663088' },
};

/** Libellé enregistré par l'équipe → clé de banque (« CCA-BANK Cameroun » → CCA). */
const BANK_BY_LABEL: Record<string, BankOption> = Object.fromEntries(banks.map((b) => [b.label, b.bank]));

export function DepositBankLogo({
  bank,
  size = 48,
  radius,
}: {
  bank: BankOption | string | null | undefined;
  size?: number;
  radius?: number;
}) {
  // Clé (« UBA ») ou libellé (« UBA Cameroun ») : les dépôts créés par l'équipe enregistrent le libellé.
  const key = bank ? (bank in BANK_LOGOS ? (bank as BankOption) : BANK_BY_LABEL[bank]) : undefined;
  const b = key ? BANK_LOGOS[key] : undefined;
  if (!b) return <BankGenericTile size={size} radius={radius} />;
  if (b.src && b.cover) {
    return (
      <div style={{ ...tile(size, radius), background: b.bg }} className="flex shrink-0 items-center justify-center overflow-hidden">
        {/* Logo large sur une tuile carrée : contenu entier (« CCA Bank »), sur son fond violet. */}
        <img src={b.src} alt={b.label} className="h-full w-full object-contain" />
      </div>
    );
  }
  if (!b.src) {
    return (
      <div style={{ ...tile(size, radius), background: b.bg }} className="flex shrink-0 items-center justify-center">
        <span className="font-bold tracking-tight text-white" style={{ fontSize: Math.round(size * 0.3), lineHeight: 1 }}>{b.mono}</span>
      </div>
    );
  }
  const w = b.wide ? size * 0.82 : size * 0.6;
  const h = b.wide ? size * 0.52 : size * 0.6;
  return (
    <div style={tile(size, radius)} className="flex shrink-0 items-center justify-center overflow-hidden bg-white ring-1 ring-black/[0.06]">
      <img src={b.src} alt={b.label} className="object-contain" style={{ width: w, height: h }} />
    </div>
  );
}

/** Logo par FAMILLE (écran de choix du moyen). */
export function DepositFamilyLogo({
  family,
  size = 48,
  radius,
}: {
  family: DepositMethodFamily;
  size?: number;
  radius?: number;
}) {
  switch (family) {
    case 'ORANGE_MONEY':
      return <OrangeTile size={size} radius={radius} />;
    case 'MTN_MONEY':
      return <MtnTile size={size} radius={radius} />;
    case 'WAVE':
      return <WaveTile size={size} radius={radius} />;
    case 'AGENCY_BONZINI':
      return <AgencyTile size={size} radius={radius} />;
    case 'BANK':
    default:
      return <BankGenericTile size={size} radius={radius} />;
  }
}

/** Logo par MÉTHODE DB (+ banque éventuelle) — liste / fiche / récap. */
export function DepositMethodLogo({
  method,
  bankName,
  size = 48,
  radius,
  className,
}: {
  method: DepositMethod | string;
  bankName?: string | null;
  size?: number;
  radius?: number;
  className?: string;
}) {
  const wrap = (el: React.ReactNode) => (className ? <span className={cn('inline-flex', className)}>{el}</span> : el);
  switch (method) {
    case 'om_transfer':
    case 'om_withdrawal':
      return wrap(<OrangeTile size={size} radius={radius} />);
    case 'mtn_transfer':
    case 'mtn_withdrawal':
      return wrap(<MtnTile size={size} radius={radius} />);
    case 'wave':
      return wrap(<WaveTile size={size} radius={radius} />);
    case 'agency_cash':
      return wrap(<AgencyTile size={size} radius={radius} />);
    case 'bank_transfer':
    case 'bank_cash':
      return wrap(<DepositBankLogo bank={bankName} size={size} radius={radius} />);
    default:
      return wrap(<BankGenericTile size={size} radius={radius} />);
  }
}

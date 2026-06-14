// ============================================================
// Logos des moyens de DÉPÔT — vrais logos de marque (premium).
//   · Mobile money : Orange (SVG officiel), Wave (pingouin officiel),
//     MTN (pastille jaune + « MTN » bleu — couleurs exactes ; le SVG libre
//     est monochrome).
//   · Banques : vrai logo (wordmark/emblème) sur tuile blanche — Ecobank,
//     UBA, Afriland. CCA : monogramme (logo officiel non disponible librement).
//   · Banque générique : Landmark · Agence Bonzini : Store.
// Assets : src/assets/deposit-logos/* (récupérés via Wikimedia + sites de marque).
// ============================================================
import { Landmark, Store } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DepositMethod, DepositMethodFamily, BankOption } from '@/types/deposit';
import orangeLogo from '@/assets/deposit-logos/orange.svg';
import waveLogo from '@/assets/deposit-logos/wave.png';
import ecobankLogo from '@/assets/deposit-logos/ecobank.png';
import ubaLogo from '@/assets/deposit-logos/uba.svg';
import afrilandLogo from '@/assets/deposit-logos/afriland-mark.png';

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
    <div style={{ ...tile(size, radius), background: '#FFCC00' }} className="flex shrink-0 items-center justify-center">
      <span className="font-black tracking-tighter text-[#004F9F]" style={{ fontSize: Math.round(size * 0.34), lineHeight: 1 }}>MTN</span>
    </div>
  );
}
function AgencyTile({ size, radius }: { size: number; radius?: number }) {
  return (
    <div style={tile(size, radius)} className="flex shrink-0 items-center justify-center bg-[#1C1B22]">
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
const BANK_LOGOS: Partial<Record<BankOption, { label: string; src?: string; wide?: boolean; mono?: string; bg?: string }>> = {
  ECOBANK: { label: 'Ecobank', src: ecobankLogo, wide: true },
  UBA: { label: 'UBA', src: ubaLogo, wide: true },
  AFRILAND: { label: 'Afriland First Bank', src: afrilandLogo },
  CCA: { label: 'CCA-BANK', mono: 'CCA', bg: '#1B3C8F' },
};

export function DepositBankLogo({
  bank,
  size = 48,
  radius,
}: {
  bank: BankOption | string | null | undefined;
  size?: number;
  radius?: number;
}) {
  const b = bank ? BANK_LOGOS[bank as BankOption] : undefined;
  if (!b) return <BankGenericTile size={size} radius={radius} />;
  if (!b.src) {
    return (
      <div style={{ ...tile(size, radius), background: b.bg }} className="flex shrink-0 items-center justify-center">
        <span className="font-black tracking-tight text-white" style={{ fontSize: Math.round(size * 0.3), lineHeight: 1 }}>{b.mono}</span>
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

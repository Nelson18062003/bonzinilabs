/**
 * Une écriture du grand livre en ligne v2 (fiche client 03/02, relevé 03/06) :
 * le vrai logo quand la description le dit (Orange Money, Alipay…), sinon
 * une icône ; le libellé, la date et l'auteur ; le montant signé à droite et,
 * dans le relevé, le solde après.
 */
import { ArrowDownToLine, ArrowUpRight, Diff, Package, RefreshCw, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ENTRY_TYPE_CONFIG } from '@/lib/ledgerDisplay';
import { DepositFamilyLogo } from '@/mobile/components/deposits/DepositLogos';
import { IconCircle, ItemRow, MethodCircle, TEXT } from '@/mobile/designKit';
import type { LedgerEntry } from '@/types/admin';
import type { DepositMethodFamily } from '@/types/deposit';
import { xaf } from './parts';

const dayFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
export const shortDay = (d: Date | string) => dayFmt.format(new Date(d)).replace(/\.$/, '.');

function paymentMethodOf(text: string): 'alipay' | 'wechat' | 'virement' | 'cash' | null {
  const t = text.toLowerCase();
  if (t.includes('alipay')) return 'alipay';
  if (t.includes('wechat')) return 'wechat';
  if (t.includes('virement') || t.includes('bank')) return 'virement';
  if (t.includes('cash') || t.includes('espèces')) return 'cash';
  return null;
}

function depositFamilyOf(text: string): DepositMethodFamily | null {
  const t = text.toLowerCase();
  if (t.includes('orange')) return 'ORANGE_MONEY';
  if (t.includes('mtn')) return 'MTN_MONEY';
  if (t.includes('wave')) return 'WAVE';
  if (t.includes('agence') || t.includes('cash')) return 'AGENCY_BONZINI';
  if (t.includes('virement') || t.includes('banque') || t.includes('bank') || t.includes('uba') || t.includes('afriland') || t.includes('ecobank')) return 'BANK';
  return null;
}

const PAY_LABEL = { alipay: 'Alipay', wechat: 'WeChat Pay', virement: 'Virement', cash: 'Cash' } as const;
const DEP_LABEL: Record<DepositMethodFamily, string> = { ORANGE_MONEY: 'Orange Money', MTN_MONEY: 'MTN MoMo', WAVE: 'Wave', AGENCY_BONZINI: 'Agence Bonzini', BANK: 'Banque' };

/** Le moyen lu dans la description (« Orange Money », « Alipay »), sinon null. */
export function ledgerVia(entry: LedgerEntry): string | null {
  const d = entry.description ?? '';
  if (entry.entryType === 'DEPOSIT_VALIDATED') { const f = depositFamilyOf(d); return f ? DEP_LABEL[f] : null; }
  if (entry.entryType === 'PAYMENT_RESERVED' || entry.entryType === 'PAYMENT_EXECUTED') { const m = paymentMethodOf(d); return m ? PAY_LABEL[m] : null; }
  return null;
}

/** Le rond de tête d'une écriture. */
export function LedgerLeading({ entry }: { entry: LedgerEntry }) {
  const d = entry.description ?? '';
  switch (entry.entryType) {
    case 'DEPOSIT_VALIDATED': {
      const f = depositFamilyOf(d);
      // Le vrai logo, en petit dans un rond blanc à filet (le carré Orange se rognait en rond plein).
      return f ? (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#D9D9D9] bg-white dark:border-[#444444]">
          <DepositFamilyLogo family={f} size={28} radius={6} />
        </span>
      ) : <IconCircle icon={ArrowDownToLine} />;
    }
    case 'PAYMENT_RESERVED':
    case 'PAYMENT_EXECUTED': {
      const m = paymentMethodOf(d);
      return m ? <MethodCircle method={m} /> : <IconCircle icon={ArrowUpRight} />;
    }
    case 'PAYMENT_CANCELLED_REFUNDED':
      return <IconCircle icon={RefreshCw} />;
    case 'CARGO_FEES':
      return <IconCircle icon={Package} />;
    case 'DEPOSIT_REFUSED':
      return <IconCircle icon={XCircle} />;
    default:
      return <IconCircle icon={Diff} />;
  }
}

/** Le titre court : « Dépôt », « Paiement », « Crédit · geste commercial »… */
export function ledgerTitle(entry: LedgerEntry): string {
  const d = (entry.description ?? '').trim();
  switch (entry.entryType) {
    case 'DEPOSIT_VALIDATED': return 'Dépôt';
    case 'PAYMENT_RESERVED':
    case 'PAYMENT_EXECUTED': return 'Paiement';
    case 'PAYMENT_CANCELLED_REFUNDED': return 'Paiement remboursé';
    case 'CARGO_FEES': return 'Fret';
    case 'ADMIN_CREDIT': return d ? `Crédit · ${d}` : 'Crédit';
    case 'ADMIN_DEBIT': return d ? `Débit · ${d}` : 'Débit';
    default: return ENTRY_TYPE_CONFIG[entry.entryType]?.label ?? 'Opération';
  }
}

/** Le montant signé, tel que le client le voit (une réservation est une sortie). */
export function ledgerSigned(entry: LedgerEntry): number {
  const cfg = ENTRY_TYPE_CONFIG[entry.entryType];
  const abs = Math.abs(entry.amountXAF);
  if (cfg?.isInformational) return 0;
  return cfg?.prefix === '-' ? -abs : abs;
}

export function LedgerItem({ entry, showBalance = false, onClick }: { entry: LedgerEntry; showBalance?: boolean; onClick?: () => void }) {
  const cfg = ENTRY_TYPE_CONFIG[entry.entryType];
  const signed = ledgerSigned(entry);
  const ref = (entry.description ?? '').match(/(BZ-[A-Z]{2}-[\w-]+|[A-Z]{4}\s?\d{6,7})/)?.[0];
  const who = entry.createdByAdminName ? `par ${entry.createdByAdminName}` : null;
  const isAdmin = entry.entryType === 'ADMIN_CREDIT' || entry.entryType === 'ADMIN_DEBIT';
  const day = shortDay(entry.createdAt);
  // Fiche : « Orange Money · 18 oct. », « Par Nelson · 9 oct. » ; relevé : « 18 oct. · par Nelson ».
  const how = ledgerVia(entry) ?? ref;
  const subtitle = showBalance
    ? [day, who ?? how].filter(Boolean).join(' · ')
    : [isAdmin && who ? who.replace(/^par/, 'Par') : how, day].filter(Boolean).join(' · ');
  return (
    <ItemRow
      leading={<LedgerLeading entry={entry} />}
      title={ledgerTitle(entry)}
      subtitle={subtitle}
      onClick={onClick}
      right={
        <span className="shrink-0 text-right">
          <span className={cn('block text-[17px] font-bold tabular-nums', TEXT.strong)}>
            {cfg?.isInformational ? 'Info' : `${signed > 0 ? '+' : '−'}${xaf(Math.abs(signed))}`}
          </span>
          {showBalance && !cfg?.isInformational && (
            <span className={cn('block text-[15px] tabular-nums', entry.balanceAfter < 0 ? 'text-[#C00F0C] dark:text-[#FCB3AD]' : TEXT.muted)}>{xaf(entry.balanceAfter)}</span>
          )}
        </span>
      }
    />
  );
}

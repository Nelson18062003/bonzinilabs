// Affichage des écritures du grand livre — config partagée entre le
// MobileClientLedger et le panneau desktop de la fiche client, pour que
// chaque type d'écriture garde la même icône / couleur / signe partout.
import {
  ArrowDownCircle,
  ArrowUpCircle,
  XCircle,
  RefreshCw,
  PlusCircle,
  MinusCircle,
  Clock,
} from 'lucide-react';
import type { LedgerEntryType } from '@/types/admin';
import type { Tone } from '@/mobile/designKit';

// Entry type → tone (color carries meaning), icon, sign and label. Informational
// entries (no balance impact) are neutral.
export const ENTRY_TYPE_CONFIG: Record<LedgerEntryType, {
  icon: typeof ArrowDownCircle;
  tone: Tone;
  prefix: string;
  label: string;
  isInformational?: boolean;
}> = {
  DEPOSIT_VALIDATED: { icon: ArrowDownCircle, tone: 'success', prefix: '+', label: 'Dépôt validé' },
  DEPOSIT_REFUSED: { icon: XCircle, tone: 'neutral', prefix: '', label: 'Dépôt refusé', isInformational: true },
  PAYMENT_RESERVED: { icon: Clock, tone: 'pending', prefix: '-', label: 'Paiement réservé' },
  PAYMENT_EXECUTED: { icon: ArrowUpCircle, tone: 'neutral', prefix: '-', label: 'Paiement exécuté', isInformational: true },
  PAYMENT_CANCELLED_REFUNDED: { icon: RefreshCw, tone: 'success', prefix: '+', label: 'Paiement remboursé' },
  ADMIN_CREDIT: { icon: PlusCircle, tone: 'success', prefix: '+', label: 'Crédit admin' },
  ADMIN_DEBIT: { icon: MinusCircle, tone: 'danger', prefix: '-', label: 'Débit admin' },
};

// Tone → amount text colour (matches the pill palette).
export const AMOUNT_TONE: Record<Tone, string> = {
  success: 'text-[#2E7D52] dark:text-[#7FCBA0]',
  pending: 'text-[#9A6B12] dark:text-[#E7C083]',
  danger: 'text-[#C0504D] dark:text-[#E79A9A]',
  info: 'text-[#5B4CC4] dark:text-[#B5AAF0]',
  neutral: 'text-[#8E8BA0] dark:text-[#9B98AD]',
};

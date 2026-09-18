/**
 * Clients figés pour le harnais de capture (SCREENSHOT_MOCK=1) : le vrai
 * module est réexporté, seules les lectures (liste, fiche, historique) sont
 * remplacées par des fixtures.
 */
export * from '../hooks/useClientManagement';
import type { LedgerEntry } from '@/types/admin';

const mk = (id: string, first: string, last: string, phone: string, company: string, balance: number, dep: number, pay: number, created: string, status = 'ACTIVE', email = '') => ({
  id, firstName: first, lastName: last, phone, email, companyName: company, country: 'Cameroun', city: 'Douala', avatarUrl: null,
  createdAt: created, updatedAt: created, walletId: 'w-' + id, walletBalance: balance, totalDeposits: dep, totalPayments: pay,
  customerCode: 'BZ-' + String(135190 + id.charCodeAt(1) * 7).slice(0, 6),
  status, utmSource: null as string | null, utmMedium: null as string | null, utmCampaign: null as string | null, lastLedgerEntry: null as LedgerEntry | null,
  walletOverdraftLimit: 0, walletOverdraftNote: null as string | null,
});

const CLIENTS = [
  mk('u1', 'Jean-Paul', 'Mbarga', '+237 690 11 22 33', 'Mbarga Import', 3_000_000, 42_000_000, 39_000_000, '2025-03-12T10:00:00Z'),
  mk('u2', 'Aminatou', 'Bello', '+237 655 44 55 66', '', 120_000, 4_800_000, 4_680_000, '2026-01-20T10:00:00Z', 'PENDING_KYC'),
  mk('u3', 'Samuel', 'Nkoulou', '+237 677 88 99 00', 'SN Électronique', 8_500_000, 96_000_000, 87_500_000, '2024-11-02T10:00:00Z'),
  mk('u4', 'Rosine', 'Tchoua', '+237 699 12 34 56', '', 0, 12_400_000, 12_400_000, '2025-08-15T10:00:00Z', 'INACTIVE'),
  mk('u5', 'Fatou', 'Ndiaye', '+237 690 55 66 77', 'Ndiaye & Fils', 1_240_000, 18_650_000, 17_410_000, '2025-05-06T10:00:00Z', 'ACTIVE', 'fatou@ndiaye-fils.cm'),
  mk('u6', 'Pierre', 'Essomba', '+237 676 00 11 22', '', 45_000, 2_300_000, 2_255_000, '2026-06-30T10:00:00Z', 'SUSPENDED'),
];

const entry = (id: string, type: LedgerEntry['entryType'], amount: number, before: number, description: string, at: string): LedgerEntry =>
  ({ id, walletId: 'w-u5', userId: 'u5', entryType: type, amountXAF: amount, balanceBefore: before, balanceAfter: before + amount,
     referenceType: null, referenceId: null, description, createdAt: new Date(at) } as unknown as LedgerEntry);

const LEDGER: LedgerEntry[] = [
  entry('l1', 'PAYMENT_RESERVED', -1_450_000, 2_690_000, 'Paiement BZ-PY-260913-0204 (Alipay)', '2026-09-13T04:05:00Z'),
  entry('l2', 'DEPOSIT_VALIDATED', 850_000, 1_840_000, 'Dépôt BZ-DP-260905-0371 (Orange Money)', '2026-09-05T11:20:00Z'),
  entry('l3', 'PAYMENT_RESERVED', -2_602_000, 4_442_000, 'Paiement BZ-PY-260901-0160 (Virement)', '2026-09-01T09:00:00Z'),
];
CLIENTS[4].lastLedgerEntry = LEDGER[0];
// u5 : découvert autorisé, non utilisé. u6 : en découvert (solde négatif).
CLIENTS[4].walletOverdraftLimit = 2_000_000;
CLIENTS[4].walletOverdraftNote = 'Facture Yite urgente, régularisation le 30/09';
CLIENTS[5].walletBalance = -350_000;
CLIENTS[5].walletOverdraftLimit = 1_000_000;
CLIENTS[5].walletOverdraftNote = 'Client historique, conteneur en route';
CLIENTS[4].utmSource = 'facebook';
CLIENTS[4].utmCampaign = 'rentree-2026';

const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null, refetch: async () => undefined });

export const useClients = () => ok(CLIENTS);
export const useClient = (id: string) => ok(CLIENTS.find((c) => c.id === id) ?? null);
export const useClientLedger = (id: string) => ok(id === 'u5' ? LEDGER : []);
export const useClientLedgerPaged = (id: string) => ({ ...ok(id === 'u5' ? LEDGER : []), hasNextPage: false, fetchNextPage: async () => undefined, isFetchingNextPage: false });
export const useClientLedgerCount = (id: string) => ok(id === 'u5' ? LEDGER.length : 0);

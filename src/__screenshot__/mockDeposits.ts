/**
 * Dépôts figés pour le harnais de capture (SCREENSHOT_MOCK=1) : six dépôts
 * du 13/09/2026, le dossier « d5 » avec une preuve, un solde, un suivi.
 * Les mutations ne font rien.
 */
import type { DepositProofWithUrl, DepositTimelineEvent, DepositWithProfile } from '@/types/deposit';

const client = (user_id: string, first_name: string, last_name: string, phone: string, company_name: string | null = null) =>
  ({ user_id, first_name, last_name, phone, company_name });

const base = {
  bank_name: null, agency_name: null, client_phone: null, admin_comment: null, rejection_reason: null,
  confirmed_amount_xaf: null, rejection_category: null, admin_internal_note: null, validated_by: null,
  validated_at: null, verified_at: null, verified_by: null, updated_at: '2026-09-13T08:00:00Z',
} as const;

const DEPOSITS: DepositWithProfile[] = [
  { ...base, id: 'd1', user_id: 'u1', reference: 'BZ-DP-260913-0412', amount_xaf: 2_500_000, method: 'bank_transfer', bank_name: 'Afriland First Bank', status: 'proof_submitted', created_at: '2026-09-13T07:10:00Z', profiles: client('u1', 'Jean-Paul', 'Mbarga', '+237 690 11 22 33', 'Mbarga Import'), proof_count: 1 },
  { ...base, id: 'd2', user_id: 'u2', reference: 'BZ-DP-260913-0411', amount_xaf: 650_000, method: 'om_transfer', status: 'awaiting_proof', created_at: '2026-09-13T06:40:00Z', profiles: client('u2', 'Aminatou', 'Bello', '+237 655 44 55 66'), proof_count: 0 },
  { ...base, id: 'd3', user_id: 'u3', reference: 'BZ-DP-260912-0409', amount_xaf: 12_000_000, method: 'bank_cash', bank_name: 'BICEC', status: 'admin_review', created_at: '2026-09-12T15:20:00Z', profiles: client('u3', 'Samuel', 'Nkoulou', '+237 677 88 99 00', 'SN Électronique'), proof_count: 2 },
  { ...base, id: 'd4', user_id: 'u4', reference: 'BZ-DP-260912-0405', amount_xaf: 1_200_000, method: 'mtn_transfer', status: 'validated', validated_at: '2026-09-12T11:05:00Z', created_at: '2026-09-12T10:30:00Z', profiles: client('u4', 'Rosine', 'Tchoua', '+237 699 12 34 56'), proof_count: 1 },
  { ...base, id: 'd5', user_id: 'u5', reference: 'BZ-DP-260910-0398', amount_xaf: 850_000, method: 'om_transfer', status: 'proof_submitted', created_at: '2026-09-10T09:15:00Z', profiles: client('u5', 'Fatou', 'Ndiaye', '+237 690 55 66 77', 'Ndiaye & Fils'), proof_count: 1 },
  { ...base, id: 'd6', user_id: 'u6', reference: 'BZ-DP-260908-0390', amount_xaf: 4_300_000, method: 'agency_cash', agency_name: 'Agence Akwa', status: 'rejected', rejection_reason: 'Montant reçu différent du montant déclaré.', created_at: '2026-09-08T14:00:00Z', profiles: client('u6', 'Pierre', 'Essomba', '+237 676 00 11 22'), proof_count: 1 },
];

/** Une capture d'écran Orange Money dessinée en SVG : lisible, sans réseau. */
const PROOF_SVG = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="405" viewBox="0 0 720 405">
<rect width="720" height="405" fill="#fff7ee"/><rect x="0" y="0" width="720" height="64" fill="#ff6600"/>
<text x="24" y="42" font-family="sans-serif" font-size="26" font-weight="700" fill="#fff">Orange Money</text>
<text x="24" y="130" font-family="sans-serif" font-size="22" fill="#5a5a5a">Transfert réussi</text>
<text x="24" y="190" font-family="sans-serif" font-size="44" font-weight="700" fill="#1e1e1e">850 000 FCFA</text>
<text x="24" y="240" font-family="sans-serif" font-size="22" fill="#5a5a5a">Vers BONZINI LABS · 690 00 00 00</text>
<text x="24" y="280" font-family="sans-serif" font-size="22" fill="#5a5a5a">10/09/2026 10:14 · Réf. OM2609101014</text>
</svg>`);
const PROOF_URL = `data:image/svg+xml;charset=utf-8,${PROOF_SVG}`;

const PROOFS: DepositProofWithUrl[] = [
  { id: 'pr1', deposit_id: 'd5', file_url: 'proofs/d5/capture-orange-money.png', file_name: 'capture-orange-money.png', file_type: 'image/png', uploaded_at: '2026-09-10T09:16:00Z', uploaded_by: 'u5', uploaded_by_type: 'client', is_visible_to_client: true, deleted_at: null, deleted_by: null, delete_reason: null, signedUrl: PROOF_URL },
];

const TIMELINE: DepositTimelineEvent[] = [
  { id: 't1', deposit_id: 'd5', event_type: 'created', description: 'Demande créée par le client', performed_by: 'u5', created_at: '2026-09-10T09:15:00Z' },
  { id: 't2', deposit_id: 'd5', event_type: 'proof_submitted', description: 'Preuve envoyée', performed_by: 'u5', created_at: '2026-09-10T09:16:00Z' },
];

const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null, refetch: async () => undefined });
const noop = () => ({ mutate: () => undefined, mutateAsync: async () => undefined, isPending: false, isError: false, error: null });

export const useAdminDeposits = () => ok(DEPOSITS);
export const useAdminDepositDetail = (id: string | undefined) => ok(DEPOSITS.find((d) => d.id === id) ?? null);
export const useAdminDepositProofs = (id: string | undefined) => ok(id === 'd5' ? PROOFS : []);
export const useAdminDepositTimeline = (id: string | undefined) => ok(id === 'd5' ? TIMELINE : []);
export const useDepositStats = () => ok({ total: 6, awaiting_proof: 1, proof_submitted: 2, pending_correction: 0, admin_review: 1, validated: 1, rejected: 1, to_process: 4, today_validated: 1, today_amount: 1_200_000 });
export const useAdminWalletByUserId = (userId: string | undefined) =>
  ok(userId ? { id: 'w-' + userId, user_id: userId, balance_xaf: 1_240_000, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-09-12T00:00:00Z' } : null);
export const useAllClients = () => ok(DEPOSITS.map((d) => d.profiles!));
export const useValidateDeposit = noop;
export const useRejectDeposit = noop;
export const useStartDepositReview = noop;
export const useAdminCreateDeposit = noop;
export const useSetDepositVerified = noop;
export const useAdminUploadProofs = noop;
export const useDeleteDeposit = noop;
export const useCancelDeposit = noop;
export const useAdminDeleteProof = noop;
export const getProofSignedUrl = async () => PROOF_URL;

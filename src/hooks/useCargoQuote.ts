// ============================================================
// Les hooks du devis et des tarifs cargo — app ADMIN (supabaseAdmin).
// Toutes les RPC renvoient { success, error?, ... } ; un refus n'est jamais
// pris pour un succès. Le réceptionnaire n'appelle rien d'ici : les écrans
// qui les utilisent vivent dans Cargo, derrière canViewCargo / canPriceParcels.
// ============================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { compressImage } from '@/lib/imageCompression';
import { validateUploadFile } from '@/lib/utils';
import type { CargoPricing, PaymentMethod, PaymentPlace, Quote, QuoteBasis } from '@/lib/cargoQuote';

type RpcResult<T> = ({ success: true } & T) | { success: false; error?: string };

async function rpcJson<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabaseAdmin.rpc(name as never, args as never);
  if (error) throw new Error(error.message);
  const res = data as unknown as RpcResult<T>;
  if (!res || res.success !== true) throw new Error((res as { error?: string })?.error || 'Opération refusée');
  return res as T;
}

export const QUOTE_KEYS = {
  pricing: ['cargo', 'pricing'] as const,
  quote: (depositId: string) => ['cargo', 'quote', depositId] as const,
};

export function useCargoPricing() {
  return useQuery({
    queryKey: QUOTE_KEYS.pricing,
    queryFn: () => rpcJson<CargoPricing>('cargo_pricing_get'),
    staleTime: 60_000,
  });
}

export function useSetCargoPricing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { airPerKg: number; seaPerCbm: number }) =>
      rpcJson<CargoPricing>('cargo_pricing_set', { p_air_per_kg_xaf: v.airPerKg, p_sea_per_cbm_xaf: v.seaPerCbm }),
    onSuccess: (pricing) => { qc.setQueryData(QUOTE_KEYS.pricing, pricing); toast.success('Tarifs enregistrés'); },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Le devis d'un dépôt — null tant qu'aucun prix n'a été posé. */
export function useCargoQuote(depositId: string | undefined) {
  return useQuery({
    queryKey: QUOTE_KEYS.quote(depositId ?? ''),
    queryFn: () => rpcJson<{ quote: Quote | null }>('cargo_quote_get', { p_deposit_id: depositId }).then((r) => r.quote),
    enabled: !!depositId,
    staleTime: 15_000,
  });
}

function useQuoteMutation<TArgs>(name: string, toArgs: (a: TArgs) => Record<string, unknown>, success?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: TArgs) => rpcJson<{ quote: Quote }>(name, toArgs(a)).then((r) => r.quote),
    onSuccess: (quote) => {
      qc.setQueryData(QUOTE_KEYS.quote(quote.deposit_id), quote);
      qc.invalidateQueries({ queryKey: ['reception'] });
      if (success) toast.success(success);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Ouvre le devis (une ligne par colis au tarif du jour) ou le complète des colis ajoutés depuis. */
export const useEnsureQuote = () => useQuoteMutation<string>('cargo_quote_ensure', (depositId) => ({ p_deposit_id: depositId }));
export const useSetQuoteLine = () => useQuoteMutation<{ lineId: string; basis?: QuoteBasis; unitPrice?: number | null; amount?: number | null; label?: string }>(
  'cargo_quote_set_line', (a) => ({ p_line_id: a.lineId, p_basis: a.basis ?? null, p_unit_price_xaf: a.unitPrice ?? null, p_amount_xaf: a.amount ?? null, p_label: a.label ?? null }),
);
export const useAddQuoteLine = () => useQuoteMutation<{ quoteId: string; kind: 'fee' | 'discount'; label: string; amount: number }>(
  'cargo_quote_add_line', (a) => ({ p_quote_id: a.quoteId, p_kind: a.kind, p_label: a.label, p_amount_xaf: a.amount }),
);
export const useRemoveQuoteLine = () => useQuoteMutation<string>('cargo_quote_remove_line', (lineId) => ({ p_line_id: lineId }));
export const useSendQuote = () => useQuoteMutation<string>('cargo_quote_send', (quoteId) => ({ p_quote_id: quoteId }), 'Devis marqué comme envoyé');

// ── Phase 2 : les encaissements et la facture ──

/** Encaisser : le montant, le mode, le lieu, la date, la référence, la preuve (chemin déjà déposé), une note. Renvoie le devis à jour et l'encaissement créé. */
export function useAddQuotePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: { quoteId: string; amount: number; method: PaymentMethod; place: PaymentPlace; paidAt?: string | null; reference?: string; proofPath?: string | null; note?: string }) =>
      rpcJson<{ payment_id: string; receipt_no: string; quote: Quote }>('cargo_quote_add_payment', {
        p_quote_id: a.quoteId, p_amount_xaf: a.amount, p_method: a.method, p_place: a.place, p_paid_at: a.paidAt ?? null,
        p_reference: a.reference ?? null, p_proof_path: a.proofPath ?? null, p_note: a.note ?? null,
      }).then((r) => ({ quote: r.quote, payment: r.quote.payments?.find((p) => p.id === r.payment_id) ?? null })),
    onSuccess: ({ quote }) => {
      qc.setQueryData(QUOTE_KEYS.quote(quote.deposit_id), quote);
      qc.invalidateQueries({ queryKey: ['reception'] });
      toast.success('Encaissement enregistré');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
/** Régler un devis depuis le solde du client (portefeuille) : la base débite sous verrou et écrit au grand livre. */
export function usePayQuoteFromWallet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: { quoteId: string; amount: number; note?: string }) =>
      rpcJson<{ payment_id: string; receipt_no: string; wallet_balance_xaf: number; quote: Quote }>('cargo_quote_pay_from_wallet', { p_quote_id: a.quoteId, p_amount_xaf: a.amount, p_note: a.note ?? null })
        .then((r) => ({ quote: r.quote, payment: r.quote.payments?.find((p) => p.id === r.payment_id) ?? null, walletBalance: r.wallet_balance_xaf })),
    onSuccess: ({ quote }) => {
      qc.setQueryData(QUOTE_KEYS.quote(quote.deposit_id), quote);
      qc.invalidateQueries({ queryKey: ['reception'] });
      qc.invalidateQueries({ queryKey: ['admin-wallet'] });
      toast.success('Réglé depuis le solde du client');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
export const useCancelQuotePayment = () => useQuoteMutation<{ paymentId: string; reason: string }>('cargo_quote_cancel_payment', (a) => ({ p_payment_id: a.paymentId, p_reason: a.reason }), 'Encaissement annulé');
export const useInvoiceQuote = () => useQuoteMutation<string>('cargo_quote_invoice', (quoteId) => ({ p_quote_id: quoteId }), 'Facture acquittée établie');

/**
 * La preuve d'un paiement (photo du reçu Mobile Money, du bordereau…) :
 * compressée puis déposée dans le seau privé `parcel-payment-proofs/<devis>/…`.
 * Renvoie le chemin à passer à cargo_quote_add_payment.
 */
export async function uploadPaymentProof(quoteId: string, file: File): Promise<string> {
  validateUploadFile(file);
  const isPdf = file.type === 'application/pdf';
  const blob = isPdf ? file : await compressImage(file, 1600, 0.82);
  const path = `${quoteId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${isPdf ? 'pdf' : 'jpg'}`;
  const { error } = await supabaseAdmin.storage.from('parcel-payment-proofs').upload(path, blob, { contentType: isPdf ? 'application/pdf' : 'image/jpeg', upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

/** L'URL signée (1 h) d'une preuve de paiement — le seau est privé. */
export function usePaymentProofUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ['cargo', 'proof', path],
    queryFn: async () => {
      const { data, error } = await supabaseAdmin.storage.from('parcel-payment-proofs').createSignedUrl(path as string, 3600);
      if (error) throw new Error(error.message);
      return data.signedUrl;
    },
    enabled: !!path,
    staleTime: 50 * 60_000,
  });
}

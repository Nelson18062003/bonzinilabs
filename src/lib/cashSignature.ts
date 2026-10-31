// ============================================================
// Où lire l'image d'une signature cash.
//
// Jusqu'au 21/10/2026, payments.cash_signature_url contenait l'URL publique
// complète. Depuis, confirm_cash_payment reçoit et enregistre le CHEMIN de
// l'objet dans le bucket « cash-signatures » (« <id du paiement>/… ») : le
// serveur vérifie ainsi que le fichier existe vraiment. Les deux formes
// coexistent en base ; cette fonction rend toujours une URL affichable.
// ============================================================
import { VITE_SUPABASE_URL } from '@/lib/env';

export function cashSignatureSrc(value: string | null | undefined): string | null {
  const v = (value ?? '').trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  const path = v.replace(/^\/+/, '').replace(/^cash-signatures\//, '');
  const base = String(VITE_SUPABASE_URL).replace(/\/+$/, '');
  return `${base}/storage/v1/object/public/cash-signatures/${path.split('/').map(encodeURIComponent).join('/')}`;
}

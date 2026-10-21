// ============================================================
// Le QR d'un paiement cash — lecture.
//
// Depuis le 21/10/2026, le QR porte un SECRET que seul le client
// propriétaire peut lire (table payment_cash_tokens) :
//   {"type":"BONZINI_CASH_PAYMENT","id":"<uuid>","t":"<jeton>","v":2}
// L'UUID du paiement seul (ancien QR, identifiant copié, fiche admin) ne
// suffit plus : scan_cash_payment compare le jeton. Les mutations de scan
// et de confirmation vivent dans useAgentCashActions (supabaseAdmin).
// ============================================================

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Le jeton : 32 à 128 caractères hexadécimaux (≥ 128 bits). */
const TOKEN_RE = /^[0-9a-f]{32,128}$/i;

export interface ParsedCashQr {
  paymentId: string;
  token: string;
  isValid: boolean;
}

const INVALID: ParsedCashQr = { paymentId: '', token: '', isValid: false };

function accept(id: unknown, token: unknown): ParsedCashQr {
  if (typeof id !== 'string' || typeof token !== 'string') return INVALID;
  const i = id.trim();
  const t = token.trim();
  return UUID_RE.test(i) && TOKEN_RE.test(t) ? { paymentId: i.toLowerCase(), token: t.toLowerCase(), isValid: true } : INVALID;
}

/** Lit le contenu d'un QR cash ; valide seulement avec l'identifiant ET le jeton. */
export function parseCashQRCode(qrData: string | null | undefined): ParsedCashQr {
  const raw = (qrData ?? '').trim();
  if (!raw) return INVALID;

  // 1) Le QR de l'app client (JSON).
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.type === 'BONZINI_CASH_PAYMENT') return accept(parsed.id, parsed.t);
  } catch {
    // pas du JSON
  }

  // 2) Une URL portant les deux (?paymentId=…&t=…).
  try {
    const url = new URL(raw);
    return accept(url.searchParams.get('paymentId') ?? url.searchParams.get('id'), url.searchParams.get('t'));
  } catch {
    // pas une URL
  }

  return INVALID;
}

/** Le contenu du QR à dessiner (app client). */
export function cashQrPayload(paymentId: string, token: string): string {
  return JSON.stringify({ type: 'BONZINI_CASH_PAYMENT', id: paymentId, t: token, v: 2 });
}

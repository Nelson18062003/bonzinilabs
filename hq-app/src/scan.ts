// ============================================================
// Que faire d'un code lu par le scanner de la barre d'onglets ?
// (Quand c'est un écran du site qui a ouvert le scanner, le texte lui est
// simplement rendu — voir useQrScanner côté site.)
//
//   · QR de paiement cash (BONZINI_CASH_PAYMENT, avec le jeton du client)
//     → la fiche du paiement, avec le contenu lu (« ?qr=… ») ;
//   · code client BZ-xxxxxx (carte, étiquette, lien /c/…) → selon le rôle :
//     réception → nouveau dépôt ; Douala → remise ; admin → fiche client ;
//   · paquet avion PQ-xxxxxx → réception (et ops) : la fiche du paquet ;
//     Douala : la réception du paquet (/w/arrivees?paquet=…) ;
//   · autre code-barres (bordereau, carton) → réception : nouveau dépôt ;
//     Douala : remise (le site retrouve le colis) ; admin : suivi cargo.
// Mêmes règles que le site : normalizeCustomerCode, parseCashQRCode, parsePackageCode.
// ============================================================
import { can, type StaffRole } from './roles';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN = /^[0-9a-f]{32,128}$/i;

/** Même règle que parseCashQRCode du site : l'identifiant ET le jeton secret du client. */
export function cashPaymentId(raw: string): string | null {
  const text = raw.trim();
  const ok = (id: unknown, t: unknown) =>
    typeof id === 'string' && typeof t === 'string' && UUID.test(id.trim()) && TOKEN.test(t.trim()) ? id.trim().toLowerCase() : null;
  try {
    const p = JSON.parse(text);
    if (p?.type === 'BONZINI_CASH_PAYMENT') return ok(p.id, p.t);
  } catch {
    // pas du JSON
  }
  try {
    const u = new URL(text);
    return ok(u.searchParams.get('paymentId') ?? u.searchParams.get('id'), u.searchParams.get('t'));
  } catch {
    // pas une URL
  }
  return null;
}

/** « bz 482913 », « BZ-482913 », « https://bonzinilabs.com/c/BZ-482913 » → « BZ-482913 ». */
export function customerCode(raw: string): string | null {
  const m = raw.trim().toUpperCase().match(/BZ[\s-]?([1-9][0-9]{5})(?![0-9])/);
  return m ? `BZ-${m[1]}` : null;
}

/** « PQ-000123 », « pq123 », l'étiquette entière → « PQ-000123 » (paquet avion de 32 kg). */
export function packageCode(raw: string): string | null {
  const m = /PQ[\s-]?(\d{1,9})/i.exec(raw);
  if (!m) return null;
  const n = Number(m[1]);
  return `PQ-${n < 1000000 ? String(n).padStart(6, '0') : String(n)}`;
}

export type ScanAction =
  | { kind: 'open'; path: string }
  | { kind: 'deliver'; path: string; text: string }
  | { kind: 'unknown'; text: string };

export function routeScan(role: StaffRole, raw: string): ScanAction {
  const text = raw.trim();
  const cash = cashPaymentId(text);
  if (cash) {
    // « ?qr=… » : le contenu LU (avec le jeton du client). La fiche ne
    // l'envoie au serveur qu'après un geste explicite (« Procéder »).
    const qr = `?qr=${encodeURIComponent(text)}`;
    if (role === 'cash_agent') return { kind: 'open', path: `/a/payment/${cash}${qr}` };
    if (role !== 'receptionist' && role !== 'warehouse_agent' && role !== 'treasurer' && role !== 'commercial') return { kind: 'open', path: `/m/payments/${cash}${qr}` };
    return { kind: 'unknown', text };
  }
  const pkg = /RC[^0-9]{0,3}\d{6}/i.test(text) ? null : packageCode(text);
  if (pkg) {
    if (role === 'warehouse_agent') return { kind: 'open', path: `/w/arrivees?paquet=${encodeURIComponent(pkg)}` };
    if (can(role, 'receiveParcels')) return { kind: 'open', path: `/r/paquets?code=${encodeURIComponent(pkg)}` };
    return { kind: 'unknown', text };
  }
  const code = customerCode(text);
  if (role === 'receptionist') return { kind: 'deliver', path: '/r/new', text: code ?? text };
  if (role === 'warehouse_agent') return { kind: 'deliver', path: '/w/remise', text: code ?? text };
  if (code && role !== 'cash_agent' && role !== 'treasurer' && role !== 'commercial') return { kind: 'open', path: `/m/clients/scan?code=${encodeURIComponent(code)}` };
  if (role === 'super_admin' || role === 'ops' || role === 'support' || role === 'customer_success') {
    return { kind: 'open', path: `/m/cargo/track?ref=${encodeURIComponent(text)}` };
  }
  return { kind: 'unknown', text };
}

// ============================================================
// Que faire d'un code lu par le scanner de la barre d'onglets ?
// (Quand c'est un écran du site qui a ouvert le scanner, le texte lui est
// simplement rendu — voir useQrScanner côté site.)
//
//   · QR de paiement cash (BONZINI_CASH_PAYMENT) → la fiche du paiement ;
//   · code client BZ-xxxxxx (carte, étiquette, lien /c/…) → selon le rôle :
//     réception → nouveau dépôt ; Douala → remise ; admin → fiche client ;
//   · paquet avion PQ-xxxxxx → réception (et ops) : la fiche du paquet ;
//     Douala : la réception du paquet (/w/arrivees?paquet=…) ;
//   · autre code-barres (bordereau, carton) → réception : nouveau dépôt ;
//     Douala : remise (le site retrouve le colis) ; admin : suivi cargo.
// Mêmes règles que le site : normalizeCustomerCode, parseCashQRCode, parsePackageCode.
// ============================================================
import { can, type StaffRole } from './roles';

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

export function cashPaymentId(raw: string): string | null {
  const text = raw.trim();
  try {
    const p = JSON.parse(text);
    if (p?.type === 'BONZINI_CASH_PAYMENT' && typeof p.id === 'string' && UUID.test(p.id)) return p.id;
  } catch {
    // pas du JSON
  }
  try {
    const u = new URL(text);
    const id = u.searchParams.get('paymentId') ?? u.searchParams.get('id');
    if (id && UUID.test(id)) return id;
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
    if (role === 'cash_agent') return { kind: 'open', path: `/a/payment/${cash}` };
    if (role !== 'receptionist' && role !== 'warehouse_agent' && role !== 'treasurer' && role !== 'commercial') return { kind: 'open', path: `/m/payments/${cash}` };
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

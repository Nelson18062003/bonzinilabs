import React from 'react';
import type { StatementMovement, StatementInput } from './pdf/templates/ClientStatementPDF';
import { ClientStatementPDF } from './pdf/templates/ClientStatementPDF';
import { downloadPDF } from './pdf/downloadPDF';
import { BUSINESS_TZ } from './analytics/dateRange';
import { prepareStatement } from './statementPeriod';

// Re-export types so callers only need to import from this file
export type { StatementMovement, StatementInput };

// ─── RAW SHAPES accepted by mapping helpers ───────────────────────────────────
// (Avoid importing hook types — these mirror the hook return shapes)

export interface RawWalletOp {
  id: string;
  operation_type: string;
  amount_xaf: number;
  balance_before: number;
  balance_after: number;
  reference_id: string | null;
  reference_type: string | null;
  description: string | null;
  created_at: string;
  is_test?: boolean;
  status?: string;
}

export interface RawLedgerEntry {
  id: string;
  entryType: string;
  amountXAF: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceId?: string | null;
  referenceType?: string | null;
  description: string | null;
  createdAt: Date;
  isTest?: boolean;
}

// ─── FORMATTERS ──────────────────────────────────────────────────────────────

/**
 * « 18 septembre 2026 » — en jour civil de DOUALA, quel que soit le poste.
 * Une borne de période (minuit Douala = 23:00 UTC la veille) lue en heure
 * locale d'un navigateur à UTC s'affichait la veille : le relevé disait
 * « Du 31 août » pour une période commençant le 1er septembre.
 */
export function fmtDateLong(value: string | Date): string {
  try {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: BUSINESS_TZ,
    }).format(d);
  } catch {
    return String(value);
  }
}

/** « 18 septembre 2026 à 14:05 » — l'horodatage d'émission. */
function fmtGeneratedAt(d: Date): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: BUSINESS_TZ,
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

// ─── FILTER HELPERS ───────────────────────────────────────────────────────────

/** Returns false for operations that must be excluded from the statement. */
export function shouldIncludeWalletOp(op: RawWalletOp): boolean {
  const t = op.operation_type.toUpperCase();
  // Refused deposits: no balance impact — exclude
  if (t === 'DEPOSIT_REFUSED') return false;
  // Payment executed: informational only, no balance change (debit already at RESERVED) — exclude
  if (t === 'PAYMENT_EXECUTED') return false;
  // Test operations
  if (op.is_test) return false;
  // PAYMENT_RESERVED = real debit, PAYMENT_CANCELLED_REFUNDED = real refund — include both
  return true;
}

export function shouldIncludeLedgerEntry(entry: RawLedgerEntry): boolean {
  const t = entry.entryType.toUpperCase();
  // Refused deposits: no balance impact — exclude
  if (t === 'DEPOSIT_REFUSED') return false;
  // Payment executed: informational only, no balance change (debit already at RESERVED) — exclude
  if (t === 'PAYMENT_EXECUTED') return false;
  // Test operations
  if (entry.isTest) return false;
  // PAYMENT_RESERVED = real debit, PAYMENT_CANCELLED_REFUNDED = real refund — include both
  return true;
}

// ─── CREDIT / DEBIT LOGIC ────────────────────────────────────────────────────

function isCredit(type: string, balanceBefore: number, balanceAfter: number): boolean {
  const t = type.toUpperCase();
  if (['DEPOSIT', 'DEPOSIT_VALIDATED', 'ADMIN_CREDIT', 'PAYMENT_CANCELLED_REFUNDED'].includes(t)) return true;
  if (['PAYMENT', 'PAYMENT_EXECUTED', 'PAYMENT_RESERVED', 'ADMIN_DEBIT', 'DEPOSIT_REFUSED', 'CARGO_FEES'].includes(t)) return false;
  return balanceAfter > balanceBefore;
}

function getMovementType(entryType: string): StatementMovement['type'] {
  const t = entryType.toUpperCase();
  if (t === 'PAYMENT_CANCELLED_REFUNDED') return 'Remboursement';
  if (t.includes('DEPOSIT') || t === 'ADMIN_CREDIT') return 'Dépôt';
  if (t.includes('PAYMENT') || t === 'CARGO_FEES') return 'Paiement';
  return 'Ajustement';
}

function getFallbackMotif(entryType: string): string {
  const map: Record<string, string> = {
    DEPOSIT:                    'Dépôt',
    DEPOSIT_VALIDATED:          'Dépôt validé',
    DEPOSIT_REFUSED:            'Dépôt refusé',
    PAYMENT:                    'Paiement',
    PAYMENT_EXECUTED:           'Paiement effectué',
    PAYMENT_RESERVED:           'Paiement réservé',
    PAYMENT_CANCELLED_REFUNDED: 'Remboursement',
    ADMIN_CREDIT:               'Crédit administrateur',
    ADMIN_DEBIT:                'Débit administrateur',
    CARGO_FEES:                 'Frais de transport (cargo)',
    ADJUSTMENT:                 'Ajustement',
  };
  return map[entryType.toUpperCase()] || entryType;
}

/** Extract the business reference (e.g. BZ-PY-2026-0017) from a ledger description. */
function extractBusinessRef(description?: string | null): string | null {
  if (!description) return null;
  const m = description.match(/BZ-[A-Z]+-\d{4}-\d+/);
  return m ? m[0] : null;
}

function buildRef(refType?: string | null, refId?: string | null, id?: string, description?: string | null): string {
  // Prefer the real business reference embedded in the description
  const businessRef = extractBusinessRef(description);
  if (businessRef) return businessRef;
  // Fallback: short UUID-based identifier
  const prefix = refType === 'deposit' ? 'DEP' : refType === 'payment' ? 'PAY' : 'OP';
  const suffix = (refId || id || '').slice(0, 6).toUpperCase();
  return `${prefix}-${suffix}`;
}

// ─── MAPPING HELPERS (exported) ───────────────────────────────────────────────

export function buildMovementFromWalletOp(op: RawWalletOp): StatementMovement {
  const credit = isCredit(op.operation_type, op.balance_before, op.balance_after);
  return {
    date:      op.created_at,
    reference: buildRef(op.reference_type, op.reference_id, op.id, op.description),
    type:      getMovementType(op.operation_type),
    motif:     op.description || getFallbackMotif(op.operation_type),
    debit:      credit ? 0 : Math.abs(op.amount_xaf),
    credit:     credit ? Math.abs(op.amount_xaf) : 0,
    soldeAvant: op.balance_before,
    solde:      op.balance_after,
  };
}

export function buildMovementFromLedgerEntry(entry: RawLedgerEntry): StatementMovement {
  const credit = isCredit(entry.entryType, entry.balanceBefore, entry.balanceAfter);
  return {
    date:      entry.createdAt.toISOString(),
    reference: buildRef(entry.referenceType, entry.referenceId, entry.id, entry.description),
    type:      getMovementType(entry.entryType),
    motif:     entry.description || getFallbackMotif(entry.entryType),
    debit:      credit ? 0 : Math.abs(entry.amountXAF),
    credit:     credit ? Math.abs(entry.amountXAF) : 0,
    soldeAvant: entry.balanceBefore,
    solde:      entry.balanceAfter,
  };
}

// ─── PDF GENERATION ───────────────────────────────────────────────────────────

export async function generateClientStatement(data: StatementInput): Promise<void> {
  const safeName = data.clientName.replace(/\s+/g, '');
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const filename = `releve_${safeName}_${today}.pdf`;

  const element = React.createElement(ClientStatementPDF, { data });
  await downloadPDF(element, filename);
}

// ─── RELEVÉ SUR UNE PÉRIODE (point d'entrée partagé des trois écrans) ────────

export interface StatementClientInfo {
  name: string;
  phone?: string | null;
  email?: string | null;
  country?: string | null;
  ref?: string | null;
}

export interface GenerateStatementForRangeInput {
  client: StatementClientInfo;
  /** `null` = tout l'historique. Bornes inclusives (voir `buildStatementRange`). */
  range: { from: Date; to: Date } | null;
  /** Déjà mappés (`buildMovementFrom*`) et filtrés (`shouldInclude*`), dans n'importe quel ordre. */
  movements: StatementMovement[];
  /** `balance_after` de la dernière écriture avant la période, si la période n'a aucun mouvement. */
  lastBalanceBefore?: number | null;
  now?: Date;
}

/**
 * Prépare (tri, bornes, soldes d'ouverture / de clôture) puis télécharge le
 * PDF. Remplace les trois copies du même bloc dans HistoryPage,
 * MobileClientDetail et DesktopClientPanel.
 */
export async function generateStatementForRange({
  client,
  range,
  movements,
  lastBalanceBefore,
  now = new Date(),
}: GenerateStatementForRangeInput): Promise<void> {
  const allTime = range === null;
  const prepared = prepareStatement({
    movements,
    range: range ?? { from: new Date(0), to: now },
    allTime,
    lastBalanceBeforeRange: lastBalanceBefore,
  });

  const first = prepared.movements[0];
  const periodFrom = range ? fmtDateLong(range.from) : first ? fmtDateLong(first.date) : '—';
  const periodTo = range ? fmtDateLong(range.to) : fmtDateLong(now);

  await generateClientStatement({
    clientName: client.name,
    clientPhone: client.phone ?? undefined,
    clientEmail: client.email || undefined,
    clientCountry: client.country || undefined,
    clientRef: client.ref || undefined,
    movements: prepared.movements,
    openingBalance: prepared.openingBalance,
    closingBalance: prepared.closingBalance,
    periodFrom,
    periodTo,
    generatedAt: fmtGeneratedAt(now),
  });
}

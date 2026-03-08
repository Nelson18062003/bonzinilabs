import React from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { StatementMovement, StatementInput } from './pdf/templates/ClientStatementPDF';
import { ClientStatementPDF } from './pdf/templates/ClientStatementPDF';
import { downloadPDF } from './pdf/downloadPDF';

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

export function fmtDateLong(iso: string): string {
  try {
    return format(new Date(iso), 'd MMMM yyyy', { locale: fr });
  } catch {
    return iso;
  }
}

// ─── FILTER HELPERS ───────────────────────────────────────────────────────────

/** Returns false for operations that must be excluded from the statement. */
export function shouldIncludeWalletOp(op: RawWalletOp): boolean {
  // BUG 6: Exclude refused deposits
  if (op.operation_type.toUpperCase() === 'DEPOSIT_REFUSED') return false;
  // BUG 7: Exclude test operations
  if (op.is_test) return false;
  return true;
}

export function shouldIncludeLedgerEntry(entry: RawLedgerEntry): boolean {
  // BUG 6: Exclude refused deposits
  if (entry.entryType.toUpperCase() === 'DEPOSIT_REFUSED') return false;
  // BUG 7: Exclude test operations
  if (entry.isTest) return false;
  return true;
}

// ─── CREDIT / DEBIT LOGIC ────────────────────────────────────────────────────

function isCredit(type: string, balanceBefore: number, balanceAfter: number): boolean {
  const t = type.toUpperCase();
  if (['DEPOSIT', 'DEPOSIT_VALIDATED', 'ADMIN_CREDIT', 'PAYMENT_CANCELLED_REFUNDED'].includes(t)) return true;
  if (['PAYMENT', 'PAYMENT_EXECUTED', 'PAYMENT_RESERVED', 'ADMIN_DEBIT', 'DEPOSIT_REFUSED'].includes(t)) return false;
  return balanceAfter > balanceBefore;
}

function getMovementType(entryType: string): StatementMovement['type'] {
  const t = entryType.toUpperCase();
  if (t === 'PAYMENT_CANCELLED_REFUNDED') return 'Remboursement';
  if (t.includes('DEPOSIT') || t === 'ADMIN_CREDIT') return 'Dépôt';
  if (t.includes('PAYMENT')) return 'Paiement';
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
    ADJUSTMENT:                 'Ajustement',
  };
  return map[entryType.toUpperCase()] || entryType;
}

function buildRef(refType?: string | null, refId?: string | null, id?: string): string {
  const prefix = refType === 'deposit' ? 'DEP' : refType === 'payment' ? 'PAY' : 'OP';
  const suffix = (refId || id || '').slice(0, 6).toUpperCase();
  return `${prefix}-${suffix}`;
}

// ─── MAPPING HELPERS (exported) ───────────────────────────────────────────────

export function buildMovementFromWalletOp(op: RawWalletOp): StatementMovement {
  const credit = isCredit(op.operation_type, op.balance_before, op.balance_after);
  return {
    date:      op.created_at,
    reference: buildRef(op.reference_type, op.reference_id, op.id),
    type:      getMovementType(op.operation_type),
    motif:     op.description || getFallbackMotif(op.operation_type),
    debit:     credit ? 0 : Math.abs(op.amount_xaf),
    credit:    credit ? Math.abs(op.amount_xaf) : 0,
    solde:     op.balance_after,
  };
}

export function buildMovementFromLedgerEntry(entry: RawLedgerEntry): StatementMovement {
  const credit = isCredit(entry.entryType, entry.balanceBefore, entry.balanceAfter);
  return {
    date:      entry.createdAt.toISOString(),
    reference: buildRef(entry.referenceType, entry.referenceId, entry.id),
    type:      getMovementType(entry.entryType),
    motif:     entry.description || getFallbackMotif(entry.entryType),
    debit:     credit ? 0 : Math.abs(entry.amountXAF),
    credit:    credit ? Math.abs(entry.amountXAF) : 0,
    solde:     entry.balanceAfter,
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

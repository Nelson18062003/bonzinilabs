// ============================================================
// Beneficiaries — canonical per-mode field spec (SINGLE SOURCE OF TRUTH).
//
// This module is imported by BOTH apps (client + admin) and drives:
//   1. which fields each payment mode requires/allows (forms),
//   2. hard validation (mirrored by the DB CHECK constraints),
//   3. natural-key extraction for duplicate detection.
//
// Pure TypeScript — no React, no i18n runtime, no Supabase — so it is
// trivially unit-testable and shareable. Validators return i18n LEAF
// keys (under the `beneficiaries.*` namespace, which lives in
// `client.json`); the UI passes them to t().
//
// The canonical mode identifiers are the DB enum values
// ('alipay' | 'wechat' | 'bank_transfer' | 'cash'). The admin UI label
// "virement" maps to 'bank_transfer' — never use it as a key here.
// ============================================================

import type { PaymentMethod } from '@/types/payment';

// A beneficiary always belongs to exactly one payment mode.
export type BeneficiaryMode = PaymentMethod; // 'alipay' | 'wechat' | 'bank_transfer' | 'cash'

// How the account holder relates to the client (UX + reporting only;
// never changes which fields are required).
export type RelationType = 'self' | 'supplier' | 'other';

// Identifier flavour for Alipay/WeChat (mirrors the DB CHECK).
export type IdentifierType = 'qr' | 'id' | 'email' | 'phone';

// Field keys map 1:1 to columns on `public.beneficiaries`.
export type BeneficiaryField =
  | 'alias'
  | 'name'
  | 'identifier'
  | 'identifier_type'
  | 'phone'
  | 'email'
  | 'bank_name'
  | 'bank_account'
  | 'bank_extra'
  | 'qr_code_url'
  | 'relation_type'
  | 'notes';

/**
 * Canonical beneficiary payload (snake_case = DB columns). Both the
 * carnet screens and the payment wizards build this shape before
 * calling the data layer, and the validators below consume it.
 */
export interface BeneficiaryInput {
  payment_method: BeneficiaryMode;
  alias: string;
  name: string;
  identifier?: string | null;
  identifier_type?: IdentifierType | null;
  phone?: string | null;
  email?: string | null;
  bank_name?: string | null;
  bank_account?: string | null;
  bank_extra?: string | null;
  qr_code_url?: string | null;
  relation_type?: RelationType | null;
  notes?: string | null;
}

// ── Length caps (in CHARACTERS, not bytes — a CJK glyph is ~3 bytes in
//    UTF-8 but counts as one here, which is what we want). ────────────
export const BENEFICIARY_MAX_LENGTHS: Record<BeneficiaryField, number> = {
  alias: 60,
  name: 120,
  identifier: 120,
  identifier_type: 8,
  phone: 30,
  email: 120,
  bank_name: 120,
  bank_account: 60,
  bank_extra: 200,
  qr_code_url: 500,
  relation_type: 16,
  notes: 500,
};

export const RELATION_TYPES: readonly RelationType[] = ['self', 'supplier', 'other'] as const;
export const IDENTIFIER_TYPES: readonly IdentifierType[] = ['qr', 'id', 'email', 'phone'] as const;

// ── Per-mode field specification ─────────────────────────────────────
//
// `requiredAll`  : every field must be non-empty.
// `requireOneOf` : at least one field in each group must be non-empty
//                  (used for Alipay/WeChat "identifier OR QR").
// `optional`     : surfaced in the form but never blocks save.
// `naturalKeyColumn` : column used for the partial UNIQUE index / soft
//                  duplicate detection (null = no hard dedup, e.g. cash).
//
// `alias` is required for EVERY mode (the human-readable label) and is
// therefore listed in each `requiredAll`.

export interface ModeFieldSpec {
  requiredAll: readonly BeneficiaryField[];
  requireOneOf: readonly (readonly BeneficiaryField[])[];
  optional: readonly BeneficiaryField[];
  naturalKeyColumn: 'identifier' | 'bank_account' | null;
}

export const BENEFICIARY_SPEC: Record<BeneficiaryMode, ModeFieldSpec> = {
  alipay: {
    requiredAll: ['alias', 'name'],
    requireOneOf: [['identifier', 'qr_code_url']],
    optional: ['identifier_type', 'phone', 'email', 'relation_type', 'notes'],
    naturalKeyColumn: 'identifier',
  },
  wechat: {
    requiredAll: ['alias', 'name'],
    requireOneOf: [['identifier', 'qr_code_url']],
    optional: ['identifier_type', 'phone', 'email', 'relation_type', 'notes'],
    naturalKeyColumn: 'identifier',
  },
  bank_transfer: {
    requiredAll: ['alias', 'name', 'bank_name', 'bank_account'],
    requireOneOf: [],
    optional: ['bank_extra', 'relation_type', 'notes'],
    naturalKeyColumn: 'bank_account',
  },
  cash: {
    requiredAll: ['alias', 'name', 'phone'],
    requireOneOf: [],
    optional: ['email', 'relation_type', 'notes'],
    naturalKeyColumn: null,
  },
};

// The order modes are presented in pickers/lists.
export const BENEFICIARY_MODE_ORDER: readonly BeneficiaryMode[] = [
  'alipay',
  'wechat',
  'bank_transfer',
  'cash',
] as const;

// ── Helpers ──────────────────────────────────────────────────────────

function valueOf(input: BeneficiaryInput, field: BeneficiaryField): string {
  const v = (input as Record<string, unknown>)[field];
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Validation error keys, by field. Empty object ⇒ the beneficiary is
 * complete for its mode (the DB CHECK constraints would accept it).
 * Keys are i18n leaves under `beneficiaries.errors.*`.
 */
export type BeneficiaryErrors = Partial<Record<BeneficiaryField, string>>;

export function validateBeneficiaryInput(input: BeneficiaryInput): BeneficiaryErrors {
  const spec = BENEFICIARY_SPEC[input.payment_method];
  const errors: BeneficiaryErrors = {};

  // 1. Required-all
  for (const field of spec.requiredAll) {
    if (!valueOf(input, field)) {
      errors[field] = `beneficiaries.errors.${field}Required`;
    }
  }

  // 2. Require-one-of (e.g. Alipay/WeChat: identifier OR qr_code_url)
  for (const group of spec.requireOneOf) {
    const satisfied = group.some((field) => valueOf(input, field));
    if (!satisfied) {
      // Attach the error to the first field of the group; the UI shows a
      // single "provide at least one channel" hint.
      errors[group[0]] = 'beneficiaries.errors.accountChannelRequired';
    }
  }

  // 3. Length caps (characters)
  for (const field of Object.keys(BENEFICIARY_MAX_LENGTHS) as BeneficiaryField[]) {
    const max = BENEFICIARY_MAX_LENGTHS[field];
    if (valueOf(input, field).length > max && !errors[field]) {
      errors[field] = 'beneficiaries.errors.tooLong';
    }
  }

  return errors;
}

export function isBeneficiaryComplete(input: BeneficiaryInput): boolean {
  return Object.keys(validateBeneficiaryInput(input)).length === 0;
}

/**
 * Natural key used for soft duplicate detection (client-side) and that
 * mirrors the partial UNIQUE indexes in the DB. Returns null when the
 * mode has no hard dedup (cash) or the key field is empty.
 *
 * Normalisation is intentionally loose (trim + lowercase + collapse
 * inner spaces): the authoritative guarantee is the DB unique index;
 * this is only to surface a friendly "you already have this" hint.
 */
export function getBeneficiaryNaturalKey(
  input: BeneficiaryInput,
): { column: 'identifier' | 'bank_account'; value: string } | null {
  const column = BENEFICIARY_SPEC[input.payment_method].naturalKeyColumn;
  if (!column) return null;
  const raw = valueOf(input, column);
  if (!raw) return null;
  const value = raw.toLowerCase().replace(/\s+/g, ' ');
  return { column, value };
}

/** True when two inputs collide on their natural key (same mode). */
export function isSameBeneficiaryKey(a: BeneficiaryInput, b: BeneficiaryInput): boolean {
  if (a.payment_method !== b.payment_method) return false;
  const ka = getBeneficiaryNaturalKey(a);
  const kb = getBeneficiaryNaturalKey(b);
  return !!ka && !!kb && ka.column === kb.column && ka.value === kb.value;
}

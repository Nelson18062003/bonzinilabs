// ============================================================
// Beneficiaries — Zod schema (hard validation for forms).
//
// Mirrors the per-mode spec in ./spec.ts and the DB CHECK constraints.
// This REPLACES the soft `validateBeneficiaryStep` in
// src/components/payment-form/paymentSchemas.ts: here, an incomplete
// beneficiary does NOT parse, so the form CTA stays disabled.
//
// Pure (no React/i18n runtime). Error messages are i18n leaf keys under
// `beneficiaries.errors.*`. Names/banks accept ANY script (CJK welcome):
// we validate STRUCTURE, never the writing system — so no
// `^[A-Za-z]+$`-style regex that would reject 张伟.
// ============================================================

import { z } from 'zod';
import {
  BENEFICIARY_MAX_LENGTHS,
  IDENTIFIER_TYPES,
  RELATION_TYPES,
  type BeneficiaryInput,
  type BeneficiaryMode,
} from './spec';

const max = BENEFICIARY_MAX_LENGTHS;

// A trimmed, length-capped optional string. Empty string ⇒ undefined so
// "blank optional field" is valid and stored as NULL by the data layer.
const optionalText = (cap: number) =>
  z
    .string()
    .trim()
    .max(cap, 'beneficiaries.errors.tooLong')
    .optional()
    .transform((v) => (v ? v : undefined));

const requiredText = (cap: number, requiredKey: string) =>
  z
    .string({ required_error: requiredKey })
    .trim()
    .min(1, requiredKey)
    .max(cap, 'beneficiaries.errors.tooLong');

// Fields shared by every mode.
const baseShape = {
  alias: requiredText(max.alias, 'beneficiaries.errors.aliasRequired'),
  relation_type: z.enum(RELATION_TYPES as unknown as [string, ...string[]]).optional(),
  notes: optionalText(max.notes),
};

// ── Per-mode object schemas ──────────────────────────────────────────

const alipayWechatBase = {
  ...baseShape,
  name: requiredText(max.name, 'beneficiaries.errors.nameRequired'),
  identifier: optionalText(max.identifier),
  identifier_type: z.enum(IDENTIFIER_TYPES as unknown as [string, ...string[]]).optional(),
  qr_code_url: optionalText(max.qr_code_url),
  phone: optionalText(max.phone),
  email: optionalText(max.email).pipe(
    z.string().email('beneficiaries.errors.emailInvalid').optional().or(z.undefined()),
  ),
};

// Plain object members (no `.refine`) so z.discriminatedUnion accepts
// them. The "identifier OR QR" rule for Alipay/WeChat is applied via
// superRefine on the union below (a ZodEffects member would break the
// discriminated union in Zod v3).
export const alipaySchema = z.object({ ...alipayWechatBase, payment_method: z.literal('alipay') });
export const wechatSchema = z.object({ ...alipayWechatBase, payment_method: z.literal('wechat') });

export const bankTransferSchema = z.object({
  ...baseShape,
  payment_method: z.literal('bank_transfer'),
  name: requiredText(max.name, 'beneficiaries.errors.nameRequired'),
  bank_name: requiredText(max.bank_name, 'beneficiaries.errors.bank_nameRequired'),
  bank_account: requiredText(max.bank_account, 'beneficiaries.errors.bank_accountRequired'),
  bank_extra: optionalText(max.bank_extra),
});

export const cashSchema = z.object({
  ...baseShape,
  payment_method: z.literal('cash'),
  name: requiredText(max.name, 'beneficiaries.errors.nameRequired'),
  phone: requiredText(max.phone, 'beneficiaries.errors.phoneRequired'),
  email: optionalText(max.email).pipe(
    z.string().email('beneficiaries.errors.emailInvalid').optional().or(z.undefined()),
  ),
});

// Discriminated union over the canonical DB mode value, plus the
// cross-field "account channel" rule for Alipay/WeChat.
export const beneficiarySchema = z
  .discriminatedUnion('payment_method', [
    alipaySchema,
    wechatSchema,
    bankTransferSchema,
    cashSchema,
  ])
  .superRefine((data, ctx) => {
    if (
      (data.payment_method === 'alipay' || data.payment_method === 'wechat') &&
      !data.identifier &&
      !data.qr_code_url
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'beneficiaries.errors.accountChannelRequired',
        path: ['identifier'],
      });
    }
  });

export type BeneficiarySchemaInput = z.input<typeof beneficiarySchema>;
export type BeneficiarySchemaOutput = z.output<typeof beneficiarySchema>;

/** Pick the schema for a single mode (handy for react-hook-form resolvers). */
export function schemaForMode(mode: BeneficiaryMode) {
  switch (mode) {
    case 'alipay':
      return alipaySchema;
    case 'wechat':
      return wechatSchema;
    case 'bank_transfer':
      return bankTransferSchema;
    case 'cash':
      return cashSchema;
  }
}

/**
 * Convenience: parse and return either the typed value or the first
 * i18n error key. Mirrors the ergonomics of paymentSchemas.ts.
 */
export function parseBeneficiary(
  input: BeneficiaryInput,
): { ok: true; value: BeneficiarySchemaOutput } | { ok: false; errorKey: string } {
  const result = beneficiarySchema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };
  const first = result.error.issues[0];
  return { ok: false, errorKey: first?.message ?? 'beneficiaries.errors.invalid' };
}

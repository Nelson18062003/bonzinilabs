// ============================================================
// Beneficiaries — per-mode display metadata (labels / icons / colors).
//
// REUSES the existing maps in src/types/payment.ts instead of creating a
// third source of truth. Adds only what was missing: a per-mode brand
// COLOR keyed by the canonical DB value ('bank_transfer'), matching the
// SPECS palette (Alipay blue / WeChat green / Virement violet / Cash red).
// ============================================================

import {
  PAYMENT_METHOD_ICONS,
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
} from '@/types/payment';
import type { BeneficiaryMode, RelationType } from './spec';

// Re-export the canonical maps so callers import everything mode-related
// from one place.
export { PAYMENT_METHOD_ICONS, PAYMENT_METHOD_LABELS };

/** Brand color per mode (SPECS §3). Keyed by the DB enum value. */
export const BENEFICIARY_MODE_COLORS: Record<BeneficiaryMode, string> = {
  alipay: '#1677ff',
  wechat: '#07c160',
  bank_transfer: '#8b5cf6',
  cash: '#dc2626',
};

export function modeLabel(mode: PaymentMethod): string {
  return PAYMENT_METHOD_LABELS[mode];
}

export function modeIcon(mode: PaymentMethod): string {
  return PAYMENT_METHOD_ICONS[mode];
}

export function modeColor(mode: BeneficiaryMode): string {
  return BENEFICIARY_MODE_COLORS[mode];
}

/** i18n leaf keys for the relation enum (under `beneficiaries.relations.*`). */
export const RELATION_LABEL_KEYS: Record<RelationType, string> = {
  self: 'beneficiaries.relations.self',
  supplier: 'beneficiaries.relations.supplier',
  other: 'beneficiaries.relations.other',
};

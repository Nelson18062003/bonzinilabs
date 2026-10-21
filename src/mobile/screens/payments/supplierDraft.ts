/**
 * Le champ unique « ID » d'un nouveau fournisseur (téléphone, e-mail ou ID
 * WeChat), lu dans un BeneficiaryDraft — voir SupplierFields.
 */
import { detectAccountKind, phoneFromText, type BeneficiaryDraft } from '@/lib/beneficiaries/contact';
import type { BeneficiaryMode } from '@/lib/beneficiaries/spec';

/** Le texte du champ unique « ID », tel que le brouillon le porte. */
export function accountTextOf(d: BeneficiaryDraft): string {
  return d.accountKind === 'phone' ? d.accountPhone.national : d.accountText;
}

/** Une saisie dans le champ « ID » → la nature du compte et sa valeur. */
export function withAccount(mode: BeneficiaryMode, d: BeneficiaryDraft, raw: string): BeneficiaryDraft {
  let kind = detectAccountKind(raw);
  if (mode === 'alipay' && kind === 'id') kind = raw.includes('@') ? 'email' : 'phone';
  if (mode === 'wechat' && kind === 'email') kind = 'id';
  if (!raw.trim()) kind = mode === 'wechat' ? 'id' : 'phone';
  if (kind === 'phone') return { ...d, accountKind: 'phone', accountPhone: raw.trim() ? phoneFromText(raw, d.accountPhone.country) : { ...d.accountPhone, national: '' }, accountText: '' };
  return { ...d, accountKind: kind, accountText: raw };
}

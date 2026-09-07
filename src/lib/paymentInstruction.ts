/**
 * L'INSTRUCTION DE PAIEMENT — la donnée et sa mise en mots.
 *
 * Ce module est PUR : pas de React, pas de `@react-pdf`. C'est ce qui permet
 * au texte copiable (WeChat, e-mail) et au PDF de partager les mêmes libellés
 * sans que le premier traîne le moteur de rendu du second — et de tester la
 * mise en mots sans monter quoi que ce soit.
 *
 * Tout est bilingue EN / 中文 : ce contenu sort de la maison, il est lu par le
 * partenaire chinois. Aucun libellé français ici.
 */
import { formatRMB } from '@/lib/pdf/helpers';

/** Un paiement, tel que le partenaire doit le voir. */
export interface PaymentInstructionEntry {
  id: string;
  reference: string;
  amount_rmb: number;
  method: string;
  created_at?: string | null;
  beneficiary_name?: string | null;
  beneficiary_phone?: string | null;
  beneficiary_email?: string | null;
  beneficiary_bank_name?: string | null;
  beneficiary_bank_account?: string | null;
  beneficiary_bank_extra?: string | null;
  /** URL SIGNÉE du QR — un chemin brut ne s'afficherait ni ne s'imprimerait. */
  beneficiary_qr_code_url?: string | null;
  beneficiary_notes?: string | null;
  beneficiary_identifier?: string | null;
}

/** Libellé bilingue de la méthode. Alipay et WeChat sont des marques : identiques en EN et ZH. */
export function methodLabel(method: string): string {
  switch (method) {
    case 'alipay':
      return 'Alipay';
    case 'wechat':
      return 'WeChat Pay';
    case 'bank_transfer':
      return 'Bank Transfer / 银行转账';
    case 'cash':
      return 'Cash / 现金';
    default:
      return method;
  }
}

/** Date ISO YYYY-MM-DD — sans ambiguïté jour/mois, quelle que soit la langue. */
export function formatDateIso(input: Date | string | null | undefined): string {
  if (!input) return '—';
  const d = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 10);
}

/** Les méthodes qui se règlent en scannant un code. */
export function usesQrCode(method: string): boolean {
  return method === 'alipay' || method === 'wechat';
}

/** Nom de fichier stable et parlant pour le partenaire. */
export function paymentInstructionFilename(entry: PaymentInstructionEntry): string {
  return `Bonzini_Payment_${entry.reference}.pdf`;
}

/** Une ligne « Libellé : valeur », omise si la valeur est vide. */
function line(label: string, value: string | null | undefined): string | null {
  const v = value?.trim();
  return v ? `${label}: ${v}` : null;
}

/**
 * L'instruction en TEXTE, à coller dans un e-mail ou WeChat.
 *
 * Le texte ne peut pas porter le QR : quand la méthode en utilise un, il le
 * DIT et renvoie au PDF, plutôt que de laisser croire que tout est là. C'est
 * la seule différence de fond avec la page imprimée.
 */
export function buildPaymentInstructionText(entry: PaymentInstructionEntry): string {
  const rows: Array<string | null> = [
    'BONZINI LABS — Payment instruction / 付款指令',
    '',
    line('Reference / 参考号', entry.reference),
    line('Date / 日期', formatDateIso(entry.created_at)),
    '',
    `Amount to send / 付款金额: ¥${formatRMB(entry.amount_rmb)} RMB`,
    `Method / 方式: ${methodLabel(entry.method)}`,
    '',
  ];

  if (entry.method === 'bank_transfer') {
    rows.push(
      line('Beneficiary / 收款人', entry.beneficiary_name),
      line('Bank / 银行', entry.beneficiary_bank_name),
      line('Account / 账号', entry.beneficiary_bank_account),
      line('SWIFT / IBAN / 银行代码', entry.beneficiary_bank_extra),
    );
  } else if (usesQrCode(entry.method)) {
    rows.push(
      line('Name / 姓名', entry.beneficiary_name),
      line(
        entry.method === 'wechat' ? 'WeChat ID / 微信号' : 'Alipay ID / 支付宝账号',
        entry.beneficiary_identifier,
      ),
    );
  } else {
    rows.push(line('Beneficiary / 收款人', entry.beneficiary_name));
  }

  rows.push(
    line('Phone / 电话', entry.beneficiary_phone),
    line('Email / 邮箱', entry.beneficiary_email),
    line('Notes / 备注', entry.beneficiary_notes),
  );

  if (usesQrCode(entry.method) && entry.beneficiary_qr_code_url) {
    rows.push('', 'QR code: see the attached PDF / 二维码：见附件 PDF');
  }

  // Les `null` (champs vides) disparaissent ; les '' volontaires deviennent
  // des lignes vides, puis on écrase les doublons pour qu'un bloc absent ne
  // laisse pas un trou de trois lignes.
  return rows
    .filter((r): r is string => r !== null)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

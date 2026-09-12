/**
 * L'instruction de paiement copiée dans WeChat ou dans un e-mail.
 *
 * Ce texte SORT DE LA MAISON : il est lu par le partenaire chinois, qui paie
 * d'après lui. Trois choses doivent donc tenir, et aucune n'est visible à
 * l'écran de celui qui clique « Copier » :
 *
 *  1. Le montant et la référence y sont, toujours.
 *  2. Les champs absents ne laissent pas de ligne vide (« Phone / 电话: »),
 *     qui se lit comme une information manquante plutôt qu'inexistante.
 *  3. Le TEXTE NE PORTE PAS LE QR. Quand la méthode se règle en scannant, il
 *     le dit et renvoie au PDF — sans quoi on croit avoir tout envoyé.
 */
import { describe, it, expect } from 'vitest';
import {
  buildPaymentInstructionText,
  methodLabel,
  formatDateIso,
  paymentInstructionFilename,
  usesQrCode,
  type PaymentInstructionEntry,
} from '@/lib/paymentInstruction';

const base: PaymentInstructionEntry = {
  id: 'p1',
  reference: 'BZ-PY-2026-1192',
  amount_rmb: 58900,
  method: 'bank_transfer',
  created_at: '2026-09-01T10:00:00.000Z',
};

describe('Les libellés bilingues', () => {
  it('nomme les méthodes dans les deux langues, sauf les marques', () => {
    expect(methodLabel('bank_transfer')).toBe('Bank Transfer / 银行转账');
    expect(methodLabel('alipay')).toBe('Alipay');
    expect(methodLabel('wechat')).toBe('WeChat Pay');
  });

  it('date en ISO, et « — » quand il n’y en a pas', () => {
    expect(formatDateIso('2026-09-01T10:00:00.000Z')).toBe('2026-09-01');
    expect(formatDateIso(null)).toBe('—');
    expect(formatDateIso('pas une date')).toBe('—');
  });

  it('sait quelles méthodes se règlent au QR', () => {
    expect(usesQrCode('alipay')).toBe(true);
    expect(usesQrCode('wechat')).toBe(true);
    expect(usesQrCode('bank_transfer')).toBe(false);
  });

  it('le nom de fichier porte la référence', () => {
    expect(paymentInstructionFilename(base)).toBe('Bonzini_Payment_BZ-PY-2026-1192.pdf');
  });
});

describe('Le texte de l’instruction', () => {
  it('porte toujours la référence, le montant et la méthode', () => {
    const text = buildPaymentInstructionText(base);
    expect(text).toContain('BZ-PY-2026-1192');
    expect(text).toContain('58');
    expect(text).toContain('RMB');
    expect(text).toContain('Bank Transfer / 银行转账');
    expect(text).toContain('2026-09-01');
  });

  it('virement : banque, compte et code bancaire', () => {
    const text = buildPaymentInstructionText({
      ...base,
      beneficiary_name: 'Guangzhou Hongfa Trade',
      beneficiary_bank_name: 'Bank of China',
      beneficiary_bank_account: '6214 8802 3391 5588',
      beneficiary_bank_extra: 'BKCHCNBJ',
    });
    expect(text).toContain('Beneficiary / 收款人: Guangzhou Hongfa Trade');
    expect(text).toContain('Bank / 银行: Bank of China');
    expect(text).toContain('Account / 账号: 6214 8802 3391 5588');
    expect(text).toContain('SWIFT / IBAN / 银行代码: BKCHCNBJ');
    // Un virement n'a pas de QR : aucune mention ne doit apparaître.
    expect(text).not.toMatch(/二维码/);
  });

  it('Alipay et WeChat portent CHACUN leur identifiant', () => {
    const alipay = buildPaymentInstructionText({
      ...base,
      method: 'alipay',
      beneficiary_identifier: 'zw88@aliyun.com',
    });
    expect(alipay).toContain('Alipay ID / 支付宝账号: zw88@aliyun.com');
    expect(alipay).not.toMatch(/微信号/);

    const wechat = buildPaymentInstructionText({
      ...base,
      method: 'wechat',
      beneficiary_identifier: 'linmei_gz88',
    });
    expect(wechat).toContain('WeChat ID / 微信号: linmei_gz88');
    expect(wechat).not.toMatch(/支付宝/);
  });

  it('dit que le QR est dans le PDF — le texte ne peut pas le porter', () => {
    const withQr = buildPaymentInstructionText({
      ...base,
      method: 'wechat',
      beneficiary_qr_code_url: 'https://x/storage/v1/object/sign/payment-proofs/qr.png?token=abc',
    });
    expect(withQr).toContain('QR code: see the attached PDF / 二维码：见附件 PDF');
    // Et surtout : jamais l'URL signée, qui expire et fuiterait un jeton.
    expect(withQr).not.toContain('token=');
    expect(withQr).not.toContain('http');
  });

  it('sans QR enregistré, aucune promesse de pièce jointe', () => {
    const noQr = buildPaymentInstructionText({ ...base, method: 'wechat', beneficiary_identifier: 'abc' });
    expect(noQr).not.toMatch(/见附件/);
  });

  it('les champs absents ne laissent pas de ligne vide', () => {
    const text = buildPaymentInstructionText({ ...base, beneficiary_name: 'Chen' });
    expect(text).not.toMatch(/Phone \/ 电话:\s*$/m);
    expect(text).not.toMatch(/Email \/ 邮箱:\s*$/m);
    expect(text).not.toMatch(/Notes \/ 备注:\s*$/m);
  });

  it('un champ vide ou en blancs compte comme absent', () => {
    const text = buildPaymentInstructionText({ ...base, beneficiary_phone: '   ', beneficiary_email: '' });
    expect(text).not.toMatch(/电话/);
    expect(text).not.toMatch(/邮箱/);
  });

  it('jamais trois sauts de ligne d’affilée, même avec tout vide', () => {
    expect(buildPaymentInstructionText(base)).not.toMatch(/\n{3}/);
    expect(buildPaymentInstructionText({ ...base, method: 'alipay' })).not.toMatch(/\n{3}/);
  });
});

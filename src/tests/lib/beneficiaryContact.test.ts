// Les coordonnées d'un bénéficiaire Alipay / WeChat / virement / cash, avec
// leur format (12/10/2026) : « pour un identifiant Alipay, pas n'importe
// quel code ; un téléphone avec l'indicatif du pays ; et l'email ».
import { describe, it, expect } from 'vitest';
import {
  detectAccountKind,
  draftErrors,
  draftPayload,
  emptyDraft,
  phoneFromText,
  storedPhone,
  wechatIdError,
  type BeneficiaryDraft,
} from '@/lib/beneficiaries/contact';

const draft = (mode: Parameters<typeof emptyDraft>[0], patch: Partial<BeneficiaryDraft>): BeneficiaryDraft => ({ ...emptyDraft(mode), ...patch });

describe('Reconnaître ce qui est collé', () => {
  it('email, téléphone, ID', () => {
    expect(detectAccountKind(' zhang.wei@163.com ')).toBe('email');
    expect(detectAccountKind('+86 138 0219 4471')).toBe('phone');
    expect(detectAccountKind('13802194471')).toBe('phone');
    expect(detectAccountKind('zhangwei_88')).toBe('id');
  });

  it('un numéro avec indicatif garde son pays ; sans, le pays choisi', () => {
    expect(phoneFromText('+86 138 0219 4471')).toEqual({ country: 'CN', national: '138 0219 4471' });
    expect(phoneFromText('0086 13802194471').country).toBe('CN');
    expect(phoneFromText('+237 6 99 00 00 00').country).toBe('CM');
    expect(phoneFromText('13802194471', 'CN')).toEqual({ country: 'CN', national: '138 0219 4471' });
  });

  it('rangé à l’international, lisible', () => {
    expect(storedPhone({ country: 'CN', national: '138 0219 4471' })).toBe('+86 138 0219 4471');
    expect(storedPhone({ country: 'CN', national: '138 02' })).toBeNull();
  });
});

describe('ID WeChat : les règles de WeChat', () => {
  it('valides', () => {
    expect(wechatIdError('zhangwei_88')).toBeNull();
    expect(wechatIdError('Lin-mei2024')).toBeNull();
  });
  it('refusés, avec la raison', () => {
    expect(wechatIdError('13802194471')).toMatch(/Téléphone/);
    expect(wechatIdError('zw@qq.com')).toMatch(/email/);
    expect(wechatIdError('8zhang')).toMatch(/lettre/);
    expect(wechatIdError('abc')).toMatch(/6 à 20/);
    expect(wechatIdError('zhang wei')).toMatch(/espace/);
    expect(wechatIdError('zhang.wei')).toMatch(/Lettres, chiffres/);
  });
});

describe('Alipay', () => {
  it('compte téléphone chinois → identifiant « +86 … », type phone', () => {
    const d = draft('alipay', { name: 'Zhang Wei', accountKind: 'phone', accountPhone: { country: 'CN', national: '138 0219 4471' } });
    expect(draftErrors('alipay', d)).toEqual({});
    expect(draftPayload('alipay', d)).toEqual({ name: 'Zhang Wei', identifier: '+86 138 0219 4471', identifier_type: 'phone' });
  });

  it('compte email → en minuscules, type email ; plus un téléphone de contact', () => {
    const d = draft('alipay', { name: 'Zhang Wei', accountKind: 'email', accountText: ' Zhang.Wei@163.COM ', phone: { country: 'CN', national: '139 1234 5678' } });
    expect(draftErrors('alipay', d)).toEqual({});
    expect(draftPayload('alipay', d)).toMatchObject({ identifier: 'zhang.wei@163.com', identifier_type: 'email', phone: '+86 139 1234 5678' });
  });

  it('un numéro trop court ou un email faux sont refusés', () => {
    expect(draftErrors('alipay', draft('alipay', { name: 'Zhang', accountPhone: { country: 'CN', national: '138 0219' } })).account).toMatch(/11 chiffres/);
    expect(draftPayload('alipay', draft('alipay', { name: 'Zhang', accountPhone: { country: 'CN', national: '138 0219' } })).identifier).toBeUndefined();
    expect(draftErrors('alipay', draft('alipay', { name: 'Zhang', accountPhone: { country: 'CM', national: '6 99' } })).account).toMatch(/incomplet/);
    expect(draftErrors('alipay', draft('alipay', { name: 'Zhang', accountPhone: { country: 'CM', national: '6 99 00 00 00' } }))).toEqual({});
    expect(draftErrors('alipay', draft('alipay', { name: 'Zhang', accountKind: 'email', accountText: 'zhang@163' })).account).toMatch(/email invalide/);
  });

  it('sans compte ni QR : refusé ; avec le QR seul : accepté', () => {
    const d = draft('alipay', { name: 'Zhang Wei' });
    expect(draftErrors('alipay', d).account).toMatch(/QR/);
    expect(draftErrors('alipay', d, { hasQr: true })).toEqual({});
  });

  it('l’email de contact est vérifié aussi', () => {
    const d = draft('alipay', { name: 'Zhang', accountPhone: { country: 'CN', national: '138 0219 4471' }, email: 'pas-un-email' });
    expect(draftErrors('alipay', d).email).toMatch(/invalide/);
  });
});

describe('WeChat', () => {
  it('ID WeChat valide → type id', () => {
    const d = draft('wechat', { name: 'Lin Mei', accountText: 'linmei_gz88' });
    expect(draftErrors('wechat', d)).toEqual({});
    expect(draftPayload('wechat', d)).toEqual({ name: 'Lin Mei', identifier: 'linmei_gz88', identifier_type: 'id' });
  });
  it('ID invalide : ni rangé, ni accepté', () => {
    const d = draft('wechat', { name: 'Lin Mei', accountText: '123456789' });
    expect(draftErrors('wechat', d).account).toBeTruthy();
    expect(draftPayload('wechat', d).identifier).toBeUndefined();
  });
});

describe('Virement et cash', () => {
  it('virement : banque et compte obligatoires, compte de 6 à 34 caractères', () => {
    expect(draftErrors('bank_transfer', draft('bank_transfer', { name: 'Hongfa Trade' }))).toMatchObject({ bank: expect.any(String), bankAccount: expect.any(String) });
    const ok = draft('bank_transfer', { name: 'Hongfa Trade', bank: ' Bank of China ', account: '6214 8802 3391 5588', bankExtra: 'BKCHCNBJ' });
    expect(draftErrors('bank_transfer', ok)).toEqual({});
    expect(draftPayload('bank_transfer', ok)).toMatchObject({ bank_name: 'Bank of China', bank_account: '6214 8802 3391 5588', bank_extra: 'BKCHCNBJ' });
    expect(draftErrors('bank_transfer', { ...ok, account: '12-3' }).bankAccount).toMatch(/invalide/);
  });

  it('cash, quelqu’un d’autre : le téléphone est obligatoire', () => {
    expect(draftErrors('cash', draft('cash', { name: 'Wang Fang' })).phone).toMatch(/téléphone/);
    expect(draftErrors('cash', draft('cash', { name: 'Wang Fang', phone: { country: 'CN', national: '138 0219 4471' } }))).toEqual({});
  });

  it('cash, le client lui-même : rien à saisir', () => {
    expect(draftErrors('cash', draft('cash', { isClient: true }))).toEqual({});
    expect(draftPayload('cash', draft('cash', { isClient: true, name: 'ignoré' }))).toEqual({});
  });
});

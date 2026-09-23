import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { groupPhone, intlPhone, mobileMoneyGuideData } from '@/lib/mobileMoneyGuide';
import { mtnMerchantInfo, mtnMoneyAccount, omMerchantInfo, orangeMoneyAccount } from '@/data/depositMethodsData';

describe('la fiche Mobile Money', () => {
  it('groupe les numéros comme on les dicte au Cameroun', () => {
    expect(groupPhone('6 96 10 38 64')).toBe('696 10 38 64');
    expect(groupPhone('6 52 40 36 02')).toBe('652 40 36 02');
    expect(groupPhone('+237 652 40 36 02')).toBe('652 40 36 02');
    expect(intlPhone('6 52 40 36 02')).toBe('+237 652 40 36 02');
    expect(groupPhone('+86 186 6743 9286')).toBe('+86 186 6743 9286');
  });

  it("porte les coordonnées du 23/09/2026 : Orange WONDER PHONE, MTN NORTON GAUSS BONZINI SARL 1 sur la nouvelle ligne", () => {
    const [orange, mtn] = mobileMoneyGuideData().operators;
    expect(orange.key).toBe('orange');
    expect(orange.holder).toBe('WONDER PHONE');
    expect(orange.number).toBe('696 10 38 64');
    expect(orange.merchantCode).toBe('#150*14*515318*696103864*MONTANT#');
    expect(mtn.key).toBe('mtn');
    expect(mtn.holder).toBe('NORTON GAUSS BONZINI SARL 1');
    expect(mtn.number).toBe('652 40 36 02');
    expect(mtn.numberIntl).toBe('+237 652 40 36 02');
    expect(mtn.merchantCode).toBe('*126*14*652403602*MONTANT#');
  });

  it("dit la même chose que l'écran de dépôt de l'app (même source)", () => {
    const [orange, mtn] = mobileMoneyGuideData().operators;
    expect(orange.merchantCode).toBe(omMerchantInfo.merchantCode);
    expect(mtn.merchantCode).toBe(mtnMerchantInfo.merchantCode);
    expect(groupPhone(orangeMoneyAccount.phone)).toBe(orange.number);
    expect(groupPhone(mtnMoneyAccount.phone)).toBe(mtn.number);
    // Le code marchand MTN se déduit du numéro : une ligne changée, un code changé.
    expect(mtn.merchantCode).toContain(mtn.number.replace(/\s/g, ''));
    expect(mtnMerchantInfo.accountName).toBe(mtnMoneyAccount.accountName);
  });

  it("ne dit ni « Bonzini Labs » ni « Bonzini Trading » : les documents sont au nom de la société", () => {
    const src = readFileSync('src/lib/pdf/templates/MobileMoneyGuidePDF.tsx', 'utf8') + readFileSync('src/lib/mobileMoneyGuide.ts', 'utf8');
    expect(src).not.toMatch(/Bonzini ?Labs/i);
    expect(src).not.toMatch(/Bonzini Trading/i);
    expect(src).toContain('LEGAL_NAME');
  });
});

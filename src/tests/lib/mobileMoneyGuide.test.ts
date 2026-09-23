import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { groupPhone, intlPhone, mobileMoneyGuideData, mobileMoneyGuideWords, MOBILE_MONEY_GUIDE_COPY } from '@/lib/mobileMoneyGuide';
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
    // Le code de retrait MTN se déduit du numéro : une ligne changée, un code changé.
    expect(mtn.merchantCode).toContain(mtn.number.replace(/\s/g, ''));
    expect(mtnMerchantInfo.accountName).toBe(mtnMoneyAccount.accountName);
  });

  it('sépare les deux façons : la Flotte donne un numéro et un titulaire, le Retrait un code', () => {
    const c = MOBILE_MONEY_GUIDE_COPY;
    expect(c.flotte.needs).toBe('Numéro + Titulaire');
    expect(c.retrait.needs).toBe('Code + Montant');
    expect([c.flotte.word, c.flotte.en, c.retrait.word, c.retrait.en]).toEqual(['Flotte', 'Float', 'Retrait', 'Withdrawal']);
    const [orange, mtn] = mobileMoneyGuideData().operators;
    expect(orange.account).toBe('Compte UV');
    expect(mtn.account).toBe('Compte Float');
  });

  it('reste sobre : peu de mots, des phrases courtes, une idée par page', () => {
    const words = mobileMoneyGuideWords();
    expect(words.length).toBeLessThanOrEqual(120);
    const c = MOBILE_MONEY_GUIDE_COPY;
    const sentences = [
      c.cover.lead, c.cover.flotte, c.cover.retrait, c.cover.choose,
      c.flotte.sentence, c.flotte.check, c.retrait.sentence, c.retrait.legend,
      c.preuve.sentence, c.preuve.clear, c.preuve.thanks,
    ];
    for (const s of sentences) expect(s.split(/\s+/).length, s).toBeLessThanOrEqual(12);
    expect(MOBILE_MONEY_GUIDE_COPY.preuve.items).toEqual(['Date et heure', 'Identifiant de transaction', 'Intitulé du compte', 'Montant']);
  });

  it("est au nom de la société : ni site, ni « Bonzini Labs », ni « Bonzini Trading », ni WhatsApp, ni plafond, ni menu inventé", () => {
    // Le code, sans ses commentaires : ce qui compte, c'est ce que le document affiche.
    const stripComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
    const src = stripComments(readFileSync('src/lib/pdf/templates/MobileMoneyGuidePDF.tsx', 'utf8') + readFileSync('src/lib/mobileMoneyGuide.ts', 'utf8'));
    for (const forbidden of [/bonzinilabs\.com/i, /Bonzini ?Labs/i, /Bonzini Trading/i, /WhatsApp/i, /WEBSITE/, /plafond|500 000|Max /i, /#150\*1\*1#|\*126#/]) {
      expect(src, String(forbidden)).not.toMatch(forbidden);
    }
    expect(src).toContain('LEGAL_NAME');
    // Les logos sont les logos officiels : le fichier Orange Money, le tracé MTN d'origine.
    expect(src).toContain('deposit-logos/orange-money.png');
    expect(src).toContain('MTN_LOGO_PATH');
  });
});

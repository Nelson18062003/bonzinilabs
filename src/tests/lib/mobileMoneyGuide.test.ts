import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { groupPhone, intlPhone, mobileMoneyGuideData, mobileMoneyGuideWords, MOBILE_MONEY_GUIDE_COPY, MOBILE_MONEY_GUIDE_FILENAME } from '@/lib/mobileMoneyGuide';
import { mtnMerchantInfo, mtnMoneyAccount, omMerchantInfo, orangeMoneyAccount } from '@/data/depositMethodsData';

/** Toutes les paires { fr, en } du texte de la fiche. */
function pairs(v: unknown, out: { fr: string; en: string }[] = []): { fr: string; en: string }[] {
  if (Array.isArray(v)) v.forEach((x) => pairs(x, out));
  else if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o.fr === 'string' && typeof o.en === 'string') out.push({ fr: o.fr, en: o.en });
    else Object.values(o).forEach((x) => pairs(x, out));
  }
  return out;
}

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
    // Le code du Retrait MTN se déduit du numéro : une ligne changée, un code changé.
    expect(mtn.merchantCode).toContain(mtn.number.replace(/\s/g, ''));
    expect(mtnMerchantInfo.accountName).toBe(mtnMoneyAccount.accountName);
  });

  it('est bilingue : chaque texte a sa version française et anglaise, Flotte / Float et Retrait / Withdrawal en tête', () => {
    const c = MOBILE_MONEY_GUIDE_COPY;
    expect(c.flotte.word).toEqual({ fr: 'Flotte', en: 'Float' });
    expect(c.retrait.word).toEqual({ fr: 'Retrait', en: 'Withdrawal' });
    for (const p of pairs(c)) {
      expect(p.fr.trim(), JSON.stringify(p)).not.toBe('');
      expect(p.en.trim(), JSON.stringify(p)).not.toBe('');
    }
    for (const op of mobileMoneyGuideData().operators) {
      expect(op.account.fr).not.toBe('');
      expect(op.account.en).not.toBe('');
    }
    expect(MOBILE_MONEY_GUIDE_FILENAME).toEqual({ portrait: 'coordonnees-mobile-money-portrait.pdf', landscape: 'coordonnees-mobile-money-paysage.pdf' });
  });

  it('sépare les deux façons : la Flotte donne un numéro et un titulaire, le Retrait un code', () => {
    const c = MOBILE_MONEY_GUIDE_COPY;
    expect(c.flotte.needs).toEqual({ fr: 'Numéro + Titulaire', en: 'Number + Account holder' });
    expect(c.retrait.needs).toEqual({ fr: 'Code + Montant', en: 'Code + Amount' });
  });

  it('reste sobre dans chaque langue : peu de mots, des phrases courtes', () => {
    expect(mobileMoneyGuideWords('fr').length).toBeLessThanOrEqual(130);
    expect(mobileMoneyGuideWords('en').length).toBeLessThanOrEqual(130);
    for (const p of pairs(MOBILE_MONEY_GUIDE_COPY)) {
      expect(p.fr.split(/\s+/).length, p.fr).toBeLessThanOrEqual(12);
      expect(p.en.split(/\s+/).length, p.en).toBeLessThanOrEqual(12);
    }
    expect(MOBILE_MONEY_GUIDE_COPY.preuve.items.map((i) => i.fr)).toEqual(['Date et heure', 'Identifiant de transaction', 'Intitulé du compte', 'Montant']);
  });

  it("est au nom de la société : ni site, ni « Bonzini Labs », ni « Bonzini Trading », ni WhatsApp, ni plafond, ni menu inventé", () => {
    // Le code, sans ses commentaires : ce qui compte, c'est ce que le document affiche.
    const stripComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
    // La fiche et le kit qu'elle partage avec la fiche bancaire (en-tête, pied, remerciement).
    const files = ['src/lib/pdf/templates/MobileMoneyGuidePDF.tsx', 'src/lib/mobileMoneyGuide.ts', 'src/lib/pdf/components/guideKit.tsx', 'src/lib/pdf/guideTokens.ts', 'src/lib/pdf/guideStyles.ts'];
    const src = stripComments(files.map((f) => readFileSync(f, 'utf8')).join('\n'));
    for (const forbidden of [/bonzinilabs\.com/i, /Bonzini ?Labs/i, /Bonzini Trading/i, /WhatsApp/i, /WEBSITE/, /plafond|500 000|Max /i, /#150\*1\*1#|\*126#/]) {
      expect(src, String(forbidden)).not.toMatch(forbidden);
    }
    // La raison sociale est imprimée par le kit (en-tête, pied de page, remerciement).
    expect(readFileSync('src/lib/pdf/components/guideKit.tsx', 'utf8')).toContain('{LEGAL_NAME}');
    // Les logos sont les logos officiels : le fichier Orange Money, le tracé MTN d'origine.
    expect(src).toContain('deposit-logos/orange-money.png');
    expect(src).toContain('MTN_LOGO_PATH');
  });
});

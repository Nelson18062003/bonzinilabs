import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import {
  BANK_GUIDE_COPY, BANK_GUIDE_FILENAME, accountIsConsistent, allBankAccounts, bankGuideData, bankGuideWords, bankRibFilename,
  bankShortName, computeRibKey, ibanIsValid, printableBank, swiftIsWellFormed,
} from '@/lib/bankDetailsGuide';
import { banks } from '@/data/depositMethodsData';
import { LEGAL_NAME } from '@/lib/companyIdentity';

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

const account = (key: string) => {
  const a = allBankAccounts().find((x) => x.key === key);
  if (!a) throw new Error(key);
  return a;
};

describe('les contrôles bancaires', () => {
  it("contrôle un IBAN comme la norme ISO 13616 (modulo 97)", () => {
    expect(ibanIsValid('GB82 WEST 1234 5698 7654 32')).toBe(true);
    expect(ibanIsValid('GB82 WEST 1234 5698 7654 33')).toBe(false);
    // Un IBAN camerounais fait 27 caractères. Ces deux-là passent le modulo 97
    // (26 et 28 caractères) : seule la règle de longueur les refuse.
    expect(ibanIsValid('CM62 1002 9000 0230 2450 3971 53')).toBe(false);
    expect(ibanIsValid('CM91 1002 9000 0230 2450 3971 0531')).toBe(false);
    expect(ibanIsValid('CM21 10033 05214 140110001411 88')).toBe(false);
  });

  it('recalcule la clé RIB depuis banque, agence et compte', () => {
    expect(computeRibKey('10005', '00002', '00000020611')).toBe('38');
    expect(computeRibKey('10029', '00002', '30245039710')).toBe('53');
    // Reste 0 → clé 97 ; reste 96 → clé 01 (sur deux chiffres).
    expect(computeRibKey('00000', '00000', '00000000000')).toBe('97');
    expect(computeRibKey('00000', '00000', '00000000032')).toBe('01');
  });

  it('reconnaît un SWIFT de 8 ou 11 caractères, pas de 7', () => {
    expect(swiftIsWellFormed('UNAFCMCX')).toBe(true);
    expect(swiftIsWellFormed('ECOCCMCXXXX')).toBe(true);
    expect(swiftIsWellFormed('UNAFMCX')).toBe(false);
  });
});

describe('la fiche coordonnées bancaires', () => {
  it("dit la même chose que l'écran de dépôt de l'app (même source), au nom de la société", () => {
    const accounts = allBankAccounts();
    expect(accounts.map((a) => a.key)).toEqual(banks.map((b) => b.bank));
    for (const a of accounts) {
      const b = banks.find((x) => x.bank === a.key)!;
      expect(a.iban).toBe(b.bonziniAccount.iban);
      expect(a.swift).toBe(b.bonziniAccount.swift);
      expect(a.accountNumber).toBe(b.bonziniAccount.accountNumber);
      expect(a.holder).toBe(LEGAL_NAME);
    }
    expect(accounts.map((a) => a.short)).toEqual(['Ecobank', 'CCA-Bank', 'UBA', 'Afriland']);
    expect(bankShortName('UBA')).toBe('UBA');
  });

  it("n'imprime que des comptes dont les chiffres se vérifient", () => {
    const printed = bankGuideData().accounts;
    expect(printed.length).toBeGreaterThan(0);
    for (const a of printed) expect(accountIsConsistent(a), a.key).toBe(true);
    const skipped = allBankAccounts().filter((a) => !printed.some((p) => p.key === a.key));
    for (const a of skipped) expect(accountIsConsistent(a), a.key).toBe(false);
  });

  it('retrouve la banque d\'un dépôt par sa clé ou par son libellé (dépôts créés par l\'équipe)', () => {
    expect(printableBank('UBA')).toBe('UBA');
    expect(printableBank('UBA Cameroun')).toBe('UBA');
    expect(printableBank('Ecobank Cameroun')).toBe('ECOBANK');
    expect(printableBank('OTHER')).toBeUndefined();
    expect(printableBank(null)).toBeUndefined();
  });

  it("montre dans l'IBAN exactement les chiffres du RIB (CM21 + banque + agence + compte + clé)", () => {
    for (const a of allBankAccounts()) {
      expect(a.iban.split(' '), a.key).toEqual(['CM21', a.bankCode, a.branchCode, a.accountNumber, a.ribKey]);
      expect(a.iban.replace(/\s/g, '').length, a.key).toBe(27);
      expect(swiftIsWellFormed(a.swift), a.key).toBe(true);
    }
  });

  it.each(['ECOBANK', 'UBA', 'AFRILAND'])('%s : IBAN et clé RIB vérifiés', (key) => {
    const a = account(key);
    expect(ibanIsValid(a.iban)).toBe(true);
    expect(computeRibKey(a.bankCode, a.branchCode, a.accountNumber)).toBe(a.ribKey);
  });

  it("UBA : l'IBAN et le SWIFT corrigés le 24/09/2026", () => {
    const uba = account('UBA');
    expect(uba.iban).toBe('CM21 10033 05214 14011000141 88');
    expect(uba.swift).toBe('UNAFCMCX');
  });

  it("CCA-Bank : l'IBAN en base ne passe pas le contrôle — la fiche ne l'imprime pas tant que la banque n'a pas confirmé", () => {
    // Garde-fou : quand CCA-Bank aura confirmé ses chiffres et que la donnée
    // sera corrigée, ce test échouera — ajoutez alors CCA au test ci-dessus.
    // Trois corrections d'un seul chiffre rendraient le RIB cohérent (clé 71,
    // agence 10044 ou compte 00280296901) : seule la banque peut trancher.
    const cca = account('CCA');
    expect(ibanIsValid(cca.iban)).toBe(false);
    expect(computeRibKey(cca.bankCode, cca.branchCode, cca.accountNumber)).not.toBe(cca.ribKey);
    expect(bankGuideData().accounts.map((a) => a.key)).not.toContain('CCA');
    expect(printableBank('CCA')).toBeUndefined();
  });

  it('est bilingue : chaque texte a sa version française et anglaise', () => {
    const c = BANK_GUIDE_COPY;
    expect(c.virement.word).toEqual({ fr: 'Virement', en: 'Bank transfer' });
    expect(c.guichet.word).toEqual({ fr: 'Dépôt au guichet', en: 'Cash deposit' });
    expect(c.virement.needs.fr).toBe('IBAN + SWIFT');
    expect(c.guichet.needs.fr).toBe('RIB');
    for (const p of pairs(c)) {
      expect(p.fr.trim(), JSON.stringify(p)).not.toBe('');
      expect(p.en.trim(), JSON.stringify(p)).not.toBe('');
    }
    expect(BANK_GUIDE_FILENAME).toEqual({ portrait: 'coordonnees-bancaires-portrait.pdf', landscape: 'coordonnees-bancaires-paysage.pdf' });
    expect(bankRibFilename('ECOBANK')).toBe('rib-ecobank.pdf');
    expect(bankRibFilename('CCA', 'landscape')).toBe('rib-cca-paysage.pdf');
  });

  it('reste sobre dans chaque langue : peu de mots, des phrases courtes', () => {
    expect(bankGuideWords('fr').length).toBeLessThanOrEqual(125);
    expect(bankGuideWords('en').length).toBeLessThanOrEqual(125);
    for (const p of pairs(BANK_GUIDE_COPY)) {
      expect(p.fr.split(/\s+/).length, p.fr).toBeLessThanOrEqual(12);
      expect(p.en.split(/\s+/).length, p.en).toBeLessThanOrEqual(12);
    }
  });

  it("est au nom de la société : ni site, ni téléphone, ni « Bonzini Labs », ni WhatsApp, ni date — et avec les vrais logos", () => {
    const stripComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
    // La fiche et le kit qu'elle partage avec la fiche Mobile Money (en-tête, pied, remerciement).
    const files = ['src/lib/pdf/templates/BankDetailsPDF.tsx', 'src/lib/bankDetailsGuide.ts', 'src/lib/bankDetailsPdf.ts', 'src/lib/pdf/components/guideKit.tsx', 'src/lib/pdf/guideTokens.ts', 'src/lib/pdf/guideStyles.ts'];
    const src = stripComments(files.map((f) => readFileSync(f, 'utf8')).join('\n'));
    for (const forbidden of [/bonzinilabs\.com/i, /Bonzini ?Labs/i, /Bonzini Trading/i, /WhatsApp/i, /WEBSITE/, /\+237|\+86/, /PLATEFORME/i, /plafond/i]) {
      expect(src, String(forbidden)).not.toMatch(forbidden);
    }
    expect(readFileSync('src/lib/pdf/components/guideKit.tsx', 'utf8')).toContain('{LEGAL_NAME}');
    for (const logo of ['ecobank.png', 'cca.png', 'uba.png', 'afriland.png']) {
      expect(src).toContain(`bank-logos/${logo}`);
      expect(existsSync(`src/assets/bank-logos/${logo}`), logo).toBe(true);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { paymentDocId, paymentDocTitle } from '@/lib/paymentDocuments';
import { pageImageName } from '@/lib/pdfToImages';
import { getBankInfo, methodFamilies, selectableMethodFamilies, WAVE_ENABLED, waveAccount } from '@/data/depositMethodsData';

describe('les documents « coordonnées de paiement »', () => {
  it('nomme chaque document sans ambiguïté (format et mise en page compris)', () => {
    expect(paymentDocId({ kind: 'banks' }, 'pdf', 'portrait')).toBe('banks:pdf:portrait');
    expect(paymentDocId({ kind: 'rib', bank: 'UBA' }, 'png', 'landscape')).toBe('rib-UBA:png:landscape');
    expect(paymentDocId({ kind: 'mobile-money' }, 'png', 'portrait')).toBe('mobile-money:png:portrait');
  });

  it('titre la feuille de partage au nom de la société', () => {
    expect(paymentDocTitle({ kind: 'banks' })).toBe('NORTON GAUSS BONZINI SARL · Coordonnées bancaires');
    expect(paymentDocTitle({ kind: 'rib', bank: 'CCA' })).toBe('NORTON GAUSS BONZINI SARL · RIB CCA-Bank Cameroun');
    expect(paymentDocTitle({ kind: 'mobile-money' })).toBe('NORTON GAUSS BONZINI SARL · Coordonnées Mobile Money');
  });

  it('nomme les images comme le PDF, page par page', () => {
    expect(pageImageName('rib-uba.pdf', 1, 1)).toBe('rib-uba.png');
    expect(pageImageName('coordonnees-bancaires-paysage.pdf', 2, 6)).toBe('coordonnees-bancaires-paysage-p2.png');
  });
});

describe('les moyens de dépôt proposés', () => {
  it("ne propose Wave que s'il est ouvert, et jamais avec le numéro d'exemple", () => {
    const offered = selectableMethodFamilies.map((f) => f.family);
    if (WAVE_ENABLED) {
      expect(offered).toContain('WAVE');
      expect(waveAccount.phone).not.toBe('+237 691 000 003');
      expect(waveAccount.accountName).not.toBe('BONZINI TRADING');
    } else {
      expect(offered).not.toContain('WAVE');
    }
    // Les autres moyens restent tous proposés, dans le même ordre.
    expect(offered.filter((f) => f !== 'WAVE')).toEqual(methodFamilies.map((f) => f.family).filter((f) => f !== 'WAVE'));
  });

  it("retrouve une banque par sa clé (dépôts du client) ou par son libellé (dépôts de l'équipe)", () => {
    expect(getBankInfo('UBA')?.bank).toBe('UBA');
    expect(getBankInfo('UBA Cameroun')?.bank).toBe('UBA');
    expect(getBankInfo('CCA-BANK Cameroun')?.bonziniAccount.codeAgence).toBe('10044');
    expect(getBankInfo('Banque inconnue')).toBeUndefined();
  });
});

describe('les étapes de paiement montrées dans l’app', () => {
  const files = [
    'src/i18n/locales/fr/deposits.json', 'src/i18n/locales/en/deposits.json', 'src/i18n/locales/zh/deposits.json',
    'src/mobile/screens/deposits/new-deposit/MobileNewDepositV2.tsx', 'src/desktop/screens/deposits/DesktopNewDeposit.tsx',
    'src/components/deposit/DepositInstructions.tsx', 'src/pages/NewDepositPage.tsx',
  ];
  it('disent la même chose que la fiche officielle : pas de menu inventé, pas de plafond, pas de « transfert d’argent »', async () => {
    const { readFileSync } = await import('node:fs');
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      for (const forbidden of [/#150\*1\*1#/, /\*126#/, /Transfert d'argent|Money transfer/i, /Limite ?: ?500|500[ ,]000 XAF per/i, /Replace AMOUNT/]) {
        expect(src, `${f} ${forbidden}`).not.toMatch(forbidden);
      }
    }
  });
});

import { describe, expect, it } from 'vitest';
import { paymentDocId, paymentDocTitle } from '@/lib/paymentDocuments';
import { MAX_CANVAS_AREA, sheetImageName, sheetLayout } from '@/lib/pdfToImages';
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

  it("nomme l'image unique comme le PDF", () => {
    expect(sheetImageName('rib-uba.pdf')).toBe('rib-uba.png');
    expect(sheetImageName('coordonnees-bancaires-paysage.pdf')).toBe('coordonnees-bancaires-paysage.png');
  });
});

describe("l'image unique : toutes les pages dans une planche", () => {
  const A4 = { width: 595.28, height: 841.89 };
  const A4L = { width: 841.89, height: 595.28 };
  const pages = (p: { width: number; height: number }, n: number) => Array.from({ length: n }, () => p);

  it('pose les pages sur la grille la plus carrée, sans cases vides inutiles', () => {
    expect([sheetLayout(pages(A4, 6)).cols, sheetLayout(pages(A4, 6)).rows]).toEqual([3, 2]); // livret des banques, portrait
    expect([sheetLayout(pages(A4L, 6)).cols, sheetLayout(pages(A4L, 6)).rows]).toEqual([2, 3]); // livret des banques, paysage
    expect([sheetLayout(pages(A4, 4)).cols, sheetLayout(pages(A4, 4)).rows]).toEqual([2, 2]); // fiche Mobile Money
    expect([sheetLayout(pages(A4L, 4)).cols, sheetLayout(pages(A4L, 4)).rows]).toEqual([2, 2]);
    expect([sheetLayout(pages(A4, 1)).cols, sheetLayout(pages(A4, 1)).rows]).toEqual([1, 1]); // RIB d'une banque
  });

  it("tient sous le plafond de l'iPhone (16,7 millions de pixels) et reste lisible", () => {
    for (const layout of [sheetLayout(pages(A4, 6)), sheetLayout(pages(A4L, 6)), sheetLayout(pages(A4, 4))]) {
      expect(layout.width * layout.height).toBeLessThanOrEqual(MAX_CANVAS_AREA);
      // Chaque page garde au moins ~1 300 px de large en portrait (≈ 2,2× le PDF).
      expect(layout.scale).toBeGreaterThan(2);
    }
    // Une page seule : l'échelle pleine, sans marge.
    const one = sheetLayout(pages(A4, 1));
    expect(one.scale).toBe(2.5);
    expect(one.cells[0]).toEqual({ x: 0, y: 0, width: one.width, height: one.height });
  });

  it('ne dépasse jamais le plafond, quel que soit le nombre de pages, et garde chaque page dans l’image', () => {
    for (const size of [A4, A4L]) {
      for (let n = 1; n <= 12; n++) {
        const l = sheetLayout(pages(size, n));
        expect(l.width * l.height, `${n} pages`).toBeLessThanOrEqual(MAX_CANVAS_AREA);
        expect(l.cells).toHaveLength(n);
        for (const c of l.cells) {
          expect(c.x).toBeGreaterThanOrEqual(0);
          expect(c.y).toBeGreaterThanOrEqual(0);
          expect(c.x + c.width).toBeLessThanOrEqual(l.width);
          expect(c.y + c.height).toBeLessThanOrEqual(l.height);
        }
      }
    }
  });

  it("range les pages dans l'ordre de lecture, sans chevauchement", () => {
    const { cells } = sheetLayout(pages(A4, 6));
    expect(cells[1].x).toBeGreaterThan(cells[0].x + cells[0].width); // page 2 à droite de la page 1
    expect(cells[3].y).toBeGreaterThan(cells[0].y + cells[0].height); // page 4 sous la page 1
    expect(cells[3].x).toBe(cells[0].x);
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

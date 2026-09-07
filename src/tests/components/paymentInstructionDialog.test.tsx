/**
 * La fenêtre « Instruction de paiement ».
 *
 * Elle montre à l'opérateur CE QUE LE PARTENAIRE RECEVRA avant qu'il ne
 * l'envoie. Ce qui doit donc tenir :
 *
 *  · chaque méthode montre SES coordonnées — un virement sans numéro de
 *    compte, ou un Alipay affiché avec des champs bancaires, est un paiement
 *    qui n'arrivera pas ;
 *  · le QR est là quand il existe, et son ABSENCE est dite plutôt que
 *    silencieuse : sur Alipay/WeChat, c'est lui qu'on scanne ;
 *  · les trois sorties (PDF, image, texte) sont toujours offertes, et
 *    l'IMAGE capture LA CARTE ENTIÈRE. C'est tout le sujet du bouton :
 *    « copier l'image » depuis le navigateur ne prenait que le QR — ni le
 *    montant, ni la référence, ni le nom, ni le téléphone.
 *
 * Le rendu du PDF lui-même n'est pas testé ici — `@react-pdf` ne peint rien
 * en jsdom. Le module est donc remplacé, et c'est l'APPEL qui est vérifié.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const downloadPDF = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/pdf/downloadPDF', () => ({ downloadPDF: (...args: unknown[]) => downloadPDF(...args) }));
vi.mock('@/lib/pdf/templates/PaymentInstructionPDF', () => ({
  PaymentInstructionPDF: () => null,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const copyNodePng = vi.fn(async (_node: HTMLElement, _filename: string) => 'copied' as 'copied' | 'downloaded');
const prewarmFontEmbedCss = vi.fn();
vi.mock('@/lib/nodeImage', () => ({
  copyNodePng: (node: HTMLElement, filename: string) => copyNodePng(node, filename),
  prewarmFontEmbedCss: (node: HTMLElement) => prewarmFontEmbedCss(node),
}));

import { PaymentInstructionDialog } from '@/desktop/screens/payments/PaymentInstructionDialog';
import type { PaymentInstructionEntry } from '@/lib/paymentInstruction';

const bankEntry: PaymentInstructionEntry = {
  id: 'p1',
  reference: 'BZ-PY-2026-1192',
  amount_rmb: 58900,
  method: 'bank_transfer',
  created_at: '2026-09-01T10:00:00.000Z',
  beneficiary_name: 'Guangzhou Hongfa Trade',
  beneficiary_bank_name: 'Bank of China',
  beneficiary_bank_account: '6214 8802 3391 5588',
  beneficiary_bank_extra: 'BKCHCNBJ',
  beneficiary_phone: '+86 138 0219 4471',
  beneficiary_email: 'hongfa@example.cn',
};

const alipayEntry: PaymentInstructionEntry = {
  id: 'p5',
  reference: 'BZ-PY-2026-1201',
  amount_rmb: 31120,
  method: 'alipay',
  created_at: '2026-08-03T10:00:00.000Z',
  beneficiary_name: 'Shenzhen Kaida Electronics',
  beneficiary_identifier: '138 2244 9087',
  beneficiary_qr_code_url: 'https://x/storage/v1/object/sign/payment-proofs/qr.png?token=abc',
};

const open = (entry: PaymentInstructionEntry) =>
  render(<PaymentInstructionDialog open onClose={() => undefined} entry={entry} />);

beforeEach(() => {
  downloadPDF.mockClear();
  copyNodePng.mockClear();
  copyNodePng.mockResolvedValue('copied');
  prewarmFontEmbedCss.mockClear();
});

describe('Le virement bancaire montre ses quatre coordonnées', () => {
  it('bénéficiaire, banque, compte et code bancaire', () => {
    open(bankEntry);
    expect(screen.getByText('Beneficiary · 收款人')).toBeTruthy();
    expect(screen.getByText('Guangzhou Hongfa Trade')).toBeTruthy();
    expect(screen.getByText('Bank · 银行')).toBeTruthy();
    expect(screen.getByText('Bank of China')).toBeTruthy();
    expect(screen.getByText('Account · 账号')).toBeTruthy();
    expect(screen.getByText('6214 8802 3391 5588')).toBeTruthy();
    expect(screen.getByText('SWIFT / IBAN · 银行代码')).toBeTruthy();
    expect(screen.getByText('BKCHCNBJ')).toBeTruthy();
  });

  it("n'invente pas d'identifiant Alipay sur un virement", () => {
    open(bankEntry);
    expect(screen.queryByText(/支付宝账号/)).toBeNull();
    expect(screen.queryByText(/微信号/)).toBeNull();
    // Et aucun QR : il n'y a rien à scanner.
    expect(screen.queryByRole('img')).toBeNull();
  });
});

describe('Alipay et WeChat montrent le code à scanner', () => {
  it('le QR est affiché, avec la référence dans son texte alternatif', () => {
    open(alipayEntry);
    const img = screen.getByRole('img');
    expect(img.getAttribute('src')).toContain('qr.png');
    expect(img.getAttribute('alt')).toContain('BZ-PY-2026-1201');
    expect(screen.getByText('Alipay ID · 支付宝账号')).toBeTruthy();
    expect(screen.getByText('138 2244 9087')).toBeTruthy();
  });

  it('WeChat porte SON libellé, pas celui d’Alipay', () => {
    open({ ...alipayEntry, method: 'wechat', beneficiary_identifier: 'linmei_gz88' });
    expect(screen.getByText('WeChat ID · 微信号')).toBeTruthy();
    expect(screen.queryByText(/支付宝账号/)).toBeNull();
  });

  it("l'absence de QR est DITE — c'est lui qu'on scanne", () => {
    open({ ...alipayEntry, beneficiary_qr_code_url: null });
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText(/Aucun QR enregistré/i)).toBeTruthy();
  });

  it('un virement sans QR ne déclenche PAS cet avertissement', () => {
    open(bankEntry);
    expect(screen.queryByText(/Aucun QR enregistré/i)).toBeNull();
  });
});

describe('Les trois sorties', () => {
  it('montre le montant, la référence et la méthode', () => {
    open(alipayEntry);
    expect(screen.getByText('Alipay')).toBeTruthy();
    expect(screen.getByText('BZ-PY-2026-1201')).toBeTruthy();
    expect(screen.getByText(/Amount to send · 付款金额/)).toBeTruthy();
    expect(screen.getByText(/31/)).toBeTruthy();
  });

  it('offre le PDF et le texte, et génère le PDF au clic', async () => {
    open(alipayEntry);
    expect(screen.getByRole('button', { name: /Copier le texte/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Télécharger le PDF/ }));
    await waitFor(() => expect(downloadPDF).toHaveBeenCalledTimes(1));
    // Le nom de fichier porte la référence : le partenaire reçoit parfois
    // plusieurs instructions le même jour.
    expect(downloadPDF.mock.calls[0][1]).toBe('Bonzini_Payment_BZ-PY-2026-1201.pdf');
  });

  it("copie LA CARTE — montant, référence et QR compris, pas seulement le QR", async () => {
    open(alipayEntry);
    fireEvent.click(screen.getByRole('button', { name: /Copier l'image/ }));
    await waitFor(() => expect(copyNodePng).toHaveBeenCalledTimes(1));

    const [node, filename] = copyNodePng.mock.calls[0];
    expect(filename).toBe('BZ-PY-2026-1201.png');
    // Le nœud capturé porte tout le document…
    expect(node.textContent).toContain('BZ-PY-2026-1201');
    expect(node.textContent).toContain('Amount to send');
    expect(node.textContent).toContain('Shenzhen Kaida Electronics');
    expect(node.querySelector('img')).toBeTruthy();
    // …et RIEN de l'écran : ni le titre de la fenêtre, ni les boutons.
    expect(node.textContent).not.toContain('Instruction de paiement');
    expect(node.querySelector('button')).toBeNull();
  });

  it("dit à l'opérateur quand l'image a été téléchargée plutôt que copiée", async () => {
    copyNodePng.mockResolvedValue('downloaded');
    open(bankEntry);
    fireEvent.click(screen.getByRole('button', { name: /Copier l'image/ }));
    const { toast } = await import('sonner');
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/téléchargée/)));
  });

  it("le virement bancaire capture ses coordonnées, sans QR", async () => {
    open(bankEntry);
    fireEvent.click(screen.getByRole('button', { name: /Copier l'image/ }));
    await waitFor(() => expect(copyNodePng).toHaveBeenCalledTimes(1));
    const node = copyNodePng.mock.calls[0][0];
    expect(node.textContent).toContain('6214 8802 3391 5588');
    expect(node.textContent).toContain('+86 138 0219 4471');
    expect(node.querySelector('img')).toBeNull();
  });

  it("prépare la capture dès l'ouverture — le clic ne doit pas attendre le réseau", () => {
    open(alipayEntry);
    // Sur le nœud du document, pas sur la fenêtre : c'est lui qu'on capturera.
    expect(prewarmFontEmbedCss).toHaveBeenCalledTimes(1);
    const node = prewarmFontEmbedCss.mock.calls[0][0] as HTMLElement;
    expect(node.textContent).toContain('BZ-PY-2026-1201');
    expect(node.querySelector('button')).toBeNull();
  });
});

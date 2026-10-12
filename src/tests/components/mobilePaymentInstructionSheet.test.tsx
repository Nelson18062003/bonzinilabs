/**
 * L'instruction de paiement sur TÉLÉPHONE (12/10/2026).
 *
 * Sur la fiche mobile, l'opérateur envoie l'instruction au partenaire Alipay
 * depuis WeChat ou WhatsApp. Ce qui doit tenir :
 *
 *  · la carte montrée est la MÊME que sur ordinateur (montant, référence,
 *    bénéficiaire) ;
 *  · l'image et le PDF sont fabriqués DÈS l'ouverture — Safari n'ouvre la
 *    feuille de partage que dans le toucher, pas après une longue attente —
 *    l'image d'abord : le PDF occupe le téléphone plusieurs secondes ;
 *  · ils ne sont fabriqués qu'UNE fois : la fiche recrée l'objet à chaque
 *    rendu et le QR signé change de jeton à chaque relecture ;
 *  · « Partager l'image » remet l'image de LA CARTE à la feuille de partage
 *    (ou la télécharge, sans feuille), « Copier le texte » copie le texte
 *    bilingue.
 *
 * `@react-pdf` et html-to-image ne peignent rien en jsdom : les fabriques
 * sont remplacées, et ce sont les APPELS qui sont vérifiés.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

const pdfFile = new File(['%PDF'], 'Bonzini_Payment_BZ-PY-2026-1280.pdf', { type: 'application/pdf' });
const pngFile = new File(['png'], 'Bonzini_Payment_BZ-PY-2026-1280.png', { type: 'image/png' });
const buildInstructionPdfFile = vi.fn(async () => pdfFile);
const buildInstructionImageFile = vi.fn(async (_node: HTMLElement) => pngFile);
vi.mock('@/lib/paymentInstructionFiles', () => ({
  buildInstructionPdfFile: () => buildInstructionPdfFile(),
  buildInstructionImageFile: (node: HTMLElement) => buildInstructionImageFile(node),
}));
const deliverFile = vi.fn(async (_file: File, _title: string) => 'shared' as 'shared' | 'downloaded');
const downloadFile = vi.fn((_file: File) => undefined);
vi.mock('@/components/customer-code/exportShippingLabel', () => ({
  deliverFile: (file: File, title: string) => deliverFile(file, title),
  downloadFile: (file: File) => downloadFile(file),
}));
const copyToClipboard = vi.fn(async (_text: string, _label?: string) => true);
vi.mock('@/lib/clipboard', () => ({ copyToClipboard: (text: string, label?: string) => copyToClipboard(text, label) }));
const toastSuccess = vi.fn();
vi.mock('sonner', () => ({ toast: { success: (m: string) => toastSuccess(m), error: vi.fn() } }));

import { MobilePaymentInstructionSheet } from '@/mobile/screens/payments/MobilePaymentInstructionSheet';
import type { PaymentInstructionEntry } from '@/lib/paymentInstruction';

const entry: PaymentInstructionEntry = {
  id: 'p9',
  reference: 'BZ-PY-2026-1280',
  amount_rmb: 12_500,
  method: 'alipay',
  created_at: '2026-10-12T08:00:00.000Z',
  beneficiary_name: 'Yiwu Star Bags',
  beneficiary_identifier: '139 0000 1111',
  beneficiary_qr_code_url: 'https://x/storage/v1/object/sign/payment-proofs/qr.png?token=t1',
};

const sheet = (e: PaymentInstructionEntry, open = true) => (
  <MobilePaymentInstructionSheet open={open} onClose={() => undefined} entry={e} />
);

const imageButton = () => screen.getByRole('button', { name: /Partager l'image|Préparation de l'image/ });

beforeEach(() => {
  buildInstructionPdfFile.mockClear();
  buildInstructionImageFile.mockClear();
  deliverFile.mockClear();
  deliverFile.mockResolvedValue('shared');
  downloadFile.mockClear();
  copyToClipboard.mockClear();
  toastSuccess.mockClear();
});

describe('La carte du partenaire, sur téléphone', () => {
  it('montre le montant, la référence et le bénéficiaire', () => {
    render(sheet(entry));
    expect(screen.getByText('Instruction de paiement · 付款指令')).toBeTruthy();
    expect(screen.getAllByText(/BZ-PY-2026-1280/).length).toBeGreaterThan(0);
    expect(screen.getByText('Yiwu Star Bags')).toBeTruthy();
    expect(screen.getByText(/12[\s  ,.]?500/)).toBeTruthy();
  });

  it('fermée : rien n’est fabriqué', () => {
    render(sheet(entry, false));
    expect(buildInstructionPdfFile).not.toHaveBeenCalled();
    expect(screen.queryByText('Instruction de paiement · 付款指令')).toBeNull();
  });

  it('Alipay sans QR : l’absence est dite', () => {
    render(sheet({ ...entry, beneficiary_qr_code_url: null }));
    expect(screen.getByText(/Aucun QR enregistré/)).toBeTruthy();
  });
});

describe('Fabriqués dès l’ouverture, une seule fois', () => {
  it('l’image de LA CARTE puis le PDF se préparent à l’ouverture', async () => {
    const order: string[] = [];
    buildInstructionImageFile.mockImplementationOnce(async () => { order.push('image'); return pngFile; });
    buildInstructionPdfFile.mockImplementationOnce(async () => { order.push('pdf'); return pdfFile; });
    render(sheet(entry));
    await waitFor(() => expect(buildInstructionPdfFile).toHaveBeenCalledTimes(1));
    expect(order).toEqual(['image', 'pdf']);
    expect(buildInstructionImageFile).toHaveBeenCalledTimes(1);
    const node = buildInstructionImageFile.mock.calls[0][0];
    expect(node.textContent).toContain('BZ-PY-2026-1280');
    expect(node.textContent).toContain('Yiwu Star Bags');
    await waitFor(() => expect(imageButton().textContent).toContain("Partager l'image"));
  });

  it('un nouveau rendu de la fiche, QR re-signé : pas de nouvelle fabrication', async () => {
    const { rerender } = render(sheet(entry));
    await waitFor(() => expect(buildInstructionImageFile).toHaveBeenCalledTimes(1));
    rerender(sheet({ ...entry, beneficiary_qr_code_url: entry.beneficiary_qr_code_url!.replace('t1', 't2') }));
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    expect(buildInstructionPdfFile).toHaveBeenCalledTimes(1);
    expect(buildInstructionImageFile).toHaveBeenCalledTimes(1);
  });

  it('le montant change : le document se refait', async () => {
    const { rerender } = render(sheet(entry));
    await waitFor(() => expect(buildInstructionImageFile).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(buildInstructionPdfFile).toHaveBeenCalledTimes(1));
    rerender(sheet({ ...entry, amount_rmb: 13_000 }));
    await waitFor(() => expect(buildInstructionImageFile).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(buildInstructionPdfFile).toHaveBeenCalledTimes(2));
  });
});

describe('Envoyer au partenaire', () => {
  it('« Partager l’image » remet l’image à la feuille de partage', async () => {
    render(sheet(entry));
    await waitFor(() => expect(imageButton().textContent).toContain("Partager l'image"));
    fireEvent.click(imageButton());
    await waitFor(() => expect(deliverFile).toHaveBeenCalledWith(pngFile, 'Bonzini · BZ-PY-2026-1280'));
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('sans feuille de partage, l’image est téléchargée et on le dit', async () => {
    deliverFile.mockResolvedValue('downloaded');
    render(sheet(entry));
    await waitFor(() => expect(imageButton().textContent).toContain("Partager l'image"));
    fireEvent.click(imageButton());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Image téléchargée'));
  });

  it('« Partager le PDF » et « Télécharger le PDF » prennent le PDF déjà prêt', async () => {
    render(sheet(entry));
    await waitFor(() => expect(screen.getByRole('button', { name: /Partager le PDF/ }).hasAttribute('disabled')).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: /Partager le PDF/ }));
    await waitFor(() => expect(deliverFile).toHaveBeenCalledWith(pdfFile, 'Bonzini · BZ-PY-2026-1280'));
    fireEvent.click(screen.getByRole('button', { name: /Télécharger le PDF/ }));
    await waitFor(() => expect(downloadFile).toHaveBeenCalledWith(pdfFile));
    expect(buildInstructionPdfFile).toHaveBeenCalledTimes(1);
  });

  it('tant que le PDF se prépare, ses boutons attendent (l’image, elle, est prête)', async () => {
    buildInstructionPdfFile.mockImplementationOnce(() => new Promise<File>(() => undefined));
    render(sheet(entry));
    await waitFor(() => expect(imageButton().hasAttribute('disabled')).toBe(false));
    const pdfButton = screen.getByRole('button', { name: /Préparation du PDF/ });
    expect(pdfButton.hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: /Télécharger le PDF/ }).hasAttribute('disabled')).toBe(true);
  });

  it('« Copier le texte » copie le texte bilingue', () => {
    render(sheet(entry));
    fireEvent.click(screen.getByRole('button', { name: /Copier le texte/ }));
    const text = copyToClipboard.mock.calls[0][0];
    expect(text).toContain('BZ-PY-2026-1280');
    expect(text).toContain('Alipay ID / 支付宝账号: 139 0000 1111');
  });
});

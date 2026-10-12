/**
 * L'image de l'instruction, fabriquée sur TÉLÉPHONE (12/10/2026).
 *
 * Laissé à lui-même, html-to-image retéléchargeait Google Fonts à chaque
 * capture (des mégaoctets d'idéogrammes) : en 3G, la carte ne sortait pas.
 * Ce qui doit tenir :
 *  · la capture reçoit la CSS de DM Sans faite des fichiers de l'app
 *    (/fonts), chargés UNE fois par session ;
 *  · fichiers injoignables : capture avec les polices du système, pas de
 *    détour par Google ; et l'échec n'est pas gardé (on retente) ;
 *  · un QR qui ne charge pas ne bloque pas l'envoi.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const captureNodePng = vi.fn(async (_node: HTMLElement, _opts: Record<string, unknown>) => 'data:image/png;base64,AAAA');
vi.mock('@/lib/nodeImage', () => ({ captureNodePng: (n: HTMLElement, o: Record<string, unknown>) => captureNodePng(n, o) }));
vi.mock('@react-pdf/renderer', () => ({
  pdf: () => ({ toBlob: async () => new Blob(['%PDF']) }),
  Font: { register: () => undefined, registerHyphenationCallback: () => undefined },
  StyleSheet: { create: <T,>(s: T) => s },
}));
vi.mock('@/lib/pdf/templates/PaymentInstructionPDF', () => ({ PaymentInstructionPDF: () => null }));

const entry = { id: 'p9', reference: 'BZ-PY-2026-1280', amount_rmb: 12_500, method: 'alipay' };
let fontsOk = true;
const fetchMock = vi.fn(async (url: string) => {
  if (url.startsWith('data:')) return new Response(new Blob(['png'], { type: 'image/png' }));
  if (url.startsWith('/fonts/')) return fontsOk ? new Response(new Uint8Array([1, 2, 3]).buffer) : new Response('', { status: 404 });
  throw new Error(`réseau inattendu : ${url}`);
});

async function load() {
  vi.resetModules();
  return import('@/lib/paymentInstructionFiles');
}

function card(withImg = false): HTMLElement {
  const node = document.createElement('div');
  node.textContent = 'BZ-PY-2026-1280';
  if (withImg) {
    // jsdom ne charge jamais une image : le QR reste « en cours ».
    const img = document.createElement('img');
    img.src = 'https://x/storage/v1/object/sign/payment-proofs/qr.png?token=t1';
    node.appendChild(img);
  }
  return node;
}

beforeEach(() => {
  fontsOk = true;
  captureNodePng.mockClear();
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Polices de l’image', () => {
  it('DM Sans des fichiers de l’app, sans Google, une fois par session', async () => {
    const { buildInstructionImageFile } = await load();
    const file = await buildInstructionImageFile(card(), entry);
    expect(file.name).toBe('Bonzini_Payment_BZ-PY-2026-1280.png');
    expect(file.type).toBe('image/png');
    const opts = captureNodePng.mock.calls[0][1];
    expect(opts.fontEmbedCSS).toMatch(/font-family:"DM Sans";font-style:normal;font-weight:400;src:url\(data:font\/woff;base64,/);
    expect(opts.fontEmbedCSS).toMatch(/font-weight:900/);
    expect(opts.webkitWarmup).toBe(true);
    const fontCalls = fetchMock.mock.calls.filter(([u]) => u.startsWith('/fonts/')).length;
    expect(fontCalls).toBe(6);
    await buildInstructionImageFile(card(), entry);
    expect(fetchMock.mock.calls.filter(([u]) => u.startsWith('/fonts/')).length).toBe(6);
    expect(fetchMock.mock.calls.some(([u]) => /googleapis|gstatic/.test(u))).toBe(false);
  });

  it('fichiers injoignables : polices du système, puis on retente la fois suivante', async () => {
    fontsOk = false;
    const { buildInstructionImageFile } = await load();
    await buildInstructionImageFile(card(), entry);
    expect(captureNodePng.mock.calls[0][1]).toMatchObject({ embedFonts: false });
    expect(captureNodePng.mock.calls[0][1].fontEmbedCSS).toBeUndefined();

    fontsOk = true;
    await buildInstructionImageFile(card(), entry);
    expect(captureNodePng.mock.calls[1][1].fontEmbedCSS).toMatch(/DM Sans/);
  });
});

describe('Le QR', () => {
  it('un QR qui ne charge pas ne bloque pas l’envoi (6 s au plus)', async () => {
    vi.useFakeTimers();
    const { buildInstructionImageFile } = await load();
    let done = false;
    const pending = buildInstructionImageFile(card(true), entry).then((f) => {
      done = true;
      return f;
    });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1_500);
    vi.useRealTimers();
    const file = await pending;
    expect(file.type).toBe('image/png');
    expect(captureNodePng).toHaveBeenCalledTimes(1);
  });
});

describe('Le PDF', () => {
  it('un fichier PDF au nom du paiement', async () => {
    const { buildInstructionPdfFile } = await load();
    const file = await buildInstructionPdfFile(entry);
    expect(file.name).toBe('Bonzini_Payment_BZ-PY-2026-1280.pdf');
    expect(file.type).toBe('application/pdf');
  });
});

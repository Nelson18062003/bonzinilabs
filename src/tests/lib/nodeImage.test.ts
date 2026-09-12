/**
 * La capture d'un nœud en image.
 *
 * Deux choses seulement, mais ce sont celles qui cassent en silence :
 *
 *  · les POLICES sont attendues AVANT la capture. `html-to-image` peint avec
 *    ce qui est chargé à l'instant T ; sans cette attente, un document
 *    bilingue part en police de repli et « 付款金额 » devient une rangée de
 *    rectangles. Le bug est invisible à l'écran — seul le fichier est faux ;
 *  · quand le navigateur ne sait pas copier une image, on TÉLÉCHARGE. Un clic
 *    qui ne produit rien est le pire des retours.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const toPng = vi.fn(async (_node: HTMLElement, _opts?: Record<string, unknown>) => 'data:image/png;base64,AAAA');
const getFontEmbedCSS = vi.fn(async (_node: HTMLElement) => '/* fonts */');
vi.mock('html-to-image', () => ({
  toPng: (node: HTMLElement, opts?: Record<string, unknown>) => toPng(node, opts),
  // La collecte des `@font-face` est réseau : on la neutralise, son propre
  // comportement (cache + délai maximum) est testé plus bas.
  getFontEmbedCSS: (node: HTMLElement) => getFontEmbedCSS(node),
}));

import {
  captureNodePng,
  copyNodePng,
  prewarmFontEmbedCss,
  resetFontEmbedCache,
  triggerDownload,
} from '@/lib/nodeImage';

const node = () => document.createElement('div');

/** Ordre réel des appels : la police doit être résolue avant `toPng`. */
let order: string[] = [];

beforeEach(() => {
  order = [];
  toPng.mockClear();
  getFontEmbedCSS.mockClear();
  resetFontEmbedCache();
  toPng.mockImplementation(async () => {
    order.push('capture');
    return 'data:image/png;base64,AAAA';
  });
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: {
      load: vi.fn(async () => {
        order.push('font');
        return [];
      }),
      ready: Promise.resolve(),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Les polices sont prêtes avant la capture', () => {
  it('charge DM Sans ET Noto Sans SC, puis seulement capture', async () => {
    await captureNodePng(node());
    const specs = (document.fonts.load as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
    expect(specs.some((s) => s.includes('DM Sans'))).toBe(true);
    // Sans Noto Sans SC, tout le bilingue chinois du document tombe en rectangles.
    expect(specs.some((s) => s.includes('Noto Sans SC'))).toBe(true);
    expect(order.at(-1)).toBe('capture');
    expect(order.indexOf('font')).toBeLessThan(order.indexOf('capture'));
  });

  it("capture quand même si l'API des polices échoue — une image en repli vaut mieux que rien", async () => {
    (document.fonts.load as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('nope'));
    await expect(captureNodePng(node())).resolves.toContain('data:image/png');
  });

  it('ne force pas de dimension quand on ne lui en donne pas', async () => {
    await captureNodePng(node(), { pixelRatio: 2, backgroundColor: '#fff' });
    const opts = toPng.mock.calls[0][1]!;
    expect(opts.pixelRatio).toBe(2);
    expect(opts.backgroundColor).toBe('#fff');
    expect(opts.width).toBeUndefined();
  });

  it("ne récupère la CSS des polices QU'UNE fois — sinon chaque clic retélécharge Noto Sans SC", async () => {
    const n = node();
    await captureNodePng(n);
    await captureNodePng(n);
    await captureNodePng(n);
    expect(getFontEmbedCSS).toHaveBeenCalledTimes(1);
    // …et les trois captures la reçoivent quand même.
    expect(toPng).toHaveBeenCalledTimes(3);
    for (const call of toPng.mock.calls) expect(call[1]!.fontEmbedCSS).toBe('/* fonts */');
  });

  it('recollecte pour un bloc qui emploie une AUTRE famille', async () => {
    const a = node();
    a.style.fontFamily = '"DM Sans"';
    const b = node();
    b.style.fontFamily = '"Noto Sans SC"';
    await captureNodePng(a);
    await captureNodePng(a);
    expect(getFontEmbedCSS).toHaveBeenCalledTimes(1);
    // `html-to-image` ne garde que les @font-face des familles utilisées DANS
    // le nœud : réutiliser ici la CSS du premier bloc perdrait la police du
    // second, et son texte sortirait en repli.
    await captureNodePng(b);
    expect(getFontEmbedCSS).toHaveBeenCalledTimes(2);
  });

  it('précharge sans bloquer, et le clic suivant réutilise le résultat', async () => {
    const n = node();
    prewarmFontEmbedCss(n);
    await captureNodePng(n);
    expect(getFontEmbedCSS).toHaveBeenCalledTimes(1);
  });
});

describe('Copier une image, ou à défaut la télécharger', () => {
  it('écrit un PNG dans le presse-papiers quand le navigateur le permet', async () => {
    const write = vi.fn(async () => undefined);
    vi.stubGlobal('ClipboardItem', class {
      constructor(public parts: Record<string, Blob>) {}
    });
    vi.stubGlobal('fetch', vi.fn(async () => ({ blob: async () => new Blob(['x'], { type: 'image/png' }) })));
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write } });

    await expect(copyNodePng(node(), 'x.png')).resolves.toBe('copied');
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('retombe sur le téléchargement quand ClipboardItem manque', async () => {
    vi.stubGlobal('ClipboardItem', undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    await expect(copyNodePng(node(), 'instruction.png')).resolves.toBe('downloaded');
    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });
});

describe('Le téléchargement', () => {
  it("porte le nom demandé et ne laisse pas d'ancre derrière lui", () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    triggerDownload('data:image/png;base64,AAAA', 'BZ-PY-2026-1201.png');
    expect(click).toHaveBeenCalled();
    // Une ancre laissée dans le document s'accumulerait à chaque export.
    expect(document.querySelectorAll('a[download]').length).toBe(0);
    click.mockRestore();
  });
});

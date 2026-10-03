// ============================================================
// LA POLICE DU FLYER — livrée avec l'app, identique à l'écran et dans l'image.
//
// Le bug du « flyer cassé » (28/09/2026) : la page affichait DM Sans (venue
// de Google Fonts, souvent déjà en cache), mais la capture (html-to-image)
// devait la re-télécharger ; sur un réseau lent elle abandonnait au bout de
// 5 s et gardait cet échec jusqu'au rechargement. Or html-to-image fige
// chaque bloc à la taille mesurée AVEC DM Sans, puis écrit le texte dans une
// police de secours plus large : textes qui débordent, chiffres collés au
// « ¥ », éléments qui se chevauchent.
//
// Ici : une famille à part (« BZ Flyer Sans »), faite des fichiers DM Sans
// du paquet @fontsource (même origine que l'app, aucun réseau tiers). Elle
// est chargée dans la page (le flyer est mesuré avec elle) ET remise telle
// quelle à la capture (fontEmbedCSS) : les deux voient la même police, à
// chaque fois. Si elle ne se charge pas, on n'image rien plutôt qu'une image
// fausse.
// ============================================================
import w600 from '@fontsource/dm-sans/files/dm-sans-latin-600-normal.woff2?url';
import w700 from '@fontsource/dm-sans/files/dm-sans-latin-700-normal.woff2?url';
import w800 from '@fontsource/dm-sans/files/dm-sans-latin-800-normal.woff2?url';
import w900 from '@fontsource/dm-sans/files/dm-sans-latin-900-normal.woff2?url';

export const FLYER_FONT = 'BZ Flyer Sans';
/** À mettre en font-family du flyer : la police livrée d'abord. */
export const FLYER_FONT_STACK = `"${FLYER_FONT}", "DM Sans", sans-serif`;

const FILES: [number, string][] = [[600, w600], [700, w700], [800, w800], [900, w900]];

function base64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

let loading: Promise<string> | null = null;

/**
 * Charge la police du flyer dans la page (une fois par session) et renvoie
 * la CSS @font-face à donner à la capture. En cas d'échec, on réessaiera au
 * prochain appel (rien n'est gardé en cache d'une erreur).
 */
export function loadFlyerFonts(): Promise<string> {
  if (!loading) {
    loading = (async () => {
      const css = await Promise.all(FILES.map(async ([weight, url]) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Police du flyer (${weight}) : ${res.status}`);
        const buf = await res.arrayBuffer();
        const face = new FontFace(FLYER_FONT, buf.slice(0), { weight: String(weight), style: 'normal' });
        await face.load();
        document.fonts.add(face);
        return `@font-face{font-family:"${FLYER_FONT}";font-style:normal;font-weight:${weight};src:url(data:font/woff2;base64,${base64(buf)}) format("woff2");}`;
      }));
      return css.join('\n');
    })();
    loading.catch(() => { loading = null; });
  }
  return loading;
}

/** La police est-elle vraiment là pour chaque graisse ? (garde-fou avant capture) */
export function flyerFontsLoaded(): boolean {
  return FILES.every(([w]) => document.fonts.check(`${w} 40px "${FLYER_FONT}"`));
}

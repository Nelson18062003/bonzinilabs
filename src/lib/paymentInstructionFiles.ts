// ============================================================
// L'INSTRUCTION DE PAIEMENT EN FICHIERS — le PDF et l'image, prêts à
// partager. Séparé de paymentInstruction.ts (pur, sans moteur de rendu) :
// ici vivent @react-pdf et la capture d'image, chargés seulement quand on
// produit un fichier.
//
// Sur téléphone, la feuille de partage (WhatsApp, WeChat…) doit s'ouvrir
// DANS le toucher : Safari refuse navigator.share après une longue attente.
// D'où des fonctions qui FABRIQUENT le fichier — l'écran les appelle dès son
// ouverture, puis partage le fichier déjà prêt au toucher.
//
// L'IMAGE SANS GOOGLE FONTS. Laissé à lui-même, html-to-image retélécharge
// la feuille Google Fonts et ses fichiers (des mégaoctets pour les
// idéogrammes) : sur un téléphone en 3G, la carte ne sortait pas. On lui
// donne donc la CSS toute faite de DM Sans, À PARTIR DES FICHIERS DE L'APP
// (/fonts, ceux du PDF : même origine, quelques dizaines de Ko). Les
// idéogrammes, que DM Sans ne couvre pas, viennent comme à l'écran de la
// police du téléphone — la carte n'en déclare pas d'autre.
// ============================================================
import { createElement, type ReactElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import { PaymentInstructionPDF } from '@/lib/pdf/templates/PaymentInstructionPDF';
import { captureNodePng } from '@/lib/nodeImage';
import { paymentInstructionFilename, paymentInstructionImageFilename, type PaymentInstructionEntry } from '@/lib/paymentInstruction';

/** La page PDF de l'instruction (QR imprimable), en fichier. */
export async function buildInstructionPdfFile(entry: PaymentInstructionEntry): Promise<File> {
  const el: ReactElement = createElement(PaymentInstructionPDF, { entry });
  const blob = await pdf(el).toBlob();
  return new File([blob], paymentInstructionFilename(entry), { type: 'application/pdf' });
}

const DM_SANS_WEIGHTS = [400, 500, 600, 700, 800, 900] as const;

function base64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

let dmSansCss: Promise<string> | null = null;

/** Les @font-face de DM Sans en base64, depuis /fonts — une fois par session (un échec se retente). */
export function instructionFontCss(): Promise<string> {
  if (!dmSansCss) {
    dmSansCss = Promise.all(
      DM_SANS_WEIGHTS.map(async (w) => {
        const res = await fetch(`/fonts/dm-sans-latin-${w}-normal.woff`);
        if (!res.ok) throw new Error(`DM Sans ${w} : ${res.status}`);
        return `@font-face{font-family:"DM Sans";font-style:normal;font-weight:${w};src:url(data:font/woff;base64,${base64(await res.arrayBuffer())}) format("woff");}`;
      }),
    ).then((faces) => faces.join('\n'));
    dmSansCss.catch(() => {
      dmSansCss = null;
    });
  }
  return dmSansCss;
}

/** Au-delà, la capture part quand même : un QR qui ne charge pas ne bloque pas l'envoi. */
const IMAGE_WAIT_MS = 6_000;

/** Les images de la carte (le QR) chargées, pour que la capture ne parte pas avec un carré vide. */
async function imagesReady(node: HTMLElement): Promise<void> {
  const loads = Array.from(node.querySelectorAll('img')).map((img) =>
    img.complete
      ? undefined
      : typeof img.decode === 'function'
        ? img.decode().catch(() => undefined)
        : new Promise<void>((done) => {
            img.addEventListener('load', () => done(), { once: true });
            img.addEventListener('error', () => done(), { once: true });
          }),
  );
  await Promise.race([Promise.all(loads), new Promise((done) => setTimeout(done, IMAGE_WAIT_MS))]);
}

/**
 * La carte affichée à l'écran (montant, QR, bénéficiaire), capturée en PNG.
 * Sans la CSS locale (fichiers injoignables), la capture se fait avec les
 * polices du système plutôt que de partir chercher Google Fonts.
 */
export async function buildInstructionImageFile(node: HTMLElement, entry: PaymentInstructionEntry): Promise<File> {
  await document.fonts?.ready;
  await imagesReady(node);
  const fontEmbedCSS = await instructionFontCss().catch(() => null);
  const dataUrl = await captureNodePng(node, {
    pixelRatio: 2,
    backgroundColor: '#ffffff',
    // Safari / l'app sur iPhone perdent souvent images et polices à la première peinture.
    webkitWarmup: true,
    ...(fontEmbedCSS === null ? { embedFonts: false } : { fontEmbedCSS }),
  });
  const blob = await (await fetch(dataUrl)).blob();
  return new File([blob], paymentInstructionImageFilename(entry), { type: 'image/png' });
}

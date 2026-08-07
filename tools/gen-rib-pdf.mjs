// Génère docs/coordonnees-bancaires-bonzini.pdf — une fiche A4 paysage par banque,
// gros caractères, pour impression et consultation en agence.
//
// Source de vérité : src/data/depositMethodsData.ts (tableau `banks`). Le tableau est
// lu et évalué depuis le fichier TS pour éviter toute divergence de données.
// Les valeurs de CORRECTIONS ci-dessous sont les seules qui s'en écartent — elles
// corrigent des saisies dont l'invalidité est prouvée par le contrôle mod-97.
//
// Usage : node tools/gen-rib-pdf.mjs
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';

const CHROME_PATH = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium';
const OUT_PDF = 'docs/coordonnees-bancaires-bonzini.pdf';
const OUT_HTML = 'docs/coordonnees-bancaires-bonzini.html';

// ── Données ──────────────────────────────────────────────────────────────────

const src = readFileSync('src/data/depositMethodsData.ts', 'utf8');
const match = src.match(/export const banks: BankInfo\[\] = (\[[\s\S]*?\n\]);/);
if (!match) throw new Error('Tableau `banks` introuvable dans src/data/depositMethodsData.ts');
const banks = new Function(`return ${match[1]}`)();

// Corrections appliquées à l'impression (cf. contrôle mod-97 plus bas).
// UBA : l'IBAN stocké compte 28 caractères (max 27) — un « 1 » surnuméraire dans le
// numéro de compte. Le SWIFT stocké compte 7 caractères — un BIC en fait 8 ou 11.
const CORRECTIONS = {
  UBA: { iban: 'CM21 10033 05214 14011000141 88', swift: 'UNAFCMCX' },
};

// Mentions discrètes portées sur la fiche quand une donnée reste douteuse.
const NOTES = {
  CCA: 'IBAN à confirmer auprès de la banque',
};

// ── Contrôle mod-97 (norme ISO 13616) ────────────────────────────────────────

const mod97 = (s) => {
  let r = 0;
  for (const ch of s) {
    const v = /[0-9]/.test(ch) ? ch : (ch.charCodeAt(0) - 55).toString();
    for (const d of v) r = (r * 10 + Number(d)) % 97;
  }
  return r;
};
const ibanValid = (iban) => {
  const s = iban.replace(/\s/g, '').toUpperCase();
  return s.length === 27 && mod97(s.slice(4) + s.slice(0, 4)) === 1;
};

// ── Assets embarqués (le PDF doit être autonome) ─────────────────────────────

const dataUri = (path, mime) => `data:${mime};base64,${readFileSync(path).toString('base64')}`;
const font = (w) => dataUri(`public/fonts/dm-sans-latin-${w}-normal.woff`, 'font/woff');

const LOGO_BONZINI = dataUri('public/assets/bonzini-logo.jpg', 'image/jpeg');
const BANK_LOGOS = {
  ECOBANK: dataUri('public/treasury-dashboard/logos/ecobank.png', 'image/png'),
  CCA: dataUri('public/treasury-dashboard/logos/cca-bank.jpg', 'image/jpeg'),
  UBA: dataUri('public/treasury-dashboard/logos/uba.png', 'image/png'),
  AFRILAND: dataUri('public/treasury-dashboard/logos/afriland-icon.png', 'image/png'),
};

// ── Mise en forme ────────────────────────────────────────────────────────────

const VIOLET = 'hsl(258 100% 60%)';
const AMBER = 'hsl(36 100% 55%)';
const ORANGE = 'hsl(16 100% 55%)';

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

const dateFr = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

const rib = (a) => `${a.codeBanque} ${a.codeAgence} ${a.accountNumber} ${a.cleRib}`;

// ── Pages ────────────────────────────────────────────────────────────────────

function coverPage(rows) {
  const items = rows
    .map(
      (b, i) => `
      <li class="idx">
        <span class="idx-num">${i + 1}</span>
        <img class="idx-logo" src="${BANK_LOGOS[b.bank]}" alt="">
        <span class="idx-name">${esc(b.bonziniAccount.bankName)}</span>
        <span class="idx-acc">${esc(b.bonziniAccount.accountNumber)}</span>
      </li>`
    )
    .join('');

  return `
  <section class="page cover">
    <div class="rule3"></div>
    <div class="cover-body">
      <img class="cover-logo" src="${LOGO_BONZINI}" alt="Bonzini">
      <h1 class="cover-title">Coordonnées<br>bancaires</h1>
      <p class="cover-sub">Comptes de dépôt · <b>NORTON GAUSS BONZINI SARL</b></p>
      <ol class="idx-list">${items}</ol>
    </div>
    <footer class="cover-foot">
      <span>Document interne · à jour au ${dateFr}</span>
      <span class="foot-mark">BONZINI</span>
    </footer>
  </section>`;
}

function bankPage(b, i, total) {
  const a = { ...b.bonziniAccount, ...(CORRECTIONS[b.bank] ?? {}) };
  const note = NOTES[b.bank];
  const ibanBadge = note ? `<span class="badge">${esc(note)}</span>` : '';

  return `
  <section class="page">
    <div class="rule3"></div>
    <header class="hd">
      <div class="hd-left">
        <img class="hd-logo" src="${LOGO_BONZINI}" alt="Bonzini">
        <span class="hd-kicker">Compte de dépôt Bonzini</span>
      </div>
      <span class="hd-page">${i + 1} / ${total}</span>
    </header>

    <div class="title-row">
      <img class="bank-logo" src="${BANK_LOGOS[b.bank]}" alt="">
      <h2 class="bank-name">${esc(b.bonziniAccount.bankName)}</h2>
    </div>

    <div class="holder">
      <span class="lbl">Titulaire du compte</span>
      <span class="holder-val">${esc(a.accountName)}</span>
    </div>

    <div class="hero">
      <div class="hero-head"><span class="lbl">IBAN</span>${ibanBadge}</div>
      <span class="hero-val">${esc(a.iban)}</span>
    </div>

    <div class="duo">
      <div class="cell">
        <span class="lbl">RIB complet</span>
        <span class="cell-val">${esc(rib(a))}</span>
      </div>
      <div class="cell cell-swift">
        <span class="lbl">Code SWIFT / BIC</span>
        <span class="cell-val">${esc(a.swift)}</span>
      </div>
    </div>

    <div class="quad">
      <div class="q"><span class="lbl">Code banque</span><span class="q-val">${esc(a.codeBanque)}</span></div>
      <div class="q"><span class="lbl">Code agence</span><span class="q-val">${esc(a.codeAgence)}</span></div>
      <div class="q q-wide"><span class="lbl">Numéro de compte</span><span class="q-val">${esc(a.accountNumber)}</span></div>
      <div class="q"><span class="lbl">Clé RIB</span><span class="q-val">${esc(a.cleRib)}</span></div>
    </div>

    <footer class="ft">
      <span class="ft-note">Indiquez toujours la <b>référence du dépôt</b> (BZ-DP-…) en libellé du versement.</span>
      <span class="ft-cur">Devise du compte&nbsp;: <b>XAF</b></span>
    </footer>
  </section>`;
}

// ── Document ─────────────────────────────────────────────────────────────────

const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<title>Coordonnées bancaires — Bonzini</title>
<style>
  @font-face { font-family: 'DM Sans'; src: url('${font(400)}') format('woff'); font-weight: 400; }
  @font-face { font-family: 'DM Sans'; src: url('${font(500)}') format('woff'); font-weight: 500; }
  @font-face { font-family: 'DM Sans'; src: url('${font(700)}') format('woff'); font-weight: 700; }
  @font-face { font-family: 'DM Sans'; src: url('${font(900)}') format('woff'); font-weight: 900; }

  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --violet: ${VIOLET};
    --amber: ${AMBER};
    --orange: ${ORANGE};
    --ink: #0F1020;
    --muted: #55566E;
    --line: #DFE0EC;
    --tint: #F4F2FF;
  }

  body {
    font-family: 'DM Sans', system-ui, sans-serif;
    color: var(--ink);
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page {
    position: relative;
    width: 297mm; height: 210mm;
    padding: 15mm 16mm 12mm;
    display: flex; flex-direction: column;
    page-break-after: always;
    overflow: hidden;
  }
  .page:last-child { page-break-after: auto; }

  /* Filet 3 couleurs du logo — présent sur chaque page */
  .rule3 {
    position: absolute; top: 0; left: 0; right: 0; height: 6mm;
    background: linear-gradient(90deg,
      var(--violet) 0 33.34%, var(--amber) 33.34% 66.67%, var(--orange) 66.67% 100%);
  }

  .lbl {
    display: block;
    font-size: 13pt; font-weight: 700; letter-spacing: .13em;
    text-transform: uppercase; color: var(--muted);
  }

  /* ── En-tête ── */
  .hd { display: flex; align-items: center; justify-content: space-between; }
  .hd-left { display: flex; align-items: center; gap: 5mm; }
  .hd-logo { height: 13mm; border-radius: 2.5mm; }
  .hd-kicker { font-size: 14pt; font-weight: 700; color: var(--muted); letter-spacing: .04em; }
  .hd-page { font-size: 15pt; font-weight: 900; color: var(--violet); }

  /* ── Titre banque ── */
  .title-row { display: flex; align-items: center; gap: 6mm; margin-top: 5mm; }
  .bank-logo { height: 20mm; width: 20mm; object-fit: contain; border-radius: 3mm; }
  .bank-name { font-size: 40pt; font-weight: 900; line-height: 1.02; letter-spacing: -.02em; }

  /* ── Titulaire ── */
  .holder { margin-top: 6mm; padding-left: 5mm; border-left: 2.2mm solid var(--amber); }
  .holder-val { display: block; margin-top: 1.5mm; font-size: 27pt; font-weight: 900; letter-spacing: -.01em; }

  /* ── IBAN (donnée maîtresse) ── */
  .hero {
    margin-top: 6mm; padding: 6mm 7mm;
    background: var(--tint); border-radius: 4mm;
    border-left: 2.2mm solid var(--violet);
  }
  .hero-head { display: flex; align-items: baseline; gap: 4mm; }
  .hero-val {
    display: block; margin-top: 2mm;
    font-size: 33pt; font-weight: 900; letter-spacing: .01em;
    font-variant-numeric: tabular-nums; white-space: nowrap;
  }
  .badge {
    font-size: 11pt; font-weight: 700; color: #8A4B00;
    background: hsl(36 100% 88%); border-radius: 999px; padding: 1mm 3mm;
  }

  /* ── RIB + SWIFT ── */
  .duo { display: flex; gap: 6mm; margin-top: 5mm; }
  .cell { flex: 1 1 auto; padding: 5mm 6mm; border: .6mm solid var(--line); border-radius: 4mm; }
  .cell-swift { flex: 0 0 78mm; }
  .cell-val {
    display: block; margin-top: 2mm;
    font-size: 25pt; font-weight: 900; letter-spacing: .02em;
    font-variant-numeric: tabular-nums; white-space: nowrap;
  }

  /* ── Décomposition du RIB ── */
  .quad { display: flex; gap: 5mm; margin-top: 5mm; }
  .q { flex: 1 1 0; padding: 4mm 5mm; background: #F7F7FB; border-radius: 3.5mm; }
  .q-wide { flex: 1.7 1 0; }
  .q-val {
    display: block; margin-top: 1.5mm;
    font-size: 23pt; font-weight: 900; letter-spacing: .03em;
    font-variant-numeric: tabular-nums; white-space: nowrap;
  }

  /* ── Pied ── */
  .ft {
    margin-top: auto; padding-top: 4mm; border-top: .6mm solid var(--line);
    display: flex; align-items: baseline; justify-content: space-between; gap: 8mm;
  }
  .ft-note { font-size: 13.5pt; color: var(--muted); }
  .ft-note b { color: var(--ink); }
  .ft-cur { font-size: 13.5pt; color: var(--muted); white-space: nowrap; }
  .ft-cur b { color: var(--ink); font-weight: 900; }

  /* ── Couverture ── */
  .cover-body { margin-top: 4mm; display: flex; flex-direction: column; }
  .cover-logo { height: 22mm; width: fit-content; border-radius: 3mm; }
  .cover-title { margin-top: 7mm; font-size: 52pt; font-weight: 900; line-height: .98; letter-spacing: -.03em; }
  .cover-sub { margin-top: 4mm; font-size: 18pt; color: var(--muted); }
  .cover-sub b { color: var(--ink); font-weight: 900; }

  .idx-list { list-style: none; margin-top: 8mm; display: flex; flex-direction: column; gap: 3mm; }
  .idx {
    display: flex; align-items: center; gap: 5mm;
    padding: 3.5mm 5mm; border: .6mm solid var(--line); border-radius: 3.5mm;
  }
  .idx-num {
    flex: 0 0 auto; width: 9mm; height: 9mm; border-radius: 999px;
    background: var(--violet); color: #fff;
    font-size: 14pt; font-weight: 900;
    display: flex; align-items: center; justify-content: center;
  }
  .idx-logo { height: 10mm; width: 10mm; object-fit: contain; border-radius: 2mm; }
  .idx-name { flex: 1 1 auto; font-size: 20pt; font-weight: 900; }
  .idx-acc { font-size: 18pt; font-weight: 700; color: var(--muted); font-variant-numeric: tabular-nums; }

  .cover-foot {
    margin-top: auto; padding-top: 4mm; border-top: .6mm solid var(--line);
    display: flex; justify-content: space-between; align-items: baseline;
    font-size: 13pt; color: var(--muted);
  }
  .foot-mark { font-weight: 900; letter-spacing: .18em; color: var(--violet); }
</style></head>
<body>
${coverPage(banks)}
${banks.map((b, i) => bankPage(b, i, banks.length)).join('\n')}
</body></html>`;

// ── Rendu ────────────────────────────────────────────────────────────────────

mkdirSync('docs', { recursive: true });
writeFileSync(OUT_HTML, html);

// Le conteneur fournit un Chromium préinstallé qui peut différer du build attendu
// par la version de Playwright du projet — on pointe dessus quand il est présent.
const browser = await chromium.launch({
  executablePath: existsSync(CHROME_PATH) ? CHROME_PATH : undefined,
});
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);

// Garde-fou : aucune valeur ne doit déborder de sa boîte (illisible à l'impression).
const overflow = await page.evaluate(() =>
  [...document.querySelectorAll('.hero-val, .cell-val, .q-val, .holder-val, .bank-name, .idx-name')]
    .filter((el) => el.scrollWidth > el.clientWidth + 1)
    .map((el) => `${el.className}: ${el.textContent.trim()}`)
);

await page.pdf({ path: OUT_PDF, width: '297mm', height: '210mm', printBackground: true });
await browser.close();

for (const b of banks) {
  const a = { ...b.bonziniAccount, ...(CORRECTIONS[b.bank] ?? {}) };
  const ok = ibanValid(a.iban);
  console.log(`${ok ? '✓' : '✗'} ${b.bank.padEnd(9)} IBAN ${ok ? 'valide' : 'INVALIDE (mod-97)'}`);
}
if (overflow.length) {
  console.error('\n⚠ Débordement de texte :\n' + overflow.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`\n→ ${OUT_PDF}`);
}

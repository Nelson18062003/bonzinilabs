import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

// ── Page Constants ─────────────────────────────────────
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;

// ── Colors ─────────────────────────────────────────────
const BG_COLOR = '#0F1117';
const CARD_BG = '#1A1D27';
const CARD_BG_ZERO = '#13151E';
const CARD_BORDER = '#2A2D37';
const TEXT_WHITE = '#FFFFFF';
const TEXT_MUTED = '#8892A8';
const TEXT_DIMMED = '#4A5068';
const TEXT_VERY_DIM = '#3A3F50';
const GRADIENT_START = '#7C3AED';
const GRADIENT_END = '#3B82F6';
const GREEN_ACCENT = '#10B981';

// ── Layout ─────────────────────────────────────────────
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const CARD_GAP = 16;
const CARD_WIDTH = (CONTENT_WIDTH - CARD_GAP) / 2;
const CARD_HEIGHT = 140;
const CARD_RADIUS = 12;

// ── Font paths ────────────────────────────────────────
const FONTS_DIR = path.join(process.cwd(), 'assets', 'fonts');
const FONT_REGULAR = path.join(FONTS_DIR, 'LibreBaskerville-Regular.ttf');
const FONT_BOLD = path.join(FONTS_DIR, 'LibreBaskerville-Bold.ttf');

// ── Logo paths ─────────────────────────────────────────
const LOGOS_DIR = path.join(process.cwd(), 'assets', 'logos');

// ── Account Data ───────────────────────────────────────
const accounts = [
  { name: 'MTN MoMo', type: 'Mobile Money', balance: 5058801, color: '#FFCC00', logo: path.join(LOGOS_DIR, 'mtn.png') },
  { name: 'Orange Money', type: 'Mobile Money', balance: 8500000, color: '#FF6600', logo: path.join(LOGOS_DIR, 'orange-money.png') },
  { name: 'UBA Cameroon', type: 'Bank', balance: 3795000, color: '#E31837', logo: path.join(LOGOS_DIR, 'uba.png') },
  { name: 'Afriland First Bank', type: 'Bank', balance: 40000000, color: '#8B0000', logo: path.join(LOGOS_DIR, 'afriland-icon.png') },
  { name: 'Ecobank Cameroon', type: 'Bank', balance: 0, color: '#0066B3', logo: path.join(LOGOS_DIR, 'ecobank.png') },
  { name: 'CCA-Bank', type: 'Bank', balance: 0, color: '#6A0DAD', logo: path.join(LOGOS_DIR, 'cca-bank.jpg') },
];

const TOTAL = accounts.reduce((s, a) => s + a.balance, 0);

// ── Color Utilities ────────────────────────────────────
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}

function lerpColor(c1, c2, t) {
  const [r1, g1, b1] = hexToRgb(c1);
  const [r2, g2, b2] = hexToRgb(c2);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

function formatXAF(n) {
  if (n === 0) return '0';
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

// ── Drawing Helpers ────────────────────────────────────
function drawGradientLine(doc, x, y, width, height, c1, c2) {
  const steps = 80;
  const sw = width / steps;
  for (let i = 0; i < steps; i++) {
    doc.rect(x + i * sw, y, sw + 0.5, height).fill(lerpColor(c1, c2, i / steps));
  }
}

function drawRoundedRect(doc, x, y, w, h, r) {
  doc.moveTo(x + r, y)
    .lineTo(x + w - r, y)
    .quadraticCurveTo(x + w, y, x + w, y + r)
    .lineTo(x + w, y + h - r)
    .quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    .lineTo(x + r, y + h)
    .quadraticCurveTo(x, y + h, x, y + h - r)
    .lineTo(x, y + r)
    .quadraticCurveTo(x, y, x + r, y)
    .closePath();
}

function fillRoundedRect(doc, x, y, w, h, r, color) {
  doc.save();
  drawRoundedRect(doc, x, y, w, h, r);
  doc.fill(color);
  doc.restore();
}

function strokeRoundedRect(doc, x, y, w, h, r, color, lineWidth) {
  doc.save();
  drawRoundedRect(doc, x, y, w, h, r);
  doc.lineWidth(lineWidth).strokeColor(color).stroke();
  doc.restore();
}

// ── Section Drawers ────────────────────────────────────

function drawBackground(doc) {
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT).fill(BG_COLOR);
}

function drawHeader(doc) {
  // Title
  doc.font('Baskerville-Bold').fontSize(28).fillColor(TEXT_WHITE);
  doc.text('MY ACCOUNT BALANCES', MARGIN, 40, { width: CONTENT_WIDTH, align: 'center' });

  // Date
  const dateStr = 'As of May 19, 2026';
  doc.font('Baskerville').fontSize(13).fillColor(TEXT_MUTED);
  doc.text(dateStr, MARGIN, 76, { width: CONTENT_WIDTH, align: 'center' });

  // Gradient separator
  drawGradientLine(doc, MARGIN, 100, CONTENT_WIDTH, 2, GRADIENT_START, GRADIENT_END);
}

function drawAccountCard(doc, account, x, y) {
  const isZero = account.balance === 0;

  // Card background
  fillRoundedRect(doc, x, y, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS, isZero ? CARD_BG_ZERO : CARD_BG);
  strokeRoundedRect(doc, x, y, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS, CARD_BORDER, 0.5);

  // Left accent bar
  const accentColor = isZero ? lerpColor(account.color, '#000000', 0.5) : account.color;
  fillRoundedRect(doc, x + 8, y + 14, 3, CARD_HEIGHT - 28, 1.5, accentColor);

  // Logo image (fit into a 36x36 area, properly centered in circle)
  const logoSize = 36;
  const circleCx = x + 40;
  const circleCy = y + 28 + logoSize / 2;
  const circleR = logoSize / 2 + 3;

  try {
    if (fs.existsSync(account.logo)) {
      // White circle background for logo
      doc.circle(circleCx, circleCy, circleR).fill('#FFFFFF');

      // Clip to circle and draw logo centered
      doc.save();
      doc.circle(circleCx, circleCy, circleR - 1).clip();
      doc.image(account.logo, circleCx - logoSize / 2, circleCy - logoSize / 2, {
        fit: [logoSize, logoSize],
        align: 'center',
        valign: 'center',
      });
      doc.restore();
    }
  } catch {
    // Fallback: draw colored circle with initial
    const circleBg = isZero ? lerpColor(account.color, '#000000', 0.4) : account.color;
    doc.circle(circleCx, circleCy, circleR).fill(circleBg);
    doc.font('Baskerville-Bold').fontSize(18).fillColor('#FFFFFF');
    const initial = account.name.charAt(0);
    const lw = doc.widthOfString(initial);
    doc.text(initial, circleCx - lw / 2, circleCy - 7, { lineBreak: false });
  }

  // Account name
  const textLeft = x + 68;
  doc.font('Baskerville-Bold').fontSize(14).fillColor(isZero ? TEXT_DIMMED : TEXT_WHITE);
  doc.text(account.name, textLeft, y + 22, { width: CARD_WIDTH - 80, lineBreak: false });

  // Type badge
  const isMobile = account.type === 'Mobile Money';
  const badgeBg = isMobile ? '#1E3A2F' : '#1E2A3A';
  const badgeTextColor = isMobile ? '#4ADE80' : '#60A5FA';
  const badgeLabel = isMobile ? 'Mobile Money' : 'Bank';

  doc.font('Baskerville').fontSize(9);
  const btw = doc.widthOfString(badgeLabel);
  const bw = btw + 24;
  const bh = 18;
  const bx = textLeft;
  const by = y + 44;
  fillRoundedRect(doc, bx, by, bw, bh, 4, badgeBg);
  // Small dot indicator
  doc.circle(bx + 8, by + 9, 2.5).fill(badgeTextColor);
  doc.font('Baskerville').fontSize(9).fillColor(badgeTextColor);
  doc.text(badgeLabel, bx + 15, by + 4, { lineBreak: false });

  // Balance (bigger font)
  const balStr = formatXAF(account.balance);
  const balY = y + CARD_HEIGHT - 38;
  doc.font('Baskerville-Bold').fontSize(22).fillColor(isZero ? TEXT_DIMMED : TEXT_WHITE);
  doc.text(balStr, x + 20, balY, { lineBreak: false, continued: false });

  // "XAF" suffix
  doc.font('Baskerville-Bold').fontSize(22);
  const balWidth = doc.widthOfString(balStr);
  doc.font('Baskerville').fontSize(13).fillColor(isZero ? TEXT_VERY_DIM : TEXT_MUTED);
  doc.text(' XAF', x + 20 + balWidth + 4, balY + 4, { lineBreak: false });
}

function drawTotalSection(doc, startY) {
  // Gradient separator
  drawGradientLine(doc, MARGIN, startY, CONTENT_WIDTH, 2, GRADIENT_START, GRADIENT_END);

  // Total card background
  const cardY = startY + 20;
  const cardH = 110;
  fillRoundedRect(doc, MARGIN, cardY, CONTENT_WIDTH, cardH, CARD_RADIUS, '#111827');
  strokeRoundedRect(doc, MARGIN, cardY, CONTENT_WIDTH, cardH, CARD_RADIUS, '#1F2937', 1);

  // Inner glow effect (subtle green-tinted top border)
  fillRoundedRect(doc, MARGIN + 1, cardY + 1, CONTENT_WIDTH - 2, 3, CARD_RADIUS, lerpColor(GREEN_ACCENT, '#111827', 0.7));

  // "TOTAL BALANCE" label
  doc.font('Baskerville').fontSize(13).fillColor(TEXT_MUTED);
  doc.text('TOTAL BALANCE', MARGIN, cardY + 20, { width: CONTENT_WIDTH, align: 'center' });

  // Total amount + XAF on the same line, centered
  const totalStr = formatXAF(TOTAL);
  doc.font('Baskerville-Bold').fontSize(38);
  const totalWidth = doc.widthOfString(totalStr);
  doc.font('Baskerville-Bold').fontSize(20);
  const xafWidth = doc.widthOfString(' XAF');
  const fullWidth = totalWidth + xafWidth + 6;
  const startX = (PAGE_WIDTH - fullWidth) / 2;

  // Draw total amount
  doc.font('Baskerville-Bold').fontSize(38).fillColor(TEXT_WHITE);
  doc.text(totalStr, startX, cardY + 46, { lineBreak: false });

  // Draw XAF next to the amount
  doc.font('Baskerville-Bold').fontSize(20).fillColor(GREEN_ACCENT);
  doc.text(' XAF', startX + totalWidth + 6, cardY + 58, { lineBreak: false });

  // Green underline accent
  const ulW = 90;
  const ulX = (PAGE_WIDTH - ulW) / 2;
  fillRoundedRect(doc, ulX, cardY + cardH - 10, ulW, 3, 1.5, GREEN_ACCENT);
}

function drawFooter(doc) {
  doc.font('Baskerville').fontSize(8).fillColor(TEXT_VERY_DIM);
  doc.text('Automatically generated document  —  ethy-keeper  —  19/05/2026', MARGIN, PAGE_HEIGHT - 30, {
    width: CONTENT_WIDTH,
    align: 'center',
  });
}

// ── Main ───────────────────────────────────────────────
function generatePDF() {
  const outputDir = path.join(process.cwd(), 'output');
  fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, 'dashboard-soldes.pdf');

  const doc = new PDFDocument({
    size: 'A4',
    margin: 0,
    info: {
      Title: 'My Account Balances',
      Author: 'ethy-keeper',
      Subject: 'Bank Account Balance Dashboard',
      CreationDate: new Date(),
    },
  });

  // Register custom fonts
  doc.registerFont('Baskerville', FONT_REGULAR);
  doc.registerFont('Baskerville-Bold', FONT_BOLD);

  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  // 1. Background
  drawBackground(doc);

  // 2. Header
  drawHeader(doc);

  // 3. Account cards (2 columns, 3 rows)
  const gridStartY = 116;
  for (let i = 0; i < accounts.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = MARGIN + col * (CARD_WIDTH + CARD_GAP);
    const cy = gridStartY + row * (CARD_HEIGHT + CARD_GAP);
    drawAccountCard(doc, accounts[i], cx, cy);
  }

  // 4. Total section
  const lastCardBottom = gridStartY + 2 * (CARD_HEIGHT + CARD_GAP) + CARD_HEIGHT;
  const totalSectionY = lastCardBottom + 30;
  drawTotalSection(doc, totalSectionY);

  // 5. Footer
  drawFooter(doc);

  doc.end();

  stream.on('finish', () => {
    console.log(`✅ PDF generated successfully: ${outputPath}`);
  });
}

generatePDF();

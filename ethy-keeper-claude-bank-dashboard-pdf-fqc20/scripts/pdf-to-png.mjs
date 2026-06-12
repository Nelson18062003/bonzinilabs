import { pdfToPng } from 'pdf-to-png-converter';
import fs from 'fs';
import path from 'path';

const PDF_PATH = path.join(process.cwd(), 'output', 'dashboard-soldes.pdf');
const OUTPUT_DIR = path.join(process.cwd(), 'output');

const pages = await pdfToPng(PDF_PATH, {
  disableFontFace: true,
  useSystemFonts: false,
  viewportScale: 3,
  pages: [1],
});

const outputPath = path.join(OUTPUT_DIR, 'dashboard-soldes.png');
fs.writeFileSync(outputPath, pages[0].content);
console.log(`✅ PNG generated successfully: ${outputPath}`);

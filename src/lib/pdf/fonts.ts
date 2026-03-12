import { Font } from '@react-pdf/renderer';

// Noto Sans SC — support des caractères chinois (CJK)
Font.register({
  family: 'Noto Sans SC',
  fonts: [
    {
      src: '/fonts/noto-sans-sc-chinese-simplified-400-normal.woff',
      fontWeight: 400,
    },
  ],
});

// DM Sans — police principale de la charte Bonzini
// Fichiers WOFF locaux servis depuis /public/fonts/ (fiable en génération PDF navigateur)
Font.register({
  family: 'DM Sans',
  fonts: [
    {
      src: '/fonts/dm-sans-latin-400-normal.woff',
      fontWeight: 400,
    },
    {
      src: '/fonts/dm-sans-latin-500-normal.woff',
      fontWeight: 500,
    },
    {
      src: '/fonts/dm-sans-latin-600-normal.woff',
      fontWeight: 600,
    },
    {
      src: '/fonts/dm-sans-latin-700-normal.woff',
      fontWeight: 700,
    },
    {
      src: '/fonts/dm-sans-latin-800-normal.woff',
      fontWeight: 800,
    },
    {
      src: '/fonts/dm-sans-latin-900-normal.woff',
      fontWeight: 900,
    },
  ],
});

import { Font } from '@react-pdf/renderer';

// DM Sans — police principale de la charte Bonzini
// Fichiers TTF depuis Google Fonts (meilleure compatibilité avec @react-pdf)
Font.register({
  family: 'DM Sans',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/dmsans/v15/rP2Hp2ywxg089UriCZa4ET-DNl0.woff2',
      fontWeight: 400,
    },
    {
      src: 'https://fonts.gstatic.com/s/dmsans/v15/rP2Hp2ywxg089UriI3q4ET-DNl0.woff2',
      fontWeight: 500,
    },
    {
      src: 'https://fonts.gstatic.com/s/dmsans/v15/rP2Hp2ywxg089UriCZOoET-DNl0.woff2',
      fontWeight: 600,
    },
    {
      src: 'https://fonts.gstatic.com/s/dmsans/v15/rP2Hp2ywxg089UriCZa4Ex-DNl0.woff2',
      fontWeight: 700,
    },
    {
      src: 'https://fonts.gstatic.com/s/dmsans/v15/rP2Hp2ywxg089UriCZDvET-DNl0.woff2',
      fontWeight: 800,
    },
    {
      src: 'https://fonts.gstatic.com/s/dmsans/v15/rP2Hp2ywxg089UriCZD_Ex-DNl0.woff2',
      fontWeight: 900,
    },
  ],
});

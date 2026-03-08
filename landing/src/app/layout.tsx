import type { Metadata } from "next";
import { Syne, DM_Sans } from "next/font/google";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Bonzini — Payez vos fournisseurs chinois en francs CFA",
  description:
    "Alipay, WeChat Pay, virement bancaire ou cash. Paiement instantané vers la Chine pour les importateurs de la zone CEMAC. Cameroun, Gabon, Tchad, RCA, Congo.",
  keywords: [
    "paiement Chine",
    "fournisseur chinois",
    "XAF",
    "franc CFA",
    "Alipay",
    "WeChat Pay",
    "CEMAC",
    "Cameroun",
    "importateur",
    "transfert argent Chine",
  ],
  authors: [{ name: "Bonzini" }],
  creator: "Bonzini",
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "https://www.bonzinilabs.com",
    siteName: "Bonzini",
    title: "Bonzini — Payez vos fournisseurs chinois en francs CFA",
    description:
      "Paiement instantané vers la Chine. Alipay, WeChat, virement ou cash. Au meilleur taux, avec preuve de paiement.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Bonzini — Paiements vers la Chine",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Bonzini — Payez vos fournisseurs chinois en francs CFA",
    description:
      "Paiement instantané vers la Chine pour les importateurs CEMAC.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://www.bonzinilabs.com",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${syne.variable} ${dmSans.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FinancialService",
              name: "Bonzini",
              description:
                "Service de paiement vers la Chine pour les importateurs de la zone CEMAC",
              url: "https://www.bonzinilabs.com",
              areaServed: [
                "Cameroun",
                "Gabon",
                "Tchad",
                "République centrafricaine",
                "Congo",
              ],
              serviceType: "Transfert de fonds internationaux",
            }),
          }}
        />
      </head>
      <body className="font-body bg-brand-violet-deep text-white overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}

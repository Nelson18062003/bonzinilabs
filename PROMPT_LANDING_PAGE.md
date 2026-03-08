# PROMPT CLAUDE CODE — Implémentation de la nouvelle Landing Page Bonzini

> **Lis ce prompt EN ENTIER avant de toucher au code. La maquette de référence est dans `maquette_landing_page_v3.jsx` à la racine du repo.**

---

## Objectif

Supprimer l'ancienne landing page et la remplacer par une nouvelle landing page basée sur la maquette fournie. La nouvelle landing page doit être :
- Construite avec **Next.js** (SSR/SSG pour le SEO)
- Stylée avec **Tailwind CSS**
- Animée avec **Framer Motion**
- Responsive mobile-first
- Optimisée SEO (meta tags, Open Graph, structured data, SSR)

---

## ÉTAPE 0 — ANALYSER L'EXISTANT

### 0.1 Identifier la landing page actuelle

```bash
# Trouver les fichiers de la landing page
find src/ -name "*landing*" -o -name "*home*" -o -name "*Home*" -o -name "*Landing*" | grep -v node_modules

# Trouver le point d'entrée
grep -rn "route.*['\"/]\"\\|path.*['\"/]\"" src/ --include="*.tsx" --include="*.ts" | head -20

# Trouver la page d'accueil dans le router
grep -rn "index\|home\|landing\|LandingPage\|HomePage" src/ --include="*.tsx" --include="*.ts" -l

# Voir la structure actuelle
ls -la src/pages/ 2>/dev/null || ls -la src/app/ 2>/dev/null || ls -la src/routes/ 2>/dev/null
```

### 0.2 Comprendre l'architecture du projet

```bash
# Vérifier si Next.js est déjà installé
grep -n "next" package.json

# Vérifier le framework actuel
grep -n "vite\|react-router\|next\|remix\|gatsby" package.json

# Structure des fichiers
ls -la src/
```

**IMPORTANT :** Le projet utilise actuellement Vite + React. La landing page doit être migrée vers Next.js pour le SEO. Deux approches possibles :

**Approche A** — Si la landing page peut être un projet SÉPARÉ :
- Créer un nouveau dossier `landing/` avec un projet Next.js dédié
- La landing page sera déployée sur `bonzinilabs.com`
- Les apps admin et client restent sur leurs sous-domaines ou routes

**Approche B** — Si tout doit rester dans le même repo :
- Installer Next.js dans le projet existant
- Migrer uniquement la page d'accueil vers le SSR de Next.js
- Les routes `/a/` et `/m/` restent en React SPA

**Choisis l'approche A** (projet séparé) car c'est plus propre et ne risque pas de casser les apps existantes.

---

## ÉTAPE 1 — CRÉER LE PROJET NEXT.JS

### 1.1 Initialiser le projet

```bash
# À la racine du repo
mkdir landing
cd landing

# Créer le projet Next.js
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

# Installer Framer Motion
npm install framer-motion

# Installer les fonts Google (Next.js a un système intégré)
# Pas besoin d'installer de package, on utilise next/font
```

### 1.2 Structure du projet

```
landing/
├── src/
│   ├── app/
│   │   ├── layout.tsx          ← Layout principal (fonts, meta)
│   │   ├── page.tsx            ← Page d'accueil (la landing page)
│   │   ├── favicon.ico
│   │   └── globals.css         ← Styles Tailwind
│   ├── components/
│   │   ├── BonziniLogo.tsx     ← Logo SVG (NE PAS MODIFIER les paths)
│   │   ├── Nav.tsx             ← Navbar sticky
│   │   ├── Hero.tsx            ← Hero avec simulateur
│   │   ├── Ticker.tsx          ← Bandeau défilant
│   │   ├── Stats.tsx           ← Compteurs animés
│   │   ├── HowItWorks.tsx      ← 4 étapes
│   │   ├── Methods.tsx         ← 4 modes de paiement
│   │   ├── FAQ.tsx             ← Accordion
│   │   ├── CTA.tsx             ← Call-to-action final
│   │   ├── Footer.tsx          ← Footer
│   │   ├── Reveal.tsx          ← Composant d'animation au scroll
│   │   └── PaymentSimulator.tsx ← Simulateur interactif du hero
│   └── lib/
│       ├── constants.ts        ← Couleurs, textes, données
│       └── rates.ts            ← Connexion aux taux Supabase
├── public/
│   └── bonzini-logo.svg        ← Logo SVG original
├── tailwind.config.ts
├── next.config.js
└── package.json
```

---

## ÉTAPE 2 — CONFIGURATION

### 2.1 Tailwind config

```typescript
// landing/tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          violet: "#a64af7",
          "violet-glow": "#c084fc",
          "violet-dark": "#1a1028",
          "violet-deep": "#050208",
          gold: "#f3a745",
          orange: "#fe560d",
          surface: "#0f0b18",
          "surface-light": "#1a1428",
          dim: "#3d3555",
        },
        method: {
          alipay: "#1677ff",
          wechat: "#07c160",
        },
      },
      fontFamily: {
        display: ['"Syne"', 'sans-serif'],
        body: ['"DM Sans"', 'sans-serif'],
      },
      animation: {
        "spin-slow": "spin 20s linear infinite",
        "pulse-glow": "pulse-glow 6s ease-in-out infinite",
        ticker: "ticker 30s linear infinite",
        float: "float 8s ease-in-out infinite",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { opacity: "0.12", transform: "scale(1)" },
          "50%": { opacity: "0.2", transform: "scale(1.1)" },
        },
        ticker: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-33.33%)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-30px)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
```

### 2.2 Layout avec fonts et SEO

```typescript
// landing/src/app/layout.tsx
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
  description: "Alipay, WeChat Pay, virement bancaire ou cash. Paiement instantané vers la Chine pour les importateurs de la zone CEMAC. Cameroun, Gabon, Tchad, RCA, Congo.",
  keywords: ["paiement Chine", "fournisseur chinois", "XAF", "franc CFA", "Alipay", "WeChat Pay", "CEMAC", "Cameroun", "importateur", "transfert argent Chine"],
  authors: [{ name: "Bonzini" }],
  creator: "Bonzini",
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "https://www.bonzinilabs.com",
    siteName: "Bonzini",
    title: "Bonzini — Payez vos fournisseurs chinois en francs CFA",
    description: "Paiement instantané vers la Chine. Alipay, WeChat, virement ou cash. Au meilleur taux, avec preuve de paiement.",
    images: [
      {
        url: "/og-image.png",    // À CRÉER : image 1200x630px
        width: 1200,
        height: 630,
        alt: "Bonzini — Paiements vers la Chine",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Bonzini — Payez vos fournisseurs chinois en francs CFA",
    description: "Paiement instantané vers la Chine pour les importateurs CEMAC.",
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
        {/* Structured Data — Organisation */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FinancialService",
              name: "Bonzini",
              description: "Service de paiement vers la Chine pour les importateurs de la zone CEMAC",
              url: "https://www.bonzinilabs.com",
              areaServed: ["Cameroun", "Gabon", "Tchad", "République centrafricaine", "Congo"],
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
```

### 2.3 Globals CSS

```css
/* landing/src/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

html {
  scroll-behavior: smooth;
}

body {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Noise texture pour le hero */
.noise-overlay {
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  opacity: 0.03;
}
```

---

## ÉTAPE 3 — COMPOSANTS

### 3.1 Principes de conversion maquette > Next.js

La maquette `maquette_landing_page_v3.jsx` utilise des inline styles. Tu dois les convertir en classes Tailwind. Voici la correspondance :

```
Inline style                          →  Tailwind class
─────────────────────────────────────────────────────
fontFamily: F.display                 →  font-display
fontFamily: F.body                    →  font-body
fontSize: 72px                        →  text-7xl (ou text-[72px])
fontWeight: 900                       →  font-black
fontWeight: 800                       →  font-extrabold
fontWeight: 700                       →  font-bold
letterSpacing: "-3px"                 →  tracking-[-3px]
lineHeight: 0.98                      →  leading-none
color: "#fff"                         →  text-white
color: C.muted (#8b82a0)             →  text-brand-dim (ou text-[#8b82a0])
background: C.violet                  →  bg-brand-violet
borderRadius: 50                      →  rounded-full
borderRadius: 20                      →  rounded-2xl
padding: "18px 36px"                  →  px-9 py-[18px]
maxWidth: 1200                        →  max-w-7xl
margin: "0 auto"                      →  mx-auto
gap: 16                               →  gap-4
```

### 3.2 Animations avec Framer Motion

Remplace le composant `Reveal` de la maquette par Framer Motion :

```typescript
// landing/src/components/Reveal.tsx
"use client";
import { motion } from "framer-motion";

interface RevealProps {
  children: React.ReactNode;
  delay?: number;
  direction?: "up" | "down" | "left" | "right";
}

export function Reveal({ children, delay = 0, direction = "up" }: RevealProps) {
  const offsets = {
    up: { y: 50, x: 0 },
    down: { y: -50, x: 0 },
    left: { y: 0, x: 50 },
    right: { y: 0, x: -50 },
  };

  return (
    <motion.div
      initial={{ opacity: 0, ...offsets[direction] }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{
        duration: 0.8,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
```

Remplace le composant `Counter` (compteurs animés dans Stats) par :

```typescript
// Utiliser framer-motion pour les compteurs
"use client";
import { useInView, useMotionValue, useTransform, animate } from "framer-motion";
import { useRef, useEffect, useState } from "react";

export function Counter({ end, suffix = "", prefix = "" }: { end: number; suffix?: string; prefix?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const controls = animate(0, end, {
      duration: 2,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(Math.floor(v)),
    });
    return controls.stop;
  }, [isInView, end]);

  return <span ref={ref}>{prefix}{display}{suffix}</span>;
}
```

### 3.3 Le logo SVG

```typescript
// landing/src/components/BonziniLogo.tsx
// COPIE les 4 paths EXACTS depuis le fichier bonzini_logo.svg du repo
// NE PAS recréer ni simplifier les paths

export function BonziniLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      {/* COPIER les 4 <path> EXACTS depuis bonzini_logo.svg */}
      {/* Path 1: fill="#F3A745" */}
      {/* Path 2: fill="#A947FE" */}
      {/* Path 3: fill="#A947FE" */}
      {/* Path 4: fill="#FE560D" */}
    </svg>
  );
}
```

### 3.4 Simulateur de paiement (Hero)

Le simulateur dans le hero doit être connecté aux vrais taux si possible.

```typescript
// landing/src/lib/rates.ts
import { createClient } from "@supabase/supabase-js";

// Client Supabase public (lecture seule) pour la landing page
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface Rate {
  payment_method: string;
  base_rate: number;
}

export async function fetchRates(): Promise<Rate[]> {
  const { data, error } = await supabase
    .from("rates")  // ADAPTE au nom de la table réelle
    .select("payment_method, base_rate")
    .eq("is_active", true);

  if (error || !data) {
    // Fallback si pas de connexion — taux par défaut
    return [
      { payment_method: "alipay", base_rate: 11610 },
      { payment_method: "wechat", base_rate: 11610 },
      { payment_method: "virement", base_rate: 11610 },
      { payment_method: "cash", base_rate: 11575 },
    ];
  }
  return data;
}
```

**Le simulateur utilise le taux Alipay par défaut** pour calculer la conversion. Quand l'utilisateur change le montant (boutons 100K/500K/1M/5M), le montant CNY se recalcule :

```typescript
// Calcul dans le simulateur
const amountXAF = 500000; // ou le montant sélectionné
const rate = 11610;        // taux Alipay (depuis Supabase ou fallback)
const amountCNY = Math.round(amountXAF * rate / 1000000);
// 500000 * 11610 / 1000000 = 5805
// Afficher : ¥5 805
```

**Si la table `rates` n'est pas accessible** depuis la landing page (CORS, RLS), utilise des taux en dur comme fallback. Le simulateur est avant tout un outil de démonstration, pas un outil de précision.

---

## ÉTAPE 4 — TEXTES ET COPYWRITING

### 4.1 Tous les textes de la page

Voici les textes EXACTS à utiliser. Ne modifie AUCUN texte.

**Hero :**
- Badge : "Le paiement, c'est nous. Le business, c'est vous."
- Headline : "Votre fournisseur est **payé** avant **ce soir**"
- Sous-titre : "Alipay, WeChat, virement ou cash. Vous envoyez en francs CFA, votre fournisseur reçoit en yuan. Avec la **preuve dans votre poche**."
- CTA primaire : "Envoyer un paiement"
- CTA secondaire : "Voir les taux"
- Simulateur titre : "Simulateur de paiement"
- Simulateur labels : "VOUS ENVOYEZ" / "FOURNISSEUR REÇOIT"

**Ticker :** "Alipay" · "WeChat Pay" · "Virement bancaire" · "Cash RMB" · "Cameroun" · "Gabon" · "Tchad" · "RCA" · "Congo" · "Paiement instantané" · "Meilleur taux" · "Sans carte"

**Stats :** "5 pays" / "4 modes" / "<5 min" / "0 frais"

**Comment ça marche :**
- Titre section : "Quatre étapes. Cinq minutes."
- Étape 01 "Choisissez" : "Alipay, WeChat, virement ou cash. Selon la préférence de votre fournisseur."
- Étape 02 "Montant" : "En XAF ou en yuan. Le taux instantané s'affiche, optimisé selon le volume."
- Étape 03 "Bénéficiaire" : "QR code, identifiant ou coordonnées bancaires. Sauvegardé pour la prochaine fois."
- Étape 04 "Instantané" : "Votre fournisseur reçoit les fonds immédiatement. Preuve de paiement dans l'app."

**Modes de paiement :**
- Titre : "Le mode que votre fournisseur préfère"
- Alipay (tag "Le plus populaire") : "QR code ou identifiant. Paiement instantané vers n'importe quel compte Alipay en Chine."
- WeChat (tag "Rapide") : "Via l'écosystème WeChat. Idéal pour les fournisseurs qui utilisent WeChat au quotidien."
- Virement (tag "Gros montants") : "Directement sur le compte bancaire de votre fournisseur. Pour les commandes importantes."
- Cash (tag "Sur place") : "Remise en espèces avec signature de réception. Pour les fournisseurs qui préfèrent le cash."

**FAQ :** 6 questions (voir la maquette pour le texte exact)

**CTA final :**
- Headline : "Vos fournisseurs attendent"
- Sous-titre : "Chaque minute compte dans le commerce. Envoyez votre premier paiement maintenant."
- Bouton : "Commencer maintenant"

**Footer :**
- Tagline : "Paiements instantanés vers la Chine pour les importateurs de la zone CEMAC."
- Colonnes : Produit / Entreprise / Support

---

## ÉTAPE 5 — RESPONSIVE

### Breakpoints

```
Mobile:   < 640px   → 1 colonne, hero empilé, simulateur en dessous
Tablet:   640-1024px → 2 colonnes adaptées
Desktop:  > 1024px  → Layout complet comme la maquette
```

### Points critiques responsive

**Hero :**
- Mobile : texte au-dessus, simulateur en dessous (full width)
- Desktop : texte à gauche, simulateur à droite

**Stats :**
- Mobile : grille 2x2
- Desktop : 4 en ligne

**How it works :**
- Mobile : cartes empilées verticalement
- Desktop : grille 4 colonnes avec bordures verticales

**Methods :**
- Mobile : 1 carte par ligne
- Desktop : grille 2x2

**Navbar :**
- Mobile : logo + bouton hamburger (menu caché)
- Desktop : navigation complète visible

---

## ÉTAPE 6 — PERFORMANCE

### Images
- Utiliser `next/image` pour toutes les images
- Pas d'images lourdes sur la landing page (tout est SVG, CSS, texte)
- Créer une image Open Graph `og-image.png` (1200x630px) pour les partages sociaux

### Fonts
- Utiliser `next/font/google` (déjà dans le layout) pour éviter le Flash of Unstyled Text
- Le `display: "swap"` est configuré

### Bundle
- Framer Motion supporte le tree-shaking — n'importer que ce qui est utilisé
- Tous les composants avec interactivité (simulateur, FAQ, navbar scroll) doivent avoir `"use client"` en haut
- Les composants statiques (Footer, textes) restent en Server Components

---

## ÉTAPE 7 — DÉPLOIEMENT

### Vercel (recommandé pour Next.js)

```bash
cd landing
npx vercel
```

Configurer le domaine `bonzinilabs.com` pour pointer vers ce déploiement Vercel.

### Variables d'environnement

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
```

Ces variables sont nécessaires UNIQUEMENT si le simulateur de paiement est connecté aux vrais taux. Si ce n'est pas le cas, le simulateur fonctionne avec des taux en dur.

---

## ÉTAPE 8 — SUPPRESSION DE L'ANCIENNE LANDING PAGE

**APRÈS** avoir vérifié que la nouvelle landing page fonctionne :

```bash
# Identifier les fichiers de l'ancienne landing page
# (dans le projet principal, pas dans landing/)
find src/ -name "*Landing*" -o -name "*landing*" -o -name "*HomePage*" -o -name "*home*" | grep -v node_modules

# Supprimer les fichiers dédiés à l'ancienne landing
# NE PAS supprimer les fichiers partagés (composants utilisés ailleurs)
```

Si l'ancienne landing page est à la racine du projet Vite (`src/pages/index.tsx` ou similaire), la remplacer par une redirection vers le nouveau site Next.js, ou la supprimer si le domaine principal pointe déjà vers le nouveau déploiement.

---

## CHECKLIST FINALE

### Design
- [ ] Police **Syne** pour tous les titres (font-display)
- [ ] Police **DM Sans** pour tout le body text (font-body)
- [ ] Logo SVG Bonzini avec les 4 paths exacts (pas recréé)
- [ ] Couleurs respectées (violet #a64af7, or #f3a745, orange #fe560d)
- [ ] Fond noir profond #050208 (pas gris, pas bleu marine)
- [ ] Barre tricolore or/violet/orange dans le footer
- [ ] Gradient orbs animés dans le hero

### Contenu
- [ ] Badge : "Le paiement, c'est nous. Le business, c'est vous."
- [ ] Headline : "Votre fournisseur est payé avant ce soir"
- [ ] Sous-titre mentionne "preuve dans votre poche"
- [ ] Simulateur de paiement interactif avec boutons de montants
- [ ] Ticker défilant avec les 12 mots-clés
- [ ] Compteurs animés (5 pays, 4 modes, <5 min, 0 frais)
- [ ] 4 étapes du processus
- [ ] 4 modes de paiement avec tags
- [ ] 6 questions FAQ en accordion
- [ ] CTA final "Vos fournisseurs attendent"

### Animations
- [ ] Staggered reveal au scroll (Framer Motion)
- [ ] Gradient orbs flottants (CSS keyframes)
- [ ] Ticker défilant infini (CSS animation)
- [ ] Compteurs animés au scroll
- [ ] Hover lift + glow sur les cartes
- [ ] Navbar transparent > opaque au scroll
- [ ] FAQ accordion smooth

### SEO
- [ ] Title tag : "Bonzini — Payez vos fournisseurs chinois en francs CFA"
- [ ] Meta description présente et pertinente
- [ ] Open Graph tags (titre, description, image)
- [ ] Twitter cards
- [ ] Structured data JSON-LD (FinancialService)
- [ ] `lang="fr"` sur le HTML
- [ ] URL canonique
- [ ] Le HTML contient le texte (pas un SPA vide) — vérifier avec `curl https://bonzinilabs.com`

### Responsive
- [ ] Hero lisible et fonctionnel sur mobile 375px
- [ ] Simulateur pleine largeur sur mobile
- [ ] Navbar avec menu hamburger sur mobile
- [ ] Cartes en 1 colonne sur mobile
- [ ] Stats en 2x2 sur mobile
- [ ] FAQ lisible sur mobile
- [ ] Aucun scroll horizontal sur aucun écran

### Performance
- [ ] Lighthouse score > 90 (Performance, Accessibility, Best Practices, SEO)
- [ ] Pas de Cumulative Layout Shift (fonts swap)
- [ ] First Contentful Paint < 1.5s
- [ ] Pas d'images lourdes (tout est SVG/CSS)

---

## MAQUETTE DE RÉFÉRENCE

Le fichier `maquette_landing_page_v3.jsx` est la RÉFÉRENCE ABSOLUE pour :
- Le design (couleurs, espacement, typographie)
- La structure des sections (ordre, contenu)
- Les animations (reveals, hover states, ticker)
- Le simulateur de paiement (layout, boutons, calcul)

Le résultat final en Next.js + Tailwind + Framer Motion doit être **visuellement identique** à cette maquette, avec en plus le responsive et le SEO.

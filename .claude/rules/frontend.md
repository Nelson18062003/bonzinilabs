# Frontend Rules

## Landing Page — Color Palette (ALWAYS USE ALL 3)
The logo has 3 colors. Every section of the landing page must use all 3. Never use a single color.

- **Violet** `hsl(258 100% 60%)` → wings of logo → step 1, direct access badges, wire transfer badges
- **Amber** `hsl(36 100% 55%)` → "U" of logo → hero badge, step 2, exchange rate display
- **Orange** `hsl(16 100% 55%)` → "n" of logo → step 3, speed/rapidity, pulsing dot animation

## Messaging Rules — CRITICAL FOR BRAND
- Our activity = **payments TO CHINA** for **African importers**
- NEVER write: "transfert d'argent", "envoyer de l'argent", "envoyer", "virement bancaire classique"
- ALWAYS write: "paiement", "régler", "payer vos fournisseurs", "règlement fournisseur"
- Target audience: African importers who pay Chinese suppliers (not individuals sending money home)

## Hero Section Structure (prevents regressions)
- Hero container: `min-h-screen flex flex-col items-center justify-center` — natural centering
- NO `pt-*` or padding-top on the child container inside the hero section
- H1 headline: use 3 separate `<span className="block">` elements to avoid conditional line breaks
- Stats row: color each stat by logo color (amber / violet / orange in that order)

## SEO Requirements
- JSON-LD Schema.org type `FinancialService` must be present in `index.html`
- Page title: "Bonzini Labs — Payez vos fournisseurs chinois en XAF"
- Do not change these without updating both the schema and the title together

## Brand name — "Bonzini Labs", not "Bonzini"
Google verifies the OAuth consent screen's app name against the name shown on
the home page, and **rejected** the branding submission over that mismatch
(the site said "Bonzini", the consent screen "Bonzini Labs").

The full name must therefore stay identical in all four places at once:
`index.html` (title, `og:title`, `og:site_name`, `twitter:title`, JSON-LD
`name`), the navbar wordmark and footer wordmark in `LandingPage.tsx`, the
`footer.copyright` key in the three locales, and the Google Cloud Console
`App name` field. Shortening any one of them costs another review cycle.

## Key File
- `src/pages/LandingPage.tsx` — the full landing page component

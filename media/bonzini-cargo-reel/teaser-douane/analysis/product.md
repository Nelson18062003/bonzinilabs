# Bonzini Douane: product brief for the teaser

Status as of 01/10/2026. I did not modify any file. The worktree is clean (`git status` is empty).

`W = <scratchpad>/tariff` (branch `claude/bonzini-cameroon-tariff-3b9uli`, HEAD `0d338f62` « direction premium »)

## 0. What actually works today (checked, not assumed)

| Fact | Evidence |
|---|---|
| **The live site www.bonzinilabs.com/douane still runs the previous design (commit `d3af4520`)**, not the premium one. The live chunk `CustomsHomePage-BQfaflfX.js` uses `site.home.titleA/titleB/eyebrow/toolsTitle`. It contains none of the premium keys (`h1Muted`, `bentoTitle`, `floatSigned`…). **The premium direction can only be filmed on the local dev server.** | Bundle downloaded from `www.bonzinilabs.com/assets/…` |
| The production database has the customs migrations. 8 notices are published and readable without login: `tec-ceeac-2026`, `lf2026-accises-vehicules`, `lf2026-taxe-environnementale`, `civic-vehicules-occasion`, `pvi-sgs-facture-definitive`, `code-douanes-ceeac-cemac-2026`, `chine-fete-nationale-2026` (1–7 Oct, under way today), `nouvel-an-chinois-2027`. | REST with the public key; read-only SELECT |
| **`customs_brokers` = 0 rows. `customs_classifications`, `customs_audits` and `customs_supplier_invites` are also 0.** No licensed customs broker (commissionnaire agréé, CAD) is registered. | Supabase SELECT count, read-only |
| **The edge functions `customs-ai` and `customs-supplier` are NOT deployed** (POST returns `{"code":"NOT_FOUND"}`). AI classification, AI reading of a DAU and supplier uploads cannot run in production. | curl to `/functions/v1/*` |
| The RPC `logistics_observed_transit` answers `{"lanes":[],"min_count":3,"window_months":18}`. With no lanes, the routes page shows "Fourchettes du marché". | curl to the RPC |
| A Vite server for the worktree is already running on :8080 (pid 879, log `<scratchpad>/tariff_vite.log`). I checked it with headless Chromium. | Probe at 810×1440 |

## 1. Each feature: the problem it solves and how it gets the importer to pay only what he owes

Architecture: the AI **reads and converses**. The calculation is **deterministic code** in `$W/src/lib/customs/`. A licensed broker (CAD) **signs** (`$W/docs/douane/00-plan.md` §3).

**1. Simulateur de droits et taxes** (`/douane/simulateur`, public; `$W/src/pages/customs/site/simulator/*`, `$W/src/lib/customs/engine.ts`)
- **Problem:** the importer finds out what he owes at the port, on a DAU he cannot read (plan §1).
- **Mechanism:** a copy of how CAMCIS liquidates a declaration:
  - V = price × rate + freight + insurance
  - DDI = V × TEC
  - DAC = (V+DDI) × excise
  - DEA = 1 % of V
  - TVA = 17.5 % of (V+DDI+DAC+DEA)
  - CAC = 10 % of TVA
  - TCI/CCI/CIA/PRO = 1.25 % of V
  - DEV for used vehicles
  - Outside the DAU: PVI 0.95 % of FOB from 2 M F, précompte 2/5/10 %, CIVIC.
- **Accuracy:** replayed on a real DAU and the RAV4 cases with a maximum gap of **2 F** (`$W/docs/douane/01-sources.md` §1, `$W/src/tests/lib/customs/engine.test.ts`).
- **How it keeps the bill to what is owed:**
  - (a) the amount is known before ordering, including landed cost;
  - (b) search uses market words and shows the trap under the result (`$W/src/lib/customs/marketTerms.ts`): chairs are 94.01 not 94.03 (an unowed 25 % excise), tissues carry no excise, new clothes declared as friperie pay an unowed excise;
  - (c) « Et si la douane choisit un autre code ? » compares two codes and gives the difference;
  - (d) the « Pour ne pas payer plus » notes (engine.ts l.301-311): get a NIU (10 % → 2 % précompte), DI/RVC above 2 M FOB (25 % fine), final invoice at the SGS (otherwise the value can be tripled), domiciliation, "the Bonzini payment proof establishes the value actually paid (art. 30)", and the `code_check` note, which appears on **every** result;
  - (e) inputs for freight, regime, cylinder capacity, agricultural VAT exemption, and the "TEC CEEAC 40 %" warning;
  - (f) green/amber confidence dots;
  - (g) the whole scenario is in a shareable URL.

**2. Classer un produit** (`/douane/classer`, `/douane/classer/:id`, login required; `$W/src/pages/customs/ClassifyHomePage.tsx`, `ClassificationPage.tsx`, `site/classify/Conversation.tsx`)
- **Problem:** codes chosen « par ressemblance de mots » (« régulateur » → refrigerator at 30 % instead of 8504 at 10 %).
- **Mechanism:**
  - Claude, through `customs-ai`, asks the questions that separate two codes (material, use, new or used, power).
  - It proposes 1 to 3 codes, each with its rules, its duty and a confidence bar.
  - A CAD takes the file and signs it through `customs_classification_decide` (`@mola` confirm:true, danger:true; `$W/supabase/migrations/20260929120000_customs_foundation.sql` l.547). His company and licence number are written on the client's file.
  - The signed code becomes the reference. An advance-ruling letter (art. 75) can be generated.
- **Not runnable in production:** no edge function and 0 brokers.

**3. Vérifier une déclaration (DAU)** (`/douane/audit`, `/douane/audit/:id`, login required; `$W/src/lib/customs/audit.ts`, `site/audit/Report.tsx`)
- **Problem:** the importer overpays without knowing, and does not know his remedies.
- **Mechanism:**
  - The AI reads the DAU from a PDF or photo.
  - `auditDau` runs 3 deterministic checks:
    1. re-reading: do the amounts read recalculate?
    2. same code: duty against the tariff, excise against CGI annex II, VAT exemptions;
    3. classification: does the description match the code (market vocabulary, used goods)?
  - Each finding goes into a **voie de droit** (route):
    - `claim`: an assessment error. **Réclamation dans les 3 ans** (art. 396); the deadline is payment + 3 years, with a day countdown.
    - `reclassify`: the species/code is not rectifiable (art. 162.2). The declaration can be withdrawn before release (mainlevée, art. 162.3); otherwise it is a gain on the next containers.
    - `risk`: underpaid, so regularise.
    - `check`: to verify, no amount counted.
  - The CAD then gives a signed opinion with the recoverable amount (`customs_audit_review`).
- **Engine replay on the real DAU `SDSD2-2026-IMP-020399-I`:**
  - paid **1 749 209 XAF**
  - claimable **58 132** (the site hard-codes 58 136)
  - reclassification **248 935** (the dossier says 248 942)
  - risk 0
  - deadline **17/09/2029**, i.e. 1 082 days from 01/10/2026
- **Key nuance:** of the 307 078 F, **only about 58 k is claimable**. For the rest, the dossier itself says « C'est donc d'abord un gain pour la suite, pas un remboursement » (`$W/docs/cargo/dossiers/2026-08_CTR-MRSU9909331_BL-271875389/articles-4-a-10_analyse.md` §5).

**4. Veille / Actualités** (`/douane/veille`, public; `site/NewsPage.tsx`)
- Each notice carries a source, a confidence level and targeted HS codes.
- Publishing a notice alerts the clients whose classified codes match.
- The simulator shows « Veille : 1 avis concerne ce code » (for example on mèches).
- **How it helps:** the importer learns of a change (TEC 40 %, environmental tax, exemptions) before he buys.

**5. Routes et délais** (`/douane/routes`, public; `RoutesPage.tsx`, `$W/src/lib/logistics/atlas.ts`)
- Days per leg (J+), observed vs announced, CO₂, and disruptions on the route.
- Not directly about duties. Example: Shanghai → Douala by sea, 1 000 kg: **46–80 days**, 19 246 km, 308 kg CO₂e (market ranges).

**6. Mes fournisseurs** (`/douane/fournisseurs`, login required) and the supplier page `/f/:token` (public, by token)
- **Problem:** without a final invoice lodged at the SGS, the customs value is set much higher (2 311 829 F too much on one vehicle).
- **Mechanism:** a hashed, single-display link. The supplier uploads the final invoice, packing list and product sheet without an account, in Chinese. The importer is notified.
- Not runnable in production (`customs-supplier` is not deployed).

**7. Mon espace** (`/douane/espace`, login required)
- Tasks derived from the files, with urgency now / soon / later (`$W/src/lib/customs/tasks.ts`). Example: « Réclamez {{amount}} F sur la déclaration {{dau}} : il reste N jours. »

**8. Link to payments**
- Violet « Payer mon fournisseur » buttons: `/payments/new` when logged in, otherwise `/auth`.

## 2. Public vs login-required pages, and what to film

| Route | Access | Data needed | Worth filming |
|---|---|---|---|
| `/douane` | public | static, plus prod notices (otherwise the News block hides) | hero, phone, floating cards, bento, violet proof block, black pay band |
| `/douane/simulateur?…` | public | **static** `public/data/customs/nomenclature-cm.v1.json` (no Supabase); notices only for « Veille » | black result card, 4-colour bar, violet notes, comparison |
| `/douane/veille` | public | prod `customs_notices` (8 rows) | news cards, Établi/À venir badges |
| `/douane/routes` | public | RPC (empty lanes) + OpenFreeMap tiles over the network | big "46–80 jours", map, J+ timeline |
| `/f/:token` | public with a valid token | RPC + function not deployed | not filmable |
| `/douane/classer*`, `/douane/audit*`, `/douane/fournisseurs`, `/douane/espace` | `ProtectedRoute` → `/auth` | AI function not deployed, 0 data | only via a mock (see §6) |

**Most cinematic elements.** There are no data-testids; the selectors below were tested.

**Hero** (`$W/src/pages/customs/site/SiteHome.tsx` l.117-181)
- `main h1`: « Payez le juste droit. » with a grey line `span.text-dz-mute` « Pas un franc de plus. »
- Search pill `#dz-hero-q` plus the « Estimer » button; chips (Mèches, Panneaux solaires, Téléphones, Motos, Friperie, Carreaux).
- Trust row: « **Tarif 2026** · calcul CAMCIS / **Commissionnaires** agréés / **Sans compte** pour estimer ».

**Phone** `.rounded-\[52px\]` (300×600, black body #111, white screen `.rounded-\[42px\]`)
- It **cycles every 4.5 s** through three engine results:
  - Régulateur de tension, 8504.40 at 10 %, 900 000 F → **302 557 F CFA** (duty 90 000 / VAT and centimes 192 307 / other 20 250)
  - Mèches synthétiques, 6704.11 at 30 %, 1 000 000 F → **768 457** (duty 300 000 / excise 162 500 / VAT 283 457 / other 22 500)
  - Chaises, 9401.80 at 30 %, 500 000 F → **287 338**
- Big number `p.text-\[38px\]` with a 0.45 s CountUp. Split bar `div.flex.h-2.gap-1`. Violet button « Payer mon fournisseur ».

**Floating cards** `.rounded-\[22px\]` (**hidden below 768 px wide**)
- « Code signé par ✓ un commissionnaire agréé »
- « À récupérer sur votre DAU **+ 58 136 XAF** » in violet

**Bento** (l.223-299): « Tout pour dédouaner / sans mauvaise surprise. »
- Simulator tile with a black « À payer à la douane 768 457 XAF » bar.
- Classification tile: bubbles « Relais ou servomoteur ? » / « Relais électronique » and a green-ringed card « 8504.40 · Signé par un commissionnaire agréé ». This is a **static mock-up**.
- Audit tile: `p.text-\[48px\].text-dz-violet` « 58 136 XAF », plus struck-through lines 36 084 / 193 782.
- Routes tile: `span.text-\[44px\]` « 46–80 » with an SVG path that draws itself (pathLength 0→0.68, 1.4 s).

**Violet proof block** `div.bg-dz-violet` (l.316-338)
- « **307 078 F** » at 60/96/120 px, weight 900.
- `proofSub` text and a white pill « Vérifier ma DAU ».

**Pay band** `div.bg-\[\#0d0d12\]`: « Dédouané ? / Payez votre fournisseur en Chine. »

**Simulator** (Result.tsx)
- Black card `aside div.rounded-3xl.bg-dz-primary`, number 40/46 px.
- Bar `div.h-2\.5` animating 0→% in 0.6 s: **violet = duty, orange = excise, gold = VAT + centimes, grey = other** (`site/simulator/groups.ts`).
- « Pour ne pas payer plus » block `div.bg-dz-brand-soft`.
- Comparison delta `p.bg-dz-good-soft`.

**Deep links checked headless:**
- `/douane/simulateur?c=940370&vs=940180&a=500000&cur=XAF&inc=CIF` → **481 120 XAF** (« soit 96,2 % de la valeur en douane », **all 4 colours**) vs **287 338**. The delta line should read « Avec 9401.80, vous paieriez 193 782 XAF de moins » (engine figure; I read the totals but did not capture that line).
- `…?c=841821&vs=850440&a=150000&cur=XAF&inc=CIF` → 86 202 vs 50 427 (35 775 less).
- `…?c=670411&a=1000000&cur=XAF&inc=CIF` → 768 457 (76,8 %), plus the warning « peut porter ce produit à 40 % : ce serait 902 613 F au lieu de 768 457 F ».

**Routes:** use `div.rounded-3xl.bg-dz-primary`, not the first `.bg-dz-primary`, which is the header button.

**Audit report** (login + mock only): `AuditTotals`, `AuditRoutes` (« Jusqu'au 17 septembre 2029, dans 1 082 jours (trois ans après le paiement) »), `AuditArticleList`. Exact finding texts are in audit.ts l.263-330.

## 3. Strong French wording (`$W/src/i18n/locales/fr/customs.json`)

| Key | Text |
|---|---|
| `hub.tagline` | « Payez le juste droit. Ni plus, ni moins. » (the series signature) |
| `site.home.h1` / `h1Muted` | « Payez le juste droit. » / « Pas un franc de plus. » (⚠ §5) |
| `site.home.bentoTitle`/`bentoMuted` | « Tout pour dédouaner » / « sans mauvaise surprise. » |
| `site.home.b2Title` / `b2Desc` | « Un code signé. » / « L'assistant propose, un commissionnaire agréé signe. » |
| `site.home.tools.classify.desc` | « L'IA propose, un commissionnaire agréé signe. » |
| `site.home.b3Title` / `b3Desc` | « Le trop-payé, récupéré. » (⚠) / « On relit votre DAU, taxe par taxe. » |
| `site.home.b4Title` | « Sachez quand ça arrive. » |
| `audit.homeTagline` | « Avez-vous payé le juste droit ? » |
| `audit.check2` | « Chaque code confronté à sa désignation : un « régulateur » n'est pas un réfrigérateur. » |
| `site.home.proofSub` | « payés en trop sur une seule déclaration de 900 000 F. Quatre codes sur dix étaient faux. » (⚠ second sentence) |
| `site.home.proofBody` | « Un régulateur déclaré comme réfrigérateur, des chaises comme « autres meubles ». Le moteur recalcule chaque ligne comme CAMCIS et vous dit ce qui se récupère. » |
| `sim.compareCta` | « Et si la douane choisit un autre code ? » |
| `sim.freightHint` | « … chaque franc de fret paie les mêmes droits que la marchandise. » |
| `sim.notesAction` / `sim.headline` | « Pour ne pas payer plus » / « À payer à la douane » |
| `site.home.searchPlaceholder` | « Quel produit importez-vous ? » |
| `site.home.payTitle`/`payMuted`/`payCta` | « Dédouané ? » / « Payez votre fournisseur en Chine. » / « Payer mon fournisseur » |
| `site.cta`, `site.home.proofCta` | « Estimer mes droits », « Vérifier ma DAU » |
| `files.how3Desc` | « Il valide ou corrige. Le code signé devient votre référence… » |
| Engine `code_check` | « « régulateur » déclaré comme réfrigérateur a coûté 35 779 F de trop sur 150 000 F. » |
| Dossier (not UI) | « 307 078 XAF sur 900 000 XAF de marchandises — soit 34 % de leur valeur déclarée. » |

## 4. Premium design system

- **Font:** Satoshi 400/500/700/900 woff2 in `$W/public/fonts/satoshi/`. Licence ITF FFL, commercial use allowed.
- **Headlines:** weight 900, tight leading, line 1 black then line 2 grey `#86868F`.
  - Hero 44 / 64 / 84 px, leading 1, tracking −0.045em.
  - h2 36 / 56 px, tracking −0.04em.
  - Proof number 120 px, tracking −0.055em.
- **Body:** 18–21 px, weight 500. All numbers `tabular-nums`, with an ordinary NBSP thousands separator (`$W/src/pages/customs/format.ts`).
- **Colours** (`$W/src/index.css` l.1712, light theme):

| Token | Hex |
|---|---|
| bg / soft | `#F5F5F7` |
| fill | `#EAEAEF` |
| card | `#FFFFFF` |
| line | `#E8E8EC` |
| ink / primary | `#0D0D12` |
| ink2 | `#3A3A44` |
| ink3 | `#6E6E78` |
| mute | `#86868F` |
| **violet (logo, flat fills, big numbers)** | **`#A947FE`** |
| brand (links) | `#7D22E0` |
| brand-soft | `#F5EDFF` |
| **gold (VAT)** | **`#F3A745`** |
| **orange (excise)** | **`#FE560D`** |
| good | `#038C4E` / soft `#E3F7EC` |
| warn | `#9E5700` / soft `#FFF4DE` |
| bad | `#CE2626` |

  - Phone body `#111`, halo `#281450` at 25 % opacity with 40 px blur.
  - Audit dots: claimable `#4ADE80`, reclassify `#A78BFA`, risk `#F3A745`.
  - Dark mode exists (bg `#0A0A0D`, card `#141418`), but the reference look is light.
- **Rules** (plan §7): no glow, no gradient text, no icon in a coloured square. One black pill per screen for the main action; grey for secondary; violet reserved for "pay a supplier" and for proof.
- **Radii:** cards 28 px, proof block 32/40, phone 52 outer / 42 inner, floating cards 22, chat bubbles 22 (one corner 6), result card 24, inputs 16, pills full.
- **Motion:** easing `cubic-bezier(0.16, 1, 0.3, 1)` (`EASE`, `site/styles.ts`).
  - Hero fades up (y 14) over 0.6 s, staggered 0 / 0.08 / 0.16 / 0.25 / 0.3 s.
  - Phone rises y 40 over 0.8 s (delay 0.2); floating cards y 12 at 0.7 and 0.85 s.
  - `Reveal` y 16 over 0.5 s; CountUp 0.45 s; tax bar 0.6 s; confidence bar 0.7 s; route path 1.4 s.
  - Phone crossfade y ±8 over 0.35 s; pills spring (stiffness 500, damping 40); page transition y 8 over 0.35 s. Every animation is ≤ 400 ms except the ones listed.

## 5. Claims

**What the product says, with its own caveats:**
- `sim.disclaimer`: « Estimation. … faites confirmer par un commissionnaire agréé en douane avant de vous engager. »
- `site.footerNote`: « Estimations à faire confirmer par un commissionnaire agréé en douane. »
- `audit.legal`: « Le moteur signale ; le commissionnaire agréé décide. » Article numbers are « à confirmer » in the 2026 CEEAC-CEMAC code.
- Every rate carries a confidence: Officiel / Vérifié sur une DAU / Marché / À vérifier.
- The real-case findings are rated `a_verifier` (tissues excise) or `marche`. In the dossier, only the régulateur is "haute confiance".
- Routes: « fourchettes du marché », « un ordre de grandeur ».

**Risky in a video:**
1. **« Pas un franc de plus » (`h1Muted`)** is close to the banned « au franc près ». It is also an accuracy promise. `hub.facts` literally says « au franc près », but it is only on the staff hub.
2. **« Compte gratuit » (`withAccount`)** is the tag on the classification and audit bento tiles. « gratuit » is banned, so crop it.
3. **« Le montant exact » (`b1Desc`)** contradicts « Estimation ».
4. **« récupérez ce qui a été payé en trop » (`lead`), « Le trop-payé, récupéré. » (`b3Title`), « À récupérer sur votre DAU » (`floatBack`)**: only the claimable part is recoverable, and the CAD decides. Never say "remboursé" or "garanti".
5. **307 078 F** must not be presented as "recovered" or "refunded" (it is about 58 k claimable plus about 249 k gained on the next containers).
   - « Quatre codes sur dix étaient faux » is inexact: 3 classification errors plus 1 excise error, out of 7 taxed articles. `audit.homeIntro` itself says « quatre articles sur sept ».
6. **"Signé par un commissionnaire agréé" as a live service:** 0 brokers registered and the AI functions are not deployed. Show it as the method ("l'IA propose, un commissionnaire agréé signe"), not as an operation already running.
7. **Unsourced or inconsistent numbers:**
   - 36 084 (bento) has no source anywhere in the repo.
   - Engine 35 775 vs text 35 779; engine 58 132 vs hard-coded 58 136; 307 067 vs 307 078. Never show two versions of the same figure in one frame.
8. **Third-party names that appear in the UI:**
   - « Toyota Fortuner » and « export-cm.sgs.com » appear in the « Pour ne pas payer plus » note when FOB ≥ 2 M F.
   - « WhatsApp » and a phone number are in the footer.
   - « OpenFreeMap / OpenStreetMap » attribution is on the map.
   - « Claude, d'Anthropic » is in the privacy notices.
   - « Flexport » is in the docs.
   - Avoid or crop all of these. Use amounts under 2 M F in the simulator.
9. Blaming customs or the declarant: the audit dossier names the declarant in its header (it is not shown in the audit UI). Keep "par ressemblance de mots" as the cause, with no culprit.

**Safest strong promise:** « Payez le juste droit. Ni plus, ni moins. », paired with a factual proof: « Sur une vraie déclaration : 307 078 F en jeu sur 900 000 F de marchandises » (or « payés en trop », the product's own wording), and the end card « Estimez vos droits avant d'acheter » plus « Estimation à faire confirmer par un commissionnaire agréé en douane ».

## 6. Running it locally and capturing

1. **Server:** it is already up. Otherwise run `cd $W && npx vite --host --port 8080` (`.env` points at prod `fmhsohrgbznqmcvqktjw` with the public key).
2. **Browser:**
   - Playwright 1.59.1 is installed, but its default Chromium revision (1217) is not. Use `executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'`.
   - Set `proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost' }`, otherwise notices and map tiles do not load.
   - Set `locale: 'fr-FR'`, `colorScheme: 'light'` (the theme follows the system), and do not request reduced motion (`MotionConfig reducedMotion="user"`).
3. **9:16 framing:**
   - **810×1440 CSS px, deviceScaleFactor 4/3, gives 1080×1920.** At 810 px the floating cards show (≥ 768 px) and the bento and proof block stack vertically.
   - Under 768 px the floating cards disappear.
4. **Hide the React Query devtools palm-tree button**, mounted bottom-left in dev (`$W/src/App.tsx` l.453): `page.addStyleTag({content:'.tsqd-open-btn-container{display:none!important}'})`. Alternatively use `npm run build && npx vite preview`.
5. **Simulator on a narrow screen:** a sticky black bar « À payer à la douane … Voir » covers the bottom of the screen while the result is out of view. Scroll to the result or film at ≥ 1024 px.
6. **Bento and proof animations** fire on scroll (`useInView`). Scroll smoothly with `page.mouse.wheel`.
7. **Login-required pages:** no session, no AI and no data in production. For the audit report or the classification conversation, use a scratch harness that renders `AuditTotals`/`AuditRoutes`/`AuditArticleList` from the fixture in `$W/src/tests/lib/customs/audit.test.ts` (`auditDau` output, figures above). Another option is to extend the `SCREENSHOT_MOCK=1` aliases in `$W/vite.config.ts`, which have no customs mocks yet.

Engine and probe scripts used for the figures are in `<scratchpad>/brief/` (`run.ts`, `run2.ts`, `run3.ts`, `probe.mjs`). Screenshots: `home-810.png` (home), `sim-chairs-810.png` (simulator, chairs case).
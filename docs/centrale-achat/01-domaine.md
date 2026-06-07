# Phase 1 — Apprentissage du domaine procurement

> **Statut : rendu, en attente de validation.** Recherche documentaire sourcée (3 fronts parallèles),
> orientée « ce qu'on emprunte / ce qu'on jette pour un agent de sourcing à 2 personnes ». Aucun
> design de données ici (réservé Phase 2) : je relie le métier aux *futures* briques, je ne les
> conçois pas.
>
> **Date de recherche / accès des URL : 07/06/2026.**
>
> **Légende confiance :** 🟢 **vérifié** (source primaire ICC/WCO/trade.gov/Anthropic/WeChat AUP, ou
> ≥2 sources indépendantes) · 🟡 **réputé** (convergent sur sources secondaires, pas un organisme
> normatif) · 🔴 **incertain** (source unique / contesté / à valider avec toi).

---

## Partie A — Glossaire vérifié du métier

### A.1 Cycle de vie d'une commande & documents 🟢

Séquence standard : **RFQ → Devis → PI → PO / Contrat → [acompte → production] → CI + Packing List
+ B/L + Certificat d'origine (à l'expédition).**

| Document | Ce que c'est | Émis par | Liant ? | Moment |
|---|---|---|---|---|
| **RFQ** (demande de devis) | Liste specs/quantités/délais, demande de prix | **Acheteur** | Non | Début |
| **Devis (Quotation)** | Offre chiffrée du fournisseur | **Fournisseur** | Non | Après RFQ |
| **PI — Proforma Invoice** | Facture **préliminaire non liante** = devis détaillé + RIB pour déclencher l'**acompte**. Émise **avant** production. | **Fournisseur** | Non | Avant paiement |
| **PO — Purchase Order** | Bon de commande officiel de l'acheteur, **liant une fois accepté**. | **Acheteur** | **Oui** | Après PI |
| **Contrat de vente** | Cadre juridique complet (gros deals) | Les deux (signé) | **Oui** | Avec/après PO |
| **CI — Commercial Invoice** | Facture **finale liante**, reflète la **quantité réellement expédiée**, **base du dédouanement**. Émise **après** expédition. | **Fournisseur** | **Oui** | Expédition |
| **Packing List** | Détail colisage : poids net/brut, dimensions, marques. Sans prix. | **Fournisseur** | Non | Expédition |
| **B/L — Bill of Lading** | 3 fonctions : reçu + preuve du contrat de transport + **titre de propriété**. | **Transporteur** | **Oui** | Chargement |
| **Certificat d'origine** | Pays de fabrication (drive le tarif douanier). | **Exportateur**, visé Chambre de commerce | Déclaratif | Expédition |

**La distinction à ne pas rater :** **PI = devis du vendeur** (avant, non liant, déclenche
l'acompte) · **PO = commande de l'acheteur** (avant, liant) · **CI = facture finale du vendeur**
(après, liante, document douanier, vraies quantités). *Aide-mémoire : l'acheteur émet le PO ; le
vendeur émet la PI et la CI.* PI et CI se ressemblent — la différence est le **timing** (avant/après
expédition) et le fait que la CI porte les quantités réelles pour la douane.
Sources : [IncoDocs PI vs CI](https://incodocs.com/blog/difference-proforma-invoice-commercial-invoice/) ·
[trade.gov — Common Export Documents](https://www.trade.gov/common-export-documents).

> **Pour nous :** la commande suit la machine à états **PI → PO/acompte → CI/Packing List/B-L**. La
> PI est l'artefact « devis-au-client » ; CI+Packing+B-L = le « pack d'expédition ». Le COO compte
> car il drive le droit de douane à Douala (§A.6).

### A.2 Acompte / solde & T/T 🟢🟡

- **30 % acompte / 70 % solde avant expédition** = le défaut réel du sourcing Chine. L'acompte
  finance les matières et engage l'acheteur ; le solde garde le levier côté acheteur jusqu'à la
  production finie mais **avant** que le fournisseur libère la marchandise. 🟡
- Variantes : **50/50** (OEM/custom), **30/60/10** (60 % après inspection, 10 % à réception —
  *staging sur jalons QC*), **0/100 via Trade Assurance ou L/C**. 🟡
- **Best practice quasi universelle : ne payer le solde qu'après une inspection QC réussie.** 🟢
- **T/T (Telegraphic Transfer)** = virement bancaire international, rail dominant. **Irrévocable une
  fois envoyé** → la protection vient du *moment* du paiement (solde après QC), pas du rail. 🟢

> **Pour nous :** chaque commande = **leg acompte + leg solde**, avec le % stocké par commande
> (défaut 30/70, éditable), et l'action « payer le solde » **conditionnée à un flag “QC passé”**.
> Cela colle au cœur actuel de Bonzini (déjà centré deposits/payments). Réf. T/T capturée par leg.

### A.3 Incoterms 🟢

**Version officielle courante : Incoterms® 2020** (confirmé ICC + trade.gov). **Aucune édition
2025/2030 officielle** à juin 2026 ; tout label « Incoterms 2023/2026 » dans un blog = **faux**.
Une révision « ~2030 » est *spéculée*, pas confirmée. 🟢 (présent) / 🔴 (futur)

11 termes. Les 7 pertinents Chine→Afrique (qui paie quoi / transfert de risque) :

| Terme | Dédouanement export | Fret principal | Assurance | Droits/dédouanement import | **Risque transféré au point :** |
|---|---|---|---|---|---|
| **EXW** | Acheteur | Acheteur | Acheteur | Acheteur | Usine du vendeur (max obligation **acheteur**) |
| **FCA** | Vendeur | Acheteur | Acheteur | Acheteur | Remise au transporteur désigné (recommandé pour conteneurs) |
| **FOB** | Vendeur | Acheteur | Acheteur | Acheteur | **À bord** du navire (port origine) |
| **CFR** | Vendeur | **Vendeur** | Acheteur | Acheteur | **À bord** au port origine (même si le vendeur paie le fret) |
| **CIF** | Vendeur | **Vendeur** | **Vendeur** (mini) | Acheteur | **À bord** au port origine (vendeur paie fret+assurance, **risque passe au chargement**) |
| **DAP** | Vendeur | Vendeur | Vendeur (de facto) | **Acheteur** | Au lieu de destination, prêt à décharger |
| **DDP** | Vendeur | Vendeur | Vendeur | **Vendeur (droits inclus)** | Au lieu de destination (max obligation **vendeur**) |

**Deux flags de précision :** (1) « **ship's rail** » est **obsolète depuis Incoterms 2010** → le
risque passe quand les biens sont **« à bord »** (FOB/CFR/CIF). (2) Erreur fréquente corrigée :
**sous DDP, c'est le VENDEUR qui paie les droits d'import** (« Duty Paid »), pas l'acheteur.
Sources : [ICC Incoterms 2020](https://iccwbo.org/business-solutions/incoterms-rules/incoterms-2020/) ·
[trade.gov — Know Your Incoterms](https://www.trade.gov/know-your-incoterms) ·
[Trade Finance Global — FOB « on board »](https://www.tradefinanceglobal.com/incoterms/fob-price-free-on-board-meaning/).

> **Pour nous :** **un champ Incoterm par commande = enum des 11** (jamais texte libre). Réalité
> Chine→Afrique : surtout **FOB** (ou **FCA** conteneur) port chinois, **CIF Douala** si le
> fournisseur arrange fret+assurance, **DDP** seulement si Bonzini livre dédouané. Surfacer au
> client : **CFR/CIF → le risque est déjà passé au port chinois**, donc l'assurance du leg maritime
> est son exposition. Modéliser les 11 avec matrices A1-A10 = sur-ingénierie ; enum + flag « qui
> assure le maritime » suffit.

### A.4 Contrôle qualité / inspection 🟢

- **AQL = Acceptance Quality Limit** : niveau de qualité **toléré au pire** (% max de défectueux)
  en échantillonnage aléatoire ; le plan dit combien d'unités tirer et le nb max de défauts avant
  **rejet du lot entier**. Normes : **ISO 2859-1** (international) ≡ **ANSI/ASQ Z1.4** (US), issues
  de MIL-STD-105E.
- **Niveaux d'inspection** : généraux **I / II / III** (**II = défaut**), spéciaux **S-1…S-4**
  (petits échantillons pour tests destructifs/coûteux).
- **Classes de défauts + AQL canoniques** : **Critique → AQL 0** · **Majeur → 2,5 %** · **Mineur →
  4,0 %** (défaut conso : **0 / 2,5 / 4,0**).
- **Types d'inspection sur le cycle** : **PPI** (pré-production) · **DUPRO** (en cours, ~20-80 %) ·
  **PSI ≈ FRI** (pré-expédition, ~80-100 %, **celle qui conditionne le solde 70 %**) · **LS/CLC**
  (supervision de chargement conteneur). *Flag : les acronymes varient selon le cabinet (LS/CLC/
  CLI/CLS), les concepts sont stables.*
Sources : [QIMA — AQL](https://www.qima.com/aql-acceptable-quality-limit) ·
[Bureau Veritas — PSI/DUPRO](https://www.cps.bureauveritas.com/needs/qc-inspections-psi-dupro) ·
[TestCoo — FAI/IPC/DUPRO/FRI/PSI/CLC](https://www.testcoo.com/en/blog/detailed-explanation-of-third-party-inspections-fai-ipc-dupro-fri-psi-clc).

> **Pour nous :** un **checkpoint QC par commande** avec résultat **pass/fail/conditionnel** qui
> **conditionne le paiement du solde** ; stocker le **type** (PPI/DUPRO/PSI/LS) + l'**AQL utilisé**
> (défaut Niveau II, 0/2,5/4,0) + le rapport/photos. **Pas** de calculateur de tables AQL maison :
> on réserve un inspecteur tiers (SGS/BV/QIMA) ou le père inspecte, on **enregistre le résultat +
> le lien rapport**. Connaître le vocabulaire = parler la langue de l'inspecteur.

### A.5 Trade finance (niveau vocabulaire) 🟢

- **L/C (Lettre de crédit)** : engagement de la banque de l'acheteur à payer **contre présentation
  des documents conformes** (paiement piloté par les documents). Lourd/coûteux → gros deals ou
  relation neuve.
- **Alibaba Trade Assurance** : **escrow gratuit** scoped Alibaba ; remboursement si retard ou
  qualité non conforme, **plafonné** au montant affiché. Fenêtre 30 j (60 j Enterprise).
- **Factoring / trade finance** : avance de trésorerie contre créances/factures pour combler le gap
  de working capital (pertinent si Bonzini avance l'acompte fournisseur).
Sources : [trade.gov — Letter of Credit](https://www.trade.gov/letter-credit) ·
[Alibaba — Trade Assurance](https://tradeassurance.alibaba.com/).

> **Pour nous :** vocabulaire > mécanisme. La plupart des commandes règlent en **T/T (30/70)** ou
> Trade Assurance, pas L/C. Un champ **« méthode de protection »** par commande (T/T / Trade
> Assurance / L/C) informe le client de son recours. Si Bonzini avance l'acompte → terrain du
> factoring (hors MVP).

### A.6 Expédition, consolidation & **compliance CEMAC** 🟢🟡

- **LCL vs FCL** : seuil ~**15 CBM** (en-dessous LCL souvent moins cher, au-dessus FCL 20'). 🟡
- **Capacités pratiques** : 20'GP ~**25-28 CBM**, 40'GP ~**55-58**, 40'HQ ~**60-68**. 🟡
- **CBM** = unité de volume du fret maritime ; facturation au max(CBM réel, poids volumétrique).
- **Consolidation** = combiner plusieurs fournisseurs en un conteneur → **value-add cœur d'un agent**.
- **Code HS (WCO)** : 6 chiffres identiques dans tous les pays membres ; **drive le tarif douanier**.
  Édition courante **HS 2022** (HS 2027 attendu, 🔴 timing).
- **Compliance import Cameroun / CEMAC (différenciateur)** 🟢 (trade.gov, country guide) :
  - **BESC/ECTN** (Bordereau Électronique de Suivi des Cargaisons) **obligatoire avant chargement**
    (Conseil National des Chargeurs) ; pénalité jusqu'à **50 %** si tardif. *Non requis pour le
    transit Tchad/RCA (convention CEMAC).*
  - **Inspection SGS (RVC)** requise si commande **≥ 2 000 000 XAF** (~3 300 $) ; **déclaration
    d'import** dès **≥ 1 000 000 XAF**.
  - **Tarif Extérieur Commun CEMAC** : 4 bandes — essentiels **5 %** · matières/équipement **10 %**
    · intermédiaires **20 %** · biens de conso **30 %** — + **TVA ~19,25 %** effective.
  - Dédouanement via **guichet unique GUCE** à Douala.
Sources : [trade.gov — Cameroon Customs](https://www.trade.gov/country-commercial-guides/cameroon-customs-regulations) ·
[WCO — Harmonized System](https://www.wcoomd.org/en/topics/nomenclature/overview/what-is-the-harmonized-system.aspx).

> **Pour nous (fort) :** trois fonctionnalités à haute valeur — (1) **consolidation** multi-
> fournisseurs avec **CBM par commande** roulé pour décider LCL/FCL (règle ~15 CBM intégrée) ;
> (2) **code HS par produit** → **estimateur de coût de revient** (bande CEMAC 5/10/20/30 % + TVA
> ~19,25 %) ; (3) **checklist conformité Douala** par expédition (BESC/ECTN avant chargement, SGS
> RVC si ≥ 2 M XAF, déclaration ≥ 1 M XAF). Ce sont des **hard blockers** qui bloquent la
> marchandise au port — donc à modéliser, pas à ignorer.

---

## Partie B — Étude de références (anti-réinvention)

### B.1 Anvyl → Sage Supply Chain Intelligence 🟢

Racheté par **Sage (annonce 01/10/2024)**, rebrandé. **Pas** un pivot « agent IA » (Anvyl IQ =
alertes/automatisation). Cœur : **le PO comme objet central** + **jalons de production** + annuaire
fournisseurs + **scorecards fournisseurs** + coffre documents + **messagerie in-app** liée au PO.
Cible : marques D2C/conso, SMB. Prix ~500-1500 $/mois.
Sources : [Sage acquires Anvyl (CPA Practice Advisor)](https://www.cpapracticeadvisor.com/2024/10/01/sage-acquires-supply-chain-technology-platform-anvyl/111246/) ·
[SelectHub — Anvyl](https://www.selecthub.com/p/supply-chain-visibility-software/anvyl/).

> **EMPRUNTER :** le **PO/mission comme colonne vertébrale** avec **timeline de jalons** (acompte →
> matières → en production → QC → prêt → expédié) ; **scorecards** (% à l'heure, % défauts,
> réactivité) ; **coffre documents par commande** ; **alertes proactives de jalon** (« le
> fournisseur a raté la date d'expédition convenue ») = l'automatisation au plus fort levier.
> **JETER :** intégrations ERP, profondeur catalogue SKU conso, le prix 500-1500 $.

### B.2 Flexport 🟢

Transitaire + douane + « control tower ». Historique mouvementé confirmé (Dave Clark CEO 2022 →
démission 09/2023, retour de Ryan Petersen ; rachat **de la techno** de Convoy seulement, pas du
passif ; ~20 % d'effectifs coupés).
Sources : [Wikipedia — Flexport](https://en.wikipedia.org/wiki/Flexport) ·
[Supply Chain Dive — Clark resigns](https://www.supplychaindive.com/news/flexport-ceo-dave-clark-resigns-founder-ryan-petersen-takes-over/692956/).

> **EMPRUNTER :** **uniquement** le concept de **« control tower »** — UN écran montrant le statut
> de toutes les missions actives d'un coup d'œil + suivi par jalons d'expédition (réservé → parti →
> arrivé → dédouané → livré). **JETER :** tout ce qui est métier de transitaire/courtier (on
> coordonne, on ne fait pas le fret) ; track-and-trace SKU, moteurs ML de routage. Flexport est un
> **overkill massif** comme produit à imiter — on n'en prend que la *métaphore de visibilité*.

### B.3 Alibaba.com (B2B) 🟢

**Correction :** le badge **« Gold Supplier » a disparu (sept. 2021)** → **« Verified Supplier »**
(membership payant + audit tiers : licence, adresse, capacités) **+ Trade Assurance** (escrow,
critères de litige **objectifs** : retard / non-conformité specs / quantité / dommage transit ;
fenêtre 30 j). **RFQ** = template structuré (specs/quantité/budget/délai) → devis concurrents sur
**une page comparative**.
Sources : [JingSourcing — fin du Gold Supplier](https://jingsourcing.com/b-alibaba-gold-supplier/) ·
[Alibaba — Trade Assurance Guide](https://seller.alibaba.com/blogs/2026/southeast-asia/b2b-trade/trade-assurance-complete-guide-alibaba-secure-payment).

> **EMPRUNTER :** (1) le **patron RFQ « feuille de comparaison »** (template specs → devis
> côte-à-côte) ; (2) un **annuaire fournisseur avec champ vérification + artefacts d'audit**
> (licence, photos/vidéo usine) — et **séparer le signal « confiance/audit » du signal
> « on-les-a-payés »** ; (3) **logique de paiement liée aux jalons** (libérer le solde seulement si
> expédié à temps + QC OK + B/L émis) ; (4) **garder toutes les comms dans un canal logué** lié à la
> commande (leçon « preuve » d'Alibaba) ; (5) **critères de litige objectifs** (à l'heure ? specs ?
> quantité ?) plutôt que des disputes qualité subjectives.
> **JETER :** marketplace ouverte, système de badge payant, tribunal d'arbitrage formel multi-étapes.

### B.4 Les analogues les plus proches : agences de sourcing à portail client 🟢🔴

Les vrais voisins de Bonzini ne sont ni Anvyl ni Flexport, mais les **agences de sourcing chinoises
tech-enabled à portail client** : **IMEX Sourcing** (« 360° Portal »), **Supplyia** (Yiwu : sourcing
+ order tracking + QC + entrepôt + shipping + **escrow**), **RunSourcing**, **EJET**, **DocShipper**,
**CJ**. (Existence 🟢 ; profondeur fonctionnelle 🔴 marketing.)
Source : [DDPChain — top sourcing agents](https://ddpchain.com/top-china-sourcing-agents/).

> **Dénominateur commun = NOTRE feature set MVP** : portail client + **suivi par commande/
> expédition** + **fiche fournisseur** + **rapport QC** + **coffre documents** + **paiement échelonné
> lié au QC**. C'est la preuve marché que ce qu'on construit existe et se vend à *exactement* notre
> niche. **EMPRUNTER** le modèle « portail agent » lui-même (le client voit le statut live de *sa*
> mission). **JETER** entrepôt/fulfillment, intégrations dropshipping, marketplace « trouver
> n'importe quel fournisseur ».

---

## Partie C — Playbook agent de sourcing & réalités comms/OCR

### C.1 Modèles de commission 🟢

| Modèle | Détail | Source |
|---|---|---|
| **% de la valeur de commande (FOB)** — dominant | **3-10 %**, **inverse à la taille** : ~8-10 % à 2 k$ → 5-7 % à 10 k$ → **3-4 % à 100 k$+**. <3 % = soupçon de **kickback** usine. | 🟢 (multi-sources) |
| **Markup / marge sur les biens** | L'agent source au prix usine, ajoute une marge, **cote un prix « tout compris »** ; le client **ne voit pas** le prix usine. Risques : « FX skimming » 2-3 %, gonflage du transport domestique. | 🟢 (markup) / 🔴 (tactiques cachées) |
| **Forfait** | ~**500-1000 $** pour identification+qualification fournisseur ; ~**100 $/jour + frais** pour accompagnement visite d'usine + traduction. | 🟢 |
| **Hybride / retainer** | Commission réduite (~2-3 %) + frais fixe par commande ; certains en mensuel. | 🟢 (hybride) / 🔴 (montants retainer) |

> **Pour nous (tu as choisi « agent à commission ») :** la **commission est un objet de premier rang
> configurable PAR COMMANDE**, pas un % global. Supporter : (a) % par paliers de valeur, (b) forfait,
> (c) **markup où le client ne voit que le prix tout-compris** → la plateforme stocke **et le coût
> usine et le prix client**, avec **visibilité par rôle** (le client ne voit pas forcément la marge —
> c'est ta Q6). (d) hybride. → Décision **C.1-bis** à trancher pour Phase 2 (voir §E refondu).

### C.2 Gestion des acomptes — LE point à valider 🔴

30/70 standard ; variante QC-gated 30/60/10. **Ce que la recherche n'a PAS pu trancher : l'agent
prend-il les fonds du client sur son propre compte et paie-t-il les fournisseurs pour son compte
(intermédiaire / escrow), ou se contente-t-il de faciliter/instruire ?** C'est **exactement** ma
question bloquante §E #2 — et c'est *le* pivot du modèle d'argent. Bonzini étant déjà un rail de
paiement, le modèle « agent dépositaire des fonds » est plausiblement ton wedge, **mais à confirmer
avec vous, pas à déduire.**

### C.3 Périmètre & fiche fournisseur 🟢

Périmètre type : **découverte/vetting → négociation (mandarin) → samples → QC → consolidation →
logistique**. Fiche fournisseur réelle : identité/légal (licence, **usine vs trading company**),
capacité (audit), commercial (**MOQ qui flexe par spec**, **lead time ~30-45 j après approbation
sample**), certifications (**vérifiées** sinon risque de saisie douane), historique qualité, contact
(souvent **le WeChat du commercial**).

> **Pour nous :** **MOQ et lead-time par PRODUIT, pas par fournisseur** (ils varient par spec).
> Vérification fournisseur = flag de premier rang (vérifié/non vérifié par claim — miroir du pattern
> KYC déjà dans `clients`). Distinguer **usine** et **trading company** (impacte le prix et la
> qualité).

### C.4 WeChat / communication — verdict 🟢 (confirme la position #7 de Phase 0)

| Canal | Réalité | Verdict 2-personnes |
|---|---|---|
| **WeChat perso** | **Aucune API officielle.** Automatiser = violation ToS §7.2(b)/(q), **ban**. Tencent a **durci en 2026** (anti-IA). | ❌ Mort-né |
| **Official Account** | API réelle **mais entité chinoise + ICP requis** ; et c'est le **mauvais outil** (messages tes *abonnés*, pas les fournisseurs). | ❌ Infaisable |
| **WeCom (企业微信)** | **Seul pont légitime** vers le WeChat perso, **mais** : le fournisseur doit **accepter (add-back)**, vérification d'entreprise requise, **human-in-the-loop**. Outbound **totalement automatisé = non établi**. | 🟡 Futur, humain-assisté |
| **WhatsApp Business Cloud API** | Sanctionné, **tarif par message** (depuis 07/2025), fenêtre service **24 h gratuite si le client écrit en premier**. **Bloqué en Chine (VPN).** | 🟡 Si le fournisseur l'utilise |
| **Telegram Bot API** | Gratuit, trivial à automatiser. **Bloqué par le Great Firewall (VPN).** | 🟡 Côté père (déjà branché), pas côté fournisseur |
Sources : [WeChat Acceptable Use Policy §7.2](https://www.wechat.com/en/acceptable_use_policy.html) ·
[WeCom — contacts externes](https://open.work.weixin.qq.com/help2/pc/18090) ·
[Meta — WhatsApp pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing) ·
[SCMP — Tencent durcit 2026](https://www.scmp.com/tech/article/3349696/tencent-moves-rein-ai-content-flood-wechat-stricter-rules).

> **Pour nous (décisif) :** **ne PAS construire « envoyer des messages WeChat depuis l'app »** —
> impasse légale/technique + risque de ban. Construire un **chemin de capture/ingestion sans
> friction** : screenshot / fichier / partage → OCR/parse → rattaché à la bonne commande+fournisseur
> horodaté. Optionnellement **WhatsApp Cloud API** comme vrai canal sanctionné pour les fournisseurs
> qui l'utilisent. La valeur de la plateforme = **système de référence + intelligence documentaire**,
> **pas** transport de chat. → **Valide ma position #7 avec sources dures.**

### C.5 OCR / extraction multilingue 🟢

- **LLM multimodal (Claude vision) = défaut pragmatique** : on envoie l'image facture/PI/packing/
  reçu T/T → **JSON structuré en un appel** (reconnaissance + extraction ensemble, pas de pipeline
  OCR à maintenir).
- **Coût (docs officiels Anthropic) : ~$0,005-0,02 par page** sur Claude (`tokens ≈ L×H/750`).
  Ex. page ~1,2 MP ≈ 1 568 tokens ≈ **~0,47 ¢** en entrée Sonnet 4.6.
- **Caveat argent :** les VLM peuvent mal lire les images basse qualité/pivotées/compressées →
  **confirmation humaine obligatoire sur les champs monétaires** (cohérent avec `isSafeInteger` + cap
  50 M XAF + cartes de confirmation existants).
- Alternatives offline/haut volume : **PaddleOCR**, **HunyuanOCR** (Tencent), Qianfan-OCR (Baidu).
Sources : [Anthropic — Vision](https://platform.claude.com/docs/en/build-with-claude/vision) ·
[Anthropic — Pricing](https://platform.claude.com/docs/en/about-claude/pricing).

> **Pour nous :** **multimodal LLM par défaut** pour extraire les champs des factures 中文 / mixtes.
> Sortie contrainte par un **schéma JSON strict par type de document**. **Champs monétaires →
> confirmation humaine en un tap** avant d'atteindre le ledger. Envoyer en **haute résolution / peu
> compressé** pour les factures chinoises denses, pré-redimensionner pour contrôler les tokens.
> Confirme la faisabilité de réactiver la vision de Mola (position Phase 0) **à coût négligeable**.

---

## Partie D — Synthèse orientée design (5 invariants empruntés)

1. **Le PO/mission est la colonne vertébrale.** Tous les produits étudiés orbitent autour d'un bon
   de commande avec **timeline de jalons + documents + lien fournisseur + messagerie**. À construire
   en premier.
2. **Deux signaux de confiance, séparés :** artefacts de vérification (audit/licence/photos) **vs**
   historique de performance (scorecards : % à l'heure, % défauts). Alibaba les confond (badge
   payant) — **nous, non.**
3. **Sécurité de l'argent = jalons, pas la foi.** Trade Assurance et les escrows des petites agences
   libèrent les fonds contre des **événements objectifs vérifiables**. À 3 M+ CNY/mission, encoder la
   libération acompte/solde contre **expédié-à-temps + QC-OK + B/L-émis**.
4. **Un écran « control tower »** pour toutes les missions actives (seule idée empruntable à Flexport).
5. **Loguer toutes les comms contre la commande** (leçon « preuve de litige » d'Alibaba) — via
   ingestion, pas via transport de chat.

**Briques métier que le domaine implique** (👉 *le design est en Phase 2, ici je ne fais que lister
les candidats* ) : Mission · Supplier (partagé, usine vs trading co, vérification) · Relation/Commande
(PO, Incoterm enum, % acompte) · Produit/SKU (MOQ + lead-time + code HS par produit) · SupplierPayment
(legs acompte/solde, T/T, lien rail ou attestation cash) · Commission/Marge (coût usine + prix client,
visibilité par rôle) · QC Inspection (type, AQL, pass/fail gate) · Production milestones · Document
(enum PI/PO/CI/Packing/QC/B-L/reçu) · Shipment (CBM, LCL/FCL, consolidation, **compliance Douala**) ·
Expense (frais de mission).

**Ce que la Phase 1 a fait à mes positions de Phase 0 :**
- **Position #2 (ingestion-first)** → **renforcée** : la recherche WeChat prouve que le transport de
  chat est une impasse ; la valeur EST l'ingestion. Cap.
- **Position #7 (WeChat hybride)** → **confirmée par sources dures** (ToS §7.2, WeCom consent-gated).
- **Vision/OCR** → **confirmée viable et bon marché** (~0,5-2 ¢/page) → réactiver la vision de Mola
  est un quick-win à coût négligeable.
- **Nouveau, sous-estimé en Phase 0 : la compliance CEMAC** (BESC/ECTN, SGS ≥2 M, bandes CET, GUCE)
  devient un **différenciateur produit** (estimateur de coût de revient + checklist Douala), pas un
  détail.
- **Nouveau pivot money model** : la **custody des fonds** (escrow vs facilitation) est LE point à
  trancher avant la Phase 2 (cf. §E #2, renforcé par C.2).

---

## Partie E — Questions à trancher pour ouvrir la Phase 2

> Les 5 faits métier du §E de Phase 0 **restent ouverts**. La Phase 1 en a affûté deux et en ajoute.
> J'ai besoin de ces réponses avant de modéliser les données.

**Faits métier (refondus) :**
1. **🔴 Structure de commission** (Q1 précisée par C.1) : % par paliers ? markup (prix tout-compris,
   marge cachée) ? forfait ? hybride ? — *quelle(s) forme(s) dois-je supporter ?*
2. **🔴 Custody des fonds** (LE pivot, C.2) : Bonzini **prend les fonds du client et paie les
   fournisseurs** (escrow/intermédiaire) — ou **facilite** seulement (le client/père paie en
   direct) ? Pour la mission mai 2026 concrètement : les acomptes ont-ils transité par le wallet
   Bonzini ou non ?
3. **🔴 Inventaire des pièces mai 2026** : combien de fournisseurs documentés, sous quelle forme
   (photos / PDFs / captures WeChat / rien d'écrit), en quelle langue ? *(dimensionne le catch-up
   Lot 1 + le pari OCR.)*
4. **🔴 Terrain du père** : Android/iPhone ? Data en usine ? Saisie pendant la visite ou le soir ?
   Telegram lui est-il accessible en Chine ?
5. **🔴 Utilisateurs & accès client** : père + toi seulement ? Le client a-t-il un **accès lecture à
   son reporting** (portail client, comme les agences B.4), ou tout passe par vous ?

**Nouvelles, issues du domaine :**
6. **🔴 Incoterm & logistique** : qui réserve le transitaire (vous ou le client) ? L'incoterm
   habituel est-il **FOB Chine** (vous gérez le maritime) ou **EXW/le client gère** ? Faut-il un
   **module expédition/consolidation** au MVP, ou d'abord le « 360° fournisseur/commande/paiement » ?
7. **🔴 QC** : Bonzini fait son QC en interne (le père) ou via tiers (SGS/QIMA) ? *(détermine la
   richesse du module QC.)*
8. **🔴 Compliance CEMAC au MVP** : l'estimateur de coût de revient (HS → droits) + checklist Douala
   sont-ils MVP, ou Phase ultérieure ? *(forte valeur, mais c'est ton arbitrage de priorité.)*

---

## Auto-contrôle Phase 1

- ✅ **Apprentissage fait, pas survolé** : cycle documentaire, paiements, Incoterms 2020 (à jour,
  « ship's rail » corrigé), AQL/ISO 2859-1 + types d'inspection, trade finance, LCL/FCL/CBM/HS,
  **compliance CEMAC** — tout **🟢 sourcé URL + date (07/06/2026)**.
- ✅ **Anti-réinvention** : Anvyl/Flexport/Alibaba + agences-portail étudiés ; **emprunter/jeter**
  explicites ; les analogues les plus proches identifiés (B.4).
- ✅ **Anti-hallucination domaine** : termes vérifiés (AQL, incoterms, BESC/ECTN) ; **2 erreurs
  propagées corrigées** (DDP droits ; « ship's rail »).
- ✅ **WeChat tranché sur sources dures** (pas une opinion) ; **OCR chiffré** (~0,5-2 ¢/page).
- ✅ **Persona père & cash & docs hétérogènes** : reliés (ingestion-first confirmé).
- ✅ **Coûts** : OCR chiffré ; postes lourds identifiés.
- ✅ **Pas de design** : seulement une liste de briques candidates pour la Phase 2.
- ⏳ **En attente** : réponses §E (1-8) → puis **Phase 2 (modèle conceptuel & entités)**.

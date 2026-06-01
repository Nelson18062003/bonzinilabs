# Phase 0 — Cadrage

> **Statut : rendu, en attente de validation.** Aucun audit codebase approfondi ici (c'est la
> Phase 1). Les éléments touchant à la codebase sont marqués **[supposé — CLAUDE.md]** et seront
> confirmés `fichier:ligne` en Phase 1.

---

## 1. Reformulation (le besoin, en 10 lignes)

On veut transformer la saisie du destinataire — aujourd'hui retapée à chaque paiement, donc lente
et source d'erreurs — en un **carnet de bénéficiaires réutilisables**, propre à chaque client.
Un bénéficiaire est **indissociable d'un mode de paiement** (Cash / Alipay / WeChat / Virement),
car les champs requis diffèrent radicalement d'un mode à l'autre. Au moment de payer, on peut :
**(a)** choisir un bénéficiaire existant, **(b)** en créer un nouveau (enregistré au passage),
ou **(c)** se payer soi-même. Le carnet est gérable hors flux de paiement (liste, ajout, édition,
suppression), sans limite de nombre. Chaque bénéficiaire porte un **alias en clair (latin)** —
indispensable car les infos réelles sont souvent en chinois et illisibles de mémoire. **L'admin**
doit voir et utiliser le carnet d'un client donné quand il paie pour son compte, et pouvoir y
ajouter un bénéficiaire. Contraintes : mobile-first CEMAC (réseau/data contraints), deux apps
(client + admin) sur un **backend Supabase partagé** [supposé — CLAUDE.md], caractères chinois à
gérer sérieusement, équipe et capital restreints (proportionner, ne pas sur-concevoir).

**Invariant fintech non négociable** : l'historique d'un paiement est immuable. Éditer ou
supprimer un bénéficiaire **ne doit jamais** modifier ce qu'affiche un paiement passé.

---

## 2. Les 8 questions de conception (recommandation argumentée pour chacune)

> Format par question : **Options → Reco → Pourquoi → Risque/limite**. Tu valides ou tu corriges.

### Q1 — Modèle de données : polymorphe, table-par-mode, ou base + spécialisées ?

- **Options.**
  (a) **Table unique polymorphe** `beneficiaries` : colonne `payment_method` + colonnes typées
  nullable par mode + noyau commun.
  (b) **Une table par mode** (`alipay_beneficiaries`, `wechat_…`, etc.).
  (c) **Table de base + tables spécialisées** (héritage par table).
  (d) **Base + `details JSONB`** pour les champs spécifiques au mode.
- **Reco : (a) table unique polymorphe, champs spécifiques en colonnes typées nullable**,
  intégrité garantie par **contraintes `CHECK` par mode** + **index uniques partiels**. Pas de
  JSONB pour les champs *requis*.
- **Pourquoi.** 4 modes seulement, stables → table-par-mode (b) multiplie par 4 les policies RLS,
  les requêtes et impose un `UNION` à 4 branches pour la vue admin « tous les bénéficiaires de ce
  client » : sur-ingénierie. (c) ajoute des jointures sans bénéfice à cette échelle. Le JSONB (d)
  est séduisant mais **interdit ce dont on a justement besoin** : `NOT NULL`/`CHECK` par mode
  (garantie « jamais incomplet »), index uniques par mode (dédoublonnage), requêtes/filtres admin.
  Avec des colonnes typées, on écrit par ex. `CHECK (payment_method <> 'alipay' OR alipay_account
  IS NOT NULL)` et `UNIQUE (client_id, alipay_account) WHERE payment_method='alipay'` — la base
  *refuse* un bénéficiaire incomplet ou en double. C'est l'option la plus alignée avec les règles.
- **Risque/limite.** Quelques colonnes nullable « éteintes » selon le mode (acceptable). Si un
  mode très exotique apparaît un jour, une colonne `extra JSONB` *facultative* sert d'exutoire —
  jamais pour les champs obligatoires.

### Q2 — Validation par mode : front, back, ou les deux ?

- **Reco : les deux, en couches, avec la base comme garde ultime.**
  1. **DB (garantie dure)** : `CHECK` + index uniques partiels → un bénéficiaire ne peut
     *physiquement pas* être persisté incomplet pour son mode, même si le client est buggé.
  2. **RPC `SECURITY DEFINER` (serveur)** : la création/édition passe par une fonction qui
     re-valide avant insert — on ne fait jamais confiance au client. (Cohérent avec le pattern
     maison « mutations sensibles via SECURITY DEFINER RPC » [supposé — database.md].)
  3. **Schéma partagé (UX)** : **une seule** spec par mode `{ mode → champs requis, regex, longueur
     max, libellés }`, définie une fois, qui pilote **et** le formulaire client **et** le
     formulaire admin (erreurs inline, bouton désactivé). DRY : pas deux validations divergentes.
- **Pourquoi.** « Jamais incomplet » est une règle dure → elle doit vivre en base, pas seulement
  dans un formulaire. Le schéma partagé évite la dérive client/admin et le coût de double
  maintenance.
- **À confirmer en Phase 1** : existe-t-il déjà une lib de validation (Zod ?) et un dossier
  `shared/` entre les deux apps [supposé partagé — CLAUDE.md].

### Q3 — « Cash » est-il un bénéficiaire ?

- **Reco : oui, le cash *peut* être enregistré, avec un jeu de champs minimal, mais
  l'enregistrement reste optionnel — comme pour tous les modes.**
- **Pourquoi.** Un contact de remise récurrent en Chine (la personne qui réceptionne à Guangzhou /
  Yiwu) **est** réutilisable : même nom, même téléphone, même point de remise → enregistrer sert
  le but premier (zéro ressaisie). Mais beaucoup de remises cash sont ponctuelles → on n'oblige
  pas. Donc **tous les modes** offrent le même triptyque : *réutiliser / créer-et-enregistrer /
  saisie ponctuelle non enregistrée*. Le cash n'est pas spécial dans sa nature de bénéficiaire ;
  il l'est seulement par son jeu de champs (léger) et par le fait que la relation « moi-même » n'a
  pas de sens (on ne se remet pas du cash à soi-même).
- **Risque/limite.** Pas de clé naturelle forte pour dédoublonner le cash (pas de n° de compte) →
  voir Q8 : on n'impose pas d'unicité sur le cash, on alerte juste sur un doublon probable
  (nom+téléphone).

### Q4 — Snapshot vs référence (LE piège fintech)

- **Reco : référence au moment du choix, *snapshot figé* à la création du paiement.**
  Le paiement stocke **une copie gelée** des infos du bénéficiaire telles qu'au moment où il est
  créé (mode, alias, nom réel, compte/banque… tous les champs pertinents), **plus** un lien
  facultatif `beneficiary_id` (nullable, `ON DELETE SET NULL`).
- **Conséquences (à respecter partout) :**
  - Un paiement **n'affiche jamais** les données *vivantes* du bénéficiaire ; il affiche **son
    snapshot**. Éditer/supprimer un bénéficiaire ensuite → **aucun** effet sur les paiements passés.
  - **Suppression = archivage logique** (`status='archived'`, `archived_at`), pas `DELETE`
    physique : le lien `beneficiary_id` survit pour l'analytique, et on ne peut pas orphéliner un
    paiement. Suppression physique réservée à un nettoyage admin si zéro référence.
  - Le snapshot est un blob **immuable, écrit une fois** → ici **JSONB est approprié**
    (`beneficiary_snapshot`), car on ne le valide pas / dédoublonne pas (contraste avec Q1).
  - **Paiement en cours (pending)** : le snapshot est pris à la création ; si le bénéficiaire est
    édité pendant qu'un paiement est *pending*, le paiement garde son snapshot (ce qui a été
    confirmé). On peut signaler à l'admin « ce bénéficiaire a été modifié après création du
    paiement ». → dépend du modèle d'états (question critique #5).
- **Pourquoi.** C'est l'invariant fintech : l'instruction exécutée est immuable, le carnet est
  mutable ; on les découple. Sans snapshot, corriger une faute de frappe sur un bénéficiaire
  réécrirait l'historique comptable — inacceptable.

### Q5 — Qui peut créer/modifier ? Visibilité ? Validation ?

- **Reco.**
  - **Client** : CRUD complet sur **ses** bénéficiaires.
  - **Admin** : peut créer/éditer un bénéficiaire **pour le compte d'**un client (exigé par le
    besoin admin). Ces bénéficiaires sont **immédiatement visibles** par le client (mêmes lignes,
    backend partagé, scoping par `client_id`) — pas de copie admin séparée.
  - **Pas de workflow d'approbation** (anti-over-engineering). Un bénéficiaire ne porte pas
    d'argent ; les garde-fous monétaires (plafond 50M XAF, `SELECT FOR UPDATE`…) vivent **au
    paiement**, pas à la création du carnet. Mettre une approbation multi-niveaux sur un carnet
    d'adresses serait exactement le « bancaire-grade » à proscrire.
  - **Traçabilité** : `created_by` + `created_by_role` (client | admin + quel admin) pour
    l'audit/reporting. Côté client, afficher « Ajouté par l'équipe Bonzini » si admin-créé (confiance).
- **À confirmer** : quelle permission admin gate l'écriture d'un bénéficiaire ? (`canManageUsers`
  est trop fort — c'est la création d'utilisateurs [supposé — security.md] ; il faut sans doute une
  permission « gérer un client » plus fine, ou aucune au-delà de l'accès au dossier client).

### Q6 — Relation au titulaire du compte

- **Reco : enum simple `relation_type` ∈ { `self` (« moi-même »), `supplier` (« fournisseur »),
  `other` (« autre ») }.** Métadonnée, n'altère pas les champs requis.
- **Pourquoi.** `self` sert l'UX (« me payer » en un geste) **et** le reporting/AML (alimenter son
  propre compte Chine ≠ payer un fournisseur : profils de risque distincts). Pas une entité
  séparée — un enum suffit. `self` peut être *suggéré* si le nom du titulaire correspond au nom KYC
  du client, sans l'imposer. Le cash est rarement `self`.

### Q7 — Caractères chinois (saisie / validation / affichage / encodage)

- **Encodage — [vérifié conceptuellement] :** PostgreSQL (donc Supabase) est **UTF-8 par défaut**
  et stocke nativement tout l'Unicode, y compris CJK et plans supplémentaires. **Le piège
  `utf8mb4` est spécifique à MySQL et n'existe pas ici.** → couche DB sûre par défaut. *À
  confirmer en Phase 1* : aucune colonne avec une collation/encodage exotique (improbable).
- **Saisie.** En CEMAC, l'utilisateur n'a souvent **pas** de clavier chinois. Donc :
  - **L'alias latin est OBLIGATOIRE** (c'est le « nom/pseudo facile à repérer » du besoin) — champ
    d'affichage principal partout. Non optionnel.
  - Les champs chinois (nom réel du titulaire, nom de banque) doivent **accepter le collage**
    (les fournisseurs envoient leurs coordonnées par WeChat/SMS), accepter chinois **ou**
    latin/pinyin, et **ne PAS sur-valider**.
- **Validation — le bug classique à éviter :** une regex type `^[A-Za-z ]+$` qui **rejette** `张伟`.
  On valide la **structure** (format de compte, téléphone), **pas le script** des noms. Pour un
  nom : non-vide + longueur raisonnable, scripts mixtes autorisés. **Longueurs en *nombre de
  caractères*, pas en octets** (un caractère CJK ≈ 3 octets en UTF-8).
- **Affichage.** Pile de polices incluant CJK (`system-ui` le couvre sur mobiles récents) ;
  ne jamais imposer une `font-family` qui *droppe* le CJK. Alias en évidence, détail chinois en
  secondaire. Troncature via CSS (`text-overflow: ellipsis`), jamais par découpe d'octets.
- **Copier-coller** sur les champs chinois côté admin : bouton « copier » pour coller à
  l'identique dans le portail bancaire/Alipay → réduit l'erreur de transcription, qui est tout
  l'enjeu de la fonctionnalité.

### Q8 — Doublons

- **Reco : empêcher les doublons exacts *par client* et *par mode*, via index unique partiel sur
  la clé naturelle**, et **UX de dédoublonnage doux** par-dessus.
  - Alipay : `UNIQUE (client_id, alipay_account) WHERE payment_method='alipay' AND status='active'`.
  - WeChat : sur l'identifiant WeChat / téléphone lié.
  - Virement : sur (n° de compte + banque).
  - Cash : **pas d'unicité dure** (pas de clé naturelle) → simple alerte « bénéficiaire similaire »
    (nom+téléphone).
  - `WHERE status='active'` → un bénéficiaire archivé ne bloque pas une recréation.
- **Scope = par client, jamais global.** Deux importateurs peuvent légitimement payer le **même**
  fournisseur ; et une unicité globale **fuiterait l'existence** d'un compte entre clients (vie
  privée). Cf. règle « pas de fuite cross-client ».
- **UX en cas de collision** : pas une erreur sèche, mais « Vous avez déjà un bénéficiaire avec ce
  compte Alipay : *<alias>*. L'utiliser ? » → contrainte dure dessous, expérience douce dessus.

---

## 3. Les 5 questions critiques restantes (j'ai besoin de tes réponses)

> Distinctes des 8 ci-dessus : ce ne sont pas des arbitrages que je *recommande*, ce sont des
> **inconnues métier** qui bloquent le design. La #1 est le vrai bloquant.

### QC1 — **Le schéma de champs exact par mode** (BLOQUANT)

Tu as laissé les listes de champs **vides** pour Cash / Alipay / WeChat / Virement. Voici mon
**strawman** (proposition à confirmer/corriger) basé sur la pratique des paiements vers la Chine.
Marque chaque champ : **requis / optionnel / à retirer**, et ajoute ce qui manque.

| Mode | Champ | Proposé | Note |
|------|-------|---------|------|
| **Tous** | `alias` (latin, repère) | **Requis** | Affichage principal. Jamais en chinois seul. |
| **Tous** | `relation_type` | **Requis** | self / supplier / other (cash : pas de self). |
| **Tous** | `note` (libre) | Optionnel | Point de RDV, contact WeChat, remarques. |
| **Cash** | `recipient_name` (récepteur, peut être CN) | **Requis** | |
| **Cash** | `phone` (contact remise) | **Requis** | |
| **Cash** | `pickup_city` (Guangzhou / Yiwu / Shenzhen…) | Requis ? | À trancher. |
| **Alipay** | `alipay_account` (téléphone **ou** email lié) | **Requis** | Clé de dédoublonnage. |
| **Alipay** | `holder_real_name` (nom réel, souvent CN) | **Requis** | Alipay vérifie le nom. |
| **WeChat** | `wechat_id` (ou téléphone lié) | **Requis** | Clé de dédoublonnage. |
| **WeChat** | `holder_real_name` (souvent CN) | **Requis** | Le transfert WeChat affiche le nom. |
| **Virement** | `holder_name` (bénéficiaire, souvent CN) | **Requis** | |
| **Virement** | `bank_name` (souvent CN, ex. 中国工商银行) | **Requis** | |
| **Virement** | `account_number` | **Requis** | Clé de dédoublonnage (avec banque). |
| **Virement** | `cnaps_code` (routage RMB domestique, 12 chiffres) | Requis ? | Selon corridor (cf. QC2). |
| **Virement** | `swift_bic` (cross-border) | Requis ? | Selon corridor (cf. QC2). |
| **Virement** | `branch` / `bank_address` | Optionnel | Certains virements l'exigent. |

→ **Question** : ce strawman est-il juste ? Quels champs requis/optionnels exacts par mode ?

### QC2 — **Corridor & devise**

Tous les paiements sont-ils **XAF (débit wallet client) → CNY (Chine)** ? Le bénéficiaire
porte-t-il une **devise**, ou CNY est-il implicite pour tout bénéficiaire Chine ? Un corridor
hors-Chine est-il prévu ? → Détermine si la devise vit sur le bénéficiaire ou sur le paiement, et
si pour le virement c'est **CNAPS** (RMB domestique) et/ou **SWIFT** (international) qui est requis.

### QC3 — **Portée du bénéficiaire : strictement privé, ou annuaire partagé ?**

Je recommande **strictement privé par client** (vie privée + simplicité). Mais comme l'admin crée
pour le client et que des fournisseurs sont **communs** à plusieurs importateurs, veux-tu un jour
un **annuaire de fournisseurs/banques curé par l'admin** pour pré-remplir ? → confirme : 100 %
privé (reco) ou besoin d'un référentiel partagé ?

### QC4 — **Conformité / contrôle sur le bénéficiaire**

Faut-il un **statut de vérification** (KYC/sanctions) ou des **plafonds par bénéficiaire** avant
qu'il puisse recevoir des fonds ? → Détermine s'il faut un champ `verification_status` au-delà de
`active/archived`. (Mon hypothèse : non pour le MVP, les contrôles restent au paiement.)

### QC5 — **Modèle d'états du paiement & édition pendant un paiement en cours**

Quels sont les **états** d'un paiement (draft → pending → executed → … ?) et la **politique** :
peut-on éditer/archiver un bénéficiaire **tant qu'un paiement qui le référence est en cours
(pending)** ? Je tiens le snapshot-à-la-création quoi qu'il arrive ; j'ai besoin du modèle d'états
pour finaliser le comportement (blocage d'édition ? simple alerte ?). *(Partiellement éclairable
en Phase 1, mais c'est avant tout une décision produit.)*

---

## 4. Ce que je fais ensuite (après ta validation)

1. Tu valides/corriges les **8 recos** et réponds aux **5 QC** (surtout **QC1**, sans quoi la
   modélisation reste théorique).
2. Je lance la **Phase 1 — audit codebase** (lecture seule) : je confirme `fichier:ligne` le
   backend partagé, le modèle actuel paiement↔destinataire, le flow de création (client + admin),
   les points d'extension, la dette bloquante, et je cherche le **code mort/tables vides/TODO/
   migrations abandonnées** liés à `beneficiary` / `payee` / `recipient`. Points d'entrée déjà
   repérés : `ANALYSE_MODULE_PAIEMENTS.md`, `SPECS_FORMULAIRE_PAIEMENT.md`,
   `PROMPT_NOUVEAU_PAIEMENT.md`, `docs/PAYMENT_REDESIGN.md`, `src/pages/NewPaymentPage.tsx`.

---

## Validations du porteur produit (reçues après rendu)

- **QC1** — Ne pas inventer le schéma : le **dériver des mini-formulaires de paiement existants**
  (un par mode). → fait en Phase 1 ; le schéma vit déjà dans la table `beneficiaries` + les forms.
- **QC3** — Jugée évidente : carnet **par client** (« seulement créé par le client »). → confirmé
  par le code (RLS `client_id`). Réglé.
- **QC4** — **Pas de conformité/KYC** sur le bénéficiaire. Réglé (pas de `verification_status`).
- **QC5** — Laissée à ma proposition. → faite en Phase 1 §7 (réutiliser les états existants ;
  édition carnet toujours permise grâce au snapshot ; archivage via `is_active`).
- **8 recos de conception** — pas d'objection spécifique ; considérées valides, à confronter au réel
  en Phase 1 (plusieurs sont **déjà** satisfaites par le code : Q1 table polymorphe, Q4 snapshot,
  Q5/Q8 scoping, Q7 encodage).

## Auto-contrôle Phase 0

- ✅ **Lecture seule respectée** : aucun code applicatif écrit ; seuls des fichiers de
  documentation créés (demandé par la persistance externe).
- ✅ **Pas de saut de phase** : aucun audit codebase approfondi (réservé Phase 1) ; aucune
  affirmation codebase non marquée **[supposé]** / **[à confirmer]**.
- ✅ **Règles dures traitées dans les recos** : snapshot (Q4), jamais-incomplet (Q1/Q2),
  caractères chinois (Q7), scoping anti-fuite (Q5/Q8), anti-over-engineering (Q5).
- ✅ **Format** : Markdown structuré, tableaux pour le strawman de champs et le dédoublonnage.
- ⏳ **En attente** : validation des 8 recos + réponses aux 5 QC (QC1 = bloquant).

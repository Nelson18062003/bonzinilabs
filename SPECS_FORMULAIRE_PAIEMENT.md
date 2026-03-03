# Spécifications Techniques — Module Formulaire de Paiement

**Projet :** Bonzini — Facilitation de paiements CEMAC → Chine
**Date :** Mars 2026
**Document :** Cahier des charges technique — Formulaire de déclaration de paiement
**Statut :** Validé — Prêt pour implémentation

---

## 1. CONTEXTE ET OBJECTIF

### 1.1 Situation actuelle

Le formulaire actuel de déclaration de paiement (admin et client) souffre de plusieurs problèmes : mauvaise hiérarchie visuelle, étapes mal structurées, absence de gestion des bénéficiaires par mode de paiement, pas de mode Cash complet, taux non dynamique, calendrier mal intégré, interface non responsive, et éléments qui se chevauchent.

### 1.2 Objectif

Refondre entièrement le formulaire multi-étapes pour les deux interfaces (admin et client) en intégrant le nouveau système de taux à 3 niveaux (mode × pays × tranche), la gestion complète des bénéficiaires par mode de paiement, le mode Cash avec son identité visuelle rouge, et une architecture responsive stricte.

### 1.3 Formule de calcul (rappel)

```
T_final = T_mode × (1 + c) × (1 + tₙ)
Montant_CNY = Montant_XAF × (T_final / 1 000 000)
```

Tranches : ≥ 1 000 000 XAF = 0% | 400 000 – 999 999 XAF = -1% | 10 000 – 399 999 XAF = -2%

Montant minimum : 10 000 XAF (validation frontend + backend).

---

## 2. ARCHITECTURE RESPONSIVE

### 2.1 Principe fondamental

Le formulaire utilise un flex container strict en 3 zones qui ne se chevauchent jamais :

```
┌──────────────────────┐
│   HEADER (fixe)      │  flexShrink: 0
│   Titre + Steps      │
├──────────────────────┤
│                      │
│   CONTENU (scroll)   │  flex: 1, overflowY: auto
│                      │
│                      │
├──────────────────────┤
│   FOOTER (fixe)      │  flexShrink: 0
│   Bouton action      │
└──────────────────────┘
```

Le conteneur principal fait `height: 100dvh` (gère correctement les barres d'adresse mobiles). Aucun `position: fixed`, aucun `z-index`, aucun chevauchement possible. Le bouton d'action est toujours visible et cliquable.

### 2.2 Règles CSS strictes

- Conteneur : `maxWidth: 430px`, `height: 100dvh`, `display: flex`, `flexDirection: column`, `overflow: hidden`
- Header : `flexShrink: 0`, `borderBottom`
- Contenu : `flex: 1`, `overflowY: auto`, `WebkitOverflowScrolling: touch`
- Footer : `flexShrink: 0`, `borderTop`, `padding-bottom: 24-28px` (safe area iOS)

---

## 3. MODES DE PAIEMENT

| Mode | Label | Description | Icône | Couleur | Couleur fond |
|------|-------|-------------|-------|---------|--------------|
| alipay | Alipay | Paiement via Alipay / QR code Alipay | 支 (serif) | #1677ff | bleu |
| wechat | WeChat Pay | Paiement via WeChat / QR code WeChat | 微 (serif) | #07c160 | vert |
| virement | Virement bancaire | Compte bancaire chinois | 🏦 | #8b5cf6 | violet |
| cash | Cash | Retrait en espèces / Retrait au bureau Bonzini | ¥ (serif) | #dc2626 | rouge |

**Règle fixe :** Le mode Cash doit TOUJOURS apparaître avec son logo ¥ sur fond rouge (#dc2626), partout dans l'application (formulaire, fiche paiement, liste, résumé, PDF).

---

## 4. MODÈLE DE DONNÉES — BÉNÉFICIAIRES

### 4.1 Table `beneficiaries`

| Champ | Type | Description |
|-------|------|-------------|
| id | UUID / Auto-increment | Identifiant unique |
| client_id | UUID | Référence vers le client propriétaire |
| payment_method | ENUM('alipay', 'wechat', 'virement', 'cash') | Mode de paiement associé |
| name | VARCHAR(255) | Nom complet du bénéficiaire |
| identifier | VARCHAR(255) | Identifiant principal (ID Alipay/WeChat, téléphone, email) |
| identifier_type | ENUM('qr', 'id', 'phone', 'email') | Type d'identifiant (Alipay/WeChat/Cash) |
| phone | VARCHAR(50) | Numéro de téléphone (Cash) |
| email | VARCHAR(255) | Email (optionnel) |
| bank_name | VARCHAR(255) | Nom de la banque (Virement) |
| bank_account | VARCHAR(255) | Numéro de compte (Virement) |
| bank_extra | TEXT | Informations complémentaires (SWIFT, branche, etc.) |
| qr_code_url | VARCHAR(500) | URL du QR code uploadé |
| is_active | BOOLEAN | Actif ou archivé |
| created_at | TIMESTAMP | Date de création |
| updated_at | TIMESTAMP | Date de dernière modification |

### 4.2 Table `payments` (champs ajoutés/modifiés)

| Champ | Type | Description |
|-------|------|-------------|
| id | UUID | Identifiant unique |
| client_id | UUID | Client |
| payment_method | ENUM | Mode de paiement |
| amount_xaf | BIGINT | Montant débité en XAF |
| amount_cny | DECIMAL(12,2) | Montant à payer en CNY |
| rate_applied | INTEGER | Taux final appliqué (CNY pour 1M XAF) |
| rate_is_custom | BOOLEAN | TRUE si taux personnalisé (admin uniquement) |
| beneficiary_id | UUID / NULL | Référence bénéficiaire (NULL si pas encore renseigné) |
| beneficiary_name | VARCHAR(255) / NULL | Nom du bénéficiaire (snapshot) |
| beneficiary_details | JSON / NULL | Détails bénéficiaire au moment du paiement (snapshot) |
| qr_code_url | VARCHAR(500) / NULL | QR code généré pour ce paiement |
| notes | TEXT | Notes/instructions internes (admin) |
| payment_date | DATE | Date du paiement |
| status | ENUM('pending', 'processing', 'completed', 'cancelled') | Statut |
| created_at | TIMESTAMP | Date de création |
| created_by | UUID | Créateur (admin ou client) |

**Règle métier :** Le bénéficiaire n'est PAS obligatoire à la création du paiement. Il peut être complété plus tard dans la fiche de paiement.

---

## 5. API ENDPOINTS

### 5.1 Admin

**POST /api/admin/payments** — Créer un paiement

```json
// Request
{
  "client_id": "uuid",
  "payment_method": "alipay",
  "amount_xaf": 500000,
  "amount_cny": 5825.00,
  "rate_applied": 11650,
  "rate_is_custom": false,
  "beneficiary_id": "uuid | null",
  "beneficiary_snapshot": {
    "name": "Zhang Wei",
    "identifier": "zhangwei@alipay.cn",
    "type": "email"
  },
  "notes": "Instructions internes",
  "payment_date": "2026-03-03"
}

// Response 201
{
  "id": "uuid",
  "status": "pending",
  "qr_code_url": "https://...",
  "created_at": "2026-03-03T14:30:00Z"
}
```

**GET /api/admin/payments/:id** — Fiche de paiement (inclut QR code)

**PUT /api/admin/payments/:id/beneficiary** — Compléter le bénéficiaire après création

```json
// Request
{
  "beneficiary_id": "uuid",
  "beneficiary_snapshot": {
    "name": "Zhang Wei",
    "identifier": "zhangwei@alipay.cn"
  }
}
```

### 5.2 Client

**POST /api/client/payments** — Créer un paiement (côté client)

```json
// Request
{
  "payment_method": "alipay",
  "amount_xaf": 100000,
  "beneficiary": {
    "mode": "existing",
    "beneficiary_id": "uuid"
  }
}

// OU (nouveau bénéficiaire)
{
  "payment_method": "alipay",
  "amount_xaf": 100000,
  "beneficiary": {
    "mode": "new",
    "name": "Li Ming",
    "identifier": "138****5678",
    "identifier_type": "phone",
    "email": null
  }
}

// OU (sans bénéficiaire — compléter plus tard)
{
  "payment_method": "alipay",
  "amount_xaf": 100000,
  "beneficiary": null
}
```

**GET /api/client/beneficiaries?method=alipay** — Liste des bénéficiaires enregistrés

```json
// Response
{
  "beneficiaries": [
    {
      "id": "uuid",
      "name": "Zhang Wei",
      "identifier": "zhangwei@alipay.cn",
      "identifier_type": "email",
      "payment_method": "alipay"
    }
  ]
}
```

**POST /api/client/beneficiaries** — Enregistrer un nouveau bénéficiaire

**GET /api/client/payments/:id** — Fiche paiement (avec QR code)

---

## 6. FORMULAIRE ADMIN — 5 ÉTAPES

**Thème :** Dark (#0c0e18 fond, #fff texte, #7c3aed violet principal)

### 6.1 Structure des étapes

| Étape | Nom affiché | Description |
|-------|-------------|-------------|
| 1 | Client | Sélection du client |
| 2 | Mode | Choix du mode de paiement |
| 3 | Montant | Montant + taux personnalisé + date + notes |
| 4 | Bénéficiaire | Gestion du bénéficiaire selon le mode |
| 5 | Résumé | Récapitulatif avant confirmation |

Les noms des étapes doivent être affichés sous chaque barre de progression.

### 6.2 Étape 1 — Client

- Titre : "Sélectionner un client"
- Barre de recherche par nom ou téléphone
- Liste de clients : avatar (initiales colorées) + nom + téléphone + solde XAF
- Sélection avec bordure violette + checkmark

### 6.3 Étape 2 — Mode

- Titre : "Mode de paiement"
- Sous-titre : "Comment le bénéficiaire recevra les fonds ?"
- 4 cartes : icône (fond coloré) + nom + description
- Sélection avec bordure couleur du mode + checkmark couleur du mode
- PAS de taux affiché à cette étape

### 6.4 Étape 3 — Montant

- Titre : "Montant du paiement"
- Sous-titre avec solde client
- Bloc de saisie :
  - Label "Vous envoyez" + input grand + "XAF" collé au montant
  - Séparateur
  - Label "Bénéficiaire reçoit" + montant calculé en couleur du mode (¥ sans "RMB" redondant)
  - Le taux appliqué apparaît UNIQUEMENT quand le montant ≥ 10 000 XAF
  - Pas de libellés "Petit montant" / "Taux standard" / "Meilleur taux"
- Boutons rapides : 100K, 250K, 500K, 1M
- Toggle "Taux personnalisé" : quand activé, champ de saisie du taux custom (CNY pour 1M XAF)
- Date du paiement : 3 boutons (Aujourd'hui, Hier, Autre) + date picker natif si "Autre"
- Notes / instructions : textarea

**Calcul dynamique :** Le taux se recalcule à chaque changement de montant en appliquant la formule T_final = T_mode × (1 + tₙ) avec la tranche correspondante. L'ajustement pays est appliqué automatiquement depuis le profil du client.

### 6.5 Étape 4 — Bénéficiaire

- Titre : "Bénéficiaire"
- Option "Passer cette étape" en haut (checkbox orange) avec texte "Compléter plus tard dans la fiche"

**Logique par mode :**

**Cash :**
- Toggle Existant / Nouveau
- Existant : liste des bénéficiaires Cash enregistrés (icône ¥ rouge)
- Nouveau : choix "Le client lui-même" ou "Autre personne"
  - Si autre : nom complet (obligatoire), téléphone (obligatoire), email (optionnel)

**Alipay / WeChat :**
- Toggle Existant / Nouveau
- Existant : liste des bénéficiaires Alipay ou WeChat enregistrés (icône + couleur du mode)
- Nouveau : nom (obligatoire) + choix méthode d'identification :
  - 4 boutons : QR Code | ID Alipay/WeChat | Email | Téléphone
  - Si QR Code : zone upload dashed
  - Sinon : champ de saisie de l'identifiant

**Virement :**
- Toggle Existant / Nouveau
- Existant : liste des comptes bancaires enregistrés
- Nouveau : nom du titulaire + nom de la banque + numéro de compte + infos complémentaires (optionnel)

### 6.6 Étape 5 — Résumé

- Titre : "Récapitulatif"
- Carte client : initiales + nom + téléphone + solde après
- Carte montants (fond teinté couleur mode) : montant débité XAF + montant à payer CNY + taux appliqué
- Carte mode de paiement : icône + nom + description
- Carte bénéficiaire : infos ou "À compléter dans la fiche" (badge orange)
- Carte date
- Carte notes (si renseignées)
- PAS de QR code dans le récapitulatif (il est généré après création dans la fiche)

### 6.7 Animation de succès

Après confirmation, écran plein avec :
- Fond #0c0e18 avec animation fadeIn
- Cercle vert (#10b981) animé scaleIn avec pulse ring
- Checkmark SVG animé (stroke-dashoffset)
- Texte "Paiement créé" + montant + mode + client en slideUp
- Bouton "Nouveau paiement" (reset complet)
- Bouton "Voir la fiche de paiement"

---

## 7. FORMULAIRE CLIENT — 4 ÉTAPES

**Thème :** Light (#f5f5f7 fond, #1a1a2e texte, #7c3aed violet principal)
**Header :** Logo Bonzini + "BONZINI" + icône notifications

### 7.1 Structure des étapes

| Étape | Nom affiché | Description |
|-------|-------------|-------------|
| 1 | Mode | Choix du mode de paiement |
| 2 | Montant | Saisie bidirectionnelle + montants rapides |
| 3 | Bénéficiaire | Existant ou nouveau |
| 4 | Résumé | Récapitulatif avant confirmation |

Pas d'étape Client (c'est le client connecté lui-même).
Les noms des étapes doivent être affichés sous chaque barre de progression.

### 7.2 Étape 1 — Mode

- Titre : "Comment votre bénéficiaire souhaite recevoir ?"
- 4 cartes identiques à l'admin (icône + nom + description)
- PAS de taux affiché

### 7.3 Étape 2 — Montant

- Titre : "Montant à envoyer"
- Sous-titre : solde disponible

**Saisie bidirectionnelle :**
- Toggle "Par XAF / Par RMB" en haut
- Carte gradient violet (#7c3aed → #a855f7) contenant :
  - Si "Par XAF" : input XAF en haut → CNY calculé en bas (¥ sans "RMB")
  - Si "Par RMB" : input ¥ en haut → XAF calculé en bas
  - Séparateur avec icône ⇅
  - Le symbole de la devise est collé au montant

**Boutons rapides adaptatifs :**
- Par XAF : 100K, 250K, 500K, 1M
- Par RMB : ¥1 000, ¥2 500, ¥5 000, ¥10 000

**Taux :** Affiché dans une carte sous les boutons rapides, UNIQUEMENT quand le montant est valide (≥ 10 000 XAF). Montre l'icône du mode + taux.

**Validations :**
- Montant minimum 10 000 XAF
- Solde insuffisant

### 7.4 Étape 3 — Bénéficiaire

- Titre : "Bénéficiaire"
- Sous-titre explicatif : "Ces informations permettent à Bonzini d'effectuer le paiement. Vous pouvez les compléter plus tard."

**Toggle Existant / Nouveau** (tous les modes, y compris Cash)

**Existant :** Liste des bénéficiaires enregistrés filtrés par mode de paiement. Icône du mode + nom + identifiant. Sélection avec bordure couleur du mode.

**Nouveau selon le mode :**

**Alipay / WeChat :**
- Zone upload QR code dashed avec texte "Ajouter le QR code [Alipay/WeChat]"
- Séparateur "OU RENSEIGNEZ LES INFOS"
- Champs : Nom du bénéficiaire + Téléphone / ID [mode] + Email (optionnel)

**Virement :**
- Champs : Nom du titulaire + Nom de la banque + Numéro de compte

**Cash :**
- Champs : Nom complet + Numéro de téléphone + Email (optionnel)

**Notes optionnelles** en bas de tous les modes.

**Bouton footer :** "Continuer avec ces informations"
**Lien sous le bouton :** "Ajouter plus tard" (skip → vide le formulaire bénéficiaire et passe au résumé)

### 7.5 Étape 4 — Résumé

- Titre : "Récapitulatif"
- Carte hero centrée : icône mode + "Vous envoyez" + montant ¥ coloré + (montant XAF)
- Tableau détails (lignes sur fond blanc) :
  - Méthode : [nom du mode]
  - Taux appliqué : 1M XAF = ¥ [taux]
  - Séparateur
  - Montant débité : [XAF] (bold)
  - Nouveau solde : [XAF]
- Carte bénéficiaire : infos ou avertissement jaune "Vous pourrez ajouter les informations du bénéficiaire après la création."
- PAS de QR code

### 7.6 Animation de succès

- Toast vert en haut : icône ✓ + "Paiement créé avec succès"
- Header : "Succès"
- Centre : cercle vert + checkmark animé + "Paiement créé !" + montant ¥ coloré + XAF débités
- Boutons : "Voir le paiement" + "Mes paiements" + "Retour à l'accueil"

---

## 8. QR CODE

### 8.1 Génération

Le QR code est généré côté backend au moment de la création du paiement (POST). Il encode les informations de la transaction (ID paiement, montant, mode).

### 8.2 Affichage

Le QR code doit apparaître dans :
- La fiche de paiement côté admin
- La fiche de paiement côté client
- Le relevé PDF téléchargeable

Il ne doit PAS apparaître dans le récapitulatif du formulaire (étape résumé).

### 8.3 Cohérence visuelle

- Fond blanc, coins arrondis
- Taille minimale : 160×160px sur mobile
- Label en dessous indiquant le mode de paiement

---

## 9. STACK TECHNIQUE

| Composant | Technologie |
|-----------|------------|
| Framework | React + TypeScript |
| Styling | Tailwind CSS |
| Composants UI | shadcn/ui (Button, Input, Card, Tabs, Select, Badge) |
| Icônes | Lucide React |
| Couleur principale | #7c3aed (violet) |
| Couleur Cash | #dc2626 (rouge) |
| Couleur Alipay | #1677ff (bleu) |
| Couleur WeChat | #07c160 (vert) |
| Couleur Virement | #8b5cf6 (violet clair) |
| Thème admin | Dark (#0c0e18) |
| Thème client | Light (#f5f5f7) |

---

## 10. CAS DE TEST

### 10.1 Calcul de taux

| # | Mode | Montant XAF | Tranche | T_mode | T_final | CNY attendu |
|---|------|-------------|---------|--------|---------|-------------|
| 1 | Cash | 1 000 000 | ≥1M (0%) | 11 800 | 11 800 | 11 800,00 |
| 2 | Cash | 500 000 | 400K-999K (-1%) | 11 800 | 11 682 | 5 841,00 |
| 3 | Cash | 100 000 | 10K-399K (-2%) | 11 800 | 11 564 | 1 156,40 |
| 4 | Alipay | 1 000 000 | ≥1M (0%) | 11 650 | 11 650 | 11 650,00 |
| 5 | Alipay | 250 000 | 10K-399K (-2%) | 11 650 | 11 417 | 2 854,25 |
| 6 | WeChat | 500 000 | 400K-999K (-1%) | 11 700 | 11 583 | 5 791,50 |
| 7 | Virement | 2 000 000 | ≥1M (0%) | 11 750 | 11 750 | 23 500,00 |

### 10.2 Scénarios fonctionnels

| # | Scénario | Résultat attendu |
|---|----------|-----------------|
| 1 | Créer paiement Cash sans bénéficiaire | Paiement créé, bénéficiaire = null, statut "pending" |
| 2 | Créer paiement Alipay avec bénéficiaire existant | Paiement créé, beneficiary_id renseigné, snapshot sauvegardé |
| 3 | Créer paiement WeChat avec nouveau bénéficiaire QR | Bénéficiaire créé en base, QR code uploadé, paiement lié |
| 4 | Créer paiement Virement avec nouveau compte | Bénéficiaire créé avec infos bancaires, paiement lié |
| 5 | Saisie montant < 10 000 XAF | Bouton "Continuer" désactivé, message d'erreur |
| 6 | Saisie montant > solde client | Bouton "Continuer" désactivé, message "Solde insuffisant" |
| 7 | Admin : taux personnalisé activé | Le taux custom remplace le taux système, flag rate_is_custom = true |
| 8 | Client : saisie par RMB | Conversion inverse correcte, XAF calculé, taux affiché |
| 9 | Skip bénéficiaire + confirmer | Paiement créé, résumé affiche "À compléter", bénéficiaire null en base |

---

## 11. MAQUETTES DE RÉFÉRENCE

Les fichiers suivants sont des prototypes React fonctionnels. Ils doivent être rendus dans un navigateur pour voir le résultat attendu.

| Fichier | Description |
|---------|-------------|
| `maquette_admin_paiement.jsx` | Formulaire admin 5 étapes (dark theme) |
| `maquette_client_paiement.jsx` | Formulaire client 4 étapes (light theme) |

Ces maquettes sont la référence visuelle. L'implémentation finale doit reproduire fidèlement la disposition, les interactions et le design de ces maquettes.

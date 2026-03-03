# Spécifications Techniques — Refonte du Module de Gestion des Taux

**Projet :** Bonzini — Facilitation de paiements CEMAC → Chine
**Date :** Mars 2026
**Document :** Cahier des charges technique pour développement
**Statut :** Validé — Prêt pour implémentation

---

## 1. CONTEXTE ET OBJECTIF

### 1.1 Situation actuelle

L'application Bonzini (admin + client) gère actuellement un **taux unique** défini quotidiennement par l'administrateur. Ce taux est stocké en base de données, affiché dans un graphique d'évolution, et visible par les clients sur l'application mobile.

**Problème :** La réalité opérationnelle impose des taux différents selon trois paramètres (mode de paiement, pays, montant). Ces ajustements sont aujourd'hui gérés manuellement en dehors de la plateforme.

### 1.2 Objectif

Remplacer le système à taux unique par un système à **trois niveaux de granularité** :

1. **Mode de paiement** → taux de base défini manuellement chaque jour (4 taux)
2. **Pays du client** → ajustement en pourcentage fixe
3. **Tranche de montant** → ajustement en pourcentage fixe

### 1.3 Formule de calcul

```
T_final = T_mode × (1 + c) × (1 + tₙ)
```

Où :
- `T_mode` = taux de base du mode de paiement (défini chaque jour, exprimé en CNY pour 1 000 000 XAF)
- `c` = pourcentage d'ajustement pays (décimal, ex: -0.015 pour -1.5%)
- `tₙ` = pourcentage d'ajustement tranche de montant (décimal, ex: -0.02 pour -2%)

**Montant reçu par le client :**
```
Montant_CNY = Montant_XAF × (T_final / 1 000 000)
```

---

## 2. MODÈLE DE DONNÉES

### 2.1 Table `daily_rates` (remplace l'ancien taux unique)

| Champ | Type | Description |
|-------|------|-------------|
| id | UUID / Auto-increment | Identifiant unique |
| rate_cash | INTEGER | Taux de base Cash (CNY pour 1M XAF), ex: 11800 |
| rate_alipay | INTEGER | Taux de base Alipay |
| rate_wechat | INTEGER | Taux de base WeChat |
| rate_virement | INTEGER | Taux de base Virement bancaire |
| effective_at | TIMESTAMP | Date et heure d'effet |
| created_at | TIMESTAMP | Date de création |
| created_by | UUID | Admin qui a créé l'entrée |
| is_active | BOOLEAN | TRUE si c'est le taux en vigueur |

**Règle métier :** Quand un nouveau jeu de taux est créé, l'ancien `is_active` passe à FALSE et le nouveau à TRUE. Un seul enregistrement actif à la fois.

### 2.2 Table `rate_adjustments` (configuration fixe)

| Champ | Type | Description |
|-------|------|-------------|
| id | UUID / Auto-increment | Identifiant unique |
| type | ENUM('country', 'tier') | Type d'ajustement |
| key | VARCHAR | Identifiant (ex: 'gabon', 't2') |
| label | VARCHAR | Libellé affiché (ex: 'Gabon', '400K–999K') |
| percentage | DECIMAL(5,2) | Pourcentage d'ajustement (ex: -1.50) |
| is_reference | BOOLEAN | TRUE si c'est la valeur de référence (0%) |
| sort_order | INTEGER | Ordre d'affichage |
| updated_at | TIMESTAMP | Dernière modification |
| updated_by | UUID | Admin qui a modifié |

**Données initiales à insérer :**

```sql
-- Pays
INSERT INTO rate_adjustments (type, key, label, percentage, is_reference, sort_order) VALUES
('country', 'cameroun', 'Cameroun', 0.00, TRUE, 1),
('country', 'gabon', 'Gabon', -1.50, FALSE, 2),
('country', 'tchad', 'Tchad', -1.50, FALSE, 3),
('country', 'rca', 'Centrafrique', -1.50, FALSE, 4),
('country', 'congo', 'Congo', -1.50, FALSE, 5),
('country', 'guinee', 'Guinée Équatoriale', -1.50, FALSE, 6);

-- Tranches de montant
INSERT INTO rate_adjustments (type, key, label, percentage, is_reference, sort_order) VALUES
('tier', 't3', '≥ 1 000 000 XAF', 0.00, TRUE, 1),
('tier', 't2', '400 000 – 999 999 XAF', -1.00, FALSE, 2),
('tier', 't1', '10 000 – 399 999 XAF', -2.00, FALSE, 3);
```

### 2.3 Fonction de calcul (côté backend)

```javascript
function calculateFinalRate(paymentMethod, countryKey, amountXAF) {
  // 1. Récupérer le taux de base actif pour le mode de paiement
  const activeRates = getActiveRates(); // depuis daily_rates WHERE is_active = TRUE
  const baseRate = activeRates[`rate_${paymentMethod}`];

  // 2. Récupérer l'ajustement pays
  const countryAdj = getAdjustment('country', countryKey); // depuis rate_adjustments
  const c = countryAdj.percentage / 100;

  // 3. Déterminer la tranche et récupérer l'ajustement
  let tierKey;
  if (amountXAF >= 1000000) tierKey = 't3';
  else if (amountXAF >= 400000) tierKey = 't2';
  else tierKey = 't1';

  const tierAdj = getAdjustment('tier', tierKey);
  const t = tierAdj.percentage / 100;

  // 4. Calculer le taux final
  const finalRate = baseRate * (1 + c) * (1 + t);

  // 5. Calculer le montant CNY
  const amountCNY = amountXAF * (finalRate / 1000000);

  return {
    baseRate,
    countryAdjustment: countryAdj.percentage,
    tierAdjustment: tierAdj.percentage,
    tierKey,
    finalRate: Math.round(finalRate * 100) / 100,
    amountCNY: Math.round(amountCNY * 100) / 100,
  };
}
```

### 2.4 Montant minimum

Aucun paiement n'est accepté en dessous de **10 000 XAF**. Valider côté frontend ET backend.

---

## 3. API ENDPOINTS

### 3.1 Admin — Taux quotidiens

**POST /api/admin/rates**
Créer un nouveau jeu de taux.

```json
// Request
{
  "rate_cash": 11800,
  "rate_alipay": 11650,
  "rate_wechat": 11700,
  "rate_virement": 11750,
  "effective_at": "2026-03-03T08:00:00Z"
}

// Response 201
{
  "id": "uuid",
  "rate_cash": 11800,
  "rate_alipay": 11650,
  "rate_wechat": 11700,
  "rate_virement": 11750,
  "effective_at": "2026-03-03T08:00:00Z",
  "is_active": true,
  "created_at": "2026-03-03T07:55:00Z"
}
```

**GET /api/admin/rates**
Historique des taux (paginé).

```json
// Response 200
{
  "data": [
    {
      "id": "uuid",
      "rate_cash": 11800,
      "rate_alipay": 11650,
      "rate_wechat": 11700,
      "rate_virement": 11750,
      "effective_at": "2026-03-03T08:00:00Z",
      "is_active": true,
      "change_percent": "+0.4%"
    }
  ],
  "pagination": { "page": 1, "total": 45 }
}
```

**GET /api/admin/rates/chart?period=30d**
Données pour le graphique admin (multi-courbes).

```json
// Response 200
{
  "period": "30d",
  "data": [
    { "date": "2026-02-01", "cash": 11520, "alipay": 11370, "wechat": 11420, "virement": 11470 },
    { "date": "2026-02-03", "cash": 11480, "alipay": 11330, "wechat": 11380, "virement": 11430 }
  ],
  "stats": {
    "cash": { "min": 11480, "max": 11800, "avg": 11650 }
  }
}
```

### 3.2 Admin — Configuration des ajustements

**GET /api/admin/adjustments**
Récupérer tous les ajustements.

```json
// Response 200
{
  "countries": [
    { "key": "cameroun", "label": "Cameroun", "percentage": 0, "is_reference": true },
    { "key": "gabon", "label": "Gabon", "percentage": -1.5, "is_reference": false }
  ],
  "tiers": [
    { "key": "t3", "label": "≥ 1 000 000 XAF", "percentage": 0, "is_reference": true },
    { "key": "t2", "label": "400 000 – 999 999 XAF", "percentage": -1, "is_reference": false },
    { "key": "t1", "label": "10 000 – 399 999 XAF", "percentage": -2, "is_reference": false }
  ]
}
```

**PUT /api/admin/adjustments/:id**
Modifier un ajustement.

```json
// Request
{ "percentage": -2.0 }

// Response 200
{ "key": "gabon", "label": "Gabon", "percentage": -2.0, "updated_at": "..." }
```

### 3.3 Client — Taux et calcul

**GET /api/client/rates**
Récupérer les taux actuels pour le client. Retourne les taux de base par mode et les ajustements applicables.

```json
// Response 200
{
  "rates": {
    "cash": 11800,
    "alipay": 11650,
    "wechat": 11700,
    "virement": 11750
  },
  "countries": [
    { "key": "cameroun", "label": "Cameroun", "flag": "🇨🇲", "percentage": 0 },
    { "key": "gabon", "label": "Gabon", "flag": "🇬🇦", "percentage": -1.5 }
  ],
  "tiers": [
    { "key": "t3", "min": 1000000, "max": null, "percentage": 0 },
    { "key": "t2", "min": 400000, "max": 999999, "percentage": -1 },
    { "key": "t1", "min": 10000, "max": 399999, "percentage": -2 }
  ],
  "updated_at": "2026-03-02T07:23:00Z",
  "change_30d": "+0.4%"
}
```

**GET /api/client/rates/chart?period=30d**
Données graphique client (courbe unique = taux Cash Cameroun comme référence).

```json
// Response 200
{
  "data": [
    { "date": "2026-02-01", "rate": 11520 },
    { "date": "2026-02-03", "rate": 11480 }
  ],
  "stats": { "min": 11480, "max": 11800, "avg": 11650 }
}
```

**POST /api/client/calculate**
Calculer le taux final pour une transaction spécifique (utilisé lors de la soumission d'un paiement).

```json
// Request
{
  "amount_xaf": 500000,
  "payment_method": "alipay",
  "country": "gabon"
}

// Response 200
{
  "amount_xaf": 500000,
  "amount_cny": 5192.67,
  "base_rate": 11650,
  "final_rate": 10385.35,
  "country_adjustment": -1.5,
  "tier_adjustment": -1,
  "tier": "t2",
  "rate_id": "uuid"
}
```

---

## 4. INTERFACE ADMIN — SPÉCIFICATIONS ÉCRAN PAR ÉCRAN

### 4.1 Structure de navigation

L'écran "Taux de change" admin contient **3 onglets principaux** :

```
[📊 Taux]  [⚙️ Config]  [🧮 Simuler]
```

L'onglet "Taux" contient **3 sous-onglets** :

```
[Définir]  [Graphique]  [Historique]
```

Le bouton "+" en haut à droite du header est un **raccourci** qui ramène directement à Taux → Définir, depuis n'importe quel écran.

### 4.2 Onglet Taux → Définir

**Objectif :** L'admin saisit les 4 taux de base du jour.

**Composants :**

1. **Toggle direction** — Deux boutons : "1 CNY → XAF" et "1M XAF → CNY". Change le sens de saisie. Par défaut : "1M XAF → CNY".

2. **4 champs de saisie** — Un par mode de paiement, disposés en liste verticale. Chaque ligne contient :
   - Icône + nom du mode (à gauche)
   - Sous-libellé "CNY / 1M XAF" (à gauche, sous le nom)
   - Champ input numérique (à droite, aligné à droite)

   Ordre : Cash, Alipay, WeChat, Virement.

3. **Bloc de vérification** — Encadré avec fond coloré clair. Titre : "Vérification de vos taux saisis". Sous-titre explicatif : "Voici les taux tels que vous les avez saisis. Ce sont les taux de base (meilleur cas : Cameroun, gros montant ≥ 1M XAF). Les ajustements pays et tranches s'appliqueront automatiquement." Puis la liste des 4 taux saisis.

4. **Sélecteur de date d'effet** — 3 boutons rapides : "Maintenant", "Aujourd'hui", "Hier". Plus un bouton "📅 Autre date..." qui ouvre :
   - Un champ date (type date natif)
   - Un sélecteur heure avec boutons +/- pour heures et minutes
   - Un résumé de la date sélectionnée (ex: "📅 03/03/2026 à 08:00")

5. **Bouton "Appliquer les nouveaux taux"** — Envoie POST /api/admin/rates. Affiche "✓ Taux appliqués !" pendant 2.5s en cas de succès.

### 4.3 Onglet Taux → Graphique

**Objectif :** Visualiser l'évolution des taux dans le temps.

**Composants :**

1. **Sélecteur de période** — 3 boutons : "7J", "30J", "3M". Filtre les données du graphique.

2. **Graphique multi-courbes (AreaChart)** — 4 courbes, une par mode de paiement :
   - Cash : vert (#10b981)
   - Alipay : bleu (#3b82f6)
   - WeChat : jaune (#f59e0b)
   - Virement : violet (#8b5cf6)

   Librairie : **Recharts** (AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip).
   Chaque courbe a un dégradé transparent en dessous.
   Tooltip custom : fond sombre, affiche les 4 valeurs au survol.

3. **Boutons toggle par courbe** — 4 boutons arrondis sous le graphique. Chaque bouton a un point de couleur + le nom du mode. Cliquer désactive/réactive la courbe. Au moins 1 courbe doit rester visible.

4. **Stats Min/Moy/Max** — 3 cartes en ligne. Affichent les stats du taux Cash pour la période sélectionnée.

5. **Panneau "Écart entre modes"** — Pour chaque mode :
   - Nom + icône
   - Valeur actuelle
   - Écart par rapport au Cash (badge coloré, ex: "-150")
   - Barre de progression proportionnelle
   Le Cash est marqué "REF".

### 4.4 Onglet Taux → Historique

**Objectif :** Voir l'historique des taux définis.

**Composants :** Liste verticale de cartes. Chaque carte contient :
- Date + heure (ex: "02 mars 2026 à 07:23")
- Badge "Actif" (vert) si c'est le taux en vigueur
- Badge variation (ex: "+0,4%")
- Grille 2×2 avec les 4 taux (icône + nom + valeur pour chaque mode)

Source : GET /api/admin/rates (paginé).

### 4.5 Onglet Config

**Objectif :** Configurer les pourcentages d'ajustement (rarement modifié).

**Composants :**

1. **Bloc "Ajustements par pays"** — Titre avec icône 🌍. Sous-titre explicatif. Liste des pays :
   - Cameroun : affiché en vert avec badge "REF", valeur "0 %" non modifiable
   - Autres pays : drapeau + nom + champ input % modifiable (affiché en rouge)

2. **Bloc "Ajustements par tranche"** — Titre avec icône 📊. Liste des tranches :
   - Tranche 3 (≥1M) : badge "REF", "0 %" non modifiable
   - Tranche 2 et 1 : libellé + plage + champ input % modifiable

3. **Bouton "Sauvegarder la configuration"** — Couleur jaune/orange (pour différencier du bouton violet des taux). Envoie PUT /api/admin/adjustments pour chaque valeur modifiée.

### 4.6 Onglet Simuler

**Objectif :** Tester une combinaison avant de valider les taux.

**Composants :**

1. **Champ montant** — Input numérique + boutons rapides (50K, 250K, 500K, 1M, 2M).

2. **Sélecteur mode de paiement** — Grille 2×2 de boutons (icône + nom).

3. **Sélecteur pays** — Grille 3×2 de boutons (drapeau + nom).

4. **Bloc résultat** — Fond sombre (gradient). Contient :
   - "Vous envoyez" → montant XAF
   - Flèche ↓
   - "Client reçoit" → montant CNY (grande police, couleur accent)
   - Détail du calcul : taux base, ajust. pays (%), ajust. tranche (%), taux final
   - Formule complète en petit en bas

---

## 5. INTERFACE CLIENT — SPÉCIFICATIONS ÉCRAN PAR ÉCRAN

### 5.1 Principes

Le client ne voit **PAS** : les pourcentages d'ajustement, la notion de "tranche", la configuration admin. Tout est calculé en arrière-plan. L'interface reste simple et intuitive.

Le client **VOIT** : le taux qui lui est applicable selon ses choix (pays + mode + montant), un convertisseur, un graphique de tendance.

### 5.2 Structure de la page "Taux de change"

De haut en bas :

```
1. Carte taux du jour (hero)
2. Sélecteur de pays (dropdown)
3. Sélecteur mode de paiement (4 boutons)
4. Convertisseur (Par XAF / Par CNY)
5. Indicateur de taux appliqué
6. Graphique de tendance
7. Banner informatif
```

### 5.3 Carte taux du jour

**Position :** En haut de la page, fond jaune clair.

**Contenu :**
- Libellé "XAF → CNY" (en haut à gauche)
- Deux badges en haut à droite : drapeau+pays et icône+mode sélectionnés
- Taux principal : "1 000 000 XAF = [valeur calculée]" (grande police, gras)
- Sous-texte : "CNY" puis "1 CNY = [valeur inverse] XAF"
- En bas : "Il y a Xh" (à gauche) + badge variation 30j (à droite, ex: "📈 +0,4%")

**Comportement :** Le taux affiché se recalcule en temps réel quand le client change de pays ou de mode de paiement. Le calcul utilise : `T_mode × (1 + c)` avec tranche 3 (≥1M) comme référence.

### 5.4 Sélecteur de pays

**Type :** Menu déroulant (dropdown).

**Fermé :** Affiche le drapeau + nom du pays sélectionné. Si pays CEMAC (hors Cameroun), sous-texte "Taux ajusté zone CEMAC". Flèche ▼ à droite.

**Ouvert :** Liste des 6 pays. Chaque ligne affiche :
- Drapeau + nom du pays (à gauche)
- Checkmark si sélectionné
- Taux pour 1M XAF avec le mode actuel (à droite, en gris)

Le taux affiché à côté de chaque pays permet au client de **comparer les taux** avant de choisir.

**Pays disponibles :** Cameroun 🇨🇲, Gabon 🇬🇦, Tchad 🇹🇩, Centrafrique 🇨🇫, Congo 🇨🇬, Guinée Équatoriale 🇬🇶.

**Par défaut :** Cameroun (ou le pays du profil client s'il est défini).

### 5.5 Sélecteur mode de paiement

**Type :** 4 boutons en ligne horizontale.

**Chaque bouton :** Icône + nom + taux pour 1M XAF (calculé avec le pays sélectionné).

- 💵 Cash
- 🔵 Alipay
- 🟢 WeChat
- 🏦 Virement

**Le bouton actif** a une bordure colorée (couleur propre au mode). Les autres sont grisés.

**Comportement :** Changer le mode recalcule tout (carte hero + convertisseur + indicateur de taux).

### 5.6 Convertisseur

**Identique à l'actuel** dans sa structure, mais le calcul intègre maintenant les 3 niveaux.

**Composants :**
- Toggle "Par XAF" / "Par CNY"
- Champ "Vous envoyez" → input numérique libre + devise XAF
- Bouton swap ⇅
- Champ "Vous recevez" → valeur calculée + devise CNY (lecture seule, police grande, couleur accent)
- Boutons montants rapides : 100K, 250K, 500K, 1,0M, 2,0M
- Texte "Taux appliqué au moment du paiement"

**Calcul du "Vous recevez" :**
```
Montant_CNY = Montant_XAF × (T_final / 1 000 000)

Où T_final = T_mode × (1 + c_pays) × (1 + t_tranche)
```

La tranche est déterminée automatiquement selon le montant saisi :
- ≥ 1 000 000 → tranche 3
- 400 000 – 999 999 → tranche 2
- 10 000 – 399 999 → tranche 1

**Animation :** Le montant CNY s'anime avec une transition douce (easing cubique, 300ms) quand la valeur change.

### 5.7 Indicateur de taux appliqué

**Position :** Entre le convertisseur et le graphique.

**Contenu :**
- "Taux appliqué à votre montant" (petit texte gris)
- "1M XAF = [T_final arrondi] CNY" (texte gras)
- Badge coloré à droite selon la tranche :
  - Vert "✦ Meilleur taux" si montant ≥ 1M
  - Jaune "Taux standard" si montant 400K–999K
  - Rouge "Petit montant" si montant < 400K

**Objectif :** Encourager subtilement le client à envoyer des montants plus élevés pour bénéficier d'un meilleur taux, sans exposer les pourcentages.

### 5.8 Graphique de tendance

**Identique à l'actuel** dans sa structure.

- Sélecteur de période : 7J, 30J, 3M, 1A
- Courbe unique (violet #7c3aed) avec dégradé
- Stats Min/Moy/Max en dessous

**Données :** Courbe du taux Cash Cameroun (référence). Le graphique ne change PAS quand le client sélectionne un autre pays ou mode — il montre toujours la tendance générale.

### 5.9 Banner informatif

Fond violet clair. Icône 📊 + texte "Suivez les taux en temps réel" + sous-texte explicatif. Identique à l'actuel.

---

## 6. STACK TECHNIQUE RECOMMANDÉE

### 6.1 Frontend

- **Framework :** React (déjà en place)
- **CSS :** Tailwind CSS
- **Composants UI :** shadcn/ui — utiliser en priorité : Tabs, Input, Button, Card, Select, DropdownMenu, Dialog, Toggle, ToggleGroup
- **Graphiques :** Recharts (AreaChart, LineChart)
- **Icônes :** Lucide React

### 6.2 Composants shadcn/ui à utiliser

| Composant shadcn | Usage dans l'app |
|---|---|
| Tabs | Onglets principaux (Taux/Config/Simuler) et sous-onglets (Définir/Graphique/Historique) |
| Input | Champs de saisie des taux, montants, pourcentages |
| Button | Tous les boutons (appliquer, sauvegarder, montants rapides) |
| Card | Conteneurs des blocs (historique, stats, résultat simulateur) |
| Select / DropdownMenu | Sélecteur de pays côté client |
| ToggleGroup | Boutons toggle direction (CNY↔XAF), sélecteur période graphique |
| Badge | Badges "Actif", "REF", variations de taux |
| Calendar + Popover | Sélecteur de date personnalisée côté admin |
| Tooltip | Infobulles d'aide |
| Separator | Séparateurs visuels |

### 6.3 Structure des fichiers (suggestion)

```
src/
├── features/
│   ├── rates/
│   │   ├── admin/
│   │   │   ├── RateSetForm.tsx          # Formulaire saisie des 4 taux
│   │   │   ├── RateChart.tsx            # Graphique multi-courbes
│   │   │   ├── RateHistory.tsx          # Liste historique
│   │   │   ├── AdjustmentConfig.tsx     # Configuration pays + tranches
│   │   │   ├── RateSimulator.tsx        # Simulateur
│   │   │   └── AdminRatePage.tsx        # Page container avec onglets
│   │   ├── client/
│   │   │   ├── RateHeroCard.tsx         # Carte taux du jour
│   │   │   ├── CountrySelector.tsx      # Dropdown pays
│   │   │   ├── PaymentMethodSelector.tsx # 4 boutons mode de paiement
│   │   │   ├── RateConverter.tsx        # Convertisseur XAF↔CNY
│   │   │   ├── RateIndicator.tsx        # Indicateur taux appliqué + badge tranche
│   │   │   ├── RateTrendChart.tsx       # Graphique courbe unique
│   │   │   └── ClientRatePage.tsx       # Page container
│   │   └── shared/
│   │       ├── useRateCalculation.ts    # Hook de calcul du taux final
│   │       ├── rateApi.ts              # Appels API
│   │       └── types.ts               # Types TypeScript
```

---

## 7. EXEMPLES DE CALCUL POUR TESTS

Utiliser ces exemples pour valider l'implémentation :

### Paramètres de test

**Taux du jour :**
- Cash: 11 800 | Alipay: 11 650 | WeChat: 11 700 | Virement: 11 750

**Ajustements :**
- Cameroun: 0% | CEMAC: -1.5%
- Tranche 3 (≥1M): 0% | Tranche 2 (400K-999K): -1% | Tranche 1 (10K-399K): -2%

### Cas de test

| # | Pays | Mode | Montant XAF | T_final attendu | CNY attendu |
|---|------|------|-------------|-----------------|-------------|
| 1 | Cameroun | Cash | 2 000 000 | 10 800.00 | 21 600.00 |
| 2 | Cameroun | Cash | 50 000 | 10 584.00 | 529.20 |
| 3 | Gabon | WeChat | 1 500 000 | 10 539.50 | 15 809.25 |
| 4 | Tchad | Virement | 600 000 | 10 482.86 | 6 289.72 |
| 5 | Centrafrique | Alipay | 15 000 | 10 280.45 | 154.21 |
| 6 | Cameroun | Cash | 500 000 | 10 692.00 | 5 346.00 |
| 7 | Gabon | Cash | 500 000 | 10 531.62 | 5 265.81 |

**Note :** Les valeurs T_final sont exprimées en CNY pour 1 000 000 XAF.

### Validation du cas 4 (étape par étape)

```
Entrée : Tchad, Virement, 600 000 XAF

1. T_mode = 10 750 (virement)
   ATTENTION : les taux dans le tableau ci-dessus utilisent 10 800/10 650/10 700/10 750 
   comme exemples de base dans le document de formules. 
   Avec les taux réels du jour (11 800/11 650/11 700/11 750), 
   recalculer en conséquence.

2. c = -1.5% = -0.015 (Tchad = CEMAC)
3. Montant 600 000 → Tranche 2 → t = -1% = -0.01
4. T_final = 11 750 × (1 + (-0.015)) × (1 + (-0.01))
          = 11 750 × 0.985 × 0.99
          = 11 750 × 0.97515
          = 11 458.01 CNY (pour 1M XAF)
5. Montant_CNY = 600 000 × (11 458.01 / 1 000 000)
              = 6 874.81 CNY
```

---

## 8. MIGRATION

### 8.1 Étapes de migration

1. Créer les nouvelles tables (`daily_rates`, `rate_adjustments`)
2. Insérer les données initiales dans `rate_adjustments`
3. Migrer le dernier taux actif de l'ancienne table vers `daily_rates` (en tant que `rate_cash`, les 3 autres à définir manuellement)
4. Déployer le nouveau backend (API)
5. Déployer le nouveau frontend admin
6. Déployer le nouveau frontend client
7. Désactiver l'ancien endpoint de taux unique

### 8.2 Rétrocompatibilité

Pendant la transition, l'ancien endpoint GET /api/rates (taux unique) doit continuer à fonctionner en retournant le taux Cash Cameroun Tranche 3 comme valeur par défaut. Cela évite de casser les clients qui n'ont pas encore mis à jour leur app.

---

## 9. MAQUETTES DE RÉFÉRENCE

Les deux maquettes interactives React (admin + client) sont fournies en annexe :

- `maquette_admin_taux.jsx` — Prototype complet de l'interface admin avec les 3 onglets, le graphique multi-courbes, et le simulateur
- `maquette_client_taux.jsx` — Prototype complet de l'interface client avec le sélecteur pays, le sélecteur mode de paiement, et le convertisseur dynamique

Ces maquettes montrent la **disposition des éléments, les interactions, et la logique de calcul**. Le rendu visuel final doit être adapté au framework de production (Tailwind + shadcn/ui) et aux conventions de style existantes de l'application Bonzini.

---

*Fin du document de spécifications techniques.*

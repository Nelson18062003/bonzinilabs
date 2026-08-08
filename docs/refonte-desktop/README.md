# Refonte de la console admin — desktop

> Cartographie complète des modules, diagnostic de l'existant, nouvelle
> architecture d'information et système de design desktop.
> Captures : `docs/desktop-mockups/v2/{light,dark}/`.

L'app admin est **mobile-first et le restera** : le shell mobile (`src/mobile/**`)
n'est pas modifié par cette refonte. Ce document concerne uniquement ce qui est
rendu au-dessus du breakpoint `lg` (`src/desktop/**`).

---

## 1. Cartographie — ce que la plateforme contient réellement

**30 écrans admin**, 6 rôles, 12 permissions. Répartition par module :

| Module | Écrans | Routes | Permission |
|---|---|---|---|
| Pilotage | 3 | `/m`, `/m/assistant`, `/m/dashboard` | — |
| Dépôts | 3 | `/m/deposits`, `/new`, `/:id` | `canViewDeposits` · `canProcessDeposits` |
| Paiements | 6 | `/m/payments`, `/new`, `/:id`, `/:id/edit-beneficiary`, `/batch/new`, `/batch/:id` | `canViewPayments` · `canProcessPayments` |
| Clients | 5 | `/m/clients`, `/new`, `/:id`, `/:id/ledger`, `/:id/beneficiaries` | `canViewClients` · `canEditClients` |
| Trésorerie | 13 | `/m/more/treasury/**` | `canViewTreasury` · `canManageTreasury` |
| Taux | 1 (+5 sections) | `/m/more/rates` | `canManageRates` |
| Support | 5 | `/m/support/**`, `/m/more/canned-responses`, `/quick-replies` | `canAccessSupportChat` |
| Système | 6 | admins, journaux, justificatifs, notifications, veille, paramètres | `canManageUsers` · `canViewLogs` |
| Agent cash | 6 | `/a/**` — app séparée, **mobile uniquement** | rôle `cash_agent` |

### Matrice des permissions

| Permission | super_admin | ops | support | customer_success | cash_agent | treasurer |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| canViewClients | ✅ | ✅ | ✅ | ✅ | — | — |
| canEditClients | ✅ | — | ✅ | ✅ | — | — |
| canViewDeposits | ✅ | ✅ | ✅ | ✅ | — | — |
| canProcessDeposits | ✅ | ✅ | — | ✅ | — | — |
| canViewPayments | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| canProcessPayments | ✅ | ✅ | — | — | ✅ | — |
| canManageRates | ✅ | ✅ | — | — | — | — |
| canViewLogs | ✅ | ✅ | ✅ | — | — | — |
| canManageUsers | ✅ | — | — | — | — | — |
| canViewTreasury | ✅ | — | — | — | — | ✅ |
| canManageTreasury | ✅ | — | — | — | — | ✅ |
| canAccessSupportChat | ✅ | ✅ | ✅ | ✅ | — | — |

### Ce qui fait la puissance de la plateforme

- **Deux moteurs financiers distincts.** Côté client : wallet XAF, dépôts,
  paiements RMB vers la Chine, bénéficiaires, relevés PDF. Côté maison :
  trésorerie USDT (achats XAF→USDT, ventes USDT→CNY, WAC recalculé à chaque
  achat, taux de revient XAF/CNY, capital immobilisé, inventaire de caisse).
  Le taux publié aux clients découle directement du second.
- **Mola, l'assistant AI-native.** ~57 outils de lecture et ~30 outils
  d'écriture, chaque écriture en deux temps (proposition → confirmation
  humaine → exécution avec le JWT de l'admin, donc RLS appliquée). Les
  capacités sont **découvertes** via des étiquettes `@mola` posées en commentaire
  sur les fonctions Postgres : ajouter une RPC étiquetée suffit à la rendre
  pilotable en langage naturel.
- **Traçabilité.** `admin_audit_logs` sur chaque action privilégiée, timelines
  par dépôt et par paiement, preuves en soft-delete avec motif.
- **Analytics.** ~20 rapports (flux, cohortes, entonnoir dépôt→paiement, délais
  de validation, sources UTM, exposition wallet, productivité par admin).

---

## 2. Diagnostic — pourquoi « ça devient un peu trop »

L'app desktop existante n'était pas mauvaise : elle était **mobile, en grand**.

1. **La navigation mentait.** La barre latérale annonçait 9 destinations pour
   30 écrans réels. Les 13 écrans de trésorerie, les 5 de support et les 8
   système vivaient derrière une page « Plus / Tous les outils » — un pattern
   d'onglet mobile transplanté sur un écran de 1440 px.
2. **Le détail faisait perdre la file.** Ouvrir un dépôt naviguait vers une
   autre page : filtres, scroll et position dans la file étaient perdus à
   chaque décision.
3. **Densité.** Canvas lavande, rayons de 22 px, ombres diffuses, pastilles
   pleines : ~12 lignes visibles là où un poste d'opérations en affiche 25.
4. **Trois barres de filtres empilées** (chips de statut, méthode, période)
   avant d'atteindre la première ligne du tableau.
5. **Redondance.** Une bande de 4 KPI cliquables *au-dessus* de 5 chips
   portant exactement les mêmes compteurs et le même filtre.
6. **Pas de clavier.** Aucune palette, aucun raccourci, pas de navigation au
   clavier dans les listes.

---

## 3. Nouvelle architecture d'information

Organisée par **métier**, plus par barre d'onglets mobile. Tout est dans le rail,
rien au-delà de deux clics. Source unique : `src/desktop/components/layout/desktopNav.ts`.

```
PILOTAGE        Tableau de bord · Mola · Analytics
OPÉRATIONS      Dépôts · Paiements · Clients
TRÉSORERIE      Vue d'ensemble · Analyse · Achats USDT · Ventes USDT ·
                Comptes & soldes · Inventaire · Contreparties · Journal des opérations
MARCHÉ          Taux de change · Veille macro
RELATION CLIENT Conversations · Statistiques · Modèles de réponse · Réponses rapides
SYSTÈME         Justificatifs · Notifications · Administrateurs · Journal d'audit · Paramètres
```

- **Sections repliables.** Pilotage et Opérations sont épinglées ouvertes ; les
  autres se replient et s'ouvrent automatiquement quand on travaille dedans.
  Un profil `ops` voit 6 liens, un `treasurer` 8, un `super_admin` peut
  atteindre les 26 sans jamais passer par une page-hub.
- **Rail réductible (⌘B)** à 60 px quand un tableau large a besoin des pixels.
- **Gating par permission au niveau de la section** : une section dont le rôle
  n'a pas la permission disparaît entièrement.
- **⌘K est la vraie navigation** : actions, destinations, recherche live
  (clients / dépôts / paiements par référence), et tout ce qui n'est pas
  résolu part vers Mola. C'est ce qui rend la plateforme *AI-native* et non
  *AI-décorée*.

La page `/m/more` reste accessible (⌘K, mobile) mais ne figure plus dans le rail :
sur desktop elle n'a plus de raison d'être.

---

## 4. Système de design desktop

Fichiers : `src/desktop/ui/{tokens,primitives,DataTable,layout}.tsx`.

**Le sens reste partagé, la physique diverge.** Les tons sémantiques
(`depositStatusTone`, `paymentStatusTone`, `roleMeta`, `TONE_PILL`) sont importés
depuis `@/mobile/designKit` : un dépôt « validé » est du même vert partout. Seule
la *physique* est redéfinie pour le desktop.

| | Mobile | Desktop |
|---|---|---|
| Canvas | `#ECEAF7` lavande | `#F4F4F8` / `#0E0D14` |
| Séparation | ombre diffuse | filet 1 px |
| Rayon carte | 20–22 px | 12 px |
| Boutons | pastilles pleines | 8 px |
| Corps de texte | 14–15 px | 13 px |
| Hauteur de ligne | carte ~72 px | 46 px (cosy) / 36 px (compact) |

**Deux formes d'écran, pas plus :**

- `Workspace` — page qui défile (tableau de bord, taux, trésorerie, formulaires).
- `Workbench` — la liste occupe le viewport, l'inspecteur est ancré à droite ;
  la liste ne se démonte jamais quand on ouvre un enregistrement.

**Primitives** : `Panel`, `Button`, `Chip`, `Segment`, `Badge`, `Ref`, `Holder`,
`Avatar`, `Figure`, `Metric`, `Field`, `Input`, `EmptyState`, `DataRow`.
`DataTable` est la seule surface de liste : colonnes déclarées en données, tri,
navigation clavier (↑/↓, Entrée, Début/Fin), squelette de chargement, état vide.

---

## 5. État de la migration

**Reconstruit sur le nouveau système** — shell (rail, topbar, ⌘K), tableau de
bord, dépôts, paiements, clients, trésorerie (vue d'ensemble), taux,
administrateurs, journal d'audit.

**Fonctionne dans le nouveau shell, habillage à reprendre** — analytics,
Mola, support, sous-écrans trésorerie (analyse, achats, ventes, comptes,
inventaire, contreparties, opérations), justificatifs, veille macro,
notifications, paramètres, profil, modèles de réponse, réponses rapides,
et tous les formulaires de création.

**Panneaux de détail** (dépôt, paiement, client, admin) : ils réutilisent
volontairement les écrans mobiles. Ils portent toute la logique métier sensible
— validation de dépôt, exécution de paiement, crédit/débit de wallet — et la
réécrire dans le même passage que la refonte visuelle aurait été un risque
financier inutile. Ils s'affichent dans l'inspecteur ; leur habillage desktop
est la prochaine étape.

---

## 6. Passe de finition — audit et correctifs

Six audits spécialisés (design system · DataTable & layout · shell & palette ·
écrans de file · écrans restants · a11y/dark/motion/i18n) ont été passés sur
`src/desktop`. Ce qui en est ressorti et a été corrigé :

### Outillage — la découverte la plus importante

**`npm run type-check` ne compilait rien.** Le `tsconfig.json` racine est
`{"files": [], "references": […]}` et `tsc --noEmit` ne suit pas les project
references : la commande sortait 0 sur un code qui contient **200 erreurs
réelles** sous `tsconfig.app.json`. Cinq d'entre elles étaient dans la nouvelle
console (un `style` passé à un composant qui ne l'accepte pas, deux `ElementType`
vs `LucideIcon`, et deux lectures d'une colonne `description` qui n'existe pas).

Un script `type-check:strict` (`tsc --noEmit -p tsconfig.app.json`) a été ajouté,
et `src/desktop` est désormais **à zéro erreur**. Le script `type-check` d'origine
n'a pas été modifié : le basculer ferait échouer la commande sur les ~200 erreurs
préexistantes du reste du repo — c'est un arbitrage qui vous revient.

### Bugs corrigés

- **La palette ⌘K ouvrait une autre ligne que celle surlignée.** Les entrées
  étaient triées par pertinence puis regroupées, mais le curseur clavier
  indexait le tableau trié pendant que le rendu numérotait par groupe. Dans une
  console de paiements, cela veut dire ouvrir le mauvais enregistrement. Une
  seule séquence sert maintenant au rendu et au clavier.
- **Le journal d'audit lisait une colonne inexistante** : `admin_audit_logs` n'a
  pas de `description`, la colonne « Détail » affichait un tiret permanent et la
  recherche ne matchait jamais. Elle lit le payload `details` (jsonb).
- **« Dernière connexion » était fabriquée** : `useAdminUsers` code `lastLoginAt:
  null` en dur, donc tout le monde affichait « Jamais ». Colonne remplacée par la
  date de création, qui est un fait réel.
- **Le filtre méthode pouvait bloquer la file** : filtré côté client, si la
  première page n'en contenait aucun, le déclencheur de scroll infini
  disparaissait avec l'état vide et aucune page suivante ne pouvait charger.
- **L'inspecteur était injoignable entre 1024 et 1279 px** : le shell démarre à
  1024, le panneau était `xl:block`. Cliquer une ligne ne faisait rien. Il
  s'affiche en tiroir superposé sous 1280.
- **« Capital immobilisé » ne valait pas la même chose sur deux écrans** : la vue
  d'ensemble omettait la jambe CNY et le clamp à zéro de la RPC, donc un stock
  négatif affichait un capital négatif. Renommé « Stock USDT valorisé », clampé.

### Sécurité et permissions

- Gardes d'écran ajoutées : **journal d'audit** (`canViewLogs`),
  **administrateurs** (`canManageUsers` — l'écran listait nom, email et rôle de
  tous les admins), **clients** (`canViewClients`).
- Actions d'écriture regatées sur la permission qui permet de **finir** le
  travail, pas de lire : « Nouveau dépôt » → `canProcessDeposits`, « Nouveau
  paiement » / « Paiement groupé » → `canProcessPayments`, « Nouveau client » →
  `canEditClients`. Un rôle `support` obtenait les trois.
- L'écran **Taux** ne bloque plus que la publication : support et chargés de
  clientèle retrouvent le simulateur et l'historique, dont ils ont besoin tous
  les jours.

### Honnêteté de l'affichage

Une requête en échec affichait « Aucun dépôt trouvé » — dire à un opérateur que
la file est vide quand le backend est tombé est le pire mensonge possible dans
un produit financier. Les cinq écrans reconstruits distinguent désormais
**chargement · erreur · vide · vide après filtre**, et la recherche annonce
explicitement qu'elle ne porte que sur les pages déjà chargées.

### Accessibilité et confort

Contrastes `muted`/`faint` remontés au-dessus de 4,5:1 sur les trois surfaces et
dans les deux thèmes (ils étaient à 3,90:1 et 2,29:1) · anneau de focus pleine
opacité avec repli `forced-colors` · `type="button"` explicite sur les boutons
(ils étaient `submit` par défaut) · en-tête de tableau collant, `table-fixed`,
squelette de même géométrie, un seul arrêt de tabulation, ↑/↓/Début/Fin/PgUp/PgDn ·
palette en `combobox`/`listbox` avec `aria-activedescendant`, piège de focus,
verrouillage du scroll et restauration du focus · niveau SLA encodé en **forme**
autant qu'en couleur · titre d'onglet par écran · politique
`prefers-reduced-motion` globale (le bloc existant était une liste d'autorisation
que chaque nouvelle animation contournait).

### Reste à faire — signalé, non traité

- **i18n.** La console ships fr/en/zh et les écrans admin mobiles traduisent ;
  les écrans desktop reconstruits codent le français en dur. Les titres
  principaux passent par `t()` avec `defaultValue`, mais colonnes, chips et
  micro-copie restent à extraire. Un admin en `zh` voit aujourd'hui du chinois
  sur `/m/support` et du français sur `/m/deposits`.
- `DesktopCreateClient` et `DesktopMoreScreen` sont toujours sur l'ancien kit.
- Les panneaux de détail restent les écrans mobiles (cf. §5).

---

## 7. Correctifs embarqués (première passe)

Deux écarts relevés pendant la cartographie, corrigés parce qu'ils touchaient
des écrans réécrits ici :

- **`/m/more/rates` n'avait aucun garde de permission.** Seule l'entrée de menu
  était filtrée par `canManageRates` : n'importe quel admin authentifié qui
  tapait l'URL obtenait l'interface de publication du taux du jour. L'écran
  exige désormais `canManageRates`.
- **Le filtre par rôle de l'écran Administrateurs ne couvrait que 3 rôles sur 6.**
  Les comptes `treasurer`, `support` et `customer_success` étaient introuvables
  dans le seul écran qui les liste. Il couvre maintenant les six, et affiche
  l'effectif par rôle.

Le bandeau de taux de la barre supérieure affichait `¥1 = 92,5 XAF` alors que
`rate_alipay` est exprimé en **CNY livrés pour 1 000 000 XAF** (même unité que
l'écran Taux et que le flyer client). Il affiche désormais `1 M XAF = 92,50 ¥`.

### Points signalés, non traités ici

Relevés pendant la cartographie, hors périmètre d'une refonte d'interface —
à arbitrer :

- `validate_deposit` : le montant confirmé saisi par l'admin n'atteint jamais la
  RPC (`useAdminDeposits.ts` ne transmet pas `confirmedAmount`), le wallet est
  crédité du montant déclaré.
- Le détail de dépôt n'appelle aucun `hasPermission` : `canProcessDeposits` n'est
  vérifié nulle part côté client.
- Le crédit/débit de wallet depuis la fiche client n'est protégé par aucune
  permission.
- `useAdminDeleteClient` redirige vers `/admin/clients`, route inexistante.
- Le filtre KYC ne peut jamais matcher (`useClients` force `status: 'ACTIVE'`).
- ~2 500 lignes de code dépôts V1 inatteignables mais toujours exportées.

---

## 8. Régénérer les captures

```bash
PW_CHROMIUM_PATH=/opt/pw-browsers/chromium \
  npx playwright test --config=playwright.showcase.config.ts
```

Fixtures : `tests/e2e/fixtures/consoleFixtures.ts` (données synthétiques,
déterministes, aucun accès réseau réel).

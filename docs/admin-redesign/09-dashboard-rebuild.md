# Tableau de bord — analyse avant reconstruction

> Même méthode que pour la Trésorerie : inventaire depuis le CODE, pas depuis
> la documentation. Chaque chiffre ci-dessous est vérifiable par la commande
> citée.

## 1. Le défaut central

```
src/desktop/screens/analytics/DesktopAnalyticsDashboard.tsx   15 lignes
src/mobile/screens/analytics/MobileAnalyticsDashboard.tsx   1 799 lignes
```

Le « tableau de bord desktop » **n'existe pas**. Le fichier desktop se réduit à :

```tsx
export function DesktopAnalyticsDashboard() {
  return <MobileAnalyticsDashboard />;
}
```

C'est l'écran téléphone rendu en pleine largeur. Exactement la situation de la
Trésorerie avant sa refonte.

## 2. Ce que ça produit à l'écran

### 2.1 Cinq sections sur six sont REPLIÉES

```
$ grep -c 'CollapsibleSection title'  → 6
$ grep -c 'defaultOpen={false}'       → 5
```

| Section | État par défaut |
|---|---|
| Capital & conversion | repliée |
| Flux & volumes | ouverte |
| Clients | repliée |
| Opérations | repliée |
| Taux | repliée |
| Équipe & top clients | repliée |

L'accordéon est la bonne réponse sur un écran de 390 px de large. Sur 1 440 px
il cache 5 sections sur 6 : l'opérateur arrive sur un tableau de bord qui ne
montre presque rien et doit déplier une à une des sections que l'écran avait
la place d'afficher.

### 2.2 Les montants sont abrégés

```
$ grep -c 'compact: true'  → 6
```

Les six KPI de tête — chiffre d'affaires, dépôts validés, flux net, ticket
moyen, exposition — s'affichent en « 18,4 M ». C'est précisément ce qui a été
banni de la Trésorerie, et pour la même raison : « 18,4 M » perd les 42 000
francs qui séparent deux valeurs.

### 2.3 L'écran n'utilise pas le design system

```
$ grep -o "from '@/[a-z/]*'" | sort -u
  from '@/components/analytics'
  from '@/lib/utils'
```

Une seule référence à `components/ui/` dans 1 799 lignes. Tout passe par des
primitives maison (`KpiCard`, `ChartCard`, `KpiRow`, `CollapsibleSection`,
`BreakdownBar`) qui ne connaissent ni les jetons du thème, ni les composants
shadcn posés pour l'admin.

## 3. Les données — et elles sont bonnes

`src/hooks/analytics/useAnalytics.ts` (1 248 lignes) expose **21 métriques** :

| Domaine | Hooks |
|---|---|
| Volumes | `usePaymentSummary`, `useDepositSummary`, `useFlowSeries`, `useDepositVolumeReport`, `usePaymentVolumeReport` |
| Répartitions | `useDepositMethodBreakdown`, `usePaymentMethodBreakdown`, `useDepositStatusSummary`, `useDepositStatusTimeline` |
| Clients | `useTopClients`, `useClientGrowth`, `useRegistrationSource`, `useUtmSources`, `useClientCountryDistribution` |
| Opérations | `useFunnel`, `useDepositProcessingTime`, `useAdminProductivity` |
| Capital | `useWalletExposure` |
| Marché | `useRateHistory`, `useUsdtFlowHistory` |
| Alertes | `useDashboardAlerts` |

**20 sur 21 sont déjà consommées** par l'écran. Seule `useUsdtFlowHistory`
n'est utilisée nulle part.

C'est la différence majeure avec la Trésorerie : là-bas il manquait des
fonctionnalités entières (grand livre, inventaires, règlement). Ici la couche
de données est riche et branchée — **le problème est entièrement la
présentation**.

## 4. Ce qu'il faut construire

Un vrai écran desktop, pas un écran mobile élargi :

1. **Rien de replié.** La largeur sert à montrer, pas à cacher. Les sections
   deviennent des blocs empilés, tous visibles.
2. **Chiffres complets**, comme en Trésorerie.
3. **Composants du design system** : `Card`, `Table`, `Tabs`, `Badge`,
   `Skeleton`, et les jetons de couleur — plus de primitives maison qui
   dérivent.
4. **Une hiérarchie de lecture** : la ligne de KPI décide, les graphiques
   expliquent, les tables détaillent. Aujourd'hui tout est au même niveau.
5. **Les alertes en tête** : `useDashboardAlerts` existe et se retrouve noyée
   au milieu ; ce qui demande une action doit se voir en premier.

Le mobile ne change pas : il garde son écran et ses accordéons, qui sont
adaptés à sa largeur.

## 5. Périodes et axes — ce qui a cassé après la reconstruction

Signalé : « après une plage personnalisée, les axes sont bizarres ». Mesuré
avec le harnais (`tools/.axes-check.mjs`, huit scénarios pilotés par clics
sur le vrai sélecteur), avant / après :

| Scénario | Avant | Après |
|---|---|---|
| Aujourd'hui | **1 seau** (« Mar 1 ») | 24 seaux horaires `00h → 23h` |
| 90 derniers jours | 180 barres journalières | 14 semaines `1 juin → 31 aoû` |
| Cette année | **730 barres** journalières, `Dim 4 · Dim 18 · Dim 1…` | 12 mois `Jan 26 → Déc 26` |
| 1er mars → 31 août | 368 barres | 6 mois `Mar 26 → Aoû 26` |

Trois causes, distinctes :

1. **La granularité survivait au changement de plage** (`DateRangeContext`).
   Le mobile s'en protégeait à la consommation ; le desktop non. Corrigé à la
   SOURCE : une granularité héritée cède au défaut de la nouvelle plage, un
   choix explicite (`setGranularity`) est conservé tant qu'il reste
   compatible. « Par jour » exige désormais au moins deux jours.
2. **Les étiquettes étaient exactes et sans contexte** — « Lun 3 » sans le
   mois, « 14h » sans le jour. `bucketAxisLabel` porte le contexte aux deux
   bouts de l'axe et à chaque changement (1er du mois, minuit). On n'a PAS
   posé d'`interval` numérique : il désactiverait l'élagage par mesure de
   texte de Recharts, le seul qui tienne quelle que soit la largeur.
3. **Un piège latent exposé par la correction** : `bucketStarts` avançait un
   instant UTC qui représente « minuit Douala » (23:00 la veille) ; le
   bornage au dernier jour du mois faisait dériver l'ancre (31 janv → 28 févr
   → 28 mars…). Tout événement d'avril à décembre perdait son seau —
   **ignoré par le graphique, compté dans les totaux**. Le curseur avance
   désormais en heure murale de Douala ; un test d'invariant garantit que
   tout instant de la plage trouve un seau.

Le test de fuseau rejoue chaque assertion dans quatre fuseaux ; c'est un test
qui ne tournait qu'à UTC qui avait laissé passer le décalage d'un jour.

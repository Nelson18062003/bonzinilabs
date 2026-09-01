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

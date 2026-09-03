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

## 6. Le graphique clients et les sept blocs oubliés

Retour utilisateur : « le graphique clients ne marche pas », « tu as supprimé
beaucoup de graphiques, je veux les revoir ».

**Le graphique clients ne marchait pas au sens propre.** Le bloc desktop
traçait `<Line dataKey="count">` sur des points `ClientGrowthPoint
{ newClients, cumulative }`. Recharts ne signale pas une clé absente : il ne
dessine rien. Le graphique était vide sous un titre plein, indistinguable
d'une période sans inscription. Corrigé dans `ClientGrowthBlock` avec deux
garde-fous : les clés lues par le graphique sont dérivées du type des lignes
(`GROWTH_KEYS … satisfies Record<…, keyof GrowthRow>`, une clé inexistante ne
compile pas) et `clientGrowthBlock.test.tsx` rend le bloc avec des points et
vérifie que les chiffres en sortent.

Le bloc est reconstruit sur le modèle des deux blocs de croissance de volume :
barres = nouveaux clients par période (le rythme), aire = total de clients au
fil du temps (la pente), axe du total partant du total de DÉBUT de période
(sinon 1 180 → 1 240 est une ligne plate), en-tête nouveaux · total · pic ·
période précédente, variation vs période précédente. Le rapport vient d'un
nouveau hook `useClientGrowthReport` (même série que `useClientGrowth`, plus
un comptage `head` de la période précédente).

**Les sept blocs oubliés.** La première version desktop consommait 13 des 21
métriques ; le mobile les avait toutes. Restaurés dans `dashboardBlocks.tsx`,
sur `dashboardKit` et avec les axes contextuels (`bucketAxisLabel`) :

| Bloc | Hook | Forme desktop |
|---|---|---|
| Nouveaux clients · Clients actifs · Conversion dépôt → paiement · Délai de validation (médiane, P90) | `useClientGrowthReport`, `useFunnel`, `useDepositProcessingTime` | deuxième ligne d'indicateurs |
| Sources d'inscription (+ canaux UTM) | `useRegistrationSource`, `useUtmSources` | deux chiffres, barre de part, table UTM |
| Répartition des clients par pays | `useClientCountryDistribution` | anneau + table (top 5 + Autres + Non renseigné, alerte ≥ 10 % sans pays) |
| Statut des dépôts dans le temps | `useDepositStatusTimeline` | barres empilées validés / en attente / rejetés |
| Évolution des taux | `useRateHistory` | 4 courbes, domaine resserré, Alipay moyen · variation · écart moyen |

## 7. La section « Croissance » — le rythme, et non le volume

Demande suivante, après la restauration : « je veux voir comment nos clients
grandissent chaque semaine et chaque mois… pouvoir changer sur le graphique
entre semaine après semaine et mois après mois », pour les clients, les
dépôts ET les paiements.

C'est une question que le reste de l'écran ne posait pas. « Flux financier »
et « Volume des dépôts sur la période » répondent *combien sur la période
choisie* ; la croissance demande *à quel rythme*, ce qui suppose une suite de
périodes comparables. Sur « 30 derniers jours », un graphique mensuel donne un
seul seau : la question n'a alors pas de réponse.

D'où une **fenêtre propre** (`src/lib/analytics/growthWindow.ts`) : douze
semaines ou douze mois glissants, indépendante du sélecteur du haut. Le calcul
se fait en jours civils de Douala, en arithmétique de chaînes 'YYYY-MM-DD' —
pas de `Date` locale, c'est la leçon du bogue de fuseau (§5). La fenêtre
commence exactement au début d'un seau, sinon la première barre est une
demi-période qu'on lirait comme un effondrement.

| Bloc | Hook | Pas par défaut |
|---|---|---|
| Croissance des clients | `useClientGrowth` | mois (une inscription est rare) |
| Croissance des dépôts | `useDepositVolumeReport` | semaine |
| Croissance des paiements | `usePaymentVolumeReport` | semaine |

Chaque bloc porte SON pas : on lit les clients par mois pendant qu'on regarde
les paiements par semaine.

**Un seul encodage : des barres.** La variation d'une période à l'autre n'est
pas une seconde série, c'est une étiquette posée sur la barre (voir §8). Deux
règles d'honnêteté :

- la **période en cours** est incomplète : dessinée en clair, sans étiquette
  de variation (une semaine à son deuxième jour afficherait « −70 % »), et
  exclue des chiffres de tête, qui portent sur les périodes terminées ;
- une **période précédente à zéro** ne donne pas « +∞ % » mais rien.

## 8. Trois graphiques retirés, et les barres du graphique clients

Même message : « tu peux supprimer ce graphique, il ne me sert à rien pour le
moment ». Retirés de l'écran desktop — **Évolution des taux**, **Qualité des
dépôts**, **Statut des dépôts dans le temps**. Le code est supprimé, pas
commenté ; les hooks (`useRateHistory`, `useDepositStatusSummary`,
`useDepositStatusTimeline`) restent, l'écran mobile les consomme.

Et : « il a une ligne, mais il a aussi des barres dedans, je ne comprends pas
ce graphique ». Le bloc clients était un graphique combiné — des barres (les
nouveaux du seau) et une aire (le total cumulé) sur deux axes de sens
différents. Les barres sont parties ; reste l'aire, renommée **Parc de
clients**. Le nombre de nouveaux par seau vit dans l'infobulle et dans les
chiffres de tête. Le rythme, lui, a désormais son propre graphique (§7).

Deux blocs ne pouvant pas porter le même nom sur un écran, les anciens blocs
de volume sont devenus **Volume des dépôts / des paiements sur la période**,
et les matrices gardent **Croissance des …**.

Ordre de lecture de l'écran : alertes → indicateurs (argent, puis clients et
service) → flux financier → volume dépôts / paiements sur la période →
méthodes → parc de clients → sources / pays → **croissance clients / dépôts /
paiements** → top clients / productivité.

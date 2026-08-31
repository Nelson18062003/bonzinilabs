# Module Taux de change — refonte desktop

> Phase 1 : inventaire + architecture. Phase 2 : implémentation
> (`src/desktop/screens/rates/`). Le mobile (validé) ne change pas, hormis un
> correctif de bug (voir §2).

## 1. Inventaire des capacités (source : code, hooks, RPC)

| Capacité | Données / RPC | Notes |
|---|---|---|
| Taux actifs (4 modes, CNY / 1M XAF) | `daily_rates.is_active`, `useActiveDailyRate` | un seul jeu actif ; `effective_at` affiché |
| Publier de nouveaux taux | RPC `create_daily_rates` | désactive le jeu précédent ; `effective_at` antidatable (maintenant / aujourd'hui 00:00 / hier / date+heure) |
| Suggestion automatique | table `rate_suggestions`, edge `suggest-daily-rates`, RPC `mark_suggestion_applied` | Binance P2P « méthode Nelson v2 » : max CMR (XAF/USDT) + marge, moyenne CHN (CNY/USDT), ordres marchands détaillés (nom, prix, volume) ; traçage « appliqué » |
| Simulateur | `calculateFinalRate`, `convertCNYtoXAF`, `getBaseRate` | bidirectionnel XAF↔CNY (convergence de tranche en 2 itérations), pays + tranche, détail complet du calcul |
| Historique | `useDailyRatesHistory(20)` | variation (cash) vs jeu précédent |
| Tendance | `useDailyRatesForChart` | périodes 7j/30j/3m **et 1 an (supporté par le hook, jamais exposé par l'UI mobile)** ; 4 courbes ; min/moy/max ; écart vs cash |
| Ajustements | `rate_adjustments` (`country` \| `tier`), RPC `update_rate_adjustment` | Cameroun = référence 0 % ; tranches t1 <400K, t2 400K–1M, t3 ≥1M |
| Formule | `T_final = T_mode × (1+pays) × (1+tranche)` ; `CNY = XAF × T_final/1M` | identique SQL `calculate_final_rate` |
| Flyer WhatsApp | `RateFlyer`, `exportFlyer` (PNG/PDF) | thème clair/sombre, export = même nœud DOM que l'aperçu |

## 2. Défauts constatés (avant refonte)

1. **Desktop = 2 colonnes de blocs mobiles** : cibles tactiles géantes, graphique
   et ajustements enterrés dans des accordéons, flyer en BottomSheet.
2. **Bug financier** : le segment « Pour 1M XAF / Pour 1 CNY » de la saisie ne
   change QUE le libellé — publier en mode « Pour 1 CNY » publie la valeur brute
   comme taux 1M (ex. 86,7 CNY/1M au lieu de ~11 530). Corrigé : conversion
   réelle au basculement et à la publication (mobile) ; le desktop saisit dans
   l'unité canonique avec l'équivalence « ≈ X XAF/CNY » affichée en direct.
3. **Publication sans confirmation** : l'action la plus sensible du produit
   (change les prix de tous les clients) partait en un clic, sans récapitulatif
   ancien → nouveau.
4. Détail des ordres marchands de la suggestion jamais montré (seulement les
   compteurs) ; période 1 an du graphique jamais exposée ; aucune comparaison
   « saisie vs actif » pendant la frappe.

## 3. Architecture desktop (02-foundation : 36px, une primaire/surface, CenterDialog)

Le module est une **salle de contrôle**, pas une file de travail : pas de
workbench/table maître, mais une composition fixe hiérarchisée par fréquence
d'usage (publier > simuler > surveiller > régler).

```
┌ Header — Taux de change · actifs depuis …            [Flyer du jour] ┐
├──────────────────────────────┬───────────────────────────────────────┤
│ A. PUBLIER (480px)           │ B. SIMULATEUR                         │
│  actif → nouveau + Δ par mode│  saisie (montant, mode, pays) |       │
│  équivalence ≈ XAF/CNY live  │  résultat ¥ + détail TOUJOURS visible │
│  suggestion Binance inline   ├───────────────────────────────────────┤
│  (+ ordres dépliables)       │ C. HISTORIQUE (table)                 │
│  prise d'effet · PUBLIER     │  date | 4 modes | Δ | actif           │
│  → CenterDialog récap        │                                       │
├──────────────────────────────┴──────────────┬────────────────────────┤
│ D. TENDANCE (graphique, 7J/30J/3M/1A)       │ E. AJUSTEMENTS         │
│    courbes, min/moy/max, écarts             │  pays | tranches       │
│                                             │  save si modifié       │
└─────────────────────────────────────────────┴────────────────────────┘
```

### Composants (`src/desktop/screens/rates/`)

| Fichier | Rôle |
|---|---|
| `DesktopRatesScreen.tsx` | composition + hooks (site de fetch unique) + flyer en `CenterDialog` |
| `RatePublishCard.tsx` | A — état actif, saisie avec Δ, suggestion, prise d'effet, publication confirmée |
| `RateSimulatorCard.tsx` | B — 2 colonnes internes, détail du calcul permanent |
| `DesktopRateHistory.tsx` | C — table `Th/Td`, ligne active surlignée |
| `RateTrendCard.tsx` | D — périodes en `Chip` (dont 1A), réutilise `MultiCurveChart` |
| `RateAdjustmentsCard.tsx` | E — deux groupes, bouton « Sauvegarder (n) » actif si modifié |

Données/calculs inchangés : `useDailyRates.ts`, `lib/rateCalculation.ts`,
RPC existantes. Aucune migration requise.

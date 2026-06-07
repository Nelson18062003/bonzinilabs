# 21 — Mola Quality Flywheel (boucle d'amélioration de la qualité)

> « Tu ne devrais plus prompter tes agents. Tu devrais concevoir les boucles qui
> promptent tes agents. » — le principe appliqué à Mola.

## Le problème (constat founder)

Mola « fait robot » : il répond juste mais sans la profondeur d'un directeur des
opérations qui comprend VRAIMENT le métier Bonzini. On l'améliore aujourd'hui « au
ressenti », par à-coups, en éditant le prompt à la main quand on remarque que c'est
mauvais.

## La cause racine (code)

`eval/assistant/grade.ts` ne mesure que la **correction mécanique** : bon outil ?
bons params ? refus quand il faut ? sous-chaînes présentes/absentes ? Il n'existe
**aucune dimension de qualité** (profondeur métier, proactivité, ton). Donc un Mola
robotique peut scorer 100 %. **On ne peut pas améliorer ce qu'on ne mesure pas.**

Le `buildSystemPrompt` (admin-assistant/index.ts) est ~40 lignes de règles
anti-confabulation et de justesse SQL — presque rien sur le raisonnement métier
profond, la proactivité (« ce dépôt est bloqué en admin_review depuis 3 jours »),
ou le jugement. Il a été réglé pour être *correct*, pas *perspicace*.

## La boucle

```
1. HARVEST   vraies conversations (assistant_messages + audit, LECTURE SEULE)
2. JUGE      juge-LLM sur la grille métier → score /100 (la mesure manquante)
3. CLUSTER   thèmes robotiques classés par impact (fréquence × sévérité)
4. PROMEUT   pires ratés réels → cases.ts (deviennent des tests de régression)
5. PROPOSE   correctif : bloc de connaissance métier / règle de proactivité / outil
6. PORTE     re-run eval+juge → ne livrer QUE si le score MONTE, sans régression
```

Le rôle humain monte d'un cran : tu conçois la **grille** (ce que « comprendre le
métier » veut dire pour Bonzini) et tu approuves les changements proposés chaque
semaine. La boucle fait la corvée récolte → juge → classe → propose → porte.

**Zéro argent touché** : l'actionneur est le prompt/les connaissances de Mola, pas
des RPC financières.

## La grille (pondérations dans `judge.ts`)

| Axe | Poids | Ce qu'on note |
|---|---|---|
| `business_depth` | 30 % | Raisonne-t-il en DO qui maîtrise XAF→USDT→CNY, le spread, les statuts ? |
| `proactivity` | 25 % | Signale-t-il l'info utile suivante au lieu de répondre au pied de la lettre ? |
| `grounding` | 20 % | Chiffres adossés aux données, zéro invention ? |
| `tone` | 15 % | Chaleureux, concis, humain — pas templaté ? |
| `actionability` | 10 % | L'admin sait-il quoi faire ensuite ? |

`business_depth` + `proactivity` pèsent le plus : c'est exactement ce qui sépare un
robot d'un directeur des opérations.

## Fichiers (Slice 1 — livré)

| Fichier | Rôle | Où ça tourne |
|---|---|---|
| `eval/assistant/judge.ts` | grille + fonctions PURES (prompt du juge, parse, agrégation) | partout |
| `eval/assistant/report.ts` | clustering + classement + rendu Markdown (PUR) | partout |
| `eval/assistant/judge.test.ts` | tests des deux ci-dessus (14) | **ici** (vitest) ✅ |
| `eval/assistant/quality-run.ts` | colle HARVEST → JUGE → REPORT | déploiement/CI (Deno) |
| `eval/assistant/reports/` | rapports générés `quality-<date>.md` | sortie |

### Lancer la boucle (après déploiement)

```bash
export SUPABASE_URL=https://fmhsohrgbznqmcvqktjw.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=...   # lecture assistant_messages + audit
export ANTHROPIC_API_KEY=...           # le juge
deno run --allow-net --allow-env --allow-write eval/assistant/quality-run.ts
```

Sortie : `eval/assistant/reports/quality-AAAA-MM-JJ.md` — score global, axe le plus
faible, thèmes robotiques classés, et la liste des ratés à coller dans `cases.ts`.

## Suite (slices non encore livrées)

- **Slice 2 — Connaissances métier versionnées** : extraire un bloc « playbook
  Bonzini » (glossaire fournisseurs, règles de proactivité, modèle économique) que
  le system prompt compose ; promouvoir les ratés récoltés en cas de `cases.ts`.
- **Slice 3 — Porte automatique** : job CI hebdo (cron / `/loop`) qui récolte,
  juge, et bloque toute baisse du score global avant merge d'un changement de prompt.

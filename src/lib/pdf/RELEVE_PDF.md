# Relevé de compte PDF — refait le 28/09/2026

L'ancien relevé (`ClientStatementPDF`) ne lisait que le grand livre en XAF :
on n'y voyait ni le **taux** ni le **montant en ¥** des paiements, les pages se
chevauchaient (en-tête de tableau « fixed » répété au mauvais endroit), il
n'existait qu'en français et le choix de période n'était pas pensé pour
l'ordinateur. Il est remplacé en entier.

## Le parcours

```
Bouton « Relevé »  (fiche client mobile · panneau client desktop · Historique client)
    ↓
StatementPeriodSheet — période (préréglages ou « Du / Au ») + langue FR | EN
    (fenêtre centrée sur ordinateur : variant="dialog" ; feuille basse sur téléphone)
    ↓ onGenerate(range, lang)
l'écran lit les écritures de la période (+ la dernière avant elle, pour le solde d'ouverture)
    ↓
downloadAccountStatement()            src/lib/accountStatementData.ts
    · fetchStatementDetails : le paiement (taux, ¥, mode, bénéficiaire, statut)
      ou le dépôt (mode, banque) derrière chaque écriture
    · buildStatementDocument          src/lib/accountStatement.ts   (PUR, testé)
    · AccountStatementPDF             src/lib/pdf/templates/AccountStatementPDF.tsx
    ↓
releve_Jean-Paul-Kamdem_2026-09-01_2026-09-28.pdf   (statement_… en anglais)
```

`db` = `supabaseAdmin` côté équipe, `supabase` côté client (RLS).

## Le document (A4 paysage)

1. En-tête : BONZINI · NORTON GAUSS BONZINI SARL, « Relevé de compte », période.
2. Client (nom, identifiant BZ-…, contacts) · Période · Émis le.
3. Solde d'ouverture → Entrées → Sorties → Solde de clôture ; puis « Payé à vos
   fournisseurs » (¥) et le **taux moyen** (pondéré par les XAF, paiements
   annulés/remboursés exclus).
4. Tableau, colonnes fixes : Date · Opération (type · mode, puis bénéficiaire /
   banque / motif) · Référence · Entrée · Sortie · **Taux** (¥ pour 1 000 000 XAF)
   · **Montant ¥** · Solde. Badges « EN COURS » / « ANNULÉ ».
5. Pied : émetteur, client, « page x sur y ».

Pages découpées par `statementPages` (9 lignes page 1, 16 ensuite) : chaque
page suivante a son bandeau court et son en-tête de tableau ; la dernière
garde la place du solde de clôture et des totaux.

## Vérifier

- Tests : `src/tests/lib/accountStatement.test.ts`, `statementPeriod.test.ts`.
- Rendu : `screenshot.html?screen=statement-doc&lang=en&rows=30` (toutes les
  pages en une image) ; la fenêtre : `?screen=statement-picker&variant=dialog`.

# La facture, la domiciliation, et la preuve du paiement

> Réponse à une question précise de Nelson Soh : *« est-ce que la facture commerciale
> n'est pas largement suffisante pour montrer que c'est ça qu'on a payé ? »*
> **Réponse courte : oui, elle l'est. C'est moi qui avais trop chargé.** Ce document
> corrige, puis montre ce qui compte réellement — et ce n'est pas la capture d'écran.

---

## 1. Correction : la facture EST la preuve

> **Art. 30.1 (Code des douanes CEMAC)** — *« La valeur en douane des marchandises
> importées est leur valeur transactionnelle, c'est-à-dire le prix effectivement payé
> **ou à payer** pour ces marchandises […] »*

**« ou à payer »** règle la question. Le Code n'exige pas que le paiement soit déjà
intervenu, encore moins qu'il soit prouvé par une capture d'écran. **La facture
commerciale est le document de base de la valeur en douane.** Point.

La preuve de paiement n'est pas une pièce de routine. Elle n'intervient que dans **un
seul cas**, et ce cas est nommé :

> **Art. 42.2** — *« Lorsqu'une déclaration a été présentée et que l'administration des
> douanes a des **raisons de douter** de la véracité ou de l'exactitude des renseignements
> ou des documents fournis à l'appui de cette déclaration, l'administration des douanes
> **peut demander** à l'importateur de communiquer des **justificatifs complémentaires**
> […] attestant que la valeur déclarée correspond au montant total effectivement payé ou
> à payer […] »*

**Traduction : la facture est la règle. La preuve de paiement est la réponse à un
doute.** Donc la vraie question n'est pas *« quelle preuve fournir ? »* mais *« qu'est-ce
qui déclenche le doute ? »*

---

## 2. Ce qui déclenche le doute sur la DAU en cours

Trois anomalies visibles, toutes sur le même document :

| Case | Contenu | Effet |
|---|---|---|
| **22 — fret** | `0,000` | une marchandise venue de Nansha par CMA CGM avec un fret nul |
| **22 — assurance** | `0,000` | assurance obligatoire à l'import (loi n° 75-14 du 8 décembre 1975) déclarée à zéro |
| **23 — N° de domiciliation** | **VIDE** | voir §3 — c'est le plus grave, et de loin |

Aucun inspecteur n'a besoin de chercher un motif : il est sur la première page.

---

## 3. 🔴 La case 23 vide n'est pas une case oubliée. C'est une infraction chiffrée.

### L'obligation

> **Règlement des changes CEMAC n° 02/18/CEMAC/UMAC/CM du 21 décembre 2018, Article 38** —
> *« Toutes les importations doivent être déclarées à des fins statistiques et celles
> portant sur un montant **supérieur à 5 millions de francs CFA** doivent en outre être
> **domiciliées auprès d'un intermédiaire agréé résident**, sauf lorsqu'il s'agit de
> marchandises en transit. »*

### La sanction

> **Annexe III — Répression des infractions prévue à l'article 124**
> **II. Sanctions applicables aux opérateurs économiques, n° 7** :
> *« Infraction relative à l'article 38 : **non-domiciliation des importations de plus de
> 5 millions de francs CFA** auprès d'un intermédiaire agréé résident.
> **Amende égale à 50 % de la valeur des importations.** »*

### Le calcul sur la DAU `SDSD2-2026-IMP-020399-I`

| | Montant |
|---|---|
| Valeur en douane déclarée | **28 695 705 XAF** |
| Seuil de domiciliation (art. 38) | 5 000 000 XAF → **largement dépassé** |
| Case 23 | **vide** |
| **Amende encourue (50 %)** | **≈ 14 347 852 XAF** |
| *Pour mémoire : total des droits et taxes de la DAU* | *12 043 834 XAF* |

> **L'amende de change encourue est plus élevée que la totalité des droits de douane du
> conteneur.** Tout le travail sur la valeur, le code SH et l'exonération porte sur
> 12 millions. Cette seule ligne en pèse 14.

🔵 **Non vérifié** : si la marchandise avait été déclarée **en transit**, l'art. 38
exclut l'obligation — mais l'art. 39 la rétablit aussitôt *« auprès d'un intermédiaire
agréé du pays de l'importateur »*. L'exception ne ferme donc rien.

---

## 4. La chaîne décrite par Nelson est exacte — et le formulaire BEAC le confirme

Chaîne proposée : **proforma → dossier d'importation à la banque → paiement →
facture commerciale du fournisseur.**

C'est littéralement ce que prévoient les textes.

> **Art. 42 (Règlement des changes)** — *« Pour les règlements des importations ne
> dépassant pas le seuil fixé à l'article 41, **l'intermédiaire agréé doit exiger une
> facture pro forma** ou tout autre document justificatif. »*
> **Art. 41** — *« Les règlements des importations **supérieurs à 100 millions** de francs
> CFA doivent faire l'objet d'une **vérification renforcée** […] »*

Et le formulaire officiel, **Annexe II — « DOMICILIATION D'IMPORTATION »** (BEAC),
demande, **avant tout paiement** :

| Bloc | Champs |
|---|---|
| **Importateur** | Nom ou raison sociale · **Numéro d'inscription au registre de commerce** · Adresse complète · Profession · Immatriculation statistique |
| **Fournisseur** | Nom · Pays d'origine des marchandises · Pays de provenance · Adresse dans le pays de provenance |
| **Marchandise** | Désignation commerciale · Quantité (poids net) · Chapitre · **Nomenclature douanière** · **Bureau de dédouanement** · Valeur **FOB** · Valeur **CAF** · **Échéance fixée pour le règlement** |
| **Signature** | *« Je soussigné, certifie sincères et véritables, les énonciations sur la présente formule. »* |
| **Banque** | Banque domiciliataire · **N° du dossier de domiciliation** |
| **Douanes** | *« Douanes de … · Bureau n° … · **Enregistrée** · Signature et cachet »* |

Deux choses sautent aux yeux :

1. **Le formulaire demande la nomenclature douanière et le bureau de dédouanement.**
   Le dossier bancaire et la déclaration en douane sont **le même dossier**, vu des deux
   bouts. C'est exactement pour ça que la **case 23** existe sur la DAU.
2. **Il y a un cadre « Douanes … Enregistrée … Signature et cachet » en bas du
   formulaire bancaire.** La douane vise la domiciliation. Les deux administrations se
   lisent l'une l'autre.

> **Conclusion : ce qui rend la facture incontestable, ce n'est pas une capture d'écran.
> C'est un numéro de domiciliation dans la case 23.** Une facture adossée à un dossier
> bancaire déclaré, avec une échéance de règlement annoncée à l'avance, ne se conteste
> pas de la même manière qu'une facture seule.

La capture Alipay reste utile — mais c'est ce qu'on montre **quand on n'a rien de mieux**.
Ce n'est pas le plan ; c'est le pansement.

---

## 5. Le mur, encore lui — et il est identique à celui du FIMEX

Le formulaire BEAC exige de l'importateur un **« Numéro d'inscription au registre de
commerce »**.

**Une commerçante du marché informel ne peut pas ouvrir de domiciliation.** Exactement le
même mur qu'au §6 de `voie-b-representation-en-douane.md` (patente + RCCM + carte de
contribuable + CNPS). Ce n'est pas un hasard : **c'est le même mur administratif vu
depuis la banque au lieu du ministère.**

---

## 6. La tension que Nelson a sentie — et pourquoi elle n'en est pas une

Elle est légitime et il faut la nommer :

> *« Si chaque client ouvre son dossier d'importation et fait son virement SWIFT
> lui-même, à quoi sert encore Bonzini Payments ? »*

**Réponse : les clients qui peuvent domicilier et faire un SWIFT ne sont pas ceux qui
utilisent le rail USDT aujourd'hui.** Le service de paiement existe **précisément à cause
de** l'informalité et de la petite taille :

| Pourquoi le client passe par Bonzini | Ce qui change s'il se formalise |
|---|---|
| pas de RCCM → domiciliation impossible | avec RCCM, il peut domicilier |
| SWIFT sur 3 000 USD : frais et délais disproportionnés | reste vrai — le rail Bonzini garde un avantage sur les petits montants |
| le fournisseur de Guangzhou veut Alipay/WeChat, pas un compte USD d'entreprise | reste vrai — **c'est le vrai verrou, côté chinois** |
| contrainte de devises XAF → USD | reste vrai |

**Il n'y a pas de cannibalisation : il y a une segmentation — et c'est exactement la même
que celle du dossier cargo.** Un client qui se formalise ne quitte pas Bonzini Payments
par nécessité ; il y reste par commodité, sur les petits montants et face aux
fournisseurs qui n'acceptent pas le SWIFT.

---

## 7. Le vrai problème structurel : deux rails qui ne se rejoignent jamais

| | Rail bancaire (légal, tracé) | Rail Bonzini (rapide, réel) |
|---|---|---|
| Parcours | client → Afriland XAF → domiciliation → SWIFT → fournisseur | client → XAF → USDT → partenaire chinois → fournisseur |
| Ce qu'il produit | **n° de domiciliation** (case 23) + avis de virement bancaire | une capture d'écran |
| Vu par la douane | dossier vérifiable, visé par les douanes | rien |

**Ces deux rails ne se croisent nulle part.** C'est ça, le problème — pas la capture
d'écran.

### Le déblocage : sous Voie A, c'est **Bonzini** qui doit domicilier

Point souvent manqué : sous le régime actuel (art. 74.4 — Bonzini déclare en son nom
propre), **l'importateur au sens de l'art. 38, c'est Bonzini.** L'obligation de
domiciliation pèse donc sur **Bonzini**, pas sur les clients.

Ce qui donne un montage cohérent avec le modèle réel, sans rien changer aux clients :

1. Le client paie Bonzini **en XAF, au Cameroun** — opération intérieure, tracée, légale.
2. **Bonzini** ouvre **une domiciliation par conteneur**, à son nom, à sa banque — ce qui
   correspond exactement à sa propre DAU.
3. Bonzini règle les fournisseurs **depuis ce dossier domicilié**.
4. La case 23 se remplit, le motif de doute de l'art. 42.2 disparaît, et l'amende de 50 %
   de l'art. 38 s'éteint.

**L'écart à combler est donc un écart bancaire, pas douanier** : aujourd'hui le règlement
sortant ne passe pas par le dossier domicilié. C'est une conversation avec Afriland, pas
avec la douane.

---

## 8. Ce que je n'affirme PAS

🔵 **Art. 18 du Règlement des changes** — *« Les opérations de **change manuel** portant
sur des montants supérieurs à 1 million de francs CFA doivent être effectuées par les
intermédiaires agréés »*, sanctionné par une **amende de 20 % de l'opération** (Annexe
III, II, n° 2). Le texte vise le **change manuel** (billets). **Savoir si une conversion
XAF → USDT tombe sous cet article n'est pas tranché par ce document.** Je ne l'affirme
pas. C'est une question pour un conseil en réglementation bancaire CEMAC, ou pour la
COBAC.

🔵 **Afriland acceptera-t-elle de domicilier au nom de Bonzini** pour des marchandises
que Bonzini ne possède pas ? Le formulaire BEAC ne l'interdit pas — il demande un
importateur avec un RCCM, ce que Bonzini a. Mais c'est **la question à poser à la banque**,
et elle est décisive.

🔵 **Le régime d'établissement de paiement / EMF (COBAC)** — existe-t-il un agrément qui
permettrait à Bonzini d'opérer légalement son rail de paiement ? **Non étudié.** C'est
le sujet suivant.

---

## 9. Ce qu'il faut faire, dans l'ordre

| # | Action | Qui | Urgence |
|---|---|---|---|
| 1 | **Vérifier si une domiciliation existait** pour le conteneur MRSU9909331 et n'a pas été reportée en case 23 — ou si elle n'a jamais été ouverte | Bonzini + Aoudou | **immédiate** |
| 2 | Si mainlevée non accordée : voir art. 162 (la **valeur** est rectifiable ; l'espèce ne l'est pas) | Citra | **immédiate** |
| 3 | Ouvrir un **dossier de domiciliation au nom de Bonzini** à Afriland pour le prochain conteneur | Bonzini | prochain conteneur |
| 4 | Demander à Afriland : peut-elle domicilier pour un groupeur ? Quelles pièces ? Quel délai ? Peut-on domicilier **un conteneur** plutôt qu'une facture ? | Bonzini | cette semaine |
| 5 | Remplir la case 22 (fret + assurance ventilés) et joindre la déclaration des éléments de la valeur (art. 156.4) | Citra | prochain conteneur |
| 6 | Étudier le régime d'**établissement de paiement COBAC** pour Bonzini Payments | — | sujet suivant |

---

## Sources

- **Code des douanes CEMAC, révision 2019** — art. 30.1, 42.2, 156.4.
- **Règlement des changes CEMAC** n° 02/18/CEMAC/UMAC/CM du 21 décembre 2018 — art. 17,
  18, 38, 39, 41, 42, 43, 44 ; **Annexe II** (formulaire « Domiciliation d'importation ») ;
  **Annexe III**, II. Sanctions applicables aux opérateurs économiques, n° 2 et n° 7.
- **Loi camerounaise n° 75-14 du 8 décembre 1975** — assurance obligatoire des facultés
  à l'importation.
- DAU `SDSD2-2026-IMP-020399-I` du 17/09/2026 — cases 22 et 23, valeur en douane
  28 695 705 XAF, droits et taxes 12 043 834 XAF.

# Y a-t-il un agrément qui légalise le rail USDT ?

> Question posée par Nelson Soh. **Réponse vérifiée : non — et le piège est plus
> retors que ça : l'agrément qui existe *fermerait* le rail au lieu de l'ouvrir.**
> Ce document expose les textes, marque ce qui n'est pas vérifié, et décrit le montage
> qui, lui, tient.

---

## 1. Ce que fait Bonzini Payments est **déjà** un service de paiement réglementé

Texte applicable : **Règlement n° 04/18/CEMAC/UMAC/COBAC du 21 décembre 2018 relatif
aux services de paiement dans la CEMAC.**

> **Art. 3** — *« Sont des services de paiement, les activités suivantes […]*
> *5. les **services de transmission de fonds**, ne faisant pas intervenir de compte soit
> du payeur, soit du bénéficiaire ou des deux ; »*

Un client remet des XAF ; un fournisseur en Chine reçoit de la valeur ; aucun compte
bancaire du payeur ni du bénéficiaire n'intervient. **C'est la définition littérale de
l'art. 3-5.** L'activité n'est pas dans une zone grise : elle est nommée dans le texte.

### Qui a le droit de l'exercer

> **Art. 5** — *« Sont habilités à exercer en qualité de prestataire de services de
> paiement, les **établissements de crédit**, les **établissements de microfinance** et les
> **établissements de paiement agréés** ou habilités conformément aux dispositions du
> présent règlement. »*

> **Art. 23** — *« L'exercice en qualité de prestataire de services de paiement sur le
> territoire de l'un des États de la CEMAC est subordonné à l'**agrément de l'Autorité
> Monétaire Nationale**, délivré après **avis conforme de la Commission Bancaire**. »*

**« Autorité monétaire nationale »** = le **Ministre en charge de la monnaie et du crédit**
de l'État d'implantation (art. 2-1). Au Cameroun : le MINFI.

### Ce qui arrive sans agrément

> **Art. 84** — *« […] Sans préjudice des mesures et sanctions prévues par la
> réglementation en vigueur, **l'Autorité monétaire est habilitée à procéder à la
> fermeture d'office des établissements qui fournissent à titre de profession habituelle
> des services de paiement, sur le territoire de son État, sans avoir été agréés**
> conformément au présent règlement. »*

Pas une amende : une **fermeture d'office**.

🔵 **Capital minimum d'un établissement de paiement : 500 000 000 FCFA**
(Règlement COBAC R-2019/02). **Source secondaire — non vérifiée sur le texte COBAC.**

---

## 2. Mais l'agrément ne couvre pas l'USDT — la définition de « fonds » l'exclut

> **Art. 2, définition 10 — Fonds** : *« la **monnaie fiduciaire** (billets de banque et
> les pièces), la **monnaie scripturale** et la **monnaie électronique** ; »*

Trois éléments. **Les crypto-actifs n'y figurent pas.** Et la monnaie électronique, au
sens de l'art. 86 du même règlement, est une créance *« sur l'émetteur »*, émise *« à la
valeur nominale »* — ce qu'un stablecoin émis hors CEMAC par un tiers non agréé n'est pas.

Donc : un agrément d'établissement de paiement autorise à transmettre des **fonds** au
sens de l'art. 2-10. **Il n'autorise pas à transmettre de l'USDT.**

---

## 3. 🔴 Le piège : demander l'agrément fait **tomber** Bonzini sous l'interdiction

**Décision COBAC D-2022/071 du 6 mai 2022**, relative à la détention, l'utilisation,
l'échange et la conversion des cryptomonnaies ou cryptoactifs **par les établissements
assujettis à la COBAC**.

Ce qu'elle interdit à ces établissements : intervenir de quelque manière que ce soit,
**pour leur compte propre ou pour le compte de tiers**, dans l'acquisition, la détention,
le transfert ou la conversion de cryptoactifs.

**Le champ est la clé.** Elle vise *les établissements assujettis à la COBAC* :
établissements de crédit, de microfinance, **et établissements de paiement** (régulés par
la COBAC depuis 2018).

| | Assujetti à la COBAC ? | La décision D-2022/071 s'applique ? |
|---|---|---|
| **Bonzini aujourd'hui** (sans agrément) | non | **non — elle ne le lie pas directement** |
| **Bonzini agréé établissement de paiement** | **oui** | **oui — interdiction pleine** |

> **Le paradoxe : l'agrément ne légalise pas le rail USDT. Il l'interdit.**
> Aujourd'hui Bonzini est hors du champ de l'interdiction précisément parce qu'il est
> hors du champ de la supervision. Demander l'agrément, c'est entrer dans les deux à la
> fois.

🔵 **Non vérifié** : le texte intégral de la décision D-2022/071 n'a pas été lu à la
source. L'analyse ci-dessus repose sur une **analyse doctrinale** (Pr Yvette Rachel
Kalieu Elongo) et sur le communiqué de presse de la COBAC. **À confirmer sur le texte
avant toute décision.** L'auteur relève par ailleurs qu'il s'agit d'une *décision*
(portée individuelle) et non d'un *règlement* (portée générale), ce qui limite sa force
obligatoire aux entités désignées.

---

## 4. Et même agréé, Bonzini ne pourrait pas exécuter le virement international

C'est la deuxième impasse, et elle est indépendante de la première.

> **Règlement des changes CEMAC n° 02/18 du 21 décembre 2018, définition 14 —
> Intermédiaires agréés** : *« Sont considérés comme intermédiaires agréés :*
> *— les **établissements de crédit** au sens de la Convention du 17 janvier 1992 […] ;*
> *— l'**administration des postes** ;*
> *— les **bureaux de change agréés** par les autorités compétentes pour les opérations de
> change manuel. »*

**Les établissements de paiement ne sont pas dans la liste.**

Conséquences directes :
- **Art. 38** : la domiciliation d'une importation > 5 M XAF doit se faire *« auprès d'un
  **intermédiaire agréé résident** »* → un établissement de paiement **ne peut pas
  domicilier**.
- Le règlement de l'importation vers l'étranger relève des intermédiaires agréés
  (art. 17, 41, 42) → un établissement de paiement **ne peut pas l'exécuter**.

> **Même avec l'agrément et les 500 millions de capital, la jambe internationale resterait
> chez la banque.** L'agrément ne rachète pas la case 23.

---

## 5. L'autre porte : COSUMAF / PSAN — pourquoi elle ne s'ouvre pas non plus

Deux régulateurs coexistent en CEMAC et ne disent pas la même chose.

- **Règlement n° 01/22/CEMAC/UMAC/CM/COSUMAF du 21 juillet 2022** (marché financier) :
  introduit les notions d'**« actifs numériques »** et **« jetons numériques »**.
- **Règlement général de la COSUMAF du 23 mai 2023** : établit le cadre des **PSAN**
  (prestataires de services sur actifs numériques), soumis à agrément de la COSUMAF.

Trois raisons pour lesquelles cette porte ne résout pas le problème de Bonzini :

1. **Le champ du PSAN ne couvre pas le paiement transfrontalier.** Les services PSAN sont
   la **conservation** d'actifs numériques pour compte de tiers, l'**achat/vente** d'actifs
   numériques contre monnaie ayant cours légal, et l'**exploitation d'une plateforme de
   négociation**. Payer le fournisseur chinois d'un importateur n'en fait pas partie.
2. **Le statut monétaire est expressément refusé** : l'apparition des cryptoactifs dans le
   corpus réglementaire du marché financier *« ne confère pas aux cryptomonnaies le statut
   juridique de monnaie dans la zone CEMAC »*. Le Gouverneur de la BEAC : *« pour tous les
   pays de la zone CEMAC, la seule monnaie est le franc CFA »*.
3. 🔵 **Aucun agrément PSAN n'a été délivré à ce jour**, et aucune instruction spécifique
   n'a été publiée pour cette catégorie d'acteurs. **Source secondaire (analyse d'avocat),
   à vérifier auprès de la COSUMAF.**

> COSUMAF encadre les actifs numériques comme **produits financiers**. COBAC les interdit
> comme **instruments bancaires**. Aucune des deux portes ne mène à un rail de paiement
> crypto pour des importations.

---

## 6. Ce qui reste — et qui tient debout

### La piste légère : le statut de **distributeur**

> **Art. 2, définition 9 — Distributeur et sous-distributeur** : *« toute personne
> physique ou morale proposant des services de paiement à sa clientèle, **au nom et pour
> le compte d'un ou plusieurs prestataires de service de paiement agréé** ; »*

Bonzini peut **distribuer** les services d'un prestataire agréé sans porter lui-même
l'agrément ni les 500 millions de capital. C'est le statut sous lequel opèrent la plupart
des réseaux de mobile money.

### L'architecture cible

| Jambe | Qui l'opère | Ce que ça produit |
|---|---|---|
| **Collecte XAF au Cameroun** | Bonzini, comme **distributeur** d'un PSP agréé — ou directement via son compte Afriland | opération intérieure, tracée |
| **Domiciliation de l'importation** | **la banque** (intermédiaire agréé) | **le n° de la case 23** |
| **Règlement international vers le fournisseur** | **la banque**, depuis le dossier domicilié | avis de virement = preuve de paiement de niveau douanier |
| **Relation client, agrégation, logistique, plateforme** | **Bonzini** | la valeur ajoutée réelle, et elle n'est pas réglementée |

**Ce que ça coûte** : le spread USDT, qui est aujourd'hui une part de la marge.
**Ce que ça achète** : la case 23 remplie, l'extinction de l'amende de 50 % de l'art. 38
(≈ 14 347 852 XAF sur le seul conteneur MRSU9909331), et une activité qui peut croître
sans exposition à une fermeture d'office.

### Le verrou qui reste, et il est réel

Le vrai obstacle n'est pas camerounais, il est **chinois** : un petit fournisseur de
Guangzhou veut être payé sur Alipay ou WeChat, pas par SWIFT sur un compte USD
d'entreprise. C'est ce verrou-là qui a fait naître le rail USDT, et **aucun agrément
CEMAC ne le déverrouille.**

🔵 **Piste non étudiée** : les canaux de règlement **CNY** (RMB) — banques correspondantes,
comptes CNY, ou les accords de règlement en monnaie locale. Si le fournisseur peut être
payé en CNY depuis une banque camerounaise, le problème change de nature. **À creuser.**

---

## 7. Ce que je n'ai pas vérifié

| # | Point | Pourquoi ça compte |
|---|---|---|
| 1 | Texte intégral de la **décision COBAC D-2022/071** | toute la §3 repose dessus |
| 2 | **500 M FCFA** de capital minimum (R-2019/02) | source secondaire |
| 3 | **Aucun agrément PSAN délivré** | source secondaire (analyse d'avocat) |
| 4 | Textes CEMAC **postérieurs à mai 2023** sur les crypto-actifs | le cadre peut avoir bougé |
| 5 | Statut réglementaire du **partenaire chinois**, côté chinois | hors périmètre de cette analyse |
| 6 | Existence d'un **canal CNY** exploitable depuis le Cameroun | pourrait tout changer |

---

## Sources

- **Règlement n° 04/18/CEMAC/UMAC/COBAC du 21 décembre 2018** relatif aux services de
  paiement dans la CEMAC — art. 2 (déf. 1, 9, 10), 3, 5, 23, 84, 86.
  [BEAC](https://www.beac.int/wp-content/uploads/2019/07/REGLEMENT-N-04-18-CEMAC-UMAC-COBAC-du-21-décembre-2018.pdf)
  · [SGG Congo](https://www.sgg.cg/txts-droit-reg/cemac-reglement-2018-04-services-paiement.pdf)
- **Règlement des changes CEMAC n° 02/18/CEMAC/UMAC/CM du 21 décembre 2018** — art. 17,
  38, 41, 42 ; définition 14 (intermédiaires agréés) ; Annexe III, II, n° 7.
- **Décision COBAC D-2022/071 du 6 mai 2022** — analyse du
  [Pr Yvette Rachel Kalieu Elongo](https://kalieu-elongo.com/reglementation-des-crypto-monnaies-dans-la-cemac-breves-remarques-sur-la-decision-cobac-d-2022-071-du-6-mai-2022-relative-a-la-detention-lutilisation-lechange-et/)
  · [Communiqué COBAC](https://www.finances.gouv.cg/fr/communiqué-de-presse-de-la-cobac-relatif-à-linterdiction-de-lutilisation-des-crypto-actifs-dans-la)
- **Règlement général de la COSUMAF du 23 mai 2023** —
  [cosumaf.org](https://cosumaf.org/wp-content/uploads/2023/06/NOUVEAU-RG-COSUMAF-23-Mai-2023.pdf)
  · analyse [Village de la Justice](https://www.village-justice.com/articles/reglement-general-cosumaf-mai-2023-premier-cadre-communautaire-des-prestataires,57886.html)
- Position de la BEAC :
  [Investir au Cameroun, 18 novembre 2022](https://www.investiraucameroun.com/finance/1811-18733-cemac-malgre-l-admission-des-cryptos-le-gouverneur-de-la-beac-deconseille-d-investir-dans-ces-actifs)

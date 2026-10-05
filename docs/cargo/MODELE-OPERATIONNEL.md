# Comment Bonzini fait le maritime : le modèle opérationnel

> **À lire avant tout travail sur le cargo.** Expliqué par Nelson Soh, directeur des
> opérations, le 01/10/2026. Ce qui n'a pas encore été confirmé est marqué *(à confirmer)*.

---

## 1. Les deux entités

| Entité | Où | Rôle |
|---|---|---|
| **NORTON GAUSS BONZINI SARL** | Douala (Bépanda), Cameroun | importateur, **destinataire** (*consignee*) des conteneurs. NIU M091712668533F, régime réel |
| **La société Bonzini en Chine** | Guangzhou | **un bureau** et **un entrepôt**, à deux adresses différentes. Raison sociale *(à compléter)* |

---

## 2. Qui fait quoi, du fournisseur chinois au client camerounais

| # | Étape | Qui la fait |
|---|---|---|
| 1 | Le client achète sa marchandise chez son fournisseur chinois | **le client** |
| 2 | Le fournisseur livre le colis à l'entrepôt Bonzini de Guangzhou | le fournisseur |
| 3 | **Réception, enregistrement, mesures** (poids, dimensions), **information du client** que son colis est arrivé | **Bonzini, entrepôt de Guangzhou** |
| 4 | **Organisation des départs** et **chargement des colis des clients dans le conteneur** (le groupage) | **Bonzini, entrepôt de Guangzhou** |
| 5 | Packing list du conteneur | Bonzini, entrepôt *(à confirmer)* |
| 6 | **Booking** : réserver la place du conteneur sur le navire (Maersk, CMA CGM…) | **le transitaire en Chine** |
| 7 | **Camion** : amener le conteneur vide à l'entrepôt, puis le conteneur plein au port | **le transitaire** |
| 8 | **Douane d'export chinoise** | **le transitaire** |
| 9 | Figurer comme **chargeur** (*shipper*) sur le BL et **détenir les originaux** | le transitaire (sa société) |
| 10 | Au Cameroun : BESC, DI, CIVIC, déclaration, sortie du port | le ou la **déclarant(e) agréé(e)** mandaté(e) par Bonzini |
| 11 | Livraison des colis aux clients | **Bonzini** |

**Argent** : les clients paient le fret **à Bonzini**, qui est leur transporteur. Bonzini
paie le transitaire (fret maritime, camion, douane d'export).

---

## 3. Le transitaire : comment on l'appelle

En français : **transitaire** (ou commissionnaire de transport). En anglais : *freight
forwarder*. En chinois : **货代** (*huòdài*). Il réserve la place (booking), fait le
camionnage (拖车, *tuōchē*) et la déclaration d'export (报关, *bàoguān*).

| Conteneur | Transitaire | Chargeur sur le BL |
|---|---|---|
| MRSU9909331 (août 2026) | HIGH GOAL LOGISTICS (GD) LTD | YSH GROUP CO LIMITED |
| **MIEU3611115 (octobre 2026)** | **Eric** | **KASSUMAYE PARTNER SARL** (la société d'Eric) |

Le transitaire **peut changer d'un conteneur à l'autre**.

---

## 4. Les conséquences pratiques, pour ne pas se tromper

| Question | Qui a la réponse |
|---|---|
| Combien de colis, quoi, à quel client appartient chaque colis | **notre entrepôt de Guangzhou**, pas le transitaire |
| Les factures des marchandises | **nos clients** : ce sont eux qui ont acheté |
| Le booking, la facture de fret, du camion et de la douane d'export | le transitaire |
| Le certificat VGM (poids du conteneur plein), la déclaration d'export chinoise | le transitaire |
| Les originaux du BL, le télex release | le transitaire, puisqu'il est le chargeur |

---

## 5. L'objectif : reprendre le contrôle

Une fois toute la chaîne comprise, Bonzini veut faire **lui-même** ce que fait le
transitaire : booking, camion, douane d'export.

**Levier principal** : si la société Bonzini en Chine devient le **chargeur** sur le BL,
c'est Bonzini qui détient les originaux. Le télex release ne dépend alors plus d'un tiers.

---

## 6. L'aérien : les paquets de 32 kg (05/10/2026)

Expliqué par Nelson lors de la réunion du 05/10. Pour l'avion, le colis n'est pas l'unité qui voyage :

| # | Étape | Où, qui | Dans la plateforme |
|---|---|---|---|
| 1 | Le colis avion est reçu au **bureau** de Guangzhou, pesé, étiqueté (`RC-000123-01`) | réception (`/r`) | dépôt « bureau » (`location = 'office'`) |
| 2 | Les colis sont regroupés dans des **paquets de 32 kg au plus** ; un paquet réunit des colis de plusieurs clients, un client peut avoir des colis dans plusieurs paquets | réception (`/r/paquets`) | `air_packages` (`PQ-000001`), scan des étiquettes, jauge 32 kg |
| 3 | Le paquet est **fermé, pesé** (poids brut ≤ 32 kg) et reçoit **son étiquette** | réception | `air_package_seal`, étiquette PQ (QR + code-barres) |
| 4 | Les paquets sont **affectés** à une expédition (LTA, vol, date) — la LTA peut venir plus tard | cargo (`/m/cargo/avion`) | `air_package_assign` ; LTA provisoire `PROV-…` |
| 5 | Les paquets sont **scannés au départ** ; l'expédition ne part pas tant qu'il en manque un | réception ou cargo | `air_package_scan_departure` |
| 6 | L'aéroport peut **refuser** un paquet (avant ou après le départ) : il revient au bureau avec ses colis et repart par une autre expédition | cargo | `air_package_refuse` |
| 7 | À Douala, l'équipe amène les paquets à l'entrepôt ; le responsable vérifie qu'**ils sont tous là** | entrepôt (`/w`) | `air_package_receive` : « paquets reçus X / Y » |
| 8 | Il **ouvre chaque paquet** et **pointe chaque colis** | entrepôt | `air_package_open`, pointage existant (pointer un colis ouvre son paquet) |

Le maritime suivra le même modèle plus tard (colis → unités de chargement → conteneur).

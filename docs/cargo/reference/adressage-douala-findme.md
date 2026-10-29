# Adresses à Douala : le problème, et FindMe (29/10/2026)

> ⚠️ Données d'entreprise. Dépôt privé, ne pas diffuser.
>
> Recherche faite le 29/10/2026. Officiel = texte de l'État, de la CEMAC ou journal de
> l'État. Le reste (presse, blog, site de FindMe) est signalé comme tel.

## Le problème de fond

À Douala, la plupart des lieux n'ont **ni nom de rue ni numéro**. On guide par repères
(« en face de », « après le carrefour ») et par téléphone. La boîte postale (BP) n'est pas
une adresse de lieu : c'est une case au bureau de poste (Cameroon Tribune, 05/11/2024).

Le problème a **deux faces** qu'il ne faut pas confondre :

| | Trouver un lieu | Prouver un lieu |
|---|---|---|
| Pour qui | client qui vient retirer, livreur, camion du conteneur | banque, impôts, partenaires, documents officiels |
| Ce qu'il faut | un lien GPS qui ouvre l'itinéraire | un document reconnu |
| Outils | lien Google Maps, Plus Code, lien FindMe, position WhatsApp | PLP FindMe certifié Campost |

Chez Bonzini, il coûte à cinq endroits :

1. **Retrait des colis.** La notification dit seulement « Vos N colis vous attendent à notre
   entrepôt de Douala. Présentez votre code client. »
   (`supabase/migrations/20260921170000_cargo_client_notifications.sql:230`). Aucun lieu,
   aucun lien. Annie guide chaque client au téléphone.
2. **Livraisons.** La fiche client n'a que `city` et `neighborhood`
   (`src/integrations/supabase/types.ts`, table `clients`). Pas de position précise.
3. **Le camion du conteneur** (Kribi vers notre magasin) : il doit trouver le magasin. La
   détention Maersk court 2 jours après la sortie du terminal, puis 15 000 F par jour.
4. **Banque et administration** : elles demandent un plan de localisation (pratique, voir
   plus bas). Notre siège n'a pas d'adresse fixée : `src/lib/companyIdentity.ts` écrit
   « Douala, Cameroun » seulement.
5. **Nos documents** (devis, factures, bon de retrait) disent « Entrepôt de Douala,
   Cameroun » (`src/lib/pdf/templates/ReleaseNotePDF.tsx:61`), sans lieu.

## Ce que la loi exige vraiment

Règlement n° 01/CEMAC/UMAC/CM du 11/04/2016 sur la lutte contre le blanchiment (copie
officielle sgg.cg, relu sur le scan le 29/10/2026) :

- **Art. 30** : une personne physique s'identifie par « un document officiel original en
  cours de validité et comportant une photographie ». Pas d'adresse exigée.
- **Art. 31** : une société s'identifie par ses statuts et tout document établissant
  qu'elle « a une existence réelle ».
- **Art. 36** (virements) : nom, compte et « l'adresse ou, **en l'absence d'adresse**, le
  numéro d'identification nationale ou le lieu et la date de naissance ». Le texte lui-même
  prévoit qu'il n'y ait pas d'adresse.
- **Art. 6, points 14 et 22** : sont soumises à ces obligations les « entreprises de
  transport et de transfert de fonds » et « tous les prestataires intervenant dans la
  chaîne d'importation-exportation ». Bonzini l'est donc aussi, pour ses propres clients.
- Ce texte a été révisé par le Règlement n° 02/24/CEMAC/UMAC/CM du 20/12/2024 (presse :
  droitmediasfinance.com). **Non lu.**

Donc : le « plan de localisation » est une **pratique** des banques et de l'administration,
pas une exigence écrite de la loi CEMAC de 2016. Des guides privés (non officiels :
infospratiques.cm, lefisk.cm) disent que la DGI demande un « plan de localisation signé sur
l'honneur » pour l'immatriculation ; liste officielle non trouvée.

## FindMe

### Ce qu'ils vendent (leur site, adresse-findme.house, lu le 29/10/2026)

- Une **adresse numérique gratuite** : coordonnées GPS, lien partageable, « visible sur
  Google Maps ». Inscription par numéro de téléphone (WhatsApp) et code.
- Un **Plan de Localisation Postal (PLP)** payant, « délivré en partenariat avec la
  CAMPOST » : **5 000 F pour une entreprise**, 2 000 F pour un ménage. Récépissé numérique
  tout de suite, PLP envoyé après vérification. Le PLP porte un QR code ; contrôle
  d'authenticité sur `https://www.infos.house/controle` (page « Authentifier un PLP »).
- Normes annoncées : UPU S42 et AFNOR NF Z 10-011 (non vérifié).
- Contacts publiés : appel +237 683 050 066, WhatsApp +237 687 061 395,
  contact@findme.house. Adresse affichée : 17 place Elig-Essono, Yaoundé.

### Ce qui est confirmé ailleurs

| Fait | Source | Type |
|---|---|---|
| Convention Campost et FindMe signée le 01/11/2024 à Yaoundé par le DG de la Campost (Pierre Kaldadak) et le PDG de FindMe (Brandon Wanguep). PLP « édité par Campost » à 2 000 F ; l'adresse gratuite n'est « pas immédiatement certifiée » | Cameroon Tribune, 05/11/2024 | journal de l'État |
| Microfinance CECEC : PLP intégré aux ouvertures de compte et au crédit (15/11/2024) | Journal du Cameroun | presse |
| Convention CCA Bank, Campost et FindMe (17/06/2025, Finance Week) : PLP pour l'ouverture de compte et le crédit | ecomatin.net, financeweek.net | presse |
| Créée en 2021 ; environ 15 000 adresses générées à mi-2025 ; financement d'amorçage annoncé de 300 000 € | launchbaseafrica.com, 19/06/2025 | presse |
| Application « FindMe » (paquet `house.findme`) : 50 000+ téléchargements, 4,1/5 sur 109 avis, mise à jour le 29/09/2026 ; éditeur FINDME CAMEROON SARL | Google Play, lu le 29/10/2026 | magasin d'applications |

Le site de la Campost (campost.cm) ne répondait pas pendant la recherche (erreur 502).

### Points d'attention

- Le site garde beaucoup de **textes du modèle WordPress** : équipe en partie fictive
  (« Julian Wyat », « Archer Graham »), témoignages notés « 4,5 sur 1 234 avis » à
  l'identique, adresse « 112, CHA-100, USA ». Pas grave en soi, mais peu soigné.
- **Deux adresses** de la société : Yaoundé Elig-Essono (site) et « Centre Commercial,
  Nkoabang Mfou » (Google Play). Numéro d'assistance Google Play français (+33).
- Avis Google Play de 2024 et 2025 : **blocages à l'inscription** (code reçu, bouton qui
  ne valide pas).
- **Aucune API ni offre entreprise publiée** trouvée.
- Le PLP vaut ce que les banques en font. **Notre banque l'accepte-t-elle ?** Non vérifié :
  à lui demander.
- La localisation d'un domicile est une donnée personnelle sensible (pour nos clients).

## Ce qu'on fait

1. **Annie** crée les adresses FindMe sur place (boutique de Bépanda Omnisport, magasin,
   bureau s'il est ailleurs), avec un **numéro de l'entreprise**, pas son numéro personnel,
   et demande un PLP entreprise par site (5 000 F chacun).
2. **Gratuit, en parallèle** : fiche Google (Google Business Profile) pour la boutique, et
   le lien Google Maps de chaque site.
3. **Demander à notre banque** si elle accepte le PLP FindMe.
4. **Dans l'application**, une fois les liens reçus :
   - une seule source pour l'adresse de nos sites (`companyIdentity.ts`) ;
   - le lien de l'entrepôt dans la notification « colis prêts » et sur le bon de retrait ;
   - l'adresse sur les devis et factures ;
   - plus tard, un champ « lien de localisation » sur la fiche client pour les livraisons
     (le client crée son adresse FindMe gratuite ou envoie sa position WhatsApp).

## Questions à poser à FindMe

1. Le PLP entreprise coûte bien 5 000 F par site ? Délai ? Paiement Mobile Money ?
   Facture au nom de NORTON GAUSS BONZINI SARL ?
2. Le PLP porte-t-il le nom ou le cachet de la Campost ? Pouvez-vous envoyer un exemple ?
3. Quelles banques l'acceptent aujourd'hui ?
4. Le lien de l'adresse reste-t-il valable si on change de téléphone ? Et si FindMe arrête ?
5. Avez-vous une offre entreprise : adresses pour nos clients, plaque ou QR code à poser à
   l'entrée, intégration dans notre application (API) ?
6. Qui peut voir nos adresses ? Les données sont-elles partagées ?

## Sources

- FindMe : adresse-findme.house (accueil, /authentifier-un-plp/, /equipe/, article
  « Finance Week 2025 ») ; Google Play `house.findme`.
- Cameroon Tribune, « Services postaux : un citoyen, une adresse », 05/11/2024 :
  cameroon-tribune.cm/article.html/67781.
- Règlement n° 01/CEMAC/UMAC/CM du 11/04/2016 : sgg.cg/txts-droit-reg/
  cemac-reglement-2016-01-prevention-repression-blanchiment-capitaux-finances-terrorisme.pdf
  (art. 6, 21, 30, 31, 36).
- Presse : journalducameroun.com, ecomatin.net, financeweek.net, launchbaseafrica.com,
  businessincameroon.com.
- Guides privés : infospratiques.cm, lefisk.cm (DGI, plan de localisation).

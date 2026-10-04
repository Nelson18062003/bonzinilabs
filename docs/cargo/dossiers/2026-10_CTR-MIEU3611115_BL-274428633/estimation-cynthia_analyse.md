# Estimation de Cynthia AKAH : analyse ligne par ligne

> Pièce : « ESTIMATE FOR CONTAINER MIEU3611115 with 3 Cars from CHINA » (PDF Word, 2 pages).
> Métadonnées : auteur « Nyongvolla Enzo-T », créé le 22/09/2026. Analyse du 29/09/2026.
>
> ⚠️ Données d'entreprise. Dépôt privé, ne pas diffuser.

## Les totaux

| | Écrit | Recalculé | Écart |
|---|---|---|---|
| Frais (22 lignes, page 1) | 5 742 850 | **6 032 850** | **290 000** |
| Véhicules (page 2) | 11 160 404 | 11 160 404 | 0 |
| **Total final** | 16 903 254 | **17 193 254** | **290 000** |

Aucune ligne seule ni aucune combinaison de 2 ou 3 lignes ne vaut 290 000 : ce n'est pas une ligne oubliée évidente.

## Identification

- Nom du déclarant : absent du document.
- Société : absente, aucun en-tête.
- NIU : absent.
- RCCM : absent.
- Agrément de commissionnaire en douane (art. 149 du Code des douanes CEMAC 2019, cd2019.txt l.2598-2600 : nul ne peut déclarer pour autrui sans agrément) et code déclarant CAMCIS (exemple d'août : H0451, BNG TRANS SARL, nouveau.txt l.19-21) : absents.
- Date : aucune dans le corps du document. Métadonnées PDF (lues par pypdf, vérifié) : créé le 22/09/2026 à 07:11:02 −07:00, soit 15:11 à Douala, avec Microsoft Word LTSC.
- Auteur dans les métadonnées : « Nyongvolla Enzo-T », et non Cynthia AKAH. À faire expliquer.
- Durée de validité : aucune.
- Signature et cachet : aucun.
- Destinataire : aucun. Ni Norton Gauss Bonzini ni le n° de BL 274428633 ne figurent ; seul le n° de conteneur MIEU3611115 est cité. Titre en anglais, avec des fautes (MISCELLANOUS, RAPORT, SIESIR).
- Conclusion : c'est une note de travail, pas une proforma opposable.

## Les 22 lignes de frais

| Ligne | Montant | Nature probable | Équivalent CITRA | Avis | Question à poser |
|---|---|---|---|---|---|
| **FICH** | 12 500 | inconnu (hypothèse non vérifiée : « fiche », par ex. fiche GUCE ou inscription au fichier des importateurs) | aucun | Libellé obscur. Petit montant, mais il faut savoir à qui il est payé. | Que recouvre FICH, à quel organisme est-il payé, et quel reçu nous remettrez-vous ? |
| **SIESIR** | 6 000 | inconnu (hypothèse non vérifiée : « saisie », frais de saisie de la déclaration) | aucun | Libellé obscur, probablement mal orthographié. Montant faible. | SIESIR : s'agit-il des frais de saisie ? Est-ce un débours sur reçu ou votre prestation ? |
| **PAD** | 100 000 | frais portuaire (redevance du port autonome) | PAK 100 000 (proforma CIT26099) | Le montant est identique à CITRA, mais le libellé est faux. C'est l'indice que le devis a été bâti sur un modèle de Douala : il faut vérifier que chaque poste existe bien à Kribi, notamment l'acconage KCT, qui est absent. | PAD désigne Douala : confirmez-vous qu'il s'agit du PAK de Kribi ? Votre devis a-t-il été fait sur un modèle de Douala ? |
| **CIVIC/SGS** | 91 000 | débours officiel (taxe de vérification CIVIC, demande sur e-FORCE) | CIV 3 × 31 000 = 93 000 | Cohérent. L'écart de +1 561 correspond vraisemblablement à des arrondis ou des frais de paiement. Vérifié par le calcul. | La demande CIVIC des 3 châssis est-elle déjà déposée sur e-FORCE ? Sinon, quand ? |
| **MANU** | 215 000 | frais portuaire ou de terminal (manutention), probable | aucune ligne de manutention distincte ; CITRA a « acconnage KCT 405 273 » | À justifier. Possible chevauchement avec MACHINE CHARGES et BLOCKING : dépotage et désarrimage des véhicules ? | MANU : quelle opération (dépotage, positionnement pour la visite) ? Facturée par qui (KCT, acconier) ? Avec quelle facture ? |
| **FRAIS** | 78 850 | frais armateur probable (frais de BL ou de documentation Maersk) | Frais de BL 72 700 | Libellé trop vague, et 6 150 de plus que la facture Maersk type. Plausible, mais à justifier par la facture de l'armateur. | FRAIS : est-ce la facture Maersk de frais de BL ? Pouvez-vous nous transmettre la facture ? |
| **VISIT DOUANE** | 180 000 | frais liés à la visite physique (débours de terminal ou prestation), non ventilés | Visite Douane 250 000 (+ Vacation Douanes 75 000) | 70 000 de moins que CITRA. Il faut savoir si la vacation est comprise. | Les 180 000 comprennent-ils la vacation des agents ? Qui encaisse, et contre quel reçu ? |
| **TRANSPORT** | 420 000 | prestation de transport routier (transporteur) | Transport-livraison Kribi-Douala + caution 780 000 | 360 000 de moins que CITRA, mais la destination et la caution du conteneur ne sont pas précisées. Les deux montants ne sont donc pas comparables en l'état. | Transport de Kribi jusqu'où exactement (Douala, Bépanda) ? La caution conteneur Maersk est-elle comprise ? Le retour du vide ? Qui assure la marchandise pendant le trajet ? |
| **ATTESTATION** | 6 000 | inconnu | aucun | Libellé incomplet : on ne sait pas de quelle attestation il s'agit. | Quelle attestation, délivrée par qui ? |
| **D.I** | 7 000 | débours officiel probable (frais de dépôt d'une Déclaration d'Importation sur e-FORCE ?), non vérifié | aucun : CITRA soutient qu'un conteneur avec véhicules n'est soumis ni à la DI ni au RVC (courriers/02_reponse-citra-et-suites.md l.27) | Point majeur. La présence de cette ligne laisse penser que la déclarante juge la DI nécessaire, contrairement à CITRA. Or 7 000 est incompatible avec les 0,95 % de la DI SGS. | Une DI est-elle requise pour ce conteneur ? Que couvrent les 7 000 ? Où sont les frais d'inspection ou de DI SGS ? Merci de nous donner votre position par écrit, avec son fondement. |
| **BESC** | 322 000 | débours officiel (CNCC) | BESC 3 × 151 000 = 453 000 | 322 000 ne correspond ni à 1 × 151 000, ni à 3 × 151 000, ni à 196 000. URGENT : avec une arrivée le vendredi 02/10, la limite des 48 h tombe le mercredi 30/09, et la validation CNCC peut prendre 24 h (l.116). Le BESC doit être soumis aujourd'hui. | Comment arrivez-vous à 322 000 (combien de BESC, à quel tarif, pénalité de régularisation comprise ?) ? Pouvez-vous le soumettre aujourd'hui 29/09 ? |
| **SCANNER** | 85 000 | frais portuaire (passage au scanner) | Scanner + TVA scanner 101 500 | Cohérent s'il est hors taxes. La TVA, environ 16 400, n'apparaît nulle part. | Le scanner est-il hors taxes ? Où est la TVA ? |
| **RETOUR VIDE** | 27 000 | frais armateur ou terminal (restitution du conteneur vide), probable | aucun (sur le dossier YAMMI : « Relevage + retour TC 30 400 ») | Plausible comme frais de restitution. Il ne couvre probablement pas le camion qui ramène le vide à Kribi (non vérifié). | Les 27 000 couvrent-ils le trajet du vide jusqu'à Kribi, ou seulement les frais de restitution ? Dans quel délai faut-il rendre le conteneur ? |
| **PONT BASCULE** | 12 500 | frais portuaire (pesée) | Pesée 12 000 | Cohérent. | Aucune question. |
| **MISCELLANOUS** | 20 000 | inconnu (divers) | aucun | Ligne « divers » non justifiée. À supprimer ou à détailler. | Que couvrent ces 20 000 de divers ? |
| **PAYMENT** | 200 000 | inconnu (frais de paiement ou de banque ? prestation ?) | Frais banque 16 000 | 12,5 fois les frais bancaires de CITRA, sans explication. À justifier par pièce. | PAYMENT : paiement de quoi, à qui, sur quel justificatif ? Est-ce votre rémunération ? |
| **SORTIE** | 150 000 | frais portuaire ou de terminal (bon de sortie et formalités de sortie) | Frais de sortie 120 000 | Plausible, 30 000 de plus que CITRA. | Détail des frais de sortie : quels organismes ? |
| **GOODS** | 3 000 000 | taxe, probablement les droits et taxes sur les effets divers | compris dans le DD de 15 000 000 (effets au forfait de 4 500 000 de valeur, courriers/03 l.72) | Cohérent en ordre de grandeur (entre 2,81 M et 3,26 M). Mais aucune base n'est donnée, et le taux d'août dépend d'un mélange d'articles différent. Si GOODS était une valeur et non des taxes, la sous-estimation serait grave. | GOODS 3 000 000 : droits et taxes, ou valeur ? Sur quelle valeur (le forfait de 4,5 M ?) et à quel taux ? Que se passe-t-il si la douane détaille les articles (tôles de zinc, verres de lunettes, pièces métalliques) ? |
| **LIQUIDATION/RAPORT** | 150 000 | inconnu ; probablement lié à la mise en rapport de la visite dans le système et à la liquidation (débours ou prestation) | Mise rapport machine 150 000 (équivalent probable) | Même montant que chez CITRA : plausible, mais le libellé reste à préciser. | LIQUIDATION/RAPORT correspond-il à la « mise rapport machine » ? Payé à qui ? |
| **MACHINE CHARGES** | 400 000 | inconnu (hypothèse non vérifiée : acconage ou manutention du terminal KCT) | peut-être « acconnage KCT 405 273 », sinon aucun | Deuxième poste le plus lourd hors taxes. S'il s'agit de l'acconage KCT, il est cohérent. Sinon, l'acconage manque au devis et cette ligne n'a pas de contrepartie. | MACHINE CHARGES : est-ce l'acconage KCT ? Sinon, quelles machines, facturées par qui, contre quelle facture ? |
| **RETOUR VISITE** | 300 000 | inconnu (repositionnement du conteneur après la visite ? seconde visite ?) | aucun | Poste lourd sans aucune contrepartie chez CITRA. À justifier par pièce. | RETOUR VISITE : quelle opération, quel prestataire, quel justificatif ? |
| **BLOCKING** | 250 000 | inconnu (désarrimage ou décalage des véhicules dans le conteneur ? levée d'un blocage ?) | aucun | Libellé obscur. S'il s'agit de lever un blocage douanier ou du terminal, il faut savoir pourquoi on l'anticipe. | BLOCKING : de quoi s'agit-il exactement et pourquoi 250 000 ? |

## Les véhicules

### Toyota Yaris (châssis LVGCU92399G028166)

- Montant au devis : **2 063 941** · année au devis : 2009 · année selon le VIN : 2009 (10e caractère « 9 », BL 274428633) , vérifié
- Valeur implicite : DAC 0 % : 3 152 468 · DAC 12,5 % : 2 402 311 · DAC 25 % : 1 940 538. Le taux probable est 25 %, comme pour le Yaris 2009 d'août (« de plus de 15 ans », nouveau.txt l.39-46 et l.116), soit une valeur d'environ 1,94 M.
- Modèle validé : il redonne le plein tarif des véhicules d'août à 2 F près (2 941 867 et 11 849 928). En août, la douane de Kribi a retenu 2 774 834 pour un autre Yaris 2009 (nouveau.txt l.94). À ce niveau et à DAC 25 %, les taxes plein tarif font 2 941 867, soit 877 926 de plus que le devis. Payé en août avec l'abattement ministériel : 1 882 030. Le devis sous-estime donc probablement ce véhicule, sauf si un abattement est supposé.

### Toyota RAV4 (châssis LFMJ34AF0E3035663)

- Montant au devis : **4 891 559** · année au devis : 2015 · année selon le VIN : 2014 (10e caractère « E ») , vérifié. Incohérent avec le devis.
- Valeur implicite : DAC 0 % : 7 495 051 · DAC 12,5 % : 5 711 535 · DAC 25 % : 4 613 667. Le taux probable est 12,5 % (« de 01 à 15 ans », comme le Fortuner d'août, nouveau.txt l.132-140 et l.155), soit une valeur d'environ 5,71 M, 11 % au-dessus de notre estimation (5 128 123).
- Le devis indique « 2015 », le VIN 2014. Le 10e caractère donne l'année-modèle, qui peut différer de la première mise en circulation inscrite sur la carte grise. Sous la lecture des lignes tarifaires d'août (1 à 15 ans : 12,5 %), l'écart est sans effet sur le taux. Sous la lecture de la presse sur la LF2026 (12,5 % à partir de 12 ans, analyse-packing-list.md l.115), 2015 donne 11 ans et pourrait faire basculer la tranche : environ 1,16 M d'écart. Surtout, une année contraire au VIN ou au CIVIC crée une divergence déclarative.

### Haval H6 (châssis LGWEF4A52GF073391)

- Montant au devis : **4 204 904** · année au devis : 2016 · année selon le VIN : 2016 (10e caractère « G ») , vérifié
- Valeur implicite : DAC 0 % : 6 440 504 · DAC 12,5 % : 4 907 925 · DAC 25 % : 3 964 528. Le taux probable est 12,5 %, soit une valeur d'environ 4,91 M, 44 % au-dessus de notre estimation (3 410 384).
- C'est la valeur implicite la plus éloignée de notre estimation. À 10 ans pile, le véhicule est à la frontière des tranches : le CGI 2024, art. 142(6)a, dit « plus de 10 à 15 ans » (analyse-packing-list.md l.114). Hypothèse probable, non démontrée, pour les trois véhicules : valeurs rondes de 2,4 / 5,7 / 4,9 M (13,0 M au total), avec un taux marginal de 85,67 % et un fixe d'environ 7 600, proche de DAC 12,5 % et des forfaits ; résidus inférieurs à 720 F. Une autre combinaison (2,7 / 6,4 / 5,5 M à 76,4 %) s'ajuste aussi bien : il faut donc demander les valeurs. Comparaison avec CITRA (10,5 M obtenus par soustraction) : la somme des valeurs implicites va de 10 518 733 (tout à 25 %, coïncidence avec CITRA) à 17 088 023 (tout à 0 %). Le mélange probable (Yaris 25 %, les deux autres 12,5 %) donne 12 559 998, soit 19,6 % de plus que CITRA ; tout à 12,5 % donne 13 021 771.

## Ce qui manque au devis

- Aucun honoraire ni commission du déclarant n'apparaît. Chez CITRA : HAD 272 000 + commission de 2 % (54 249) + frais fixes 25 000 = 351 249. La rémunération de Cynthia est peut-être noyée dans les lignes obscures (1 338 500).
- Pas de TVA à 19,25 % sur les prestations (67 616 chez CITRA). Le scanner semble compté hors taxes (85 000 × 1,1925 = 101 362).
- Aucune ligne identifiable pour l'acconage KCT (405 273 chez CITRA), la validation (100 000), la vacation douane (75 000) ni les frais bancaires (16 000), sauf si MACHINE CHARGES correspond à l'acconage (non vérifié).
- Les taxes globales du DAU (case 62) manquent : 705 228 F sur la déclaration d'août (nouveau.txt l.72-81).
- Précompte PCT : 10 % au DAU provisoire d'août (ancien.txt l.109), 0 % au définitif (nouveau.txt l.121). Sur environ 15 M de valeur, cela fait environ 1,5 M d'écart, et le devis ne dit pas s'il est inclus.
- Assurance : le BL porte « FREIGHT PREPAID » sans assurance. Rien sur l'assurance maritime, ni sur l'assurance de la marchandise entre Kribi et Douala.
- Surestaries et détention Maersk, magasinage au terminal KCT : absents, alors que rien n'est fait à 3 jours de l'arrivée. Franchise inconnue. En août, Norton était « import demurrage payer · detention payer » (README d'août l.31).
- Caution du conteneur Maersk : CITRA l'intègre au transport (780 000), le devis n'en dit rien.
- Portée du transport non précisée : destination finale ? retour du vide à Kribi ? assurance ? RETOUR VIDE à 27 000 ne paraît pas couvrir un camion (non vérifié).
- Pénalité BESC de régularisation (200 %, besc-cncc.md l.76-79) non provisionnée, alors que la limite des 48 h avant arrivée tombe le 30/09.
- Frais de DI ou d'inspection SGS (environ 0,95 % de la valeur + TVA, soit environ 170 000 sur 15 M) si une DI est requise : les 7 000 de la ligne D.I n'y correspondent pas.
- Pour les véhicules, le devis ne donne ni valeur retenue, ni taux de DAC, ni forfaits DEW/DEX/DEY, ni hypothèse d'abattement. Pour les effets, ni valeur ni taux.
- Après dédouanement : immatriculation, carte grise, contrôle technique. C'est hors devis, mais à budgéter.
- Conditions : validité, acompte, échéancier, justificatifs de débours, et possibilité de payer les droits directement à la douane (CITRA l'a confirmé pour ses propres clients).

## Comparaison avec CITRA (CIT26099)

Totaux. Cynthia affiche 16 903 254 ; corrigé, son total est de 17 193 254. CITRA CIT26099 : 18 147 338. Écart corrigé : −954 084 (−5,3 %) ; écart affiché : −1 244 084.

Droits et taxes. Cynthia : 14 160 404 (GOODS 3 000 000 + véhicules 11 160 404). CITRA : 15 000 000 de provision ronde (100 % de la valeur imposable de 15 M) + 16 000 de frais bancaires. Écart : −839 596.

Frais hors taxes. Cynthia : 3 032 850. CITRA : 3 147 338 (débours 2 712 473 + frais bancaires 16 000 + prestations 351 249 + TVA 67 616). Écart : −114 488. La masse est quasi identique, la composition très différente :
- les 10 lignes de Cynthia qui ont un équivalent CITRA font 1 589 350, contre 2 132 200 pour les mêmes postes chez CITRA (transport 420 000 contre 780 000, BESC 322 000 contre 453 000, visite 180 000 contre 250 000) ;
- 11 lignes de Cynthia sans équivalent CITRA pèsent 1 443 500 (MACHINE CHARGES, RETOUR VISITE, BLOCKING, MANU, PAYMENT…) ;
- inversement, 1 015 138 de lignes CITRA n'ont pas d'équivalent chez Cynthia (acconage KCT 405 273, validation, vacation, frais bancaires, prestations, TVA).

Qualité. CITRA est une proforma sur papier à en-tête, datée, signée et tamponnée, avec RC et n° de contribuable, et une arithmétique juste. Celle de Cynthia n'est ni identifiée ni signée, et son addition est fausse de 290 000. En revanche, Cynthia ventile les taxes par véhicule, ce que CITRA ne fait pas. Ses montants sont cohérents avec le modèle d'août si les valeurs sont d'environ 2,4 / 5,7 / 4,9 M à DAC 12,5 % (valeurs implicites de 13,0 M, contre 10,5 M chez CITRA). Mais le Yaris est probablement taxé à 25 %, et il risque d'être sous-estimé d'environ 0,5 à 0,9 M.

Points communs. Même PAK (100 000), même mise en rapport (150 000), CIVIC équivalent (91 000 contre 93 000), pesée équivalente.

Désaccord de fond sur la DI. CITRA dit qu'elle n'est pas requise ; Cynthia porte une ligne « D.I ».

Conclusion : aucun des deux devis n'est plus fiable que l'autre sur les taxes. Les deux reposent sur des valeurs non arrêtées, que la douane fixera après CIVIC et visite.

## Questions prioritaires à Cynthia

- 1. URGENT BESC. Avec une arrivée le 02/10, la limite des 48 h tombe le 30/09 (besc-cncc.md l.50-51), et la validation CNCC peut prendre 24 h. Pouvez-vous soumettre le BESC aujourd'hui ? Pourquoi 322 000 : combien de BESC, à quel tarif, pénalité comprise ?
- 2. Identité et habilitation. Votre nom complet, votre société, votre n° d'agrément de commissionnaire en douane ou votre code déclarant CAMCIS, votre NIU et votre RCCM. Qui est « Nyongvolla Enzo-T », auteur du fichier ? Merci de nous envoyer une proforma sur papier à en-tête, datée, signée, avec sa durée de validité.
- 3. Addition. Les 22 lignes font 6 032 850, pas 5 742 850. Quel est le bon chiffre ? Le total final est-il donc 17 193 254 ?
- 4. Véhicules. Quelle valeur et quel taux de DAC avez-vous retenus pour chacun ? Le Yaris 2009 d'août a été taxé à DAC 25 % sur une valeur douane de 2 774 834. Avez-vous supposé un abattement, un précompte, les forfaits DEW/DEX/DEY, les taxes globales ?
- 5. RAV4. D'où vient l'année « 2015 », alors que le VIN (LFMJ34AF0E3035663) indique 2014 ? De la carte grise ? Quelle année sera déclarée ?
- 6. DI. Votre ligne « D.I 7 000 » signifie-t-elle qu'une DI est requise ? CITRA dit non ; le Guichet unique annonce 50 % d'amende sans DI ; notre conteneur d'août en avait une. Merci de nous donner votre position par écrit, avec son fondement, et le coût réel.
- 7. GOODS 3 000 000 : taxes ou valeur ? Sur quelle base (le forfait de 4,5 M ?) et à quel taux ? Que se passe-t-il si la douane détaille les articles ?
- 8. Justification ligne par ligne de FICH, SIESIR, ATTESTATION, PAYMENT, BLOCKING, RETOUR VISITE, MACHINE CHARGES, MISCELLANOUS et LIQUIDATION/RAPORT (1 338 500 au total, hors ATTESTATION) : qui encaisse, et quel justificatif sera remis ?
- 9. « PAD » : s'agit-il bien du PAK de Kribi ? Où est l'acconage KCT ? Le devis a-t-il été bâti sur un modèle de Douala ?
- 10. Votre rémunération. Où sont vos honoraires ? Quelles lignes sont des débours refacturés à l'identique, lesquelles sont des prestations ? La TVA s'applique-t-elle ?
- 11. Transport à 420 000 : jusqu'où ? Caution conteneur, retour du vide et assurance compris ?
- 12. Délais et coûts cachés. Combien de jours de franchise chez Maersk et au terminal KCT ? Combien coûte chaque jour de retard ? Qui les paie ?
- 13. Plan d'action d'ici au 02/10 : ce que vous lancez aujourd'hui (BESC, CIVIC sur e-FORCE, GUCE) et la liste exacte des documents qu'il vous faut de notre part (BL original ou libération, facture, packing list, cartes grises, NIU, domiciliation).
- 14. Paiement. Pouvons-nous régler les droits directement à la douane et ne vous avancer que les débours ? Quel acompte, quel échéancier ?

## Synthèse

L'estimation remise par Cynthia AKAH (PDF Word de 2 pages) est une note de travail, pas une proforma : pas de nom, de société, de NIU, de RCCM ni de n° d'agrément, aucune date dans le corps, aucune signature, aucune durée de validité. Les métadonnées du fichier indiquent comme auteur « Nyongvolla Enzo-T » et une création le 22/09/2026 à 15:11, heure de Douala.

Erreur d'addition (vérifiée en Python) : les 22 lignes de la page 1 font 6 032 850, pas 5 742 850. Il manque 290 000, et aucune combinaison de 1 à 3 lignes n'explique cet écart. La page 2 (11 160 404) est juste. Le total final correct est donc 17 193 254, et non 16 903 254 : 954 084 de moins que CITRA (18 147 338).

Structure : 14,16 M de droits et taxes, 3,03 M de frais.

Lignes vérifiables et cohérentes : CIVIC 91 000 (officiel 3 × 29 813 = 89 439), pesée, scanner (hors taxes), PAK 100 000 mais libellé « PAD », qui désigne Douala, sortie, mise en rapport.

Lignes à faire justifier : 8 libellés obscurs pèsent 1 338 500, soit 44 % des frais. Il n'y a ni honoraires ni TVA explicites, pas d'acconage KCT identifiable, pas de taxes globales, pas de surestaries, pas de caution conteneur.

BESC 322 000 : ne correspond à aucun multiple connu. Surtout, si l'arrivée est le 02/10, la limite des 48 h tombe le 30/09 : c'est l'urgence n° 1.

« D.I 7 000 » : suggère que Cynthia juge la DI nécessaire, contrairement à CITRA. Le montant est incompatible avec la DI SGS (environ 0,95 % de la valeur).

GOODS 3 000 000 : probablement les taxes sur les effets. C'est cohérent avec le forfait de 4,5 M : 2,81 M au taux de 62,47 % observé en août, 3,26 M avec le précompte.

Véhicules : les montants s'inversent en valeurs implicites d'environ 2,40 / 5,71 / 4,91 M à DAC 12,5 %. Hypothèse probable : des valeurs rondes de 2,4 / 5,7 / 4,9 M, avec DAC 12,5 % appliqué aux trois ; hypothèse non démontrée. Or le Yaris 2009 d'août a été taxé à DAC 25 % sur une valeur de 2 774 834. Sur cette base, il coûterait environ 2,94 M plein tarif, soit environ 0,88 M de plus que le devis.

RAV4 : le devis porte « 2015 », le VIN indique 2014.

Fourchette des valeurs implicites : de 10,52 M à 17,09 M selon le taux de DAC ; 12,56 M dans le scénario le plus probable, contre les 10,5 M déduits chez CITRA.

Verdict : l'estimation vaut comme ordre de grandeur, pas comme engagement. Avant tout versement, il faut la faire reprendre sur papier à en-tête, signée, avec l'agrément, les valeurs et taux par véhicule, et la justification des postes obscurs. Le BESC doit être lancé aujourd'hui.

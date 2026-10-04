# Série « JE SAVAIS PAS. » : 5 vidéos virales signées Bonzini Trading Cargo

Document de production du 04/10/2026, écrit à partir de :
- `serie/BRIEF.md` ;
- des 15 concepts, du classement pondéré et des avis des 3 juges ;
- des fiches de faits du dépôt (chemins depuis `/home/user/bonzinilabs`).

Chaque épisode reprend le meilleur concept de son sujet (compréhension ≥ 7) et applique les corrections des juges.

---

## En tête

### Le nom
**« JE SAVAIS PAS. »**, signée Bonzini Trading Cargo.

- **Une puce de série** en haut à gauche (y ≥ 150) : « JE SAVAIS PAS. · n/5 ».
- **Un rituel de fin**, identique dans les 5 épisodes : un tampon et la voix habituelle disent « MAINTENANT, TU SAIS. »

Pourquoi ce nom :
- c'est l'émotion qui fait partager (« je ne savais pas ! ») ;
- c'est ce que dit TOI, le commerçant récurrent, au moment où il comprend ;
- la fin le retourne en « Maintenant, tu sais » : Bonzini se place du côté de celui qui apprend, sans faire la leçon.

### Ordre de production conseillé (le plus viral et le plus sûr d'abord)

| N° | Sujet | Épisode | Format | Durée | Note (total · compréhension / viral / faisabilité) | Pourquoi à cette place |
|---|---|---|---|---|---|---|
| 1 | Conseils business | **« TCHAC ! »** | Défi chiffré et découpe « satisfaisante » | 31,5 s | 8,07 · 7 / 9 / 8,5 | Le plus viral. Tous les chiffres sont déjà validés. 80 % de modules existants, environ 1 jour. |
| 2 | Cargo / transport de colis | **« TU PAIES DE L'AIR. »** | Raté puis réparé, emballage ASMR | 32,5 s | 8,00 · 8 / 8 / 8 | Aucun chiffre. L'image absurde se lit en 1 s, sans le son. |
| 3 | Achat en Chine | **« C'EST PAS ÇA. »** | Mème « commandé / reçu » et fiche à capturer | 33 s | 7,88 · 8 / 8 / 7,5 | Le mème se reconnaît à l'image 0. La mécanique « PAS » est déjà codée. |
| 4 | Arnaques | **« PATRON, ATTENDS ! »** | Objet qui parle, sketch | 32 s | 7,53 · 8 / 7 / 7,5 | Il faut d'abord valider une nouvelle voix (celle du colis). |
| 5 | Douane | **« J'AI FIXÉ MON PRIX. »** | Liste qui écrase, puis on rejoue | 34,3 s | 7,30 · 8 / 6 / 8 | En dernier : le module douane n'a jamais été testé dans un navigateur, et l'angle « groupage » doit être validé. Il peut passer en 3e dès que c'est fait. |

### Une ligne de pitch par épisode
1. **TCHAC !** Les ciseaux découpent un billet de 10 000 F, morceau par morceau (fournisseur, transport, douane, petits frais, invendus) : « prix chinois × 2 = 0 ». La règle : compte tout avant de fixer ton prix.
2. **TU PAIES DE L'AIR.** Un nuage « AIR » étiqueté « À PAYER » jaillit du carton : au bateau, on paie la place, même le vide. Demande des cartons bien remplis ; Bonzini mesure tes cartons dès la Chine.
3. **C'EST PAS ÇA.** « Commandé / reçu » : le fournisseur a fait « ce que tu as écrit ». Ce que tu n'écris pas, c'est lui qui le choisit : tout par écrit, l'échantillon d'abord.
4. **PATRON, ATTENDS !** Ta commande s'écrase contre l'écran pour t'empêcher de payer un « nouveau compte bancaire ». Nouveau compte ? Ancien numéro : appelle d'abord.
5. **J'AI FIXÉ MON PRIX.** Le droit de douane et la TVA à 19,25 % écrasent la marge de celui qui ne les connaissait pas. Les mêmes taxes, estimées avant avec le module douane de Bonzini Labs, se rangent dans son prix.

---

## Ce qui revient dans chaque épisode : la même identité Bonzini

- **TOI**, le commerçant de Mboppi : pastille ambre « TOI » et voix d'homme de « PAS REÇU. » (`cml-tts/fr/1770_1028_000036-0002_enhanced`, `pas-recu/data/script_recu.json`). Il se trompe, comprend, puis s'en sort. Il n'est jamais humilié.
- **La voix femme habituelle** pour la leçon et la marque : Kyutai TTS 1.6B, voix `unmute-prod-website/developpeuse-3`.
- **Le margouillat spectateur** : il sursaute au choc, plisse les yeux à la prise de conscience et gobe « ce qui était faux » (le nuage AIR, les lettres P-A-S, les cœurs du faux message, les bouts de billet).
- **Le violet n'apparaît qu'avec Bonzini.** Lumière violette, plaque émaillée, ruban, laser de scan, étiquette : c'est la marque qui entre en scène. Le reste du temps, l'ambre est la couleur de TOI, l'orange celle des alertes, tampons et comptes. Les trois couleurs du logo sont présentes dans chaque épisode.
- **La musique et les sons** :
  - une makossa tendue qui **se coupe net** quand TOI comprend, puis repart en majeur après la solution ;
  - **la signature Bonzini** (2 notes de balafon qui montent) au moment exact où la marque entre ;
  - aucune musique dans les 2 premières secondes, ce qui laisse le choc seul.
- **La carte de fin** :
  - le logo et « Bonzini Trading Cargo », plus une ligne de service vérifiée ;
  - le tampon « MAINTENANT, TU SAIS. » ;
  - la pastille ambre « Écris [MOT] en commentaire ↓ », avec une flèche dessinée.
- **La boucle** : la dernière image remet en place l'image 0.
- **Un mot-clé par épisode**, qui mène à une réponse WhatsApp à préparer : TCHAC, CBM, FICHE, ALLÔ, AVANT.

## Ce qui change d'un épisode à l'autre (pour une série variée)

| | 1 TCHAC ! | 2 TU PAIES DE L'AIR. | 3 C'EST PAS ÇA. | 4 PATRON, ATTENDS ! | 5 J'AI FIXÉ MON PRIX. |
|---|---|---|---|---|---|
| **Format** | Défi chiffré, découpe ASMR | Raté → réparé, ASMR d'emballage, prise de conscience « It's a clock » | Mème « commandé / reçu », fiche à capturer | Objet qui parle, sketch | Liste qui écrase, puis rembobinage |
| **Décor** | Table kraft « Kraft & Fil », édition argent (jour) | Table d'emballage Kraft & Fil (jour) | Comptoir wax de Mboppi, **le matin** (ampoule éteinte) | Comptoir wax, **la nuit**, vitre de l'écran | Comptoir wax, la nuit |
| **Héros** | Le billet et les ciseaux | Le nuage AIR | Les deux cabas | **TA COMMANDE** (le colis, seul objet qui parle de la série) | La tour « MON PRIX » |
| **Preuve Bonzini** | Colis pesé et mesuré dès Guangzhou | Cartons mesurés dès la réception en Chine | Étiquette BZ sur chaque carton | Chine → Douala, mer ou air, entrepôt au Foyer Balengou | Module douane de Bonzini Labs (en test) |
| **Gag réservé** | Les deux pieds gauches | « J'ai payé le bateau pour transporter de l'air ?! » | Le PAS qui tombe | Les 3 cœurs du faux message | La petite plaque « Même toi ?! » |
| **Mot-clé** | TCHAC | CBM | FICHE | ALLÔ | AVANT |

**Redites évitées** :
- l'air payé au m³ n'est que dans l'épisode 2 ;
- l'étiquette BZ n'est expliquée que dans l'épisode 3 (l'épisode 2 la montre seulement passer au scan) ;
- un seul objet parle dans toute la série (épisode 4) ;
- les signaux d'arnaque ne reviennent pas dans l'épisode achat.

## Règles de fabrication communes
- **Format** : 1080×1920, 30 i/s, moteur Canvas 2D existant, flou de mouvement, une partition unique pour l'image et le son.
- **Calage** : tous les temps de ce document sont estimés à environ 16 caractères par seconde, la vitesse mesurée sur « PAS REÇU. » (`pas-recu/data/timing.json`). Ils seront recalés sur les vraies prises (`pas-recu/tools/retime.py`, `lib/vocheck.py`). Deux personnes ne parlent jamais en même temps.
- **Lisibilité** :
  - texte à lire en 44 px au moins, titres en 96 px au moins, chiffres en 120 px au moins ;
  - 3 blocs de texte au plus à la fois, plus la mention légale ;
  - chaque texte important tenu 1,4 s au moins.
- **Zones sûres** : rien sous y = 150 ; rien d'important sous y = 1540 ; pas de texte au-delà de x = 960 entre y = 900 et y = 1560.
- **Sécurité visuelle** : aucun clignotement au-delà de 3 fois par seconde.
- **Voix** : 3 prises par réplique, choisies sans écoute biaisée (`vocheck.py`, transcription automatique). Prononciations TTS : « Mbopi », « Gouangzou », « Tchak ».
- **Test avant publication, pour chaque épisode** : 5 commerçants, une vue, sans le son. On note mot pour mot ce qu'ils ont appris ET ce que fait Bonzini. Le seuil de réussite est indiqué dans chaque épisode.

---

## Épisode 1 — « TCHAC ! » Prix chinois × 2 = ? (conseils business)

**LA PHRASE-test** (ce qu'un commerçant doit pouvoir redire après une vue sans le son) :
> « Prix chinois fois deux, à la fin il ne reste rien : il faut compter le transport, la douane, les petits frais et les invendus avant de fixer son prix. Et Bonzini Trading Cargo pèse et mesure ton colis dès la Chine. »

**Seuil du test** : 4 personnes sur 5 citent « × 2 = 0 » ou « il ne reste rien », ET au moins 2 morceaux.

**Durée cible** : 31,5 s.

**Concept retenu** : business-1, 1er du classement (8,07).
- Compréhension 7 : il passe le seuil.
- Le concept est la version virale de 30 s de la vidéo longue « Votre vrai prix de revient » (3 min 06). Il reprend son exemple fictif validé : aucun chiffre nouveau.

**Corrections des juges appliquées**
- **Moins de coupes.** On passe de 7 coupes à 4 (fournisseur, transport, douane, petits frais), puis l'invendable en dernier avec « 5 PAIRES SUR 100 ». Les montants deviennent ronds (10 000 → 5 000 → 4 000 → 1 000 → 500 → 0), donc plus lisibles.
- **Le choc arrive plus tôt.** Le coup « TCHAC » réel tombe dès 0,9 s : le billet est le prix de vente, la coupe donne le prix d'achat.
- **Un seul mot-clé (TCHAC).** Le défi « Tu dis combien ? » n'est qu'une pastille visuelle : il n'est jamais dit.
- **Une seule promesse Bonzini, le cargo :** le colis est pesé et mesuré dès Guangzhou. Elle est montrée **loin de tout chiffre**, pour qu'on ne lise pas un tarif Bonzini.
- **Signature :** elle devient « COMPTE TOUT. AVANT DE FIXER TON PRIX. ».
- **Billet et douane :** le billet porte le filigrane « SPÉCIMEN ». Un autocollant sur l'enveloppe DOUANE dit « exemple · dépend du code du produit », et un commentaire épinglé est prêt.
- **Ajout :** une réplique de TOI (« Facile : 5 000 de bénéfice ! ») crée l'ironie et fait de TOI le fil de la série.

### Storyboard

| Temps (s) | Image | Mouvement | Voix / réplique | Texte à l'écran | Son |
|---|---|---|---|---|---|
| 0,0–0,9 | **ACCROCHE.** Plongée sur la table kraft. Au centre, un billet de 10 000 F stylisé, filigrane « SPÉCIMEN ». À côté, une basket en papier. Étiquette kraft épinglée « 1 PAIRE · REVENDUE 10 000 F À MBOPPI ». Des ciseaux orange ouverts au-dessus du billet. En haut à gauche, l'étiquette « EXEMPLE FICTIF », qui reste jusqu'à la fin. Puce « JE SAVAIS PAS. · 1/5 ». Le margouillat est couché au bord gauche. | Les ciseaux claquent déjà à vide à l'image 0. Poussée de caméra de 1,00 à 1,04. | N1a : « Revendue dix mille… » (0,05–0,9) | 1 PAIRE · REVENDUE 10 000 F À MBOPPI · EXEMPLE FICTIF | Pas de musique. Deux « snip » à vide, très près du micro. |
| 0,9–2,9 | **TCHAC 1.** Le billet est coupé en deux. La moitié gauche glisse dans l'enveloppe kraft « FOURNISSEUR ». La calculatrice entre dans le cadre : « RESTE SUR LE BILLET ». | Coupe à 0,9. Glissement de 1,2 à 1,8, en stop-motion sur les 2. L'écran défile de 10 000 à 5 000. | N1b : « …achetée cinq mille en Chine. » (1,2–2,8) | Tampon orange « ACHETÉE 5 000 F EN CHINE » (1,4) · FOURNISSEUR −5 000 · RESTE 5 000 | Gros TCHAC (le son signature), papier qui glisse, petit « ding » de caisse générique. |
| 2,9–5,0 | **LE DÉFI.** La pastille ambre TOI glisse sous la calculatrice. Au centre, en grand et en orange : « IL GAGNE COMBIEN ? ». Une pastille ambre « Tu dis combien ? ↓ » rebondit une fois. Le margouillat lève la tête. | « 5 000 ? » clignote deux fois, lentement (sous 3/s). | T1, TOI, sûr de lui : « Facile : cinq mille de bénéfice ! » (2,9–4,9) | IL GAGNE COMBIEN ? · Facile : 5 000 de bénéfice ! (TOI) · Tu dis combien ? ↓ | Trois tic-tac. La makossa entre, tendue, sur le dernier (4,9). |
| 5,0–6,9 | **TCHAC 2.** Une tranche part dans l'enveloppe « TRANSPORT », où un petit camion et un bateau sont dessinés au feutre. | Coupe sur « Tchac » (6,4). | N2 : « Le transport : mille. Tchac ! » (5,0–6,8) | TRANSPORT −1 000 · camion en Chine + bateau · RESTE 4 000 | Tchac sur le temps, corne de bateau très courte. |
| 6,9–9,4 | **TCHAC 3, le gros morceau.** Deux coupes ; une grosse tranche part dans l'enveloppe « DOUANE ». Autocollant jaune sur l'enveloppe. Aucun douanier, seulement l'étiquette. | Coupes à 8,6 et 8,9. Secousse de 10 px amortie en 6 images. Le margouillat sursaute. | N3 : « La douane : trois mille. Tchac, tchac ! » (6,9–9,3) | DOUANE −3 000 · exemple · dépend du code du produit · RESTE 1 000 | Double TCHAC grave avec sous-grave. La musique saute un temps. |
| 9,4–11,9 | **TCHAC 4.** Une tranche part dans l'enveloppe « PETITS FRAIS ». Dessus, quatre petits dessins au feutre : taux, pousseur, taxi, crédit. | Coupe à 11,4. | N4 : « Les petits frais : cinq cents. Tchac ! » (9,4–11,8) | PETITS FRAIS −500 · taux · pousseur · taxi · crédit · RESTE 500 | Tchac, une pièce qui roule. |
| 11,9–15,4 | **LE TWIST.** Une boîte à chaussures s'ouvre sur deux pieds gauches. Tampon orange « 5 PAIRES SUR 100 : INVENDABLES » avec sa sous-ligne. Le dernier bout de billet est coupé. | Couvercle à 12,0, tampon à 13,0, coupe à 14,9. La calculatrice tombe à 0. | N5 : « Cinq paires sur cent : deux pieds gauches ! Tchac. » (11,9–15,3) | 5 PAIRES SUR 100 : INVENDABLES · leur coût retombe sur les autres paires : −500 · RESTE 0 | Couvercle, « boing » comique, dernier tchac. |
| 15,4–19,0 | **MOMENT CLÉ, tenu 3,6 s.** La table est vide, la calculatrice affiche « 0 F ». Un tampon orange tombe au centre : « PRIX CHINOIS × 2 = 0 ». La pastille TOI, rapetissée, tremble. Le margouillat plisse les yeux. | Le tampon tombe au ralenti (×0,5) sur « zéro » (17,8). | N6 : « Prix chinois fois deux… égale zéro. » (15,6–18,1 ; la prise S12 de prix-de-revient est réutilisable) · T2, TOI, petite voix : « …zéro ?! » (18,3–18,9) | PRIX CHINOIS × 2 = 0 · …zéro ?! (TOI) | La musique se coupe net à 15,4. Une pièce tourne puis se couche (« ting »). |
| 19,0–23,2 | **LA RÈGLE.** Les quatre enveloppes et la boîte s'empilent en une pile « TOUT CE QUE TU PAIES ». Une flèche au feutre la relie à l'étiquette « TON VRAI PRIX ». Un bandeau de papier déchiré, écrit à l'encre et en orange, porte la règle. | Les éléments s'empilent sur les temps (19,4 / 19,9 / 20,4 / 20,9 / 21,4). | N7 : « La règle : compte tout ce que tu paies… avant de fixer ton prix. » (19,1–23,1) | COMPTE TOUT. AVANT DE FIXER TON PRIX. · TOUT CE QUE TU PAIES → TON VRAI PRIX | Crissement du feutre. La makossa repart en majeur (19,0). |
| 23,2–27,8 | **BONZINI.** La lumière violette s'allume et les enveloppes chiffrées sortent du cadre : aucun chiffre près de la marque. Un carton kraft passe sous le scanner (laser violet), sur la balance, puis sous le mètre ruban. Tampons « PESÉ ✓ » puis « MESURÉ ✓ ». La plaque émaillée violette « BONZINI TRADING CARGO » se pose. | Stop-motion sur les 2, tampons sur les temps. | N8 : « Avec Bonzini Trading Cargo, ton colis est pesé et mesuré dès Guangzhou. » (23,3–27,7) | BONZINI TRADING CARGO · TON COLIS, PESÉ ET MESURÉ DÈS GUANGZHOU | Signature balafon (23,3), bip de scanner, « tonk » de balance, deux tampons. |
| 27,8–31,5 | **FIN ET BOUCLE.** Le logo Bonzini, puis « Bonzini Trading Cargo · Groupage mer et air · Chine → Douala ». Tampon « MAINTENANT, TU SAIS. ». Pastille ambre d'appel à commenter, avec la petite ligne de partage. Le margouillat gobe deux miettes de billet. Dernière image : le billet entier reprend sa place de l'image 0. | La pastille rebondit une fois. Le billet se reforme de 31,0 à 31,5. | N9 : « Écris TCHAC en commentaire. Maintenant, tu sais. » (27,9–31,0) | Bonzini Trading Cargo · Groupage mer et air · Chine → Douala · MAINTENANT, TU SAIS. · Écris TCHAC en commentaire ↓ · Partage à l'ami qui fait encore × 2 | Deux « gloup », accord final sur le temps, coupe sèche à 31,5. |

La marque est à l'écran de 23,2 s à la fin (8,3 s).

### Voix : texte exact
- **Narratrice**, voix femme habituelle (developpeuse-3) :
  - N1 « Revendue dix mille… achetée cinq mille en Chine. »
  - N2 « Le transport : mille. Tchac ! » (tts « Tchak »)
  - N3 « La douane : trois mille. Tchac, tchac ! »
  - N4 « Les petits frais : cinq cents. Tchac ! »
  - N5 « Cinq paires sur cent : deux pieds gauches ! Tchac. »
  - N6 « Prix chinois fois deux… égale zéro. »
  - N7 « La règle : compte tout ce que tu paies… avant de fixer ton prix. »
  - N8 « Avec Bonzini Trading Cargo, ton colis est pesé et mesuré dès Guangzhou. » (tts « Gouangzou »)
  - N9 « Écris TCHAC en commentaire. Maintenant, tu sais. » (tts « Écris « Tchak » en commentaire. »)
- **TOI**, voix d'homme de « PAS REÇU. » :
  - T1 « Facile : cinq mille de bénéfice ! » (sûr de lui)
  - T2 « …zéro ?! » (petite voix, sonné)

### Texte à l'écran, dans l'ordre
1. « EXEMPLE FICTIF » (étiquette kraft, de 0 à 31,5 s) · « JE SAVAIS PAS. · 1/5 » (puce)
2. « 1 PAIRE · REVENDUE 10 000 F À MBOPPI » (étiquette kraft)
3. « ACHETÉE 5 000 F EN CHINE » (tampon orange) · enveloppe « FOURNISSEUR » · calculatrice « RESTE SUR LE BILLET : 5 000 »
4. « IL GAGNE COMBIEN ? » (orange, 140 px) · « Facile : 5 000 de bénéfice ! » (sous-titre, pastille TOI) · « Tu dis combien ? ↓ » (pastille ambre)
5. « TRANSPORT −1 000 » · « camion en Chine + bateau » · « RESTE 4 000 »
6. « DOUANE −3 000 » · autocollant « exemple · dépend du code du produit » · « RESTE 1 000 »
7. « PETITS FRAIS −500 » · « taux · pousseur · taxi · crédit » · « RESTE 500 »
8. « 5 PAIRES SUR 100 : INVENDABLES » · « leur coût retombe sur les autres paires : −500 » · « RESTE 0 »
9. « PRIX CHINOIS × 2 = 0 » (tampon géant) · « …zéro ?! » (TOI)
10. « COMPTE TOUT. AVANT DE FIXER TON PRIX. » · « TOUT CE QUE TU PAIES → TON VRAI PRIX »
11. « BONZINI TRADING CARGO » (plaque émaillée) · « TON COLIS, PESÉ ET MESURÉ DÈS GUANGZHOU » · tampons « PESÉ ✓ » « MESURÉ ✓ »
12. « Bonzini Trading Cargo · Groupage mer et air · Chine → Douala » · « MAINTENANT, TU SAIS. » · « Écris TCHAC en commentaire ↓ » · « Partage à l'ami qui fait encore × 2 »

### Faits utilisés et sources
| Fait | Source |
|---|---|
| Exemple fictif par paire : fournisseur 5 000, taux et frais 150, camion en Chine 200, bateau 800, douane 3 000, petits frais 350, soit 9 500. 5 paires invendables sur 100 : 950 000 ÷ 95 = 10 000. | `media/bonzini-cargo-reel/prix-de-revient/data/script.json` (champ `example`, S2, S5 à S12) ; `prix-de-revient/README.md` (« Worked example (FICTIONAL) ») |
| Regroupement à l'écran : transport = 200 + 800 = 1 000 ; petits frais = 150 + 350 = 500 ; invendables = +500 par paire vendable. Revérifié : 5 000 + 1 000 + 3 000 + 500 = 9 500, et 9 500 + 500 = 10 000. | Arithmétique sur la même source |
| Le vrai prix = tout ce qu'on paie jusqu'à la boutique, divisé par les pièces vraiment vendables. Simplifié à l'écran en « compte tout avant de fixer ton prix ». | `prix-de-revient/data/script.json` S15 ; README (OHADA AUDCIF art. 37, jamais cité) |
| La douane dépend du code du produit. Comprise dans le groupage ou payée à part, elle est dans ton prix (commentaire épinglé). | `douane-partie-2/data/research_p2.md` §1.1 (ligne 1) ; `teaser-douane/analysis/factcheck.md` ligne 14 ; `prix-de-revient/data/script.json` S8 |
| Chaque colis est scanné, photographié, pesé et mesuré à la réception de Guangzhou. | `prix-de-revient/data/script.json` (champ `facts`, S21) ; `supabase/migrations/20260920100000_parcel_reception.sql` (photo, poids, dimensions, volume calculé) ; `fret/data/script.json` S4 |
| Groupage maritime et aérien, de la Chine à Douala. | `serie/BRIEF.md` (Qui on est) ; `explainer-v2/SPEC_V2.md` V04 |
| Produit + transport + douane = coût total (légende seulement). | https://www.cameroondesks.com/2025/12/importer-de-chine-bra.html |

### Musique et bruitages
- **Musique** : makossa de `prix-de-revient/lib/makossa.py`. Silence jusqu'à 4,9 s ; version tendue de 4,9 à 15,4 (elle saute un temps sur la douane) ; coupure totale de 15,4 à 19,0 ; puis la majeur, pleine.
- **Bruitages** (`prix-de-revient/lib/money_sfx.py`) :
  - le TCHAC signature (papier épais), le papier qui glisse, le « ding » de caisse, la pièce qui roule ou se couche ;
  - le couvercle de boîte et le « boing » ;
  - le bip de scanner, la balance, les tampons, les « gloup ».
- **Mixage** : −14 LUFS, voix au moins 12 dB au-dessus de la musique.

### Modules réutilisés et à créer
- **Réutilisés** :
  - `prix-de-revient/overlay/scenes/00_money.js` : `banknote`, `scissors`, `calculator`, `shoeBox`, `sneaker`, `handArrow` ;
  - les scènes de prix-de-revient : `20_billet.js` (la colonne vertébrale : billet, ciseaux, calculatrice, enveloppes), `40_twist.js` (deux pieds gauches), `60_method.js`, `65_bonzini.js` (scanner, balance, mètre ruban), `70_outro.js`, `90_captions.js` ;
  - les outils de prix-de-revient : `lib/build_timeline.py`, `tts_kyutai.py`, `audio.py`, `cues.py`, `money_sfx.py`, et la prise de S12 ;
  - la pastille TOI et les tampons de `pas-recu/overlay/scenes/60_type.js`.
- **À créer** :
  - une timeline de 31,5 s (les ciseaux tombent sur chaque « Tchac » via `TL.wt`) ;
  - le filigrane « SPÉCIMEN » sur `banknote` (absent aujourd'hui) ;
  - le regroupement en 4 enveloppes et l'autocollant de l'enveloppe douane ;
  - la pastille du défi et la boucle de fin ;
  - le portage du margouillat (`pas-recu/overlay/scenes/40_gecko.js`) sur la table kraft. Il lit `SCORE.gecko(t)` et `SCORE.light(t)` : il faut un petit adaptateur.
- **Délai** : environ 1 jour.

### Publication
- **Mot-clé** : **TCHAC**.
- **Réponse WhatsApp à préparer** : la règle en 3 lignes, plus le lien vers la vidéo longue « Votre vrai prix de revient ».
- **Couverture** (à tester en A/B) : 1,2 s (les ciseaux dans le billet et « ACHETÉE 5 000 F ») ou 17,8 s (« PRIX CHINOIS × 2 = 0 »).
- **Texte de publication** :
  > Achetée 5 000 en Chine, revendue 10 000 à Mboppi : il gagne combien ? Écris ton chiffre… puis regarde le billet.
  > Prix chinois × 2 = 0 quand on oublie le transport, la douane, les petits frais et les paires invendables.
  > La règle : compte tout ce que tu paies jusqu'à la boutique AVANT de fixer ton prix.
  > Exemple fictif, pas des tarifs Bonzini.
  > Écris TCHAC : on te donne la méthode sur WhatsApp.
  > Bonzini Trading Cargo · groupage mer et air · Chine → Douala · entrepôt au Foyer Balengou.
  > #Mboppi #ImportChine #Douala #Commerçant #PrixDeRevient
- **Commentaire épinglé** :
  > Exemple fictif, pas des tarifs Bonzini. La douane dépend du code de ton produit : comprise dans le groupage ou payée à part, elle est dans ton prix. On en parle dans l'épisode 5. Et toi, tu avais dit combien ?

### Vérification règle par règle
| Règle | Comment elle est respectée |
|---|---|
| Une vue, sans le son | Le billet qui maigrit jusqu'à « 0 F » se comprend sans lire un montant. Un seul couple « −X / RESTE Y » à la fois. La règle est écrite en grand. |
| Phrases clés dites ET écrites | « Prix chinois × 2 = 0 », « Compte tout avant de fixer ton prix », « pesé et mesuré dès Guangzhou » : les trois sont dites et écrites. |
| Vocabulaire du paiement | Le paiement n'est pas montré. Seuls « paies » et « payer » sont employés, aucun mot interdit. |
| Chiffres | Uniquement ceux de l'exemple fictif validé, regroupés par addition. L'étiquette « EXEMPLE FICTIF » reste à l'écran tout le temps. Aucun tarif, taux, délai ni frais Bonzini. |
| Superlatifs et promesses | Aucun « moins cher », « garanti », etc. « Pesé et mesuré » est un fait, pas une promesse de suivi. |
| Douane | Seulement une étiquette d'enveloppe. Aucun douanier, aucune corruption, aucune accusation. L'autocollant dit « dépend du code ». |
| Marques et contrefaçon | Baskets sans marque. Billet stylisé « SPÉCIMEN », jamais une copie de billet réel. Aucun logo tiers. |
| Fournisseur | C'est une enveloppe : jamais montré, jamais moqué. |
| Adresse et données | Aucune adresse à l'écran. « Foyer Balengou » apparaît seulement dans la légende. |
| Services vérifiés | Groupage mer et air, colis pesé et mesuré à Guangzhou. On ne dit pas que Bonzini calcule ton prix. |
| Couleurs | Orange pour les ciseaux et les tampons, ambre pour TOI et la pastille, violet pour la seule séquence Bonzini. |
| Durée et mot-clé | 31,5 s, vertical, un mot-clé (TCHAC). Le défi chiffré n'est qu'une question, il n'est jamais dit. |

### À valider par le patron
1. Le regroupement de l'exemple déjà validé : transport 1 000 = camion + bateau ; petits frais 500 = taux + petits frais.
2. La réponse WhatsApp au mot TCHAC. Existe-t-elle déjà pour la vidéo longue ?
3. Le design du billet stylisé avec « SPÉCIMEN ».
4. La mention « épisode 5 » dans le commentaire épinglé, à garder seulement si l'épisode douane sort.

---

## Épisode 2 — « TU PAIES DE L'AIR. » (cargo / transport de colis)

**LA PHRASE-test** :
> « Au bateau on paie la place du carton, le mètre cube, même le vide dedans : il faut demander au fournisseur des cartons bien remplis, sans enlever la protection. Chez Bonzini Trading Cargo, tes cartons sont mesurés dès la Chine. »

**Seuil du test** : 4 personnes sur 5 citent « on paie le vide / la place » ET « cartons bien remplis ». Aucune ne dit que « Bonzini remballe ».

**Durée cible** : 32,5 s.

**Concept retenu** : cargo-1, 1er du sujet et 2e au classement (8,00 ; compréhension 8).

**Corrections des juges appliquées**
- **Le choc dès l'image 0** : le nuage AIR est déjà en train de jaillir.
- **La formule réduite à 2 s** : trois claquements de mètre ruban et un tampon « LONGUEUR × LARGEUR × HAUTEUR », sans voix. La voix dit seulement « Au bateau, on paie la place : le mètre cube ».
- **Les rôles bien séparés** :
  - pendant le remballage, une pastille fixe « CHEZ TON FOURNISSEUR » reste à l'écran ;
  - un bandeau « ENSUITE : » coupe net avant la séquence Bonzini ;
  - le scotch des cartons du fournisseur reste kraft. Le violet n'arrive qu'avec Bonzini.
- **La séquence Bonzini** : la mesure affiche « VOLUME : • m³ » (masqué) et le nuage AIR est barré. On dit « tes cartons sont mesurés dès la réception en Chine ». « Tu connais ton volume avant l'arrivée » n'est dit qu'après accord du patron.
- **Un seul univers** : la table Kraft & Fil, avec des plaques en carton épais au lieu de l'acier du comptoir.
- **Remballage en 3 poses tenues** : les sandales se rangent, les parois se resserrent, le scotch scelle.
- **Pastille de partage** : « Tague celui qui remplit ses cartons de papier ».
- **Exclusivité** : le gag « plein d'air » n'est que dans cet épisode.

### Storyboard

| Temps (s) | Image | Mouvement | Voix / réplique | Texte à l'écran | Son |
|---|---|---|---|---|---|
| 0,0–2,3 | **ACCROCHE.** Plongée sur la table d'emballage kraft. Un grand carton kraft, fermé au scotch kraft. À l'image 0, les rabats sont déjà ouverts et un gros nuage en papier « AIR » en jaillit. Une étiquette de prix « À PAYER », sans montant, pend à son fil orange. Grosse plaque en carton orange : « DANS CE CARTON, TU PAIES DE L'AIR. » (« DE L'AIR » en 170 px). Puce « JE SAVAIS PAS. · 2/5 ». | Le nuage est à mi-jaillissement à 0,0 et culmine à 0,5. Le margouillat sursaute. Poussée de 1,00 à 1,05. | N1 : « Dans ce carton… tu paies de l'air. » (0,1–2,3) | DANS CE CARTON, TU PAIES DE L'AIR. · À PAYER | Pas de musique. « POUF » d'air comprimé déjà en cours, craquement de carton, « ka-ching » doux et générique. |
| 2,3–4,2 | La plaque ambre de TOI se dresse à côté du carton. | Rebond. | T1, TOI : « Mais mon carton est léger ! » (2,4–4,1) | MAIS MON CARTON EST LÉGER ! · TOI | La makossa entre, tendue (2,3). |
| 4,2–7,0 | Une plaque de carton épais, pastille grise « LE BATEAU », écrase la plaque de TOI : les lettres giclent. Le tampon « AU m³ » frappe le carton. | L'écrasement tombe sur « place » (≈ 5,2), le tampon sur « mètre cube ». | N2 : « Au bateau, on paie la place : le mètre cube. » (4,2–6,9) | AU BATEAU, ON PAIE LA PLACE : LE MÈTRE CUBE. · LE BATEAU · AU m³ | BOUM sourd de carton épais, coup de tampon. |
| 7,0–9,0 | **LA MESURE.** Le mètre ruban claque trois fois autour du carton ; un trait de feutre marque chaque côté. | Claquements à 7,2 / 7,7 / 8,2, tampon à 8,6. | (pas de voix) | LONGUEUR × LARGEUR × HAUTEUR · le carton entier | Trois « clac » sur les temps, feutre qui crisse. |
| 9,0–11,8 | **LE VIDE.** Le flanc du carton se soulève comme un couvercle en papier découpé. Dedans, trois paires de sandales sans marque dans un coin. Tout le reste se remplit de hachures bleu clair marquées « VIDE », et le nuage AIR s'y pose, content de lui. | Les hachures balaient l'intérieur de 9,4 à 10,6. | N3 : « Le carton entier… même le vide dedans. » (9,1–11,7) | LE VIDE, TU LE PAIES AUSSI. | Remplissage « fffff » qui monte, petit « tic ». |
| 11,8–15,3 | **LA PRISE DE CONSCIENCE** (« It's a clock »). Tout s'arrête. La plaque ambre de TOI revient, toute petite, et transpire. Le margouillat plisse les yeux vers elle. | Arrêt net, puis poussée lente. | T2, TOI, petite voix : « …j'ai payé le bateau pour transporter de l'air ?! » (12,0–15,1) | …J'AI PAYÉ LE BATEAU POUR TRANSPORTER DE L'AIR ?! (TOI) | La musique se coupe net à 11,8. Grillon, goutte de sueur. |
| 15,3–18,7 | **LE BON CARTON**, en 3 poses tenues, sous la pastille fixe « CHEZ TON FOURNISSEUR » : (1) les sandales se rangent tête-bêche, serrées ; (2) les parois se rapprochent et le carton se refait plus petit autour d'elles ; (3) le scotch kraft file d'un bord à l'autre. | Poses à 15,8 / 16,8 / 17,8. Le nuage AIR est chassé à 18,0 ; le margouillat le gobe à 18,6. | N4 : « Demande à ton fournisseur des cartons bien remplis. » (15,3–18,5) | DEMANDE À TON FOURNISSEUR : DES CARTONS BIEN REMPLIS. · CHEZ TON FOURNISSEUR | Emballage ASMR : carton plié, cutter, « scriiitch » du scotch, « pffuit » d'air, « gloup ». |
| 18,7–21,2 | **AVANT / APRÈS, tenu 2,5 s.** Écran partagé : à gauche, le grand carton et une longue jauge « m³ » ; à droite, le petit carton et une jauge courte. Aucun chiffre. | Les jauges se remplissent de 18,9 à 19,6. | N5 : « Moins de vide… moins de mètres cubes. » (18,8–21,1) | AVANT · APRÈS · MOINS DE VIDE = MOINS DE m³ | La makossa repart en majeur (18,7). |
| 21,2–23,7 | À côté du petit carton, un pictogramme : un verre emballé dans du papier bulle. | Le papier bulle s'enroule. | N6 : « Enlève le vide… pas la protection. » (21,3–23,6) | ENLÈVE LE VIDE, PAS LA PROTECTION. | « Plop » de papier bulle. |
| 23,7–24,3 | Bandeau kraft « ENSUITE : ». La pastille « CHEZ TON FOURNISSEUR » se décroche. | Glissement latéral. | (pas de voix) | ENSUITE : | Souffle (whoosh). |
| 24,3–29,2 | **BONZINI.** La lumière violette s'allume. Le petit carton porte l'étiquette Bonzini bleue (bateau), « BZ-482913 · exemple », adresse floutée. Il arrive à la réception : laser violet du scan, mètre ruban, lecture « VOLUME : • m³ » (masquée). Le nuage AIR est barré d'un trait. Tampon « MESURÉ ✓ ». La plaque émaillée violette « BONZINI TRADING CARGO » se pose. | Stop-motion sur les 2. | N7 : « Chez Bonzini Trading Cargo, tes cartons sont mesurés dès la réception en Chine. » (24,4–29,1) | BONZINI TRADING CARGO · TES CARTONS, MESURÉS DÈS LA RÉCEPTION EN CHINE · VOLUME : • m³ · BZ-482913 · exemple | Signature balafon (24,4), bip, mètre ruban, tampon. |
| 29,2–32,5 | **FIN ET BOUCLE.** Le logo, puis « Groupage mer et air · Chine → Douala · Entrepôt : Foyer Balengou ». Tampon « MAINTENANT, TU SAIS. ». Pastille ambre d'appel à commenter, avec la ligne pour taguer. Dernière image : le grand carton fermé de l'image 0, qui tremble ; en boucle, il se rouvre. | La pastille rebondit une fois. | N8 : « Écris CBM en commentaire. Maintenant, tu sais. » (29,3–32,2) | Bonzini Trading Cargo · Groupage mer et air · Chine → Douala · Entrepôt : Foyer Balengou · MAINTENANT, TU SAIS. · Écris CBM en commentaire ↓ · Tague celui qui remplit ses cartons de papier | Accord final, coupe sèche à 32,5. |

La marque est à l'écran de 24,3 s à la fin (8,2 s).

### Voix : texte exact
- **Narratrice**, voix femme habituelle :
  - N1 « Dans ce carton… tu paies de l'air. »
  - N2 « Au bateau, on paie la place : le mètre cube. »
  - N3 « Le carton entier… même le vide dedans. »
  - N4 « Demande à ton fournisseur des cartons bien remplis. »
  - N5 « Moins de vide… moins de mètres cubes. »
  - N6 « Enlève le vide… pas la protection. »
  - N7 « Chez Bonzini Trading Cargo, tes cartons sont mesurés dès la réception en Chine. »
  - N8 « Écris CBM en commentaire. Maintenant, tu sais. » (tts « Écris « cé bé ème » en commentaire. »)
- **TOI**, voix d'homme de « PAS REÇU. » :
  - T1 « Mais mon carton est léger ! » (outré)
  - T2 « …j'ai payé le bateau pour transporter de l'air ?! » (petite voix : il comprend tard)

### Texte à l'écran, dans l'ordre
1. « DANS CE CARTON, TU PAIES DE L'AIR. » (plaque orange) · « À PAYER » (étiquette) · « AIR » (nuage) · « JE SAVAIS PAS. · 2/5 »
2. « MAIS MON CARTON EST LÉGER ! » (plaque ambre, pastille TOI)
3. « AU BATEAU, ON PAIE LA PLACE : LE MÈTRE CUBE. » (plaque de carton épais, pastille « LE BATEAU ») · tampon « AU m³ »
4. « LONGUEUR × LARGEUR × HAUTEUR » · « le carton entier »
5. « VIDE » (hachures) · « LE VIDE, TU LE PAIES AUSSI. »
6. « …J'AI PAYÉ LE BATEAU POUR TRANSPORTER DE L'AIR ?! » (TOI)
7. « DEMANDE À TON FOURNISSEUR : DES CARTONS BIEN REMPLIS. » · pastille « CHEZ TON FOURNISSEUR »
8. « AVANT » · « APRÈS » · « MOINS DE VIDE = MOINS DE m³ »
9. « ENLÈVE LE VIDE, PAS LA PROTECTION. »
10. « ENSUITE : »
11. « BONZINI TRADING CARGO » · « TES CARTONS, MESURÉS DÈS LA RÉCEPTION EN CHINE » · « VOLUME : • m³ » · « BZ-482913 · exemple » · « MESURÉ ✓ »
12. Carte de fin : « Bonzini Trading Cargo · Groupage mer et air · Chine → Douala · Entrepôt : Foyer Balengou » · « MAINTENANT, TU SAIS. » · « Écris CBM en commentaire ↓ » · « Tague celui qui remplit ses cartons de papier »

### Faits utilisés et sources
| Fait | Source |
|---|---|
| Au maritime (en conteneur), le transport est facturé au mètre cube. | `media/bonzini-cargo-reel/fret/data/script.json` S7 ; `src/lib/cargoQuote.ts` (maritime facturé `per_cbm`) |
| Le volume (CBM) = longueur × largeur × hauteur du carton entier, en mètres. | `serie/BRIEF.md` (vérités générales) ; `supabase/migrations/20260920100000_parcel_reception.sql` (`cbm` = L × l × H en cm ÷ 1 000 000, calculé pour chaque colis) |
| Au maritime, on paie même l'air des boîtes. | `prix-de-revient/data/script.json` S7 ; `prix-de-revient/overlay/scenes/30_costs.js` (phase B, nuage AIR) |
| Moins de vide pour la même marchandise donne moins de mètres cubes. | Arithmétique de la formule, sans chiffre |
| Les consignes d'emballage se donnent au fournisseur. | https://change-sourcing.com/china-sourcing-tips-for-ecommerce-startups/ (« packaging type ») |
| Chaque colis est enregistré à la réception en Chine avec photo, poids et dimensions. | `parcel_reception.sql` (en-tête et colonnes) ; `prix-de-revient/data/script.json` S21 ; `fret/data/script.json` S4 |
| L'étiquette bleue (bandeau uni) correspond au bateau. | `fret/data/script.json` S9 ; `src/lib/customerCode.ts` (`DESTINATION_THEME.warehouse` #0B5FA5, sans hachures) |
| Le code d'exemple n'est permis qu'avec la mention « exemple ». | `explainer-v2/SPEC_V2.md` (Rules) |
| Groupage mer et air, Chine → Douala, entrepôt au Foyer Balengou. | `serie/BRIEF.md` ; `explainer-v2/SPEC_V2.md` Q5 |

### Musique et bruitages
- **Musique** : makossa (`pas-recu/lib/makossa.py`). Silence jusqu'à 2,3 s ; version tendue de 2,3 à 11,8 ; coupure ; la majeur à partir de 18,7.
- **Bruitages réutilisés** : « POUF » d'air, tampons, mètre ruban, bip de scanner, grillon, sueur, « gloup ».
- **Bruitages à synthétiser** : le carton qu'on plie, le cutter, le « scriiitch » du scotch (mis en avant au mixage : c'est le moment ASMR), le papier bulle.
- **Signature balafon** sur « Bonzini ».

### Modules réutilisés et à créer
- **Réutilisés** :
  - la table kraft, le papier découpé et le stop-motion de `explainer-v2/overlay/scenes/16_paper.js` et `08_props.js` ;
  - le nuage AIR, son étiquette de prix, les hachures, le mètre ruban et le tampon « AU m³ » : `prix-de-revient/overlay/scenes/30_costs.js` (phase B de S7) et `00_money.js` (`priceTag`, `handArrow`) ;
  - le scan et l'étiquette : `fret/overlay/scenes/20_track.js`, plus un rendu réel de `src/lib/shippingLabelCanvas.ts` avec des données fictives et l'adresse floutée ;
  - la sueur et les lettres qui giclent : `pas-recu/overlay/scenes/32_letters.js` ;
  - le margouillat : `40_gecko.js`, avec le même adaptateur que l'épisode 1 ;
  - les pastilles, bandeaux et carte de fin : `60_type.js`.
- **À créer** :
  - la matière « carton épais » pour les plaques (une variante de `30_plates.js`) ;
  - le remballage en 3 poses ;
  - l'écran partagé et ses jauges sans chiffre ;
  - le pictogramme du verre en papier bulle ;
  - les bruitages d'emballage.
- **Délai** : environ 1,5 jour. **Image-clé à valider en premier** : le nuage AIR et son « À PAYER » à 0,3 s.

### Publication
- **Mot-clé** : **CBM**.
- **Réponse WhatsApp à préparer** : comment calculer le volume d'un carton (longueur × largeur × hauteur, en mètres, sans prix), le rappel « cartons bien remplis, protection gardée », et le contact Bonzini Trading Cargo.
- **Couverture** (A/B) : 0,5 s (le nuage AIR et « À PAYER ») ou 19,5 s (l'écran AVANT / APRÈS).
- **Texte de publication** :
  > Ton carton est léger… mais au bateau, on paie la place : le mètre cube (longueur × largeur × hauteur). Le vide dedans aussi.
  > Demande à ton fournisseur des cartons bien remplis. Enlève le vide, pas la protection.
  > Chez Bonzini Trading Cargo, tes cartons sont mesurés dès la réception en Chine.
  > Écris CBM : on t'explique comment calculer le volume de ton carton.
  > Tague celui qui remplit ses cartons de papier.
  > #Cargo #ImportChine #Douala #Mboppi #Groupage
- **Commentaire épinglé** :
  > CBM = longueur × largeur × hauteur, en mètres, du carton entier (pas de la marchandise). Ça vaut pour le bateau, facturé au mètre cube. Le fragile reste protégé : on enlève le vide, pas le papier bulle.

### Vérification règle par règle
| Règle | Comment elle est respectée |
|---|---|
| Une vue, sans le son | Le nuage « AIR / À PAYER », les hachures « VIDE » et les jauges AVANT / APRÈS se lisent sans le son. Le bandeau « ENSUITE : » sépare le fournisseur de Bonzini. |
| Phrases clés dites ET écrites | « Tu paies de l'air », « on paie la place : le mètre cube », « cartons bien remplis », « moins de vide = moins de m³ », « mesurés dès la réception en Chine » : toutes dites et écrites. |
| Vocabulaire du paiement | Seul « payer » est employé, aucun mot interdit. |
| Chiffres | Aucun. Les jauges sont sans valeur et le volume est masqué (« • m³ »). Le code d'exemple porte la mention « exemple ». |
| Superlatifs et promesses | Jamais « moins cher » ni « économise » : on dit « moins de mètres cubes », ce qui est de l'arithmétique. |
| Douane | Absente. |
| Marques et contrefaçon | Sandales sans marque, aucun transporteur, aucun logo. |
| Fournisseur | Il n'est jamais montré ni accusé : on lui fait une demande. Ses mains ne sont pas montrées, les objets bougent seuls. |
| Adresse et données | « Foyer Balengou » seulement. L'adresse et les téléphones de l'étiquette sont floutés. |
| Services vérifiés | La mesure à la réception est vérifiée. **Bonzini ne remballe pas** : c'est écrit (« CHEZ TON FOURNISSEUR ») et dit (« demande à ton fournisseur »). |
| Couleurs | Orange pour le titre et les tampons, ambre pour TOI, violet pour Bonzini seulement. Le bleu est la vraie couleur de l'étiquette bateau. |
| Durée et mot-clé | 32,5 s, vertical, un mot-clé (CBM). |

### À valider par le patron
1. La formule « tes cartons sont mesurés dès la réception en Chine ». Si le reçu de dépôt montre le volume au client, on peut ajouter : « tu vois ton volume avant l'arrivée ».
2. La lecture « VOLUME : • m³ » à l'écran, qui suggère que le client voit son volume.
3. La réponse WhatsApp au mot CBM.
4. Le conseil « demande des cartons bien remplis » : c'est le fournisseur qui le fait, jamais un service Bonzini. Si Bonzini propose un jour un regroupement de cartons, il faudra le confirmer avant d'en parler.

---

## Épisode 3 — « C'EST PAS ÇA. » (achat en Chine)

**LA PHRASE-test** :
> « Il a écrit juste « bonne qualité, comme la photo » et il a reçu autre chose : ce que tu n'écris pas, c'est le fournisseur qui le choisit. Il faut tout écrire et prendre l'échantillon d'abord. Le transport, c'est Bonzini Trading Cargo, avec ton étiquette sur chaque carton. »

**Seuil du test** : 4 personnes sur 5 citent « tout écrire » ET « échantillon ». Aucune ne dit « le fournisseur est un voleur » ni « Bonzini contrôle la qualité ».

**Durée cible** : 33 s.

**Concept retenu** : achat-1, 1er du sujet (7,88 ; compréhension 8).

**Corrections des juges appliquées**
- **La fiche passe à 4 lignes** (MATIÈRE, TAILLE, ANSES, EMBALLAGE), qui répondent aux 3 « ? » posés sur le sac. La liste générale va dans la légende et la réponse FICHE.
- **Étiquetage et étiquette Bonzini séparés** : « ÉTIQUETTE » quitte la fiche. L'étiquette Bonzini devient une note violette à part (« + MON ÉTIQUETTE BONZINI SUR CHAQUE CARTON »), collée par le fournisseur (consigne d'achat).
- **Les rôles sont écrits** : « LA DESCRIPTION, C'EST TOI. / LE TRANSPORT, C'EST BONZINI TRADING CARGO. », pour éviter la lecture « Bonzini garantit la qualité ».
- **Un débat dès 2,9 s** : une pastille « QUI A TORT ? » ; la plaque calme du fournisseur répond.
- **Pas de plan statique** : le sac reçu sort du carton avec un « pouf » dès l'image 0.
- **Aucun code de maroquinerie de luxe** : un cabas rigide à deux anses face à un cabas souple à une bride, sans fermoir doré.
- **Gants neufs** : manches unies, sans chevalière, pour ne pas rappeler le feyman du Bonneteau.
- **Différence avec « PAS REÇU. »** : pas de rembobinage. On passe à « LA PROCHAINE COMMANDE ». Le PAS tombe sous un nouveau déclencheur : l'échantillon qui tapote la plaque.

### Storyboard

| Temps (s) | Image | Mouvement | Voix / réplique | Texte à l'écran | Son |
|---|---|---|---|---|---|
| 0,0–1,45 | **ACCROCHE (le mème).** Comptoir wax, **le matin** : ampoule éteinte, lumière chaude rasante qui vient de la porte. En haut, un bandeau en 2 colonnes « CE QUE J'AI COMMANDÉ \| CE QUE J'AI REÇU ». À gauche, un polaroïd épinglé « LA PHOTO » : un cabas noir rigide à deux anses. À droite, un carton kraft ouvert d'où le cabas reçu sort déjà, plus petit, souple, à une bride fine. Sous-titre blanc cerné de noir avec la pastille TOI ; l'ombre d'une plaque grossit dessus. Étiquette « Boutique · Mboppi ». Puce « JE SAVAIS PAS. · 3/5 ». Le margouillat est au bord gauche. | Le sac est à mi-saut à 0,0 et retombe à 0,4. | T1, TOI, content : « Mes sacs sont arrivés ! » (0,05–1,4) | CE QUE J'AI COMMANDÉ · CE QUE J'AI REÇU · LA PHOTO · Mes sacs sont arrivés ! · TOI · Boutique · Mboppi | Carton qu'on déchire, « pouf », sifflement de chute. Pas de musique. |
| 1,45–2,9 | **IMPACT.** La plaque ambre 3D « C'EST PAS ÇA ! » écrase le sous-titre ; les lettres giclent comme des billes. L'œil fait seul l'aller-retour entre la photo et le sac reçu. | Écrasement, rebond, secousse de 10 px amortie. Le margouillat sursaute. | T2, TOI, choqué : « Eh… c'est pas ça ! » (1,6–2,9) | C'EST PAS ÇA ! · TOI | BOUM grave, billes qui roulent. La makossa tendue entre à 2,0 (fa dièse mineur). |
| 2,9–5,0 | Une pastille orange « QUI A TORT ? » saute en haut (2,9). Une plaque d'acier brossé, pastille grise « TON FOURNISSEUR · CHINE », se pose calmement à côté (3,1), sans écrasement : le fournisseur a fait son travail. Il n'a ni visage, ni voix, ni accent. | Atterrissage doux. | N1, la narratrice lit la plaque : « C'est ce que tu as écrit. » (3,3–4,9) | QUI A TORT ? · C'EST CE QUE TU AS ÉCRIT. · TON FOURNISSEUR · CHINE | Clac de métal posé sans violence, « ding » doux. |
| 5,0–9,2 | **CE QUE TU AS ÉCRIT.** La commande de TOI tombe en plaque de carton mince qui plie sous son propre poids (pastille TOI). Puis trois étiquettes orange s'épinglent sur le sac reçu. | Étiquettes à 8,3 / 8,6 / 8,9. Le margouillat les suit de la tête. | T3, TOI, fier : « Sacs noirs, bonne qualité, comme la photo. » (5,3–8,2) | SACS NOIRS. BONNE QUALITÉ. COMME LA PHOTO. · TAILLE ? · MATIÈRE ? · ANSES ? | Trois petits coups de tampon. |
| 9,2–13,0 | **LA LEÇON, tenue 3,8 s.** Arrêt net. Un bandeau sombre s'inscrit dans la zone nuit. La plaque « BONNE QUALITÉ » se ramollit comme du carton mouillé et finit en crêpe. Le margouillat plisse les yeux vers la caméra. | Écrasement lent. | N2 : « Ce que tu n'écris pas… c'est lui qui le choisit. » (9,4–12,5) | CE QUE TU N'ÉCRIS PAS, C'EST LUI QUI LE CHOISIT. | La musique se coupe net à 9,2. Grillon, « pfffuit », 3 notes de guitare moqueuses. |
| 13,0–14,0 | **LA PROCHAINE COMMANDE.** Le vieux carton glisse hors champ ; une feuille de commande vierge arrive. Bandeau crème. | Glissement. | (pas de voix) | LA PROCHAINE COMMANDE : | Souffle, montée. |
| 14,0–17,6 | **LA FICHE.** Quatre petites plaques ambre tombent sur les temps et s'empilent. Les 3 étiquettes « ? » du sac s'envolent et viennent se poser en ✓ sur les lignes correspondantes. Les gants de TOI (manches unies, sans bijou) gribouillent des traits illisibles au feutre. Tampon « TOUT PAR ÉCRIT » en tête de pile. | Plaques à 14,2 / 14,8 / 15,4 / 16,0, tampon à 17,2. | N3 : « Matière, taille, anses, emballage… tout par écrit. » (14,1–17,5) | MATIÈRE ✓ · TAILLE ✓ · ANSES ✓ · EMBALLAGE ✓ · TOUT PAR ÉCRIT | Quatre clacs sur les temps, balafon clair. |
| 17,6–21,6 | **L'ÉCHANTILLON.** Une petite note violette s'épingle à côté de la fiche et reste jusqu'à 21,6. Un petit colis kraft « ÉCHANTILLON » se pose ; les gants en sortent UN sac : celui de la photo. Le polaroïd glisse à côté et reçoit un tampon ambre « PAREIL ✓ ». Les gants mettent l'échantillon de côté avec une étiquette kraft « À GARDER ». | Note à 17,6 ; colis à 18,2 ; tampon à 20,4. | N4 : « L'échantillon d'abord… et garde-le pour comparer. » (18,2–21,4) | + MON ÉTIQUETTE BONZINI SUR CHAQUE CARTON (note violette) · L'ÉCHANTILLON D'ABORD. · GARDE-LE POUR COMPARER. · PAREIL ✓ · À GARDER | Punaise « tic », papier kraft, « tonk » doux, petit scintillement. |
| 21,6–25,0 | **MOMENT CLÉ, ralenti de 2,4 s.** Le gros carton de la commande arrive, avec l'étiquette bleue Bonzini sur le flanc (floutée). Les sacs sont comme l'échantillon. Tenu par le gant, l'échantillon tapote la plaque « C'EST PAS ÇA ! » par-dessous : trois fissures, puis le P, le A et le S se détachent, tombent et roulent vers le margouillat. « C'EST ÇA ! » se recentre comme un ressort, sans trou. | P à 22,7, A à 23,05, S à 23,4. Coche ambre tamponnée à 23,8. | T4, TOI, soulagé : « Ahh… c'est ça ! » (24,0–24,9) | C'EST PAS ÇA ! → C'EST ÇA ✓ | Coup de tampon, clink · clink · clink. Accord majeur à 23,8 : la makossa repart pleine (la majeur). |
| 25,0–29,6 | **MARQUE.** La lumière violette s'allume. Un bandeau de 2 lignes s'inscrit. Zoom sur l'étiquette du gros carton : bandeau bleu, QR, « BZ-482913 · EXEMPLE » ; adresse, téléphones et nom floutés. En petit dessous : « collée par ton fournisseur sur chaque carton ». | Le margouillat gobe P, A et S, un « gloup » par temps. | N5 : « La description, c'est toi. Le transport, c'est Bonzini Trading Cargo. » (25,2–29,5) | LA DESCRIPTION, C'EST TOI. · LE TRANSPORT, C'EST BONZINI TRADING CARGO. · BZ-482913 · EXEMPLE · collée par ton fournisseur sur chaque carton | Signature balafon (25,2), trois « gloup ». |
| 29,6–33,0 | **FIN ET BOUCLE.** Dans la zone nuit, le logo Bonzini Trading Cargo, puis « Chine → Douala · bateau ou avion ». Tampon « MAINTENANT, TU SAIS. ». Pastille ambre d'appel à commenter, avec la ligne pour taguer. Dernière image : « C'EST ÇA ✓ » exactement à la place du sous-titre de l'image 0. | La pastille rebondit une fois. | N6 : « Écris FICHE en commentaire. Maintenant, tu sais. » (29,7–32,6) | Bonzini Trading Cargo · Chine → Douala · bateau ou avion · MAINTENANT, TU SAIS. · Écris FICHE en commentaire ↓ · Tague celui qui commande toujours « comme la photo » | Accord final à 32,6, coupe sèche à 33,0. |

La marque est visible dès 17,6 s (la note violette), puis pleinement de 25,0 s à la fin (8 s).

### Voix : texte exact
- **Narratrice**, voix femme habituelle :
  - N1 « C'est ce que tu as écrit. »
  - N2 « Ce que tu n'écris pas… c'est lui qui le choisit. »
  - N3 « Matière, taille, anses, emballage… tout par écrit. »
  - N4 « L'échantillon d'abord… et garde-le pour comparer. »
  - N5 « La description, c'est toi. Le transport, c'est Bonzini Trading Cargo. »
  - N6 « Écris FICHE en commentaire. Maintenant, tu sais. »
- **TOI**, voix d'homme de « PAS REÇU. » :
  - T1 « Mes sacs sont arrivés ! » (content)
  - T2 « Eh… c'est pas ça ! » (choqué)
  - T3 « Sacs noirs, bonne qualité, comme la photo. » (fier, il lit sa commande)
  - T4 « Ahh… c'est ça ! » (soulagé ; on peut reprendre l'intonation de « Ahh… voilà ! » de PAS REÇU)
- **Le fournisseur n'a pas de voix** : c'est la narratrice qui lit sa plaque.

### Texte à l'écran, dans l'ordre
1. « CE QUE J'AI COMMANDÉ | CE QUE J'AI REÇU » (bandeau) · « LA PHOTO » (polaroïd) · « Boutique · Mboppi » · « JE SAVAIS PAS. · 3/5 »
2. « Mes sacs sont arrivés ! » (sous-titre, pastille TOI)
3. « C'EST PAS ÇA ! » (plaque ambre)
4. « QUI A TORT ? » (pastille orange) · « C'EST CE QUE TU AS ÉCRIT. » (plaque d'acier, pastille « TON FOURNISSEUR · CHINE »)
5. « SACS NOIRS. BONNE QUALITÉ. COMME LA PHOTO. » (carton mince, TOI) · « TAILLE ? » « MATIÈRE ? » « ANSES ? »
6. « CE QUE TU N'ÉCRIS PAS, C'EST LUI QUI LE CHOISIT. »
7. « LA PROCHAINE COMMANDE : »
8. « MATIÈRE ✓ » « TAILLE ✓ » « ANSES ✓ » « EMBALLAGE ✓ » · tampon « TOUT PAR ÉCRIT »
9. « + MON ÉTIQUETTE BONZINI SUR CHAQUE CARTON » (note violette)
10. « ÉCHANTILLON » (colis) · « L'ÉCHANTILLON D'ABORD. » · « GARDE-LE POUR COMPARER. » · « PAREIL ✓ » · « À GARDER »
11. « C'EST ÇA ✓ »
12. « LA DESCRIPTION, C'EST TOI. » · « LE TRANSPORT, C'EST BONZINI TRADING CARGO. » · « BZ-482913 · EXEMPLE » · « collée par ton fournisseur sur chaque carton »
13. Carte de fin : « Bonzini Trading Cargo · Chine → Douala · bateau ou avion » · « MAINTENANT, TU SAIS. » · « Écris FICHE en commentaire ↓ » · « Tague celui qui commande toujours « comme la photo » »

### Faits utilisés et sources
| Fait | Source |
|---|---|
| Une spécification vague donne un mauvais produit : il faut tout mettre par écrit. | https://www.sourcingallies.com/blog/sourcing-from-china-7-mistakes (erreur n°3) |
| La commande précise le type d'emballage et l'étiquetage (ligne EMBALLAGE ; l'étiquetage va dans la légende). | https://change-sourcing.com/china-sourcing-tips-for-ecommerce-startups/ |
| La proforma contient une description complète ; une description précise (matière, usage, neuf ou usagé) aide aussi à trouver le code en douane (commentaire épinglé). | `douane-partie-2/data/research_p2.md` §2.2 (point 1) et §3.1 (geste 1) |
| Commander un échantillon avant une grosse commande. | `serie/BRIEF.md` (vérités générales) ; https://papacameroun.com/2026/07/06/comment-acheter-sur-alibaba-depuis-le-cameroun-guide-complet-pour-importer-facilement/ |
| Garder l'échantillon approuvé comme référence pour comparer la production (on ne promet rien d'autre). | change-sourcing.com (« golden sample ») ; sourcingallies.com (erreur n°2, avec sa réserve) |
| Code client unique BZ suivi de 6 chiffres ; le fournisseur colle l'étiquette sur chaque carton ; bandeau bleu = bateau. | `fret/data/script.json` S2, S3, S9 ; `src/lib/customerCode.ts` ; `src/lib/shippingLabelCanvas.ts` |
| Le code d'exemple n'est permis qu'avec la mention « exemple ». | `explainer-v2/SPEC_V2.md` (Rules) |
| Bonzini Trading Cargo : de la Chine à Douala, en bateau ou en avion. | `serie/BRIEF.md` ; `fret/data/script.json` S7, S8 |

### Musique et bruitages
- **Musique** : makossa (`pas-recu/lib/makossa.py`, `audio_recu.py`). Version tendue en fa dièse mineur de 2,0 à 9,2 ; coupure totale ; montée à 13,0 ; balafon clair sur la fiche ; la majeur pleine à 23,8.
- **Bruitages** (`pas-recu/lib/audio.py`, `instruments.py`) :
  - carton déchiré, « pouf », BOUM, billes, clac de métal posé ;
  - tampons, grillon, notes moqueuses, punaise, kraft ;
  - clink ×3, « gloup » ×3, signature balafon.

### Modules réutilisés et à créer
- **Réutilisés** (environ 85 %), d'abord dans `pas-recu/overlay/scenes/` :
  - `10_table.js` (nappe wax), `30_plates.js` (plaques acier, ambre et carton mince, écrasement, crêpe, fissures) ;
  - `32_letters.js` (sous-titre, lettres qui giclent, chute et roulement de P, A, S, recentrage) ;
  - `40_gecko.js` (sursaut, plissement, bouchées) et `60_type.js` (pastilles, bandeaux, tampons, carte de fin).
- **Réutilisés ailleurs** :
  - colis kraft : `bonneteau-feyman/overlay/scenes/20_props.js` (P_parcel) ;
  - gants : `30_hands.js`, poses `grip`, `tap` et `open` existantes ;
  - polaroïd : `explainer-v2/overlay/scenes/13_prints.js` ;
  - étiquette : rendu réel de `src/lib/shippingLabelCanvas.ts`, flouté, avec des données fictives ;
  - voix : `pas-recu/lib/tts_kyutai.py`.
- **À créer** :
  - une variante « matin » de l'éclairage de `10_table.js` (ampoule éteinte, lumière de porte) ;
  - deux sprites de cabas (rigide à deux anses, souple à une bride) ;
  - les étiquettes « ? » qui s'envolent et deviennent ✓ ;
  - la note violette épinglée ;
  - de nouvelles manches de gants, unies et sans chevalière (aujourd'hui, une chevalière dorée est dessinée sur le gant gauche) ;
  - une couleur de ruban paramétrable pour P_parcel (kraft pour les colis du fournisseur).
- **Délai** : environ 1,5 jour.

### Publication
- **Mot-clé** : **FICHE**.
- **Réponse WhatsApp à préparer** : la fiche de commande à remplir pour chaque produit, avec le rappel « échantillon d'abord ». Elle contient :
  - matière, taille ou dimensions, couleur, quantité, emballage, étiquetage du produit ;
  - « mon étiquette Bonzini sur chaque carton ».
- **Couverture** (A/B) : 1,5 s (« C'EST PAS ÇA ! » sur le mème photo / reçu) ou 23,1 s (« C'EST ÇA » avec le P et le A qui tombent).
- **Texte de publication** :
  > Ce que j'ai commandé / ce que j'ai reçu… « Bonne qualité, comme la photo », ce n'est pas une commande.
  > Ce que tu n'écris pas, c'est le fournisseur qui le choisit. Pour chaque produit, par écrit : matière, taille, couleur, quantité, emballage, étiquetage. Et l'échantillon d'abord : garde-le pour comparer.
  > Le transport, c'est Bonzini Trading Cargo : ton étiquette sur chaque carton, de la Chine à Douala.
  > Écris FICHE : on te donne la fiche de commande à remplir.
  > Tague celui qui commande toujours « comme la photo ».
  > #ImportChine #Mboppi #Douala #Commerçant #AchatChine
- **Commentaire épinglé** :
  > Qui avait tort ? Le fournisseur a suivi ce qui était écrit. Bien décrire ton produit sert aussi à la douane : c'est la description qui aide à trouver le bon code. Et l'échantillon reste ta référence pour comparer.

### Vérification règle par règle
| Règle | Comment elle est respectée |
|---|---|
| Une vue, sans le son | Le mème photo / reçu se lit avant le texte. La leçon est tenue 3,8 s. Les « ? » deviennent des ✓. Les rôles sont écrits en toutes lettres. |
| Phrases clés dites ET écrites | « C'est ce que tu as écrit », « Ce que tu n'écris pas, c'est lui qui le choisit », « tout par écrit », « l'échantillon d'abord », « la description, c'est toi / le transport, c'est Bonzini Trading Cargo » : toutes dites et écrites. |
| Vocabulaire du paiement | Le paiement est absent. Aucun mot interdit : on emploie « colle », « commande », « écris ». |
| Chiffres | Aucun, sauf « BZ-482913 · EXEMPLE ». |
| Superlatifs et promesses | Jamais « garanti » : on dit « garde-le pour comparer ». Aucune promesse de qualité ou d'inspection. |
| Douane | Absente de la vidéo. Seulement une phrase dans le commentaire épinglé, sans chiffre. |
| Marques et contrefaçon | Cabas sans marque, sans monogramme, sans fermoir doré. Aucune plateforme ni messagerie. |
| Fournisseur | Plaque calme, sans visage, sans voix ni accent. Il a raison (« c'est ce que tu as écrit »). Aucun cliché. |
| Adresse et données | L'étiquette est floutée (adresse, téléphones, nom). Aucune donnée client réelle. |
| Services vérifiés | Seuls le code et l'étiquette BZ, et le cargo Chine → Douala. Bonzini ne choisit pas, ne contrôle pas et n'achète pas la marchandise (bandeau des rôles). |
| Couleurs | Ambre pour TOI et le ✓ final, orange pour les « ? » et « QUI A TORT ? », violet pour la note Bonzini et la séquence de marque. |
| Durée et mot-clé | 33 s, vertical, un mot-clé (FICHE). |

### À valider par le patron
1. La réponse WhatsApp FICHE (le contenu de la fiche).
2. Le bandeau des rôles « La description, c'est toi. Le transport, c'est Bonzini Trading Cargo. ».
3. La note « + mon étiquette Bonzini sur chaque carton » comme consigne au fournisseur, et le fait que l'étiquette bateau soit bleue sur ce carton.
4. Le dessin des deux cabas : il ne doit rappeler aucune maroquinerie connue.

---

## Épisode 4 — « PATRON, ATTENDS ! » (les arnaques)

**LA PHRASE-test** :
> « Si le fournisseur écrit qu'il a changé de compte bancaire, je ne paie pas : j'appelle d'abord son numéro que je connais déjà. Nouveau compte ? Ancien numéro. Et Bonzini Trading Cargo amène la marchandise de la Chine à Douala. »

**Seuil du test** : 4 personnes sur 5 citent « appeler l'ancien numéro avant de payer ». Aucune ne dit que « Bonzini protège des arnaques ». Toutes voient que le faux n'est PAS le vrai fournisseur.

**Durée cible** : 32 s.

**Concept retenu** : arnaques-3, 1er du sujet (7,53 ; compréhension 8).

**Corrections des juges appliquées**
- **Le colis devient « TA COMMANDE »**, avec un ruban kraft neutre. Il ne prend le ruban violet et l'étiquette Bonzini qu'en entrant dans le conteneur, pour ne pas laisser croire que « Bonzini te protège ».
- **3 voix seulement** (TA COMMANDE, TOI, narratrice). Le faux message n'a pas de voix : TOI le lit à voix haute, et la voix habituelle reste celle de la vérité. Le vrai fournisseur est une plaque sans voix.
- **3 acteurs à l'écran à la fois, au plus.**
- **Un gag local** : TOI croit au message parce qu'il y a « trois cœurs ».
- **Une règle rythmée, seule à l'écran 3,8 s** : « NOUVEAU COMPTE ? ANCIEN NUMÉRO. ».
- **Une boucle simple** : la commande ressort et bondit vers l'objectif, puis s'écrase à nouveau contre la vitre à l'image 0.
- **Le seul objet qui parle de toute la série.**

### Storyboard

| Temps (s) | Image | Mouvement | Voix / réplique | Texte à l'écran | Son |
|---|---|---|---|---|---|
| 0,0–2,4 | **ACCROCHE.** Plein cadre : le colis kraft (ruban kraft, étiquette manuscrite « TA COMMANDE ») est plaqué contre la vitre de l'écran, la face écrasée. Une auréole de poussière marque le verre. Pastille kraft « TA COMMANDE ». Puce « JE SAVAIS PAS. · 4/5 ». | L'impact est déjà là à l'image 0 (écrasement maximal de 0,0 à 0,1), avec une secousse de 8 px amortie en 6 images. Le colis se décolle et se replaque sur chaque syllabe forte. | C1, TA COMMANDE, paniquée : « Patron ! Attends ! Ne paie pas ce compte ! » (0,15–2,4) | PATRON, ATTENDS ! · NE PAIE PAS CE COMPTE ! · TA COMMANDE | THOK sur le verre (déjà à 0,0), petit craquement de vitre, souffle coupé. |
| 2,4–6,1 | Dézoom : la commande retombe sur la nappe wax, la nuit, sous l'ampoule. Au centre tombe une bulle de message stylisée : une plaque laquée vert bouteille à liseré moutarde, aucune interface réelle. Elle porte des lignes de compte floutées « •••• •••• » et trois petits cœurs. Pastille « « TON FOURNISSEUR » ? », avec un « ? » orange. À droite, la plaque ambre de TOI. Le margouillat est à gauche. Étiquette « Boutique · Mboppi ». | La bulle tombe à 2,6. Les cœurs apparaissent à 3,4 / 3,7 / 4,0 (sous 3/s). | T1, TOI lit le message à voix haute : « « On a changé de compte bancaire. Paie ici, vite. » » (3,0–6,1) | ON A CHANGÉ DE COMPTE BANCAIRE. PAIE ICI, VITE. ♥ ♥ ♥ · « TON FOURNISSEUR » ? · Boutique · Mboppi | « Ding » de message générique, pas le son d'une vraie appli. La makossa tendue entre à 2,6. |
| 6,1–8,5 | La plaque de TOI change de texte, puis avance vers la bulle. | Avancée lente. | T2, TOI, attendri : « Trois cœurs… c'est lui ! Je paie. » (6,2–8,5) | TROIS CŒURS… C'EST LUI ! · OK, JE PAIE. · TOI | Petit « aww » de guitare. |
| 8,5–11,3 | **L'INTERRUPTION.** La commande bondit entre les deux plaques. La plaque de TOI se cogne dessus et recule. Le margouillat sursaute. | Bond en écrasement-étirement à 8,5. | C2, TA COMMANDE : « Attends ! C'est peut-être pas ton fournisseur ! » (8,6–11,3) | C'EST PEUT-ÊTRE PAS TON FOURNISSEUR ! | « Boing » de carton. La musique s'arrête net à 8,6. |
| 11,3–14,3 | **LE RÉFLEXE.** Un bandeau sombre s'inscrit dans la zone nuit. La plaque de TOI devient « ALLÔ ? ». Une onde de sonnerie dessinée part du bord du cadre. | La commande saute sur les syllabes. | C3, TA COMMANDE : « Appelle-le sur le numéro que tu connais déjà ! » (11,4–14,3) | APPELLE LE NUMÉRO QUE TU CONNAIS DÉJÀ. · ALLÔ ? | Sonnerie de téléphone générique, 2 fois. |
| 14,3–17,3 | **L'APPEL.** La plaque d'acier brossé, pastille « TON FOURNISSEUR · CHINE », descend doucement, sans écrasement : c'est le vrai fournisseur, honnête. La bulle verte se met à trembler. La commande se met de côté (3 acteurs à l'écran). | Descente douce de 14,6 à 15,4. | T3, TOI, au téléphone, surpris : « Allô ?… Il dit qu'il a rien changé ?! » (14,5–17,3) | JE N'AI RIEN CHANGÉ. · TON FOURNISSEUR · CHINE · IL A RIEN CHANGÉ ?! (TOI) | Tonalité de ligne, puis un grave qui monte sous la bulle. |
| 17,3–19,8 | **LE FAUX TOMBE, ralenti de 2,4 s.** La plaque d'acier tamponne la bulle par-dessus : trois fissures à lueur orange, puis la bulle se brise. Les lettres et les trois cœurs tombent, rebondissent et roulent vers le margouillat. Un tampon orange « FAUX MESSAGE » frappe le vide. La pastille « « TON FOURNISSEUR » ? » se décolle : dessous, « PAS TON FOURNISSEUR ». La commande fait 3 sauts de joie. | Ralenti ×0,5, sur les temps. | C4, TA COMMANDE : « Ouf ! » (19,2–19,6) | FAUX MESSAGE · PAS TON FOURNISSEUR | Gros tampon, verre qui se brise, clink · clink · clink. Accord majeur à 19,6. |
| 19,8–23,6 | **LA RÈGLE, seule à l'écran 3,8 s.** Un bandeau crème, grand texte encre et orange sur 2 lignes. Le margouillat gobe un cœur. | Le texte se tamponne mot à mot. | N1 : « Nouveau compte ? Ancien numéro : appelle d'abord. » (20,0–23,0) | NOUVEAU COMPTE ? ANCIEN NUMÉRO. · appelle d'abord le numéro que tu connais | Makossa pleine en majeur, « gloup ». |
| 23,6–28,4 | **MARQUE.** La commande saute vers un mini-conteneur de 10 pieds en verre violet posé sur la nappe. Quand elle y entre, son ruban kraft devient violet et une étiquette « BONZINI TRADING CARGO » se colle ; on la voit à travers le verre. La plaque émaillée violette « BONZINI TRADING CARGO » se pose. Une étiquette kraft « Entrepôt · Foyer Balengou » est épinglée à côté. | Saut à 23,8, ruban violet à 25,0, plaque à 25,6. | C5, TA COMMANDE : « On se voit à Douala, patron ! » (23,6–25,4) · N2 : « Bonzini Trading Cargo : de la Chine à Douala. » (25,5–28,3) | BONZINI TRADING CARGO · DE LA CHINE À DOUALA · MER OU AIR · Entrepôt · Foyer Balengou | Signature balafon (25,5), portes du conteneur qui se ferment en douceur. |
| 28,4–32,0 | **FIN ET BOUCLE.** Le logo, le tampon « MAINTENANT, TU SAIS. », la pastille ambre d'appel à commenter et la ligne pour taguer. Dans la dernière demi-seconde, la commande ressort du conteneur et bondit vers l'objectif : en boucle, elle s'écrase contre la vitre de l'image 0. | La pastille rebondit une fois. Le bond va de 31,4 à 32,0. | N3 : « Écris ALLÔ en commentaire. Maintenant, tu sais. » (28,5–31,4) | MAINTENANT, TU SAIS. · Écris ALLÔ en commentaire ↓ · Tague celui qui paie trop vite | Accord final, petit « toc » sur le verre à 31,9. |

La marque est à l'écran de 23,6 s à la fin (8,4 s).

### Voix : texte exact
- **TA COMMANDE** : une nouvelle voix Kyutai, aiguë, comique, ni enfantine ni caricaturale, bien distincte de TOI. 3 voix candidates, 3 prises par réplique.
  - C1 « Patron ! Attends ! Ne paie pas ce compte ! »
  - C2 « Attends ! C'est peut-être pas ton fournisseur ! »
  - C3 « Appelle-le sur le numéro que tu connais déjà ! »
  - C4 « Ouf ! »
  - C5 « On se voit à Douala, patron ! »
- **TOI**, voix d'homme de « PAS REÇU. » :
  - T1 « « On a changé de compte bancaire. Paie ici, vite. » » (il lit le message, un peu pressé)
  - T2 « Trois cœurs… c'est lui ! Je paie. » (attendri)
  - T3 « Allô ?… Il dit qu'il a rien changé ?! » (surpris)
- **Narratrice**, voix femme habituelle :
  - N1 « Nouveau compte ? Ancien numéro : appelle d'abord. »
  - N2 « Bonzini Trading Cargo : de la Chine à Douala. »
  - N3 « Écris ALLÔ en commentaire. Maintenant, tu sais. »
- **Le faux message et le vrai fournisseur n'ont pas de voix** : texte seulement.

### Texte à l'écran, dans l'ordre
1. « PATRON, ATTENDS ! » · « NE PAIE PAS CE COMPTE ! » · pastille « TA COMMANDE » · « JE SAVAIS PAS. · 4/5 »
2. « ON A CHANGÉ DE COMPTE BANCAIRE. PAIE ICI, VITE. » + 3 cœurs · « •••• •••• » (flouté) · pastille « « TON FOURNISSEUR » ? » · « Boutique · Mboppi »
3. « TROIS CŒURS… C'EST LUI ! » puis « OK, JE PAIE. » (plaque ambre, TOI)
4. « C'EST PEUT-ÊTRE PAS TON FOURNISSEUR ! »
5. « APPELLE LE NUMÉRO QUE TU CONNAIS DÉJÀ. » · « ALLÔ ? »
6. « JE N'AI RIEN CHANGÉ. » (plaque d'acier, pastille « TON FOURNISSEUR · CHINE ») · « IL A RIEN CHANGÉ ?! » (TOI)
7. « FAUX MESSAGE » (tampon orange) · « PAS TON FOURNISSEUR »
8. « NOUVEAU COMPTE ? ANCIEN NUMÉRO. » · « appelle d'abord le numéro que tu connais »
9. « BONZINI TRADING CARGO » (plaque et étiquette) · « DE LA CHINE À DOUALA · MER OU AIR » · « Entrepôt · Foyer Balengou »
10. « MAINTENANT, TU SAIS. » · « Écris ALLÔ en commentaire ↓ » · « Tague celui qui paie trop vite »

### Faits utilisés et sources
| Fait | Source |
|---|---|
| « Nous avons changé de compte bancaire » est un piège classique. | `serie/BRIEF.md` (Faits disponibles, Arnaques) |
| Le fraudeur se fait passer pour le vrai fournisseur (par exemple via une messagerie piratée) et joue sur l'urgence. | https://professionnels.sg.fr/securite/fraude-au-faux-fournisseur |
| De nouvelles coordonnées bancaires peuvent arriver pendant la fabrication. Il faut reprendre un numéro ou un contact déjà connu et faire confirmer par ce canal. | https://sino-sourcing.fr/arnaques-fournisseurs-chinois/ |
| Le réflexe : un contre-appel direct au fournisseur, sur des coordonnées déjà vérifiées ou utilisées. | professionnels.sg.fr (même page) |
| La pression pour payer vite est un signal d'alerte. | `serie/BRIEF.md` (liste des 10 signaux) ; https://easybuyrpc.com/alibaba-arnaque |
| Bonzini Trading Cargo : de la Chine à Douala, mer ou air, entrepôt au Foyer Balengou. | `serie/BRIEF.md` (Qui on est) ; `explainer-v2/SPEC_V2.md` Q5 |

### Musique et bruitages
- **Musique** : makossa (`pas-recu/lib/makossa.py`). Silence de 0 à 2,6 s ; version tendue de 2,6 à 8,6 ; arrêt net ; accord majeur à 19,6, puis pleine en majeur.
- **Bruitages** :
  - THOK sur le verre et craquement de vitre ; « ding » de message générique ; sonnerie et tonalité génériques ;
  - « boing » de carton, tampon, verre qui casse, clink ×3, « gloup » ;
  - portes de conteneur, signature balafon, « toc » de boucle.
- Aucun son d'une vraie messagerie.

### Modules réutilisés et à créer
- **Réutilisés** :
  - le comptoir : `bonneteau-feyman/overlay/scenes/10_table.js` (dont `T_glass` / `T_glassLayer` pour l'auréole sur la vitre) et `pas-recu/overlay/scenes/02_light.js` ;
  - les objets : `bonneteau-feyman/overlay/scenes/20_props.js` (P_parcel écrasé contre la vitre, P_container en verre violet avec l'intérieur visible) ;
  - le moteur de « PAS REÇU. » : `30_plates.js` (plaque d'acier « TON FOURNISSEUR · CHINE », plaque ambre de TOI, fissures, tampon), `32_letters.js` (lettres qui tombent et roulent), `40_gecko.js` (sursaut, gobe) et `60_type.js` (pastilles, bandeaux).
- **À créer** :
  - le personnage TA COMMANDE : sauts en écrasement-étirement calés sur les syllabes (timeline des mots), sans visage ni bras ;
  - l'étiquette manuscrite « TA COMMANDE » (le module porte aujourd'hui « MA MARCHANDISE ») et la couleur de ruban paramétrable (kraft, puis violet) ;
  - la bulle de message laquée et ses cœurs ;
  - l'onde de sonnerie ;
  - la nouvelle voix.
- **Délai** : environ 1,5 jour.

### Publication
- **Mot-clé** : **ALLÔ**.
- **Réponse WhatsApp à préparer** : les 3 réflexes, sans promesse de protection :
  - nouveau compte, ancien numéro ;
  - on ne se laisse pas presser ;
  - on garde ses échanges.
- **Couverture** (A/B) : 0,3 s (la commande écrasée contre la vitre, « PATRON, ATTENDS ! ») ou 18,4 s (« FAUX MESSAGE » et la bulle qui se brise).
- **Texte de publication** :
  > « On a changé de compte bancaire, paie vite. » Stop.
  > Avant de payer, appelle ton fournisseur sur le numéro que tu connais déjà, pas sur celui du message. Nouveau compte ? Ancien numéro.
  > Partage à ton associé et au groupe des commerçants.
  > Ensuite, Bonzini Trading Cargo amène ta marchandise de la Chine à Douala (mer ou air, entrepôt au Foyer Balengou).
  > Écris ALLÔ : on te donne les réflexes sur WhatsApp. Tague celui qui paie trop vite.
  > #Arnaque #ImportChine #Douala #Mboppi #Commerçant
- **Commentaire épinglé** :
  > Un vrai fournisseur comprend qu'on appelle pour vérifier. Un message pressé qui change les coordonnées de paiement : on appelle d'abord, sur un numéro déjà utilisé.

### Vérification règle par règle
| Règle | Comment elle est respectée |
|---|---|
| Une vue, sans le son | Une histoire, une règle écrite trois fois (« appelle le numéro que tu connais déjà », « je n'ai rien changé », « nouveau compte ? ancien numéro »). Chaque acteur a sa pastille et sa couleur. |
| Phrases clés dites ET écrites | « Ne paie pas ce compte », « appelle le numéro que tu connais déjà », « Nouveau compte ? Ancien numéro », « de la Chine à Douala » : toutes dites et écrites. |
| Vocabulaire du paiement | « Paie / payer » seulement. Le faux écrit « paie ici », sans aucun mot interdit. Le paiement est le piège, pas le sujet. Bonzini Labs n'est pas cité. |
| Chiffres | Aucun (les numéros de compte sont floutés). |
| Superlatifs et promesses | On ne dit jamais que Bonzini protège ou détecte la fraude : la protection, c'est le réflexe d'appeler. « Peut-être » garde l'avertissement prudent. « On se voit à Douala » n'est pas une date. |
| Douane | Absente. |
| Marques | Aucune interface ni aucun son de messagerie réelle. « WhatsApp » n'apparaît que dans la légende. |
| Fournisseur | Le vrai fournisseur chinois est le personnage honnête : plaque calme, c'est lui qui démasque le faux. Le fraudeur est un usurpateur sans visage, sans nationalité ni accent, aux couleurs du feyman (vert, moutarde), jamais celles de la marque ni de la Chine. |
| Adresse et données | « Foyer Balengou » seulement. Les comptes sont floutés. |
| Services vérifiés | Cargo Chine → Douala, mer ou air, entrepôt. Aucun service anti-fraude. |
| Couleurs | Orange pour « ? », « FAUX MESSAGE » et les fissures ; ambre pour TOI ; violet seulement au moment du conteneur Bonzini. |
| Durée et mot-clé | 32 s, vertical, un mot-clé (ALLÔ). |

### À valider par le patron
1. La voix de TA COMMANDE : 3 candidates, à faire écouter aussi à 2 ou 3 Doualais.
2. Le gag des « trois cœurs » : il doit faire rire sans rendre TOI ridicule.
3. La réponse WhatsApp au mot ALLÔ.
4. « Bonzini Trading Cargo : de la Chine à Douala » comme seule phrase de marque.

---

## Épisode 5 — « J'AI FIXÉ MON PRIX. » (douane)

**LA PHRASE-test** :
> « Il a fixé son prix sans connaître sa douane : le droit de douane et la TVA à 19,25 % ont écrasé sa marge. Avec le module douane de Bonzini Labs, en test, on estime ces taxes avant de payer son fournisseur : mêmes taxes, mais comptées dans le prix. »

**Seuil du test** : 4 personnes sur 5 citent « connaître sa douane avant de fixer son prix » ET « Bonzini estime avant ». Aucune ne dit que « Bonzini paie ou baisse la douane ».

**Durée cible** : 34,3 s.

**Concept retenu** : douane-2, 1er du sujet (7,30 ; compréhension 8).

douane-1 et douane-3 sont sous le seuil de compréhension : 5 et 4.

**Corrections des juges appliquées**
- **3 plaques au lieu de 5**, sans « ACCISES » (mot peu connu) : DROIT DE DOUANE · TVA 19,25 % · « + AUTRES TAXES » (petite, avec le gag « Même toi ?! »). Le produit est concret, « 100 paires de baskets » : des baskets neuves n'ont pas d'accises, donc les 3 plaques sont exactes. « Le transport aussi est taxé » passe dans la légende et le commentaire épinglé.
- **Le droit de douane est la plaque la plus lourde**, et la TVA vient juste derrière. C'est le poids réel d'une note dans l'exemple de la fiche de faits : droit 30, TVA 25,2.
- **Le choc dès l'image 0** : la plaque DROIT DE DOUANE est déjà en chute et s'écrase à 1,3 s.
- **On ne lit pas d'économie** :
  - quand on rejoue, les plaques gardent la même taille ;
  - leurs contours d'avant, en pointillés, se superposent exactement, avec le tampon « MÊMES TAXES = » ;
  - l'accolade s'allonge avec « MON PRIX ↑ » en grand.
- **Plus de « TA MARGE TIENT »** : on dit « TON PRIX LES COMPTE. ».
- **La séquence Bonzini est allégée** : un mot géant sur le téléphone, « AVANT » ; « EN TEST » en petit tampon ; la mention légale en petit, permanente.
- **Deux versions préparées** : (A) « EN TEST » si le simulateur est testé dans un navigateur avec ses textes corrigés ; (B) « BIENTÔT » sinon.

### Storyboard

| Temps (s) | Image | Mouvement | Voix / réplique | Texte à l'écran | Son |
|---|---|---|---|---|---|
| 0,0–1,3 | **ACCROCHE.** Comptoir wax, la nuit, sous l'ampoule. Au centre, une tour : en bas, une plaque kraft « MARCHANDISE » (sous-ligne « 100 paires de baskets ») ; dessus, une épaisse plaque ambre « MA MARGE » ; à droite, une accolade dessinée « MON PRIX ». Sous-titre avec la pastille TOI. **Dès l'image 0**, la plaque d'acier « DROIT DE DOUANE » entre par le haut, floue de vitesse, et son ombre grossit sur « MA MARGE ». Étiquette « Boutique · Mboppi ». Puce « JE SAVAIS PAS. · 5/5 · DOUANE ». Le margouillat est couché à gauche. | La plaque est en chute dès 0,0. | T1, TOI, fier : « J'ai fixé mon prix ! » (0,05–1,2) | J'ai fixé mon prix ! · TOI · MARCHANDISE · 100 paires de baskets · MA MARGE · MON PRIX | Bourdonnement d'ampoule, sifflement de chute. Pas de musique. |
| 1,3–4,4 | **PLAQUE 1, la plus lourde.** « DROIT DE DOUANE » s'écrase sur la tour : la marge s'enfonce d'environ 40 % et un nuage de poussière se lève. Compteur orange « 1/3 ». | Impact à 1,3. Le margouillat sursaute. | N1 : « Le droit de douane, selon le code. » (1,5–3,6) | DROIT DE DOUANE · selon le code du produit · 1/3 | BOUM de métal. La makossa tendue entre à 1,3. |
| 4,4–9,4 | **PLAQUE 2, à peine plus petite.** « TVA 19,25 % » s'écrase : la marge devient une crêpe et l'accolade « MON PRIX » se tord. « 2/3 ». | Impact à 4,5. | N2 : « La TVA : 19,25 %… sur le tout, droit compris. » (4,6–9,3 ; tts « dix-neuf virgule vingt-cinq pour cent ») | TVA 19,25 % · sur le tout, droit compris · 2/3 | Clac de métal sur le temps, la musique se densifie. |
| 9,4–10,7 | **PLAQUE 3, toute petite.** « + AUTRES TAXES » tombe en dernier. « 3/3 ». | Petit rebond. | T2, TOI : « Même toi ?! » (9,7–10,5) | + AUTRES TAXES · 3/3 · Même toi ?! | « Tink » minuscule. La musique se coupe net à 10,7. |
| 10,7–15,2 | **LE VERDICT.** Arrêt net. La crêpe « MA MARGE » transpire ; sous elle, une ligne tremblante de TOI. Un bandeau sombre s'inscrit dans la zone nuit. Le margouillat plisse les yeux. | Goutte de sueur. | T3, TOI, toute petite voix : « …je savais pas. » (10,9–12,0) · N3 : « Prix fixé sans connaître sa douane : c'est ça. » (12,2–15,1) | …JE SAVAIS PAS. · PRIX FIXÉ SANS CONNAÎTRE SA DOUANE : C'EST ÇA. | Grillon, « plic » de sueur, 3 notes moqueuses. |
| 15,2–17,9 | **ON REJOUE.** Rembobinage visible : les plaques remontent et la marge se regonfle. Un bandeau crème à texte encre s'inscrit. | Rembobinage de 15,2 à 16,2. | N4 : « La même commande… en estimant avant. » (15,3–17,8) | LA MÊME COMMANDE, EN ESTIMANT AVANT : | Bande rembobinée, montée. |
| 17,9–23,5 | **BONZINI.** La lumière violette tombe. Un téléphone se pose à côté de la tour : capture masquée du module douane (« À payer à la douane », barre de 4 couleurs, montants « • ») et, en très gros sur l'écran, « AVANT ». Petit tampon « EN TEST » (version B : « BIENTÔT »). Les mêmes plaques sortent du téléphone une par une, **à la même taille**, avec un liseré de couleur (violet pour le droit, or pour la TVA, gris pour les autres). Leurs contours d'avant, en pointillés, se superposent exactement : tampon « MÊMES TAXES = ». La mention légale reste en bas de 17,9 à 27,5. | Plaques à 19,8 / 20,8 / 21,6, tampon à 22,4. | N5 : « Avec Bonzini Labs, en test : tes taxes estimées… avant de payer ton fournisseur. » (18,0–23,4) | BONZINI LABS · MODULE DOUANE · AVANT · EN TEST · MÊMES TAXES = · TES TAXES ESTIMÉES AVANT DE PAYER TON FOURNISSEUR · Estimation · à faire confirmer par un commissionnaire agréé en douane | Signature balafon (18,0), atterrissages doux « tonk ». |
| 23,5–27,5 | **LE PRIX JUSTE.** Les plaques se rangent en douceur DANS la tour, entre « MARCHANDISE » et « MA MARGE ». La tour monte ; « MA MARGE » reste au sommet, intacte ; l'accolade s'allonge pour tout englober, avec « MON PRIX ↑ » en grand. Un bandeau s'inscrit. Le margouillat fait ses pompes de joie. | Empilement doux sur les temps. | N6 : « Mêmes taxes… mais connues avant. Ton prix les compte. » (23,6–27,4) | MÊMES TAXES. MAIS CONNUES AVANT. · TON PRIX LES COMPTE. · MON PRIX ↑ | Accord majeur à 23,5, makossa pleine. |
| 27,5–34,3 | **FIN ET BOUCLE.** Dans la zone nuit : le logo Bonzini, « Bonzini Trading Cargo », « Payez le juste droit. Ni plus, ni moins. », une petite ligne « Module douane : Bonzini Labs · en test ». Tampon « MAINTENANT, TU SAIS. ». Pastille ambre d'appel à commenter. Dernière image : le haut de la tour exactement là où l'ombre apparaît à l'image 0. | La pastille rebondit une fois. | N7 : « Bonzini Trading Cargo. Payez le juste droit. » (27,6–30,3) · CHANT, logo sonore du teaser : « Ni plus. Ni moins. » (30,4–31,5) · N8 : « Écris AVANT en commentaire. Maintenant, tu sais. » (31,6–34,0) | Bonzini Trading Cargo · Payez le juste droit. Ni plus, ni moins. · Module douane : Bonzini Labs · en test · MAINTENANT, TU SAIS. · Écris AVANT en commentaire ↓ | Logo sonore chanté, accord final, coupe sèche à 34,3. |

La marque est à l'écran de 17,9 s à la fin (16,4 s), avec la mention légale pendant toute la séquence du module.

### Voix : texte exact
- **TOI**, voix d'homme de « PAS REÇU. » :
  - T1 « J'ai fixé mon prix ! » (fier)
  - T2 « Même toi ?! » (outré, vers la petite plaque)
  - T3 « …je savais pas. » (toute petite voix)
- **Narratrice**, voix femme habituelle :
  - N1 « Le droit de douane, selon le code. »
  - N2 « La TVA : 19,25 %… sur le tout, droit compris. » (tts « La TVA : dix-neuf virgule vingt-cinq pour cent… sur le tout, droit compris. »)
  - N3 « Prix fixé sans connaître sa douane : c'est ça. »
  - N4 « La même commande… en estimant avant. »
  - N5, version A : « Avec Bonzini Labs, en test : tes taxes estimées… avant de payer ton fournisseur. » Version B : « Bientôt avec Bonzini Labs : tes taxes estimées… avant de payer ton fournisseur. »
  - N6 « Mêmes taxes… mais connues avant. Ton prix les compte. »
  - N7 « Bonzini Trading Cargo. Payez le juste droit. » (signature validée, gardée au vouvoiement)
  - N8 « Écris AVANT en commentaire. Maintenant, tu sais. »
- **CHANT** : « Ni plus. Ni moins. » (logo sonore du teaser douane, prise existante).

### Texte à l'écran, dans l'ordre
1. « J'ai fixé mon prix ! » (TOI) · « MARCHANDISE » · « 100 paires de baskets » · « MA MARGE » · « MON PRIX » (accolade) · « Boutique · Mboppi » · « JE SAVAIS PAS. · 5/5 · DOUANE »
2. « DROIT DE DOUANE » · « selon le code du produit » · « 1/3 »
3. « TVA 19,25 % » · « sur le tout, droit compris » · « 2/3 »
4. « + AUTRES TAXES » · « 3/3 » · « Même toi ?! » (TOI)
5. « …JE SAVAIS PAS. » (TOI) · « PRIX FIXÉ SANS CONNAÎTRE SA DOUANE : C'EST ÇA. »
6. « LA MÊME COMMANDE, EN ESTIMANT AVANT : »
7. « BONZINI LABS · MODULE DOUANE » · « AVANT » (géant, sur le téléphone) · « EN TEST » (version B : « BIENTÔT ») · « MÊMES TAXES = » · « TES TAXES ESTIMÉES AVANT DE PAYER TON FOURNISSEUR » · mention : « Estimation · à faire confirmer par un commissionnaire agréé en douane »
8. « MÊMES TAXES. MAIS CONNUES AVANT. » · « TON PRIX LES COMPTE. » · « MON PRIX ↑ »
9. Carte de fin : « Bonzini Trading Cargo » · « Payez le juste droit. Ni plus, ni moins. » · « Module douane : Bonzini Labs · en test » · « MAINTENANT, TU SAIS. » · « Écris AVANT en commentaire ↓ »

### Faits utilisés et sources
| Fait | Source |
|---|---|
| Le droit de douane dépend du code du produit. | `media/bonzini-cargo-reel/douane-partie-2/data/research_p2.md` §1.1 (ligne 1) ; `teaser-douane/analysis/factcheck.md` ligne 14 |
| Dans une note, le droit pèse plus que la TVA : exemple à 30 % de droit, 30 contre 25,2 sur une valeur de 100. Cela sert seulement à dimensionner les plaques ; aucun chiffre n'est montré. | `research_p2.md` §1.7 |
| TVA à l'importation : 19,25 % au taux général, sur le tout, droit compris. | `research_p2.md` §1.1 (ligne 4) et §5 ; `factcheck.md` ligne 13 |
| L'ordre est écrit dans la loi : le droit, puis les accises si le produit en a, puis la TVA sur le tout. Il y a aussi de petites taxes en plus. | `research_p2.md` §1.2, §1.1 (lignes 3 et 5), §3.1 (geste 3) |
| Les baskets neuves n'ont pas d'accises : la plaque « accises » n'a donc pas de raison d'être ici. | `research_p2.md` §1.3 et §1.8 |
| Le transport aussi est taxé : la valeur en douane = marchandise + transport + assurance (légende et commentaire épinglé). | `research_p2.md` §1.2 et §3.1 (geste 2) |
| La douleur : on fixe son prix sans connaître sa douane (« on verra à l'arrivée »). | `teaser-douane/analysis/pain.md` §2.9 et §4 |
| Le module est en ligne depuis le 30/09/2026 mais n'a jamais été testé dans un navigateur. Son résultat « À payer à la douane » détaille ligne par ligne. Deux versions sont à préparer, (A) « en test » et (B) « Bientôt ». Il s'arrête au port d'arrivée. | `research_p2.md` §3.3 ; `teaser-douane/analysis/product.md` §1.1 et §2 |
| Mention obligatoire : « Estimation · à faire confirmer par un commissionnaire agréé en douane ». | `teaser-douane/analysis/product.md` §5 (`sim.disclaimer`, `site.footerNote`) ; `research_p2.md` §3.3 |
| Bonzini n'est pas commissionnaire agréé en douane. | `research_p2.md` §4.8 |
| En groupage, la douane comprise dans le tarif ou payée à part est dans ton prix. Ne jamais dire que la TVA est récupérable en groupage. | `prix-de-revient/data/script.json` S8 ; `research_p2.md` §1.5 et §6 |
| À l'IGS, la TVA de la douane ne revient pas (commentaire épinglé). | `research_p2.md` §1.5 |
| Signature validée : « Payez le juste droit. Ni plus, ni moins. » | `teaser-douane/README.md` ; `teaser-douane/analysis/product.md` (promesse la plus sûre) |

### Musique et bruitages
- **Musique** : makossa de série (`pas-recu/lib/makossa.py`, `audio_recu.py`). Version tendue de 1,3 à 10,7 ; coupure totale ; bande rembobinée ; la majeur à partir de 23,5.
- **Logo sonore** : « Ni plus. Ni moins. », pris dans le teaser (`teaser-douane/lib/groove.py` et sa prise chantée).
- **Bruitages** : sifflement de chute, BOUM, clac, « tink », grillon, sueur, rembobinage, « tonk », signature balafon, accord final.

### Modules réutilisés et à créer
- **Réutilisés** (presque tout le moteur de « PAS REÇU. »), dans `pas-recu/overlay/scenes/` :
  - `01_score.js` (la partition) et `02_light.js` (la lumière violette) ;
  - `10_table.js` (la nappe) et `30_plates.js` (plaques acier et ambre, écrasement, crêpe) ;
  - `32_letters.js` (sueur, rembobinage), `40_gecko.js` (sursaut, plissement, pompes) et `60_type.js` (tampons, compteur, bandeaux, carte de fin).
- **Réutilisés ailleurs** :
  - les captures masquées : `teaser-douane/assets/img/cap/` ;
  - le logo sonore : `teaser-douane/lib/groove.py` ;
  - les voix : `pas-recu/lib/tts_kyutai.py`.
- **À créer** :
  - la plaque kraft « MARCHANDISE » ;
  - l'accolade « MON PRIX », qui se tord puis s'allonge, et « MON PRIX ↑ » ;
  - l'empilement doux de la tour qui monte ;
  - les liserés de couleur et les contours en pointillés avec le tampon « MÊMES TAXES = » ;
  - le mot « AVANT » sur la capture.
- **Délai** : environ 1 jour.

### Publication
- **Mot-clé** : **AVANT**.
- **Réponse WhatsApp à préparer** :
  - version A : le lien vers le module, seulement après un test réel réussi, avec la mention légale ;
  - version B : « bientôt », plus les 3 choses à avoir sous la main (description du produit, prix, transport) ;
  - dans les deux cas, ni URL avant test, ni chiffre.
- **Couverture** (A/B) : 1,4 s (la plaque « DROIT DE DOUANE » qui écrase « MA MARGE ») ou 25 s (la tour finale, « MÊMES TAXES. MAIS CONNUES AVANT. »).
- **Texte de publication** :
  > J'ai fixé mon prix… puis la douane est arrivée.
  > Le droit de douane dépend du code du produit. La TVA, 19,25 % au taux général, se calcule sur le tout, droit compris. Et le transport aussi est taxé.
  > Mêmes taxes, mais connues avant : avec le module douane de Bonzini Labs (en test), estime tes droits et taxes avant de payer ton fournisseur. Estimation à faire confirmer par un commissionnaire agréé en douane.
  > Payez le juste droit. Ni plus, ni moins.
  > Écris AVANT en commentaire.
  > #Douane #ImportChine #Douala #Mboppi #Commerçant
- **Commentaire épinglé** :
  > En groupage, la douane peut être comprise dans ton tarif : comprise ou payée à part, elle est dans ton prix. Petit commerçant à l'IGS : la TVA de la douane ne revient pas, compte-la. Bonzini n'est pas commissionnaire en douane : il t'aide à savoir avant.

### Vérification règle par règle
| Règle | Comment elle est respectée |
|---|---|
| Une vue, sans le son | La marge écrasée, puis la même tour avec les taxes rangées DANS le prix. « MÊMES TAXES = » et « MON PRIX ↑ » empêchent de lire « Bonzini supprime la taxe ». |
| Phrases clés dites ET écrites | « Droit de douane, selon le code », « TVA 19,25 %, sur le tout, droit compris », « en estimant avant », « Mêmes taxes, mais connues avant », « avant de payer ton fournisseur » : toutes dites et écrites. |
| Vocabulaire du paiement | « Payer ton fournisseur », « Payez le juste droit ». Aucun mot interdit. Le paiement des fournisseurs n'est pas le sujet. |
| Chiffres | Seulement 19,25 % (autorisé, `research_p2.md` §5) et les compteurs 1/3 à 3/3. Aucun taux de droit ni montant : captures masquées « • ». |
| Superlatifs et promesses | Ni « au franc près », ni « économise », ni « garanti ». « Ton prix les compte » est une méthode, pas une promesse. |
| Douane | Aucun douanier, guichet ni corruption, aucune accusation : c'est le manque d'information qui écrase la marge. Bonzini n'est pas commissionnaire. « Estimation à faire confirmer » reste à l'écran pendant tout le module. Pas d'URL avant un test réel. |
| Marques | Aucun logo officiel ni tiers. Baskets non montrées, seulement nommées. |
| Fournisseur | Absent. |
| Adresse et données | Aucune. |
| Services vérifiés | Le module douane en test (ou « Bientôt »). Il ne déclare pas et s'arrête au port : on ne parle pas de prix de revient complet. |
| Couleurs | Orange pour les compteurs et les tampons, ambre pour TOI et la marge, violet pour le module et le liseré du droit. |
| Durée et mot-clé | 34,3 s (sous la limite de 35 s), vertical, un mot-clé (AVANT). |

### À valider par le patron
1. **Le jour de la publication**, choisir entre la version A (« en test ») et la version B (« Bientôt »). La version A suppose deux choses : un test du simulateur dans un navigateur, et la correction des textes publics signalés dans `research_p2.md` §3.3. Exemples : « au franc près », « tarif 2026 », « taux de la BEAC du jour », « déductible de vos impôts ». Ne jamais les filmer.
2. **L'angle « ta douane » pour les clients en groupage**, dont le tarif peut déjà comprendre la douane (la formule du commentaire épinglé).
3. **La signature au vouvoiement**, « Payez le juste droit. », dans une série au tutoiement.
4. **La réponse WhatsApp au mot AVANT.**
5. **La phrase sur l'IGS** dans le commentaire épinglé (garder ou retirer).

---

## Concepts non retenus, intéressants pour plus tard

- **business-3 « NOTE CETTE DATE. » (Nouvel An chinois, samedi 6 février 2027)** : **À PRODUIRE EN BONUS AVANT LA MI-NOVEMBRE 2026.** Meilleure compréhension des 15 (9). La date est vérifiée, environ 1 jour avec `golden-week/overlay/scenes/10_alert.js`.
  Corrections pour ce bonus :
  - ouvrir sur TOI qui promet « Tes perruques arrivent pour le 8 mars ! » ;
  - remplacer « On te prévient avant » par « Note-le. Partage-le au groupe. », sauf si une liste d'alertes existe.
- **business-2 « LE NOUVEAU vs LE VIEUX PÈRE »** : l'écran partagé et « tague le nouveau » sont de bons moteurs, et le groupage y est la solution visible. À reprendre comme épisode « tester petit », en 2 manches et avec des répliques de 5 mots au plus. Le patron doit d'abord confirmer qu'il n'y a pas de minimum de groupage.
- **arnaques-1 « TRADUCTION. »** : c'est le meilleur levier de reconnaissance (les phrases mot pour mot, la vanne « pour l'argent, le réseau passe »). Le tampon doit devenir « EN VRAI » sans logo Bonzini, et une seconde de vrai fournisseur honnête doit être ajoutée. On peut en tirer 3 épisodes sur les 10 signaux.
- **achat-3 « JE SUIS À QUI ? »** : le chœur « À qui ? À qui ? » est un son à mème. À garder pour un épisode « étiquette » si l'épisode 3 ne suffit pas, mais sans l'air (réservé à l'épisode 2), sans bleu ou rouge, et avec un carton qui a des yeux mais pas de bouche.
- **douane-1 « LA MÊME CHAISE »** : la chaise plastique de tout Douala est une accroche forte, mais elle risque la lecture « astuce » (le mot qui fait payer moins) et repose sur un fait de confiance moyenne. À refaire en « décris-le tel qu'il est », sans gobage de la ligne d'accises.
- **douane-3 « VRAI OU FAUX : LA DOUANE »** : format en série facile, mais trop dense à 3 phrases. À relancer avec une phrase par épisode tirée de la banque sourcée, par exemple « Petit lot, pas de taxes ? » (FAUX) ou « Le transport aussi est taxé » (VRAI).
- **cargo-2 « BLEU OU ROUGE ? »** : c'est une très bonne vidéo d'accueil pour les nouveaux clients (étiquette bleue = bateau, hachures = avion), pas une vidéo virale. On peut la remplacer par un quiz « kilo ou mètre cube ? » avec des objets pièges.
- **cargo-3 « PATRON, C'EST MOI, TON COLIS ! »** : TA COMMANDE (épisode 4) peut raconter plus tard son voyage, en 4 étapes au plus : réception, groupage, bateau, Foyer Balengou, avec la vraie voix de l'équipe.
- **arnaques-2 « LEQUEL EST LE FAUX ? »** : un quiz A/B qui fait commenter son score. À refaire en 2 manches (le prix, la vidéo en direct), avec des polaroïds dessinés en papier découpé et sans images générées.
- **achat-2 « LA TANTINE A 4 QUESTIONS »** : la Tantine est une figure attachante. À reprendre avec 3 questions et 8 répliques, et une chute « S'il refuse… méfie-toi. ». Il faudra 2 poses de gant à créer (« pointer », « petit ») et une voix à tester à Douala.

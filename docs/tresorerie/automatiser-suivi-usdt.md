# Trésorerie USDT : ne plus tout saisir à la main — les possibilités et le plan

_Document de travail du 27 septembre 2026. Il répond à la question : « comment suivre mes achats d'USDT au Cameroun et mes ventes d'USDT en Chine sans tout saisir à la main, alors que j'oublie ? »_

## En bref

- Le module trésorerie fonctionne, mais il suppose que tu saisisses chaque deal, au bon moment, sans rien oublier. Aujourd'hui, un deal te coûte ≈ 45-60 s et une quinzaine de gestes. Et rien ne remarque un oubli.
- La machine ne peut pas deviner **qui** et **à quel taux** : ces informations sont dans tes conversations WhatsApp et WeChat. Le reste peut être vu automatiquement : montants USDT, heures, paiements RMB, dépôts XAF.
- Ma recommandation :
  1. réduire ton geste à une ligne ou un vocal envoyé depuis ton téléphone ;
  2. laisser le système chercher les trous chaque soir, à partir des paiements et dépôts déjà suivis ;
  3. brancher la lecture automatique des mouvements USDT.
- Un oubli devient alors une question précise le soir, jamais un trou silencieux.
- Calendrier :
  - premiers gains sous 1 à 2 semaines (saisie éclair) ;
  - bot et clôture du soir construits en 3 à 5 semaines, puis 2 à 3 semaines de rodage avant les premières questions du soir ;
  - détection automatique des USDT en 1 à 3 mois.

## Pourquoi ça ne tient pas aujourd'hui

1. **La saisie coûte trop cher, et elle se fait au mauvais endroit.**
   - Pour un achat : 3 taps pour atteindre le formulaire, ≈ 10 taps et 2 nombres. Ensuite, sur téléphone, l'écran se ferme et revient à l'accueil de la Trésorerie.
   - Rien n'est pré-rempli ni mémorisé : ni le vendeur, ni le taux, ni le compte.
   - La date vaut « maintenant », sauf si tu ouvres « Détails ».
   - Mola sait créer un achat à partir d'un texte. Mais il le date toujours « maintenant », n'a pas de champ taux et ne lit pas les captures d'écran.
   - Au moment du deal, tu es dans WhatsApp ou WeChat, pas dans l'app.
2. **Rien ne remarque un oubli.**
   - Les dépôts clients et les paiements RMB ne sont pas reliés à la trésorerie. Résultat : les comptes XAF ne font que baisser, et les comptes CNY ne font que monter.
   - L'inventaire absorbe tout écart dans un « ajustement » avec un motif, et le solde se réaligne. Le deal oublié (qui, à quel taux) n'apparaît donc plus comme un trou à expliquer.
   - Si ce deal est saisi plus tard, il est compté deux fois.
   - Pour les USDT, cet ajustement ne corrige même pas le coût moyen.
   - Le résumé quotidien que Mola envoie sur Telegram était inactif lors de l'audit de juin, faute de 2 secrets dans le coffre de Supabase. Il faut vérifier s'ils ont été posés depuis. De toute façon, il ne parle pas de trésorerie.
3. **Une saisie tardive fausse les comptes pour toujours.**
   - Le coût moyen des USDT (le « CMP » : ce que t'a coûté, en moyenne, chaque USDT en stock) est figé au moment où une vente est saisie.
   - Si un achat est saisi 3 jours plus tard, les ventes faites entre-temps gardent un coût faux. Et si le stock saisi est à zéro au moment d'une vente, parce que les achats ne sont pas encore saisis, la vente prend un coût de 0 : sa marge est gonflée.
   - Pour corriger, il faut une annulation par le super admin. D'où la corvée de fin de période : tout reconstituer d'un coup.

## Le principe : tu ne dois plus être la source de la donnée

Trois changements :

- **Capter au moment du deal, là où tu es.**
  - Plus de formulaire : une ligne (`a fer 5000 612`) ou un vocal de 5 s.
  - Le système complète le reste : il retrouve le vendeur, met le compte habituel, calcule le montant XAF et contrôle le taux.
- **Laisser la machine voir les mouvements.**
  - Les paiements RMB exécutés et les dépôts XAF validés sont déjà dans l'app.
  - Les USDT se lisent sans rien pouvoir modifier : sur la blockchain TRON ou dans ton historique Binance. Les USDT de TRON sont dits « TRC20 », et TRON porte près de la moitié de tous les USDT.
  - Chaque mouvement devient un **brouillon** : une proposition pré-remplie que tu valides d'un tap. Tu peux le faire tout de suite, ou le soir pour tout un lot.
- **Laisser le système trouver les trous.** Chaque soir, il compare ce qui a dû se passer avec ce qui est saisi. Puis il te pose des questions précises, par exemple : « 5 000 USDT reçus à 14:32 : de qui, à quel taux ? ».

Deux règles rendent cela sûr :

- **Les comptes ne sont jamais vides.** Ils ont deux couches :
  - « vérifié » : le taux vient de toi ou d'une source sûre ;
  - « provisoire » : brouillons, taux supposé.

  Valider améliore la qualité des comptes. Ne pas valider ne fait rien disparaître.
- **Aucune estimation n'est enregistrée comme un faux deal.** Ce qui n'est pas expliqué reste affiché comme un écart chiffré, jusqu'à ce qu'on l'explique.

## Les possibilités, du plus simple au plus automatique

Les niveaux s'empilent : chacun garde les précédents.

Le même exemple sert partout :
- **Achat** : Ferdinand, 5 000 USDT à 612 XAF, soit 3 060 000 XAF payés depuis Afriland.
- **Vente** : Wang, 5 000 USDT à 7,12 CNY, soit 35 600 ¥. Wang règle cette somme en payant directement 6 fournisseurs de tes clients (paiements BZ-PY-…).

### Niveau 1 — Saisie éclair dans l'app et dans Mola

- **Ce que tu fais au quotidien.**
  - Achat : raccourci « Achat », puis la puce « Ferdinand » en tête de liste (612 et Afriland sont déjà remplis). Tu tapes 5000 et tu appuies sur « Enregistrer ». L'écran reste ouvert pour le deal suivant. Environ 5 gestes et 10-15 s.
  - Ou dans Mola : « achat ferdinand 5000 à 612 afriland, hier 15h », puis 1 tap sur la carte.
  - Vente : pareil avec la puce « Wang », 7,12 déjà rempli.
- **Ce que fait le système.**
  - Il mémorise le vendeur, le taux et le compte.
  - Il calcule la troisième valeur : deux valeurs sur trois suffisent (USDT, taux, montant). Le formulaire actuel le fait déjà, mais l'option est cachée ; Mola ne le fait pas encore.
  - Il accepte une date passée, y compris dans Mola, qui aujourd'hui date tout « maintenant ».
  - Il t'alerte si le taux s'écarte de plus de 3 % du marché, par exemple « 6120 » tapé au lieu de « 612 ».
- **Ce qui reste manuel.** Tout le geste, et il faut quitter WhatsApp pour le faire.
- **Si tu oublies.** Rien n'est enregistré et rien ne te prévient. Tu rattrapes de mémoire. **Ce niveau seul ne règle pas l'oubli.**
- **Effort de dev :** 4-6 jours. **Coût :** 0.
- **Limite :** tout dépend de ta discipline.
- **Prérequis :** aucun.

### Niveau 2 — Capturer depuis ton téléphone, sans ouvrir l'app (bot Telegram privé)

- **Ce que tu fais au quotidien.**
  - Après « ok 5000 à 612 », tu passes sur Telegram, dans le chat épinglé « Bonzini Caisse ».
  - Tu tapes `a fer 5000 612`, ou tu dictes « achat Ferdinand cinq mille à six cent douze ».
  - En 5-10 s, la carte arrive : « Achat · Ferdinand · 5 000 × 612 = 3 060 000 XAF · Afriland · 09:41 », avec deux boutons [Valider] [Corriger].
  - Tu valides d'un tap. Ou tu ne fais rien, et tu valides tout le soir. Environ 10-15 s au total.
  - Vente : `v wang 5000 7.12`.
  - Plus tard, il suffira de partager au bot une capture d'écran du chat WeChat.
- **Ce que fait le système.**
  - Il lit la ligne ou le vocal.
  - Il retrouve la contrepartie : par son nom, par un surnom qu'il a appris, ou par son téléphone.
  - Il calcule le montant et contrôle le taux.
  - Il repère les doublons : un message reçu deux fois, ou un deal déjà saisi dans l'app.
  - Il crée un brouillon avec la vraie heure du deal.
- **Ce qui reste manuel.** Le geste, qui est un nouveau réflexe à prendre, et la validation.
- **Si tu oublies.**
  - Un vocal récapitulatif (« ce matin Ferdinand 5000 à 612, Jules 3000 à 611,5 ») crée plusieurs brouillons d'un coup.
  - L'export d'une discussion WhatsApp (fichier .txt) redonne les deals tapés, avec leur heure. Les vocaux n'y figurent que sous la forme « <Médias omis> », ou comme fichiers audio à transcrire si tu exportes avec les médias.
  - WeChat ne permet pas d'exporter une discussion. Côté Chine, c'est donc le niveau 3 qui rattrape.
  - Les brouillons n'expirent jamais dans l'app. Par sécurité, nous faisons expirer les boutons Telegram après 48 h, et la clôture du soir te les renvoie.
- **Effort de dev :**
  - 10-14 jours pour le texte et le vocal. Cela comprend la boîte de brouillons, la liaison de ton compte Telegram et les correctifs de sécurité.
  - 4-6 jours de plus pour lire les captures d'écran.
- **Coût :**
  - Telegram : gratuit.
  - Vocaux : moins de 1 $/mois.
  - Captures : ≈ 0,02-0,04 $ pièce. Cela fait 10-30 $/mois si la moitié d'une trentaine de deals par jour passe par une capture, et quelques dollars si elles ne servent qu'aux rattrapages.
- **Limites.**
  - Une application de plus dans ta journée.
  - Les messages d'un bot Telegram ne sont pas chiffrés de bout en bout. On n'y met donc que des pseudonymes pour les acheteurs chinois.
  - Si ton compte Telegram est volé, quelqu'un peut créer des écritures à ton nom. Parades : tu peux couper la liaison depuis l'app, et au-delà d'un certain montant la validation se fait obligatoirement dans l'app.
  - Telegram est bloqué en Chine continentale. Si ton père doit rattacher des paiements, il le fera dans l'app, pas sur Telegram.
- **Prérequis.** Est-ce que tu utilises Telegram ?
  - Sinon, il existe une variante : un numéro WhatsApp dédié, « Bonzini Tréso ». Tu lui transfères le message du vendeur sans quitter WhatsApp.
  - Cette variante coûte 3-4 jours de dev en plus, 1 à 3 semaines de démarches auprès de Meta, et environ 18-40 $/mois. Ce coût vient de ce que les réponses d'un bot WhatsApp deviennent payantes à partir du 1er octobre 2026. C'est une estimation : le tarif Meta pour le Cameroun n'est pas confirmé.
  - Autre risque : la politique commerciale de WhatsApp interdit l'échange de « monnaie réelle, virtuelle ou fictive ». Un numéro Business consacré à des deals USDT peut donc être restreint.
  - À garder seulement si tu refuses Telegram.

### Niveau 3 — Le système trouve les trous (clôture du soir, comptes à deux couches)

- **Ce que tu fais au quotidien.**
  - Rien pendant les deals.
  - Vers 20 h, tu reçois : « 6 paiements exécutés aujourd'hui (35 600 ¥) sans vente rattachée. Réglés par qui ? [Wang · 7,12] [Li · 7,10] [Nos comptes CNY (Papa, cash)] [Je ne sais pas] ».
  - Un tap sur un acheteur crée la vente, au montant exact et à son taux de référence de la semaine. Tu peux corriger ce taux.
  - Si l'argent venait déjà des comptes de ton père, choisis « Nos comptes CNY ». Sinon, la vente serait comptée deux fois.
  - Tant que le niveau 4 n'est pas en place, une question en plus : « Solde USDT ce soir ? ». Un seul chiffre, chaque jour ou chaque semaine.
- **Ce que fait le système.**
  - Il relie chaque dépôt validé à son compte XAF. Seule exception : les dépôts en espèces en agence, qui n'ont pas de compte trésorerie.
  - Pour les paiements exécutés, l'app ne sait pas depuis quel compte CNY ils sont partis. La clôture te demande donc qui les a réglés : un acheteur, ou les comptes de ton père.
  - Il ne fait que lire : rien n'est écrit dans les comptes.
  - Il liste les paiements exécutés qui ne sont rattachés à aucune vente. C'est une liste exacte, pas une estimation.
  - Si tes acheteurs paient directement les fournisseurs, c'est ici que naissent les ventes.
  - Une fonction de rattachement semble déjà exister en production (`settle_payments_usdt`), mais aucun écran ne l'utilise.
  - Elle apparaît dans les types générés, alors que son code n'est dans aucune migration du dépôt. Il faut la relire avant de s'y fier.
  - Il compare le stock USDT réel aux livres. Quand un solde réel est connu, il compare aussi les sorties XAF aux achats saisis.
  - Il recalcule le coût moyen du jour quand un deal arrive en retard.
  - Il permet de clôturer chaque mois, par exemple le 10 du mois suivant, d'un tap confirmé. Ensuite, plus aucune écriture datée dans ce mois n'est acceptée, sauf réouverture par le super admin.
  - Il affiche deux marges : une « vérifiée », et une « provisoire » avec sa marge d'erreur (± x).
- **Ce qui reste manuel.** Dire qui et à quel taux, quand le système ne peut pas le déduire.
  - Aucune réponse n'est cochée d'avance. Sinon, fatigué, tu répondrais « oui » à tout.
  - « Je ne sais pas » laisse la ligne en provisoire.
- **Si tu oublies.**
  - Rien ne bloque. Le message te dit simplement « 3 jours non clôturés », et on les reprend du plus ancien au plus récent.
  - En fin de mois, ce qui reste devient un seul « écart non expliqué » par devise, avec un motif. Il est valorisé au coût moyen, donc sans marge inventée.
  - Ton père peut rattacher les paiements côté Chine, à condition d'avoir un accès admin qui voit l'écran « paiements à rattacher ». Le rôle trésorier ne voit pas les paiements aujourd'hui : il faudra le lui ouvrir.
  - La clôture de 20 h lui arrive à 3 h du matin, heure de Chine : il la traitera le lendemain.
  - En revanche, personne ne peut répondre à ta place pour tes achats négociés sur WhatsApp.
- **Effort de dev :** 12-18 jours. Ensuite, 2-3 semaines en mode silencieux : le système calcule sans te relancer, le temps de régler les seuils d'alerte.
- **Coût :** 0-20 $/mois (Mola).
- **Limites.**
  - Le système voit **combien** il manque, mais pas **qui**, ni **en combien de deals**.
  - Les écarts sont brouillés par les décalages de dates, les frais et les découverts clients. On les lit donc sur 3 à 7 jours glissants.
- **Prérequis.**
  - La réponse à la question 3 plus bas.
  - Vérifier les fonctions de règlement qui n'existent qu'en production.
  - Saisir une fois les soldes de départ des 10 comptes.

### Niveau 4 — La machine voit les USDT (TRON et/ou Binance, sans rien pouvoir modifier)

- **Ce que tu fais au quotidien.**
  - Achat : tu paies Ferdinand, ses USDT arrivent, et le mouvement est vu 1 à 3 min plus tard.
  - Si tu avais tapé `a fer 5000 612`, le système réunit ta ligne et le mouvement en une carte verte : « Ferdinand · 5 000 · 612 · preuve blockchain ✓ ».
  - Sinon, le soir, il te demande : « 5 000 USDT reçus à 09:52 : de qui, à quel taux ? [Ferdinand 612] [Jules 611,5] [Autre] ».
  - Vente : les USDT partent vers l'adresse de Wang, déjà connue. La carte te propose de rattacher la vente à ses paiements (35 600 ¥ ÷ 7,12 = 5 000 ✓).
- **Ce que fait le système.**
  - Il liste chaque entrée et chaque sortie d'USDT : montant, heure, identifiant de la transaction.
  - Il reconnaît les adresses déjà vues.
  - Il lit ton stock réel tout seul, dès que tous tes emplacements USDT sont branchés. La question « Solde USDT ce soir ? » disparaît alors.
  - Il vérifie que chaque capteur fonctionne.
- **Ce qui reste manuel.**
  - Le taux : il n'est jamais inscrit sur la blockchain.
  - Le vendeur, quand ses USDT viennent d'un portefeuille partagé par tous les clients d'une plateforme.
  - La validation.
- **Si tu oublies.**
  - Aucun mouvement USDT sur une adresse ou un compte surveillé ne peut disparaître : chacun devient une tâche datée et chiffrée.
  - Restent hors champ, tant qu'on n'ajoute pas de capteur pour eux : Binance Pay, les autres réseaux (BEP20…) et les autres plateformes (OKX…). Dans ces cas, c'est la comparaison entre ton stock réel et les livres qui signale l'écart.
  - Le taux reste « supposé » (le dernier taux pratiqué avec cette personne) et marqué provisoire.
  - Tu as l'heure exacte du mouvement : retrouver le deal dans WhatsApp prend 10 s.
- **Effort de dev :** 6-8 jours pour TRON seul ; 6-10 jours de plus pour Binance.
- **Coût :** 0 $, car TronGrid est gratuit à ce volume. Si Binance refuse nos serveurs, il faut une passerelle réseau : 10-50 $/mois.
- **Limites.**
  - Un mouvement interne Binance, d'un compte Binance à un autre, n'apparaît pas sur la blockchain. Seule l'API Binance le voit, et l'identité de l'expéditeur n'y est pas garantie : à vérifier sur ton historique réel.
  - Un envoi par Binance Pay indique le nom du payeur, mais il faut lire un historique séparé.
  - Binance bloque les serveurs situés aux États-Unis. Il faut tester avant de promettre.
  - La clé Binance ne donne qu'un droit de lecture. Le programme refuse de tourner si elle permet des retraits.
- **Prérequis.** Les réponses aux questions 1 et 2 ; une clé Binance en lecture seule.

### Niveau 5 — Bout en bout : le taux arrive aussi tout seul (sous conditions)

Trois options, chacune avec ses conditions.

- **5a. WhatsApp Business « Coexistence » sur ton numéro de deals.**
  - Tes conversations individuelles arrivent automatiquement dans le système, y compris tes propres messages.
  - Le « ok 5000 à 612 » de Ferdinand devient un brouillon avec le vendeur (reconnu à son numéro) et le taux. Il rejoint le mouvement USDT et donne une carte verte, validée avec le lot du soir.
  - **0 geste pendant le deal.**
  - Conditions :
    - passer ce numéro sur l'application WhatsApp Business ;
    - **les groupes ne sont pas couverts** ;
    - l'inscription se fait via un prestataire agréé par Meta, et il faut vérifier qu'elle est possible pour un numéro camerounais (+237) ;
    - le bot ne doit jamais écrire dans ces conversations : toute réponse partirait de ton numéro vers le vendeur, et elle serait facturée à partir du 1er octobre 2026 ;
    - **risque principal** : la politique commerciale de WhatsApp interdit l'échange de « monnaie réelle, virtuelle ou fictive ». Un numéro Business dont les conversations portent sur l'achat d'USDT risque des restrictions. Il faut trancher ce point avant de migrer ton numéro de deals.
  - Effort de dev : 8-12 jours, plus quelques semaines de démarches.
  - Coût : 10-30 $/mois pour la lecture des messages par l'IA, plus l'abonnement du prestataire Meta : de l'ordre de 50 €/mois par numéro chez 360dialog, par exemple. Ce dernier coût disparaît si Bonzini devient lui-même « Tech Provider » auprès de Meta.
- **5b. Achats par ordres Binance P2P.**
  - Le vendeur publie une annonce au prix convenu, et tu la prends.
  - L'API donne alors le taux, le montant XAF et son pseudonyme, exacts.
  - Conditions :
    - il faut l'accord des vendeurs ;
    - Binance exige que le compte qui paie porte exactement le nom vérifié du compte Binance, qu'il s'agisse d'une personne ou d'une entreprise ;
    - payer depuis les comptes de Bonzini avec ton compte Binance personnel peut suspendre ta fonction P2P pendant au moins 15 jours, et en cas de litige la perte est pour toi ;
    - un compte Binance au nom de Bonzini éviterait ce problème (à vérifier).
  - Effort de dev : 2-3 jours de plus que le niveau 4.
- **5c. Un taux par semaine pour chaque acheteur chinois.**
  - C'est une décision commerciale, pas du code. Il y a deux façons de la prendre :
    - un vrai engagement : si le marché bouge dans la semaine, l'un de vous deux perd ;
    - un simple taux par défaut, que tu corriges les jours où le deal s'en écarte.
  - Si Wang paie à 7,12 toute la semaine, ses ventes se calculent sans saisie.
  - Le champ (`settlement_rate`) existe déjà en production. Il reste à le ramener dans les migrations du dépôt.

**Si tu oublies :**
- côté Cameroun, si l'option 5a fonctionne, il n'y a plus rien à oublier pour les deals écrits en conversation individuelle. Les groupes et les appels restent à saisir ;
- côté Chine, l'option 5c et le rattachement des paiements suffisent si tes acheteurs paient directement les fournisseurs (question 3). S'ils paient ton père, il faut encore saisir la vente ou relever ses soldes ;
- il reste une validation en lot le soir.

**Ce que je déconseille :**
- Le transfert automatique des SMS Mobile Money, pour trois raisons :
  - l'application open source prévue s'installe hors du Play Store, et celles du Play Store qui font la même chose liraient tous tes SMS, codes de validation compris ;
  - les formats des SMS MTN et Orange ne semblent pas publiés ;
  - un faux SMS est facile à fabriquer.

  Au mieux un indice, jamais une preuve.
- L'import des relevés Alipay/WeChat de ton père : ce sont des données de tiers chinois, avec un risque juridique en Chine.

## Tableau comparatif

| Niveau | Ton effort au quotidien | Fiabilité un jour chargé | Dev (jours) | Coût/mois | Dépend de |
|---|---|---|---|---|---|
| 1. Saisie éclair | 10-15 s par deal, dans l'app | Faible : l'oubli n'est pas vu | 4-6 | 0 | Ta discipline |
| 2. Bot Telegram | 10-15 s par deal depuis le téléphone, 1 tap le soir | Moyenne : rattrapage par vocal ou export, sans détection | 10-14 (+4-6 pour les captures) | 0-30 $ | Telegram, ta discipline |
| 3. Clôture du soir | Rien pendant les deals, 1-5 min le soir | Bonne sur les totaux ; exacte côté Chine si l'acheteur paie les fournisseurs | 12-18, + 2-3 semaines de rodage | 0-20 $ | Question 3, vérification des fonctions de production |
| 4. USDT vus | 0-10 s par deal, 1-3 min le soir | Bonne : chaque mouvement USDT surveillé devient une tâche ; stock exact si tous tes emplacements USDT sont branchés | 6-8 (TRON), +6-10 (Binance) | 0-50 $ | Où sont tes USDT |
| 5. Bout en bout | Rien pendant les deals, 1 tap le soir | Très bonne côté Cameroun | 8-12 (5a) ; 2-3 en plus du branchement Binance (5b) | 10-30 $, plus ≈ 50 €/mois de prestataire Meta (5a) | Meta, tes vendeurs, tes acheteurs |

## Ce que je recommande

Les **niveaux 1, 2, 3 et 4**, dans cet ordre, avec deux conditions :
- le niveau 2 seulement si tu fais plus de 5 deals par jour (question 4) ; sinon, on passe directement du niveau 1 au niveau 3 ;
- le niveau 5 seulement si ses conditions sont réunies.

**Cette semaine et la suivante (environ 6-8 jours de dev, 30 min de ton temps)**
- **Toi :**
  - si ce n'est pas déjà fait, poser dans Supabase → Vault les secrets `telegram_bot_token` et `telegram_chat_id`, avec les mêmes valeurs que ceux du bot. Cela prend 2 minutes. Cela rallume le point Mola de 7 h dans le groupe d'équipe ; la future clôture trésorerie, elle, partira dans ton chat privé ;
  - répondre aux 6 questions plus bas ;
  - me donner 20 vrais messages de deals (WhatsApp et WeChat), en remplaçant les noms et numéros par les codes F-00x / A-00x ;
  - me donner ton adresse TRON, ou un export de ton historique Binance. Jamais une clé API par message.
- **Décisions, sans code :**
  - un taux de référence de la semaine pour chaque acheteur chinois régulier. Reste à choisir entre engagement ferme et simple taux par défaut ;
  - qui rattache les paiements côté Chine : toi ou ton père.
- **Dev :**
  - sécuriser le bot Telegram (faille F-052) ;
  - ramener dans le code, et vérifier, les fonctions de règlement qui n'existent qu'en production ;
  - l'essentiel du niveau 1 : un formulaire qui se souvient, et Mola avec taux et date ;
  - programmer le relevé automatique des taux du marché.

**Ensuite, sur 3 à 5 semaines (environ 22-32 jours de dev : 2 à 3 semaines à deux développeurs, 5 à 6 semaines pour un seul)**
- Niveau 2 en texte et en vocal : boîte de brouillons, validation en lot.
- Niveau 3 :
  - un écran « paiements à rattacher » ;
  - les comptes à deux couches ;
  - le coût moyen du jour ;
  - la clôture mensuelle ;
  - la clôture du soir, d'abord 2 à 3 semaines en mode silencieux : elle calcule sans te poser de questions, le temps de régler les seuils.

**D'ici 1 à 3 mois**
- Niveau 4, là où sont tes USDT :
  - TRON d'abord, si tu as ton propre portefeuille (simple et gratuit) ;
  - Binance ensuite, après un vrai test du blocage réseau.
- Lecture des captures d'écran, pour les rattrapages.
- Option 5a si tu acceptes WhatsApp Business et que le test pour le +237 passe ; option 5b si tes vendeurs font déjà du P2P.

**Pourquoi cet ordre.**
- Les niveaux 1 et 2 divisent par 4 le temps passé sur chaque deal, dès le premier mois.
- Le niveau 3 est le premier qui rend l'oubli visible sans que tu saisisses chaque deal.
  - Côté Chine, il s'appuie sur les paiements déjà en base.
  - Côté Cameroun, il lui faut ton solde USDT du soir, jusqu'à ce que le niveau 4 le lise tout seul.
- Le niveau 4 garantit qu'aucun mouvement USDT n'échappe sur les adresses et comptes branchés.
- Le niveau 5 supprime le geste, mais il dépend de tiers. On ne l'attend pas pour démarrer.

## Une journée type après

Avec les niveaux 1 à 4 en place :

- **09:40** — WhatsApp, Ferdinand : « ok 5000 à 612 ». Tu paies 3 060 000 XAF depuis Afriland. Sur Telegram, tu tapes `a fer 5000 612`. 8 secondes.
- **09:52** — Les USDT arrivent. La carte devient verte : « Ferdinand · 5 000 · 612 · preuve ✓ ».
- **11:20** — Jules, 3 000 USDT à 611,5, en plein rush. Tu ne tapes rien.
- **11:27** — Ses USDT arrivent. Un brouillon apparaît : « 3 000 USDT reçus : de qui ? ». Personne n'y touche.
- **15:00** — WeChat, Wang : 5 000 USDT à 7,12. Il réglera 6 fournisseurs de tes clients. Les USDT partent vers son adresse connue. Tu ne tapes rien.
- **16:30** — L'équipe marque les 6 paiements « exécutés », comme aujourd'hui.
- **20:00** — La clôture arrive dans ton chat privé Telegram :
  - « 1 achat vert (Ferdinand) → [Valider] »
  - « Vente Wang : 5 000 USDT ↔ 6 paiements (35 600 ¥ ÷ 5 000 = 7,12 ✓) → [Valider] »
  - « 3 000 USDT reçus à 11:27 : de qui ? → [Jules · 611,5 = son dernier taux, à vérifier] [Jules · autre taux] [Autre] ». Le système ne connaît pas le taux du jour : ne valide son dernier taux que s'il correspond au deal dans WhatsApp.
  - « Stock réel 12 300 USDT = livres ✓ »

  Trois taps, **2 minutes**.
- **Le jour où tu sautes la clôture** : rien n'est perdu. Le lendemain soir, la clôture te dit « 2 jours non clôturés » et les reprend du plus ancien au plus récent. En attendant, la marge s'affiche comme provisoire. Deux jours se rattrapent en 5 minutes.

## Ce qu'il faut que tu me dises

1. **Où sont tes USDT ?** Sur un compte Binance, dans un portefeuille TRC20 à toi (TronLink, Trust…), ou à plusieurs endroits ?
   - Cela décide du capteur : TRON (gratuit et simple) ou l'API Binance (qui demande un test réseau).
   - Cela dit aussi s'il faut plusieurs comptes USDT dans l'app. Il n'y en a qu'un aujourd'hui.
2. **Comment tes vendeurs te livrent-ils ?** Sur la blockchain, par mouvement interne Binance, par Binance Pay, ou par ordre P2P ?
   - Un mouvement interne n'apparaît pas sur la blockchain, et l'identité de son expéditeur n'est pas garantie.
   - Binance Pay demande un capteur à part.
   - Un ordre P2P donne le taux sans effort.
3. **Où paient tes acheteurs chinois ?** Sur l'Alipay ou le WeChat de ton père, ou directement aux fournisseurs de tes clients ?
   - S'ils paient les fournisseurs, la vente naît des paiements déjà suivis : elle est exacte, presque sans geste.
   - S'ils paient ton père, il faut relever régulièrement le solde de ses comptes.
4. **Combien de deals par jour, avec combien de contreparties actives ? Utilises-tu déjà Telegram ? As-tu un Android ou un iPhone ?**
   - Moins de 5 deals par jour : les niveaux 1 et 3 suffisent.
   - Au-delà de 15-20 : le bot, la validation en lot et le niveau 4 deviennent nécessaires.
   - Sans Telegram, le bot passe par un numéro WhatsApp dédié : plus cher et plus long à obtenir (voir le niveau 2).
   - Sur Android seulement, on peut ajouter le « partage » d'une capture directement vers l'app Bonzini.
5. **Qui d'autre peut saisir ou valider ?** Ton père côté Chine, un·e assistant·e ? Cela décide qui reçoit la clôture et ce que tu peux déléguer.
6. **Accepterais-tu de passer ton numéro de deals sur WhatsApp Business ?** C'est la seule façon d'obtenir, sans aucun geste, le taux négocié dans tes conversations WhatsApp (option 5a). Les ordres Binance P2P (option 5b) le donnent aussi, mais seulement si tes vendeurs passent par le P2P. Et tes deals se font-ils en conversation individuelle ou en groupe ?

## Ce qu'on ne peut pas faire

- **Lire automatiquement tes WhatsApp et WeChat personnels.**
  - WhatsApp est chiffré de bout en bout et n'offre aucune API pour un compte personnel.
  - WeChat n'offre aucune API officielle.
  - Les deux interdisent les outils d'automatisation non officiels : tu risquerais le bannissement de ton compte. Les voies autorisées : transférer à un bot, exporter une discussion, ou WhatsApp Business Coexistence.
- **Obtenir tes relevés MTN, Orange ou bancaires automatiquement.**
  - Nous n'avons trouvé aucun accès automatique à l'historique d'un compte MTN MoMo, Orange Money ou bancaire au Cameroun. L'API MTN n'a pas de relevé (à confirmer pour le Cameroun), et la CEMAC n'a pas d'accès bancaire ouvert (« open banking »).
  - Restent les relevés téléchargés à la main : Max it, banque en ligne, parfois en CSV ou MT940 pour un compte d'entreprise.
- **Obtenir automatiquement les relevés Alipay ou WeChat Pay.** Seul un export manuel existe.
- **Lire le taux sur la blockchain.**
- **Voir sur TRON un mouvement interne Binance.**
- **Écrire automatiquement dans WeChat**, car ton compte serait en jeu. J'écarte aussi WeCom (le WeChat entreprise) : il laisserait chez Tencent une trace officielle d'échanges USDT/RMB.

**Note juridique.**
- Garde pour chaque deal une preuve : identifiant de transaction ou numéro d'ordre, capture, taux, et qui a validé.
- En Chine, l'avis « 924 » (24 septembre 2021) fait de toute activité commerciale liée aux cryptomonnaies une activité financière illégale, et ces dossiers commencent souvent par un gel de carte bancaire.
  - Les avocats chinois conseillent de garder ces preuves pour montrer la bonne foi de la personne dont la carte est gelée (ton père, un acheteur, un fournisseur).
  - Mais c'est à double tranchant : le même registre relie les comptes de ton père à des ventes d'USDT.
- Côté CEMAC, ce registre prouve aussi une activité de change qui passe par la crypto. La décision COBAC D-2022/071 vise les établissements régulés. Cela compte si Bonzini demande un agrément, ou si une banque partenaire fait une revue.
- Donc :
  - garder le minimum sur les acheteurs chinois : pseudonymes A-00x, pas de numéros de compte ;
  - fixer une durée de conservation ;
  - limiter l'accès ;
  - faire relire par un juriste avant les niveaux 4 et 5.

## Annexe technique (pour l'équipe de dev)

### A. Invariants

- **Brouillon puis confirmation.**
  - L'ingestion automatique (bot, capteurs, clôture) écrit **uniquement** dans `treasury_evidence` et `treasury_drafts`, jamais au grand livre.
  - La confirmation s'exécute sous le JWT de l'humain, ou via la fonction `_as` réservée au rôle service (§ C).
  - `record_usdt_*` renvoient `{success:false}` sans lever d'erreur. Le wrapper doit donc faire `RAISE EXCEPTION` pour annuler le changement de statut.
- **Chaque RPC d'écriture :**
  - garde `admin_has_permission(v_uid,'canManageTreasury')`, pas `can_access_treasury` ;
  - `SELECT … FOR UPDATE` ;
  - statuts terminaux énumérés : `confirmed`, `rejected`, `merged` ;
  - montants `> 0`, sans plafond ;
  - `pg_advisory_xact_lock(hashtext('treasury_usdt'))` sur **toutes** les écritures trésorerie : formulaires, Mola, lots, annulations, recalculs ;
  - étiquette `@mola` dans la même migration, avec `"permission":"canManageTreasury"`.
- **Étiquettes existantes.** Ajouter `canManageTreasury` à la liste de `CLAUDE.md`, puis réétiqueter les 8 écritures existantes (`20260603180000_mola_capability_tags_full.sql:33-41`).
- **Fonctions internes :**
  - `REVOKE ALL … FROM PUBLIC, anon, authenticated`. Sans `PUBLIC`, la révocation est inopérante (`20260831230000:50-55`) ;
  - `GRANT` à `service_role` si une edge function les appelle ;
  - `@mola {"expose":false}`.
- **Front :** `supabaseAdmin` partout ; `/frontend-design` avant tout écran ; puis `/gen-types`, `npm run type-check` et `npm run build`.

### B. Cette semaine et la suivante

1. **F-052**, dans `supabase/functions/telegram-bot/index.ts` :
   - comparer en temps constant l'en-tête `X-Telegram-Bot-Api-Secret-Token` à `TELEGRAM_WEBHOOK_SECRET` ;
   - refaire `setWebhook` avec `secret_token` ;
   - ajouter `[functions.telegram-bot] verify_jwt = false` dans `supabase/config.toml`.
2. **`20260930090000_treasury_prod_objects.sql`** (à faire avant toute refonte de `record_usdt_sale`) :
   - rapatrier par `pg_get_functiondef` : `settle_payments_usdt`, `get_unsettled_payments`, `set_counterparty_settlement_rate`, `get_usdt_sales_monthly` ;
   - `ADD COLUMN IF NOT EXISTS` pour `usdt_sales.payment_id` et `treasury_counterparties.settlement_rate(_updated_at)` ;
   - auditer gardes, verrous et statuts, puis poser les étiquettes.
3. **Mola**, dans `supabase/functions/admin-assistant/index.ts` :
   - outils `:2125-2202` : ajouter `occurred_at`, `rate` (triangle : 2 valeurs sur 3) et `account_splits` ;
   - `resolveCounterparty` (`:1635-1652`) : chercher aussi par téléphone E.164 et `wechat_id`. Les alias viendront avec `treasury_counterparty_identifiers`, en C ;
   - retirer l'omission de `p_occurred_at` dans `eval/assistant/parity.manifest.ts:94-99` ;
   - ajouter des cas dans `eval/assistant/cases.ts`.
4. **Formulaires** (`MobileNewPurchase.tsx`, `MobileNewSale.tsx`, `DesktopNewPurchase.tsx`, `DesktopNewSale.tsx`) :
   - nouveau hook `useLastDealDefaults` dans `src/hooks/useTreasury.ts` ;
   - date visible hors de « Détails » ;
   - l'écran reste ouvert au lieu de revenir à l'accueil (`MobileNewPurchase.tsx:154`, `MobileNewSale.tsx:114`) ;
   - `client_request_id` unique contre le double tap (colonne à ajouter dans `20260930090000_treasury_prod_objects.sql`) ;
   - raccourcis depuis `MobileTreasuryHome.tsx:129-131`.
5. **`monitor-rates`** :
   - garde `isServiceCaller` (`_shared/caller.ts:31-49`) ;
   - alertes Telegram limitées ;
   - puis cron pg_net sur le modèle de `run_cargo_sync` (`20260911120000:153-178`).

### C. Ensuite (3 à 5 semaines)

**Prérequis : `20261001090000_treasury_hardening.sql`**
- Extraire les cœurs internes `_treasury_record_purchase(p_actor, …)` (depuis `20260516000003:25`) et `_treasury_record_sale(p_actor, …)` (depuis `lot7.sql:143`). Les RPC publiques deviennent des enveloppes gardées.
- `get_wac_usdt`, `get_usdt_stock`, `get_xaf_per_cny_at` :
  - `REVOKE` pour PUBLIC et anon ;
  - une garde `canViewTreasury` qui laisse passer les appels internes (`auth.uid() IS NULL`), comme `mola_purge_old_conversations` ;
  - sans cela, la validation depuis Telegram (rôle service, sans `auth.uid()`) échoue. L'autre solution : faire appeler par les cœurs `_treasury_*` des variantes internes non gardées.
- `assistant_pending_actions.expires_at` (48 h), refusé à la confirmation (`admin-assistant/index.ts:2911`).

**`20261005090000_treasury_drafts.sql`**
- **Tables :**
  - `treasury_drafts` : `ref` BZ-TD-…, `kind`, `status` (draft|confirmed|rejected|merged), `counterparty_id`, `usdt_amount`, `rate`, `fiat_amount`, `xaf_account_splits`, `cny_account_id`, `payment_ids uuid[]`, `occurred_at`, `rate_source` (typed|ticket|settlement_rate|p2p|last_deal|market), `confidence`, `created_via`, `owner_admin_id`, `created_by` (nul si service), `confirmed_by/at`, `operation_table/id` ;
  - `treasury_evidence` : `source`, `source_ref`, **`UNIQUE(source, source_ref)`**, `kind`, `occurred_at`, `amount`, `currency`, `tx_hash`, `media_path`, `raw jsonb` (purgé à 90 j), `draft_id`, `operation_id`. Un deal peut avoir plusieurs preuves ;
  - `treasury_counterparty_identifiers (kind, value)` unique, avec les kinds alias, phone_e164, wechat_id, tron_address, binance_uid, p2p_nick, et le champ `is_shared` ;
  - `admin_channel_links` et `admin_channel_link_codes`.
- **Stockage :** bucket privé `treasury-proofs`, sur le modèle de `20260816120000:34-43`.
- **Colonnes existantes :**
  - `usdt_purchases` et `usdt_sales` reçoivent `rate_source` et `tx_hash`, avec un index unique partiel sur les lignes non annulées ;
  - `usdt_purchases` reçoit `draft_id` UNIQUE ;
  - pour `usdt_sales`, créer une table de liaison `usdt_sale_payments(sale_id, payment_id UNIQUE)`, qui devient la seule source de « paiement rattaché ». En effet, `usdt_sales.payment_id` (production) ne relie qu'un paiement par vente, alors qu'une vente à Wang en règle 6. À trancher après lecture de `settle_payments_usdt`.
- **RPC exposées :**
  - `create_treasury_draft` ;
  - `confirm_treasury_draft(p_draft_id, p_overrides)`, avec les clés de `p_overrides` en liste blanche et tout revalidé. Étiquette : `'@mola:{"expose":true,"kind":"write","permission":"canManageTreasury","confirm":true,"danger":true,"label":"Valider un brouillon trésorerie","resolve":{"p_draft_id":"treasury_draft"},"tool":"confirm_treasury_draft"}'` ;
  - `confirm_treasury_drafts(p_ids)` : cartes vertes seulement, traitées en séquence par `occurred_at` ;
  - `reject_treasury_draft` ;
  - `match_open_drafts`, appelée par les formulaires et par Mola **avant** d'écrire ;
  - `create_channel_link_code`.
- **Internes.** Toutes reçoivent `REVOKE ALL … FROM PUBLIC, anon, authenticated`, un `GRANT` à `service_role` seulement si une edge function les appelle, et `@mola {"expose":false}` :
  - `ingest_treasury_evidence(p_items jsonb)`, `consume_channel_link_code`, `confirm_treasury_draft_as` ;
  - `_treasury_confirm_draft_core`, `_treasury_record_purchase`, `_treasury_record_sale` ;
  - `_recompute_usdt_daily_cost`, `treasury_rematch`, `run_treasury_close_digest`.
  - Celles qui prennent `p_actor` sont les plus dangereuses : exposées, elles permettraient d'écrire au nom de n'importe quel admin.

**Pont d'authentification du bot** (piste « c » du rapport Mola). Il n'ouvre pas de session d'admin complète :

```sql
create function public.confirm_treasury_draft_as(p_draft_id uuid, p_actor uuid,
  p_channel text, p_external_user_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_d treasury_drafts%rowtype;
begin
  if not exists (select 1 from admin_channel_links l where l.admin_user_id = p_actor
      and l.channel = p_channel and l.external_user_id = p_external_user_id
      and l.revoked_at is null) then
    return jsonb_build_object('success',false,'error','Canal non lié'); end if;
  if not public.admin_has_permission(p_actor,'canManageTreasury') then
    return jsonb_build_object('success',false,'error','Accès non autorisé'); end if;
  perform pg_advisory_xact_lock(hashtext('treasury_usdt'));
  select * into v_d from treasury_drafts where id = p_draft_id for update;
  if v_d.owner_admin_id is distinct from p_actor or v_d.status <> 'draft' then
    return jsonb_build_object('success',false,'error','Brouillon introuvable ou déjà traité'); end if;
  return public._treasury_confirm_draft_core(p_actor, v_d, '{}'::jsonb);
end $$;
revoke all on function public.confirm_treasury_draft_as(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.confirm_treasury_draft_as(uuid,uuid,text,text) to service_role;
comment on function public.confirm_treasury_draft_as(uuid,uuid,text,text) is
  '@mola:{"expose":false,"kind":"write","permission":"canManageTreasury","label":"Valider un brouillon depuis un canal lié (interne)"}';
```

- **Parades en base, pas seulement dans le bot.** Avant d'appeler le cœur, `confirm_treasury_draft_as` doit :
  - refuser un brouillon dont le montant, converti en XAF, dépasse le seuil de canal (réponse : « valider dans l'app ») ;
  - recevoir la date du message Telegram et refuser un bouton de plus de 48 h. Telegram ne fait pas expirer les boutons, et `assistant_pending_actions.expires_at` ne couvre que Mola dans l'app.
- `owner_admin_id` : l'admin qui a créé le brouillon, ou le propriétaire du capteur pour les brouillons automatiques.
- **Appairage :** code à 6 chiffres, valable 10 min, à usage unique, stocké haché, 5 essais au plus par `from.id`.
- **Quotas :** plafond d'ingestion par jour et par liaison (coût de l'IA).
- **Seuil de canal :** au-delà d'un seuil, la validation se fait dans l'app. C'est un seuil de canal, pas un plafond de montant.

**Bot** (`telegram-bot/index.ts:627-665`)
- Tâches trésorerie seulement si `chat.type === 'private'` et si le `from.id` est lié.
- Les commandes de taux restent limitées à `TELEGRAM_CHAT_ID`. C'est un groupe d'équipe : rien de trésorerie ne doit y passer.
- Gérer :
  - le texte libre, `voice` et `photo` ;
  - `edited_message`, qui met à jour un brouillon encore au statut draft ;
  - `callback_query` (`tc:<uuid>:ok`, suivi de `answerCallbackQuery`).
- Répondre 200 tout de suite, puis traiter avec `EdgeRuntime.waitUntil`.
- Les vocaux passent par `supabase/functions/treasury-capture/index.ts` : transcription, puis même parseur.
- Parseur : `supabase/functions/_shared/dealTicket.ts` (grammaire `a|v <alias> <usdt> <taux> [compte] [date]`, triangle). Tests dans `src/tests/treasury/dealTicket.test.ts`, sur de vrais échantillons anonymisés : aucun nom, numéro ni compte réel dans Git.

**Clés de dédoublonnage (`source_ref`)**
- Dès maintenant : `tg:<chat>:<message_id>`, `tgf:<file_unique_id>`, `app:<client_request_id>`, `mola:<pending_action_id>`, `pay:<payment_id>`.
- Plus tard : `tron:<transaction_id>:<from>:<to>:<value>`, `bn_dep:<id>`, `bn_wd:<id>`, `bn_c2c:<orderNumber>`, `wa:<wamid>`.
- Doublon probable (même contrepartie, USDT à ±0,5 %, taux à ±0,2 %, moins de 6 h d'écart) : la carte propose [Même deal] / [Autre], jamais de fusion automatique. « Répéter » est marqué comme intentionnel.

**`20261012090000_treasury_close.sql`**
- **Vue `treasury_client_flows`**, en lecture seule. **Pas de trigger** sur `deposits` ni `payments`, qui sont sur le chemin critique.
  - Dépôts validés, rattachés à un compte via `treasury_deposit_channel_map` (rempli depuis `src/data/depositMethodsData.ts:213-222,252-257`), datés `COALESCE(verified_at, validated_at)`.
  - Paiements datés `COALESCE(cash_paid_at, processed_at)`.
  - Paramètre `cutover_at`.
- **Soldes constatés :** `treasury_balance_observations`, en mesure seule, sans écriture au grand livre. RPC `record_balance_observations` (write, `confirm:true`), appelée aussi à l'export des visuels de soldes (`handleExport` dans `DesktopBalanceDashboard.tsx:50` et `balance-dashboard/MobileBalanceDashboard.tsx:43`).
- **Coût moyen du jour :** table `treasury_usdt_daily_cost` et fonction interne `_recompute_usdt_daily_cost(p_from date)`.
  - Pour le jour D (heure de Douala) : coût(D) = (valeur d'ouverture + XAF achetés en D) ÷ (quantité d'ouverture + USDT achetés en D).
  - Les ventes de D sortent à coût(D).
  - Si la quantité est ≤ 0, le coût est provisoire et vaut `rate_snapshots.xaf_ask` du jour.
  - Le recalcul part du plus ancien jour touché, sous le verrou global. Toute écriture le déclenche, annulations comprises.
  - L'écriture inverse d'une annulation prend la date d'origine, au lieu de `now()` (`20260515000004:481`).
  - `wac_at_sale` n'est plus modifié : il reste comme trace historique. La marge lit la nouvelle table.
  - La courbe calculée dans le navigateur sans `.limit()` (`useTreasury.ts:580-632`) passe côté serveur.
- **Périodes :** `treasury_periods` et `close_treasury_period(p_month)` (`confirm`, `danger`). Toute écriture datée dans un mois clos est refusée, sauf réouverture par un super admin avec motif.
- **Lectures :**
  - `treasury_gap_report(p_day, p_window)` (read, `canViewTreasury`, `"tool":"treasury_close_day"`) : paiements non rattachés (liste exacte) ; stock observé face aux livres et aux brouillons ; XAF agrégés si des soldes sont observés ; taux comparés à la médiane des 7 derniers jours ;
  - `get_treasury_books(p_from, p_to)` : couches vérifiée et provisoire ;
  - `get_treasury_dashboard` : filtrer sur `processed_at` au lieu de `created_at` (`lot7.sql:355`).
- **Clôture :** `run_treasury_close_digest()`, copiée de `run_mola_daily_digest` (`20260607120000:137-196`), cron `50 18 * * *` UTC (≈ 19:50 à Douala).
  - Envoi vers les chats **privés liés**, jamais vers `telegram_chat_id`.
  - Pseudonymes internes seulement : jamais de nom légal ni de numéro de compte.
  - Une sonde externe alerte si aucun envoi n'est parti depuis 26 h.
- **UI :**
  - `src/mobile/screens/treasury/MobileTreasuryInbox.tsx` et `MobileUnsettledPayments.tsx` ;
  - `src/desktop/screens/treasury/TreasuryInboxView.tsx` ;
  - hook `src/hooks/useTreasuryDrafts.ts` ;
  - routes près de `/m/more/treasury` (`src/App.tsx` ≈ 340) ;
  - taux de la semaine et identifiants dans `MobileCounterpartyEdit.tsx`.
- **Mola :** type `treasury_draft` dans `resolveRef` (`:1676`) ; outils `list_treasury_drafts`, `confirm_treasury_draft` et `treasury_close_day`.

### D. 1 à 3 mois

- **`…_treasury_chain_ingest.sql`** :
  - `treasury_accounts` reçoit `network`, `address` et `venue`. Si tu as plusieurs portefeuilles, refondre `usdt_pool`, codé en dur (`lot7.sql:189`, `20260516000003:92`). `get_wac_usdt` et `get_usdt_stock` supposent aussi un pool unique ;
  - `treasury_ingest_cursors` (`last_ok_at`, `last_error`) ;
  - `treasury_rematch()`, interne, en cron : il rattache une preuve **seulement s'il n'y a qu'un candidat**, sinon il propose.
- **`supabase/functions/treasury-watch-tron/index.ts`** (`isServiceCaller`, toutes les 2 min) :
  - `GET /v1/accounts/{addr}/transactions/trc20?only_confirmed=true&contract_address=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t&min_timestamp=…` ;
  - moins de 1 USDT = bruit ;
  - ne jamais apprendre l'adresse d'expéditeur d'un achat ;
  - ne pas surveiller sur la chaîne l'adresse de dépôt Binance.
- **`treasury-watch-binance/index.ts`** :
  - clé en lecture seule ; refus de démarrer si `apiRestrictions.enableWithdrawals` est vrai ;
  - `deposit/hisrec?includeSource=true`, `withdraw/history`, `c2c/orderMatch/listUserOrderHistory` ;
  - **statuts finaux uniquement** ; les opérations « en cours » sont réinterrogées ;
  - lien explicite entre le `txId` Binance et le `transaction_id` TRON ;
  - frais (`transactionFee`) passés en écritures dédiées ;
  - fonction épinglée hors États-Unis (`x-region`), à tester, sinon passerelle à IP fixe.
- **`treasury-capture` : ajout des captures d'écran** (l'audio est livré en C) :
  - un seul appel à l'API Claude, avec la capture en image, une sortie JSON structurée selon un schéma `deals[]`, et sans outils. Le contenu de la capture est traité comme une donnée non fiable ;
  - ≈ 0,02-0,04 $ par capture. Choisir le modèle en comparant `claude-sonnet-5` et `claude-haiku-4-5-20251001` sur 50 vraies captures anonymisées ;
  - la vision reste coupée dans la boucle principale de Mola ;
  - prestataire de transcription à choisir, puis à déclarer dans `src/pages/legal/PrivacyPage.tsx:13,222` ;
  - numéros de carte masqués ; médias bruts purgés à 90 jours, sauf s'ils sont marqués comme preuve.
- **Tests :**
  - réécrire `src/tests/security/internalRpcExposure.test.ts`, qui ne vérifie aujourd'hui les REVOKE que dans une seule migration (`:22`) et pour une liste figée de 10 fonctions (`:25-36`), pour qu'il contrôle toute fonction interne, quelle que soit sa migration ;
  - ajouter les nouvelles RPC à `moneyRpcGuards.test.ts` ;
  - `src/tests/treasury/dailyCost.test.ts` : saisie tardive, annulation, stock négatif.
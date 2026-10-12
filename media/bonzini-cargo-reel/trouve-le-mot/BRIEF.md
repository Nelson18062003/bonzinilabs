# Rush « Bonsoir bonsoir » — brief de montage (12 octobre 2026)

## La demande du patron (mot pour mot)
« Voici une vidéo. Je te laisse un peu : tu es le directeur ici. Je te laisse faire le montage de là-dessus. Fais un truc
créatif qui peut devenir viral aussi. Je te laisse décider. »

## Le rush (seule matière filmée) — `rush1/src/rush.mp4`
- 9,97 s, vertical 464 × 832, 30 i/s, H.264 ~1 Mbit/s (vidéo WhatsApp : basse définition, compressée, tenue à la main,
  ça bouge). Planche : `rush1/work/sheet.jpg` (1 image / 0,25 s) ; images pleine taille : `rush1/frames/f_001…040.jpg`
  (4 i/s), `rush1/work/full4.jpg`, zoom étiquettes / polo : `rush1/work/zoom.jpg`.
- Le soir (lumière de fin de journée, feux arrière allumés), une rue commerçante **en Chine** (enseignes en chinois,
  scooters électriques, une boutique « 5G SIM CARD »). On ne sait PAS dans quelle ville : ne jamais écrire « Guangzhou ».
- Découpage :
  - **0,0–2,9 s** : l'arrière d'une camionnette blanche, hayon ouvert, chargée de gros colis emballés de film plastique
    noir, avec des étiquettes blanches ; un sac de voyage marron devant. Un employé en polo rouge passe à droite
    (0–0,4 s). Feu arrière rouge à gauche.
  - **2,9–3,4 s** : panoramique rapide (filé) vers la gauche, sur le trottoir.
  - **3,4–4,9 s** : l'employé en polo rouge (vu de dos / de côté, visage non identifiable) prend un colis noir posé au
    pied de la boutique, à côté de scooters ; un diable (chariot) au premier plan ; des cartons empilés.
  - **4,9–5,6 s** : panoramique rapide retour vers la camionnette.
  - **5,6–10,0 s** : l'arrière de la camionnette, presque fixe, colis noirs ; **à 6,5 s on lit à la main « BONZINI » sur
    l'étiquette blanche d'un colis** (en bas à droite du chargement) — preuve que ce sont des colis Bonzini.
- Personnes : un seul employé, de dos / de côté, jamais net de face. Marque tierce visible : l'enseigne « 5G SIM CARD »
  de la boutique (à flouter ou recadrer si elle gêne, ne jamais la mettre en avant).

## Le son du rush
- Bruit de rue (circulation, voix lointaines), niveau −20 à −30 dBFS.
- Une voix d'homme (celui qui filme, en français) : **« Bonsoir, bonsoir » (≈ 0,6–1,6 s, net)** puis un passage
  **inaudible** (≈ 1,7–7,4 s : les transcriptions se contredisent → ne JAMAIS sous-titrer ni inventer ce passage),
  puis **« Merci, merci de faire confiance à Bonzini Trading » (≈ 7,0–9,4 s ; « Merci… confiance à » net, le nom final
  est le plus probable — « Bonzini » reconnu à 0,99 sur la voix débruitée — à faire confirmer par le patron)**.
- Voix isolée du bruit de rue (demucs) : `rush1/work/stem_vocals.wav` (44,1 kHz) ; ambiance seule : somme des autres
  stems `rush1/work/stem_{drums,bass,other}.wav`. Mots horodatés : « Bonsoir, » 0,00–1,16 · « bonsoir. » 1,20–1,64 ·
  « Merci, » 7,00–7,78 · « merci de faire confiance à » 7,78–8,90 · nom 8,90–9,40.
- Fichiers : `rush1/work/audio48.wav` (original), `rush1/work/voice_clean16.wav` (débruité pour l'écoute).

## Ce qu'on a pour fabriquer (déjà au point dans ce projet)
- Moteur Canvas 2D rendu dans Chromium, partition unique image + son (voir `serie/PIPELINE.md`, `serie/ep2/`) : on peut
  y poser les images du rush (une image par instant), recadrer, zoomer, geler l'image, dessiner par-dessus (étiquettes,
  flèches, tampons, cadres « téléphone / polaroïd », textes cinétiques), lumière et grain.
- Le monde de la série « JE SAVAIS PAS. » : table en papier kraft, le margouillat, la pastille « TOI », les tampons,
  la makossa et la signature balafon ; le violet uniquement avec Bonzini.
- Voix claires (Kyutai TTS, réglages « diction claire » validés — `serie/DICTION.md`, `serie/voice_cfg.json`) :
  narratrice habituelle, voix de commerçant « TOI ». Test d'écoute automatique sur le mix final (`serie/listen_test.py`).
- Musique et bruitages synthétisés (bibliothèque « PAS REÇU. »), mix −14 LUFS.

## Les règles (non négociables)
1. **Compris au premier visionnage**, même sans le son et même avec le son : le patron n'avait pas compris la vidéo
   en boucle (métaphore à deviner) et ne comprenait pas des voix trop rapides. Phrases courtes, mots simples du marché
   de Douala, tout mot technique défini avant (`serie/DICTION.md`). Ce qui est dit est écrit.
2. **Rien d'inventé** : ne dire que ce qu'on VOIT ou ce qui est vérifié. Services vérifiés de Bonzini Trading Cargo :
   groupage maritime et aérien Chine → Douala ; colis reçus en Chine, pesés et mesurés à la réception ; entrepôt au
   Foyer Balengou (Douala). Le reste du rush (où va la camionnette, à qui sont les colis, l'heure exacte, la ville) est
   inconnu : ne pas l'affirmer. Fait général sûr : la Chine a 7 heures d'avance sur le Cameroun (UTC+8 / UTC+1, pas
   d'heure d'été) — quand on dit « bonsoir » en Chine, c'est l'après-midi à Douala.
3. Vocabulaire : « payer, régler, paiement », jamais « transfert / envoyer de l'argent » ; jamais « moins cher, le premier,
   le seul, gratuit, garanti, zéro risque » ; pas de douanier ; pas de marque tierce mise en avant ; le nom est
   « Bonzini Trading Cargo » (ou « Bonzini »).
4. La vraie voix « Bonsoir, bonsoir » et « Merci de faire confiance à Bonzini Trading » est un trésor d'authenticité :
   on peut la garder, la répéter, la monter en rythme — jamais la déformer jusqu'à la rendre ridicule (c'est un employé).
5. Format : 9:16, 1080 × 1920, sous-titres dans les zones sûres (rien sous y 1540 d'important, pas de texte à droite de
   x 960 entre y 900 et 1560, rien au-dessus de y 150). Durée libre mais courte : la matière est de 10 s.

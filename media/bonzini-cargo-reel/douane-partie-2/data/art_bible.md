# Partie 2 — nouvelle direction artistique : « chronique de Mboppi » (BD africaine animée)

Retour du propriétaire (30/09/2026) : « le graphisme, là, c'est vraiment horrible » ; « inspire-toi d'*Aya de Yopougon* » ;
« inspiré de dessin animé » ; « créer une histoire sur les jeunes importateurs africains (commerçants et commerçantes) ;
je te laisse faire l'histoire, le scénario, la direction artistique ».

On abandonne le papier découpé géométrique. La partie 2 est une **BD animée** (motion comic / animation limitée) :
de vraies illustrations dessinées, des personnages en pied avec de vraies proportions, la rue, le soleil, la mode, l'humour.

## Style (à tenir sur chaque image — chaîne `STYLE` des prompts)
Bande dessinée africaine de chronique urbaine : trait d'encre noir vivant et souple (épaisseur variable), couleurs en aplats
de gouache avec un léger grain de papier, lumière chaude du soleil de Douala, palette ocre · terre cuite · turquoise ·
jaune moutarde · vert feuille, **violet Bonzini** en accent. Personnages stylisés, élégants, silhouettes longues, grands yeux
blancs expressifs, tissus wax, coiffures soignées (tresses, afro court, chignons). Ambiance années 2000–2020 à Douala :
immeubles à balcons, parasols, taxis jaunes, motos, palmiers, maquis sous guirlandes le soir.
Jamais : texte ou lettres dans l'image (on lettre nous-mêmes), logos, marques (pas de virgule Nike sur les baskets),
emblèmes officiels, marques d'armateurs. Tenues modestes (robes au genou ou longues, sans fente haute).
Ne pas nommer d'artiste dans les prompts : on s'inspire (chronique urbaine africaine, BD franco-belge), on ne copie pas.

## Fabrication
- Générateur : Canva (`generate-image`, 9:16 pour les plans, 16:9 pour les planches de personnages et les décors à panoramiquer),
  récupération pleine résolution via `separate-image-layers` → `export-design` (PNG 944×1680 / 1680×944), agrandi ×2 si besoin
  (`models/realesr-general-x4v3.pth`).
- Personnages : une **planche par personnage** (4 à 6 poses/expressions, fond uni) → détourage local `rembg` modèle
  `isnet-anime` (testé : bords propres) → bibliothèque de poses. Les illustrations de scène qui montrent un personnage
  passent la planche en **référence d'image** (cohérence du visage et de la tenue).
- Décors : lieux **vides** (sans les héros) pour y poser les personnages détourés, + quelques **illustrations-héros**
  complètes pour les moments forts (plans larges, émotion), animées en 2,5D (calques séparés, parallaxe).
- Lettrage : bulles et récitatifs de BD (cartouches jaunes de la narratrice), polices libres OFL : Bangers (titres, onomatopées),
  Kalam / Patrick Hand (bulles), Caveat Brush (annotations). Sous-titres = récitatif.
- Animation : caméra (panoramiques, zooms lents, plongées), parallaxe entre calques, respiration des personnages, changements
  de pose en fondu court ou « smear », marche (translation + rebond + alternance de poses), bulles qui s'ouvrent, lumière
  (rayons, poussière dans le soleil, néons du maquis), grain de papier et vignettage communs pour unifier.
- Transitions : cases de BD (bords blancs), tourne-page, raccords de mouvement. Rythme posé (la leçon de la partie 1 tient).

# Carte Cargo — ce que fait Flexport Atlas, ce qu'on en retient

Sources lues le 12/09/2026 : atlas.flexport.com/faq, flexport.com (Winter 2026
release, vessel tracking, platform visibility), annonces publiques (X,
LinkedIn, FreightWaves). Atlas est un produit « réseau mondial » (tous les
navires, tous les ports) ; Bonzini Cargo est un produit « mes conteneurs ».
On prend les mécanismes, pas l'ambition.

## 1. Inventaire des fonctions d'Atlas, classées

| Famille | Fonction Atlas | Utile pour nous ? | Décision |
|---|---|---|---|
| **A. Objets sur la carte** | Navires avec statut vivant : *In transit* / *Moored* (à quai) / *At anchor* (au mouillage), mis à jour toutes les 2 h | Oui — dit au client si le bateau avance ou attend | **Fait** : statut déduit de la vitesse AIS et de la proximité d'un port |
| | Ports (océan, intérieurs), aéroports, terminaux rail | Ports seulement | **Fait** : nos ports (Nansha, Singapour, Abidjan, Lekki, Kribi, Douala) avec compteurs |
| | « Strings » : la séquence d'escales d'un service, tous les navires qui le parcourent | Oui — notre ligne WAX1 | **Fait** : tournée en pointillé, portion parcourue en trait plein par navire |
| **B. Cartes d'information** | Clic navire → statut, vitesse, cap, dernière position, prochain port, ETA | Oui | **Fait** : carte navire + les conteneurs à bord, lien position en direct |
| | Clic port → temps d'accostage moyen, dwell, congestion | Plus tard (données payantes) | **Partiel** : carte port = nos conteneurs qui y arrivent / en partent, avec dates |
| **C. Navigation & découverte** | Recherche navire (nom, IMO), service, port | Oui, à notre échelle | **Fait** : recherche client / conteneur / navire / port dans le panneau latéral |
| | Couches activables (ports, aéroports, rail) | Oui, version simple | **Fait** : Routes · Ports · Étiquettes |
| | Vue globe 3D | Beau, pas indispensable | Plus tard (MapLibre globe) |
| | Plein écran, mobile | Oui | **Fait** : plein écran, recadrage « tout voir », mobile en une colonne |
| **D. Liste ↔ carte** | Panneau latéral synchronisé (survol = surbrillance, clic = recadrage) | Oui — c'est ce qui rend une carte lisible | **Fait** : liste des conteneurs groupés par navire, filtres par statut |
| **E. Exceptions** | Alertes sur navires/ports (retards, congestion, actualités) | Oui, à notre échelle | **Fait** : pastilles « retard vs promesse », « hors couverture », « arrive sous 7 j sans télex » sur la carte et dans la liste |
| **F. Planification** | Outil d'itinéraire entre deux ports, horaires des strings | Non (nous ne réservons pas) | Écarté |
| | Actualités maritimes géolocalisées | Non pour l'instant | Écarté |

## 2. Ce que la carte Bonzini montre, et comment on la lit

- **Un point = un navire.** Le badge sur le point = nombre de nos conteneurs à
  bord. Point plein : position AIS récente ; point creux : dernière position
  connue (plein océan, hors couverture, normal). Anneau accent : sélection.
- **Trait plein** : ce que le navire a parcouru sur la tournée ; **pointillé** :
  ce qui reste jusqu'à son port de déchargement.
- **Ports** : petit point + étiquette ; le compteur indique combien de nos
  conteneurs y arrivent.
- **Panneau latéral** : recherche, filtres (En mer · Arrivent sous 7 j · À
  régler · Sans position), puis les conteneurs groupés par navire. Survoler une
  ligne surligne le navire ; cliquer le recadre et ouvre sa carte.
- **Carte navire** : nom, statut vivant, vitesse et cap, dernière position et
  son âge, prochain port et ETA, la liste des conteneurs à bord (client, n°,
  arrivée) avec « Ouvrir le dossier », et « Position en direct » (VesselFinder).
- **Sans position** (armateur non interrogeable) : le conteneur est dans le
  panneau, groupé sous « Sans position », jamais placé au hasard sur la carte.

## 3. Ce qui reste à brancher pour aller plus loin

1. Positions AIS automatiques (`AISSTREAM_API_KEY`) : aujourd'hui les
   positions viennent du dernier relevé ; le statut *à quai / au mouillage* n'a
   de sens qu'avec des relevés fréquents.
2. Agrégateur multi-armateurs (Shipsgo/Vizion) pour placer les conteneurs CMA
   CGM, MSC, COSCO.
3. Globe 3D, dwell et congestion des ports : quand on aura plus de dossiers
   que d'écrans.

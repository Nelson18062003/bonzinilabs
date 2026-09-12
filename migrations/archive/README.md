# Archive — ne colle rien d'ici

Ces fichiers sont d'anciennes migrations consolidées, **déjà appliquées** au
projet Bonzini. Ils sont gardés pour la trace, pas pour être rejoués.

**Le seul fichier à coller dans le SQL Editor est celui qui se trouve juste
au-dessus, dans `migrations/` : le plus récent.**

Pourquoi cette séparation : `20260831_consolidated.sql` redéfinit
`admin_has_permission` avec la matrice de l'époque — **treize permissions**,
sans `canViewCargo` ni `canManageCargo`. Le coller aujourd'hui écraserait la
matrice à quinze clés qui tourne en production. Les deux permissions Cargo
retomberaient alors sur `ELSE false`, et tout le module deviendrait invisible
et inutilisable pour **tous** les rôles, super_admin compris — sans la moindre
erreur au moment de l'exécution, donc sans rien pour mettre sur la piste.

| Fichier | Contenu | Appliqué |
| --- | --- | --- |
| `20260831_consolidated.sql` | Sécurité, rôles, trésorerie, paiements | oui |
| `20260911_consolidated.sql` | Bonzini Cargo, première livraison | oui |

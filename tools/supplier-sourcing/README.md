# Sourcing fournisseurs DHgate — manomètres (et autres produits)

Outil en ligne de commande qui construit une **base de données de fournisseurs /
produits** via l'**API officielle DHgate Open Platform**, dédoublonne, normalise
les prix (avec indicatif en **XAF**) et exporte un **classement par prix
croissant** en **CSV** et **Excel**.

> **Pourquoi l'API et pas du scraping ?** DHgate (comme Alibaba, Made-in-China,
> etc.) **interdit le scraping** dans ses CGU et déploie des protections
> anti-robot. L'API officielle est la voie **conforme, stable et fiable**. Cet
> outil ne contourne aucune protection : il s'authentifie proprement.

---

## 1. Démarrage immédiat (sans identifiants)

Le pipeline complet fonctionne hors-ligne avec des **données d'exemple**
réalistes — utile pour valider le format de sortie en attendant l'approbation de
ton app DHgate.

```bash
cd tools/supplier-sourcing
python3 main.py --mode offline --target 500
```

Sorties générées :
- `exports/manometres_par_prix.csv` — produits **triés par prix croissant**
- `exports/manometres_par_prix.xlsx` — idem en Excel (si `openpyxl` installé)
- `exports/fournisseurs.csv` — fournisseurs uniques
- `data/suppliers.db` — base SQLite (interrogeable)

Export Excel optionnel :
```bash
pip install -r requirements.txt   # installe openpyxl
```

Tests :
```bash
python3 tests/test_price_utils.py     # ou: pytest
```

---

## 2. Passer en production (données réelles DHgate)

### a. Obtenir un accès API
1. Crée un compte sur **DHgate** puis demande l'accès développeur
   (**DHgate Open Platform**) et fais **approuver une app** ; le périmètre
   « recherche / listing produits » doit être accordé.
2. Récupère ton **App Key** et **Secret Key** (+ un **access token** OAuth si
   les méthodes de ton périmètre l'exigent).

### b. Configurer
```bash
cp .env.example .env
# édite .env : DHGATE_APP_KEY, DHGATE_SECRET_KEY, (DHGATE_ACCESS_TOKEN)
```

### c. Lancer
```bash
python3 main.py --mode live --target 500
```

### ⚠️ À ajuster selon ton périmètre approuvé
Les éléments suivants dépendent de l'app que DHgate t'accorde (docs accessibles
seulement après connexion). Ils sont **configurables** et **clairement balisés** :

| Élément | Où | Variable / Fonction |
|---|---|---|
| URL de la passerelle | `.env` | `DHGATE_GATEWAY_URL` |
| Nom de la méthode de recherche | `.env` | `DHGATE_SEARCH_METHOD` |
| Méthode de signature (`md5`/`hmac`) | `.env` | `DHGATE_SIGN_METHOD` |
| Noms des paramètres de recherche | `dhgate_client.py` → `search_products` | — |
| Noms des champs de réponse | `dhgate_client.py` → `_map_item` / `_extract_items` | — |

Le mapping est **défensif** (teste plusieurs noms de champs courants), donc dans
beaucoup de cas il fonctionnera tel quel ; sinon, ajuste ces deux fonctions.

---

## 3. Options CLI

```
--mode {auto,offline,live}   auto = live si identifiants présents, sinon offline (défaut)
--target N                   nombre de produits visé (défaut 500)
--db PATH                    chemin de la base SQLite (défaut data/suppliers.db)
--out-dir PATH               dossier des exports (défaut exports/)
--keywords ...               types de manomètres à rechercher (défaut = liste intégrée)
--env PATH                   chemin du fichier .env
--dry-run                    construit et AFFICHE une requête live signée, sans l'envoyer
```

### Aperçu de la requête live (sans clés)
Pour vérifier la « tuyauterie » live (URL, paramètres, signature) avant même
d'avoir des identifiants :
```bash
python3 main.py --dry-run
python3 main.py --dry-run --keywords "stainless steel pressure gauge"
```
Affiche la requête `POST` complète, signée, **sans rien envoyer**. Si de vraies
clés sont présentes dans `.env`, `app_key` et `session` sont masqués à l'affichage.

Exemple ciblé :
```bash
python3 main.py --mode live --target 800 \
  --keywords "digital pressure gauge" "stainless steel pressure gauge"
```

---

## 4. Architecture

```
tools/supplier-sourcing/
├── main.py                     # CLI
├── requirements.txt            # openpyxl (Excel, optionnel)
├── .env.example                # modèle d'identifiants
└── dhgate_sourcing/
    ├── config.py               # Settings depuis l'environnement / .env
    ├── models.py               # Supplier, Product
    ├── price_utils.py          # parse_price, conversion XAF
    ├── dhgate_client.py        # signature + appels API + mapping
    ├── sample_data.py          # données d'exemple (mode offline)
    ├── database.py             # SQLite + dédoublonnage (INSERT OR REPLACE)
    ├── exporter.py             # export CSV + Excel
    └── pipeline.py             # collecte -> stockage -> export trié
```

**Dédoublonnage** : clé primaire `(source, product_id)` pour les produits et
`(source, supplier_id)` pour les fournisseurs → relancer l'outil met à jour sans
créer de doublons.

**Tri par prix croissant** : `price_min ASC`, les produits sans prix connu placés
en fin de liste.

---

## 5. Limites & bonnes pratiques
- Les prix DHgate sont **indicatifs** ; le prix réel se négocie (MOQ, incoterms).
- Respecte les **quotas** de l'API (l'outil temporise entre les pages).
- Une fois un fournisseur choisi, tu peux **régler en XAF via BonziniLabs**.

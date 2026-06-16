#!/usr/bin/env python3
"""Point d'entrée CLI — construit la base de fournisseurs de manomètres triée par prix.

Exemples :
    # Démo immédiate sans identifiants (données d'exemple) :
    python main.py --mode offline --target 500

    # En production une fois ton app DHgate approuvée (.env rempli) :
    python main.py --mode live --target 500
"""
from __future__ import annotations

import argparse
import os
import sys

# Permet `python main.py` depuis ce dossier sans installation du package.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dhgate_sourcing.config import Settings  # noqa: E402
from dhgate_sourcing.pipeline import DEFAULT_KEYWORDS, run  # noqa: E402

_HERE = os.path.dirname(os.path.abspath(__file__))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Sourcing de fournisseurs de manomètres (DHgate) -> base triée par prix.",
    )
    parser.add_argument(
        "--mode",
        choices=["auto", "offline", "live"],
        default="auto",
        help="auto = live si identifiants présents sinon offline (défaut).",
    )
    parser.add_argument("--target", type=int, default=500, help="Nombre de produits visé (défaut 500).")
    parser.add_argument("--db", default=os.path.join(_HERE, "data", "suppliers.db"), help="Chemin SQLite.")
    parser.add_argument("--out-dir", default=os.path.join(_HERE, "exports"), help="Dossier des exports.")
    parser.add_argument("--env", default=os.path.join(_HERE, ".env"), help="Chemin du fichier .env.")
    parser.add_argument(
        "--keywords",
        nargs="*",
        default=None,
        help="Mots-clés (types de manomètres) à rechercher ; défaut = liste intégrée.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Construit et affiche une requête live signée SANS l'envoyer (aucune clé requise).",
    )
    return parser


def _mask(value: object, show: int = 4) -> str:
    """Masque une valeur sensible pour l'affichage (garde début/fin)."""
    text = str(value)
    if len(text) <= show * 2:
        return (text[:1] + "***") if text else ""
    return f"{text[:show]}…{text[-show:]}"


def print_dry_run(settings: Settings, keyword: str = "digital pressure gauge") -> None:
    from dhgate_sourcing.dhgate_client import DhgateClient

    info = DhgateClient(settings).dry_run_search(keyword, page=1)
    placeholder = info["using_placeholder"]
    mask_keys = set() if placeholder else {"app_key", "session"}

    print("=== DRY-RUN — requête live DHgate (NON envoyée) ===\n")
    if placeholder:
        print("⚠️  Aucune clé réelle détectée → valeurs DEMO_* utilisées pour la démo.")
        print("    La signature est calculée correctement, mais avec un secret factice.\n")
    else:
        print("🔒 Clés réelles détectées → app_key / session masqués à l'affichage.\n")

    print(f"HTTP         : {info['http_method']} {info['url']}")
    print("Content-Type : application/x-www-form-urlencoded; charset=utf-8")
    if info["sign_method"] == "hmac":
        print("Signature    : HMAC-MD5( clé=secret , msg=concat ) → MAJUSCULES\n")
    else:
        print("Signature    : MD5( secret + concat + secret ) → MAJUSCULES\n")

    print("Paramètres :")
    for key, value in info["params"].items():
        shown = _mask(value) if key in mask_keys else value
        print(f"   {key:11} = {shown}")

    if placeholder:
        print("\nChaîne signée (concat des paires triées, hors 'sign') :")
        print(f"   {info['canonical_string']}")
        print("\nCorps POST (url-encodé, tel qu'il partirait) :")
        print(f"   {info['body']}")
    else:
        print("\n(Chaîne signée et corps masqués car des clés réelles sont présentes.)")

    print("\n✅ Aucune requête envoyée. (Réseau DHgate déjà confirmé joignable.)")


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    settings = Settings.from_env(dotenv_path=args.env)

    if args.dry_run:
        print_dry_run(settings, keyword=(args.keywords or ["digital pressure gauge"])[0])
        return 0

    if args.mode == "live" and not settings.has_credentials:
        print(
            "ERREUR : mode 'live' demandé mais aucun identifiant DHgate trouvé.\n"
            "→ Copie .env.example vers .env et renseigne DHGATE_APP_KEY / DHGATE_SECRET_KEY,\n"
            "  ou utilise --mode offline pour une démo avec données d'exemple.",
            file=sys.stderr,
        )
        return 2

    result = run(
        settings=settings,
        mode=args.mode,
        target=args.target,
        db_path=args.db,
        out_dir=args.out_dir,
        keywords=args.keywords or DEFAULT_KEYWORDS,
    )

    print("\n=== Résumé ===")
    print(f"Produits stockés   : {result.total_products}")
    print(f"Fournisseurs uniques : {result.total_suppliers}")
    print(f"CSV (par prix)     : {result.csv_products}")
    print(f"CSV fournisseurs   : {result.csv_suppliers}")
    if result.xlsx_products:
        print(f"Excel (par prix)   : {result.xlsx_products}")

    # Aperçu des 5 produits les moins chers.
    from dhgate_sourcing.database import Database

    with Database(args.db) as db:
        cheapest = db.products_sorted_by_price()[:5]
    if cheapest:
        print("\n--- 5 moins chers ---")
        for row in cheapest:
            price = row.get("price_min")
            xaf = row.get("price_min_xaf")
            xaf_str = f" (~{xaf:,.0f} XAF)" if xaf else ""
            print(f"  {price} {row.get('currency')}{xaf_str}  | {row.get('gauge_type')}  | {row.get('supplier_name')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

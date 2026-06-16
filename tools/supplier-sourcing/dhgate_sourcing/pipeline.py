"""Orchestration : collecte -> stockage (dédup) -> export trié par prix."""
from __future__ import annotations

import os
import time
from dataclasses import dataclass
from typing import Callable, List, Optional

from . import exporter, sample_data
from .config import Settings
from .database import Database
from .dhgate_client import DhgateClient
from .models import Product, Supplier

# Différents types de manomètres = différents mots-clés de recherche.
DEFAULT_KEYWORDS: List[str] = list(sample_data.GAUGE_TYPES.keys())

Logger = Callable[[str], None]


@dataclass
class RunResult:
    total_products: int
    total_suppliers: int
    csv_products: str
    csv_suppliers: str
    xlsx_products: Optional[str]


def _store_supplier_from_product(db: Database, product: Product) -> None:
    """Crée/maj un fournisseur minimal à partir d'un produit (mode live)."""
    if not product.supplier_id:
        return
    db.upsert_supplier(
        Supplier(
            source=product.source,
            supplier_id=product.supplier_id,
            name=product.supplier_name,
            url=product.supplier_url,
        )
    )


def collect_live(
    client: DhgateClient,
    db: Database,
    keywords: List[str],
    target: int,
    log: Logger,
    max_pages_per_keyword: int = 25,
    pause_seconds: float = 0.5,
) -> None:
    seen = 0
    for keyword in keywords:
        if db.count_products() >= target:
            break
        for page in range(1, max_pages_per_keyword + 1):
            if db.count_products() >= target:
                break
            products, has_more = client.search_products(keyword, page=page)
            for product in products:
                db.upsert_product(product)
                _store_supplier_from_product(db, product)
            db.commit()
            seen += len(products)
            log(f"  [{keyword}] page {page}: +{len(products)} (total stocké={db.count_products()})")
            if not has_more or not products:
                break
            time.sleep(pause_seconds)  # courtoisie envers l'API (rate limit)


def collect_offline(db: Database, settings: Settings, target: int, log: Logger) -> None:
    suppliers, products = sample_data.generate(target=target, usd_to_xaf=settings.usd_to_xaf)
    for supplier in suppliers:
        db.upsert_supplier(supplier)
    for product in products:
        db.upsert_product(product)
    db.commit()
    log(f"  Données d'exemple générées : {len(products)} produits, {len(suppliers)} fournisseurs.")


def export_all(db: Database, out_dir: str, log: Logger) -> RunResult:
    os.makedirs(out_dir, exist_ok=True)
    products = db.products_sorted_by_price()
    suppliers = db.suppliers_sorted()

    csv_products = os.path.join(out_dir, "manometres_par_prix.csv")
    csv_suppliers = os.path.join(out_dir, "fournisseurs.csv")
    exporter.export_csv(products, exporter.PRODUCT_COLUMNS, csv_products)
    exporter.export_csv(suppliers, exporter.SUPPLIER_COLUMNS, csv_suppliers)

    xlsx_products: Optional[str] = os.path.join(out_dir, "manometres_par_prix.xlsx")
    if exporter.export_xlsx(products, exporter.PRODUCT_COLUMNS, xlsx_products, "Manomètres"):
        log(f"  Excel écrit : {xlsx_products}")
    else:
        log("  (openpyxl absent → export Excel ignoré ; CSV disponible. `pip install openpyxl` pour l'Excel.)")
        xlsx_products = None

    return RunResult(
        total_products=db.count_products(),
        total_suppliers=db.count_suppliers(),
        csv_products=csv_products,
        csv_suppliers=csv_suppliers,
        xlsx_products=xlsx_products,
    )


def run(
    settings: Settings,
    mode: str,
    target: int,
    db_path: str,
    out_dir: str,
    keywords: Optional[List[str]] = None,
    log: Logger = print,
) -> RunResult:
    keywords = keywords or DEFAULT_KEYWORDS
    effective_mode = mode
    if mode == "auto":
        effective_mode = "live" if settings.has_credentials else "offline"

    log(f"Mode : {effective_mode} | cible : {target} produits | base : {db_path}")
    with Database(db_path) as db:
        if effective_mode == "live":
            collect_live(DhgateClient(settings), db, keywords, target, log)
        else:
            collect_offline(db, settings, target, log)
        return export_all(db, out_dir, log)

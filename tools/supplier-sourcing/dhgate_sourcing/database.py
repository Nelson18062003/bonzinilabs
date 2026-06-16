"""Stockage SQLite avec dédoublonnage par clé naturelle (source + id)."""
from __future__ import annotations

import os
import sqlite3
from typing import Any, Dict, List

from .models import Product, Supplier

_SCHEMA = """
CREATE TABLE IF NOT EXISTS suppliers (
    source            TEXT NOT NULL,
    supplier_id       TEXT NOT NULL,
    name              TEXT,
    url               TEXT,
    location          TEXT,
    rating            REAL,
    years_on_platform INTEGER,
    PRIMARY KEY (source, supplier_id)
);

CREATE TABLE IF NOT EXISTS products (
    source         TEXT NOT NULL,
    product_id     TEXT NOT NULL,
    title          TEXT,
    gauge_type     TEXT,
    supplier_id    TEXT,
    supplier_name  TEXT,
    supplier_url   TEXT,
    product_url    TEXT,
    price_raw      TEXT,
    currency       TEXT,
    price_min      REAL,
    price_max      REAL,
    price_min_xaf  REAL,
    min_order_qty  INTEGER,
    unit           TEXT,
    image_url      TEXT,
    fetched_at     TEXT,
    PRIMARY KEY (source, product_id)
);

CREATE INDEX IF NOT EXISTS idx_products_price ON products (price_min);
CREATE INDEX IF NOT EXISTS idx_products_type ON products (gauge_type);
"""


class Database:
    def __init__(self, path: str) -> None:
        parent = os.path.dirname(os.path.abspath(path))
        os.makedirs(parent, exist_ok=True)
        self.conn = sqlite3.connect(path)
        self.conn.row_factory = sqlite3.Row
        self.conn.executescript(_SCHEMA)
        self.conn.commit()

    # --- écritures (INSERT OR REPLACE = upsert, garantit la dédup) ---------

    def upsert_supplier(self, supplier: Supplier) -> None:
        row = supplier.to_row()
        cols = ", ".join(row.keys())
        placeholders = ", ".join(f":{k}" for k in row)
        self.conn.execute(
            f"INSERT OR REPLACE INTO suppliers ({cols}) VALUES ({placeholders})", row
        )

    def upsert_product(self, product: Product) -> None:
        row = product.to_row()
        cols = ", ".join(row.keys())
        placeholders = ", ".join(f":{k}" for k in row)
        self.conn.execute(
            f"INSERT OR REPLACE INTO products ({cols}) VALUES ({placeholders})", row
        )

    def commit(self) -> None:
        self.conn.commit()

    # --- lectures ----------------------------------------------------------

    def count_products(self) -> int:
        return self.conn.execute("SELECT COUNT(*) FROM products").fetchone()[0]

    def count_suppliers(self) -> int:
        return self.conn.execute("SELECT COUNT(*) FROM suppliers").fetchone()[0]

    def products_sorted_by_price(self) -> List[Dict[str, Any]]:
        """Tri par prix croissant ; les produits sans prix connu sont placés en fin."""
        cursor = self.conn.execute(
            "SELECT * FROM products ORDER BY (price_min IS NULL), price_min ASC, product_id ASC"
        )
        return [dict(row) for row in cursor.fetchall()]

    def suppliers_sorted(self) -> List[Dict[str, Any]]:
        cursor = self.conn.execute(
            "SELECT * FROM suppliers ORDER BY name ASC, supplier_id ASC"
        )
        return [dict(row) for row in cursor.fetchall()]

    def close(self) -> None:
        self.conn.close()

    def __enter__(self) -> "Database":
        return self

    def __exit__(self, *exc: Any) -> None:
        self.commit()
        self.close()

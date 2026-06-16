"""Générateur de données d'exemple — permet de faire tourner TOUT le pipeline
(base, dédup, tri, export) sans identifiants API, et de visualiser le format
de sortie immédiatement.

Les données sont synthétiques mais réalistes (types de manomètres, pôles
industriels chinois, prix/MOQ plausibles). Graine fixe = sortie reproductible.
"""
from __future__ import annotations

import random
from typing import List, Tuple

from .models import Product, Supplier
from .price_utils import to_xaf

# Type de manomètre -> fourchette de prix unitaire USD (min, max) plausible.
GAUGE_TYPES = {
    "Air Compressor Pressure Gauge": (0.6, 3.0),
    "Bourdon Tube Pressure Gauge": (0.8, 3.5),
    "Vacuum Gauge": (1.2, 5.0),
    "Oil Filled Pressure Gauge": (1.8, 6.0),
    "Hydraulic Pressure Gauge": (2.0, 8.0),
    "Stainless Steel Pressure Gauge": (2.5, 9.0),
    "Capsule Pressure Gauge": (3.0, 12.0),
    "Digital Pressure Gauge": (8.0, 45.0),
    "Differential Pressure Gauge": (12.0, 60.0),
    "Sanitary Diaphragm Pressure Gauge": (9.0, 40.0),
}

_CITIES = ["Ningbo", "Cixi", "Yuyao", "Wenzhou", "Shanghai", "Zhejiang",
           "Hangzhou", "Wuqiang", "Jiangsu", "Shenzhen"]
_MIDDLE = ["Instrument", "Measuring", "Automation", "Pneumatic", "Fluid Control",
           "Sensor", "Hardware", "Industrial", "Precision", "Import & Export"]
_SUFFIX = ["Co., Ltd.", "Manufacturing Co., Ltd.", "Trading Co., Ltd.",
           "Technology Co., Ltd."]
_MOQ_CHOICES = [1, 2, 5, 10, 20, 50, 100, 200, 500]


def _build_suppliers(rng: random.Random, count: int) -> List[Supplier]:
    suppliers: List[Supplier] = []
    seen = set()
    while len(suppliers) < count:
        name = f"{rng.choice(_CITIES)} {rng.choice(_MIDDLE)} {rng.choice(_SUFFIX)}"
        if name in seen:
            continue
        seen.add(name)
        idx = len(suppliers) + 1
        sid = f"S{idx:04d}"
        suppliers.append(
            Supplier(
                source="dhgate",
                supplier_id=sid,
                name=name,
                url=f"https://www.dhgate.com/store/sample-{sid.lower()}.html",
                location=name.split(" ")[0] + ", China",
                rating=round(rng.uniform(3.8, 5.0), 1),
                years_on_platform=rng.randint(1, 15),
            )
        )
    return suppliers


def generate(target: int = 500, usd_to_xaf: float = 600.0, seed: int = 42) -> Tuple[List[Supplier], List[Product]]:
    rng = random.Random(seed)
    supplier_count = max(40, target // 6)
    suppliers = _build_suppliers(rng, supplier_count)
    gauge_types = list(GAUGE_TYPES.items())

    products: List[Product] = []
    for i in range(target):
        gauge_type, (lo, hi) = rng.choice(gauge_types)
        supplier = rng.choice(suppliers)
        unit_min = round(rng.uniform(lo, hi), 2)
        unit_max = round(unit_min * rng.uniform(1.0, 1.8), 2)
        pid = f"DH-SAMPLE-{i:05d}"
        products.append(
            Product(
                source="dhgate",
                product_id=pid,
                title=f"{gauge_type} {rng.choice(['40mm', '50mm', '63mm', '100mm'])} "
                      f"{rng.choice(['1/4 NPT', '1/8 BSP', 'G1/4', 'M14'])}",
                gauge_type=gauge_type,
                supplier_id=supplier.supplier_id,
                supplier_name=supplier.name,
                supplier_url=supplier.url,
                product_url=f"https://www.dhgate.com/product/sample/{pid.lower()}.html",
                price_raw=f"US ${unit_min:.2f} - ${unit_max:.2f}",
                currency="USD",
                price_min=unit_min,
                price_max=unit_max,
                price_min_xaf=to_xaf(unit_min, usd_to_xaf, "USD"),
                min_order_qty=rng.choice(_MOQ_CHOICES),
                unit="piece",
                image_url="",
            )
        )
    return suppliers, products

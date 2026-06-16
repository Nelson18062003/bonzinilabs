"""Modèles de données (fournisseur / produit)."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, Optional


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class Supplier:
    """Un fournisseur (vendeur / boutique) sur la plateforme source."""

    source: str  # ex. "dhgate"
    supplier_id: str
    name: str
    url: str = ""
    location: str = ""
    rating: Optional[float] = None
    years_on_platform: Optional[int] = None

    def to_row(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class Product:
    """Un produit (ex. un type de manomètre) rattaché à un fournisseur."""

    source: str
    product_id: str
    title: str
    gauge_type: str  # type de manomètre (mot-clé de recherche utilisé)
    supplier_id: str = ""
    supplier_name: str = ""
    supplier_url: str = ""
    product_url: str = ""
    price_raw: str = ""
    currency: str = "USD"
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    price_min_xaf: Optional[float] = None
    min_order_qty: Optional[int] = None
    unit: str = "piece"
    image_url: str = ""
    fetched_at: str = field(default_factory=_now_iso)

    def to_row(self) -> Dict[str, Any]:
        return asdict(self)

"""Client de l'API DHgate Open Platform.

Implémente le schéma de signature standard des « plateformes ouvertes » de type
TOP (utilisé par DHgate) : paramètres système + signature MD5/HMAC.

⚠️ À CONFIRMER dans ton dashboard développeur DHgate (docs accessibles après
connexion + approbation de l'app) :
  - l'URL exacte de la passerelle (`DHGATE_GATEWAY_URL`),
  - le nom de la méthode de recherche produits (`DHGATE_SEARCH_METHOD`),
  - les noms exacts des paramètres métier et des champs de réponse.
Le mapping ci-dessous est défensif (plusieurs noms de champs possibles) et
facile à ajuster — voir `_map_item` et `search_products`.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import urllib.parse
import urllib.request
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from .config import Settings
from .models import Product
from .price_utils import parse_price, to_xaf


class DhgateApiError(RuntimeError):
    pass


def _first(item: Dict[str, Any], keys: List[str], default: Any = "") -> Any:
    """Renvoie la première valeur non vide parmi plusieurs noms de champs possibles."""
    for key in keys:
        if key in item and item[key] not in (None, ""):
            return item[key]
    return default


class DhgateClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    # --- signature ---------------------------------------------------------

    def _sign(self, params: Dict[str, Any]) -> str:
        """Signature TOP : tri des clés, concaténation `clévaleur`, puis MD5/HMAC."""
        items = sorted(
            (k, str(v))
            for k, v in params.items()
            if v is not None and v != "" and k != "sign"
        )
        concat = "".join(f"{k}{v}" for k, v in items)
        secret = self.settings.secret_key
        if self.settings.sign_method == "hmac":
            digest = hmac.new(secret.encode(), concat.encode(), hashlib.md5).hexdigest()
        else:
            digest = hashlib.md5(f"{secret}{concat}{secret}".encode()).hexdigest()
        return digest.upper()

    # --- appel générique ---------------------------------------------------

    def call(self, method: str, business_params: Dict[str, Any]) -> Dict[str, Any]:
        if not self.settings.has_credentials:
            raise DhgateApiError(
                "Identifiants manquants : définis DHGATE_APP_KEY et DHGATE_SECRET_KEY "
                "(voir .env.example)."
            )
        params: Dict[str, Any] = {
            "method": method,
            "app_key": self.settings.app_key,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "format": "json",
            "v": self.settings.api_version,
            "sign_method": self.settings.sign_method,
        }
        if self.settings.access_token:
            params["session"] = self.settings.access_token
        params.update({k: v for k, v in business_params.items() if v is not None})
        params["sign"] = self._sign(params)

        data = urllib.parse.urlencode(params).encode("utf-8")
        request = urllib.request.Request(
            self.settings.gateway_url,
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded; charset=utf-8"},
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except urllib.error.URLError as exc:  # réseau / TLS / DNS
            raise DhgateApiError(f"Échec réseau vers {self.settings.gateway_url}: {exc}") from exc
        except json.JSONDecodeError as exc:
            raise DhgateApiError(f"Réponse non-JSON de l'API: {exc}") from exc

        if isinstance(payload, dict) and ("error_response" in payload or "errorResponse" in payload):
            raise DhgateApiError(f"Erreur API DHgate: {payload}")
        return payload

    # --- recherche produits ------------------------------------------------

    def _map_item(self, item: Dict[str, Any], gauge_type: str) -> Product:
        price_raw = str(
            _first(item, ["priceRange", "price", "salePrice", "minPrice", "minOrderPrice"], "")
        )
        info = parse_price(price_raw)
        moq_raw = _first(item, ["minOrder", "moq", "minOrderQuantity"], None)
        try:
            moq = int(moq_raw) if moq_raw not in (None, "") else None
        except (TypeError, ValueError):
            moq = None
        return Product(
            source="dhgate",
            product_id=str(_first(item, ["itemCode", "productId", "itemId", "id"], "")),
            title=str(_first(item, ["subject", "title", "productName", "name"], "")),
            gauge_type=gauge_type,
            supplier_id=str(_first(item, ["sellerId", "supplierId", "storeId"], "")),
            supplier_name=str(_first(item, ["sellerName", "storeName", "supplierName"], "")),
            supplier_url=str(_first(item, ["storeUrl", "sellerUrl"], "")),
            product_url=str(_first(item, ["itemUrl", "productUrl", "url", "detailUrl"], "")),
            price_raw=price_raw,
            currency=info.currency,
            price_min=info.min_price,
            price_max=info.max_price,
            price_min_xaf=to_xaf(info.min_price, self.settings.usd_to_xaf, info.currency),
            min_order_qty=moq,
            unit=str(_first(item, ["unit", "measureUnit"], "piece")),
            image_url=str(_first(item, ["imageUrl", "image", "picUrl"], "")),
        )

    @staticmethod
    def _extract_items(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Descend dans l'enveloppe de réponse pour trouver la liste d'items.

        Les API TOP enveloppent souvent : {"<method>_response": {"result": {"items": {"item": [...]}}}}.
        On explore de façon défensive plusieurs structures courantes.
        """
        node: Any = payload
        if isinstance(node, dict):
            for key in list(node.keys()):
                if key.endswith("_response") or key.endswith("Response"):
                    node = node[key]
                    break
        for key in ("result", "results", "data"):
            if isinstance(node, dict) and key in node:
                node = node[key]
        for key in ("items", "products", "itemList", "list"):
            if isinstance(node, dict) and key in node:
                node = node[key]
        if isinstance(node, dict) and "item" in node:
            node = node["item"]
        if isinstance(node, list):
            return [x for x in node if isinstance(x, dict)]
        return []

    def search_products(
        self, keyword: str, page: int = 1, page_size: int = 40
    ) -> Tuple[List[Product], bool]:
        """Recherche une page de produits. Renvoie (produits, reste_des_pages?)."""
        payload = self.call(
            self.settings.search_method,
            {
                # Noms de paramètres À CONFIRMER selon ton périmètre d'API.
                "keyword": keyword,
                "q": keyword,
                "pageNo": page,
                "pageNum": page,
                "pageSize": page_size,
            },
        )
        items = self._extract_items(payload)
        products = [self._map_item(it, keyword) for it in items]
        products = [p for p in products if p.product_id]  # ignore les items sans id
        has_more = len(items) >= page_size
        return products, has_more

    # --- OAuth (token) -----------------------------------------------------

    def get_token(self, code: str) -> Dict[str, Any]:
        """Échange un `code` d'autorisation contre un access/refresh token."""
        return self.call("dh.oauth.token.get", {"code": code})

    def refresh_token(self, refresh_token: str) -> Dict[str, Any]:
        return self.call("dh.oauth.token.refresh", {"refreshToken": refresh_token})

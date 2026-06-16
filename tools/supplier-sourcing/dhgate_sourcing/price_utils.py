"""Normalisation des prix.

Gère les formats hétérogènes rencontrés sur les places de marché :
  "US $1.50", "$1.50 - $3.00", "1,234.56", "EUR 2,00", "US $0.99/piece"...
Renvoie un prix min / max + devise, et convertit le min en XAF.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List, Optional

# Capture des nombres avec séparateurs éventuels (milliers / décimales).
_NUMBER_RE = re.compile(r"\d+(?:[.,]\d+)*")


@dataclass
class PriceInfo:
    currency: str
    min_price: Optional[float]
    max_price: Optional[float]
    raw: str


def _detect_currency(raw: str) -> str:
    upper = raw.upper()
    if "€" in raw or "EUR" in upper:
        return "EUR"
    if "£" in raw or "GBP" in upper:
        return "GBP"
    # Par défaut USD (devise dominante sur DHgate).
    return "USD"


def _to_float(token: str) -> Optional[float]:
    """Convertit un token numérique en float en gérant `,` milliers vs décimale."""
    token = token.strip().replace(" ", "")
    if "," in token and "." in token:
        # Format anglo-saxon "1,234.56" -> la virgule est un séparateur de milliers.
        token = token.replace(",", "")
    elif "," in token:
        # Virgule seule : décimale type "2,00" si 1-2 chiffres en fin, sinon milliers.
        if token.count(",") == 1 and re.search(r",\d{1,2}$", token):
            token = token.replace(",", ".")
        else:
            token = token.replace(",", "")
    try:
        return float(token)
    except ValueError:
        return None


def parse_price(raw: Optional[str]) -> PriceInfo:
    raw = (raw or "").strip()
    currency = _detect_currency(raw)
    numbers: List[float] = []
    for match in _NUMBER_RE.findall(raw):
        value = _to_float(match)
        if value is not None:
            numbers.append(value)
    if not numbers:
        return PriceInfo(currency=currency, min_price=None, max_price=None, raw=raw)
    return PriceInfo(
        currency=currency,
        min_price=min(numbers),
        max_price=max(numbers),
        raw=raw,
    )


def to_xaf(amount: Optional[float], usd_to_xaf: float, currency: str = "USD") -> Optional[float]:
    """Convertit un montant en XAF. Seul USD est converti via le taux fourni ;
    les autres devises sont laissées telles quelles (taux à étendre si besoin)."""
    if amount is None:
        return None
    if currency != "USD":
        return None
    return round(amount * usd_to_xaf, 2)

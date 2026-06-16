"""Tests de la normalisation des prix. Lançables via `python tests/test_price_utils.py`
ou `pytest`.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dhgate_sourcing.price_utils import parse_price, to_xaf  # noqa: E402


def test_single_usd_price():
    info = parse_price("US $1.50")
    assert info.currency == "USD"
    assert info.min_price == 1.5
    assert info.max_price == 1.5


def test_usd_range():
    info = parse_price("$1.50 - $3.00")
    assert info.min_price == 1.5
    assert info.max_price == 3.0


def test_thousands_separator():
    info = parse_price("US $1,234.56")
    assert info.min_price == 1234.56


def test_euro_decimal_comma():
    info = parse_price("EUR 2,00")
    assert info.currency == "EUR"
    assert info.min_price == 2.0


def test_empty_price():
    info = parse_price("")
    assert info.min_price is None
    assert info.max_price is None


def test_to_xaf_usd():
    assert to_xaf(2.0, 600.0, "USD") == 1200.0


def test_to_xaf_non_usd_is_none():
    assert to_xaf(2.0, 600.0, "EUR") is None


def test_to_xaf_none_amount():
    assert to_xaf(None, 600.0, "USD") is None


if __name__ == "__main__":
    failures = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"PASS {name}")
            except AssertionError as exc:
                failures += 1
                print(f"FAIL {name}: {exc}")
    print(f"\n{failures} échec(s).")
    raise SystemExit(1 if failures else 0)

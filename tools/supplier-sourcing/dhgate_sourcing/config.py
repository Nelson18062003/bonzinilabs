"""Configuration centrale — lit les identifiants DHgate depuis l'environnement.

Aucune valeur sensible n'est codée en dur. Copie `.env.example` vers `.env` et
remplis les identifiants obtenus sur le portail développeur DHgate, ou exporte
les variables d'environnement correspondantes avant de lancer l'outil.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional


def load_dotenv(path: str) -> None:
    """Charge un fichier `.env` minimal (lignes `KEY=VALUE`) sans dépendance externe.

    Les variables déjà présentes dans l'environnement ont la priorité
    (on utilise `setdefault`), ce qui permet de surcharger via la ligne de commande.
    """
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as fh:
        for raw_line in fh:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


@dataclass
class Settings:
    """Paramètres résolus pour l'appel à l'API DHgate."""

    app_key: str
    secret_key: str
    access_token: str
    # NOTE: l'URL de passerelle et le nom de méthode de recherche dépendent du
    # périmètre approuvé pour ton app DHgate. Valeurs par défaut = points de
    # départ raisonnables, À CONFIRMER dans ton dashboard développeur.
    gateway_url: str
    search_method: str
    api_version: str
    sign_method: str  # "md5" (secret encadrant) ou "hmac" (hmac-md5)
    usd_to_xaf: float

    @classmethod
    def from_env(cls, dotenv_path: Optional[str] = None) -> "Settings":
        if dotenv_path:
            load_dotenv(dotenv_path)
        return cls(
            app_key=os.environ.get("DHGATE_APP_KEY", ""),
            secret_key=os.environ.get("DHGATE_SECRET_KEY", ""),
            access_token=os.environ.get("DHGATE_ACCESS_TOKEN", ""),
            gateway_url=os.environ.get(
                "DHGATE_GATEWAY_URL", "https://openapi.dhgate.com/router/api"
            ),
            search_method=os.environ.get("DHGATE_SEARCH_METHOD", "dh.product.search"),
            api_version=os.environ.get("DHGATE_API_VERSION", "2.0"),
            sign_method=os.environ.get("DHGATE_SIGN_METHOD", "md5"),
            usd_to_xaf=float(os.environ.get("USD_TO_XAF_RATE", "600")),
        )

    @property
    def has_credentials(self) -> bool:
        return bool(self.app_key and self.secret_key)

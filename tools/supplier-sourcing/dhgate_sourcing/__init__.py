"""Outil de sourcing fournisseurs DHgate pour BonziniLabs.

Construit une base de données de fournisseurs/produits (ex. manomètres) via
l'API officielle DHgate Open Platform, dédoublonne, normalise les prix et
exporte un classement par prix croissant (CSV + Excel).

Le pipeline (base, dédup, tri, export) fonctionne sans identifiants grâce au
mode hors-ligne (`--mode offline`) qui s'appuie sur des données d'exemple.
"""

__version__ = "0.1.0"

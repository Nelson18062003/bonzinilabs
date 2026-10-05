/**
 * Trésorerie desktop — surface publique.
 *
 * Le module tient en UN écran à six rubriques (refonte d'octobre 2026,
 * docs/tresorerie) ; les saisies s'ouvrent par-dessus la rubrique courante.
 * Toutes les routes desktop de la trésorerie mènent à cet écran, qui lit
 * l'adresse pour savoir quoi afficher.
 */
export { DesktopTreasuryScreen } from './DesktopTreasuryScreen';
export { treasuryPaths } from './treasuryNav';

/**
 * Desktop kit — Phase 0 of the workbench rebuild.
 *
 * Density, width and interaction primitives. Colour and tone stay in
 * `@/mobile/designKit`, which remains the single source of truth for both apps.
 */
export * from './tokens';
export * from './shortcuts';
export * from './selection';
export { useTier } from './useTier';
export { DataTable, type Column } from './DataTable';
export { Inspector } from './Inspector';
export { Dialog, type DialogSize } from './Dialog';

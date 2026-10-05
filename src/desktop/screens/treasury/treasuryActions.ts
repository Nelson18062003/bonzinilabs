/**
 * Trésorerie — les actions ouvrables depuis n'importe quel écran du module.
 *
 * Un compte propose « Ajuster » et « Inventorier », une fiche contrepartie
 * « Modifier », une opération « Annuler » : chaque écran demande, la coquille
 * ouvre la fenêtre. Ainsi une fenêtre n'existe qu'à un seul endroit, et
 * aucune vue n'a à connaître les autres.
 */
import { createContext, useContext } from 'react';
import type { CounterpartyFilter, OperationKind } from './treasuryNav';

export interface TreasuryActions {
  canManage: boolean;
  /** Seul le super admin peut annuler (garde serveur `void_treasury_operation`). */
  canVoid: boolean;
  newPurchase: () => void;
  newSale: () => void;
  adjust: (accountId?: string) => void;
  inventory: (accountId?: string) => void;
  editCounterparty: (args: { type: CounterpartyFilter; id?: string }) => void;
  voidOperation: (op: { kind: OperationKind; id: string; label: string }) => void;
}

const noop = () => {};

export const TreasuryActionsContext = createContext<TreasuryActions>({
  canManage: false,
  canVoid: false,
  newPurchase: noop,
  newSale: noop,
  adjust: noop,
  inventory: noop,
  editCounterparty: noop,
  voidOperation: noop,
});

export function useTreasuryActions(): TreasuryActions {
  return useContext(TreasuryActionsContext);
}

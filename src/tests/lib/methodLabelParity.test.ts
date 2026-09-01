/**
 * Toute méthode qui existe en base doit avoir un libellé.
 *
 * RÉGRESSION RÉELLE : le module analytique s'était fabriqué ses propres
 * tables de libellés, avec des clés inventées (`cash_agency`, `cash_agent`,
 * `mobile_money`, `card`) dont AUCUNE n'existe dans l'énumération
 * `deposit_method`, et sans 6 des 8 méthodes réelles. À l'écran, le tableau
 * « Dépôts par méthode » affichait donc les identifiants bruts de la base —
 * `bank_cash`, `mtn_transfer`, `om_withdrawal` — pendant que le tableau
 * voisin, « Paiements par méthode », affichait de vrais noms. Le même écran
 * parlait deux langues.
 *
 * Le compilateur garantit déjà l'exhaustivité des tables canoniques, qui sont
 * typées `Record<DepositMethod, string>`. Ce test garantit l'autre moitié :
 * que le type TypeScript n'a pas dérivé de l'énumération Postgres. Les deux
 * viennent de `types.ts`, régénéré depuis le schéma — si une valeur est
 * ajoutée en base et les types régénérés sans compléter les libellés, c'est
 * ici que ça casse.
 */
import { describe, it, expect } from 'vitest';
import { Constants } from '@/integrations/supabase/types';
import { DEPOSIT_METHOD_LABELS, DEPOSIT_METHOD_LABELS_SHORT } from '@/types/deposit';
import { PAYMENT_METHOD_LABELS } from '@/types/payment';

const DEPOSIT_METHODS = Constants.public.Enums.deposit_method;
const PAYMENT_METHODS = Constants.public.Enums.payment_method;

describe('Libellés des méthodes — parité avec le schéma', () => {
  it('les énumérations ne sont pas vides (le test se testerait sinon lui-même à vide)', () => {
    expect(DEPOSIT_METHODS.length).toBeGreaterThan(0);
    expect(PAYMENT_METHODS.length).toBeGreaterThan(0);
  });

  it('chaque méthode de dépôt a un libellé long et un libellé court', () => {
    for (const method of DEPOSIT_METHODS) {
      expect(DEPOSIT_METHOD_LABELS[method], `libellé long manquant : ${method}`).toBeTruthy();
      expect(DEPOSIT_METHOD_LABELS_SHORT[method], `libellé court manquant : ${method}`).toBeTruthy();
    }
  });

  it('chaque méthode de paiement a un libellé', () => {
    for (const method of PAYMENT_METHODS) {
      expect(PAYMENT_METHOD_LABELS[method], `libellé manquant : ${method}`).toBeTruthy();
    }
  });

  it("aucun libellé ne porte sur une méthode qui n'existe pas en base", () => {
    // Le sens inverse : c'est exactement ce qui s'était produit — quatre clés
    // (`cash_agency`, `cash_agent`, `mobile_money`, `card`) libellées avec soin
    // pour des valeurs que la base n'a jamais connues.
    expect(Object.keys(DEPOSIT_METHOD_LABELS).sort()).toEqual([...DEPOSIT_METHODS].sort());
    expect(Object.keys(PAYMENT_METHOD_LABELS).sort()).toEqual([...PAYMENT_METHODS].sort());
  });

  it('aucun libellé ne se contente de répéter la clé technique', () => {
    for (const [key, label] of Object.entries(DEPOSIT_METHOD_LABELS)) {
      expect(label, `« ${key} » n'est pas un libellé humain`).not.toBe(key);
    }
    for (const [key, label] of Object.entries(PAYMENT_METHOD_LABELS)) {
      expect(label, `« ${key} » n'est pas un libellé humain`).not.toBe(key);
    }
  });
});

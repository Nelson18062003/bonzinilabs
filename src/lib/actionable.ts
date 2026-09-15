import type { Enums } from '@/integrations/supabase/types';

/**
 * Ce qui attend un opérateur — LA définition, partagée par le badge
 * « Opérations » de la barre, les compteurs du hub Opérations et le centre de
 * notifications. Trois chiffres qui ne se recoupent pas font douter de
 * l'écran ; ici ils sortent de la même liste.
 *
 * - Dépôt : preuve envoyée ou en vérification. « À corriger » attend le
 *   client, pas nous.
 * - Paiement : prêt à payer, espèces scannées, ou en cours (commencé, mais
 *   la preuve de paiement manque encore avant de valider).
 */
export const ACTIONABLE_DEPOSIT_STATUSES: Enums<'deposit_status'>[] = ['proof_submitted', 'admin_review'];
export const ACTIONABLE_PAYMENT_STATUSES: Enums<'payment_status'>[] = ['ready_for_payment', 'cash_scanned', 'processing'];

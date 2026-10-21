/**
 * Le relevé de compte PDF d'un client (période + langue), partagé par la
 * fiche (« … › Relevé PDF ») et le relevé (icône de téléchargement).
 * Même lecture que l'ancienne fiche : toutes les écritures de la période, et
 * le solde d'ouverture tiré de la dernière écriture avant elle.
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { fetchLastLedgerEntryBefore, fetchLedgerEntriesInRange } from '@/hooks/useClientManagement';
import { statementQueryRange, type StatementRange } from '@/lib/statementPeriod';
import { isStatementEntry, type StatementEntry, type StatementLang } from '@/lib/accountStatement';
import { downloadAccountStatement } from '@/lib/accountStatementData';

export interface StatementClient {
  id: string;
  firstName: string;
  lastName: string;
  customerCode: string;
  phone: string;
  email: string;
  country: string;
}

export function useClientStatement(client: StatementClient | null | undefined) {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  const generate = async (range: StatementRange, lang: StatementLang) => {
    if (!client) return false;
    setGenerating(true);
    try {
      const query = statementQueryRange(range);
      const entries: StatementEntry[] = await fetchLedgerEntriesInRange(client.id, query);
      if (query === null && !entries.some(isStatementEntry)) {
        toast.error('Aucun mouvement à exporter');
        return false;
      }
      const lastBefore = query ? await fetchLastLedgerEntryBefore(client.id, query.from) : null;
      await downloadAccountStatement({
        db: supabaseAdmin,
        lang,
        client: {
          name: `${client.firstName} ${client.lastName}`.trim(),
          code: client.customerCode,
          phone: client.phone,
          email: client.email,
          country: client.country,
        },
        entries,
        range: query,
        balanceBeforeRange: lastBefore?.balanceAfter ?? null,
      });
      return true;
    } catch (err) {
      console.error('Error generating statement:', err);
      toast.error('Erreur lors de la génération du relevé');
      return false;
    } finally {
      setGenerating(false);
    }
  };

  return { open, show: () => setOpen(true), hide: () => setOpen(false), generating, generate };
}

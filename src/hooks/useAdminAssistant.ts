import { useState, useCallback, useRef } from 'react';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY } from '@/lib/env';

export interface AssistantAttachment {
  name: string;
  kind: 'image' | 'pdf';
  url?: string; // aperçu local (object URL) pour la session courante
}

export interface ProposalLine { label: string; value: string; }
export interface ProposalSummary {
  title: string;
  subtitle?: string;
  amount?: string;
  lines: ProposalLine[];
  confirmLabel: string;
  danger?: boolean;
}
export interface AssistantProposal {
  id: string;
  tool: string;
  summary: ProposalSummary;
  /** État local de la carte. */
  state: 'pending' | 'executing' | 'done' | 'cancelled' | 'failed';
  resultText?: string;
}

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  error?: boolean;
  attachments?: AssistantAttachment[];
  proposals?: AssistantProposal[];
}

const FUNCTION_URL = `${VITE_SUPABASE_URL}/functions/v1/admin-assistant`;
const ATTACHMENT_BUCKET = 'assistant-attachments';

function attachmentKind(mime: string): 'image' | 'pdf' {
  return mime === 'application/pdf' ? 'pdf' : 'image';
}

async function authedFetch(payload: Record<string, unknown>) {
  const { data: { session } } = await supabaseAdmin.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Session admin introuvable — reconnecte-toi.');
  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/**
 * Hook de l'assistant "Directeur des Opérations".
 * - Lecture : réponses en langage naturel.
 * - Écriture : l'IA PROPOSE des actions (cartes), l'admin CONFIRME d'un tap.
 * Appelle l'Edge Function via fetch() avec le JWT admin (pas .invoke()).
 */
export function useAdminAssistant() {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const conversationIdRef = useRef<string | null>(null);

  const sendMessage = useCallback(async (raw: string, files: File[] = []) => {
    const text = raw.trim();
    if ((!text && files.length === 0) || isLoading) return;

    const localAttachments: AssistantAttachment[] = files.map((f) => ({
      name: f.name,
      kind: attachmentKind(f.type),
      url: f.type === 'application/pdf' ? undefined : URL.createObjectURL(f),
    }));

    const userMsg: AssistantMessage = {
      id: crypto.randomUUID(), role: 'user', text,
      attachments: localAttachments.length ? localAttachments : undefined,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const { data: { session } } = await supabaseAdmin.auth.getSession();
      const userId = session?.user?.id;
      if (!session?.access_token || !userId) throw new Error('Session admin introuvable — reconnecte-toi.');

      // Téléversement des pièces jointes (bucket privé)
      const uploaded: Array<{ path: string; mime: string; name: string }> = [];
      for (const file of files) {
        const ext = file.name.split('.').pop() || 'bin';
        const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabaseAdmin.storage
          .from(ATTACHMENT_BUCKET)
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw new Error(`Échec de l'envoi de ${file.name} : ${upErr.message}`);
        uploaded.push({ path, mime: file.type, name: file.name });
      }

      const { ok, status, data } = await authedFetch({
        conversationId: conversationIdRef.current,
        message: text,
        attachments: uploaded,
      });
      if (!ok || data?.success === false) throw new Error(data?.error || `Erreur ${status}`);

      if (data.conversationId) conversationIdRef.current = data.conversationId;
      // deno-lint-ignore no-explicit-any
      const proposals: AssistantProposal[] = Array.isArray(data.proposals)
        ? data.proposals
            .filter((p: { id?: string }) => p?.id)
            .map((p: { id: string; tool: string; summary: ProposalSummary }) => ({ id: p.id, tool: p.tool, summary: p.summary, state: 'pending' as const }))
        : [];

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', text: data.reply || '…', proposals: proposals.length ? proposals : undefined },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Une erreur est survenue';
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'assistant', text: `⚠️ ${msg}`, error: true }]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  // Met à jour l'état d'une carte de proposition (par id)
  const patchProposal = useCallback((proposalId: string, patch: Partial<AssistantProposal>) => {
    setMessages((prev) => prev.map((m) =>
      m.proposals
        ? { ...m, proposals: m.proposals.map((p) => (p.id === proposalId ? { ...p, ...patch } : p)) }
        : m,
    ));
  }, []);

  const confirmProposal = useCallback(async (proposalId: string) => {
    patchProposal(proposalId, { state: 'executing' });
    try {
      const { ok, status, data } = await authedFetch({ confirmAction: proposalId });
      if (!ok || data?.success === false) {
        patchProposal(proposalId, { state: 'failed', resultText: data?.error || `Erreur ${status}` });
        return;
      }
      // Message de réussite lisible
      const r = data.result || {};
      let txt = 'Action exécutée ✅';
      if (r.reference) txt = `✅ ${r.reference}`;
      if (r.new_balance != null) txt += ` · nouveau solde ${new Intl.NumberFormat('fr-FR').format(r.new_balance)} XAF`;
      if (r.amount_credited != null) txt = `✅ Wallet crédité de ${new Intl.NumberFormat('fr-FR').format(r.amount_credited)} XAF` + (r.reference ? ` · ${r.reference}` : '');
      patchProposal(proposalId, { state: 'done', resultText: txt });
    } catch (e) {
      patchProposal(proposalId, { state: 'failed', resultText: e instanceof Error ? e.message : 'Erreur' });
    }
  }, [patchProposal]);

  const cancelProposal = useCallback(async (proposalId: string) => {
    patchProposal(proposalId, { state: 'cancelled' });
    try { await authedFetch({ cancelAction: proposalId }); } catch { /* best effort */ }
  }, [patchProposal]);

  const reset = useCallback(() => {
    conversationIdRef.current = null;
    setMessages([]);
  }, []);

  return { messages, isLoading, sendMessage, confirmProposal, cancelProposal, reset };
}

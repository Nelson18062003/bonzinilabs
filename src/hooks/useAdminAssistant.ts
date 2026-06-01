import { useState, useCallback, useRef } from 'react';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY } from '@/lib/env';
import { compressImage } from '@/lib/imageCompression';

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

      // Téléversement des pièces jointes (bucket privé). Les images sont compressées
      // (redimensionnées) avant envoi → l'IA les lit mieux et plus vite.
      const uploaded: Array<{ path: string; mime: string; name: string }> = [];
      for (const raw of files) {
        const file = raw.type === 'application/pdf' ? raw : await compressImage(raw, 1568, 0.85);
        const ext = file.name.split('.').pop() || 'bin';
        const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabaseAdmin.storage
          .from(ATTACHMENT_BUCKET)
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw new Error(`Échec de l'envoi de ${raw.name} : ${upErr.message}`);
        uploaded.push({ path, mime: file.type, name: raw.name });
      }

      // Réponse en STREAMING : on crée une bulle assistant vide qu'on remplit au fil de l'eau.
      const assistantId = crypto.randomUUID();
      setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', text: '' }]);

      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ conversationId: conversationIdRef.current, message: text, attachments: uploaded }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Erreur ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let streamErr: string | null = null;

      const apply = (patch: (m: AssistantMessage) => AssistantMessage) =>
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? patch(m) : m)));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          const l = line.trim();
          if (!l.startsWith('data:')) continue;
          const payload = l.slice(5).trim();
          if (!payload) continue;
          let ev: { type: string; text?: string; conversationId?: string; error?: string; proposal?: { id: string; tool: string; summary: ProposalSummary } };
          try { ev = JSON.parse(payload); } catch { continue; }
          if (ev.type === 'start' && ev.conversationId) {
            conversationIdRef.current = ev.conversationId;
          } else if (ev.type === 'delta' && ev.text) {
            apply((m) => ({ ...m, text: m.text + ev.text }));
          } else if (ev.type === 'proposal' && ev.proposal?.id) {
            const p: AssistantProposal = { id: ev.proposal.id, tool: ev.proposal.tool, summary: ev.proposal.summary, state: 'pending' };
            apply((m) => ({ ...m, proposals: [...(m.proposals ?? []), p] }));
          } else if (ev.type === 'error') {
            streamErr = ev.error || 'Erreur de l\'assistant';
          }
        }
      }

      if (streamErr) apply((m) => ({ ...m, text: m.text || `⚠️ ${streamErr}`, error: !m.text }));
      else apply((m) => (m.text || m.proposals?.length ? m : { ...m, text: '…' }));
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

  // Reprend la dernière conversation de l'admin (transcript + actions encore en attente).
  const loadHistory = useCallback(async () => {
    try {
      const { data: { session } } = await supabaseAdmin.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) return;
      const { data: conv } = await supabaseAdmin
        .from('assistant_conversations')
        .select('id')
        .eq('admin_user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!conv) return;
      conversationIdRef.current = conv.id;

      const { data: msgs } = await supabaseAdmin
        .from('assistant_messages')
        .select('role, content')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: true })
        .limit(100);

      const mapped: AssistantMessage[] = (msgs ?? [])
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => {
          const c = (m.content ?? {}) as { text?: string; attachments?: Array<{ name: string; mime: string }> };
          const atts = Array.isArray(c.attachments) && c.attachments.length
            ? c.attachments.map((a) => ({ name: a.name, kind: attachmentKind(a.mime) }))
            : undefined;
          return { id: crypto.randomUUID(), role: m.role as 'user' | 'assistant', text: c.text ?? '', attachments: atts };
        })
        .filter((m) => m.text || m.attachments);

      // Actions encore en attente de confirmation → ré-affichées comme cartes actionnables
      const { data: pending } = await supabaseAdmin
        .from('assistant_pending_actions')
        .select('id, tool, summary')
        .eq('conversation_id', conv.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
      if (pending && pending.length) {
        mapped.push({
          id: crypto.randomUUID(), role: 'assistant', text: 'Action(s) en attente de confirmation :',
          proposals: pending.map((p) => ({ id: p.id, tool: p.tool as string, summary: p.summary as unknown as ProposalSummary, state: 'pending' as const })),
        });
      }

      if (mapped.length) setMessages(mapped);
    } catch { /* historique best-effort */ }
  }, []);

  return { messages, isLoading, sendMessage, confirmProposal, cancelProposal, reset, loadHistory };
}

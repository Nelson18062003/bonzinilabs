import { useState, useCallback, useRef } from 'react';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY } from '@/lib/env';

export interface AssistantAttachment {
  name: string;
  kind: 'image' | 'pdf';
  /** Aperçu local (object URL) pour la session courante. */
  url?: string;
}

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  error?: boolean;
  attachments?: AssistantAttachment[];
}

const FUNCTION_URL = `${VITE_SUPABASE_URL}/functions/v1/admin-assistant`;
const ATTACHMENT_BUCKET = 'assistant-attachments';

function attachmentKind(mime: string): 'image' | 'pdf' {
  return mime === 'application/pdf' ? 'pdf' : 'image';
}

/**
 * Hook pour l'assistant "Directeur des Opérations".
 * Appelle l'Edge Function `admin-assistant` via fetch() avec le JWT admin
 * (et NON supabaseAdmin.functions.invoke() qui casse à cause des conflits GoTrue).
 * Les pièces jointes (images / PDF) sont téléversées dans un bucket privé puis
 * référencées par chemin dans la requête ; l'Edge Function les transmet à Claude.
 */
export function useAdminAssistant() {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const conversationIdRef = useRef<string | null>(null);

  const sendMessage = useCallback(async (raw: string, files: File[] = []) => {
    const text = raw.trim();
    if ((!text && files.length === 0) || isLoading) return;

    // Aperçus locaux immédiats (object URLs pour la bulle du message envoyé)
    const localAttachments: AssistantAttachment[] = files.map((f) => ({
      name: f.name,
      kind: attachmentKind(f.type),
      url: f.type === 'application/pdf' ? undefined : URL.createObjectURL(f),
    }));

    const userMsg: AssistantMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text,
      attachments: localAttachments.length ? localAttachments : undefined,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const { data: { session } } = await supabaseAdmin.auth.getSession();
      const token = session?.access_token;
      const userId = session?.user?.id;
      if (!token || !userId) throw new Error('Session admin introuvable — reconnecte-toi.');

      // Téléversement des pièces jointes dans le bucket privé
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

      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          conversationId: conversationIdRef.current,
          message: text,
          attachments: uploaded,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || `Erreur ${res.status}`);
      }

      if (data.conversationId) conversationIdRef.current = data.conversationId;
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', text: data.reply || '…' },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Une erreur est survenue';
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', text: `⚠️ ${msg}`, error: true },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  const reset = useCallback(() => {
    conversationIdRef.current = null;
    setMessages([]);
  }, []);

  return { messages, isLoading, sendMessage, reset };
}

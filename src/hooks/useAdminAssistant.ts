import { useState, useCallback, useRef } from 'react';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY } from '@/lib/env';

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  error?: boolean;
}

const FUNCTION_URL = `${VITE_SUPABASE_URL}/functions/v1/admin-assistant`;

/**
 * Hook pour l'assistant "Directeur des Opérations".
 * Appelle l'Edge Function `admin-assistant` via fetch() avec le JWT admin
 * (et NON supabaseAdmin.functions.invoke() qui casse à cause des conflits GoTrue).
 */
export function useAdminAssistant() {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const conversationIdRef = useRef<string | null>(null);

  const sendMessage = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || isLoading) return;

    const userMsg: AssistantMessage = { id: crypto.randomUUID(), role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
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
        body: JSON.stringify({
          conversationId: conversationIdRef.current,
          message: text,
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

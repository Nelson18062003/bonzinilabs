// ============================================================
// Typing indicator via Supabase Realtime Broadcast (volatile)
//
// Pattern :
//   - Émetteur : channel.send({ type: 'broadcast', event: 'typing' })
//     avec debounce 300ms, et 'typing-stop' après 3s sans input
//   - Récepteur : écoute les events, applique un timeout local de 5s
//     pour cacher l'indicator si plus de signal (safety net)
//
// Fonctionne avec n'importe quel SupabaseClient (client ou admin).
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

const TYPING_DEBOUNCE_MS = 300;
const TYPING_STOP_AFTER_MS = 3000;
const RECEIVER_TIMEOUT_MS = 5000;

interface TypingPayload {
  sender_type: 'client' | 'admin';
  sender_id: string;
}

export function useTypingIndicator(params: {
  client: SupabaseClient;
  conversationId: string | null | undefined;
  selfSenderType: 'client' | 'admin';
  selfSenderId: string | null | undefined;
}) {
  const { client, conversationId, selfSenderType, selfSenderId } = params;
  const [otherIsTyping, setOtherIsTyping] = useState(false);

  // Refs pour timers et channel
  const channelRef = useRef<ReturnType<SupabaseClient['channel']> | null>(null);
  const lastSentRef = useRef<number>(0);
  const stopTimerRef = useRef<number | null>(null);
  const receiverTimerRef = useRef<number | null>(null);

  // Setup channel
  useEffect(() => {
    if (!conversationId) return;

    const channel = client.channel(`chat-typing:${conversationId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'typing' }, (msg) => {
        const payload = msg.payload as TypingPayload;
        if (!payload || payload.sender_type === selfSenderType) return;
        if (payload.sender_id === selfSenderId) return;
        setOtherIsTyping(true);
        if (receiverTimerRef.current) clearTimeout(receiverTimerRef.current);
        receiverTimerRef.current = window.setTimeout(() => {
          setOtherIsTyping(false);
        }, RECEIVER_TIMEOUT_MS);
      })
      .on('broadcast', { event: 'typing-stop' }, (msg) => {
        const payload = msg.payload as TypingPayload;
        if (!payload || payload.sender_type === selfSenderType) return;
        setOtherIsTyping(false);
        if (receiverTimerRef.current) clearTimeout(receiverTimerRef.current);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      if (receiverTimerRef.current) clearTimeout(receiverTimerRef.current);
      client.removeChannel(channel);
      channelRef.current = null;
    };
  }, [client, conversationId, selfSenderType, selfSenderId]);

  // Émet "typing" (avec debounce naturel via lastSentRef)
  const notifyTyping = useCallback(() => {
    if (!channelRef.current || !selfSenderId) return;
    const now = Date.now();
    if (now - lastSentRef.current >= TYPING_DEBOUNCE_MS) {
      lastSentRef.current = now;
      void channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { sender_type: selfSenderType, sender_id: selfSenderId },
      });
    }
    // Re-arme le timer de stop
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = window.setTimeout(() => {
      if (!channelRef.current || !selfSenderId) return;
      void channelRef.current.send({
        type: 'broadcast',
        event: 'typing-stop',
        payload: { sender_type: selfSenderType, sender_id: selfSenderId },
      });
    }, TYPING_STOP_AFTER_MS);
  }, [selfSenderType, selfSenderId]);

  // Émet immédiatement un stop (quand le message est envoyé)
  const notifyStop = useCallback(() => {
    if (!channelRef.current || !selfSenderId) return;
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    void channelRef.current.send({
      type: 'broadcast',
      event: 'typing-stop',
      payload: { sender_type: selfSenderType, sender_id: selfSenderId },
    });
  }, [selfSenderType, selfSenderId]);

  return { otherIsTyping, notifyTyping, notifyStop };
}

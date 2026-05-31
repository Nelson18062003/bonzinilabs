import { useEffect, useRef, useState } from 'react';
import { Send, Bot, Loader2 } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAssistant } from '@/hooks/useAdminAssistant';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { cn } from '@/lib/utils';

const SUGGESTIONS = [
  'Volume de la semaine ?',
  'Derniers dépôts en attente',
  'Taux Alipay du jour',
  'Paiements en cours',
];

// Dégradé d'identité (3 couleurs du logo : violet → orange)
const BRAND_GRADIENT = 'bg-gradient-to-br from-[hsl(258,100%,60%)] to-[hsl(16,100%,55%)]';

export function MobileAssistantScreen() {
  const { profile } = useAdminAuth();
  const { messages, isLoading, sendMessage } = useAdminAssistant();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isLoading]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      <MobileHeader title="Assistant" subtitle="Directeur des Opérations" showBack />

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {isEmpty ? (
          <div className="flex flex-col items-center text-center pt-10">
            <div className={cn('w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg', BRAND_GRADIENT)}>
              <Bot className="w-8 h-8" />
            </div>
            <h2 className="mt-4 text-lg font-semibold">
              Bonjour {profile?.first_name || ''} 👋
            </h2>
            <p className="mt-1 text-sm text-muted-foreground max-w-xs">
              Pose-moi une question sur la plateforme — clients, dépôts, paiements, taux, statistiques.
              Tu peux écrire ou <span className="font-medium text-foreground">dicter avec le micro de ton clavier</span>.
            </p>
            <div className="mt-6 grid grid-cols-1 gap-2 w-full max-w-sm">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-left text-sm px-4 py-3 rounded-xl border border-border bg-card active:bg-muted transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => (
              <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[85%] px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap break-words rounded-2xl',
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : m.error
                        ? 'bg-destructive/10 text-destructive rounded-bl-md'
                        : 'bg-muted text-foreground rounded-bl-md',
                  )}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted text-muted-foreground rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">L'assistant réfléchit…</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-border bg-background px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Écris ou dicte ta demande…"
            className="flex-1 resize-none max-h-32 px-4 py-3 rounded-2xl bg-muted text-[15px] outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            aria-label="Envoyer"
            className={cn(
              'w-11 h-11 rounded-full flex items-center justify-center text-white shrink-0 transition-opacity',
              BRAND_GRADIENT,
              (!input.trim() || isLoading) && 'opacity-40',
            )}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

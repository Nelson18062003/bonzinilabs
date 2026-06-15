/**
 * DEV-ONLY maquette — module CLIENT « Support » (liste des conversations).
 * Le CHAT lui-même (bulles, saisie, vocal) est un design PARTAGÉ admin↔client
 * volontairement unifié → non refondu. Ici : la liste, spécifique client.
 * Harness: ?screen=csupport-list
 */
import { SURFACE, TEXT } from '@/mobile/designKit/tokens';
import { MessageCircle, Plus, ChevronRight, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const LILAC = '#8B5CF6';

type Conv = { title: string; preview: string; time: string; unread?: number; closed?: boolean };
const CONVS: Conv[] = [
  { title: 'Problème avec un paiement', preview: 'Bonjour, mon paiement BZ-PM-2401…', time: 'il y a 5 min', unread: 2 },
  { title: 'Question sur les taux', preview: 'Vous : Merci pour votre réponse 🙏', time: 'il y a 2 h' },
  { title: 'Délai de virement bancaire', preview: 'Conversation résolue', time: 'il y a 3 j', closed: true },
];

export function SupportList() {
  return (
    <div className={cn('mx-auto min-h-screen max-w-[420px]', SURFACE.canvas)}>
      <div className="space-y-5 p-4 pt-6">
        {/* En-tête */}
        <div className="flex items-start justify-between gap-3 px-1">
          <div>
            <h1 className={cn('text-[26px] font-black leading-tight', TEXT.strong)}>Support</h1>
            <p className={cn('mt-0.5 text-[13px]', TEXT.muted)}>L'équipe Bonzini vous répond</p>
          </div>
          <span className={cn('flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-bold', SURFACE.holder)}>
            <Clock className="h-3.5 w-3.5" /> Réponse ~ 2 min
          </span>
        </div>

        {/* Nouvelle conversation */}
        <button className={cn('flex w-full items-center gap-4 rounded-[24px] p-5 text-left', SURFACE.card, SURFACE.shadow)}>
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#1C1B22] dark:bg-[#F2F1F7]">
            <Plus className="h-[26px] w-[26px] text-white dark:text-[#1B1A24]" strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <div className={cn('text-[17px] font-black', TEXT.strong)}>Nouvelle conversation</div>
            <div className={cn('mt-0.5 text-[12px]', TEXT.muted)}>Posez votre question à notre équipe</div>
          </div>
          <ChevronRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
        </button>

        {/* Conversations */}
        <section>
          <h2 className={cn('mb-2 px-1 text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>Mes conversations</h2>
          <div className="space-y-2.5">
            {CONVS.map((c) => (
              <div key={c.title} className={cn('flex items-center gap-3 rounded-[18px] p-3.5', SURFACE.card, SURFACE.shadow, c.closed && 'opacity-60')}>
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                  style={c.unread ? { background: LILAC } : undefined}
                >
                  <MessageCircle className={cn('h-5 w-5', c.unread ? 'text-white' : TEXT.muted)} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={cn('truncate text-[15px]', c.unread ? 'font-black' : 'font-bold', TEXT.strong)}>{c.title}</span>
                    <span className={cn('shrink-0 text-[11px]', TEXT.muted)}>{c.time}</span>
                  </div>
                  <div className={cn('mt-0.5 truncate text-[12px]', c.unread ? 'font-semibold' : '', TEXT.muted)}>{c.preview}</div>
                </div>
                {c.unread ? (
                  <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white" style={{ background: LILAC }}>{c.unread}</span>
                ) : (
                  <ChevronRight className={cn('h-4 w-4 shrink-0', TEXT.muted)} />
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Aperçu état vide */}
        <div className={cn('mt-2 rounded-[24px] p-10 text-center', SURFACE.card, SURFACE.shadow)}>
          <div className={cn('mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full', SURFACE.holder)}>
            <MessageCircle className="h-7 w-7" />
          </div>
          <p className={cn('text-[15px] font-bold', TEXT.strong)}>Aucune conversation</p>
          <p className={cn('mt-1 text-[13px]', TEXT.muted)}>Une question ? Démarrez une conversation.</p>
        </div>
      </div>
    </div>
  );
}

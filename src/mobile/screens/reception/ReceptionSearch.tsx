// ============================================================
// RÉCEPTION — Étape 1 bis : « Qui est le client ? » quand il n'y a pas de
// QR. Un champ, une liste, un bouton pour créer le client. Rien d'autre.
// Avec `?assign=<dépôt>`, la ligne choisie attribue le dépôt en attente,
// puis on revient là d'où l'on venait ; un refus laisse l'écran utilisable.
// La flèche ramène à la caméra (étape 1) ; la recherche tapée reste dans
// l'URL (?q=) pour qu'un retour la retrouve.
// ============================================================
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, Search, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { clientFullName, initials, type ReceptionClient } from '@/lib/reception';
import { useAssignDeposit, useReceptionSearch } from '@/hooks/useReception';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { SURFACE, TEXT, TYPE, Button, Card, Holder, TextInput } from '@/mobile/designKit';
import { StepHeader } from '@/mobile/components/reception/bits';
import { useAssignFlow } from '@/mobile/components/reception/useAssignFlow';

export function ReceptionSearch() {
  const navigate = useNavigate();
  const flow = useAssignFlow();
  const { assignId, qs } = flow;
  const [params, setParams] = useSearchParams();
  const { t } = useLanguage();
  const [query, setQuery] = useState(() => params.get('q') ?? '');
  const [debounced, setDebounced] = useState(query);
  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(query);
      // La recherche reste dans l'URL (sans ajouter d'entrée) : un retour la retrouve.
      setParams((p) => { const n = new URLSearchParams(p); if (query.trim()) n.set('q', query.trim()); else n.delete('q'); return n; }, { replace: true });
    }, 250);
    return () => clearTimeout(id);
  }, [query, setParams]);
  const search = useReceptionSearch(debounced);
  const assign = useAssignDeposit();

  const pick = async (client: ReceptionClient) => {
    if (assignId) {
      if (assign.isPending) return;
      try {
        await assign.mutateAsync({ depositId: assignId, clientUserId: client.user_id });
      } catch {
        return; // le hook a dit le refus ; la liste reste là
      }
      toast.success(t('rc_assigned'), {
        description: clientFullName(client),
        action: flow.fromDeposit ? undefined : { label: t('rc_see_deposit'), onClick: () => navigate(`/r/deposit/${assignId}`) },
      });
      flow.leave(); // ne part pas si l'écran a été quitté pendant l'envoi
      return;
    }
    navigate(`/r/new/how?client=${client.user_id}&name=${encodeURIComponent(clientFullName(client))}&code=${client.customer_code}`, { replace: true });
  };

  const results = search.data ?? [];
  const searching = debounced.trim().length >= 2;

  return (
    <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
      <MobileHeader title={assignId ? t('rc_assign') : t('rc_new_deposit')} showBack onBack={() => navigate(`/r/new${qs}`, { replace: true })} />
      <div className="flex-1 space-y-5 px-5 pb-10 pt-4">
        {!assignId && <StepHeader step={1} total={4} title={t('rc_search_title')} help={t('rc_search_help')} />}
        <div className="relative">
          <Search className={cn('pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2', TEXT.muted)} />
          <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('rc_search_clients_ph')} className="h-14 pl-12 text-[17px]" autoComplete="off" inputMode="search" autoFocus aria-label={t('rc_search_clients_ph')} />
        </div>

        {searching && (
          <Card className="py-0">
            {search.isLoading ? (
              <p className={cn('py-5 text-center', TYPE.body, TEXT.muted)}>…</p>
            ) : search.isError ? (
              <div className="space-y-3 py-5 text-center">
                <p className={cn(TYPE.body, TEXT.muted)}>{(search.error as Error).message}</p>
                <Button variant="neutral" className="h-11 px-4" onClick={() => void search.refetch()}>{t('rc_retry')}</Button>
              </div>
            ) : results.length === 0 ? (
              <p className={cn('py-5 text-center', TYPE.body, TEXT.muted)}>{t('rc_no_result')}</p>
            ) : (
              results.map((c) => {
                const name = clientFullName(c);
                return (
                  <button key={c.user_id} type="button" onClick={() => void pick(c)} disabled={assign.isPending} className={cn('flex w-full items-center gap-3 border-b py-4 text-left last:border-b-0 active:bg-[#F5F5F5] dark:active:bg-[#383838]', SURFACE.divider)}>
                    <Holder size="lg">{initials(name)}</Holder>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block break-words', TYPE.bodyStrong, TEXT.strong)}>{name}</span>
                      <span className={cn('mt-0.5 block tabular-nums', TYPE.small, TEXT.muted)}>{[c.customer_code, c.phone, c.city].filter(Boolean).join(' · ')}</span>
                    </span>
                    <ChevronRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
                  </button>
                );
              })
            )}
          </Card>
        )}

        <Button variant="neutral" className="h-14 w-full text-[17px]" onClick={() => navigate(`/r/new/client${qs}`, { replace: true })}>
          <UserPlus /> {t('rc_new_client')}
        </Button>
      </div>
    </div>
  );
}

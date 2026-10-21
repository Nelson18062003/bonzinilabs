/**
 * Statistiques des messages — refonte v2 (maquette 10/59). 7, 14 ou 30 jours ;
 * le temps de réponse en gros, trois compteurs, le volume par jour (client à
 * l'encre, Bonzini en gris), les délais de réponse, qui répond le plus.
 * Même RPC qu'avant : get_chat_admin_stats (useChatAdminStats).
 */
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useChatAdminStats } from '@/hooks/useAdminChatTools';
import { cn } from '@/lib/utils';
import {
  BoxSegmented, EmptyLine, Initials, ItemList, ItemRow, ScreenLoader, ScreenTop, SectionHead, ShareRow, SURFACE, TEXT,
} from '@/mobile/designKit';
import { CapsLabel, SquareLegend, StackedBars } from '@/mobile/screens/more/parts';

type Period = '7' | '14' | '30';

/** 372 s → « 6 min » ; 40 s → « 40 s ». */
function minutes(sec: number | null | undefined): { value: string; unit: string } {
  const s = Math.max(0, Math.round(sec ?? 0));
  if (s < 60) return { value: String(s), unit: 's' };
  if (s < 3600) return { value: String(Math.round(s / 60)), unit: 'min' };
  return { value: (s / 3600).toLocaleString('fr-FR', { maximumFractionDigits: 1 }), unit: 'h' };
}
/** Milliers séparés d'une espace insécable (l'espace fine ne s'affiche pas en DM Sans). */
const nb = (n: number) => n.toLocaleString('fr-FR').replace(/\u202F/g, '\u00A0');
const mm = (sec: number | null | undefined) => { const m = minutes(sec); return `${m.value} ${m.unit}`; };

export function SupportStatsV2() {
  const { hasPermission } = useAdminAuth();
  const [period, setPeriod] = useState<Period>('7');
  const { data: s, isLoading, isError, refetch } = useChatAdminStats(Number(period));

  if (!hasPermission('canAccessSupportChat')) {
    return (
      <div className="flex min-h-full flex-col">
        <ScreenTop title="Statistiques" backTo="/m/more" />
        <EmptyLine>Réservé à l'équipe des messages.</EmptyLine>
      </div>
    );
  }

  const avg = minutes(s?.avg_response_seconds_global);
  const days = (s?.daily_volume ?? []).map((d) => ({
    label: format(parseISO(d.day), Number(period) > 7 ? 'd' : 'EEE', { locale: fr }).replace('.', ''),
    a: d.client_count,
    b: d.admin_count,
  }));
  const buckets = s?.response_buckets;
  const bucketTotal = buckets ? buckets.under_1min + buckets.one_to_five + buckets.five_to_fifteen + buckets.over_fifteen : 0;
  const who = [...(s?.per_admin ?? [])].sort((a, b) => b.replies_count - a.replies_count);

  return (
    <div className="flex min-h-full flex-col pb-8">
      <ScreenTop title="Statistiques" backTo="/m/support" />
      <div className="px-5 pt-5">
        <BoxSegmented<Period>
          ariaLabel="Période"
          value={period}
          onChange={setPeriod}
          options={[{ value: '7', label: '7 j' }, { value: '14', label: '14 j' }, { value: '30', label: '30 j' }]}
        />
      </div>

      {isError ? (
        <EmptyLine action={{ label: 'Réessayer', onClick: () => void refetch() }}>Les statistiques n'ont pas pu être chargées.</EmptyLine>
      ) : isLoading || !s ? (
        <ScreenLoader />
      ) : (
        <>
          <div className="px-5 pt-4">
            <div className={cn('rounded-lg border px-[18px] pb-4 pt-[18px]', SURFACE.divider)}>
              <div className={cn('text-[17px] font-medium', TEXT.muted)}>Temps de réponse moyen</div>
              <div className={cn('mt-1.5 text-[48px] font-bold leading-none tracking-[-0.02em] tabular-nums', TEXT.strong)}>
                {s.avg_response_seconds_global > 0 ? avg.value : '—'}
                {s.avg_response_seconds_global > 0 && <span className={cn('ml-2 text-[22px] font-semibold', TEXT.muted)}>{avg.unit}</span>}
              </div>
              {s.median_response_seconds_global > 0 && (
                <div className={cn('mt-3 text-[17px]', TEXT.body)}>Médian <b className="font-bold">{mm(s.median_response_seconds_global)}</b></div>
              )}
            </div>
          </div>

          <div className="px-5 pt-3">
            <div className={cn('grid grid-cols-3 overflow-hidden rounded-lg border', SURFACE.divider)}>
              {[
                { label: 'Ouvertes', value: s.open_conversations },
                { label: 'Messages', value: s.total_messages },
                { label: 'À prendre', value: s.unassigned_open },
              ].map((k, i) => (
                <div key={k.label} className={cn('px-3.5 py-3', i > 0 && cn('border-l', SURFACE.divider))}>
                  <div className={cn('truncate text-[16px]', TEXT.muted)}>{k.label}</div>
                  <div className={cn('mt-0.5 text-[24px] font-bold tabular-nums', TEXT.strong)}>{nb(k.value ?? 0)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="px-5 pt-6">
            <CapsLabel>Volume quotidien</CapsLabel>
            <StackedBars data={days} className="mt-3" ariaLabel="Messages par jour" />
            <SquareLegend items={[{ label: 'Client', tone: 'ink' }, { label: 'Bonzini', tone: 'grey' }]} />
          </div>

          {buckets && bucketTotal > 0 && (
            <>
              <SectionHead title="Délai de réponse" />
              <ItemList>
                {[
                  { label: 'Moins d’1 min', n: buckets.under_1min },
                  { label: '1 à 5 min', n: buckets.one_to_five },
                  { label: '5 à 15 min', n: buckets.five_to_fifteen },
                  { label: 'Plus de 15 min', n: buckets.over_fifteen },
                ].map((b) => (
                  <ShareRow key={b.label} title={b.label} value={nb(b.n)} share={b.n / bucketTotal} />
                ))}
              </ItemList>
            </>
          )}

          <SectionHead title="Qui répond le plus" />
          {who.length === 0 ? (
            <EmptyLine>Aucune réponse sur la période.</EmptyLine>
          ) : (
            <ItemList>
              {who.map((a) => {
                const name = `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || 'Admin';
                return (
                  <ItemRow
                    key={a.admin_user_id}
                    leading={<Initials name={name} size={52} />}
                    title={name}
                    subtitle={`Moyenne ${mm(a.avg_response_seconds)}`}
                    right={
                      <span className="shrink-0 text-right">
                        <span className={cn('block text-[18px] font-bold tabular-nums', TEXT.strong)}>{nb(a.replies_count)}</span>
                        <span className={cn('block text-[16px]', TEXT.muted)}>réponses</span>
                      </span>
                    }
                  />
                );
              })}
            </ItemList>
          )}
        </>
      )}
    </div>
  );
}

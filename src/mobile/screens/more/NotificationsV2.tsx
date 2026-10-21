/**
 * Notifications — refonte v2 (maquettes 01/08 et 01/09). Groupées par jour ;
 * chaque ligne mène à sa fiche. « … » : Tout marquer comme lu, Seulement les
 * miennes, Choisir ce que je reçois (écran natif Moi, dans l'app).
 *
 * Le fil reste dérivé en direct (useAdminNotifications) : il n'existe pas
 * d'état lu/non-lu côté serveur. « Tout marquer comme lu » retient donc
 * l'heure sur CE téléphone (localStorage) ; les lignes plus récentes portent
 * un point. « Seulement les miennes » garde ce que le rôle traite lui-même.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowDownToLine, ArrowUpFromLine, CheckCheck, Clock, ListFilter, Ship, SlidersHorizontal, UserSearch } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAdminNotifications, type AdminNotification, type AdminNotificationType } from '@/hooks/useAdminNotifications';
import { formatXAF } from '@/lib/formatters';
import { isNativeApp } from '@/lib/nativeApp';
import { postToApp } from '@/lib/nativeBridge';
import { PullToRefresh } from '@/mobile/components/ui/PullToRefresh';
import {
  ActionSheet, DayLabel, EmptyLine, IconCircle, ItemList, ItemRow, MoreButton, ScreenLoader, ScreenTop, useSheet, type Tone,
} from '@/mobile/designKit';

const SEEN_KEY = 'bz.staffNotifications.seenAt';
const readSeen = () => { try { return Number(localStorage.getItem(SEEN_KEY) ?? 0) || 0; } catch { return 0; } };
const writeSeen = (t: number) => { try { localStorage.setItem(SEEN_KEY, String(t)); } catch { /* navigation privée */ } };

const TYPE: Record<AdminNotificationType, { icon: React.ElementType; tag: { tone: Tone; label: string }; title: string }> = {
  deposit_needs_review: { icon: ArrowDownToLine, tag: { tone: 'pending', label: 'À valider' }, title: 'Dépôt à valider' },
  deposit_needs_correction: { icon: ArrowDownToLine, tag: { tone: 'pending', label: 'À corriger' }, title: 'Dépôt à corriger' },
  payment_ready: { icon: ArrowUpFromLine, tag: { tone: 'pending', label: 'À payer' }, title: 'Paiement à faire' },
  payment_processing: { icon: Clock, tag: { tone: 'neutral', label: 'En cours' }, title: 'Paiement en cours' },
  cargo_late: { icon: Ship, tag: { tone: 'danger', label: 'En retard' }, title: 'Conteneur en retard' },
  cargo_arriving: { icon: Ship, tag: { tone: 'pending', label: 'Arrive' }, title: 'Conteneur bientôt là' },
  prospect_to_verify: { icon: UserSearch, tag: { tone: 'pending', label: 'À vérifier' }, title: 'Prospect à vérifier' },
};

function dayOf(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return "Aujourd'hui";
  if (isYesterday(d)) return 'Hier';
  return format(d, 'd MMMM', { locale: fr });
}

export function NotificationsV2() {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const { data, isLoading, isError, refetch } = useAdminNotifications();
  const more = useSheet();
  const [seenAt, setSeenAt] = useState(readSeen);
  const [mine, setMine] = useState(false);

  // « Les miennes » : ce que ce rôle traite lui-même.
  const canDep = hasPermission('canProcessDeposits');
  const canPay = hasPermission('canProcessPayments');
  const canCargo = hasPermission('canManageCargo');
  const canSales = hasPermission('canManageSales');
  const list = useMemo(() => (data ?? []).filter((n) => {
    if (!mine) return true;
    if (n.type.startsWith('deposit')) return canDep;
    if (n.type.startsWith('payment')) return canPay;
    if (n.type.startsWith('cargo')) return canCargo;
    return canSales;
  }), [data, mine, canDep, canPay, canCargo, canSales]);
  const groups = useMemo(() => {
    const out: { day: string; items: AdminNotification[] }[] = [];
    for (const n of list) {
      const d = dayOf(n.createdAt);
      const g = out.find((x) => x.day === d);
      if (g) g.items.push(n); else out.push({ day: d, items: [n] });
    }
    return out;
  }, [list]);

  const markAll = () => { const t = Date.now(); writeSeen(t); setSeenAt(t); };
  /** « Samuel Nkoulou — BZ-DP-… » → « Samuel Nkoulou · 10:42 ». */
  const sub = (n: AdminNotification) => [n.subtitle.split(' — ')[0], format(new Date(n.createdAt), 'HH:mm')].filter(Boolean).join(' · ');

  return (
    <div className="flex min-h-full flex-col">
      <ScreenTop title="Notifications" right={<MoreButton onClick={more.show} />} />
      <PullToRefresh onRefresh={refetch} className="flex-1 pb-8">
        {isLoading ? (
          <ScreenLoader />
        ) : isError ? (
          <EmptyLine action={{ label: 'Réessayer', onClick: () => void refetch() }}>Les notifications n'ont pas pu être chargées.</EmptyLine>
        ) : groups.length === 0 ? (
          <EmptyLine>Tout est à jour.</EmptyLine>
        ) : (
          groups.map((g) => (
            <div key={g.day}>
              <DayLabel>{g.day}</DayLabel>
              <ItemList>
                {g.items.map((n) => {
                  const meta = TYPE[n.type];
                  const fresh = new Date(n.createdAt).getTime() > seenAt;
                  return (
                    <ItemRow
                      key={n.id}
                      leading={
                        <span className="relative">
                          <IconCircle icon={meta.icon} />
                          {fresh && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-[#EC221F] dark:border-[#1E1E1E]" aria-label="Nouveau" />}
                        </span>
                      }
                      title={n.type.startsWith('cargo') || n.type === 'prospect_to_verify' ? n.title : meta.title}
                      subtitle={n.type.startsWith('cargo') ? n.subtitle : sub(n)}
                      amount={n.amount != null ? formatXAF(n.amount) : undefined}
                      tag={meta.tag}
                      onClick={() => navigate(n.targetPath)}
                    />
                  );
                })}
              </ItemList>
            </div>
          ))
        )}
      </PullToRefresh>
      <ActionSheet
        open={more.open}
        onClose={more.hide}
        actions={[
          { label: 'Tout marquer comme lu', icon: CheckCheck, onClick: markAll },
          { label: mine ? 'Toutes les notifications' : 'Seulement les miennes', icon: ListFilter, onClick: () => setMine(!mine) },
          { label: 'Choisir ce que je reçois', icon: SlidersHorizontal, onClick: () => postToApp({ type: 'open-me' }), hidden: !isNativeApp() },
        ]}
      />
    </div>
  );
}


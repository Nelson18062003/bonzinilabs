// ============================================================
// Veille douane — /douane/veille (public) et /m/douane/veille (équipe).
// Le « regulatory watch » et la « disruptions layer » de Flexport : ce qui
// change dans les textes, ce qui retarde la marchandise. Le client voit ce
// qui concerne SES produits classés ; l'équipe publie, et voit les
// conteneurs touchés par chaque perturbation.
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Archive, ChevronRight, Container, PenLine, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { BottomSheet, Button, Card, Line, ScreenError, ScreenLoader, Segmented, SURFACE, TEXT, TYPE } from '@/mobile/designKit';
import { formatHs } from '@/lib/customs/hsCode';
import { affectedShipments, noticesForCodes, phaseOf, sortNotices, type Notice, type NoticeKind } from '@/lib/customs/notices';
import { toShipmentLike } from '@/lib/cargo/disruptions';
import { useCustomsNotices } from '@/hooks/useCustomsNotices';
import { useAdminNotices, useArchiveNotice } from '@/hooks/useCustomsReview';
import { useMyCustomsFiles } from '@/hooks/useCustomsFiles';
import { useCargoShipments } from '@/hooks/useCargo';
import { CustomsShell, type CustomsVariant } from './shared';
import { NoticeCard } from './components/NoticeCard';
import { NoticeEditor } from './components/NoticeEditor';
import { NewsPage } from './site/NewsPage';

const shortDate = (d: Date | null) => (d ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '—');

/** Le client lit les actualités sur le site ; l'équipe publie ici. */
export function NoticesPage({ variant = 'client', desktop = false }: { variant?: CustomsVariant; desktop?: boolean } = {}) {
  if (variant === 'client') return <NewsPage />;
  return <StaffNoticesPage variant={variant} desktop={desktop} />;
}

function StaffNoticesPage({ variant, desktop }: { variant: CustomsVariant; desktop: boolean }) {
  const { t } = useTranslation('customs');
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = variant === 'admin';
  const { user } = useAuth();
  const { hasPermission } = useAdminAuth();
  const canManage = isAdmin && hasPermission('canManageCustoms');
  const canCargo = isAdmin && hasPermission('canViewCargo');

  // Espace équipe : supabaseAdmin seulement (.claude/rules/supabase-clients.md).
  const pub = useCustomsNotices(!isAdmin);
  const adm = useAdminNotices(isAdmin);
  const q = isAdmin ? adm : pub;
  const files = useMyCustomsFiles(!isAdmin && !!user);
  const cargo = useCargoShipments({ enabled: canCargo });
  const archive = useArchiveNotice();

  const [tab, setTab] = useState<NoticeKind | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [editing, setEditing] = useState<Notice | 'new' | null>(null);
  const [archiving, setArchiving] = useState<Notice | null>(null);

  const all = useMemo(() => sortNotices((q.data ?? []).filter((n) => isAdmin || n.published)), [q.data, isAdmin]);
  const hotDisruption = all.some((n) => n.kind === 'disruption' && n.published && (phaseOf(n) === 'ongoing' || phaseOf(n) === 'upcoming'));
  const hash = decodeURIComponent(location.hash.replace('#', ''));
  const linked = all.find((n) => n.slug === hash);
  const current: NoticeKind = tab ?? linked?.kind ?? (hotDisruption ? 'disruption' : 'regulation');

  // Un lien vers un avis (notification, simulateur) l'amène à l'écran.
  useEffect(() => {
    if (!linked) return;
    if (phaseOf(linked) === 'past') setShowPast(true);
    const timer = window.setTimeout(() => document.getElementById(linked.slug)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    return () => window.clearTimeout(timer);
  }, [linked]);

  // Ce qui concerne les produits du client : ses fiches classées.
  const mine = useMemo(() => {
    const list = files.data?.classifications ?? [];
    const codes = list.map((c) => c.final_code ?? c.proposed_code);
    return noticesForCodes(all.filter((n) => n.published && phaseOf(n) !== 'past'), codes).map((hit) => ({
      ...hit,
      products: list.filter((c) => hit.codes.some((code) => (c.final_code ?? c.proposed_code ?? '').startsWith(code.slice(0, 6)))).map((c) => c.product_name),
    }));
  }, [files.data, all]);

  const shipments = useMemo(() => (cargo.data ?? []).map(toShipmentLike), [cargo.data]);
  const inTab = all.filter((n) => n.kind === current);
  const visible = inTab.filter((n) => showPast || phaseOf(n) !== 'past');
  const pastCount = inTab.length - inTab.filter((n) => phaseOf(n) !== 'past').length;
  const count = (k: NoticeKind) => all.filter((n) => n.kind === k && phaseOf(n) !== 'past').length;

  const go = (n: Notice) => { setTab(n.kind); navigate({ hash: n.slug }, { replace: true }); };

  return (
    <CustomsShell
      title={t('watch.title', { defaultValue: 'Veille douane' })}
      subtitle={t('watch.subtitle', { defaultValue: 'Ce qui change, ce qui retarde' })}
      backTo={isAdmin ? '/m/douane' : '/douane'}
      variant={variant}
      desktop={desktop}
    >
      <div className="mx-auto max-w-2xl space-y-5 px-4 pb-12 pt-3">
        {mine.length > 0 && (
          <Card className="space-y-3 p-4">
            <p className={cn(TYPE.bodyStrong, TEXT.strong)}>{t('watch.forYou', { count: mine.length, defaultValue: `${mine.length} avis concernent vos produits` })}</p>
            <ul className="space-y-1">
              {mine.map((m) => (
                <li key={m.notice.id}>
                  <button type="button" onClick={() => go(m.notice)} className={cn('flex w-full min-h-11 items-center gap-3 rounded-lg py-2 text-left', 'active:bg-[#F5F5F5] dark:active:bg-[#383838]')}>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block', TYPE.bodyStrong, TEXT.strong)}>{m.notice.title}</span>
                      <span className={cn('block', TYPE.small, TEXT.muted)}>{m.products.slice(0, 3).join(' · ')} · {m.codes.slice(0, 3).map(formatHs).join(', ')}</span>
                    </span>
                    <ChevronRight aria-hidden className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {canManage && (
          <Button className="w-full" onClick={() => setEditing('new')}><Plus aria-hidden /> {t('watch.new', { defaultValue: 'Publier un avis' })}</Button>
        )}

        <Segmented<NoticeKind> value={current} onChange={(k) => { setTab(k); setShowPast(false); }} options={[
          { value: 'regulation', label: t('watch.tabs.regulation', { defaultValue: 'Réglementation' }), count: count('regulation') },
          { value: 'disruption', label: t('watch.tabs.disruption', { defaultValue: 'Perturbations' }), count: count('disruption') },
        ]} />

        {q.isLoading ? <ScreenLoader className="min-h-0 py-10" />
          : q.isError ? <ScreenError className="min-h-0 py-6" description={(q.error as Error).message} onRetry={() => q.refetch()} />
          : visible.length === 0 ? (
            <Line className={TEXT.muted}>
              {current === 'disruption'
                ? t('watch.noDisruption', { defaultValue: 'Aucune perturbation signalée en ce moment.' })
                : t('watch.noRegulation', { defaultValue: 'Aucun avis réglementaire.' })}
            </Line>
          ) : (
            <div className="space-y-3">
              {visible.map((n) => {
                const hits = canCargo && n.kind === 'disruption' ? affectedShipments(n, shipments) : [];
                const codes = mine.find((m) => m.notice.id === n.id)?.codes;
                return (
                  <NoticeCard key={n.id} n={n} matchedCodes={codes} draft={!n.published} footer={(hits.length > 0 || canManage) && (
                    <div className="space-y-3">
                      {hits.length > 0 && (
                        <div className={cn('rounded-lg p-3', SURFACE.inset)}>
                          <p className={cn('mb-1 flex items-center gap-2', TYPE.bodyStrong, TEXT.strong)}>
                            <Container aria-hidden className="h-4 w-4" />
                            {t('watch.containers', { count: hits.length, defaultValue: `${hits.length} conteneur(s) concerné(s)` })}
                          </p>
                          <ul>
                            {hits.slice(0, 8).map(({ shipment: s, where }) => (
                              <li key={s.id}>
                                <button type="button" onClick={() => navigate(`/m/cargo/${s.id}`)} className="flex min-h-11 w-full items-center justify-between gap-3 text-left">
                                  <span className="min-w-0">
                                    <span className={cn('block truncate', TYPE.body, TEXT.strong)}>{s.client_label} · {s.container_number}</span>
                                    <span className={cn('block', TYPE.small, TEXT.muted)}>
                                      {where === 'origin'
                                        ? t('watch.departs', { date: shortDate(s.etd), defaultValue: `départ ${shortDate(s.etd)}` })
                                        : t('watch.arrives', { date: shortDate(s.eta), defaultValue: `arrivée ${shortDate(s.eta)}` })}
                                    </span>
                                  </span>
                                  <ChevronRight aria-hidden className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {canManage && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="neutral" onClick={() => setEditing(n)}><PenLine aria-hidden /> {t('watch.edit.action', { defaultValue: 'Corriger' })}</Button>
                          {n.published && <Button size="sm" variant="dangerSubtle" onClick={() => setArchiving(n)}><Archive aria-hidden /> {t('watch.archive', { defaultValue: 'Retirer' })}</Button>}
                        </div>
                      )}
                    </div>
                  )} />
                );
              })}
            </div>
          )}

        {pastCount > 0 && (
          <Button variant="subtle" className="w-full" onClick={() => setShowPast(!showPast)}>
            {showPast ? t('watch.hidePast', { defaultValue: 'Masquer les avis terminés' }) : t('watch.showPast', { count: pastCount, defaultValue: `Voir les avis terminés (${pastCount})` })}
          </Button>
        )}

        <p className={cn(TYPE.small, TEXT.faint)}>
          {t('watch.footer', { defaultValue: 'Chaque avis dit sa source et sa confiance. Une perturbation n’est publiée que lorsqu’elle est constatée ou inscrite au calendrier.' })}
        </p>
      </div>

      {canManage && <NoticeEditor open={editing !== null} onClose={() => setEditing(null)} notice={editing === 'new' ? null : editing} />}
      <BottomSheet open={archiving !== null} onClose={() => setArchiving(null)} title={t('watch.archiveTitle', { defaultValue: 'Retirer cet avis ?' })}>
        <div className="space-y-4">
          <Line>{t('watch.archiveText', { defaultValue: 'Il disparaît de la veille publique. Vous pourrez le republier en le corrigeant.' })}</Line>
          <Button variant="danger" className="w-full" loading={archive.isPending} onClick={() => archiving && archive.mutate(archiving.id, {
            onSuccess: () => { setArchiving(null); toast.success(t('watch.archived', { defaultValue: 'Avis retiré' })); },
            onError: (e) => toast.error((e as Error).message),
          })}>{t('watch.archive', { defaultValue: 'Retirer' })}</Button>
          <Button variant="subtle" className="w-full" onClick={() => setArchiving(null)}>{t('files.keep', { defaultValue: 'Pas maintenant' })}</Button>
        </div>
      </BottomSheet>
    </CustomsShell>
  );
}

export default NoticesPage;

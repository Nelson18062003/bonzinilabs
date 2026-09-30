// ============================================================
// /douane/espace — l'espace douane du client connecté.
// Deux choses, dans cet ordre : ce qu'il doit faire maintenant, puis ses
// dossiers (produits classés, déclarations, fournisseurs).
// ============================================================
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, ChevronRight, FileSearch, ScanLine, Users, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { customsTasks, type Urgency } from '@/lib/customs/tasks';
import { useMyCustomsFiles } from '@/hooks/useCustomsFiles';
import { useMyInvites } from '@/hooks/useCustomsInvites';
import { useCustomsNotices } from '@/hooks/useCustomsNotices';
import { useTaskText } from '../useCustomsText';
import { SiteLayout } from './SiteLayout';
import { Container, PageIntro, Reveal } from './ui';

const URGENCY: Record<Urgency, { dot: string; key: string }> = {
  now: { dot: 'bg-dz-orange', key: 'now' },
  soon: { dot: 'bg-dz-brand', key: 'soon' },
  later: { dot: 'bg-dz-ink3/40', key: 'later' },
};

export function MySpacePage() {
  const { t } = useTranslation('customs');
  const text = useTaskText();
  const files = useMyCustomsFiles(true);
  const invites = useMyInvites(true);
  const notices = useCustomsNotices(true);
  const tasks = useMemo(() => customsTasks({
    classifications: files.data?.classifications, audits: files.data?.audits, invites: invites.data, notices: notices.data,
  }), [files.data, invites.data, notices.data]);
  const loading = files.isLoading || invites.isLoading;

  const dossiers: { key: string; to: string; icon: LucideIcon; count: number | null }[] = [
    { key: 'classify', to: '/douane/classer', icon: FileSearch, count: files.data?.classifications?.length ?? null },
    { key: 'audit', to: '/douane/audit', icon: ScanLine, count: files.data?.audits?.length ?? null },
    { key: 'suppliers', to: '/douane/fournisseurs', icon: Users, count: invites.data?.length ?? null },
  ];

  return (
    <SiteLayout>
      <PageIntro title={t('site.space.title')} subtitle={t('site.space.subtitle')} back={{ to: '/douane', label: t('site.badge') }} />
      <Container className="grid gap-10 pb-20 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12">
        <section aria-labelledby="dz-todo">
          <h2 id="dz-todo" className="flex items-baseline gap-2 text-[22px] font-bold tracking-[-0.01em]">
            {t('site.space.todo')}
            {tasks.length > 0 && <span className="text-[17px] font-semibold tabular-nums text-dz-ink3">{tasks.length}</span>}
          </h2>
          {loading ? (
            <div className="mt-4 space-y-2" aria-hidden>
              {[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-dz-soft" />)}
            </div>
          ) : tasks.length === 0 ? (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-dz-line bg-dz-card p-5">
              <CheckCircle2 aria-hidden className="h-6 w-6 shrink-0 text-dz-good" />
              <p className="text-[16px] text-dz-ink2">{t('site.space.nothing')}</p>
            </div>
          ) : (
            <ul className="mt-4 overflow-hidden rounded-2xl border border-dz-line bg-dz-card">
              {tasks.map((task, i) => (
                <Reveal as="li" key={task.id} delay={Math.min(i, 6) * 0.04} y={8} className="border-b border-dz-line last:border-b-0">
                  <Link to={task.path} className="flex min-h-[64px] items-center gap-4 px-4 py-3.5 transition-colors hover:bg-dz-soft sm:px-5">
                    {/* Téléphone : l'urgence au-dessus du texte, qui garde toute la largeur. Au-delà : une colonne. */}
                    <span className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                      <span className="flex shrink-0 items-center gap-2 whitespace-nowrap text-[13px] font-semibold uppercase tracking-[0.08em] text-dz-ink3 sm:w-24">
                        <span aria-hidden className={cn('h-2 w-2 rounded-full', URGENCY[task.urgency].dot)} />
                        {t(`site.space.urgency.${URGENCY[task.urgency].key}`)}
                      </span>
                      <span className="min-w-0 flex-1 text-[16px] leading-snug text-dz-ink">{text(task)}</span>
                    </span>
                    <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-dz-ink3" />
                  </Link>
                </Reveal>
              ))}
            </ul>
          )}
        </section>

        <aside aria-labelledby="dz-files">
          <h2 id="dz-files" className="text-[22px] font-bold tracking-[-0.01em]">{t('site.space.files')}</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {dossiers.map((d, i) => (
              <Reveal as="li" key={d.key} delay={0.05 * i}>
                <Link to={d.to} className="flex items-center gap-4 rounded-2xl border border-dz-line bg-dz-card p-4 transition-colors hover:border-dz-ink/20">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-dz-brand-soft text-dz-brand"><d.icon aria-hidden className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-semibold text-dz-ink">{t(`site.space.dossier.${d.key}`)}</span>
                    <span className="block text-[14px] text-dz-ink3">
                      {d.count == null ? '…' : t('site.space.count', { count: d.count })}
                    </span>
                  </span>
                  <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-dz-ink3" />
                </Link>
              </Reveal>
            ))}
          </ul>
        </aside>
      </Container>
    </SiteLayout>
  );
}

export default MySpacePage;

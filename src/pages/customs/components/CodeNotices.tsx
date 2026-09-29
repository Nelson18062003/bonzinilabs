/**
 * La veille dans le simulateur : les avis qui visent le code choisi (TEC 2026,
 * accises, taxe environnementale…), en lien vers la page de veille.
 */
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BellRing, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, TEXT, TYPE } from '@/mobile/designKit';
import { noticeMatchesCode, phaseOf, type Notice } from '@/lib/customs/notices';
import { useCustomsNotices } from '@/hooks/useCustomsNotices';
import { useAdminNotices } from '@/hooks/useCustomsReview';
import type { CustomsVariant } from '../shared';

export function CodeNotices({ code, variant }: { code: string; variant: CustomsVariant }) {
  const { t } = useTranslation('customs');
  const navigate = useNavigate();
  // Chaque espace avec sa session : public/client d'un côté, équipe de l'autre.
  const pub = useCustomsNotices(variant === 'client');
  const adm = useAdminNotices(variant === 'admin');
  const list: Notice[] = (variant === 'admin' ? adm.data : pub.data) ?? [];
  const hits = list.filter((n) => n.published && n.kind === 'regulation' && phaseOf(n) !== 'past' && noticeMatchesCode(n, code));
  if (!hits.length) return null;
  const base = variant === 'admin' ? '/m/douane/veille' : '/douane/veille';

  return (
    <Card className="space-y-2 p-4">
      <p className={cn('flex items-center gap-2', TYPE.bodyStrong, TEXT.strong)}>
        <BellRing aria-hidden className="h-5 w-5" /> {t('watch.onCode', { count: hits.length, defaultValue: `Veille : ${hits.length} avis concerne(nt) ce code` })}
      </p>
      <ul>
        {hits.map((n) => (
          <li key={n.id}>
            <button type="button" onClick={() => navigate(`${base}#${n.slug}`)} className="flex min-h-11 w-full items-center gap-3 py-1.5 text-left">
              <span className={cn('min-w-0 flex-1', TYPE.body, TEXT.body)}>{n.title}</span>
              <ChevronRight aria-hidden className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

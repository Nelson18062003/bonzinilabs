/**
 * « À faire » — la boîte d'actions douane du client, en tête de l'accueil
 * Douane. Chaque tâche mène à l'écran où elle se fait.
 */
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionTitle, SURFACE, TEXT, TYPE } from '@/mobile/designKit';
import type { CustomsTask, Urgency } from '@/lib/customs/tasks';
import { useTaskText } from '../useCustomsText';

const DOT: Record<Urgency, string> = { now: 'bg-[#E8B931]', soon: 'bg-[#2C6ECB]', later: 'bg-[#B3B3B3] dark:bg-[#757575]' };

export function TaskList({ tasks }: { tasks: CustomsTask[] }) {
  const { t } = useTranslation('customs');
  const navigate = useNavigate();
  const text = useTaskText();
  if (!tasks.length) return null;
  return (
    <section>
      <SectionTitle>
        {t('tasks.title', { defaultValue: 'À faire' })}
        <span className={cn('ml-2 tabular-nums', TEXT.muted)}>{tasks.length}</span>
      </SectionTitle>
      <ul className={cn('rounded-lg px-4', SURFACE.card, SURFACE.shadow)}>
        {tasks.slice(0, 8).map((task) => (
          <li key={task.id} className={cn('border-b last:border-b-0', SURFACE.divider)}>
            <button type="button" onClick={() => navigate(task.path)} className="flex min-h-[56px] w-full items-center gap-3 py-3 text-left">
              <span aria-hidden className={cn('h-2.5 w-2.5 shrink-0 rounded-full', DOT[task.urgency])} />
              <span className={cn('min-w-0 flex-1', TYPE.body, TEXT.strong)}>{text(task)}</span>
              <ChevronRight aria-hidden className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, MessageSquare, Users, Timer, Inbox } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { MobileFilterChips } from '@/mobile/components/ui/MobileFilterChips';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useChatAdminStats } from '@/hooks/useAdminChatTools';
import { formatDuration } from '@/lib/voice-recording';
import { cn } from '@/lib/utils';

type Period = 7 | 14 | 30;

export function MobileSupportStatsScreen() {
  const { t } = useTranslation('support');
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const canAccess = hasPermission('canAccessSupportChat');
  const [period, setPeriod] = useState<Period>(7);
  const { data: stats, isLoading } = useChatAdminStats(period);

  if (!canAccess) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Vous n'avez pas accès au support chat.
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background">
      <MobileHeader
        title={t('admin.statsTitle')}
        showBack
        onBack={() => navigate('/m/support')}
      />

      <div className="px-4 py-3 border-b border-border">
        <MobileFilterChips<Period>
          filters={[
            { value: 7, label: t('admin.statsPeriod7d') },
            { value: 14, label: t('admin.statsPeriod14d') },
            { value: 30, label: t('admin.statsPeriod30d') },
          ]}
          activeKey={period}
          onChange={setPeriod}
        />
      </div>

      {isLoading || !stats ? (
        <div className="flex flex-1 items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={Inbox}
              label={t('admin.statsOpenConvs')}
              value={String(stats.open_conversations)}
              tone="violet"
            />
            <StatCard
              icon={MessageSquare}
              label={t('admin.statsTotalMessages')}
              value={String(stats.total_messages)}
              tone="amber"
            />
            <StatCard
              icon={Users}
              label={t('admin.statsUnassigned')}
              value={String(stats.unassigned_open)}
              tone="orange"
            />
            <StatCard
              icon={Timer}
              label={t('admin.statsAvgResponse')}
              value={stats.avg_response_seconds_global > 0 ? formatDuration(stats.avg_response_seconds_global) : '—'}
              tone="violet"
            />
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">{t('admin.statsPerAdmin')}</h3>
            {stats.per_admin.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                {t('admin.statsNoData')}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {stats.per_admin.map((a) => {
                  const name = `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || 'Admin';
                  return (
                    <li key={a.admin_user_id} className="flex items-center justify-between py-2.5">
                      <div>
                        <p className="text-sm font-medium">{name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {a.replies_count} {t('admin.statsReplies')}
                        </p>
                      </div>
                      <span className="text-xs font-mono text-bonzini-violet">
                        ⏱ {formatDuration(a.avg_response_seconds || 0)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <p>
              <strong>{t('admin.statsLegendTitle')}</strong> — {t('admin.statsLegend')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  tone: 'violet' | 'amber' | 'orange';
}
function StatCard({ icon: Icon, label, value, tone }: StatCardProps) {
  const colors = {
    violet: 'bg-bonzini-violet/10 text-bonzini-violet',
    amber: 'bg-bonzini-amber/10 text-bonzini-amber',
    orange: 'bg-bonzini-orange/10 text-bonzini-orange',
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className={cn('mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full', colors[tone])}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

/**
 * Desktop admin — "Plus" / tools hub.
 *
 * A desktop launcher that mirrors the mobile More screen: a profile card plus a
 * grouped, multi-column grid of every secondary tool (assistant, treasury,
 * rates, proofs, history, notifications, briefs, support templates, admins,
 * settings…), permission-gated exactly like the routes it opens. It complements
 * the sidebar (which carries the primary nav) and surfaces the modules that have
 * no dedicated sidebar entry. Logout / theme / language live in the sidebar and
 * Settings on desktop, so they are not repeated here.
 */
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  FileText,
  History,
  Bell,
  UserCog,
  BarChart3,
  Bot,
  ChevronRight,
  Settings,
  Coins,
  MessageCircle,
  MessageSquareQuote,
  Sparkles,
  Newspaper,
} from 'lucide-react';
import { useAdminAuth, type RolePermission } from '@/contexts/AdminAuthContext';
import { useAdminNotificationCount } from '@/hooks/useAdminNotifications';
import { useAdminConversations } from '@/hooks/useAdminChat';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, SectionTitle } from '@/mobile/designKit';
import { MolaMascot } from '@/components/MolaMascot';

interface Tool {
  icon: React.ElementType;
  label: string;
  desc: string;
  to: string;
  perm?: keyof RolePermission;
  badge?: number;
  mascot?: boolean;
}

function ToolCard({ tool, onClick }: { tool: Tool; onClick: () => void }) {
  const Icon = tool.icon;
  return (
    <button
      onClick={onClick}
      className={cn('group flex items-center gap-3.5 rounded-[20px] p-4 text-left transition hover:-translate-y-0.5', SURFACE.card, SURFACE.shadow)}
    >
      <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-full', SURFACE.holder)}>
        {tool.mascot ? <MolaMascot className="h-7 w-7" fallback={<Icon className="h-5 w-5" />} /> : <Icon className="h-5 w-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('flex items-center gap-2 text-[15px] font-bold', TEXT.strong)}>
          {tool.label}
          {tool.badge ? (
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#FE560D] px-1.5 text-[11px] font-bold text-white">
              {tool.badge}
            </span>
          ) : null}
        </span>
        <span className={cn('mt-0.5 block truncate text-[12.5px]', TEXT.muted)}>{tool.desc}</span>
      </span>
      <ChevronRight className={cn('h-5 w-5 shrink-0 transition group-hover:translate-x-0.5', TEXT.muted)} />
    </button>
  );
}

export function DesktopMoreScreen() {
  const navigate = useNavigate();
  const { profile, hasPermission } = useAdminAuth();
  const { data: notifCount } = useAdminNotificationCount();
  const canAccessSupportChat = hasPermission('canAccessSupportChat');
  const { data: convs } = useAdminConversations();
  const supportUnread = canAccessSupportChat
    ? (convs ?? []).reduce((sum, c) => sum + (c.unread_count_admin || 0), 0)
    : 0;

  const groups: { title: string; perm?: keyof RolePermission; items: Tool[] }[] = [
    {
      title: 'Outils',
      items: [
        { icon: Bot, label: 'Mola', desc: 'Pose une question sur la plateforme', to: '/m/assistant', mascot: true },
        { icon: BarChart3, label: 'Dashboard', desc: 'Rapports et indicateurs clés', to: '/m/dashboard' },
        { icon: TrendingUp, label: 'Taux de change', desc: 'Gérer les taux XAF/RMB', to: '/m/more/rates', perm: 'canManageRates' },
        { icon: Coins, label: 'Trésorerie', desc: 'Achats/ventes USDT, soldes, inventaire', to: '/m/more/treasury', perm: 'canViewTreasury' },
      ],
    },
    {
      title: 'Activité',
      items: [
        { icon: FileText, label: 'Justificatifs', desc: 'Voir les preuves de dépôts', to: '/m/more/proofs' },
        { icon: History, label: 'Historique', desc: "Journal d'activité", to: '/m/more/history' },
        { icon: Bell, label: 'Notifications', desc: 'Centre de notifications', to: '/m/more/notifications', badge: notifCount && notifCount > 0 ? notifCount : undefined },
        { icon: Newspaper, label: 'Veille macro', desc: 'Macro, news, prédictions IA', to: '/m/more/briefs' },
      ],
    },
    {
      title: 'Support',
      perm: 'canAccessSupportChat',
      items: [
        { icon: MessageCircle, label: 'Support chat', desc: 'Conversations avec les clients', to: '/m/support', badge: supportUnread > 0 ? supportUnread : undefined },
        { icon: MessageSquareQuote, label: 'Templates support', desc: 'Réponses pré-enregistrées', to: '/m/more/canned-responses' },
        { icon: Sparkles, label: 'Quick replies clients', desc: 'Suggestions aux nouveaux clients', to: '/m/more/quick-replies' },
      ],
    },
    {
      title: 'Administration',
      items: [
        { icon: UserCog, label: 'Administrateurs', desc: 'Gérer les accès admin', to: '/m/more/admins', perm: 'canManageUsers' },
        { icon: Settings, label: 'Paramètres', desc: 'Thème, compte, à propos', to: '/m/more/settings' },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h2 className={cn('text-[26px] font-extrabold tracking-tight', TEXT.strong)}>Tous les outils</h2>
        <p className={cn('mt-1 text-[14px]', TEXT.muted)}>Modules secondaires et préférences</p>
      </header>

      {/* Profile card */}
      <button
        onClick={() => navigate('/m/more/profile')}
        className={cn('flex w-full items-center gap-4 rounded-[22px] p-5 text-left transition hover:-translate-y-0.5', SURFACE.card, SURFACE.shadow)}
      >
        <div className={cn('flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full text-xl font-bold', SURFACE.holder)}>
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <>{profile?.first_name?.[0] || '?'}{profile?.last_name?.[0] || ''}</>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn('truncate text-[18px] font-bold', TEXT.strong)}>
            {profile?.first_name || 'Mon profil'} {profile?.last_name}
          </p>
          <p className={cn('text-[13px]', TEXT.muted)}>Modifier mes informations</p>
        </div>
        <ChevronRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
      </button>

      {groups.map((group) => {
        if (group.perm && !hasPermission(group.perm)) return null;
        const items = group.items.filter((it) => !it.perm || hasPermission(it.perm));
        if (items.length === 0) return null;
        return (
          <section key={group.title}>
            <SectionTitle>{group.title}</SectionTitle>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((tool) => (
                <ToolCard key={tool.to} tool={tool} onClick={() => navigate(tool.to)} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

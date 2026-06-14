/**
 * DEV-ONLY maquette — module CLIENT « Profil » + « Notifications » (refonte).
 * Profil : carte identité premium (sans dégradé) + badge KYC · sections Compte
 * / Préférences (langue, thème) · déconnexion. Notifications : liste designKit
 * (icône par type, non-lu = accent lilas).
 * Harness: ?screen=cprofile | cnotifs
 */
import { SURFACE, TEXT } from '@/mobile/designKit/tokens';
import {
  Bell, Shield, Smartphone, FileText, HelpCircle, Globe, Palette, LogOut,
  ChevronRight, BadgeCheck, CheckCircle2, AlertCircle, Sun,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const GREEN = '#2E7D52', AMBER = '#E8932A', LILAC = '#8B5CF6';

function Caption({ children }: { children: React.ReactNode }) {
  return <h2 className={cn('mb-2 px-1 text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>{children}</h2>;
}

function Row({ icon: Icon, label, desc, right }: { icon: typeof Bell; label: string; desc?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', SURFACE.holder)}>
        <Icon className="h-5 w-5" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn('text-[14px] font-bold', TEXT.strong)}>{label}</div>
        {desc && <div className={cn('mt-0.5 text-[12px]', TEXT.muted)}>{desc}</div>}
      </div>
      {right ?? <ChevronRight className={cn('h-4 w-4 shrink-0', TEXT.muted)} />}
    </div>
  );
}
const DIV = 'border-b border-black/[0.05] dark:border-white/[0.07]';

export function ProfileScreen() {
  return (
    <div className={cn('mx-auto min-h-screen max-w-[420px]', SURFACE.canvas)}>
      <div className="space-y-6 p-4 pt-6">
        <h1 className={cn('px-1 text-[26px] font-black leading-tight', TEXT.strong)}>Profil</h1>

        {/* Carte identité — premium, sans dégradé */}
        <div className={cn('flex items-center gap-4 rounded-[24px] p-5', SURFACE.card, SURFACE.shadow)}>
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#1C1B22] text-[22px] font-black text-white dark:bg-[#F2F1F7] dark:text-[#1B1A24]">
            PN
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className={cn('truncate text-[18px] font-black', TEXT.strong)}>Papa Nguemo</span>
              <BadgeCheck className="h-4 w-4 shrink-0" style={{ color: GREEN }} />
            </div>
            <div className={cn('mt-0.5 truncate text-[13px]', TEXT.muted)}>papa.nguemo@example.cm</div>
            <div className={cn('truncate text-[13px]', TEXT.muted)}>+237 652 236 856</div>
          </div>
        </div>

        {/* Compte */}
        <section>
          <Caption>Compte</Caption>
          <div className={cn('overflow-hidden rounded-[22px]', SURFACE.card, SURFACE.shadow)}>
            <div className={DIV}><Row icon={Bell} label="Notifications" desc="Alertes paiements & dépôts" /></div>
            <div className={DIV}><Row icon={Shield} label="Sécurité" desc="Mot de passe, connexion" /></div>
            <div className={DIV}><Row icon={Smartphone} label="Appareils" desc="Sessions actives" /></div>
            <div className={DIV}><Row icon={FileText} label="Documents" desc="Relevés & justificatifs" /></div>
            <Row icon={HelpCircle} label="Aide & support" desc="Contacter Bonzini" />
          </div>
        </section>

        {/* Préférences */}
        <section>
          <Caption>Préférences</Caption>
          <div className={cn('overflow-hidden rounded-[22px]', SURFACE.card, SURFACE.shadow)}>
            <div className={DIV}>
              <Row icon={Globe} label="Langue" right={<span className={cn('rounded-full px-2.5 py-1 text-[11px] font-bold', SURFACE.holder)}>FR</span>} />
            </div>
            <Row icon={Palette} label="Apparence" desc="Clair / Sombre" right={<span className={cn('flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold', SURFACE.holder)}><Sun className="h-3.5 w-3.5" /> Clair</span>} />
          </div>
        </section>

        {/* Déconnexion */}
        <button className="flex w-full items-center gap-3 rounded-[22px] bg-[#FBE7E7] px-4 py-4 text-left dark:bg-[#3A2526]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/60 dark:bg-black/20">
            <LogOut className="h-5 w-5 text-[#C0504D] dark:text-[#E79A9A]" />
          </div>
          <span className="text-[14px] font-bold text-[#C0504D] dark:text-[#E79A9A]">Se déconnecter</span>
        </button>

        <p className={cn('text-center text-[11px]', TEXT.muted)}>Bonzini · v1.0.0</p>
      </div>
    </div>
  );
}

/* ===================== NOTIFICATIONS ===================== */
type N = { tone: 'success' | 'danger' | 'pending' | 'info'; title: string; msg: string; date: string; unread?: boolean };
const NOTIFS: N[] = [
  { tone: 'success', title: 'Fournisseur réglé', msg: 'Votre paiement à Guangzhou Textile a été effectué.', date: "Aujourd'hui · 16:40", unread: true },
  { tone: 'success', title: 'Dépôt validé', msg: '+1 000 000 XAF ont été crédités sur votre solde.', date: "Aujourd'hui · 14:20", unread: true },
  { tone: 'pending', title: 'Coordonnées requises', msg: 'Complétez les coordonnées du paiement BZ-PM-2390.', date: 'Hier · 09:14' },
  { tone: 'danger', title: 'Dépôt refusé', msg: 'Le dépôt BZ-DP-2370 a été refusé : preuve illisible.', date: '11 juin · 10:02' },
];
const TONE: Record<N['tone'], { bg: string; fg: string; Icon: typeof Bell }> = {
  success: { bg: '#DEEFE5', fg: GREEN, Icon: CheckCircle2 },
  danger: { bg: '#FBE7E7', fg: '#C0504D', Icon: AlertCircle },
  pending: { bg: '#FDF1DD', fg: '#9A6B12', Icon: AlertCircle },
  info: { bg: '#EAE7FA', fg: LILAC, Icon: Bell },
};

export function NotificationsScreen() {
  return (
    <div className={cn('mx-auto min-h-screen max-w-[420px]', SURFACE.canvas)}>
      <div className="space-y-4 p-4 pt-6">
        <div className="flex items-center justify-between px-1">
          <h1 className={cn('text-[26px] font-black leading-tight', TEXT.strong)}>Notifications</h1>
          <span className="text-[12px] font-bold text-[#5B4CC4] dark:text-[#B5AAF0]">Tout marquer lu</span>
        </div>

        <div className="space-y-2.5">
          {NOTIFS.map((n) => {
            const ton = TONE[n.tone];
            return (
              <div key={n.title} className={cn('relative flex items-start gap-3 rounded-[18px] p-4', SURFACE.card, SURFACE.shadow, !n.unread && 'opacity-60')}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: ton.bg }}>
                  <ton.Icon className="h-5 w-5" style={{ color: ton.fg }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className={cn('text-[14px] font-bold', TEXT.strong)}>{n.title}</div>
                  <div className={cn('mt-0.5 text-[13px]', TEXT.muted)}>{n.msg}</div>
                  <div className={cn('mt-1.5 text-[11px]', TEXT.muted)}>{n.date}</div>
                </div>
                {n.unread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: LILAC }} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

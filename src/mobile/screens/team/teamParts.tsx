/**
 * Équipe & ventes (refonte v2) — pièces communes : l'en-tête d'onglet avec
 * Membres / Ventes, le périmètre court de chaque rôle (« Bureau · dépôts,
 * paiements, taux, cargo »), le choix du site en puces (avec « + Nouveau
 * site »), et le choix d'un mois.
 */
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Plus, X } from 'lucide-react';
import { PhoneNumberInput } from '@/components/form/PhoneNumberInput';
import { MAX_PHONES } from '@/components/clients/useCreateClientForm';
import type { ClientPhonesEditorApi } from '@/components/clients/useClientPhonesEditor';
import { cn } from '@/lib/utils';
import type { AppRole } from '@/contexts/AdminAuthContext';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCreateTeamSite, useTeamSites } from '@/hooks/useTeam';
import { compareSites } from '@/lib/team';
import { currentMonth, monthLabel, shiftMonth } from '@/lib/sales';
import { BigButton, BottomSheet, BoxSegmented, Chip, TabTop, TEXT } from '@/mobile/designKit';
import { BIG_FIELD, BigInput } from '@/mobile/screens/clients/parts';

export const TEAM_BASE = '/m/equipe';

/** Ce que fait le rôle, en quelques mots (lignes de choix, fiche). */
export const ROLE_SCOPE: Record<AppRole, string> = {
  super_admin: 'accès complet, crée les accès',
  ops: 'dépôts, paiements, taux, cargo',
  customer_success: 'clients, dépôts, messages',
  support: 'clients et messages',
  treasurer: 'USDT, comptes, inventaire',
  commercial: 'ses prospects et ses clients',
  receptionist: 'réception des colis',
  cash_agent: 'remise des espèces',
  warehouse_agent: 'arrivées et remises',
  customs_broker: 'classements et audits douane',
};

/** « Dépôts, paiements… » : le périmètre seul, avec sa majuscule. */
export const scopeAlone = (r: AppRole) => ROLE_SCOPE[r].charAt(0).toUpperCase() + ROLE_SCOPE[r].slice(1);

/** L'équipe affichée devant le périmètre (« Bureau », « Guangzhou », « Ventes »…). */
export const ROLE_PLACE: Record<AppRole, string> = {
  super_admin: 'Direction',
  ops: 'Bureau',
  customer_success: 'Bureau',
  support: 'Bureau',
  treasurer: 'Bureau',
  commercial: 'Ventes',
  receptionist: 'Guangzhou',
  cash_agent: 'Guangzhou',
  warehouse_agent: 'Douala',
  customs_broker: 'Douane',
};

/** L'ordre des rôles dans les listes de choix (le plus courant d'abord). */
export const ROLE_ORDER: AppRole[] = ['ops', 'customer_success', 'support', 'treasurer', 'commercial', 'receptionist', 'cash_agent', 'warehouse_agent', 'customs_broker', 'super_admin'];

/** L'en-tête de l'onglet Équipe : grand titre, ronds à droite, puis Membres / Ventes. */
export function TeamTabs({ tab, right }: { tab: 'members' | 'sales'; right?: ReactNode }) {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const canSales = hasPermission('canManageSales');
  return (
    <>
      <TabTop title="Équipe" right={right} />
      {canSales && (
        <div className="px-5 pt-2.5">
          <BoxSegmented<'members' | 'sales'>
            ariaLabel="Équipe"
            options={[{ value: 'members', label: 'Membres' }, { value: 'sales', label: 'Ventes' }]}
            value={tab}
            onChange={(v) => v !== tab && navigate(v === 'sales' ? `${TEAM_BASE}/ventes` : TEAM_BASE, { replace: true })}
          />
        </div>
      )}
    </>
  );
}

/** Le site d'un membre, en puces ; toucher la puce choisie la retire. « + Nouveau site » l'ajoute et le choisit. */
export function SiteChips({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const sites = useTeamSites();
  const create = useCreateTeamSite();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const list = [...(sites.data ?? [])].filter((s) => s.is_active !== false || s.id === value).sort(compareSites);
  const name = label.trim().replace(/\s+/g, ' ');

  const add = () => {
    if (name.length < 2 || create.isPending) return;
    const existing = (sites.data ?? []).find((s) => s.label.trim().toLowerCase() === name.toLowerCase());
    if (existing) { onChange(existing.id); setAdding(false); setLabel(''); return; }
    create.mutate({ label: name }, { onSuccess: (r) => { onChange(r.id); setAdding(false); setLabel(''); } });
  };

  if (sites.isLoading) return <div className="h-11 w-2/3 animate-pulse rounded-lg bg-[#F5F5F5] dark:bg-[#383838]" />;
  return (
    <>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Site">
        {list.map((s) => (
          <Chip key={s.id} label={s.label} active={value === s.id} onClick={() => onChange(value === s.id ? null : s.id)} />
        ))}
        <Chip label="Nouveau site" icon={Plus} onClick={() => setAdding(true)} />
      </div>
      <BottomSheet open={adding} onClose={() => setAdding(false)}>
        <h3 className={cn('text-[22px] font-semibold leading-tight', TEXT.strong)}>Nouveau site</h3>
        <BigInput className="mt-4" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Bafoussam, Lagos…" maxLength={60} aria-label="Nom du site" />
        <BigButton className="mt-5" onClick={add} disabled={name.length < 2} loading={create.isPending}>Ajouter</BigButton>
      </BottomSheet>
    </>
  );
}

/**
 * Les numéros d'un membre, à la v2 : le principal en grand champ, « + Autre
 * numéro » pour les suivants (avec leur libellé). La logique reste celle de
 * `useClientPhonesEditor` (principal facultatif pour le personnel).
 */
export function StaffPhones({ editor, idPrefix }: { editor: ClientPhonesEditorApi; idPrefix: string }) {
  return (
    <div className="space-y-2.5">
      {editor.rows.map((row, i) => (
        <div key={row.key} className="space-y-2">
          <div className="flex items-start gap-2">
            <PhoneNumberInput id={`${idPrefix}-${i}`} value={row.value} onChange={(value) => editor.setPhone(row.key, { value })} controlClassName={BIG_FIELD} className="min-w-0 flex-1" aria-label={i === 0 ? 'Téléphone' : 'Autre numéro'} />
            {i > 0 && (
              <button type="button" onClick={() => editor.removePhone(row.key)} aria-label="Retirer ce numéro" className={cn('flex h-14 w-11 shrink-0 items-center justify-center', TEXT.muted)}>
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
          {i > 0 && <BigInput placeholder="Libellé (WeChat, bureau…)" value={row.label} onChange={(e) => editor.setPhone(row.key, { label: e.target.value })} aria-label="Libellé du numéro" />}
        </div>
      ))}
      {editor.rows.length < MAX_PHONES && (
        <button type="button" onClick={editor.addPhone} className={cn('flex h-11 items-center gap-2.5 text-[16px] font-semibold', TEXT.strong)}>
          <Plus className="h-5 w-5" /> Autre numéro
        </button>
      )}
    </div>
  );
}

/** Le mois choisi, et la feuille des 12 derniers mois (« Octobre ⌄ »). */
export function MonthSheet({ open, onClose, value, onChange, months = 12 }: { open: boolean; onClose: () => void; value: string; onChange: (m: string) => void; months?: number }) {
  const now = currentMonth();
  const list = Array.from({ length: months }, (_, i) => shiftMonth(now, -i));
  return (
    <BottomSheet open={open} onClose={onClose}>
      <h3 className={cn('mb-2 text-[22px] font-semibold leading-tight', TEXT.strong)}>Le mois</h3>
      {list.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => { onChange(m); onClose(); }}
          className="flex min-h-[52px] w-full items-center justify-between border-b border-[#D9D9D9] text-left last:border-b-0 dark:border-[#444444]"
        >
          <span className={cn('text-[17px] font-semibold first-letter:uppercase', TEXT.strong)}>{monthLabel(m)}</span>
          {m === value && <Check className="h-5 w-5" />}
        </button>
      ))}
    </BottomSheet>
  );
}

/** « Octobre » : le nom du mois, avec sa majuscule. */
export function monthName(month: string): string {
  const s = monthLabel(month).split(' ')[0];
  return s.charAt(0).toUpperCase() + s.slice(1);
}

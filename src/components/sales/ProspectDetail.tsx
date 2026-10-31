// ============================================================
// ESPACE COMMERCIAL — la fiche d'un prospect (« /v/prospects/:id ») —
// refonte v2 (maquettes 03/18 et 10/27).
//
// Façon Wave : ses initiales, son nom, son entreprise et sa ville ; Appeler
// (noir) · WhatsApp · Compléter ; le statut À contacter / Contacté /
// Intéressé ; l'essentiel en lignes (numéros, email, activité, problèmes,
// aide, relance) — toucher une ligne rouvre l'étape de l'assistant
// (« ?modifier=… »), toucher un numéro propose Appeler ou WhatsApp. Dans
// « … » : Modifier (une section), Marquer perdu (motifs rapides + précision),
// Rouvrir.
// « À vérifier » (07/10) : un de ses numéros est déjà celui d'un client
// Bonzini ; le statut ne se change pas en attendant. « Perdu » : « Rouvrir »
// n'est proposé que si le serveur l'accepterait (numéros revérifiés).
// ============================================================
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { IdCard, Mail, MessageCircle, Pencil, Phone, RotateCcw, UserX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProspectNumbersCheck, useSetProspectStatus, type Prospect, type ReopenBlock } from '@/hooks/useSales';
import { INTERESTS, PROSPECT_STATUS, TO_VERIFY_NOTE, whatsappLink, type ProspectStatus } from '@/lib/sales';
import { formatE164ForDisplay } from '@/components/form/PhoneNumberInput';
import {
  ActionCircles, ActionSheet, BigButton, BottomSheet, BoxSegmented, Chip, Initials, KVBox, MoreButton, ScreenTop, Tag, TEXT, TextArea,
  useSheet, type CircleAction, type KV, type SheetAction,
} from '@/mobile/designKit';
import { FieldLabel } from '@/mobile/screens/clients/parts';
import { draftOf, joinFr, missingOf, STEPS, type StepId } from './prospectDraft';
import { followUpLabel, isDue, prospectName } from './salesHelpers';

const REASON_MAX = 300;
const QUICK_REASONS = ['Prix trop élevé', 'A déjà un prestataire', 'Ne répond plus', 'N’importe pas', 'Délai trop long'];
const OPEN_STEPS = ['new', 'contacted', 'interested'] as const;
type OpenStatus = (typeof OPEN_STEPS)[number];

/** Pourquoi une fiche perdue ne se rouvre pas (ce que le serveur répondrait), sans rien dire du client. */
const REOPEN_BLOCKED: Record<ReopenBlock, string> = {
  client: 'Un numéro est celui d’un client Bonzini',
  own_client: 'Un numéro est celui d’un de vos clients',
  mine: 'Un numéro est celui d’un autre de vos prospects',
  other: 'Un numéro est suivi par un autre commercial',
};

export function ProspectDetail({
  prospect,
  onEdit,
  onComplete,
  justSaved = false,
}: {
  prospect: Prospect;
  onEdit: (step: StepId) => void;
  onComplete: () => void;
  /** Ouverte par l'assistant qui vient de l'enregistrer « À vérifier » : le bandeau le dit en premier. */
  justSaved?: boolean;
}) {
  const navigate = useNavigate();
  const setStatus = useSetProspectStatus();
  const more = useSheet();
  const edit = useSheet();
  const [losing, setLosing] = useState(false);
  const [quick, setQuick] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [numberSheet, setNumberSheet] = useState<string | null>(null);
  const emailSheet = useSheet();

  const d = useMemo(() => draftOf(prospect), [prospect]);
  const won = prospect.status === 'won';
  const toVerify = prospect.status === 'to_verify';
  const lost = prospect.status === 'lost';
  const open = OPEN_STEPS.includes(prospect.status as OpenStatus);
  const busy = setStatus.isPending;
  const name = prospectName(prospect);
  const where = [prospect.company, prospect.city].filter(Boolean).join(' · ');
  const missing = missingOf(prospect);
  const numbers = [
    { e164: prospect.phone_e164, label: 'WhatsApp' },
    ...(prospect.phones ?? []).map((p) => ({ e164: p.phone_e164, label: p.label || 'Autre numéro' })),
  ];
  const reopen = useProspectNumbersCheck(numbers.map((n) => n.e164), prospect.id, lost);
  const motif = [quick, reason.trim()].filter(Boolean).join(' · ');

  const changeStatus = (status: Exclude<ProspectStatus, 'won' | 'to_verify'>, why?: string) => {
    if (busy) return;
    setStatus.mutate(
      { id: prospect.id, status, reason: why },
      {
        onSuccess: () => {
          setLosing(false);
          setReason('');
          setQuick(null);
          toast.success(status === 'new' && prospect.status === 'lost' ? 'Prospect rouvert' : `Statut : ${PROSPECT_STATUS[status].label}`);
        },
      },
    );
  };

  const circles: CircleAction[] = [
    { label: 'Appeler', icon: Phone, primary: true, onClick: () => { window.location.href = `tel:${prospect.phone_e164}`; } },
    { label: 'WhatsApp', icon: MessageCircle, onClick: () => window.open(whatsappLink(prospect.phone_e164), '_blank', 'noopener') },
    { label: 'Compléter', icon: IdCard, onClick: () => (missing.length > 0 ? onComplete() : edit.show()) },
  ];

  const interests = d.interests.map((i) => INTERESTS.find((x) => x.value === i)?.label).filter(Boolean).join(', ');
  const rows: KV[] = [
    ...numbers.map((n) => ({ label: n.label, value: formatE164ForDisplay(n.e164), onClick: () => setNumberSheet(n.e164) })),
    { label: 'Email', value: prospect.email || '—', onClick: () => (prospect.email ? emailSheet.show() : onEdit('reach')) },
    { label: 'Activité', value: interests || '—', onClick: () => onEdit('business') },
    { label: 'Problème', value: prospect.pain_points?.trim() || '—', onClick: () => onEdit('needs') },
    { label: 'Aide', value: prospect.help_needed?.trim() || '—', onClick: () => onEdit('help') },
    {
      label: 'Relance',
      value: prospect.next_action_at ? followUpLabel(prospect.next_action_at) : '—',
      tone: isDue(prospect) ? 'danger' : undefined,
      onClick: () => onEdit('next'),
    },
  ];
  if (prospect.notes?.trim()) rows.push({ label: 'Notes', value: prospect.notes.trim(), onClick: () => onEdit('next') });
  if (lost) rows.unshift({ label: 'Perdu', value: prospect.lost_reason || 'Sans motif' });
  if (won) rows.unshift({ label: 'Devenu client', value: prospect.converted_at ? new Date(prospect.converted_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'Oui' });

  const actions: SheetAction[] = [
    { label: 'Modifier', hint: 'une partie de la fiche', icon: Pencil, hidden: won, onClick: edit.show },
    { label: 'Marquer perdu', icon: UserX, danger: true, hidden: !open, onClick: () => setLosing(true) },
    { label: 'Rouvrir', hint: reopen.blocking ? REOPEN_BLOCKED[reopen.blocking] : undefined, icon: RotateCcw, hidden: !lost, disabled: !!reopen.blocking || reopen.pending, onClick: () => changeStatus('new') },
  ];

  return (
    <div className="min-h-[100dvh] bg-white pb-8 dark:bg-[#1E1E1E]">
      <ScreenTop title="Prospect" onBack={() => navigate('/v/prospects')} right={<MoreButton onClick={more.show} />} />
      <div className="flex flex-col items-center px-5 pt-7 text-center">
        <Initials name={name} size={92} />
        <h2 className={cn('mt-3.5 text-[22px] font-semibold leading-tight', TEXT.strong)}>{name}</h2>
        {where && <p className={cn('mt-1 text-[16px]', TEXT.muted)}>{where}</p>}
        {(toVerify || won || lost) && <Tag tone={PROSPECT_STATUS[prospect.status].tone === 'info' ? 'neutral' : PROSPECT_STATUS[prospect.status].tone} className="mt-2.5">{PROSPECT_STATUS[prospect.status].label}</Tag>}
        {missing.length > 0 && open && (
          <>
            <Tag tone="pending" className="mt-2.5">À compléter</Tag>
            <p className={cn('mt-2 text-[16px]', TEXT.muted)}>Il manque {joinFr(missing.map((m) => m.label))}.</p>
          </>
        )}
      </div>
      <ActionCircles actions={circles} />
      <div className="space-y-4 px-5 pt-5">
        {toVerify && (
          <div role="status" className="rounded-lg bg-[#FFF1C2] px-4 py-3 text-[16px] text-[#682D03] dark:bg-[#522504] dark:text-[#FFF1C2]">
            <b className="font-semibold">{justSaved ? 'Enregistré, à vérifier' : 'En attente de la direction'}</b> · Un de ses numéros est déjà celui d’un client Bonzini. {TO_VERIFY_NOTE}
          </div>
        )}
        {open && (
          <BoxSegmented<OpenStatus>
            ariaLabel="Statut du prospect"
            options={OPEN_STEPS.map((st) => ({ value: st, label: PROSPECT_STATUS[st].label }))}
            value={prospect.status as OpenStatus}
            onChange={(st) => st !== prospect.status && changeStatus(st)}
          />
        )}
        <KVBox rows={rows} />
      </div>

      <ActionSheet open={more.open} onClose={more.hide} actions={actions} />
      <ActionSheet
        open={edit.open}
        onClose={edit.hide}
        title="Modifier"
        actions={STEPS.filter((s) => s.id !== 'review').map((s) => ({ label: s.label, onClick: () => onEdit(s.id) }))}
      />
      <ActionSheet
        open={!!numberSheet}
        onClose={() => setNumberSheet(null)}
        title={numberSheet ? formatE164ForDisplay(numberSheet) : undefined}
        actions={numberSheet ? [
          { label: 'Appeler', icon: Phone, onClick: () => { window.location.href = `tel:${numberSheet}`; } },
          { label: 'WhatsApp', icon: MessageCircle, onClick: () => window.open(whatsappLink(numberSheet), '_blank', 'noopener') },
          { label: 'Modifier les numéros', icon: Pencil, hidden: won, onClick: () => onEdit('reach') },
        ] : []}
      />
      <ActionSheet
        open={emailSheet.open}
        onClose={emailSheet.hide}
        title={prospect.email ?? undefined}
        actions={[
          { label: 'Écrire', icon: Mail, onClick: () => { window.location.href = `mailto:${prospect.email}`; } },
          { label: 'Modifier', icon: Pencil, hidden: won, onClick: () => onEdit('reach') },
        ]}
      />

      <BottomSheet open={losing && open} onClose={() => !busy && setLosing(false)}>
        <h3 className={cn('text-[22px] font-semibold leading-tight', TEXT.strong)}>{name} est perdu ?</h3>
        <FieldLabel className="mt-4">Pourquoi</FieldLabel>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Motifs fréquents">
          {QUICK_REASONS.map((r) => <Chip key={r} label={r} active={quick === r} onClick={() => setQuick(quick === r ? null : r)} />)}
          <Chip label="Autre" active={quick === null && reason.trim() !== ''} onClick={() => setQuick(null)} />
        </div>
        <FieldLabel htmlFor="pr-reason">Précisez</FieldLabel>
        <TextArea id="pr-reason" rows={3} maxLength={REASON_MAX} value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-[96px] text-[17px]" />
        <BigButton className="mt-5" disabled={motif.length < 3} loading={busy} onClick={() => changeStatus('lost', motif)}>Marquer perdu</BigButton>
        <p className={cn('mt-3 text-center text-[16px]', TEXT.muted)}>Il pourra être rouvert</p>
      </BottomSheet>
    </div>
  );
}

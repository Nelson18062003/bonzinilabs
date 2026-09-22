// ============================================================
// ENTREPÔT — Remettre, étape 3 sur 3 : « Qui emporte les colis ? » Le
// client lui-même (un bouton), ou la personne qu'il envoie : son nom, son
// téléphone. Puis la signature, sur l'écran suivant.
// ============================================================
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, User } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useClientAtWarehouse } from '@/hooks/useWarehouse';
import { clientFullName } from '@/lib/reception';
import { nParcels } from '@/lib/warehouse';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, FormField, PrimaryPill, ScreenError, ScreenLoader, TextInput } from '@/mobile/designKit';
import { WhStep } from '@/mobile/components/warehouse/bits';
import { readReleaseDraft, writeReleaseDraft } from './releaseDraft';

export function WarehouseHandover() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const { data, isLoading, error, refetch } = useClientAtWarehouse(code);
  const draft = readReleaseDraft(code);
  const [who, setWho] = useState(draft?.who ?? '');
  const [phone, setPhone] = useState(draft?.phone ?? '');
  if (isLoading) return <ScreenLoader className="min-h-[100dvh]" />;
  if (error || !data) return <ScreenError description={(error as Error | null)?.message ?? 'Client introuvable'} onRetry={() => void refetch()} />;
  if (!draft || draft.ids.length === 0) return <ScreenError title="Aucun colis choisi" description="Repartez de la liste de ses colis." onRetry={() => navigate(`/w/remise/${code}`, { replace: true })} retryLabel="Ses colis" />;

  const name = clientFullName(data.client);
  const isSelf = who.trim() === name;
  const next = () => { writeReleaseDraft({ ...draft, who: who.trim(), phone: phone.trim() }); navigate(`/w/remise/${code}/signature`); };

  return (
    <div className={cn('flex min-h-full flex-col', SURFACE.canvas)}>
      <MobileHeader title="Remettre" showBack backTo={`/w/remise/${code}`} />
      <div className="space-y-6 px-4 pb-10 pt-4">
        <WhStep step={3} total={3} title="Qui emporte les colis ?" help={`${nParcels(draft.ids.length)} pour ${name}. Le client lui-même, ou la personne qu'il envoie.`} />
        <button type="button" onClick={() => { setWho(name); setPhone(data.client.phone ?? ''); }} aria-pressed={isSelf}
          className={cn('flex min-h-[72px] w-full items-center gap-4 rounded-lg px-4 py-3 text-left transition-colors', isSelf ? 'bg-[#2C2C2C] text-[#F5F5F5] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]' : cn(SURFACE.card, SURFACE.shadow))}>
          <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', isSelf ? 'bg-white/15' : SURFACE.holder)}><User className="h-6 w-6" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-semibold leading-snug">{name}, le client lui-même</span>
            <span className={cn('mt-0.5 block text-[14px] leading-snug', isSelf ? 'opacity-80' : TEXT.muted)}>{data.client.customer_code}{data.client.phone ? ` · ${data.client.phone}` : ''}</span>
          </span>
          <ChevronRight className={cn('h-5 w-5 shrink-0', isSelf ? 'opacity-70' : TEXT.muted)} />
        </button>
        <p className={cn('text-center', TYPE.small, TEXT.muted)}>ou quelqu'un d'autre</p>
        <FormField label="Nom de la personne" htmlFor="rl-who"><TextInput id="rl-who" value={who} onChange={(e) => setWho(e.target.value)} placeholder="Prénom et nom" autoCapitalize="words" className="h-14 text-[18px]" /></FormField>
        <FormField label="Son téléphone" htmlFor="rl-phone" hint="Facultatif, mais utile si on doit la rappeler."><TextInput id="rl-phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="+237 6…" className="h-14 text-[18px] tabular-nums" /></FormField>
        <PrimaryPill onClick={next} disabled={who.trim().length < 2} className="h-14 w-full text-[17px]">Faire signer <ChevronRight /></PrimaryPill>
      </div>
    </div>
  );
}

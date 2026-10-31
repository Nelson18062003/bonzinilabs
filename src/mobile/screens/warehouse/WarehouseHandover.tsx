// ============================================================
// ENTREPÔT — Remettre, étape 3 sur 3 : « Qui emporte les colis ? » Le
// client lui-même, ou la personne qu'il envoie : son nom, son téléphone.
// Puis la signature, sur l'écran suivant. Refonte v2 (maquette 10/53) :
// la carte du client, deux cartes à choisir, « Faire signer » en bas.
// ============================================================
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useClientAtWarehouse } from '@/hooks/useWarehouse';
import { clientFullName } from '@/lib/reception';
import { nParcels } from '@/lib/warehouse';
import { cn } from '@/lib/utils';
import { BigButton, Dock, EmptyLine, ScreenLoader, ScreenTop, SURFACE, TEXT, TextInput } from '@/mobile/designKit';
import { OptionCard } from '@/mobile/components/cargo/v2';
import { WhClientCard } from '@/mobile/components/warehouse/ClientCard';
import { readReleaseDraft, writeReleaseDraft } from './releaseDraft';

export function WarehouseHandover() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const { data, isLoading, error, refetch } = useClientAtWarehouse(code);
  const draft = readReleaseDraft(code);
  const [who, setWho] = useState(draft?.who ?? '');
  const [phone, setPhone] = useState(draft?.phone ?? '');
  const [other, setOther] = useState<boolean | null>(null);
  const back = `/w/remise/${code}`;
  const shell = (body: React.ReactNode) => (
    <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
      <ScreenTop title="Remettre" backTo={back} step="3/3" />
      {body}
    </div>
  );
  if (isLoading) return <ScreenLoader className="min-h-[100dvh]" />;
  if (error || !data) return shell(<EmptyLine action={{ label: 'Réessayer', onClick: () => void refetch() }}>{(error as Error | null)?.message ?? 'Client introuvable'}</EmptyLine>);
  if (!draft || draft.ids.length === 0) return shell(<EmptyLine action={{ label: 'Ses colis', onClick: () => navigate(back, { replace: true }) }}>Aucun colis choisi.</EmptyLine>);

  const name = clientFullName(data.client);
  const first = data.client.first_name?.trim() || name;
  // Sans choix fait : le brouillon dit qui avait été retenu.
  const isOther = other ?? (who.trim() !== '' && who.trim() !== name);
  const pickSelf = () => { setOther(false); setWho(name); setPhone(data.client.phone ?? ''); };
  const pickOther = () => { if (!isOther) { setWho(''); setPhone(''); } setOther(true); };
  const ok = isOther ? who.trim().length >= 2 : other === false || who.trim() === name;
  const next = () => {
    const w = isOther ? who.trim() : name;
    const p = isOther ? phone.trim() : (data.client.phone ?? '');
    writeReleaseDraft({ ...draft, who: w, phone: p });
    navigate(`/w/remise/${code}/signature`);
  };
  const paid = !data.quotes.some((q) => q.balance_xaf > 0);

  return shell(
    <>
      <div className="flex-1 px-5 pb-6 pt-4">
        <WhClientCard client={data.client} sub={[nParcels(draft.ids.length), paid ? 'Payé' : null].filter(Boolean).join(' · ')} />
        <h2 className={cn('mt-7 text-[26px] font-semibold leading-tight', TEXT.strong)}>Qui emporte les colis ?</h2>
        <div className="mt-4 space-y-3">
          <OptionCard selected={!isOther && ok} onClick={pickSelf} title={`${first} en personne`} hint="Pièce vue au guichet" />
          <OptionCard selected={isOther} onClick={pickOther} title="Quelqu'un d'autre">
            <div className="space-y-3">
              <TextInput value={who} onChange={(e) => setWho(e.target.value)} placeholder="Prénom et nom" autoCapitalize="words" aria-label="Nom de la personne" className="h-14 text-[17px]" />
              <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="Téléphone · +237 6…" aria-label="Son téléphone" className="h-14 text-[17px] tabular-nums" />
            </div>
          </OptionCard>
        </div>
      </div>
      <Dock>
        <BigButton onClick={next} disabled={!ok}>Faire signer</BigButton>
      </Dock>
    </>,
  );
}

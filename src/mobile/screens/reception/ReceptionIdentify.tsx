// ============================================================
// RÉCEPTION — Étape 1 : « Scannez le code du client ». Un écran, une
// caméra, une question. Le QR du client (son app, une étiquette Bonzini) va
// DROIT au client — le code est unique, rien à choisir. Deux sorties, en
// dessous, pour les cas où il n'y a pas de QR : chercher par nom ou
// téléphone (un autre écran), ou enregistrer sans connaître le client.
// Un bordereau de transporteur scanné ici est gardé pour le premier colis.
//
// Avec `?assign=<dépôt>`, l'écran sert à attribuer un dépôt en attente :
// réussi, on revient là d'où l'on venait (En attente, la fiche du dépôt…) ;
// refusé (un collègue l'a déjà attribué), la caméra RESTE arrêtée — sinon
// elle relirait le même QR en boucle, et dans l'app la caméra native
// recouvrirait le message — et l'écran propose « Voir le dépôt », « Scanner
// encore » ou le retour. Jamais un voile « Client trouvé » figé.
// L'écran quitté pendant le voile vert (geste retour) : rien ne part.
// Les étapes avancent en REMPLAÇANT l'écran : le retour du téléphone ne
// ramène jamais dans une étape close.
// Refonte v2 (maquette 04/11) : la caméra sur la carte du client, la
// recherche, les clients récents en ronds, puis « Sans client » et
// « Nouveau client ».
// ============================================================
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Barcode, Check, Plus, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { clientFullName, parseScan, type ReceptionClient } from '@/lib/reception';
import { UnknownCodeError, useAssignDeposit, useClientByCode, useRecentClients } from '@/hooks/useReception';
import { FOCUS_RING, IconCircle, Initials, ItemList, ItemRow, ScreenTop, SearchBox, SURFACE, TEXT, TONE_PILL, TYPE, Button } from '@/mobile/designKit';
import { useQrScanner } from '@/mobile/components/reception/useQrScanner';
import { useReceptionBack, useStillHere } from '@/mobile/components/reception/useReceptionBack';
import { useAssignFlow } from '@/mobile/components/reception/useAssignFlow';
import { readDraftWaybill, writeDraftWaybill } from './useReceptionLocation';

const SCANNER_ID = 'reception-qr-reader';

export function ReceptionIdentify() {
  const navigate = useNavigate();
  const back = useReceptionBack();
  const stillHere = useStillHere();
  const flow = useAssignFlow();
  const { assignId, qs } = flow;
  const { t } = useLanguage();
  const [waybill, setWaybill] = useState<string | null>(() => readDraftWaybill());
  const [found, setFound] = useState<ReceptionClient | null>(null);
  // Le refus du serveur (attribution) : affiché avec ses sorties ; la caméra attend un geste.
  const [refused, setRefused] = useState<string | null>(null);
  const [epoch, setEpoch] = useState(0);
  const lockRef = useRef(false);
  const assign = useAssignDeposit();
  const byCode = useClientByCode();
  const recent = useRecentClients();

  /** « Scanner encore » : plus de refus ni de voile, la caméra repart (dans l'app, la caméra native se rouvre). */
  const rescan = () => {
    setRefused(null);
    setFound(null);
    lockRef.current = false;
    setEpoch((e) => e + 1);
  };

  const pick = async (client: ReceptionClient) => {
    if (!stillHere()) return; // quitté pendant le voile vert : ni attribution, ni étape suivante
    scanner.stop();
    setRefused(null);
    if (assignId) {
      try {
        await assign.mutateAsync({ depositId: assignId, clientUserId: client.user_id });
      } catch (e) {
        // Le hook a déjà dit le refus (toast) : ici, les sorties. La caméra, arrêtée plus
        // haut, ne repart que par un geste (« Scanner encore », ou le bouton de l'app).
        setFound(null);
        setRefused((e as Error).message);
        lockRef.current = false;
        return;
      }
      flow.assigned(clientFullName(client));
      return;
    }
    navigate(`/r/new/how?client=${client.user_id}&name=${encodeURIComponent(clientFullName(client))}&code=${client.customer_code}`, { replace: true });
  };

  const scanner = useQrScanner(SCANNER_ID, (text) => {
    if (lockRef.current) return;
    const res = parseScan(text);
    if (!res) return;
    if (res.kind === 'customer') {
      // Un code, un client : un instant vert avec le nom, puis on enchaîne.
      lockRef.current = true;
      void byCode.mutateAsync(res.code)
        .then((client) => {
          if (!stillHere()) return;
          try { navigator.vibrate?.(60); } catch { /* pas de vibreur */ }
          setFound(client);
          return new Promise<void>((r) => setTimeout(r, 700)).then(() => pick(client));
        })
        .catch((err: unknown) => {
          // « Code inconnu » seulement quand le code ne mène à personne ; une coupure réseau le dit autrement.
          if (err instanceof UnknownCodeError) toast.error(t('rc_code_unknown'), { description: err.code });
          else toast.error(t('error'), { description: (err as Error).message });
          setTimeout(() => { lockRef.current = false; }, 2000);
        });
    } else {
      setWaybill(res.value);
      writeDraftWaybill(res.value);
    }
  }, true, { restartKey: epoch });

  return (
    <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
      <ScreenTop title={assignId ? t('rc_assign') : t('rc_new_deposit')} step={assignId ? undefined : '1/4'} onBack={() => (assignId ? flow.leave() : back('/r'))} />

      <div className="flex-1 space-y-4 px-5 pb-10 pt-4">
        {refused && assignId && (
          <div role="alert" className={cn('space-y-3 rounded-lg px-4 py-4', TONE_PILL.danger)}>
            <p className={cn('flex items-start gap-2', TYPE.bodyStrong)}><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /> {refused}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="neutral" className="h-11 px-4" onClick={flow.seeDeposit}>{t('rc_see_deposit')}</Button>
              <Button variant="neutral" className="h-11 px-4" onClick={rescan}><ScanLine /> {t('rc_scan_again')}</Button>
              <Button variant="subtle" className="h-11 px-4" onClick={flow.leave}><ArrowLeft /> {t('rc_back')}</Button>
            </div>
          </div>
        )}

        {/* La caméra, sur la carte du client : son QR (app ou étiquette) va droit au client. */}
        <div className="relative overflow-hidden rounded-lg bg-[#1E1E1E]" style={{ aspectRatio: '6 / 5' }}>
          <div id={SCANNER_ID} className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
          {!found && !scanner.error && (
            <div aria-hidden className="pointer-events-none absolute inset-[16%_22%_22%] rounded-lg [background:linear-gradient(#fff,#fff)_top_left/36px_4px,linear-gradient(#fff,#fff)_top_left/4px_36px,linear-gradient(#fff,#fff)_top_right/36px_4px,linear-gradient(#fff,#fff)_top_right/4px_36px,linear-gradient(#fff,#fff)_bottom_left/36px_4px,linear-gradient(#fff,#fff)_bottom_left/4px_36px,linear-gradient(#fff,#fff)_bottom_right/36px_4px,linear-gradient(#fff,#fff)_bottom_right/4px_36px] [background-repeat:no-repeat]" />
          )}
          {!found && <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-[17px] font-semibold text-white">{t('rc_v2_client_card')}</p>}
          {scanner.starting && <div className="absolute inset-0 flex items-center justify-center text-[16px] font-medium text-white/80">{t('scanning')}</div>}
          {byCode.isPending && !found && <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-[17px] font-semibold text-white">{t('rc_looking_up')}</div>}
          {found && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#14AE5C] px-6 text-center text-white">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20"><Check className="h-9 w-9" strokeWidth={3} /></span>
              <span className="text-[15px] font-semibold opacity-90">{t('rc_client_found')}</span>
              <span className="text-[22px] font-bold leading-tight">{clientFullName(found)}</span>
              <span className="text-[16px] tabular-nums opacity-90">{found.customer_code}</span>
            </div>
          )}
          {scanner.error && (
            <div className="absolute inset-0 flex items-center justify-center px-8 text-center text-[16px] font-medium leading-relaxed text-white/90">{t('rc_camera_off')}</div>
          )}
        </div>

        {waybill && (
          <p className={cn('flex items-center gap-2 tabular-nums text-[15px] font-semibold', 'text-[#02542D] dark:text-[#CFF7D3]')}>
            <Barcode className="h-5 w-5 shrink-0" /> {t('rc_waybill_found')} · {waybill}
          </p>
        )}

        <SearchBox placeholder={t('rc_v2_name_or_code')} onClick={() => { scanner.stop(); navigate(`/r/new/search${qs}`, { replace: true }); }} />

        {/* Les clients récents : un toucher, et c'est lui. */}
        {(recent.data?.length ?? 0) > 0 && (
          <div className="grid grid-cols-4 gap-2 pt-1">
            {(recent.data ?? []).slice(0, 4).map((c) => (
              <button key={c.user_id} type="button" disabled={assign.isPending} onClick={() => { scanner.stop(); void pick(c); }} className={cn('flex min-w-0 flex-col items-center gap-2 rounded-lg py-1', FOCUS_RING)}>
                <Initials name={clientFullName(c)} size={64} />
                <span className={cn('max-w-full truncate text-[16px]', TEXT.strong)}>{c.first_name}</span>
              </button>
            ))}
          </div>
        )}

        <ItemList className="-mx-5 border-t border-[#D9D9D9] dark:border-[#444444]">
          {!assignId && (
            <ItemRow
              leading={<span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F5F5F5] text-[18px] font-semibold text-[#1E1E1E] dark:bg-[#383838] dark:text-[#F5F5F5]">?</span>}
              title={t('rc_v2_no_client')}
              subtitle={t('rc_v2_assign_later')}
              onClick={() => { scanner.stop(); navigate('/r/new/how', { replace: true }); }}
              chevron
            />
          )}
          <ItemRow leading={<IconCircle icon={Plus} />} title={t('rc_new_client')} subtitle={t('rc_v2_name_phone')} onClick={() => { scanner.stop(); navigate(`/r/new/client${qs}`, { replace: true }); }} chevron />
        </ItemList>
      </div>
    </div>
  );
}

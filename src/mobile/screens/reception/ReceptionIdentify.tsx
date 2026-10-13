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
// ============================================================
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Barcode, Check, HelpCircle, ScanLine, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { clientFullName, parseScan, type ReceptionClient } from '@/lib/reception';
import { UnknownCodeError, useAssignDeposit, useClientByCode } from '@/hooks/useReception';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { SURFACE, TONE_PILL, TYPE, Button } from '@/mobile/designKit';
import { StepHeader } from '@/mobile/components/reception/bits';
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
      toast.success(t('rc_assigned'), {
        description: clientFullName(client),
        // Partie de la fiche du dépôt, l'attribution y revient : pas de « Voir le dépôt » en double.
        action: flow.fromDeposit ? undefined : { label: t('rc_see_deposit'), onClick: () => navigate(`/r/deposit/${assignId}`) },
      });
      flow.leave();
      return;
    }
    if (stillHere()) navigate(`/r/new/how?client=${client.user_id}&name=${encodeURIComponent(clientFullName(client))}&code=${client.customer_code}`, { replace: true });
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
      <MobileHeader title={assignId ? t('rc_assign') : t('rc_new_deposit')} showBack onBack={() => (assignId ? flow.leave() : back('/r'))} />

      <div className="flex-1 space-y-6 px-5 pb-10 pt-4">
        <StepHeader step={1} total={4} title={t('rc_s1_title')} help={t('rc_s1_help')} />

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

        {/* La caméra : carrée, grande, seule. */}
        <div className="relative overflow-hidden rounded-lg bg-[#1E1E1E]" style={{ aspectRatio: '1 / 1' }}>
          <div id={SCANNER_ID} className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
          {scanner.starting && <div className="absolute inset-0 flex items-center justify-center text-[16px] font-medium text-white/80">{t('scanning')}</div>}
          {byCode.isPending && !found && <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-[17px] font-semibold text-white">{t('rc_looking_up')}</div>}
          {found && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#14AE5C]/90 px-6 text-center text-white">
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
          <p className={cn('flex items-center gap-2 tabular-nums', TYPE.small, 'text-[#02542D] dark:text-[#CFF7D3]')}>
            <Barcode className="h-4 w-4 shrink-0" /> {t('rc_waybill_found')} · {waybill}
          </p>
        )}

        {/* Pas de QR ? Deux sorties, grandes, l'une après l'autre. */}
        <div className="flex flex-col gap-3">
          <Button variant="neutral" className="h-14 w-full text-[17px]" onClick={() => { scanner.stop(); navigate(`/r/new/search${qs}`, { replace: true }); }}>
            <Search /> {t('rc_s1_search')}
          </Button>
          {!assignId && (
            <Button variant="subtle" className="h-14 w-full text-[16px]" onClick={() => { scanner.stop(); navigate('/r/new/how', { replace: true }); }}>
              <HelpCircle /> {t('rc_s1_unknown')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

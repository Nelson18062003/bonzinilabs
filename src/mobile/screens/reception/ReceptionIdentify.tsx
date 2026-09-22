// ============================================================
// RÉCEPTION — Étape 1 : « Scannez le code du client ». Un écran, une
// caméra, une question. Le QR du client (son app, une étiquette Bonzini) va
// DROIT au client — le code est unique, rien à choisir. Deux sorties, en
// dessous, pour les cas où il n'y a pas de QR : chercher par nom ou
// téléphone (un autre écran), ou enregistrer sans connaître le client.
// Un bordereau de transporteur scanné ici est gardé pour le premier colis.
//
// Avec `?assign=<dépôt>`, l'écran sert à attribuer un dépôt en attente.
// ============================================================
import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Barcode, Check, HelpCircle, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { clientFullName, parseScan, type ReceptionClient } from '@/lib/reception';
import { UnknownCodeError, useAssignDeposit, useClientByCode } from '@/hooks/useReception';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { SURFACE, TYPE, Button } from '@/mobile/designKit';
import { StepHeader } from '@/mobile/components/reception/bits';
import { useQrScanner } from '@/mobile/components/reception/useQrScanner';
import { readDraftWaybill, writeDraftWaybill } from './useReceptionLocation';

const SCANNER_ID = 'reception-qr-reader';

export function ReceptionIdentify() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const assignId = params.get('assign');
  const { t } = useLanguage();
  const [waybill, setWaybill] = useState<string | null>(() => readDraftWaybill());
  const [found, setFound] = useState<ReceptionClient | null>(null);
  const lockRef = useRef(false);
  const assign = useAssignDeposit();
  const byCode = useClientByCode();
  const qs = assignId ? `?assign=${assignId}` : '';

  const pick = async (client: ReceptionClient) => {
    scanner.stop();
    if (assignId) {
      const dep = await assign.mutateAsync({ depositId: assignId, clientUserId: client.user_id });
      toast.success(t('rc_assigned'), { description: clientFullName(client) });
      navigate(`/r/deposit/${dep.id}`, { replace: true });
      return;
    }
    navigate(`/r/new/how?client=${client.user_id}&name=${encodeURIComponent(clientFullName(client))}&code=${client.customer_code}`);
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
          try { navigator.vibrate?.(60); } catch { /* pas de vibreur */ }
          setFound(client);
          return new Promise<void>((r) => setTimeout(r, 700)).then(() => pick(client));
        })
        .catch((err: unknown) => {
          toast.error(t('rc_code_unknown'), { description: err instanceof UnknownCodeError ? err.code : (err as Error).message });
          setTimeout(() => { lockRef.current = false; }, 2000);
        });
    } else {
      setWaybill(res.value);
      writeDraftWaybill(res.value);
    }
  });

  return (
    <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
      <MobileHeader title={assignId ? t('rc_assign') : t('rc_new_deposit')} showBack backTo={assignId ? '/r/pending' : '/r'} />

      <div className="flex-1 space-y-6 px-5 pb-10 pt-4">
        <StepHeader step={1} total={4} title={t('rc_s1_title')} help={t('rc_s1_help')} />

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
          <Button variant="neutral" className="h-14 w-full text-[17px]" onClick={() => { scanner.stop(); navigate(`/r/new/search${qs}`); }}>
            <Search /> {t('rc_s1_search')}
          </Button>
          {!assignId && (
            <Button variant="subtle" className="h-14 w-full text-[16px]" onClick={() => { scanner.stop(); navigate('/r/new/how'); }}>
              <HelpCircle /> {t('rc_s1_unknown')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

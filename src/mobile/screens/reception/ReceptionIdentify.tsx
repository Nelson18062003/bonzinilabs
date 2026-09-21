// ============================================================
// RÉCEPTION — « À qui est ce colis ? » La caméra d'abord : le QR du client
// (son app, une étiquette Bonzini) ou le bordereau du transporteur. Puis une
// recherche par nom, téléphone ou code. Et deux sorties honnêtes : créer le
// client, ou enregistrer sans savoir (le colis existe quand même).
//
// Avec `?assign=<dépôt>`, l'écran sert à attribuer un dépôt en attente.
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Barcode, ChevronRight, HelpCircle, Search, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { clientFullName, initials, parseScan, type ReceptionClient } from '@/lib/reception';
import { useAssignDeposit, useReceptionSearch } from '@/hooks/useReception';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { SURFACE, TEXT, TYPE, Button, Card, Holder, TextInput } from '@/mobile/designKit';
import { useQrScanner } from '@/mobile/components/reception/useQrScanner';
import { readDraftWaybill, writeDraftWaybill } from './useReceptionLocation';

const SCANNER_ID = 'reception-qr-reader';

export function ReceptionIdentify() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const assignId = params.get('assign');
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [waybill, setWaybill] = useState<string | null>(() => readDraftWaybill());
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const lockRef = useRef(false);
  const assign = useAssignDeposit();

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(id);
  }, [query]);
  const search = useReceptionSearch(scannedCode ?? debounced);

  const scanner = useQrScanner(SCANNER_ID, (text) => {
    if (lockRef.current) return;
    const res = parseScan(text);
    if (!res) return;
    if (res.kind === 'customer') {
      lockRef.current = true;
      setScannedCode(res.code);
      setQuery(res.code);
      setTimeout(() => { lockRef.current = false; }, 1500);
    } else {
      setWaybill(res.value);
      writeDraftWaybill(res.value);
    }
  });

  // Un code client scanné qui ne renvoie qu'un client : on y va sans tap.
  useEffect(() => {
    if (scannedCode && search.data && search.data.length === 1) void pick(search.data[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannedCode, search.data]);

  const goHow = (client: ReceptionClient | null) => {
    scanner.stop();
    const qs = client ? `?client=${client.user_id}&name=${encodeURIComponent(clientFullName(client))}&code=${client.customer_code}` : '';
    navigate(`/r/new/how${qs}`);
  };

  const pick = async (client: ReceptionClient) => {
    if (assignId) {
      scanner.stop();
      const dep = await assign.mutateAsync({ depositId: assignId, clientUserId: client.user_id });
      toast.success(t('rc_assigned'), { description: clientFullName(client) });
      navigate(`/r/deposit/${dep.id}`, { replace: true });
      return;
    }
    goHow(client);
  };

  const results = search.data ?? [];
  const searching = (scannedCode ?? debounced).length >= 2;

  return (
    <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
      <MobileHeader title={assignId ? t('rc_assign') : t('rc_new_deposit')} showBack backTo={assignId ? '/r/pending' : '/r'} />

      <div className="flex-1 space-y-6 px-5 pb-10 pt-5">
        <div>
          <h1 className={cn(TYPE.title, TEXT.strong)}>{t('rc_who')}</h1>
          <p className={cn('mt-2', TYPE.body, TEXT.muted)}>{t('rc_scan_hint')}</p>
        </div>

        {/* La caméra */}
        <div className="relative overflow-hidden rounded-lg bg-[#1E1E1E]" style={{ aspectRatio: '1 / 1' }}>
          <div id={SCANNER_ID} className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
          {scanner.starting && <div className="absolute inset-0 flex items-center justify-center text-[16px] font-medium text-white/80">{t('scanning')}</div>}
          {scanner.error && (
            <div className="absolute inset-0 flex items-center justify-center px-8 text-center text-[16px] font-medium leading-relaxed text-white/90">{t('rc_camera_off')}</div>
          )}
        </div>

        {waybill && (
          <Card className="flex items-center gap-4">
            <Holder icon={Barcode} tone="info" />
            <span className="min-w-0 flex-1">
              <span className={cn('block', TYPE.smallStrong, TEXT.muted)}>{t('rc_waybill_found')}</span>
              <span className={cn('block truncate tabular-nums', TYPE.bodyStrong, TEXT.strong)}>{waybill}</span>
              <span className={cn('mt-1 block', TYPE.small, TEXT.muted)}>{t('rc_waybill_kept')}</span>
            </span>
          </Card>
        )}

        {/* La recherche */}
        <div className="relative">
          <Search className={cn('pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2', TEXT.muted)} />
          <TextInput
            value={query}
            onChange={(e) => { setScannedCode(null); setQuery(e.target.value); }}
            placeholder={t('rc_search_placeholder')}
            className="h-14 pl-12 text-[17px]"
            autoComplete="off"
            inputMode="search"
            aria-label={t('rc_search_placeholder')}
          />
        </div>

        {searching && (
          <Card className="py-0">
            {search.isLoading ? (
              <p className={cn('py-5 text-center', TYPE.body, TEXT.muted)}>…</p>
            ) : results.length === 0 ? (
              <p className={cn('py-5 text-center', TYPE.body, TEXT.muted)}>{t('rc_no_result')}</p>
            ) : (
              results.map((c) => {
                const name = clientFullName(c);
                return (
                  <button key={c.user_id} type="button" onClick={() => void pick(c)} className={cn('flex w-full items-center gap-4 border-b py-4 text-left last:border-b-0 active:bg-[#F5F5F5] dark:active:bg-[#383838]', SURFACE.divider)}>
                    <Holder size="lg">{initials(name)}</Holder>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate', TYPE.bodyStrong, TEXT.strong)}>{name} <span className={cn('ml-1 tabular-nums', TYPE.small, TEXT.muted)}>{c.customer_code}</span></span>
                      <span className={cn('mt-0.5 block truncate', TYPE.small, TEXT.muted)}>{[c.phone, c.city, c.company_name].filter(Boolean).join(' · ')}</span>
                    </span>
                    <ChevronRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
                  </button>
                );
              })
            )}
          </Card>
        )}

        <div className="flex flex-col gap-3 pt-2">
          <Button variant="neutral" className="h-14 w-full text-[17px]" onClick={() => { scanner.stop(); navigate(`/r/new/client${assignId ? `?assign=${assignId}` : ''}`); }}>
            <UserPlus /> {t('rc_new_client')}
          </Button>
          {!assignId && (
            <Button variant="subtle" className="h-14 w-full text-[16px]" onClick={() => goHow(null)}>
              <HelpCircle /> {t('rc_dont_know')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

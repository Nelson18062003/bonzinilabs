// ============================================================
// ENTREPÔT — Pointer : « Quelle arrivée ? » Un avion ou une boîte, avec ce
// qui reste à pointer. On touche, on passe à la liste des colis. Une seule
// question sur cet écran.
//
// Le lien /w/arrivees?paquet=PQ-… (le scanner de l'app BONZINI HQ l'ouvre
// quand il lit l'étiquette d'un paquet avion) : le paquet est reçu, puis on
// file au pointage de son expédition, qui affiche le résultat. Un refus
// s'affiche ici, en rouge.
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, Loader2 } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useWarehouseDay } from '@/hooks/useWarehouse';
import { useAirPackages, useReceiveAirPackage } from '@/hooks/useAirPackages';
import { parsePackageCode } from '@/lib/airPackage';
import { nParcels, packageReceivedWord, packagesProgress } from '@/lib/warehouse';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, Card, ScreenLoader, StatusPill } from '@/mobile/designKit';
import { formatDateTime } from '@/mobile/components/reception/bits';
import { TransportMark, WhQuestion } from '@/mobile/components/warehouse/bits';
import { ScanNotice } from '@/mobile/components/warehouse/packages';
import { scanFeedback, type ScanResult } from '@/mobile/components/cargo/ParcelScanBox';

/** « 5 paquets · 3 reçus » sous une arrivée avion — rien s'il n'y a pas de paquets. */
function ArrivalPackages({ airId }: { airId: string }) {
  const { data } = useAirPackages('all', airId);
  if (!data || data.length === 0) return null;
  const p = packagesProgress(data);
  return (
    <span className={cn('block tabular-nums', TYPE.smallStrong, p.done ? 'text-[#009951] dark:text-[#14AE5C]' : 'text-[#975102] dark:text-[#E8B931]')}>
      {p.total} paquet{p.total > 1 ? 's' : ''} · {p.done ? (p.total > 1 ? 'tous reçus' : 'reçu') : `${p.received} reçu${p.received > 1 ? 's' : ''}`}
    </span>
  );
}

export function WarehouseArrivals() {
  const navigate = useNavigate();
  const { data, isLoading } = useWarehouseDay();
  const [params, setParams] = useSearchParams();
  const receivePackage = useReceiveAirPackage().mutateAsync;
  const [linkResult, setLinkResult] = useState<ScanResult | null>(null);
  const handled = useRef<string | null>(null);
  const mounted = useRef(true);
  const linked = params.get('paquet');

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  // Le lien du scanner : recevoir le paquet une fois (StrictMode monte l'effet deux fois), puis
  // aller au pointage de son expédition ; un refus reste ici, et le paramètre quitte l'adresse.
  useEffect(() => {
    if (!linked) { handled.current = null; return; }
    if (handled.current === linked) return;
    handled.current = linked;
    const drop = () => setParams((p) => { const next = new URLSearchParams(p); next.delete('paquet'); return next; }, { replace: true });
    const refuse = (text: string) => { const r: ScanResult = { outcome: 'refused', text }; scanFeedback(r.outcome); setLinkResult(r); drop(); };
    const code = parsePackageCode(linked);
    if (!code) { refuse(`${linked} : ce n'est pas une étiquette de paquet (PQ-000000)`); return; }
    receivePackage(code).then(
      (r) => {
        if (!mounted.current) return;
        const word = packageReceivedWord(r);
        scanFeedback(word.outcome);
        const airId = r.package?.air_shipment_id;
        if (airId) navigate(`/w/arrivees/air/${airId}`, { replace: true, state: { packageScan: word } });
        else { setLinkResult(word); drop(); }
      },
      (e: Error) => { if (mounted.current) refuse(e.message); },
    );
  }, [linked, receivePackage, navigate, setParams]);

  return (
    <div className={cn('flex min-h-full flex-col', SURFACE.canvas)}>
      <MobileHeader title="Pointer" showBack backTo="/w" />
      <div className="space-y-5 px-4 pb-10 pt-4">
        {linked && !linkResult && (
          <Card className="flex items-center gap-3" role="status">
            <Loader2 className={cn('h-5 w-5 shrink-0 animate-spin', TEXT.muted)} />
            <span className={cn(TYPE.bodyStrong, TEXT.strong)}>Paquet {parsePackageCode(linked) ?? linked} : réception…</span>
          </Card>
        )}
        {linkResult && <ScanNotice result={linkResult} />}
        <WhQuestion title="Quelle arrivée ?" help="Un avion ou une boîte qui vient d'arriver. Touchez-la pour pointer ses colis." />
        {isLoading || !data ? <ScreenLoader /> : data.arrivals.length === 0 ? (
          <Card className={cn('text-center', SURFACE.inset, 'border-0')}><p className={cn(TYPE.body, TEXT.muted)}>Rien n'est arrivé. Quand l'équipe marque un avion ou une boîte « arrivé », il apparaît ici.</p></Card>
        ) : (
          <div className="space-y-3">
            {data.arrivals.map((a) => {
              const left = a.expected - a.checked;
              return (
                <button key={`${a.kind}-${a.id}`} type="button" onClick={() => navigate(`/w/arrivees/${a.kind}/${a.id}`)}
                  className={cn('flex w-full items-center gap-3 rounded-lg p-4 text-left active:bg-[#F5F5F5] dark:active:bg-[#383838]', SURFACE.card, SURFACE.shadow)}>
                  <TransportMark kind={a.kind} />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block break-words tabular-nums', TYPE.bodyStrong, TEXT.strong)}>{a.label}</span>
                    <span className={cn('block break-words', TYPE.small, TEXT.muted)}>{a.sub}{a.arrived_at ? ` · ${formatDateTime(a.arrived_at)}` : ''}</span>
                    {a.kind === 'air' && <ArrivalPackages airId={a.id} />}
                    <span className={cn('mt-1 block tabular-nums', TYPE.small, TEXT.muted)}>{nParcels(a.expected)} attendus · {a.checked} pointés{a.missing > 0 ? ` · ${a.missing} manquant${a.missing > 1 ? 's' : ''}` : ''}</span>
                    <span className="mt-2 block">{left > 0 ? <StatusPill tone="pending" label={`${left} à pointer`} /> : <StatusPill tone="success" label="Tout pointé" />}</span>
                  </span>
                  <ChevronRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

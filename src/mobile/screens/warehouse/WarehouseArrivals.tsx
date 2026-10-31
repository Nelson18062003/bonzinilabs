// ============================================================
// ENTREPÔT — Pointer : « Quelle arrivée ? » Un avion ou une boîte, avec ce
// qui reste à pointer. On touche, on passe à la liste des colis. Une seule
// question sur cet écran.
//
// Le lien /w/arrivees?paquet=PQ-… (le scanner de l'app BONZINI HQ l'ouvre
// quand il lit l'étiquette d'un paquet avion) : le paquet est reçu, puis on
// file au pointage de son expédition, qui affiche le résultat. Un refus
// s'affiche ici, en rouge.
// Refonte v2 (maquette 10/49) : « Quelle arrivée ? » en liste, avec ce qui
// reste à pointer ; le rond de scan en haut reçoit un paquet (PQ-…).
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Plane, ScanLine, Ship } from 'lucide-react';
import { useWarehouseDay } from '@/hooks/useWarehouse';
import { useAirPackages, useReceiveAirPackage } from '@/hooks/useAirPackages';
import { parsePackageCode } from '@/lib/airPackage';
import { packageReceivedWord, packagesProgress } from '@/lib/warehouse';
import { cn } from '@/lib/utils';
import { EmptyLine, IconCircle, ItemList, ItemRow, RoundButton, ScreenLoader, SURFACE, TabTop, TEXT, TYPE } from '@/mobile/designKit';
import { ScanNotice } from '@/mobile/components/warehouse/packages';
import { ParcelScanBox, scanFeedback, type ScanResult } from '@/mobile/components/cargo/ParcelScanBox';
import { CapsLabel } from '@/mobile/components/cargo/v2';

/** « paquets reçus 4 / 6 » sous une arrivée avion — rien s'il n'y a pas de paquets. */
function useArrivalPackages(airId: string | null) {
  const { data } = useAirPackages('all', airId ?? undefined, !!airId);
  if (!airId || !data || data.length === 0) return null;
  const p = packagesProgress(data);
  return `paquets reçus ${p.received} / ${p.total}`;
}

function ArrivalRow({ a, onClick }: { a: { kind: 'air' | 'sea'; id: string; label: string; sub: string | null; arrived_at: string | null; expected: number; checked: number; missing: number }; onClick: () => void }) {
  const pk = useArrivalPackages(a.kind === 'air' ? a.id : null);
  const left = a.expected - a.checked;
  return (
    <ItemRow
      leading={<IconCircle icon={a.kind === 'air' ? Plane : Ship} />}
      title={a.label}
      subtitle={[a.kind === 'air' ? 'Avion' : 'Boîte', pk ?? a.sub].filter(Boolean).join(' · ')}
      tag={!a.arrived_at ? { tone: 'neutral', label: 'Attendu' } : left > 0 ? { tone: 'pending', label: `${left} à pointer` } : { tone: 'success', label: 'Tout pointé' }}
      onClick={onClick}
    />
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
  const [scanOpen, setScanOpen] = useState(false);
  /** Un paquet scanné ici : le même chemin que le lien du scanner (?paquet=). */
  const onScan = async (text: string): Promise<ScanResult> => {
    const code = parsePackageCode(text);
    if (!code) return { outcome: 'unknown', text: `${text} : ce n'est pas une étiquette de paquet (PQ-000000)` };
    setLinkResult(null);
    setParams((p) => { const n = new URLSearchParams(p); n.set('paquet', code); return n; }, { replace: true });
    return { outcome: 'ok', text: `Paquet ${code} : réception…` };
  };

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
    <div className={cn('flex min-h-[100dvh] flex-col pb-6', SURFACE.canvas)}>
      <TabTop title="Pointer" right={<RoundButton icon={ScanLine} ariaLabel="Scanner un paquet" onClick={() => setScanOpen((v) => !v)} />} />
      <div className="space-y-3 px-5 pt-2">
        {scanOpen && <ParcelScanBox onScan={onScan} placeholder="Scannez un paquet (PQ-…)" keepFocus={false} />}
        {linked && !linkResult && (
          <p className={cn('flex items-center gap-3 rounded-lg border border-[#D9D9D9] px-4 py-3 dark:border-[#444444]', TYPE.bodyStrong, TEXT.strong)} role="status">
            <Loader2 className={cn('h-5 w-5 shrink-0 animate-spin', TEXT.muted)} /> Paquet {parsePackageCode(linked) ?? linked} : réception…
          </p>
        )}
        {linkResult && <ScanNotice result={linkResult} />}
        <CapsLabel className="pt-2">Quelle arrivée ?</CapsLabel>
      </div>
      {isLoading || !data ? <ScreenLoader /> : data.arrivals.length === 0 ? (
        <EmptyLine>Rien n'est arrivé.</EmptyLine>
      ) : (
        <ItemList>
          {data.arrivals.map((a) => <ArrivalRow key={`${a.kind}-${a.id}`} a={a} onClick={() => navigate(`/w/arrivees/${a.kind}/${a.id}`)} />)}
        </ItemList>
      )}
    </div>
  );
}

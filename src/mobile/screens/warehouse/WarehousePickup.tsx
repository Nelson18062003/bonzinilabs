// ============================================================
// ENTREPÔT — Remettre (refonte v2, maquette 10/52). « Qui attend ses
// colis ? » : la recherche (nom, BZ-…, RC-…), puis les clients dont des
// colis sont pointés et pas remis — Payé, Reste X, Sans prix, et leur
// rangée. Le rond de scan en haut ouvre la caméra : le QR de la carte du
// client, ou l'étiquette d'un de ses colis, mène droit à lui. Un code tapé
// (BZ-…, RC-…) puis Entrée fait de même. /w/remise et /w/remise/liste
// (l'onglet de l'app BONZINI HQ) montrent le même écran.
// ============================================================
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import { useQrScanner } from '@/mobile/components/reception/useQrScanner';
import { useFindParcel, useWarehouseDay } from '@/hooks/useWarehouse';
import { clientFullName } from '@/lib/reception';
import { nParcels, parseWarehouseScan, type WaitingClient } from '@/lib/warehouse';
import { xaf } from '@/lib/cargoQuote';
import { cn } from '@/lib/utils';
import { EmptyLine, Initials, ItemList, ItemRow, RoundButton, ScreenLoader, SearchBox, SURFACE, TabTop, type Tone } from '@/mobile/designKit';
import { CapsLabel } from '@/mobile/components/cargo/v2';
import { writeReleaseDraft } from './releaseDraft';

const SCANNER_ID = 'wh-pickup-scanner';

function waitingTag(w: WaitingClient): { tone: Tone; label: string } {
  if (!w.unpaid) return { tone: 'success', label: 'Payé' };
  return w.balance_xaf > 0 ? { tone: 'pending', label: `Reste ${xaf(w.balance_xaf).replace(/\s?XAF$/, '')}` } : { tone: 'neutral', label: 'Sans prix' };
}

/** La caméra du scan : le QR du client ou d'un colis. Montée seulement quand on l'ouvre. */
function ScanPanel({ onText, found }: { onText: (t: string) => void; found: string | null }) {
  const lockRef = useRef(false);
  const scanner = useQrScanner(SCANNER_ID, (text) => {
    if (lockRef.current) return;
    lockRef.current = true;
    try { navigator.vibrate?.(60); } catch { /* pas de vibreur */ }
    onText(text);
    setTimeout(() => { lockRef.current = false; }, 1500);
  });
  return (
    <div className="relative overflow-hidden rounded-lg bg-[#1E1E1E]" style={{ aspectRatio: '6 / 5' }}>
      <div id={SCANNER_ID} className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
      {scanner.starting && <div className="absolute inset-0 flex items-center justify-center text-[16px] font-medium text-white/80">Caméra…</div>}
      {found && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#14AE5C]/90 px-6 text-center text-white">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20"><Check className="h-9 w-9" strokeWidth={3} /></span>
          <span className="text-[22px] font-bold tabular-nums">{found}</span>
        </div>
      )}
      {scanner.error && <div className="absolute inset-0 flex items-center justify-center px-8 text-center text-[16px] font-medium leading-relaxed text-white/90">Caméra indisponible : tapez le code.</div>}
    </div>
  );
}

export function WarehousePickup() {
  const navigate = useNavigate();
  const find = useFindParcel();
  const { data, isLoading } = useWarehouseDay();
  const [query, setQuery] = useState('');
  const [camera, setCamera] = useState(false);
  const [found, setFound] = useState<string | null>(null);

  const goTo = (code: string) => { writeReleaseDraft(null); setFound(code); setTimeout(() => navigate(`/w/remise/${code}`), camera ? 500 : 0); };
  const go = async (text: string) => {
    const scan = parseWarehouseScan(text);
    if (!scan) { toast.error('Code illisible', { description: 'BZ-482913, ou RC-000123-01.' }); return; }
    if (scan.kind === 'customer') { goTo(scan.code); return; }
    if (scan.kind === 'package') { toast.error(`${scan.no} est l'étiquette d'un paquet avion`, { description: 'Pour remettre : la carte du client ou l’étiquette d’un de ses colis.' }); return; }
    try {
      const p = await find.mutateAsync(scan.no);
      if (!p.client) { toast.error(`${p.parcel_no} n'a pas de client attribué`); return; }
      goTo(p.client.customer_code);
    } catch (e) { toast.error((e as Error).message); }
  };

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = data?.waiting_by_client ?? [];
    if (!q) return all;
    return all.filter((w) => `${w.client ? clientFullName(w.client) : ''} ${w.client?.customer_code ?? ''} ${w.client?.phone ?? ''}`.toLowerCase().includes(q));
  }, [data, query]);

  return (
    <div className={cn('flex min-h-[100dvh] flex-col pb-6', SURFACE.canvas)}>
      <TabTop title="Remettre" right={<RoundButton icon={ScanLine} ariaLabel={camera ? 'Fermer la caméra' : 'Scanner le code du client'} onClick={() => setCamera((v) => !v)} />} />
      <div className="space-y-3 px-5 pt-2">
        {camera && <ScanPanel onText={(t) => void go(t)} found={found} />}
        <form onSubmit={(e) => { e.preventDefault(); if (parseWarehouseScan(query)) void go(query); }}>
          <SearchBox value={query} onChange={setQuery} placeholder="Nom, BZ- ou RC-" />
        </form>
        <CapsLabel className="pt-2">Qui attend ses colis ?</CapsLabel>
      </div>
      {isLoading || !data ? <ScreenLoader /> : list.length === 0 ? (
        <EmptyLine action={query && parseWarehouseScan(query) ? { label: `Ouvrir ${query.trim().toUpperCase()}`, onClick: () => void go(query) } : undefined}>
          {query ? 'Personne ne correspond.' : 'Personne n’attend.'}
        </EmptyLine>
      ) : (
        <ItemList>
          {list.map((w) => (
            <ItemRow
              key={w.client?.user_id ?? 'none'}
              leading={w.client ? <Initials name={clientFullName(w.client)} /> : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FFF1C2] text-[18px] font-semibold text-[#682D03]">?</span>}
              title={w.client ? clientFullName(w.client) : 'Client à attribuer'}
              subtitle={[nParcels(w.parcels), w.client?.customer_code].filter(Boolean).join(' · ')}
              tag={waitingTag(w)}
              onClick={w.client ? () => { writeReleaseDraft(null); navigate(`/w/remise/${w.client!.customer_code}`); } : undefined}
            />
          ))}
        </ItemList>
      )}
    </div>
  );
}

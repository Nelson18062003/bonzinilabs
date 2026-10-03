// ============================================================
// ENTREPÔT — Remettre, étape 1 sur 3 : « Scannez le code du client ». Une
// caméra, une question. Le QR de sa carte ou d'une étiquette Bonzini mène
// droit à lui. Sans QR : le code tapé, un numéro de colis, ou la liste de
// ceux qui attendent (un autre écran).
// ============================================================
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Users } from 'lucide-react';
import { toast } from 'sonner';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useQrScanner } from '@/mobile/components/reception/useQrScanner';
import { useFindParcel } from '@/hooks/useWarehouse';
import { parseWarehouseScan } from '@/lib/warehouse';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, Button, PrimaryPill, TextInput } from '@/mobile/designKit';
import { WhStep } from '@/mobile/components/warehouse/bits';
import { writeReleaseDraft } from './releaseDraft';

const SCANNER_ID = 'wh-pickup-scanner';

export function WarehousePickup() {
  const navigate = useNavigate();
  const find = useFindParcel();
  const lockRef = useRef(false);
  const [typed, setTyped] = useState('');
  const [found, setFound] = useState<string | null>(null);

  const goTo = (code: string) => { writeReleaseDraft(null); setFound(code); setTimeout(() => navigate(`/w/remise/${code}`), 500); };
  const go = async (text: string) => {
    const scan = parseWarehouseScan(text);
    if (!scan) { toast.error('Code illisible', { description: 'Un code client BZ-482913, ou un numéro de colis RC-000123-01.' }); return; }
    if (scan.kind === 'customer') { goTo(scan.code); return; }
    try {
      const p = await find.mutateAsync(scan.no);
      if (!p.client) { toast.error(`${p.parcel_no} n'a pas de client attribué`); return; }
      goTo(p.client.customer_code);
    } catch (e) { toast.error((e as Error).message); }
  };

  const scanner = useQrScanner(SCANNER_ID, (text) => {
    if (lockRef.current) return;
    lockRef.current = true;
    try { navigator.vibrate?.(60); } catch { /* pas de vibreur */ }
    void go(text).finally(() => setTimeout(() => { lockRef.current = false; }, 1500));
  });

  return (
    <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
      <MobileHeader title="Remettre" showBack backTo="/w" />
      <div className="flex-1 space-y-6 px-5 pb-10 pt-4">
        <WhStep step={1} total={3} title="Scannez le code du client" help="Le QR de sa carte Bonzini, ou de l'étiquette d'un de ses colis. Placez-le dans le cadre." />
        <div className="relative overflow-hidden rounded-lg bg-[#1E1E1E]" style={{ aspectRatio: '1 / 1' }}>
          <div id={SCANNER_ID} className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
          {scanner.starting && <div className="absolute inset-0 flex items-center justify-center text-[16px] font-medium text-white/80">Caméra…</div>}
          {found && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#14AE5C]/90 px-6 text-center text-white">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20"><Check className="h-9 w-9" strokeWidth={3} /></span>
              <span className="text-[22px] font-bold tabular-nums">{found}</span>
            </div>
          )}
          {scanner.error && <div className="absolute inset-0 flex items-center justify-center px-8 text-center text-[16px] font-medium leading-relaxed text-white/90">La caméra est indisponible. Tapez le code ci-dessous.</div>}
        </div>
        <div className="space-y-3">
          <p className={cn(TYPE.body, TEXT.muted)}>Sans QR : tapez son code client, ou le numéro d'un de ses colis.</p>
          <div className="flex gap-2">
            <TextInput value={typed} onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void go(typed); }} enterKeyHint="go" placeholder="BZ-482913" className="h-14 flex-1 text-[18px] font-semibold uppercase tabular-nums" autoCapitalize="characters" aria-label="Code client ou numéro de colis" />
            <PrimaryPill onClick={() => { scanner.stop(); void go(typed); }} disabled={typed.trim().length < 6} loading={find.isPending} className="h-14 px-5 text-[17px]">Ouvrir</PrimaryPill>
          </div>
          <Button variant="neutral" className="h-14 w-full text-[17px]" onClick={() => { scanner.stop(); navigate('/w/remise/liste'); }}><Users /> Voir qui attend ses colis</Button>
        </div>
      </div>
    </div>
  );
}

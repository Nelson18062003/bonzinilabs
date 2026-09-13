// ============================================================
// ADMIN — Scanner un identifiant client (QR de l'étiquette colis, ou code
// recopié depuis un relevé bancaire).
//
// Le geste de l'entrepôt : on pointe la caméra sur le carton, la fiche du
// client s'ouvre. Pas de nom à taper — c'est précisément ce que l'équipe
// chinoise ne peut pas faire. La saisie manuelle couvre le rapprochement
// bancaire (« BZ-482913 » lu sur le libellé) et les caméras capricieuses.
//
// Mécanique caméra reprise d'AgentCashScanner (html5-qrcode) : même arrêt
// sûr, mêmes messages d'erreur. La résolution passe par la RPC
// find_client_by_customer_code (gardée par canViewClients).
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { AlertCircle, Camera, Loader2, ScanLine, Search } from 'lucide-react';
import { toast } from 'sonner';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { normalizeCustomerCode } from '@/lib/customerCode';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, Card, Holder, TextInput, PrimaryPill } from '@/mobile/designKit';

function safeStopScanner(scanner: Html5Qrcode | null) {
  if (!scanner) return;
  try {
    const state = scanner.getState();
    if (state === 2 /* SCANNING */ || state === 3 /* PAUSED */) {
      scanner.stop().catch(() => {});
    }
  } catch {
    // Scanner not in a stoppable state — ignore
  }
}

interface LookupResult {
  success: boolean;
  error?: string;
  code?: string;
  user_id?: string;
  customer_code?: string;
  first_name?: string;
  last_name?: string;
}

export function MobileClientScan({ desktop = false }: { desktop?: boolean }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [manual, setManual] = useState(params.get('code') ?? '');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(!desktop);
  const [resolving, setResolving] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const resolvedRef = useRef(false);

  const resolveCode = useCallback(
    async (raw: string) => {
      if (resolvedRef.current) return;
      const code = normalizeCustomerCode(raw);
      if (!code) {
        toast.error('Ce QR code n’est pas un identifiant client Bonzini');
        return;
      }
      setResolving(true);
      try {
        const { data, error } = await supabaseAdmin.rpc('find_client_by_customer_code', { p_code: code });
        if (error) throw error;
        const res = data as unknown as LookupResult;
        if (!res?.success || !res.user_id) {
          toast.error(res?.error ?? 'Client introuvable', { description: code });
          return;
        }
        resolvedRef.current = true;
        safeStopScanner(scannerRef.current);
        toast.success(`${res.first_name ?? ''} ${res.last_name ?? ''}`.trim() || code, { description: res.customer_code });
        navigate(`/m/clients/${res.user_id}`, { replace: true });
      } catch (err) {
        console.error('find_client_by_customer_code', err);
        toast.error('Recherche impossible — réessayez.');
      } finally {
        setResolving(false);
      }
    },
    [navigate],
  );

  // Arrivée par le lien du QR (« /c/BZ-482913 » → ici avec ?code=) : on
  // résout tout de suite, sans exiger un second scan.
  useEffect(() => {
    const fromUrl = params.get('code');
    if (fromUrl) void resolveCode(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (desktop) return;
    const scannerId = 'client-code-qr-reader';
    let mounted = true;

    const startScanner = async () => {
      try {
        const scanner = new Html5Qrcode(scannerId);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
          (decodedText) => {
            if (mounted) void resolveCode(decodedText);
          },
          () => {},
        );
        if (mounted) setIsStarting(false);
      } catch (err: unknown) {
        if (!mounted) return;
        setIsStarting(false);
        const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
        if (msg.includes('permission') || msg.includes('denied')) setCameraError('Accès à la caméra refusé. Saisissez le code ci-dessous.');
        else if (msg.includes('not found') || msg.includes('no device')) setCameraError('Aucune caméra détectée. Saisissez le code ci-dessous.');
        else if (msg.includes('insecure') || msg.includes('https')) setCameraError('La caméra exige une connexion HTTPS.');
        else if (msg.includes('in use') || msg.includes('already')) setCameraError('La caméra est déjà utilisée par une autre application.');
        else setCameraError('Impossible de démarrer la caméra. Saisissez le code ci-dessous.');
      }
    };

    void startScanner();
    return () => {
      mounted = false;
      safeStopScanner(scannerRef.current);
      scannerRef.current = null;
    };
  }, [desktop, resolveCode]);

  const submitManual = () => {
    if (!manual.trim()) return;
    void resolveCode(manual);
  };

  return (
    <div className={cn('min-h-screen', SURFACE.canvas)}>
      <MobileHeader title="Scanner un client" subtitle="QR de l’étiquette colis · code de virement" showBack backTo="/m/clients" />

      <div className={cn('space-y-4 px-4 pb-24 pt-4', desktop && 'mx-auto max-w-[560px]')}>
        {!desktop && (
          <Card className="overflow-hidden p-0">
            {isStarting && !cameraError && (
              <div className="flex h-72 flex-col items-center justify-center gap-3">
                <Holder icon={Camera} size="lg" className="animate-pulse" />
                <p className={cn('text-sm', TEXT.muted)}>Démarrage de la caméra…</p>
              </div>
            )}
            {cameraError && (
              <div className="flex h-72 flex-col items-center justify-center gap-3 p-6 text-center">
                <Holder icon={AlertCircle} tone="danger" size="lg" />
                <p className={cn('text-sm', TEXT.muted)}>{cameraError}</p>
              </div>
            )}
            <div id="client-code-qr-reader" className={cameraError ? 'hidden' : ''} style={{ width: '100%' }} />
            {!cameraError && !isStarting && (
              <div className="p-3 text-center">
                <div className={cn('flex items-center justify-center gap-2 text-sm', TEXT.muted)}>
                  {resolving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
                  <span>{resolving ? 'Recherche du client…' : 'Cadrez le QR code de l’étiquette'}</span>
                </div>
              </div>
            )}
          </Card>
        )}

        <p className={cn('px-1 pt-1 text-xs font-bold uppercase tracking-wider', TEXT.muted)}>Saisie manuelle</p>

        <Card className="space-y-3">
          <p className={cn('text-sm', TEXT.muted)}>
            L’identifiant tel qu’il figure sur le virement ou le carton : <span className={cn('font-bold tabular-nums', TEXT.strong)}>BZ-482913</span>
          </p>
          <div className="flex gap-2">
            <TextInput
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="BZ-000000"
              className="flex-1 font-mono uppercase"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              inputMode="text"
              enterKeyHint="search"
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitManual();
              }}
            />
            <PrimaryPill onClick={submitManual} disabled={!manual.trim() || resolving} loading={resolving} className="shrink-0 px-4">
              <Search className="h-4 w-4" />
            </PrimaryPill>
          </div>
        </Card>
      </div>
    </div>
  );
}

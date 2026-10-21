// ============================================================
// AGENT-CASH — AgentCashScanner, v2 (maquette 02-operations/12) : la
//   caméra plein écran (le seul écran sombre), le cadre de visée, Fermer,
//   et « Saisir le code » (douchette / saisie manuelle) dans une feuille.
// ⚠️ LOGIQUE CAMÉRA/SCANNER 100% INTACTE : safeStopScanner, l'effet de
//   démarrage, handleScanResult, le mapping d'erreurs caméra, le div
//   #agent-cash-qr-reader (cible de montage html5-qrcode) et ses classes,
//   handleManualSearch.
// Dans l'app BONZINI HQ : c'est la caméra NATIVE qui lit (même pont que
// useQrScanner) ; un bouton la rouvre. Un QR lu (ou saisi) ouvre la fiche
// avec le contenu lu (« ?qr=… », qui porte le jeton secret du client) : c'est
// ce qui y autorise « Procéder au paiement ». L'identifiant seul ne suffit pas.
// ============================================================
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { parseCashQRCode } from '@/hooks/useCashPayment';
import { ScanLine, Search, AlertCircle, Camera, X } from 'lucide-react';
import { toast } from 'sonner';
import { Html5Qrcode } from 'html5-qrcode';
import { cn } from '@/lib/utils';
import { BigButton, BottomSheet, TEXT, TextInput } from '@/mobile/designKit';
import { isNativeApp } from '@/lib/nativeApp';
import { closeNativeScanner, openNativeScanner, registerNativeScanner } from '@/lib/nativeBridge';

function safeStopScanner(scanner: Html5Qrcode | null) {
  if (!scanner) return;
  try {
    const state = scanner.getState();
    // Only stop if scanner is actively scanning or paused
    if (state === 2 /* SCANNING */ || state === 3 /* PAUSED */) {
      scanner.stop().catch(() => {});
    }
  } catch {
    // Scanner not in a stoppable state — ignore
  }
}

export function AgentCashScanner() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [manualId, setManualId] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const native = isNativeApp();
  const [isStarting, setIsStarting] = useState(!native);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasNavigated = useRef(false);

  const handleScanResult = useCallback((decodedText: string) => {
    if (hasNavigated.current) return;

    const { paymentId, isValid } = parseCashQRCode(decodedText);
    if (isValid && paymentId) {
      hasNavigated.current = true;
      // Stop scanner before navigating
      safeStopScanner(scannerRef.current);
      if (native) closeNativeScanner();
      navigate(`/a/payment/${paymentId}?qr=${encodeURIComponent(decodedText.trim())}`);
    } else {
      toast.error(t('invalid_qr'));
    }
  }, [navigate, t, native]);

  useEffect(() => {
    // App BONZINI HQ : la caméra native lit et rend le texte ici.
    if (native) return registerNativeScanner((text) => handleScanResult(text));

    const scannerId = 'agent-cash-qr-reader';
    let mounted = true;

    const startScanner = async () => {
      try {
        const scanner = new Html5Qrcode(scannerId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1,
          },
          (decodedText) => {
            if (mounted) handleScanResult(decodedText);
          },
          () => {
            // Scan error (no QR found in frame) - silently ignore
          },
        );

        if (mounted) setIsStarting(false);
      } catch (err: unknown) {
        if (!mounted) return;
        setIsStarting(false);

        const errMsg = err instanceof Error ? err.message : String(err);
        const errLower = errMsg.toLowerCase();

        if (errLower.includes('permission') || errLower.includes('denied')) {
          setCameraError(t('camera_permission_denied'));
        } else if (errLower.includes('not found') || errLower.includes('no device')) {
          setCameraError(t('camera_not_found'));
        } else if (errLower.includes('insecure') || errLower.includes('https')) {
          setCameraError(t('camera_https_required'));
        } else if (errLower.includes('in use') || errLower.includes('already')) {
          setCameraError(t('camera_in_use'));
        } else if (errLower.includes('not supported') || errLower.includes('navigator.mediadevices')) {
          setCameraError(t('camera_not_supported'));
        } else {
          setCameraError(t('camera_start_failed'));
        }
      }
    };

    startScanner();

    return () => {
      mounted = false;
      safeStopScanner(scannerRef.current);
      scannerRef.current = null;
    };
  }, [handleScanResult, t, native]);

  const handleManualSearch = () => {
    const input = manualId.trim();
    if (!input) return;

    const { paymentId, isValid } = parseCashQRCode(input);
    if (isValid && paymentId) {
      navigate(`/a/payment/${paymentId}?qr=${encodeURIComponent(input)}`);
    } else {
      toast.error(t('invalid_qr'));
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-[#1E1E1E] text-white">
      <div className="flex h-16 shrink-0 items-center justify-between px-4 pt-[env(safe-area-inset-top)]">
        <button type="button" onClick={() => navigate('/a')} aria-label={t('cash_close')} className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white/80">
          <X className="h-7 w-7" />
        </button>
        <h1 className="text-[18px] font-semibold">{t('cash_qr_title')}</h1>
        <span className="h-12 w-12" aria-hidden />
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6">
        {native ? (
          <button type="button" onClick={() => openNativeScanner()} className="flex h-14 w-full max-w-sm items-center justify-center gap-2 rounded-lg bg-white text-[18px] font-semibold text-[#1E1E1E]">
            <ScanLine className="h-5 w-5" />
            {t('open_scanner')}
          </button>
        ) : (
          <div className="relative w-full max-w-[300px]">
            {/* Le cadre de visée, aux quatre coins */}
            <span aria-hidden className="pointer-events-none absolute -left-3 -top-3 z-10 h-12 w-12 rounded-tl-lg border-l-4 border-t-4 border-white" />
            <span aria-hidden className="pointer-events-none absolute -right-3 -top-3 z-10 h-12 w-12 rounded-tr-lg border-r-4 border-t-4 border-white" />
            <span aria-hidden className="pointer-events-none absolute -bottom-3 -left-3 z-10 h-12 w-12 rounded-bl-lg border-b-4 border-l-4 border-white" />
            <span aria-hidden className="pointer-events-none absolute -bottom-3 -right-3 z-10 h-12 w-12 rounded-br-lg border-b-4 border-r-4 border-white" />
            <div className="aspect-square w-full overflow-hidden rounded-lg bg-black">
              {isStarting && !cameraError && (
                <div className="flex h-full flex-col items-center justify-center gap-3">
                  <Camera className="h-9 w-9 animate-pulse" />
                  <p className="text-[16px] text-white/80">{t('scanning')}</p>
                </div>
              )}
              {cameraError && (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                  <AlertCircle className="h-9 w-9 text-[#FDD3D0]" />
                  <p className="text-[16px] text-white/90">{cameraError}</p>
                </div>
              )}
              <div
                id="agent-cash-qr-reader"
                className={cameraError ? 'hidden' : ''}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        )}
        {!native && !cameraError && !isStarting && (
          <p className="mt-8 text-[17px] text-white/85">{t('align_qr')}</p>
        )}
      </div>

      <div className="shrink-0 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-3">
        <button type="button" onClick={() => setManualOpen(true)} className="flex h-14 w-full items-center justify-center rounded-lg border-2 border-white/80 text-[18px] font-semibold">
          {t('cash_enter_code')}
        </button>
      </div>

      <BottomSheet open={manualOpen} onClose={() => setManualOpen(false)}>
        <h3 className={cn('text-[22px] font-semibold', TEXT.strong)}>{t('cash_enter_code')}</h3>
        <p className={cn('mt-1 text-[16px]', TEXT.muted)}>{t('enter_payment_id')}</p>
        <TextInput
          value={manualId}
          onChange={(e) => setManualId(e.target.value)}
          placeholder="Payment ID / QR content"
          className="mt-4 h-14 font-mono"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="search"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleManualSearch();
          }}
        />
        <BigButton className="mt-5" onClick={handleManualSearch} disabled={!manualId.trim()}>
          <Search className="h-5 w-5" />
          {t('search')}
        </BigButton>
      </BottomSheet>
    </div>
  );
}

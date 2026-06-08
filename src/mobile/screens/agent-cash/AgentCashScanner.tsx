// ============================================================
// AGENT-CASH — AgentCashScanner (QR html5-qrcode + saisie manuelle)
// Présentation migrée sur le design kit (Ofspace/Mola) : canvas doux ·
//   cadre caméra + états en Card/Holder · saisie manuelle en Card +
//   TextInput + PrimaryPill.
// ⚠️ LOGIQUE CAMÉRA/SCANNER 100% INTACTE : safeStopScanner, l'effet de
//   démarrage, handleScanResult, le mapping d'erreurs caméra, le div
//   #agent-cash-qr-reader (cible de montage html5-qrcode) et ses classes,
//   handleManualSearch — RIEN n'est touché côté scanner.
// ============================================================
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { parseCashQRCode } from '@/hooks/useCashPayment';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { ScanLine, Search, AlertCircle, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { Html5Qrcode } from 'html5-qrcode';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, Card, Holder, TextInput, PrimaryPill } from '@/mobile/designKit';

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
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasNavigated = useRef(false);

  const handleScanResult = useCallback((decodedText: string) => {
    if (hasNavigated.current) return;

    const { paymentId, isValid } = parseCashQRCode(decodedText);
    if (isValid && paymentId) {
      hasNavigated.current = true;
      // Stop scanner before navigating
      safeStopScanner(scannerRef.current);
      navigate(`/a/payment/${paymentId}`);
    } else {
      toast.error(t('invalid_qr'));
    }
  }, [navigate, t]);

  useEffect(() => {
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
  }, [handleScanResult, t]);

  const handleManualSearch = () => {
    const input = manualId.trim();
    if (!input) return;

    const { paymentId, isValid } = parseCashQRCode(input);
    if (isValid && paymentId) {
      navigate(`/a/payment/${paymentId}`);
    } else {
      toast.error(t('invalid_qr'));
    }
  };

  return (
    <div className={cn('min-h-screen', SURFACE.canvas)}>
      <MobileHeader title={t('scanner')} />

      <div className="px-3 sm:px-4 lg:px-6 pt-3 sm:pt-4 pb-24 sm:pb-28 space-y-4 sm:space-y-6">
        {/* Camera viewfinder */}
        <Card className="overflow-hidden p-0">
          {isStarting && !cameraError && (
            <div className="flex h-72 flex-col items-center justify-center gap-3">
              <Holder icon={Camera} size="lg" className="animate-pulse" />
              <p className={cn('text-sm', TEXT.muted)}>{t('scanning')}</p>
            </div>
          )}

          {cameraError && (
            <div className="flex h-72 flex-col items-center justify-center gap-3 p-6 text-center">
              <Holder icon={AlertCircle} tone="danger" size="lg" />
              <p className={cn('text-sm', TEXT.muted)}>{cameraError}</p>
            </div>
          )}

          <div
            id="agent-cash-qr-reader"
            className={cameraError ? 'hidden' : ''}
            style={{ width: '100%' }}
          />

          {!cameraError && !isStarting && (
            <div className="p-3 text-center">
              <div className={cn('flex items-center justify-center gap-2 text-sm', TEXT.muted)}>
                <ScanLine className="w-4 h-4" />
                <span>{t('align_qr')}</span>
              </div>
            </div>
          )}
        </Card>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
          <span className={cn('text-xs uppercase tracking-wide', TEXT.muted)}>
            {t('manual_entry')}
          </span>
          <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
        </div>

        {/* Manual entry */}
        <Card className="space-y-3">
          <p className={cn('text-sm', TEXT.muted)}>{t('enter_payment_id')}</p>
          <div className="flex gap-2">
            <TextInput
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              placeholder="Payment ID / QR content"
              className="flex-1 font-mono"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="search"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleManualSearch();
              }}
            />
            <PrimaryPill
              onClick={handleManualSearch}
              disabled={!manualId.trim()}
              className="shrink-0 px-4"
            >
              <Search className="w-4 h-4" />
            </PrimaryPill>
          </div>
        </Card>
      </div>
    </div>
  );
}

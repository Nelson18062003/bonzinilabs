import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { parseCashQRCode } from '@/hooks/useCashPayment';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScanLine, Search, AlertCircle, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { Html5Qrcode } from 'html5-qrcode';

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
      scannerRef.current?.stop().catch(() => {});
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
      scannerRef.current?.stop().catch(() => {});
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
    <div>
      <MobileHeader title={t('scanner')} />

      <div className="px-4 pt-4 pb-28 space-y-6">
        {/* Camera viewfinder */}
        <div className="card-glass rounded-2xl overflow-hidden">
          {isStarting && !cameraError && (
            <div className="h-72 flex flex-col items-center justify-center gap-3 bg-black/5">
              <Camera className="w-10 h-10 text-muted-foreground animate-pulse" />
              <p className="text-sm text-muted-foreground">{t('scanning')}</p>
            </div>
          )}

          {cameraError && (
            <div className="h-72 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-destructive" />
              </div>
              <p className="text-sm text-muted-foreground">{cameraError}</p>
            </div>
          )}

          <div
            id="agent-cash-qr-reader"
            className={cameraError ? 'hidden' : ''}
            style={{ width: '100%' }}
          />

          {!cameraError && !isStarting && (
            <div className="p-3 text-center">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <ScanLine className="w-4 h-4" />
                <span>{t('align_qr')}</span>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground uppercase tracking-wide">
            {t('manual_entry')}
          </span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Manual entry */}
        <div className="card-glass p-4 rounded-2xl space-y-3">
          <p className="text-sm text-muted-foreground">
            {t('enter_payment_id')}
          </p>
          <div className="flex gap-2">
            <Input
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              placeholder="Payment ID / QR content"
              className="flex-1 font-mono text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleManualSearch();
              }}
            />
            <Button
              onClick={handleManualSearch}
              disabled={!manualId.trim()}
              className="btn-primary-gradient"
            >
              <Search className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

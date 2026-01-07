import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, Keyboard, Loader2, AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { AgentLayout } from '@/components/agent/AgentLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { useScanCashPayment, parseCashQRCode } from '@/hooks/useCashPayment';
import { toast } from 'sonner';

export default function AgentScanPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [showManualEntry, setShowManualEntry] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scanCashPayment = useScanCashPayment();

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    setScanError(null);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(t('camera_not_supported'));
        return;
      }

      // Ensure container is visible and previous scanner is cleaned up
      await stopCamera();
      setCameraStarting(true);
      setCameraActive(true);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      // Warm up permissions (important on some Android/iOS webviews)
      try {
        const warmStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        warmStream.getTracks().forEach((track) => track.stop());
      } catch (e) {
        // ignore - html5-qrcode will surface a better error
      }

      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
      };

      // Prefer a real back camera deviceId when available (more reliable on Android)
      let cameraInput: string | { facingMode: string } = { facingMode: 'environment' };

      try {
        const cameras = await Html5Qrcode.getCameras();
        if (cameras?.length) {
          const preferred =
            cameras.find((c) => /back|rear|environment/i.test(c.label)) || cameras[cameras.length - 1];
          cameraInput = preferred.id;
        }
      } catch (e) {
        // Ignore, we'll still try facingMode
      }

      try {
        await scanner.start(cameraInput as any, config, handleScan, () => {});
      } catch (error: any) {
        // Fallback: try front camera (some devices fail environment)
        await scanner.start({ facingMode: 'user' } as any, config, handleScan, () => {});
      }

      setCameraActive(true);
    } catch (error: any) {
      console.error('Camera error:', error);

      let errorMessage = t('camera_start_failed');

      if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
        errorMessage = t('camera_permission_denied');
      } else if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
        errorMessage = t('camera_not_found');
      } else if (error?.name === 'NotReadableError' || error?.name === 'TrackStartError') {
        errorMessage = t('camera_in_use');
      } else if (error?.name === 'OverconstrainedError') {
        errorMessage = t('camera_back_unavailable');
      } else if (error?.name === 'SecurityError') {
        errorMessage = t('camera_https_required');
      } else if (error?.message) {
        errorMessage = `${t('camera_start_failed')}: ${error.message}`;
      }

      setCameraError(errorMessage);
      setCameraActive(false);
    } finally {
      setCameraStarting(false);
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch (error) {
        // Ignore stop errors
      }
      try {
        scannerRef.current.clear();
      } catch (error) {
        // Ignore clear errors
      }
      scannerRef.current = null;
    }
    setCameraActive(false);
    setCameraStarting(false);
  };

  const handleScan = async (qrData: string) => {
    // Stop camera first
    await stopCamera();
    setScanError(null);

    const { paymentId, isValid } = parseCashQRCode(qrData);
    
    if (!isValid) {
      setScanError(t('invalid_qr'));
      return;
    }

    try {
      const result = await scanCashPayment.mutateAsync(paymentId);
      
      if (result.success && result.payment) {
        // Check if it's a cash payment
        if (result.payment.method !== 'cash') {
          setScanError(t('not_cash_payment'));
          return;
        }
        navigate(`/agent/payments/${paymentId}`);
      } else {
        setScanError(result.error || t('invalid_qr'));
      }
    } catch (error) {
      setScanError(t('invalid_qr'));
    }
  };

  const handleManualEntry = async () => {
    if (!manualCode.trim()) return;
    setScanError(null);

    const { paymentId, isValid } = parseCashQRCode(manualCode);
    
    if (!isValid) {
      setScanError(t('invalid_qr'));
      return;
    }

    try {
      const result = await scanCashPayment.mutateAsync(paymentId);
      
      if (result.success && result.payment) {
        if (result.payment.method !== 'cash') {
          setScanError(t('not_cash_payment'));
          return;
        }
        navigate(`/agent/payments/${paymentId}`);
      } else {
        setScanError(result.error || t('invalid_qr'));
      }
    } catch (error) {
      setScanError(t('invalid_qr'));
    }
  };

  const handleRetry = () => {
    setScanError(null);
    setManualCode('');
    startCamera();
  };

  return (
    <AgentLayout title={t('scan_qr')}>
      <div className="space-y-4">
        {/* Error State */}
        {scanError && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="p-6 text-center space-y-4">
              <AlertCircle className="w-12 h-12 mx-auto text-destructive" />
              <p className="font-medium text-destructive">{scanError}</p>
              <Button onClick={handleRetry} variant="outline">
                <RotateCcw className="w-4 h-4 mr-2" />
                {t('retry_scan')}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Camera Scanner */}
        {!showManualEntry && !scanError && (
          <Card>
            <CardContent className="p-4">
              <div className="space-y-4">
                {/* Alignment instruction */}
                <p className="text-center text-sm text-muted-foreground">{t('align_qr')}</p>

                {/* Keep the container mounted (important for Android reliability) */}
                <div className="relative w-full">
                  <div
                    id="qr-reader"
                    className={
                      `w-full aspect-square rounded-lg overflow-hidden bg-muted ` +
                      (cameraActive ? '' : 'opacity-0 pointer-events-none')
                    }
                  />

                  {!cameraActive && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 space-y-3">
                      <Camera className="w-16 h-16 text-muted-foreground" />
                      <p className={cameraError ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
                        {cameraError || t('align_qr')}
                      </p>
                    </div>
                  )}
                </div>

                {cameraActive ? (
                  <Button variant="outline" className="w-full" onClick={stopCamera}>
                    {t('cancel')}
                  </Button>
                ) : (
                  <Button
                    onClick={startCamera}
                    className="w-full h-14 text-lg"
                    disabled={scanCashPayment.isPending || cameraStarting}
                  >
                    {scanCashPayment.isPending || cameraStarting ? (
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    ) : (
                      <Camera className="w-5 h-5 mr-2" />
                    )}
                    {cameraError ? t('retry_scan') : t('scan_qr')}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Toggle Manual Entry */}
        {!scanError && (
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => {
              stopCamera();
              setShowManualEntry(!showManualEntry);
            }}
          >
            <Keyboard className="w-4 h-4 mr-2" />
            {t('manual_entry')}
          </Button>
        )}

        {/* Manual Entry Form */}
        {showManualEntry && !scanError && (
          <Card>
            <CardContent className="p-4 space-y-4">
              <div>
                <Input
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder={t('enter_payment_id')}
                  className="font-mono"
                />
              </div>
              <Button 
                className="w-full"
                onClick={handleManualEntry}
                disabled={!manualCode.trim() || scanCashPayment.isPending}
              >
                {scanCashPayment.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                {t('search')}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AgentLayout>
  );
}

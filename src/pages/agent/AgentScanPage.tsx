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
      // First check if we have camera permissions
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      // Stop the test stream immediately
      stream.getTracks().forEach(track => track.stop());
      
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;
      
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        handleScan,
        () => {} // Ignore scan errors
      );
      
      setCameraActive(true);
    } catch (error: any) {
      console.error('Camera error:', error);
      
      let errorMessage = t('error');
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = 'Permission caméra refusée. Veuillez autoriser l\'accès à la caméra dans les paramètres de votre navigateur.';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage = 'Aucune caméra détectée sur cet appareil.';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage = 'La caméra est utilisée par une autre application. Fermez les autres apps et réessayez.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'Caméra arrière non disponible. Essayez avec la caméra frontale.';
      } else if (error.name === 'SecurityError') {
        errorMessage = 'Accès caméra bloqué. Le site doit être en HTTPS.';
      } else if (error.message) {
        errorMessage = `Erreur caméra: ${error.message}`;
      }
      
      setCameraError(errorMessage);
      setCameraActive(false);
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch (error) {
        // Ignore stop errors
      }
    }
    setCameraActive(false);
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
              {cameraActive ? (
                <div className="space-y-4">
                  {/* Alignment instruction */}
                  <p className="text-center text-sm text-muted-foreground">
                    {t('align_qr')}
                  </p>
                  
                  <div 
                    id="qr-reader" 
                    className="w-full aspect-square rounded-lg overflow-hidden bg-black"
                  />
                  
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={stopCamera}
                  >
                    {t('cancel')}
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8 space-y-4">
                  <div id="qr-reader" className="hidden" />
                  
                  {cameraError ? (
                    <div className="text-destructive space-y-3">
                      <AlertCircle className="w-12 h-12 mx-auto" />
                      <p className="text-sm">{cameraError}</p>
                      <Button variant="outline" onClick={startCamera} className="mt-2">
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Réessayer
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Camera className="w-16 h-16 mx-auto text-muted-foreground" />
                      <p className="text-muted-foreground">{t('align_qr')}</p>
                    </>
                  )}
                  
                  <Button 
                    onClick={startCamera}
                    className="w-full h-14 text-lg"
                    disabled={scanCashPayment.isPending}
                  >
                    {scanCashPayment.isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    ) : (
                      <Camera className="w-5 h-5 mr-2" />
                    )}
                    {t('scan_qr')}
                  </Button>
                </div>
              )}
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

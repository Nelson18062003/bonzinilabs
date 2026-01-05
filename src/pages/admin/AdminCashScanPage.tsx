import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminCard } from '@/components/admin/ui/AdminCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SignatureCanvas } from '@/components/cash/SignatureCanvas';
import { useScanCashPayment, useConfirmCashPayment, parseCashQRCode } from '@/hooks/useCashPayment';
import { formatCurrencyRMB, formatXAF } from '@/lib/formatters';
import { 
  QrCode, 
  Camera, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  Phone,
  Banknote,
  ArrowLeft,
  Loader2,
  ScanLine,
  CameraOff
} from 'lucide-react';
import { toast } from 'sonner';

type Step = 'scan' | 'verify' | 'signature' | 'success';

export default function AdminCashScanPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('scan');
  const [manualCode, setManualCode] = useState('');
  const [scannedPayment, setScannedPayment] = useState<any>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerRef = useRef<string>('qr-reader');
  
  const scanCashPayment = useScanCashPayment();
  const confirmCashPayment = useConfirmCashPayment();

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Stop camera when step changes
  useEffect(() => {
    if (step !== 'scan') {
      stopCamera();
    }
  }, [step]);

  const stopCamera = async () => {
    if (html5QrCodeRef.current?.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (e) {
        console.log('Camera already stopped');
      }
    }
    setCameraActive(false);
  };

  const startCamera = async () => {
    setCameraError(null);
    
    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(scannerContainerRef.current);
      }

      await html5QrCodeRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          handleScan(decodedText);
          stopCamera();
        },
        () => {} // Ignore scan failures
      );
      
      setCameraActive(true);
    } catch (err: any) {
      console.error('Camera error:', err);
      setCameraError(
        err.message?.includes('Permission')
          ? 'Accès à la caméra refusé. Autorisez l\'accès dans les paramètres.'
          : 'Impossible d\'accéder à la caméra. Vérifiez les permissions.'
      );
    }
  };

  // Handle QR code scan result
  const handleScan = async (qrData: string) => {
    const { paymentId, isValid } = parseCashQRCode(qrData);
    
    if (!isValid) {
      toast.error('QR Code invalide');
      return;
    }

    const result = await scanCashPayment.mutateAsync(paymentId);
    
    if (result.success && result.payment) {
      setScannedPayment(result.payment);
      setStep('verify');
    }
  };

  // Handle manual code entry
  const handleManualEntry = async () => {
    if (!manualCode.trim()) return;
    
    // Try to parse as JSON first (full QR data)
    try {
      const parsed = JSON.parse(manualCode);
      if (parsed.id) {
        await handleScan(manualCode);
        return;
      }
    } catch {
      // Not JSON, treat as payment ID
    }

    // Treat as payment ID directly
    const result = await scanCashPayment.mutateAsync(manualCode.trim());
    
    if (result.success && result.payment) {
      setScannedPayment(result.payment);
      setStep('verify');
    }
  };

  // Handle signature save
  const handleSignatureSave = async (signatureDataUrl: string) => {
    if (!scannedPayment) return;

    const beneficiaryName = scannedPayment.cash_beneficiary_type === 'other'
      ? `${scannedPayment.cash_beneficiary_first_name || ''} ${scannedPayment.cash_beneficiary_last_name || ''}`.trim()
      : scannedPayment.beneficiary_name || 'Client';

    const result = await confirmCashPayment.mutateAsync({
      paymentId: scannedPayment.id,
      signatureDataUrl,
      signedByName: beneficiaryName,
    });

    if (result.success) {
      setStep('success');
    }
  };

  // Get beneficiary display info
  const getBeneficiaryInfo = () => {
    if (!scannedPayment) return { name: '', phone: '' };
    
    if (scannedPayment.cash_beneficiary_type === 'other') {
      return {
        name: `${scannedPayment.cash_beneficiary_first_name || ''} ${scannedPayment.cash_beneficiary_last_name || ''}`.trim(),
        phone: scannedPayment.cash_beneficiary_phone || '',
      };
    }
    
    return {
      name: scannedPayment.beneficiary_name || 'Client',
      phone: '',
    };
  };

  const beneficiaryInfo = getBeneficiaryInfo();

  // Render scan step
  const renderScanStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
          <QrCode className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-xl font-bold">Scanner un paiement cash</h2>
        <p className="text-muted-foreground mt-2">
          Scannez le QR Code présenté par le client
        </p>
      </div>

      {/* Camera scanner */}
      <AdminCard className="p-4">
        <div 
          id={scannerContainerRef.current} 
          className={`w-full min-h-[280px] rounded-xl overflow-hidden ${!cameraActive ? 'hidden' : ''}`}
        />
        
        {!cameraActive && (
          <div className="w-full h-48 bg-muted rounded-xl flex flex-col items-center justify-center gap-4 border-2 border-dashed border-primary/30">
            {cameraError ? (
              <>
                <CameraOff className="w-12 h-12 text-destructive" />
                <p className="text-sm text-destructive text-center px-4">{cameraError}</p>
              </>
            ) : (
              <>
                <Camera className="w-12 h-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Appuyez pour activer la caméra
                </p>
              </>
            )}
          </div>
        )}

        <Button
          onClick={cameraActive ? stopCamera : startCamera}
          variant={cameraActive ? 'destructive' : 'default'}
          className="w-full mt-4"
        >
          {cameraActive ? (
            <>
              <CameraOff className="w-4 h-4 mr-2" />
              Arrêter la caméra
            </>
          ) : (
            <>
              <Camera className="w-4 h-4 mr-2" />
              Activer la caméra
            </>
          )}
        </Button>
      </AdminCard>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Ou saisie manuelle</span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>ID du paiement ou contenu du QR Code</Label>
          <Input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="Collez l'ID du paiement ici"
          />
        </div>

        <Button
          onClick={handleManualEntry}
          disabled={!manualCode.trim() || scanCashPayment.isPending}
          className="w-full"
        >
          {scanCashPayment.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Recherche...
            </>
          ) : (
            <>
              <ScanLine className="w-4 h-4 mr-2" />
              Rechercher le paiement
            </>
          )}
        </Button>
      </div>
    </div>
  );

  // Render verify step
  const renderVerifyStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-green-500" />
        </div>
        <h2 className="text-xl font-bold">Paiement trouvé</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Vérifiez les informations avant de procéder
        </p>
      </div>

      <AdminCard>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Banknote className="w-5 h-5" />
          Détails du paiement
        </h3>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Référence</span>
            <span className="font-mono font-medium">{scannedPayment?.reference}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Montant à payer</span>
            <span className="text-2xl font-bold text-primary">
              {formatCurrencyRMB(scannedPayment?.amount_rmb || 0)}
            </span>
          </div>
          
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Équivalent XAF</span>
            <span>{formatXAF(scannedPayment?.amount_xaf || 0)} XAF</span>
          </div>
        </div>
      </AdminCard>

      <AdminCard>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <User className="w-5 h-5" />
          Bénéficiaire autorisé
        </h3>
        
        <div className="p-4 bg-primary/5 rounded-xl border border-primary/20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-lg">{beneficiaryInfo.name}</p>
              {beneficiaryInfo.phone && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {beneficiaryInfo.phone}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-yellow-500/10 rounded-lg">
          <div className="flex gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
            <p className="text-sm text-yellow-700">
              Vérifiez que la personne présente correspond au nom affiché ci-dessus
            </p>
          </div>
        </div>
      </AdminCard>

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => {
            setStep('scan');
            setScannedPayment(null);
            setManualCode('');
          }}
          className="flex-1"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        
        <Button
          onClick={() => setStep('signature')}
          className="flex-1 btn-primary-gradient"
        >
          Procéder au paiement
        </Button>
      </div>
    </div>
  );

  // Render signature step
  const renderSignatureStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold">Signature du bénéficiaire</h2>
        <p className="text-muted-foreground mt-2">
          Après avoir remis les <span className="font-bold text-primary">{formatCurrencyRMB(scannedPayment?.amount_rmb || 0)}</span>, 
          faites signer le bénéficiaire
        </p>
      </div>

      <AdminCard>
        <div className="mb-4 p-3 bg-muted rounded-lg">
          <p className="text-sm">
            <span className="text-muted-foreground">Bénéficiaire:</span>{' '}
            <span className="font-semibold">{beneficiaryInfo.name}</span>
          </p>
        </div>

        <SignatureCanvas
          onSave={handleSignatureSave}
          onCancel={() => setStep('verify')}
          isLoading={confirmCashPayment.isPending}
        />
      </AdminCard>
    </div>
  );

  // Render success step
  const renderSuccessStep = () => (
    <div className="text-center py-8">
      <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-green-500/10 flex items-center justify-center">
        <CheckCircle2 className="w-12 h-12 text-green-500" />
      </div>
      
      <h2 className="text-2xl font-bold mb-2">Paiement confirmé !</h2>
      <p className="text-muted-foreground mb-4">
        Le paiement cash a été enregistré avec succès
      </p>
      
      <div className="p-4 bg-muted rounded-xl mb-6">
        <p className="text-lg font-semibold">{scannedPayment?.reference}</p>
        <p className="text-2xl font-bold text-primary mt-1">
          {formatCurrencyRMB(scannedPayment?.amount_rmb || 0)}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Payé à {beneficiaryInfo.name}
        </p>
      </div>

      <div className="space-y-3">
        <Button
          onClick={() => {
            setStep('scan');
            setScannedPayment(null);
            setManualCode('');
          }}
          className="w-full"
        >
          <QrCode className="w-4 h-4 mr-2" />
          Scanner un autre paiement
        </Button>
        
        <Button
          variant="outline"
          onClick={() => navigate('/admin/payments')}
          className="w-full"
        >
          Retour aux paiements
        </Button>
      </div>
    </div>
  );

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 max-w-lg mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/payments')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Paiement Cash</h1>
        </div>

        {step === 'scan' && renderScanStep()}
        {step === 'verify' && renderVerifyStep()}
        {step === 'signature' && renderSignatureStep()}
        {step === 'success' && renderSuccessStep()}
      </div>
    </AdminLayout>
  );
}

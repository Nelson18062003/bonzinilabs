import { useRef, useState } from 'react';
import SignaturePad from 'react-signature-canvas';
import { Button } from '@/components/ui/button';
import { Eraser, Check } from 'lucide-react';

interface SignatureCanvasProps {
  onSave: (signatureDataUrl: string) => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function SignatureCanvas({ onSave, onCancel, isLoading = false }: SignatureCanvasProps) {
  const sigCanvas = useRef<SignaturePad>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  const handleClear = () => {
    sigCanvas.current?.clear();
    setIsEmpty(true);
  };

  const handleSave = () => {
    if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
      const dataUrl = sigCanvas.current.toDataURL('image/png');
      onSave(dataUrl);
    }
  };

  const handleEnd = () => {
    if (sigCanvas.current) {
      setIsEmpty(sigCanvas.current.isEmpty());
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <p className="text-sm text-muted-foreground">
          Le bénéficiaire doit signer ci-dessous pour confirmer la réception du paiement
        </p>
      </div>

      <div className="relative border-2 border-dashed border-primary/30 rounded-xl bg-white overflow-hidden">
        <SignaturePad
          ref={sigCanvas}
          canvasProps={{
            className: 'w-full h-48 touch-none',
            style: { width: '100%', height: '192px' },
          }}
          onEnd={handleEnd}
        />
        
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-muted-foreground/50 text-lg">Signez ici</p>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={handleClear}
          disabled={isEmpty || isLoading}
          className="flex-1"
        >
          <Eraser className="w-4 h-4 mr-2" />
          Effacer
        </Button>
        
        {onCancel && (
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1"
          >
            Annuler
          </Button>
        )}
        
        <Button
          onClick={handleSave}
          disabled={isEmpty || isLoading}
          className="flex-1 btn-primary-gradient"
        >
          <Check className="w-4 h-4 mr-2" />
          Confirmer
        </Button>
      </div>
    </div>
  );
}

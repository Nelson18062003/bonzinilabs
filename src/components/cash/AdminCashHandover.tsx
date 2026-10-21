// ============================================================
// La remise d'un paiement cash depuis la fiche admin (mobile et PC) —
// même chaîne que l'agent cash, sans raccourci :
//   1. scanner le QR que le client présente (caméra du site, ou caméra
//      native dans l'app BONZINI HQ, ou douchette / contenu collé) ;
//      le QR doit être CELUI de ce paiement → scan_cash_payment ;
//   2. cocher « cash remis », faire signer le BÉNÉFICIAIRE, dont le nom
//      est enregistré comme signataire → confirm_cash_payment.
// Réservé à `canHandleCash` (le serveur le vérifie de toute façon).
// ============================================================
import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Camera, Check, ScanLine, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/form';
import { SignatureCanvas } from '@/components/cash/SignatureCanvas';
import { parseCashQRCode } from '@/hooks/useCashPayment';
import { useAgentConfirmCashPayment, useAgentScanCashPayment } from '@/hooks/useAgentCashActions';
import { invalidateActionBadges } from '@/hooks/useAdminNotifications';
import { useQrScanner } from '@/mobile/components/reception/useQrScanner';
import { cn } from '@/lib/utils';

/** Rafraîchit la fiche, la timeline, la liste et les pastilles après un geste cash. */
export function useInvalidateCashPayment(paymentId: string) {
  const queryClient = useQueryClient();
  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['admin-payment', paymentId] });
    queryClient.invalidateQueries({ queryKey: ['admin-payment-timeline', paymentId] });
    queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
    invalidateActionBadges(queryClient);
  }, [queryClient, paymentId]);
}

const CAMERA_ERRORS: Record<string, string> = {
  denied: 'Caméra refusée : autorisez-la dans le navigateur, ou utilisez la douchette.',
  none: 'Aucune caméra sur cet appareil : utilisez la douchette ou collez le contenu du QR.',
  https: 'Caméra bloquée : le site doit être ouvert en HTTPS.',
  error: 'La caméra ne s’ouvre pas : utilisez la douchette ou collez le contenu du QR.',
};

/** Étape 1 — scanner le QR du client. `onDone` après un scan accepté par le serveur. */
export function AdminCashScan({ paymentId, onDone, onCancel }: { paymentId: string; onDone: () => void; onCancel: () => void }) {
  const scan = useAgentScanCashPayment();
  const invalidate = useInvalidateCashPayment(paymentId);
  const [manual, setManual] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const busy = useRef(false);

  const handleText = useCallback(
    async (text: string) => {
      if (busy.current) return;
      const { paymentId: scanned, isValid } = parseCashQRCode(text);
      if (!isValid) {
        toast.error('QR illisible : ce n’est pas un QR de paiement cash Bonzini');
        return;
      }
      if (scanned !== paymentId) {
        setMismatch(true);
        return;
      }
      busy.current = true;
      setMismatch(false);
      try {
        const result = await scan.mutateAsync(paymentId);
        if (result.success) {
          toast.success('QR du client scanné');
          invalidate();
          onDone();
        } else {
          toast.error(result.error || 'Scan refusé');
          invalidate();
        }
      } catch {
        /* toast par le hook */
      } finally {
        busy.current = false;
      }
    },
    [paymentId, scan, invalidate, onDone],
  );

  const { starting, error } = useQrScanner('admin-cash-qr-reader', (t) => { void handleText(t); });

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl bg-black/[0.04] dark:bg-white/[0.06]">
        {starting && !error && (
          <div className="flex h-56 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <Camera className="h-6 w-6 animate-pulse" />
            Ouverture de la caméra…
          </div>
        )}
        {error && (
          <div role="alert" className="flex h-40 flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
            <AlertCircle className="h-6 w-6" />
            {CAMERA_ERRORS[error] ?? CAMERA_ERRORS.error}
          </div>
        )}
        <div id="admin-cash-qr-reader" className={cn('w-full', error && 'hidden')} />
      </div>

      {mismatch && (
        <p role="alert" className="rounded-lg bg-[#FDD3D0] px-3 py-2 text-[14px] font-semibold text-[#900B09] dark:bg-[#900B09] dark:text-[#FDD3D0]">
          Ce QR correspond à un AUTRE paiement. Vérifiez que le client présente bien celui-ci.
        </p>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (manual.trim()) void handleText(manual.trim());
        }}
      >
        <TextField
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="Douchette ou contenu du QR"
          aria-label="Contenu du QR du client (douchette)"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          className="font-mono"
          wrapperClassName="flex-1"
        />
        <Button type="submit" variant="outline" disabled={!manual.trim() || scan.isPending}>
          <ScanLine className="mr-1.5 h-4 w-4" />
          Valider
        </Button>
      </form>

      <Button type="button" variant="outline" className="w-full" onClick={onCancel} disabled={scan.isPending}>
        Annuler
      </Button>
    </div>
  );
}

/** Étape 2 — remettre le cash, faire signer le bénéficiaire. */
export function AdminCashSign({
  paymentId,
  beneficiaryName,
  onDone,
  onCancel,
}: {
  paymentId: string;
  /** Le BÉNÉFICIAIRE (pas l'admin) : enregistré comme signataire, comme dans l'app de l'agent cash. */
  beneficiaryName: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const confirm = useAgentConfirmCashPayment();
  const invalidate = useInvalidateCashPayment(paymentId);
  const [handed, setHanded] = useState(false);

  const handleSave = async (signatureDataUrl: string) => {
    if (!handed) return;
    try {
      const result = await confirm.mutateAsync({ paymentId, signatureDataUrl, signedByName: beneficiaryName });
      if (result?.success) {
        toast.success('Signature enregistrée — cash remis');
        invalidate();
        onDone();
      } else {
        toast.error(result?.error || 'Erreur lors de la confirmation');
        invalidate();
      }
    } catch {
      /* toast par le hook */
    }
  };

  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-black/[0.04] px-3.5 py-3 dark:bg-white/[0.06]">
        <input
          type="checkbox"
          checked={handed}
          onChange={(e) => setHanded(e.target.checked)}
          className="h-5 w-5 shrink-0 accent-current"
        />
        <span className="text-[15px] font-medium">Cash remis à {beneficiaryName}</span>
      </label>
      <p className="flex items-start gap-2 rounded-xl bg-[#F8EFD8] px-3.5 py-2.5 text-[14px] text-[#9A6B12] dark:bg-[#372D14] dark:text-[#E7C083]">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        Vérifiez l’identité du bénéficiaire avant de remettre les fonds.
      </p>
      <SignatureCanvas onSave={handleSave} onCancel={onCancel} isLoading={confirm.isPending} disabled={!handed} />
      {!handed && (
        <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <Check className="h-3.5 w-3.5" /> Cochez « Cash remis » pour confirmer.
        </p>
      )}
    </div>
  );
}

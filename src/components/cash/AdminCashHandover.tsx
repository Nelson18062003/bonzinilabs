// ============================================================
// La remise d'un paiement cash depuis la fiche admin (mobile et PC) —
// même chaîne que l'agent cash, sans raccourci :
//   1. scanner le QR que le CLIENT présente dans son app (caméra du site,
//      caméra native de l'app BONZINI HQ, ou douchette). Le QR porte le
//      jeton secret du client : sans lui, scan_cash_payment refuse. Le QR
//      doit être celui de CE paiement ;
//   2. cocher « cash remis », faire signer, et saisir le nom que la
//      personne qui signe DÉCLARE (et sa pièce, si elle la montre) →
//      confirm_cash_payment.
// Réservé à `canHandleCash` (le serveur le vérifie de toute façon).
// L'ADMINISTRATION (canProcessPayments) peut passer le scan, et valider sans
// signature ni nom (décision du propriétaire, 31/10/2026) ; l'agent cash non.
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
import { useAdminAuth } from '@/contexts/AdminAuthContext';
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
  none: 'Aucune caméra sur cet appareil : utilisez la douchette.',
  https: 'Caméra bloquée : le site doit être ouvert en HTTPS.',
  error: 'La caméra ne s’ouvre pas : utilisez la douchette.',
};

/**
 * Étape 1 — scanner le QR du client. `onDone` après un scan accepté par le serveur.
 * `prefilledQr` : le contenu déjà lu par le scanner natif de l'app (« ?qr=… ») ;
 * il n'est envoyé qu'au geste « Enregistrer le scan ».
 */
export function AdminCashScan({
  paymentId,
  prefilledQr,
  onDone,
  onCancel,
}: {
  paymentId: string;
  prefilledQr?: string | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const scan = useAgentScanCashPayment();
  const invalidate = useInvalidateCashPayment(paymentId);
  const canSkip = useAdminAuth().hasPermission('canProcessPayments');
  const [manual, setManual] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const busy = useRef(false);
  const prefilled = prefilledQr ? parseCashQRCode(prefilledQr) : null;
  const prefilledOk = !!prefilled?.isValid && prefilled.paymentId === paymentId.toLowerCase();

  const handleText = useCallback(
    async (text: string) => {
      if (busy.current) return;
      const { paymentId: scanned, token, isValid } = parseCashQRCode(text);
      if (!isValid) {
        toast.error('QR refusé : scannez le QR affiché dans l’app du client (l’identifiant seul ne suffit pas)');
        return;
      }
      if (scanned !== paymentId.toLowerCase()) {
        setMismatch(true);
        return;
      }
      busy.current = true;
      setMismatch(false);
      try {
        const result = await scan.mutateAsync({ paymentId, token });
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

  const { starting, error } = useQrScanner('admin-cash-qr-reader', (t) => { void handleText(t); }, !prefilledOk);

  if (prefilledOk && prefilledQr) {
    return (
      <div className="space-y-3">
        <p className="flex items-center gap-2 rounded-xl bg-black/[0.04] px-3.5 py-3 text-[15px] dark:bg-white/[0.06]">
          <ScanLine className="h-4 w-4 shrink-0" /> QR du client lu par le scanner.
        </p>
        <Button type="button" className="w-full" onClick={() => void handleText(prefilledQr)} disabled={scan.isPending}>
          Enregistrer le scan
        </Button>
        <Button type="button" variant="outline" className="w-full" onClick={onCancel} disabled={scan.isPending}>
          Annuler
        </Button>
      </div>
    );
  }

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

      {(mismatch || (prefilledQr && !prefilledOk)) && (
        <p role="alert" className="rounded-lg bg-[#FDD3D0] px-3 py-2 text-[14px] font-semibold text-[#900B09] dark:bg-[#900B09] dark:text-[#FDD3D0]">
          Ce QR n’est pas celui de ce paiement. Vérifiez que le client présente bien celui-ci.
        </p>
      )}

      {/* Douchette (lecteur USB) : elle « tape » le contenu complet du QR. */}
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
          placeholder="Douchette : contenu du QR"
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

      {canSkip && (
        <Button type="button" variant="outline" className="w-full" onClick={onDone} disabled={scan.isPending}>
          Remettre sans scanner
        </Button>
      )}
      <Button type="button" variant="outline" className="w-full" onClick={onCancel} disabled={scan.isPending}>
        Annuler
      </Button>
    </div>
  );
}

/** Étape 2 — remettre le cash, faire signer, noter l'identité DÉCLARÉE du signataire. */
export function AdminCashSign({
  paymentId,
  beneficiaryName,
  onDone,
  onCancel,
}: {
  paymentId: string;
  /** Le bénéficiaire ATTENDU (repère pour vérifier) ; le signataire déclare le sien. */
  beneficiaryName: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const confirm = useAgentConfirmCashPayment();
  const invalidate = useInvalidateCashPayment(paymentId);
  const isAdmin = useAdminAuth().hasPermission('canProcessPayments');
  const [handed, setHanded] = useState(false);
  const [declaredName, setDeclaredName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  // L'administration valide sans nom ni signature ; l'agent cash, jamais.
  const ready = handed && (isAdmin || declaredName.trim().length >= 2);

  const handleSave = async (signatureDataUrl: string | null) => {
    if (!ready) return;
    try {
      const result = await confirm.mutateAsync({
        paymentId,
        signatureDataUrl,
        signedByName: declaredName,
        signerIdNumber: idNumber,
      });
      if (result?.success) {
        toast.success(signatureDataUrl ? 'Signature enregistrée — cash remis' : 'Cash remis — validé sans signature');
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
      <p className="flex items-start gap-2 rounded-xl bg-[#F8EFD8] px-3.5 py-2.5 text-[14px] text-[#9A6B12] dark:bg-[#372D14] dark:text-[#E7C083]">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        Bénéficiaire attendu : {beneficiaryName}. Vérifiez son identité avant de remettre les fonds.
      </p>
      <TextField
        label={isAdmin ? 'Nom de la personne qui reçoit (facultatif)' : 'Nom de la personne qui signe'}
        value={declaredName}
        onChange={(e) => setDeclaredName(e.target.value)}
        placeholder="Tel qu’elle le déclare"
        autoComplete="off"
        variant="name"
        required={!isAdmin}
      />
      <TextField
        label="N° de pièce d’identité (si présentée)"
        value={idNumber}
        onChange={(e) => setIdNumber(e.target.value)}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
      />
      <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-black/[0.04] px-3.5 py-3 dark:bg-white/[0.06]">
        <input
          type="checkbox"
          checked={handed}
          onChange={(e) => setHanded(e.target.checked)}
          className="h-5 w-5 shrink-0 accent-current"
        />
        <span className="text-[15px] font-medium">Cash remis à la personne qui signe</span>
      </label>
      <SignatureCanvas onSave={handleSave} onCancel={onCancel} isLoading={confirm.isPending} disabled={!ready} />
      {isAdmin && (
        <Button type="button" variant="outline" className="w-full" onClick={() => void handleSave(null)} disabled={!ready || confirm.isPending}>
          Valider sans signature
        </Button>
      )}
      {!ready && (
        <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <Check className="h-3.5 w-3.5" /> {isAdmin ? 'Cochez « Cash remis » pour confirmer.' : 'Saisissez le nom déclaré et cochez « Cash remis » pour confirmer.'}
        </p>
      )}
    </div>
  );
}

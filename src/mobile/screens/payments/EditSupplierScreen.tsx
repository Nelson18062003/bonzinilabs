/**
 * Modifier le fournisseur d'un paiement, v2 (maquette 10-complements/04) —
 * ouvert depuis « … › Modifier le fournisseur » de la fiche (la page
 * `/edit-beneficiary` était orpheline). Le rappel du paiement, le QR
 * (« Changer le QR »), le nom, l'ID ; « + Téléphone, identifiant, notes »
 * déplie le reste ; virement : titulaire, banque, compte, SWIFT. Un bouton
 * noir « Enregistrer ».
 *
 * Logique reprise de l'édition en place de MobilePaymentDetail : mêmes
 * contrôles, envoi du QR dans `payment-proofs`, useAdminUpdateBeneficiaryInfo
 * (admin_update_payment_beneficiary) ; garde canEditPaymentBeneficiary.
 * L'ordinateur garde MobileBeneficiaryEdit (prop desktop).
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Camera, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { useAdminPaymentDetail } from '@/hooks/usePayments';
import { useAdminUpdateBeneficiaryInfo } from '@/hooks/useAdminPayments';
import { compressImage } from '@/lib/imageCompression';
import { toStoredPath } from '@/lib/signedUrls';
import { canEditPaymentBeneficiary } from '@/lib/paymentEdits';
import { ACCEPT_IMAGE } from '@/lib/clipboardFiles';
import { cn, validateUploadFile } from '@/lib/utils';
import {
  BigButton, Dock, EmptyLine, MethodCircle, ScreenTop, Tag, TextArea, TextInput, TEXT, SURFACE, FOCUS_RING, toMethodKey,
} from '@/mobile/designKit';
import { SkeletonDetail } from '@/mobile/components/ui/SkeletonCard';
import { FieldLabel, PhotoDrop } from '@/mobile/screens/operations/parts';
import { fullName, paymentTag, yuan } from '@/mobile/screens/operations/opsLabels';

const EMPTY = {
  beneficiary_name: '', beneficiary_phone: '', beneficiary_email: '', beneficiary_qr_code_url: '',
  beneficiary_bank_name: '', beneficiary_bank_account: '', beneficiary_bank_extra: '', beneficiary_notes: '', beneficiary_identifier: '',
};

export function EditSupplierScreen() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const { data: payment, isLoading } = useAdminPaymentDetail(paymentId);
  const update = useAdminUpdateBeneficiaryInfo();
  const [form, setForm] = useState(EMPTY);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const qrRef = useRef<HTMLInputElement>(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (!payment || loaded.current) return;
    loaded.current = true;
    setForm({
      beneficiary_name: payment.beneficiary_name || '',
      beneficiary_phone: payment.beneficiary_phone || '',
      beneficiary_email: payment.beneficiary_email || '',
      beneficiary_qr_code_url: payment.beneficiary_qr_code_url || '',
      beneficiary_bank_name: payment.beneficiary_bank_name || '',
      beneficiary_bank_account: payment.beneficiary_bank_account || '',
      beneficiary_bank_extra: payment.beneficiary_bank_extra || '',
      beneficiary_notes: payment.beneficiary_notes || '',
      beneficiary_identifier: payment.beneficiary_identifier || '',
    });
    setMore(!!(payment.beneficiary_phone || payment.beneficiary_email || payment.beneficiary_notes));
  }, [payment]);

  const back = `/m/payments/${paymentId}`;
  if (isLoading) {
    return (
      <div className="flex min-h-full flex-col">
        <ScreenTop title="Modifier le fournisseur" backTo={back} />
        <SkeletonDetail />
      </div>
    );
  }
  if (!payment) {
    return (
      <div className="flex min-h-full flex-col">
        <ScreenTop title="Modifier le fournisseur" backTo="/m/payments" />
        <EmptyLine>Paiement introuvable.</EmptyLine>
      </div>
    );
  }

  const allowed = canEditPaymentBeneficiary(payment.status, payment.method, hasPermission('canProcessPayments'));
  const isQrMethod = payment.method === 'alipay' || payment.method === 'wechat';
  const isBank = payment.method === 'bank_transfer';
  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const tag = paymentTag(payment.status);
  const qrShown = qrPreview || form.beneficiary_qr_code_url;

  const pickQr = (f: File | undefined) => {
    if (!f) return;
    try { validateUploadFile(f); } catch (e) { toast.error((e as Error).message); return; }
    setQrFile(f);
    setQrPreview((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(f); });
  };

  const save = async () => {
    if (isQrMethod) {
      const hasContact = !!(form.beneficiary_phone || form.beneficiary_email || form.beneficiary_identifier);
      const hasQr = !!(qrFile || form.beneficiary_qr_code_url);
      if (!hasContact && !hasQr) { toast.error('Fournissez au moins un QR code, un identifiant, un téléphone ou un email'); return; }
    } else if (isBank) {
      if (!form.beneficiary_name) { toast.error('Le nom du titulaire est requis'); return; }
      if (!form.beneficiary_bank_name) { toast.error('Le nom de la banque est requis'); return; }
      if (!form.beneficiary_bank_account) { toast.error('Le numéro de compte est requis'); return; }
    }
    setBusy(true);
    try {
      let qrUrl = toStoredPath(form.beneficiary_qr_code_url) ?? '';
      if (qrFile && isQrMethod) {
        const compressed = await compressImage(qrFile);
        const filePath = `beneficiary/${payment.id}/${Date.now()}_${compressed.name}`;
        const { error } = await supabaseAdmin.storage.from('payment-proofs').upload(filePath, compressed, { upsert: true });
        if (error) throw error;
        qrUrl = `payment-proofs/${filePath}`;
      }
      const identifier = form.beneficiary_identifier.trim();
      await update.mutateAsync({
        paymentId: payment.id,
        beneficiaryInfo: {
          beneficiary_name: form.beneficiary_name || undefined,
          beneficiary_phone: form.beneficiary_phone || undefined,
          beneficiary_email: form.beneficiary_email || undefined,
          beneficiary_qr_code_url: qrUrl || undefined,
          beneficiary_bank_name: form.beneficiary_bank_name || undefined,
          beneficiary_bank_account: form.beneficiary_bank_account || undefined,
          beneficiary_bank_extra: form.beneficiary_bank_extra || undefined,
          beneficiary_notes: form.beneficiary_notes || undefined,
          beneficiary_identifier: identifier || undefined,
          beneficiary_identifier_type: isQrMethod && identifier ? 'id' : undefined,
        },
      });
      navigate(back, { replace: true });
    } catch (err) {
      if (err instanceof Error && err.message) toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const field = (label: string, k: keyof typeof EMPTY, opts: { placeholder?: string; mono?: boolean; type?: string } = {}) => (
    <>
      <FieldLabel>{label}</FieldLabel>
      <TextInput className={cn('h-14 text-[17px]', opts.mono && 'tabular-nums')} type={opts.type} value={form[k]} onChange={(e) => set(k, e.target.value)} placeholder={opts.placeholder} autoComplete="off" />
    </>
  );

  return (
    <div className="flex min-h-full flex-col">
      <ScreenTop title="Modifier le fournisseur" backTo={back} />
      <div className="px-5 pb-6 pt-4">
        <div className={cn('flex items-center gap-3 rounded-lg border px-3.5 py-3', SURFACE.divider)}>
          <MethodCircle method={toMethodKey(payment.method)} />
          <span className="min-w-0 flex-1">
            <span className={cn('block truncate text-[17px] font-semibold', TEXT.strong)}>{yuan(payment.amount_rmb)} · {fullName(payment.profiles)}</span>
            <span className={cn('block text-[15px]', TEXT.muted)}>{payment.reference}</span>
          </span>
          <Tag tone={tag.tone}>{tag.label}</Tag>
        </div>

        {!allowed ? (
          <EmptyLine action={{ label: 'Retour au paiement', onClick: () => navigate(back) }}>Ce fournisseur ne peut plus être modifié.</EmptyLine>
        ) : (
          <>
            {isQrMethod && (
              <>
                <FieldLabel>QR code</FieldLabel>
                <input ref={qrRef} type="file" accept={ACCEPT_IMAGE} className="hidden" onChange={(e) => { pickQr(e.target.files?.[0]); if (qrRef.current) qrRef.current.value = ''; }} />
                {qrShown ? (
                  <div className="flex items-center gap-4">
                    <span className={cn('h-[92px] w-[92px] shrink-0 overflow-hidden rounded-md border bg-white', SURFACE.divider)}>
                      <img src={qrShown} alt="QR du fournisseur" className="h-full w-full object-contain" />
                    </span>
                    <span className="min-w-0">
                      <span className={cn('block text-[17px] font-semibold', TEXT.strong)}>{qrFile ? 'Nouveau QR' : 'QR enregistré'}</span>
                      <button type="button" onClick={() => qrRef.current?.click()} className={cn('mt-2 inline-flex h-11 items-center gap-2 rounded-lg border bg-[#F5F5F5] px-3 text-[16px] font-semibold dark:bg-[#383838]', SURFACE.divider, FOCUS_RING, TEXT.strong)}>
                        <Camera className="h-[18px] w-[18px]" />Changer le QR
                      </button>
                    </span>
                  </div>
                ) : (
                  <PhotoDrop label="Photo ou capture du QR" accept={ACCEPT_IMAGE} onFiles={(f) => pickQr(f[0])} />
                )}
              </>
            )}

            {isBank ? (
              <>
                {field('Titulaire', 'beneficiary_name')}
                {field('Banque', 'beneficiary_bank_name', { placeholder: 'ICBC, Bank of China…' })}
                {field('N° de compte', 'beneficiary_bank_account', { mono: true })}
                {field('SWIFT / IBAN', 'beneficiary_bank_extra')}
              </>
            ) : (
              <>
                {field('Nom', 'beneficiary_name')}
                {isQrMethod && field(payment.method === 'wechat' ? 'ID WeChat' : 'ID Alipay', 'beneficiary_identifier', { placeholder: 'Téléphone, e-mail ou ID' })}
              </>
            )}

            {more ? (
              <>
                {!isBank && field('Téléphone', 'beneficiary_phone', { type: 'tel', placeholder: '+86 138 0000 0000' })}
                {!isBank && field('Email', 'beneficiary_email', { type: 'email' })}
                {isBank && field('Téléphone', 'beneficiary_phone', { type: 'tel' })}
                <FieldLabel>Notes</FieldLabel>
                <TextArea rows={3} value={form.beneficiary_notes} onChange={(e) => set('beneficiary_notes', e.target.value)} />
              </>
            ) : (
              <button type="button" onClick={() => setMore(true)} className={cn('mt-4 flex min-h-[44px] items-center gap-2.5 rounded text-[17px] font-semibold', FOCUS_RING, TEXT.strong)}>
                <Plus className="h-5 w-5" />{isBank ? 'Téléphone, notes' : 'Téléphone, identifiant, notes'}
              </button>
            )}
          </>
        )}
      </div>
      {allowed && <Dock><BigButton onClick={() => void save()} loading={busy || update.isPending}>Enregistrer</BigButton></Dock>}
    </div>
  );
}

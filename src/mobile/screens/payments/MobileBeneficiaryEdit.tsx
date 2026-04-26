// ============================================================
// MODULE PAIEMENTS — MobileBeneficiaryEdit
// Page dédiée pour modifier les infos bénéficiaire d'un paiement.
// Utilise le pattern full-page (comme MobileCreateAdmin) pour
// éviter les problèmes de layout clavier sur iOS.
// ============================================================
import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminPaymentDetail } from '@/hooks/usePayments';
import { useAdminUpdateBeneficiaryInfo } from '@/hooks/useAdminPayments';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { compressImage } from '@/lib/imageCompression';
import { toast } from 'sonner';
import { Loader2, QrCode, X, CheckCircle } from 'lucide-react';
import { SkeletonDetail } from '@/mobile/components/ui/SkeletonCard';

export function MobileBeneficiaryEdit() {
  const { paymentId } = useParams();
  const navigate = useNavigate();

  const { data: payment, isLoading } = useAdminPaymentDetail(paymentId);
  const adminUpdateBeneficiaryInfo = useAdminUpdateBeneficiaryInfo();

  // Form state — pre-filled once payment loads
  const [form, setForm] = useState({
    beneficiary_name: '',
    beneficiary_phone: '',
    beneficiary_email: '',
    beneficiary_qr_code_url: '',
    beneficiary_bank_name: '',
    beneficiary_bank_account: '',
    beneficiary_bank_extra: '',
    beneficiary_notes: '',
    beneficiary_identifier: '',
  });
  const [initialized, setInitialized] = useState(false);

  // QR upload state
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [isUploadingQr, setIsUploadingQr] = useState(false);
  const qrInputRef = useRef<HTMLInputElement>(null);

  // Pre-fill form once payment data is available
  if (payment && !initialized) {
    const p = payment as typeof payment & {
      beneficiary_bank_extra?: string | null;
      beneficiary_identifier?: string | null;
    };
    setForm({
      beneficiary_name: payment.beneficiary_name ?? '',
      beneficiary_phone: payment.beneficiary_phone ?? '',
      beneficiary_email: payment.beneficiary_email ?? '',
      beneficiary_qr_code_url: payment.beneficiary_qr_code_url ?? '',
      beneficiary_bank_name: payment.beneficiary_bank_name ?? '',
      beneficiary_bank_account: payment.beneficiary_bank_account ?? '',
      beneficiary_bank_extra: p.beneficiary_bank_extra ?? '',
      beneficiary_notes: payment.beneficiary_notes ?? '',
      beneficiary_identifier: p.beneficiary_identifier ?? '',
    });
    setInitialized(true);
  }

  const handleSave = async () => {
    if (!payment || !paymentId) return;

    // Validate based on payment method
    if (payment.method === 'alipay' || payment.method === 'wechat') {
      const hasContact = !!(form.beneficiary_phone || form.beneficiary_email);
      const hasQr = !!(qrFile || form.beneficiary_qr_code_url);
      if (!hasContact && !hasQr) {
        toast.error('Fournissez au moins un QR code, un téléphone ou un email');
        return;
      }
    } else if (payment.method === 'bank_transfer') {
      if (!form.beneficiary_name.trim()) { toast.error('Le nom du bénéficiaire est requis'); return; }
      if (!form.beneficiary_bank_name.trim()) { toast.error('Le nom de la banque est requis'); return; }
      if (!form.beneficiary_bank_account.trim()) { toast.error('Le numéro de compte est requis'); return; }
    }

    try {
      let qrUrl = form.beneficiary_qr_code_url;

      if (qrFile && (payment.method === 'alipay' || payment.method === 'wechat')) {
        setIsUploadingQr(true);
        const compressed = await compressImage(qrFile);
        const filePath = `beneficiary/${paymentId}/${Date.now()}_${compressed.name}`;
        const { error: uploadError } = await supabaseAdmin.storage
          .from('payment-proofs')
          .upload(filePath, compressed, { upsert: true });
        if (uploadError) throw uploadError;
        qrUrl = `payment-proofs/${filePath}`;
      }

      const identifier = form.beneficiary_identifier.trim();
      const isAlipayOrWechat =
        payment.method === 'alipay' || payment.method === 'wechat';

      await adminUpdateBeneficiaryInfo.mutateAsync({
        paymentId,
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
          beneficiary_identifier_type: isAlipayOrWechat && identifier ? 'id' : undefined,
        },
      });

      navigate(-1);
    } catch {
      // Error handled by mutation toast
    } finally {
      setIsUploadingQr(false);
    }
  };

  const isBusy = adminUpdateBeneficiaryInfo.isPending || isUploadingQr;

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <MobileHeader title="Modifier bénéficiaire" showBack backTo={`/m/payments/${paymentId}`} />
        <SkeletonDetail />
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="flex flex-col min-h-screen">
        <MobileHeader title="Modifier bénéficiaire" showBack backTo="/m/payments" />
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-muted-foreground">Paiement introuvable</p>
        </div>
      </div>
    );
  }

  // ── Shared input class (text-base = 16px, prevents iOS zoom) ──
  const inputCls = 'w-full h-12 px-4 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-base';

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <MobileHeader
        title="Modifier bénéficiaire"
        showBack
        backTo={`/m/payments/${paymentId}`}
      />

      {/* ── Scrollable form body ─────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-6 space-y-5">

        {/* Bank Transfer */}
        {payment.method === 'bank_transfer' && (
          <>
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-400">
                Renseignez les coordonnées bancaires complètes du bénéficiaire.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Nom du bénéficiaire <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.beneficiary_name}
                  onChange={(e) => setForm(f => ({ ...f, beneficiary_name: e.target.value }))}
                  placeholder="Nom complet"
                  autoComplete="off"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Banque <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.beneficiary_bank_name}
                  onChange={(e) => setForm(f => ({ ...f, beneficiary_bank_name: e.target.value }))}
                  placeholder="Bank of China, ICBC…"
                  autoComplete="off"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Numéro de compte <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.beneficiary_bank_account}
                  onChange={(e) => setForm(f => ({ ...f, beneficiary_bank_account: e.target.value }))}
                  placeholder="Numéro de compte bancaire"
                  autoComplete="off"
                  inputMode="text"
                  className={`${inputCls} font-mono`}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Infos complémentaires <span className="text-muted-foreground font-normal">(SWIFT, IBAN, adresse…)</span>
                </label>
                <input
                  type="text"
                  value={form.beneficiary_bank_extra}
                  onChange={(e) => setForm(f => ({ ...f, beneficiary_bank_extra: e.target.value }))}
                  placeholder="SWIFT / IBAN / adresse banque"
                  autoComplete="off"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Notes <span className="text-muted-foreground font-normal">(optionnel)</span>
                </label>
                <textarea
                  value={form.beneficiary_notes}
                  onChange={(e) => setForm(f => ({ ...f, beneficiary_notes: e.target.value }))}
                  placeholder="Instructions supplémentaires…"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-base resize-none"
                />
              </div>
            </div>
          </>
        )}

        {/* Alipay / WeChat */}
        {(payment.method === 'alipay' || payment.method === 'wechat') && (
          <>
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-400">
                Fournissez au moins un élément : QR code, téléphone ou email.
              </p>
            </div>

            {/* QR Upload */}
            <div>
              <label className="text-sm font-medium mb-2 block">QR Code</label>
              <input
                ref={qrInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setQrFile(file);
                  const reader = new FileReader();
                  reader.onloadend = () => setQrPreview(reader.result as string);
                  reader.readAsDataURL(file);
                }}
              />
              {qrPreview || form.beneficiary_qr_code_url ? (
                <div className="relative">
                  <img
                    src={qrPreview ?? form.beneficiary_qr_code_url}
                    alt="QR Code"
                    className="w-full h-48 object-contain rounded-xl border border-border bg-muted"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setQrFile(null);
                      setQrPreview(null);
                      setForm(f => ({ ...f, beneficiary_qr_code_url: '' }));
                      if (qrInputRef.current) qrInputRef.current.value = '';
                    }}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => qrInputRef.current?.click()}
                  className="w-full h-28 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground active:bg-muted/50"
                >
                  <QrCode className="w-7 h-7" />
                  <span className="text-sm">Importer un QR Code</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">ou</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Téléphone</label>
                <input
                  type="tel"
                  value={form.beneficiary_phone}
                  onChange={(e) => setForm(f => ({ ...f, beneficiary_phone: e.target.value }))}
                  placeholder="+86 138 0000 0000"
                  inputMode="tel"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Email <span className="text-muted-foreground font-normal">(optionnel)</span>
                </label>
                <input
                  type="email"
                  value={form.beneficiary_email}
                  onChange={(e) => setForm(f => ({ ...f, beneficiary_email: e.target.value }))}
                  placeholder="beneficiaire@example.com"
                  inputMode="email"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Nom <span className="text-muted-foreground font-normal">(optionnel)</span>
                </label>
                <input
                  type="text"
                  value={form.beneficiary_name}
                  onChange={(e) => setForm(f => ({ ...f, beneficiary_name: e.target.value }))}
                  placeholder="Nom du bénéficiaire"
                  autoComplete="off"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Identifiant {payment.method === 'wechat' ? 'WeChat' : 'Alipay'}
                  <span className="text-muted-foreground font-normal"> (optionnel)</span>
                </label>
                <input
                  type="text"
                  value={form.beneficiary_identifier}
                  onChange={(e) => setForm(f => ({ ...f, beneficiary_identifier: e.target.value }))}
                  placeholder={payment.method === 'wechat' ? 'WeChat ID / 微信号' : 'Alipay ID / 支付宝账号'}
                  autoComplete="off"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Notes <span className="text-muted-foreground font-normal">(optionnel)</span>
                </label>
                <textarea
                  value={form.beneficiary_notes}
                  onChange={(e) => setForm(f => ({ ...f, beneficiary_notes: e.target.value }))}
                  placeholder="Instructions supplémentaires…"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-base resize-none"
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Sticky footer (pattern MobileCreateAdmin) ─────────── */}
      <div className="sticky bottom-0 bg-background border-t border-border px-4 py-3">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            disabled={isBusy}
            className="flex-1 h-12 rounded-xl border border-border font-medium text-sm disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isBusy}
            className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isBusy ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <CheckCircle className="w-5 h-5" />
            )}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

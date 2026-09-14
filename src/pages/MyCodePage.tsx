// ============================================================
// APP CLIENT — MyCodePage · « Mon identifiant client ».
//
// Un code, deux usages, et la page est bâtie dans cet ordre :
//   1. le CODE et son QR, gros, copiables — ce que le client vient chercher ;
//   2. VIREMENT : « écrivez ce code dans le libellé » ;
//   3. COLIS : l'étiquette bilingue à envoyer au fournisseur chinois
//      (image pour WeChat, PDF pour l'imprimante).
// L'étiquette est rendue hors écran à taille fixe et rasterisée à la
// demande (voir ShippingLabel / exportShippingLabel).
// ============================================================
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Check, Copy, Landmark, Loader2, Package } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { useMyProfile } from '@/hooks/useProfile';
import { useShippingSettings } from '@/hooks/useShippingSettings';
import { customerQrPayload, DEFAULT_SHIPPING_SETTINGS } from '@/lib/customerCode';
import { ShippingLabelComposer } from '@/components/customer-code/ShippingLabelComposer';
import { SURFACE, TEXT, PRIMARY_PILL, SOFT_PILL } from '@/mobile/designKit';

const MyCodePage = () => {
  const { t } = useTranslation('client');
  const navigate = useNavigate();
  const { data: profile, isLoading } = useMyProfile();
  const { data: shipping } = useShippingSettings();
  const [copied, setCopied] = useState(false);

  const code = profile?.customer_code ?? '';
  const clientName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : '';

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success(t('myCode.copied', { defaultValue: 'Identifiant copié' }));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('myCode.copyFailed', { defaultValue: 'Copie impossible' }));
    }
  };


  return (
    <MobileLayout showNav={false} showHeader={false}>
      <div className={cn('min-h-[100dvh] pb-8', SURFACE.canvas)}>
        {/* En-tête */}
        <div className="flex items-center gap-3 px-4 pb-1 pt-4">
          <button
            onClick={() => navigate(-1)}
            aria-label={t('myCode.back', { defaultValue: 'Retour' })}
            className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition active:scale-95', SURFACE.card, SURFACE.shadow)}
          >
            <ArrowLeft className={cn('h-5 w-5', TEXT.strong)} />
          </button>
          <h1 className={cn('flex-1 truncate text-[17px] font-black', TEXT.strong)}>{t('myCode.title', { defaultValue: 'Mon identifiant client' })}</h1>
        </div>

        <div className="space-y-4 px-4 pt-3">
          {/* 1. Le code */}
          <section className={cn('rounded-[26px] p-6', SURFACE.card, SURFACE.shadow)}>
            {isLoading || !code ? (
              <div className="flex h-[300px] items-center justify-center">
                <Loader2 className={cn('h-6 w-6 animate-spin', TEXT.muted)} />
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="rounded-[22px] bg-white p-4 ring-1 ring-black/[0.06]">
                  <QRCodeSVG value={customerQrPayload(code)} size={196} level="H" marginSize={0} />
                </div>
                <div className={cn('mt-5 text-[11px] font-bold uppercase tracking-[0.18em]', TEXT.muted)}>
                  {t('myCode.label', { defaultValue: 'Identifiant client' })}
                </div>
                <div className={cn('mt-1 text-[40px] font-black leading-none tracking-[0.06em] tabular-nums', TEXT.strong)}>{code}</div>
                <div className={cn('mt-1.5 text-center text-[13px]', TEXT.muted)}>{clientName}</div>
                <button
                  type="button"
                  onClick={copyCode}
                  className={cn('mt-5 flex items-center gap-2 px-5 py-3 text-[14px] font-bold transition active:scale-[0.98]', copied ? SOFT_PILL : PRIMARY_PILL)}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? t('myCode.copied', { defaultValue: 'Identifiant copié' }) : t('myCode.copy', { defaultValue: 'Copier l’identifiant' })}
                </button>
              </div>
            )}
          </section>

          {/* 2. Virement */}
          <section className={cn('rounded-[22px] p-4', SURFACE.card, SURFACE.shadow)}>
            <div className="flex items-start gap-3.5">
              <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', SURFACE.holder)}>
                <Landmark className="h-5 w-5" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className={cn('text-[15px] font-bold', TEXT.strong)}>{t('myCode.bankTitle', { defaultValue: 'Vos virements bancaires' })}</h2>
                <p className={cn('mt-1 text-[13px] leading-snug', TEXT.body)}>
                  {t('myCode.bankBody', { defaultValue: 'Indiquez cet identifiant dans le libellé (motif) de chaque virement ou dépôt bancaire. Votre compte est crédité sans délai de recherche.' })}
                </p>
                <div className={cn('mt-3 flex items-center justify-between rounded-xl px-3 py-2.5', SURFACE.inset)}>
                  <div className="min-w-0">
                    <div className={cn('text-[10.5px] font-bold uppercase tracking-wider', TEXT.muted)}>{t('myCode.bankMotif', { defaultValue: 'Libellé du virement' })}</div>
                    <div className={cn('text-[15px] font-black tabular-nums', TEXT.strong)}>{code || '—'}</div>
                  </div>
                  <button type="button" onClick={copyCode} aria-label={t('myCode.copy', { defaultValue: 'Copier l’identifiant' })} className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', SURFACE.holder)}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* 3. Colis */}
          <section className={cn('rounded-[22px] p-4', SURFACE.card, SURFACE.shadow)}>
            <div className="flex items-start gap-3.5">
              <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', SURFACE.holder)}>
                <Package className="h-5 w-5" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className={cn('text-[15px] font-bold', TEXT.strong)}>{t('myCode.cargoTitle', { defaultValue: 'Vos colis depuis la Chine' })}</h2>
                <p className={cn('mt-1 text-[13px] leading-snug', TEXT.body)}>
                  {t('myCode.cargoBody', { defaultValue: 'Envoyez cette étiquette à votre fournisseur : il la colle sur chaque carton. À l’arrivée dans notre entrepôt, un scan suffit pour rattacher vos colis à votre compte.' })}
                </p>
              </div>
            </div>

            <ShippingLabelComposer
              className="mt-4"
              code={code}
              clientName={clientName}
              clientPhone={profile?.phone}
              clientEmail={profile?.email}
              companyName={profile?.company_name}
              clientCity={profile?.city}
              clientCountry={profile?.country}
              settings={shipping ?? DEFAULT_SHIPPING_SETTINGS}
            />
          </section>

          <p className={cn('px-2 text-center text-[11.5px] leading-snug', TEXT.muted)}>
            {t('myCode.footnote', { defaultValue: 'Cet identifiant est permanent : il ne change jamais, même si vous modifiez vos coordonnées.' })}
          </p>
        </div>
      </div>
    </MobileLayout>
  );
};

export default MyCodePage;

// ============================================================
// COMPOSEUR D'ÉTIQUETTE — le même bloc côté client (page « Mon identifiant »)
// et côté admin (fiche client) : on choisit la destination, on renseigne le
// fournisseur si on le connaît, on regarde l'aperçu, on partage ou on
// imprime. L'étiquette elle-même (ShippingLabel) est rendue à taille réelle,
// réduite à l'échelle pour l'aperçu, et rasterisée telle quelle à l'export.
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDown, Loader2, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  DESTINATION_LABEL,
  SHIPPING_DESTINATIONS,
  isLocationConfigured,
  type ShippingDestination,
  type ShippingSettings,
} from '@/lib/customerCode';
import { prewarmFontEmbedCss } from '@/lib/nodeImage';
import { ShippingLabel, LABEL_W, LABEL_H, type LabelSupplierInfo } from './ShippingLabel';
import { shareShippingLabel, downloadShippingLabelPdf } from './exportShippingLabel';
import { SURFACE, TEXT, PRIMARY_PILL, SOFT_PILL, Segmented, TextInput } from '@/mobile/designKit';

export interface ShippingLabelComposerProps {
  code: string;
  clientName: string;
  clientPhone?: string | null;
  clientEmail?: string | null;
  companyName?: string | null;
  clientCity?: string | null;
  clientCountry?: string | null;
  /** Adresses + coordonnées (platform_settings) — fournies par l'app appelante. */
  settings: ShippingSettings;
  /** `split` (desktop) : réglages à gauche, aperçu à droite ; `stack` (mobile) : l'un sous l'autre. */
  layout?: 'stack' | 'split';
  className?: string;
}

export function ShippingLabelComposer({ code, clientName, clientPhone, clientEmail, companyName, clientCity, clientCountry, settings, layout = 'stack', className }: ShippingLabelComposerProps) {
  const { t } = useTranslation('client');
  const labelRef = useRef<HTMLDivElement>(null);
  // Entrepôt par défaut : c'est la destination de la plupart des envois ;
  // le bureau est indiqué au cas par cas.
  const [destination, setDestination] = useState<ShippingDestination>('warehouse');
  const [supplier, setSupplier] = useState<LabelSupplierInfo>({});
  const [busy, setBusy] = useState<'share' | 'pdf' | null>(null);

  const destConfigured = isLocationConfigured(settings[destination]);
  const canExport = !!code && destConfigured && busy === null;

  // La CSS des polices (dont les sous-ensembles Noto SC, lourds) se calcule
  // une fois par session : on la lance dès l'ouverture, pas au premier clic.
  useEffect(() => {
    if (labelRef.current) prewarmFontEmbedCss(labelRef.current);
  }, []);

  const run = async (kind: 'share' | 'pdf') => {
    if (!labelRef.current || !canExport) return;
    setBusy(kind);
    try {
      if (kind === 'share') {
        const outcome = await shareShippingLabel(labelRef.current, code, destination);
        if (outcome === 'downloaded') toast.success(t('myCode.labelDownloaded', { defaultValue: 'Étiquette téléchargée' }));
      } else {
        await downloadShippingLabelPdf(labelRef.current, code, destination);
      }
    } catch (err) {
      console.error('shipping label export', err);
      toast.error(t('myCode.labelError', { defaultValue: 'Impossible de générer l’étiquette' }));
    } finally {
      setBusy(null);
    }
  };

  const field = (key: keyof LabelSupplierInfo, placeholder: string) => (
    <TextInput
      value={supplier[key] ?? ''}
      onChange={(e) => setSupplier((s) => ({ ...s, [key]: e.target.value }))}
      placeholder={placeholder}
      autoComplete="off"
      className="h-11 text-[15px]"
    />
  );

  const controls = (
    <div className="space-y-3">
      {/* 1 · Destination : une étiquette = une adresse */}
      <div>
        <Segmented
          value={destination}
          onChange={setDestination}
          options={SHIPPING_DESTINATIONS.map((d) => ({
            value: d,
            label: t(`myCode.dest.${d}`, { defaultValue: DESTINATION_LABEL[d].fr }),
          }))}
        />
        <p className={cn('mt-2 px-1 text-[14px] leading-snug', TEXT.muted)}>
          {destination === 'warehouse'
            ? t('myCode.destHintWarehouse', { defaultValue: 'Pour la plupart des envois. Le fournisseur livre directement à notre entrepôt.' })
            : t('myCode.destHintOffice', { defaultValue: 'Uniquement si Bonzini vous l’a demandé pour cet envoi.' })}
        </p>
        {!destConfigured && (
          <p className={cn('mt-2 rounded-lg px-3 py-2 text-[14px]', SURFACE.inset, TEXT.body)}>
            {t('myCode.destUnavailable', { defaultValue: 'Adresse en cours de mise à jour — l’étiquette sera disponible très bientôt.' })}
          </p>
        )}
      </div>

      {/* 2 · Fournisseur (facultatif) : imprimé s'il est connu, sinon lignes vides */}
      <div className={cn('rounded-2xl p-3', SURFACE.inset)}>
        <div className={cn('mb-2 text-[14px] font-semibold uppercase tracking-wider', TEXT.muted)}>
          {t('myCode.supplierTitle', { defaultValue: 'Fournisseur (facultatif)' })}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {field('name', t('myCode.supplierName', { defaultValue: 'Nom' }))}
          {field('phone', t('myCode.supplierPhone', { defaultValue: 'Téléphone' }))}
          <div className="col-span-2">{field('email', t('myCode.supplierEmail', { defaultValue: 'E-mail' }))}</div>
          <div className="col-span-2">{field('address', t('myCode.supplierAddress', { defaultValue: 'Adresse (en Chine)' }))}</div>
        </div>
        <p className={cn('mt-2 text-[14px] leading-snug', TEXT.muted)}>
          {t('myCode.supplierHint', { defaultValue: 'Laissez vide : le fournisseur remplira ces lignes au stylo.' })}
        </p>
      </div>

    </div>
  );
  const preview = (
    <div className="space-y-3">
      {/* 3 · Aperçu à l'échelle du même nœud que celui exporté */}
      <div className="overflow-hidden rounded-2xl ring-1 ring-black/[0.06] dark:ring-white/[0.08]">
        <div className="relative w-full" style={{ aspectRatio: `${LABEL_W} / ${LABEL_H}` }}>
          {code && (
            <div
              className="absolute left-0 top-0 origin-top-left"
              style={{ width: LABEL_W, height: LABEL_H, transform: 'scale(var(--label-scale, 0.5))' }}
              ref={(el) => {
                // Échelle = largeur disponible / largeur naturelle, au montage.
                if (!el?.parentElement) return;
                const w = el.parentElement.clientWidth;
                if (w > 0) el.style.setProperty('--label-scale', String(w / LABEL_W));
              }}
            >
              <ShippingLabel
                ref={labelRef}
                code={code}
                clientName={clientName}
                clientPhone={clientPhone}
                clientEmail={clientEmail}
                companyName={companyName}
                clientCity={clientCity}
                clientCountry={clientCountry}
                destination={destination}
                settings={settings}
                supplier={supplier}
              />
            </div>
          )}
        </div>
      </div>

      {/* 4 · Sortie : image pour WeChat / WhatsApp, PDF A4 pour l'imprimante */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => run('share')}
          disabled={!canExport}
          className={cn('flex items-center justify-center gap-2 py-3 text-[14px] font-bold transition active:scale-[0.98] disabled:opacity-60', PRIMARY_PILL)}
        >
          {busy === 'share' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
          {t('myCode.shareLabel', { defaultValue: 'Partager l’image' })}
        </button>
        <button
          type="button"
          onClick={() => run('pdf')}
          disabled={!canExport}
          className={cn('flex items-center justify-center gap-2 py-3 text-[14px] font-bold transition active:scale-[0.98] disabled:opacity-60', SOFT_PILL)}
        >
          {busy === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
          {t('myCode.downloadPdf', { defaultValue: 'PDF à imprimer' })}
        </button>
      </div>
    </div>
  );

  if (layout === 'split') {
    return (
      <div className={cn('grid grid-cols-[minmax(0,1fr)_440px] gap-5', className)}>
        {controls}
        {preview}
      </div>
    );
  }
  return (
    <div className={cn('space-y-3', className)}>
      {controls}
      {preview}
    </div>
  );
}

// ============================================================
// COMPOSEUR D'ÉTIQUETTE — le même bloc côté client (page « Mon identifiant »)
// et côté admin (fiche client) : on choisit la destination, on renseigne le
// fournisseur si on le connaît, on regarde l'aperçu, on partage ou on
// imprime. L'étiquette elle-même (ShippingLabel) est rendue à taille réelle,
// réduite à l'échelle pour l'aperçu, et rasterisée telle quelle à l'export.
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Download, FileDown, Loader2, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  DESTINATION_HINT_FR,
  DESTINATION_LABEL,
  SHIPPING_DESTINATIONS,
  isLocationConfigured,
  type ShippingDestination,
  type ShippingSettings,
} from '@/lib/customerCode';
import { prewarmFontEmbedCss } from '@/lib/nodeImage';
import { ShippingLabel, LABEL_W, LABEL_H, type LabelSupplierInfo } from './ShippingLabel';
import { shareShippingLabel, downloadShippingLabelPdf, downloadShippingLabelPng, copyShippingLabelPng } from './exportShippingLabel';
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
  /** `admin` : copier / télécharger l'image + PDF ; `client` : partager l'image (WeChat, WhatsApp) + PDF. */
  mode?: 'admin' | 'client';
  className?: string;
}

export function ShippingLabelComposer({ code, clientName, clientPhone, clientEmail, companyName, clientCity, clientCountry, settings, layout = 'stack', mode = 'client', className }: ShippingLabelComposerProps) {
  const { t } = useTranslation('client');
  const labelRef = useRef<HTMLDivElement>(null);
  // Sea cargo (entrepôt) par défaut : c'est le mode de la plupart des envois ;
  // l'air cargo (bureau) est indiqué au cas par cas.
  const [destination, setDestination] = useState<ShippingDestination>('warehouse');
  const [supplier, setSupplier] = useState<LabelSupplierInfo>({});
  const [busy, setBusy] = useState<'share' | 'copy' | 'png' | 'pdf' | null>(null);

  const destConfigured = isLocationConfigured(settings[destination]);
  const canExport = !!code && destConfigured && busy === null;

  // Téléphone (pointeur tactile) : export en mode rapide — pas d'incorporation
  // des polices (plusieurs Mo de Noto SC à télécharger et encoder : c'est ce
  // qui gelait l'iPhone), ×2 au lieu de ×3. Voir exportShippingLabel.ts.
  const fast = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;

  // La CSS des polices (dont les sous-ensembles Noto SC, lourds) se calcule
  // une fois par session : on la lance dès l'ouverture, pas au premier clic.
  useEffect(() => {
    if (!fast && labelRef.current) prewarmFontEmbedCss(labelRef.current);
  }, [fast]);

  const run = async (kind: 'share' | 'copy' | 'png' | 'pdf') => {
    if (!labelRef.current || !canExport) return;
    setBusy(kind);
    try {
      if (kind === 'share') {
        const outcome = await shareShippingLabel(labelRef.current, code, destination, { fast });
        if (outcome === 'downloaded') toast.success(t('myCode.labelDownloaded', { defaultValue: 'Étiquette téléchargée' }));
      } else if (kind === 'copy') {
        const outcome = await copyShippingLabelPng(labelRef.current, code, destination, { fast });
        toast.success(
          outcome === 'copied'
            ? t('myCode.imageCopied', { defaultValue: 'Image copiée — collez-la dans WeChat, WhatsApp ou un e-mail' })
            : t('myCode.labelDownloaded', { defaultValue: 'Étiquette téléchargée' }),
        );
      } else if (kind === 'png') {
        await downloadShippingLabelPng(labelRef.current, code, destination, { fast });
        toast.success(t('myCode.labelDownloaded', { defaultValue: 'Étiquette téléchargée' }));
      } else {
        await downloadShippingLabelPdf(labelRef.current, code, destination, { fast });
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
            ? t('myCode.destHintWarehouse', { defaultValue: DESTINATION_HINT_FR.warehouse })
            : t('myCode.destHintOffice', { defaultValue: DESTINATION_HINT_FR.office })}
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
          {t('myCode.supplierHint', { defaultValue: 'Facultatif : ce que vous saisissez s’imprime sur l’étiquette.' })}
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

      {/* 4 · Sortie. Admin : copier / télécharger l'image, PDF. Client (téléphone) : partager, PDF. */}
      {(() => {
        const btn = (kind: 'share' | 'copy' | 'png' | 'pdf', Icon: typeof Copy, label: string, primary: boolean, wide = false) => (
          <button
            key={kind}
            type="button"
            onClick={() => run(kind)}
            disabled={!canExport}
            className={cn('flex h-11 items-center justify-center gap-2 whitespace-nowrap px-4 text-[15px] font-bold transition active:scale-[0.98] disabled:opacity-60', wide && 'col-span-2', primary ? PRIMARY_PILL : SOFT_PILL)}
          >
            {busy === kind ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
            {label}
          </button>
        );
        return mode === 'admin' ? (
          <div className="grid grid-cols-2 gap-2.5">
            {btn('copy', Copy, t('myCode.copyImage', { defaultValue: 'Copier l’image' }), true, true)}
            {btn('png', Download, t('myCode.downloadImage', { defaultValue: 'Télécharger l’image' }), false)}
            {btn('pdf', FileDown, t('myCode.downloadPdf', { defaultValue: 'PDF à imprimer' }), false)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {btn('share', Share2, t('myCode.shareLabel', { defaultValue: 'Partager l’image' }), true)}
            {btn('pdf', FileDown, t('myCode.downloadPdf', { defaultValue: 'PDF à imprimer' }), false)}
          </div>
        );
      })()}
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

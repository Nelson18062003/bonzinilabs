// ============================================================
// COMPOSEUR D'ÉTIQUETTE — le même bloc côté client (page « Mon identifiant »)
// et côté admin desktop (fiche client) : on choisit le mode d'envoi, on
// renseigne le fournisseur si on le connaît, on regarde l'aperçu, on envoie
// ou on imprime. L'aperçu EST l'image exportée (peinte sur canvas, voir
// src/lib/shippingLabelCanvas.ts) : ce qu'on voit est ce qui part.
// ============================================================
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Download, FileDown, Loader2, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DESTINATION_HINT_FR,
  DESTINATION_LABEL,
  SHIPPING_DESTINATIONS,
  isLocationConfigured,
  type ShippingDestination,
  type ShippingSettings,
} from '@/lib/customerCode';
import type { LabelSupplierInfo } from '@/lib/shippingLabelCanvas';
import { DestinationMark } from './DestinationMark';
import { useShippingLabel, ShippingLabelPreview } from './useShippingLabel';
import { canShareFiles } from './exportShippingLabel';
import { useLabelExport, type LabelExportKind as Kind } from './useLabelExport';
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
  /** `admin` : copier / télécharger l'image + PDF ; `client` : envoyer l'image et le PDF (WeChat, WhatsApp). */
  mode?: 'admin' | 'client';
  className?: string;
}

export function ShippingLabelComposer({ code, clientName, clientPhone, clientEmail, companyName, clientCity, clientCountry, settings, layout = 'stack', mode = 'client', className }: ShippingLabelComposerProps) {
  const { t } = useTranslation('client');
  // Sea cargo (entrepôt) par défaut : c'est le mode de la plupart des envois ;
  // l'air cargo (bureau) est indiqué au cas par cas.
  const [destination, setDestination] = useState<ShippingDestination>('warehouse');
  const [supplier, setSupplier] = useState<LabelSupplierInfo>({});
  const { preview, render, qr } = useShippingLabel({ code, clientName, clientPhone, clientEmail, companyName, clientCity, clientCountry, destination, settings, supplier });

  const destConfigured = isLocationConfigured(settings[destination]);
  const { busy, canRun: canExport, run } = useLabelExport(render, code, destination, !!code && destConfigured, {
    downloaded: t('myCode.labelDownloaded', { defaultValue: 'Étiquette téléchargée' }),
    pdfDownloaded: t('myCode.labelDownloaded', { defaultValue: 'Étiquette téléchargée' }),
    copied: t('myCode.imageCopied', { defaultValue: 'Image copiée — collez-la dans WeChat, WhatsApp ou un e-mail' }),
    error: t('myCode.labelError', { defaultValue: 'Impossible de générer l’étiquette' }),
  });

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
      {/* 1 · Le mode d'envoi : une étiquette = une adresse */}
      <div>
        <Segmented
          value={destination}
          onChange={setDestination}
          options={SHIPPING_DESTINATIONS.map((d) => ({
            value: d,
            label: <DestinationMark destination={d}>{t(`myCode.dest.${d}`, { defaultValue: DESTINATION_LABEL[d].fr })}</DestinationMark>,
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

  const btn = (kind: Kind, Icon: typeof Copy, label: string, primary: boolean, wide = false) => (
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
  const share = canShareFiles();
  const actions = mode === 'admin' ? (
    <div className="grid grid-cols-2 gap-2.5">
      {btn('copy', Copy, t('myCode.copyImage', { defaultValue: 'Copier l’image' }), true, true)}
      {btn('png', Download, t('myCode.downloadImage', { defaultValue: 'Télécharger l’image' }), false)}
      {btn('pdf', FileDown, t('myCode.downloadPdf', { defaultValue: 'PDF à imprimer' }), false)}
    </div>
  ) : (
    <div className="grid grid-cols-2 gap-2.5">
      {share
        ? btn('share', Share2, t('myCode.shareLabel', { defaultValue: 'Partager l’image' }), true)
        : btn('png', Download, t('myCode.downloadImage', { defaultValue: 'Télécharger l’image' }), true)}
      {share
        ? btn('sharePdf', FileDown, t('myCode.sharePdf', { defaultValue: 'Partager le PDF' }), false)
        : btn('pdf', FileDown, t('myCode.downloadPdf', { defaultValue: 'PDF à imprimer' }), false)}
    </div>
  );

  const previewBlock = (
    <div className="space-y-3">
      {qr}
      {code && <ShippingLabelPreview src={preview} />}
      {actions}
    </div>
  );

  if (layout === 'split') {
    return (
      <div className={cn('grid grid-cols-[minmax(0,1fr)_440px] gap-5', className)}>
        {controls}
        {previewBlock}
      </div>
    );
  }
  return (
    <div className={cn('space-y-3', className)}>
      {controls}
      {previewBlock}
    </div>
  );
}

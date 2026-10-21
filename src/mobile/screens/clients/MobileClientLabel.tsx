/**
 * Fiche client › Étiquette colis (maquette 10/09) : Bateau ou Avion, l'image
 * exacte qui part (QR, BZ-…, destinataire et adresse en chinois), le bloc
 * fournisseur facultatif, puis « Envoyer l'image » (la feuille de partage :
 * un vrai fichier), le PDF et « Copier BZ-… ». Les autres sorties
 * (télécharger l'image ou le PDF, copier l'image) sont dans le rond du haut.
 * Une seule carte pour le code, au lieu de deux (étiquette + identifiant).
 * Mêmes peintre et exports que la feuille d'avant (useShippingLabel,
 * useLabelExport) ; l'adresse vient de Réglages › Expédition.
 */
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Share } from 'lucide-react';
import { useClient } from '@/hooks/useClientManagement';
import { useAdminShippingSettings } from '@/hooks/useShippingSettings';
import { DEFAULT_SHIPPING_SETTINGS, isLocationConfigured, type ShippingDestination } from '@/lib/customerCode';
import { useShippingLabel, ShippingLabelPreview } from '@/components/customer-code/useShippingLabel';
import { canShareFiles } from '@/components/customer-code/exportShippingLabel';
import { useLabelExport } from '@/components/customer-code/useLabelExport';
import { cn } from '@/lib/utils';
import { ActionSheet, BigButton, BoxSegmented, Dock, RoundButton, ScreenLoader, ScreenTop, TEXT, useSheet } from '@/mobile/designKit';
import { BigInput, FieldLabel, copyText } from './parts';

export function MobileClientLabel() {
  const { clientId = '' } = useParams();
  const { data: client, isLoading } = useClient(clientId);
  const { data: shipping } = useAdminShippingSettings();
  const settings = shipping ?? DEFAULT_SHIPPING_SETTINGS;
  const [destination, setDestination] = useState<ShippingDestination>('warehouse');
  const [supplier, setSupplier] = useState('');
  const more = useSheet();

  const code = client?.customerCode ?? '';
  const name = client ? `${client.firstName} ${client.lastName}`.trim() : '';
  const { preview, render, qr } = useShippingLabel(
    {
      code,
      clientName: name,
      clientPhone: client?.phone,
      clientEmail: client?.email,
      companyName: client?.companyName,
      clientCity: client?.city,
      clientCountry: client?.country,
      destination,
      settings,
      supplier: supplier.trim() ? { name: supplier.trim() } : undefined,
    },
    { active: !!client },
  );
  const configured = isLocationConfigured(settings[destination]);
  const share = canShareFiles();
  const { busy, canRun, run } = useLabelExport(render, code, destination, !!code && configured, {
    downloaded: 'Étiquette téléchargée',
    pdfDownloaded: 'PDF téléchargé',
    copied: 'Image copiée',
    error: "Impossible de générer l'étiquette. Réessaie dans un instant.",
  });

  if (isLoading || !client) return <ScreenLoader className="min-h-[100dvh]" />;

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-[#1E1E1E]">
      {qr}
      <ScreenTop
        title="Étiquette colis"
        backTo={`/m/clients/${client.id}`}
        right={<RoundButton icon={Share} ariaLabel="Autres sorties" onClick={more.show} className="border-0" />}
      />
      <div className="px-5 pb-4 pt-5">
        <BoxSegmented<ShippingDestination>
          ariaLabel="Mode d'envoi"
          options={[{ value: 'warehouse', label: 'Bateau' }, { value: 'office', label: 'Avion' }]}
          value={destination}
          onChange={setDestination}
        />
        {!configured && (
          <p className="mt-3 text-[15px] font-semibold text-[#975102] dark:text-[#E8B931]">Adresse à renseigner dans Réglages › Expédition.</p>
        )}
        <ShippingLabelPreview src={preview} className="mt-4" />
        <FieldLabel htmlFor="lb-supplier" className="mt-5">Fournisseur · facultatif</FieldLabel>
        <BigInput id="lb-supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Guangzhou Hengtai Trading" maxLength={80} />
        <p className={cn('mt-3 text-[15px]', TEXT.muted)}>{code}</p>
      </div>
      {/* Le dock porte deux rangées : sa cale n'en compte qu'une. */}
      <div aria-hidden className="h-16" />
      <Dock>
        <BigButton onClick={() => void run(share ? 'share' : 'png')} disabled={!canRun} loading={busy === 'share' || busy === 'png'}>
          {share ? "Envoyer l'image" : "Télécharger l'image"}
        </BigButton>
        <div className="grid grid-cols-2 gap-2.5">
          <BigButton variant="soft" onClick={() => void run(share ? 'sharePdf' : 'pdf')} disabled={!canRun} loading={busy === 'sharePdf' || busy === 'pdf'}>PDF</BigButton>
          <BigButton variant="soft" onClick={() => void copyText(code, 'Identifiant copié')} disabled={!code}>Copier le code</BigButton>
        </div>
      </Dock>
      <ActionSheet
        open={more.open}
        onClose={more.hide}
        actions={[
          { label: "Télécharger l'image", onClick: () => void run('png'), disabled: !canRun },
          { label: 'Télécharger le PDF', onClick: () => void run('pdf'), disabled: !canRun },
          { label: "Copier l'image", onClick: () => void run('copy'), disabled: !canRun },
        ]}
      />
    </div>
  );
}

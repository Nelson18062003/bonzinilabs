// ============================================================
// Desktop admin — les étiquettes d'un dépôt, au même endroit :
//   · « Colis » : l'étiquette interne (入库标签) de chaque carton — on coche
//     ceux qu'on veut, on regarde l'aperçu exact, on télécharge le PDF (une
//     page 100 × 150 mm par carton), l'image d'un carton, ou on imprime ;
//   · « Client » : la marque du client (son étiquette d'expédition), partie
//     du mode et du fournisseur du dépôt, modifiables.
// L'aperçu EST l'image produite.
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, FileDown, Printer, Tag, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminShippingSettings } from '@/hooks/useShippingSettings';
import { DEFAULT_SHIPPING_SETTINGS } from '@/lib/customerCode';
import { clientFullName, depositSupplier, formatKg, labelPosition, type Deposit } from '@/lib/reception';
import { ShippingLabelComposer } from '@/components/customer-code/ShippingLabelComposer';
import { downloadFile } from '@/components/customer-code/exportShippingLabel';
import { ParcelThumb, useReceptionLabels } from '@/mobile/components/reception/bits';
import { openForPrint, useParcelLabels } from './useParcelLabels';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, SOFT_PILL, PRIMARY_PILL, CenterDialog } from '@/desktop/designKit';

type LabelTab = 'parcels' | 'client';

export function DepositLabelsDialog({ deposit, open, onClose, initialTab = 'parcels', focusParcelId }: {
  deposit: Deposit;
  open: boolean;
  onClose: () => void;
  initialTab?: LabelTab;
  /** Ouvrir sur ce colis (et lui seul coché). */
  focusParcelId?: string | null;
}) {
  const { data: settingsData } = useAdminShippingSettings();
  const settings = settingsData ?? DEFAULT_SHIPPING_SETTINGS;
  const labels = useReceptionLabels();
  const [tab, setTab] = useState<LabelTab>(initialTab);
  const parcels = useMemo(() => [...deposit.parcels].sort((a, b) => a.seq - b.seq), [deposit.parcels]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focus, setFocus] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<'pdf' | 'png' | 'print' | null>(null);

  const items = useMemo(() => parcels.map((parcel) => ({ parcel, deposit })), [parcels, deposit]);
  const maker = useParcelLabels(items, settings, open && tab === 'parcels');

  // À l'ouverture : l'onglet demandé, tous les colis cochés (ou le seul demandé).
  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    const start = focusParcelId && parcels.some((p) => p.id === focusParcelId) ? focusParcelId : parcels[0]?.id ?? null;
    setSelected(new Set(focusParcelId ? [focusParcelId] : parcels.map((p) => p.id)));
    setFocus(start);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, deposit.id, focusParcelId, initialTab]);

  // L'aperçu du colis affiché, repeint quand on change de colis ou que les QR sont prêts.
  useEffect(() => {
    if (!open || tab !== 'parcels' || !focus || !maker.ready) return;
    let alive = true;
    setPreview(null);
    maker.render(focus, 1.5).then((c) => { if (alive) setPreview(c.toDataURL('image/png')); }).catch(() => { if (alive) setPreview(null); });
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab, focus, maker.ready, deposit]);

  const client = deposit.client;
  const chosen = parcels.filter((p) => selected.has(p.id)).map((p) => p.id);
  const focusIndex = parcels.findIndex((p) => p.id === focus);
  const focusParcel = focusIndex >= 0 ? parcels[focusIndex] : null;
  const base = `bonzini-etiquettes-${deposit.deposit_no}${client ? `-${client.customer_code}` : ''}`;
  const allOn = chosen.length === parcels.length;

  const run = async (what: 'pdf' | 'png' | 'print') => {
    setBusy(what);
    try {
      if (what === 'png') {
        if (!focus) return;
        downloadFile(await maker.pngFile(focus));
        toast.success(`Image ${focusParcel?.parcel_no ?? ''} téléchargée`);
        return;
      }
      const name = chosen.length === parcels.length ? base : chosen.length === 1 ? `bonzini-etiquette-${parcels.find((p) => p.id === chosen[0])?.parcel_no}` : `${base}-${chosen.length}-colis`;
      const file = await maker.pdfFile(chosen, `${name}.pdf`);
      if (what === 'print') {
        if (!openForPrint(file)) { downloadFile(file); toast.success('PDF téléchargé : ouvrez-le pour imprimer'); }
      } else {
        downloadFile(file);
        toast.success(`PDF de ${chosen.length} étiquette${chosen.length > 1 ? 's' : ''} téléchargé`);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const tabBtn = (key: LabelTab, Icon: typeof Tag, label: string, hint: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === key}
      onClick={() => setTab(key)}
      className={cn('-mb-px flex items-center gap-2 border-b-2 px-1 pb-2.5 text-[13.5px] transition-colors', tab === key ? cn('border-foreground font-bold', TEXT.strong) : cn('border-transparent font-medium hover:text-foreground', TEXT.muted))}
    >
      <Icon className="h-4 w-4" /> {label} <span className={cn('text-[11.5px] font-normal', TEXT.muted)}>{hint}</span>
    </button>
  );

  return (
    <CenterDialog
      open={open}
      onClose={onClose}
      width={980}
      title={
        <span className="block">
          <span className={cn('block text-[16px] font-bold', TEXT.strong)}>Étiquettes · {deposit.deposit_no}</span>
          <span className={cn('block text-[12px]', TEXT.muted)}>{client ? `${clientFullName(client)} · ${client.customer_code}` : 'Dépôt sans client'} · {parcels.length} colis</span>
        </span>
      }
    >
      {maker.nodes}
      <div role="tablist" className="mb-4 flex gap-6 border-b border-border">
        {tabBtn('parcels', Tag, 'Colis', '入库标签 · une par carton')}
        {tabBtn('client', UserRound, 'Client', 'la marque d’expédition')}
      </div>

      {!client ? (
        <div className={cn('rounded-lg px-4 py-6 text-center text-[13px]', SURFACE.inset, TEXT.muted)}>
          Ce dépôt n'a pas encore de client : son QR porte le code client. Attribuez-le d'abord, les étiquettes seront prêtes.
        </div>
      ) : tab === 'parcels' ? (
        <div className="grid grid-cols-[minmax(0,1fr)_340px] gap-5">
          {/* La liste : cocher ce qu'on imprime ; cliquer pour voir l'aperçu. */}
          <div className="min-w-0">
            <div className="mb-2 flex items-center justify-between">
              <label className={cn('flex cursor-pointer items-center gap-2 text-[12.5px] font-semibold', TEXT.strong)}>
                <input type="checkbox" className="h-4 w-4 accent-current" checked={allOn} onChange={() => setSelected(allOn ? new Set() : new Set(parcels.map((p) => p.id)))} />
                Tout cocher
              </label>
              <span className={cn('text-[12px] tabular-nums', TEXT.muted)}>{chosen.length} sur {parcels.length} cochés</span>
            </div>
            <ul className="max-h-[420px] overflow-y-auto rounded-lg ring-1 ring-border">
              {parcels.map((p) => {
                const on = selected.has(p.id);
                return (
                  <li key={p.id} className={cn('flex items-center gap-3 border-t border-border px-3 py-2 first:border-t-0', focus === p.id && 'bg-accent')}>
                    <input type="checkbox" aria-label={`Imprimer ${p.parcel_no}`} className="h-4 w-4 shrink-0" checked={on} onChange={() => setSelected((s) => { const n = new Set(s); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })} />
                    <button type="button" onClick={() => setFocus(p.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <ParcelThumb path={p.photo_path} size="h-9 w-9" />
                      <span className="min-w-0 flex-1">
                        <span className={cn('block truncate text-[13px] font-semibold', TEXT.strong)}>
                          <span className="font-mono">{p.parcel_no}</span> · {p.description || labels.kind(p.kind)}
                        </span>
                        <span className={cn('block text-[11.5px] tabular-nums', TEXT.muted)}>carton {labelPosition(parcels, p.id)} / {parcels.length} · {formatKg(p.weight_kg)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className={cn('mt-3 text-[12px] leading-snug', TEXT.muted)}>
              Une page 100 × 150 mm par carton, à coller par-dessus la marque du client. Le PDF s'imprime tel quel sur une imprimante d'étiquettes 4 pouces.
            </p>
          </div>

          {/* L'aperçu exact du carton affiché, et les sorties. */}
          <div className="space-y-3">
            <div className={cn('relative overflow-hidden rounded-lg', SURFACE.inset)}>
              {preview ? <img src={preview} alt={`Étiquette ${focusParcel?.parcel_no ?? ''}`} className="mx-auto block max-h-[440px] w-auto" /> : <div className={cn('flex h-[440px] items-center justify-center text-[12.5px]', TEXT.muted)}>Préparation de l'aperçu…</div>}
              {parcels.length > 1 && (
                <>
                  <button type="button" onClick={() => focusIndex > 0 && setFocus(parcels[focusIndex - 1].id)} disabled={focusIndex <= 0} aria-label="Carton précédent" className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 shadow disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
                  <button type="button" onClick={() => focusIndex < parcels.length - 1 && setFocus(parcels[focusIndex + 1].id)} disabled={focusIndex >= parcels.length - 1} aria-label="Carton suivant" className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 shadow disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
                </>
              )}
            </div>
            <button type="button" onClick={() => void run('pdf')} disabled={!maker.ready || chosen.length === 0 || busy !== null} className={cn('flex h-10 w-full items-center justify-center gap-2 text-[13px] font-bold disabled:opacity-50', PRIMARY_PILL)}>
              <FileDown className="h-4 w-4" /> {busy === 'pdf' ? 'Préparation…' : `Télécharger le PDF (${chosen.length})`}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => void run('print')} disabled={!maker.ready || chosen.length === 0 || busy !== null} className={cn('flex h-9 items-center justify-center gap-2 text-[12.5px] font-semibold disabled:opacity-50', SOFT_PILL)}>
                <Printer className="h-4 w-4" /> Imprimer
              </button>
              <button type="button" onClick={() => void run('png')} disabled={!maker.ready || !focus || busy !== null} className={cn('flex h-9 items-center justify-center gap-2 text-[12.5px] font-semibold disabled:opacity-50', SOFT_PILL)}>
                <Download className="h-4 w-4" /> Image de ce carton
              </button>
            </div>
          </div>
        </div>
      ) : (
        <ShippingLabelComposer
          key={deposit.id}
          code={client.customer_code}
          clientName={clientFullName(client)}
          clientPhone={client.phone}
          clientEmail={client.email}
          companyName={client.company_name}
          clientCity={client.city}
          clientCountry={client.country}
          settings={settings}
          layout="split"
          mode="admin"
          initialDestination={deposit.location}
          initialSupplier={(() => { const s = depositSupplier(deposit); return s ? { name: s.name, phone: s.phone ?? undefined, email: s.email ?? undefined, address: s.address ?? undefined } : undefined; })()}
        />
      )}
    </CenterDialog>
  );
}

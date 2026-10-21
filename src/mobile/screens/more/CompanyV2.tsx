/**
 * Réglages › Entreprise — refonte v2 : Adresses en Chine (10/71) et Tarifs
 * cargo (10/72). Mêmes hooks et mêmes gardes : écriture des adresses
 * canManageUsers, des tarifs canManageRates ; les autres lisent.
 */
import { useEffect, useState } from 'react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCargoPricing, useSetCargoPricing } from '@/hooks/useCargoQuote';
import { useAdminShippingSettings, useUpdateShippingSettings } from '@/hooks/useShippingSettings';
import { DEFAULT_SHIPPING_SETTINGS, type ShippingLocation, type ShippingSettings } from '@/lib/customerCode';
import { formatDateTime } from '@/mobile/components/reception/bits';
import { cn } from '@/lib/utils';
import { BigButton, BoxSegmented, Dock, ScreenLoader, ScreenTop, SURFACE, TEXT, TextArea, TextInput } from '@/mobile/designKit';
import { BIG_FIELD, CapsLabel, FieldBlock } from './parts';
import { nb } from '@/mobile/screens/customs/shared';

type Part = 'warehouse' | 'office' | 'company';

export function ShippingV2() {
  const { hasPermission } = useAdminAuth();
  const canEdit = hasPermission('canManageUsers');
  const { data, isLoading, isPlaceholderData } = useAdminShippingSettings();
  const save = useUpdateShippingSettings();
  const [part, setPart] = useState<Part>('warehouse');
  const [form, setForm] = useState<ShippingSettings>(DEFAULT_SHIPPING_SETTINGS);
  const [dirty, setDirty] = useState(false);
  // Les valeurs en base dès qu'elles arrivent, sans jamais écraser une saisie.
  useEffect(() => { if (data && !isPlaceholderData && !dirty) setForm(data); }, [data, isPlaceholderData, dirty]);

  const setLoc = (k: keyof ShippingLocation, v: string) => {
    if (part === 'company') return;
    setForm((f) => ({ ...f, [part]: { ...f[part], [k]: v } }));
    setDirty(true);
  };
  const setCo = (k: keyof ShippingSettings['company'], v: string) => { setForm((f) => ({ ...f, company: { ...f.company, [k]: v } })); setDirty(true); };
  const submit = async () => {
    if (!canEdit || save.isPending) return;
    await save.mutateAsync(form);
    setDirty(false);
  };
  const field = (id: string, value: string, onChange: (v: string) => void, placeholder?: string) => (
    <TextInput id={id} value={value} onChange={(e) => onChange(e.target.value)} disabled={!canEdit} placeholder={placeholder} autoComplete="off" className={BIG_FIELD} />
  );
  const loc = part === 'company' ? null : form[part];

  return (
    <div className="flex min-h-full flex-col">
      <ScreenTop title="Adresses en Chine" />
      {isLoading && isPlaceholderData ? (
        <ScreenLoader />
      ) : (
        <div className="space-y-6 px-5 pb-8 pt-5">
          <BoxSegmented<Part>
            ariaLabel="Adresse"
            value={part}
            onChange={setPart}
            options={[{ value: 'warehouse', label: 'Bateau' }, { value: 'office', label: 'Avion' }, { value: 'company', label: 'Société' }]}
          />
          {loc ? (
            <>
              <FieldBlock label={<>Destinataire · 收件人</>} htmlFor="sh-recipient">{field('sh-recipient', loc.recipient, (v) => setLoc('recipient', v), 'Tina')}</FieldBlock>
              <FieldBlock label="Adresse en chinois" htmlFor="sh-zh">
                <TextArea id="sh-zh" rows={3} value={loc.addressZh} disabled={!canEdit} onChange={(e) => setLoc('addressZh', e.target.value)} className="px-4 py-3.5 !text-[17px]" />
              </FieldBlock>
              <FieldBlock label="Adresse en anglais" htmlFor="sh-en">
                <TextArea id="sh-en" rows={3} value={loc.addressEn} disabled={!canEdit} onChange={(e) => setLoc('addressEn', e.target.value)} className="px-4 py-3.5 !text-[17px]" />
              </FieldBlock>
              <div className="grid grid-cols-2 gap-3">
                <FieldBlock label="Téléphone" htmlFor="sh-phone">{field('sh-phone', loc.phone, (v) => setLoc('phone', v))}</FieldBlock>
                <FieldBlock label="WeChat" htmlFor="sh-wechat">{field('sh-wechat', loc.wechat, (v) => setLoc('wechat', v))}</FieldBlock>
                <FieldBlock label="WhatsApp" htmlFor="sh-wa">{field('sh-wa', loc.whatsapp, (v) => setLoc('whatsapp', v))}</FieldBlock>
                <FieldBlock label="E-mail" htmlFor="sh-mail">{field('sh-mail', loc.email, (v) => setLoc('email', v))}</FieldBlock>
              </div>
            </>
          ) : (
            <>
              <FieldBlock label="Nom" htmlFor="co-en">{field('co-en', form.company.nameEn, (v) => setCo('nameEn', v))}</FieldBlock>
              <FieldBlock label="Nom en chinois" htmlFor="co-zh">{field('co-zh', form.company.nameZh, (v) => setCo('nameZh', v), 'facultatif')}</FieldBlock>
              <FieldBlock label="E-mail" htmlFor="co-mail">{field('co-mail', form.company.email, (v) => setCo('email', v))}</FieldBlock>
              <div className="grid grid-cols-2 gap-3">
                <FieldBlock label="Téléphone" htmlFor="co-phone">{field('co-phone', form.company.phone, (v) => setCo('phone', v))}</FieldBlock>
                <FieldBlock label="WeChat" htmlFor="co-wechat">{field('co-wechat', form.company.wechat, (v) => setCo('wechat', v))}</FieldBlock>
              </div>
              <FieldBlock label="WhatsApp" htmlFor="co-wa">{field('co-wa', form.company.whatsapp, (v) => setCo('whatsapp', v))}</FieldBlock>
            </>
          )}
          {!canEdit && <p className={cn('text-[16px]', TEXT.muted)}>Lecture seule.</p>}
        </div>
      )}
      {canEdit && (
        <Dock>
          <BigButton onClick={() => void submit()} disabled={!dirty} loading={save.isPending}>Enregistrer</BigButton>
        </Dock>
      )}
    </div>
  );
}

/** « 165000 » → « 165 000 » à l'écran ; l'état garde les chiffres seuls. */
const grouped = (raw: string) => { const [i, d] = raw.split(/[.,]/); const g = (i ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0'); return d != null ? `${g},${d}` : g; };
const num = (s: string) => { const v = parseFloat(s.replace(/[\s\u00A0\u202F]/g, '').replace(',', '.')); return Number.isFinite(v) && v >= 0 ? v : null; };

export function CargoPricingV2() {
  const { hasPermission } = useAdminAuth();
  const canEdit = hasPermission('canManageRates');
  const { data, isLoading } = useCargoPricing();
  const save = useSetCargoPricing();
  const [air, setAir] = useState('');
  const [sea, setSea] = useState('');
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!data || loaded) return;
    setAir(String(data.air_per_kg_xaf ?? 0)); setSea(String(data.sea_per_cbm_xaf ?? 0)); setLoaded(true);
  }, [data, loaded]);
  const a = num(air), s = num(sea);
  const dirty = data != null && (a !== Number(data.air_per_kg_xaf) || s !== Number(data.sea_per_cbm_xaf));

  const big = (id: string, value: string, onChange: (v: string) => void, unit: string) => (
    <div className={cn('flex h-[72px] items-center gap-3 rounded-lg border px-4 focus-within:border-[#2C2C2C]', SURFACE.field, SURFACE.card, !canEdit && 'bg-[#F5F5F5]')}>
      {/* eslint-disable-next-line no-restricted-syntax -- prix en grand (36 px, pas de zoom iOS) */}
      <input id={id} inputMode="decimal" value={grouped(value)} disabled={!canEdit} onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))} className={cn('min-w-0 flex-1 bg-transparent !text-[36px] font-bold tabular-nums outline-none', TEXT.strong)} />
      <span className={cn('shrink-0 text-[20px] font-semibold', TEXT.muted)}>{unit}</span>
    </div>
  );

  return (
    <div className="flex min-h-full flex-col">
      <ScreenTop title="Tarifs cargo" />
      {isLoading || !data ? (
        <ScreenLoader />
      ) : (
        <div className="space-y-3 px-5 pt-6">
          <label htmlFor="pr-sea"><CapsLabel>Bateau · au mètre cube</CapsLabel></label>
          {big('pr-sea', sea, setSea, 'XAF / m³')}
          <p className={cn('text-[17px]', TEXT.muted)}>{s != null ? `Carton 60 × 40 × 40 cm = ${nb(0.096 * s)} XAF` : 'Un nombre, en XAF'}</p>
          <div className="h-5" />
          <label htmlFor="pr-air"><CapsLabel>Avion · au kilo</CapsLabel></label>
          {big('pr-air', air, setAir, 'XAF / kg')}
          <p className={cn('text-[17px]', TEXT.muted)}>{a != null ? `Colis de 8,4 kg = ${nb(8.4 * a)} XAF` : 'Un nombre, en XAF'}</p>
          {data.updated_at && <p className={cn('pt-4 text-[16px]', TEXT.muted)}>Modifié le {formatDateTime(data.updated_at)}</p>}
        </div>
      )}
      {canEdit && (
        <Dock>
          <BigButton onClick={() => a != null && s != null && save.mutate({ airPerKg: a, seaPerCbm: s })} disabled={!dirty || a == null || s == null} loading={save.isPending}>Enregistrer</BigButton>
        </Dock>
      )}
    </div>
  );
}

// ============================================================
// ADMIN — Réglages d'expédition : les adresses en Chine et les coordonnées
// de la société, telles qu'elles s'impriment sur l'étiquette colis.
//
// C'est le fondateur qui change ça, le jour où l'entrepôt déménage ou le
// numéro WeChat change — sans déploiement. Trois blocs, dans l'ordre où ils
// apparaissent sur l'étiquette : la société, l'entrepôt, le bureau. Un seul
// bouton Enregistrer : les trois blocs forment un même réglage.
// Écriture réservée à canManageUsers (super_admin) ; les autres voient
// les valeurs, sans pouvoir les modifier.
// ============================================================
import { useEffect, useState } from 'react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAdminShippingSettings, useUpdateShippingSettings } from '@/hooks/useShippingSettings';
import { DEFAULT_SHIPPING_SETTINGS, type ShippingLocation, type ShippingSettings } from '@/lib/customerCode';
import { cn } from '@/lib/utils';
import { Building2, Mail, Warehouse } from 'lucide-react';
import { TextArea } from '@/components/form';
import { SURFACE, TEXT, Card, SectionTitle, FormField, TextInput, PrimaryPill, ScreenLoader } from '@/mobile/designKit';

type Section = 'company' | 'warehouse' | 'office';

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  disabled,
  multiline,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  multiline?: boolean;
  hint?: string;
}) {
  if (multiline) {
    return (
      <TextArea
        id={id}
        label={label}
        hint={hint}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        controlClassName="min-h-[84px]"
      />
    );
  }
  return (
    <FormField label={label} htmlFor={id} hint={hint}>
      <TextInput id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} autoComplete="off" />
    </FormField>
  );
}

function LocationFields({
  prefix,
  value,
  onChange,
  disabled,
}: {
  prefix: string;
  value: ShippingLocation;
  onChange: (v: ShippingLocation) => void;
  disabled: boolean;
}) {
  const set = (k: keyof ShippingLocation) => (v: string) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-3">
      <Field id={`${prefix}-zh`} label="Adresse en chinois" value={value.addressZh} onChange={set('addressZh')} disabled={disabled} multiline hint="C’est la ligne que lit le livreur. Un retour à la ligne = une ligne sur l’étiquette." />
      <Field id={`${prefix}-en`} label="Adresse en anglais" value={value.addressEn} onChange={set('addressEn')} disabled={disabled} multiline />
      <Field id={`${prefix}-recipient`} label="Destinataire (收件人)" value={value.recipient} onChange={set('recipient')} disabled={disabled} placeholder="Tina" />
      <div className="grid grid-cols-2 gap-3">
        <Field id={`${prefix}-phone`} label="Téléphone" value={value.phone} onChange={set('phone')} disabled={disabled} />
        <Field id={`${prefix}-wechat`} label="WeChat" value={value.wechat} onChange={set('wechat')} disabled={disabled} />
        <Field id={`${prefix}-whatsapp`} label="WhatsApp" value={value.whatsapp} onChange={set('whatsapp')} disabled={disabled} />
        <div className="col-span-2">
          <Field id={`${prefix}-email`} label="E-mail" value={value.email} onChange={set('email')} disabled={disabled} />
        </div>
      </div>
    </div>
  );
}

export function MobileShippingSettings({ desktop = false }: { desktop?: boolean } = {}) {
  const { hasPermission } = useAdminAuth();
  const canEdit = hasPermission('canManageUsers');
  const { data, isLoading, isPlaceholderData } = useAdminShippingSettings();
  const save = useUpdateShippingSettings();

  const [form, setForm] = useState<ShippingSettings>(DEFAULT_SHIPPING_SETTINGS);
  const [dirty, setDirty] = useState(false);

  // Le formulaire part des valeurs en base dès qu'elles arrivent — mais on
  // n'écrase jamais une saisie en cours.
  useEffect(() => {
    if (data && !isPlaceholderData && !dirty) setForm(data);
  }, [data, isPlaceholderData, dirty]);

  const update = (section: Section, value: ShippingSettings[Section]) => {
    setForm((f) => ({ ...f, [section]: value }));
    setDirty(true);
  };

  const submit = async () => {
    if (!canEdit || save.isPending) return;
    await save.mutateAsync(form);
    setDirty(false);
  };

  const sectionIcon = (Icon: typeof Mail) => (
    <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', SURFACE.holder)}>
      <Icon className="h-[18px] w-[18px]" />
    </span>
  );

  return (
    <div className={desktop ? 'mx-auto max-w-5xl' : 'flex min-h-full flex-col'}>
      {desktop ? (
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className={cn('text-[24px] font-bold tracking-tight', TEXT.strong)}>Expédition · Chine</h2>
            <p className={cn('mt-0.5 text-[14px]', TEXT.muted)}>Adresses et coordonnées imprimées sur l’étiquette colis</p>
          </div>
          {canEdit && (
            <PrimaryPill onClick={submit} disabled={!dirty} loading={save.isPending} className="px-6 py-2.5 text-[14px]">
              Enregistrer
            </PrimaryPill>
          )}
        </header>
      ) : (
        <MobileHeader title="Expédition · Chine" subtitle="Ce qui s’imprime sur l’étiquette colis" showBack backTo="/m/more/settings" />
      )}

      <div className={cn(desktop ? 'space-y-5 pb-8' : 'flex-1 space-y-5 px-4 py-5 pb-28', !desktop && SURFACE.canvas)}>
        {isLoading && isPlaceholderData ? (
          <ScreenLoader />
        ) : (
          <>
            {!canEdit && (
              <p className={cn('rounded-lg px-4 py-3 text-[14px]', SURFACE.inset, TEXT.body)}>
                Lecture seule : seul un super-administrateur peut modifier ces réglages.
              </p>
            )}

            <div>
              <SectionTitle>Société</SectionTitle>
              <Card className="space-y-3">
                <div className="flex items-center gap-3">
                  {sectionIcon(Mail)}
                  <p className={cn('text-[14px]', TEXT.muted)}>Apparaît dans la case « destinataire » de chaque étiquette.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field id="c-en" label="Nom (latin)" value={form.company.nameEn} onChange={(v) => update('company', { ...form.company, nameEn: v })} disabled={!canEdit} />
                  <Field id="c-zh" label="Nom en chinois" value={form.company.nameZh} onChange={(v) => update('company', { ...form.company, nameZh: v })} disabled={!canEdit} placeholder="facultatif" />
                  <div className="col-span-2">
                    <Field id="c-email" label="E-mail" value={form.company.email} onChange={(v) => update('company', { ...form.company, email: v })} disabled={!canEdit} />
                  </div>
                  <Field id="c-phone" label="Téléphone" value={form.company.phone} onChange={(v) => update('company', { ...form.company, phone: v })} disabled={!canEdit} />
                  <Field id="c-wechat" label="WeChat" value={form.company.wechat} onChange={(v) => update('company', { ...form.company, wechat: v })} disabled={!canEdit} />
                  <Field id="c-whatsapp" label="WhatsApp" value={form.company.whatsapp} onChange={(v) => update('company', { ...form.company, whatsapp: v })} disabled={!canEdit} />
                </div>
              </Card>
            </div>

            <div className={cn(desktop && 'grid grid-cols-2 gap-5')}>
            <div>
              <SectionTitle>Entrepôt</SectionTitle>
              <Card className="space-y-3">
                <div className="flex items-center gap-3">
                  {sectionIcon(Warehouse)}
                  <p className={cn('text-[14px]', TEXT.muted)}>La destination par défaut des étiquettes.</p>
                </div>
                <LocationFields prefix="w" value={form.warehouse} onChange={(v) => update('warehouse', v)} disabled={!canEdit} />
              </Card>
            </div>

            <div>
              <SectionTitle>Bureau de Guangzhou</SectionTitle>
              <Card className="space-y-3">
                <div className="flex items-center gap-3">
                  {sectionIcon(Building2)}
                  <p className={cn('text-[14px]', TEXT.muted)}>Proposé au client comme seconde destination.</p>
                </div>
                <LocationFields prefix="o" value={form.office} onChange={(v) => update('office', v)} disabled={!canEdit} />
              </Card>
            </div>
            </div>

            {canEdit && !desktop && (
              <div className={cn('fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3', SURFACE.canvas)}>
                <PrimaryPill onClick={submit} disabled={!dirty} loading={save.isPending} className="w-full py-3.5 text-[15px]">
                  Enregistrer
                </PrimaryPill>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

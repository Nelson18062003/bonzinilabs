// ============================================================
// RÉCEPTION — Étape 3 : « Qui a envoyé les colis ? » Le fournisseur (ou
// l'agent d'achat) : ce que Tina relève sur son bon d'entrée. La mémoire
// propose d'abord les fournisseurs déjà vus pour ce client : un toucher, et
// tout est rempli. Sinon : la société, le contact, le téléphone ; et, sous
// « Plus », l'email, le WeChat, l'adresse. « Passer » est toujours possible.
// Le même écran, avec `?edit`, corrige le fournisseur d'un dépôt ouvert.
// ============================================================
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Building2, ChevronRight, UserRound } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { depositSupplier, supplierLine, type SupplierInfo, type SupplierKind } from '@/lib/reception';
import { useClientSuppliers, useReceptionDeposit, useSetSupplier } from '@/hooks/useReception';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { SURFACE, TEXT, TYPE, Card, Fold, FormField, PrimaryPill, ScreenLoader, Segmented, SoftPill, TextInput } from '@/mobile/designKit';
import { TextArea } from '@/components/form';
import { StepHeader } from '@/mobile/components/reception/bits';

export function ReceptionSupplier() {
  const navigate = useNavigate();
  const { depositId } = useParams<{ depositId: string }>();
  const [params] = useSearchParams();
  const editing = params.has('edit');
  const { t } = useLanguage();
  const { data: deposit, isLoading } = useReceptionDeposit(depositId);
  const { data: recent } = useClientSuppliers(deposit?.client?.user_id);
  const set = useSetSupplier();

  const [kind, setKind] = useState<SupplierKind>('supplier');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [wechat, setWechat] = useState('');
  const [address, setAddress] = useState('');
  const [more, setMore] = useState(false);
  const [seeded, setSeeded] = useState(false);

  // En correction : les champs partent de ce que le dépôt sait déjà.
  useEffect(() => {
    if (!deposit || seeded) return;
    const s = depositSupplier(deposit);
    if (s) { setKind(s.kind); setName(s.name); setContact(s.contact ?? ''); setPhone(s.phone ?? ''); setEmail(s.email ?? ''); setWechat(s.wechat ?? ''); setAddress(s.address ?? ''); setMore(!!(s.email || s.wechat || s.address)); }
    setSeeded(true);
  }, [deposit, seeded]);

  if (isLoading || !deposit) return <ScreenLoader className="min-h-[100dvh]" />;
  const back = `/r/deposit/${deposit.id}`;
  const fill = (s: SupplierInfo) => { setKind(s.kind); setName(s.name); setContact(s.contact ?? ''); setPhone(s.phone ?? ''); setEmail(s.email ?? ''); setWechat(s.wechat ?? ''); setAddress(s.address ?? ''); setMore(!!(s.email || s.wechat || s.address)); };
  const canSave = name.trim().length > 0;

  const save = async () => {
    if (!canSave) return;
    await set.mutateAsync({ depositId: deposit.id, supplier: { kind, name: name.trim(), contact: contact.trim() || null, phone: phone.trim() || null, email: email.trim() || null, wechat: wechat.trim() || null, address: address.trim() || null } });
    navigate(back, { replace: true });
  };

  return (
    <div className={cn('flex h-[100dvh] flex-col', SURFACE.canvas)}>
      <MobileHeader title={editing ? t('rc_sup_edit') : t('rc_new_deposit')} showBack backTo={back} />
      <div className="flex-1 space-y-6 overflow-y-auto px-5 pb-6 pt-5">
        {!editing && <StepHeader step={3} total={4} title={t('rc_sup_title')} help={t('rc_sup_help')} />}
        {editing && <h1 className={cn(TYPE.heading, TEXT.strong)}>{t('rc_sup_title')}</h1>}

        {/* La mémoire : les fournisseurs déjà vus pour ce client. */}
        {recent && recent.length > 0 && (
          <section>
            <h2 className={cn('mb-2', TYPE.smallStrong, TEXT.muted)}>{t('rc_sup_recent')}</h2>
            <Card className="py-0">
              {recent.map((s, i) => {
                const on = s.name === name && (s.phone ?? '') === phone;
                return (
                  <button key={`${s.name}-${i}`} type="button" onClick={() => fill(s)} aria-pressed={on} className={cn('flex w-full items-center gap-3 border-b py-3 text-left last:border-b-0', SURFACE.divider, on && 'font-semibold')}>
                    <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', on ? 'bg-[#2C2C2C] text-white dark:bg-[#E3E3E3] dark:text-[#1E1E1E]' : SURFACE.holder)}>{s.kind === 'buying_agent' ? <UserRound className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}</span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block break-words', TYPE.bodyStrong, TEXT.strong)}>{s.name}</span>
                      <span className={cn('block break-words tabular-nums', TYPE.small, TEXT.muted)}>{[s.contact, s.phone].filter(Boolean).join(' · ') || t(`rc_sup_kind_${s.kind}`)}</span>
                    </span>
                    <ChevronRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
                  </button>
                );
              })}
            </Card>
          </section>
        )}

        <Segmented value={kind} onChange={setKind} options={[{ value: 'supplier', label: t('rc_sup_kind_supplier') }, { value: 'buying_agent', label: t('rc_sup_kind_buying_agent') }]} />

        <Card className="space-y-4">
          <FormField label={t('rc_sup_name')} htmlFor="sup-name">
            <TextInput id="sup-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('rc_sup_name_ph')} autoCapitalize="words" className="h-12" />
          </FormField>
          <FormField label={t('rc_sup_contact')} htmlFor="sup-contact">
            <TextInput id="sup-contact" value={contact} onChange={(e) => setContact(e.target.value)} autoCapitalize="words" className="h-12" />
          </FormField>
          <FormField label={t('rc_sup_phone')} htmlFor="sup-phone">
            <TextInput id="sup-phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className="h-12" />
          </FormField>
        </Card>

        <Fold title={t('rc_sup_more')} open={more} onToggle={() => setMore((o) => !o)}>
          <div className="space-y-4 pt-2">
            <FormField label={t('rc_sup_email')} htmlFor="sup-email"><TextInput id="sup-email" value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" autoCapitalize="none" className="h-12" /></FormField>
            <FormField label={t('rc_sup_wechat')} htmlFor="sup-wechat"><TextInput id="sup-wechat" value={wechat} onChange={(e) => setWechat(e.target.value)} autoCapitalize="none" className="h-12" /></FormField>
            <TextArea id="sup-address" label={t('rc_sup_address')} value={address} onChange={(e) => setAddress(e.target.value)} controlClassName="min-h-[64px]" />
          </div>
        </Fold>

        {name.trim() && <p className={cn('tabular-nums', TYPE.small, TEXT.muted)}>{supplierLine({ kind, name, contact, phone })}</p>}
      </div>

      <div className={cn('shrink-0 space-y-2 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3', SURFACE.canvas)}>
        <PrimaryPill onClick={() => void save()} disabled={!canSave} loading={set.isPending} className="h-14 w-full text-[17px]">{t('rc_continue_next')}</PrimaryPill>
        {!editing && <SoftPill onClick={() => navigate(back, { replace: true })} className="h-12 w-full text-[16px]">{t('rc_skip')}</SoftPill>}
      </div>
    </div>
  );
}

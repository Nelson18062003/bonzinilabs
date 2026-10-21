// ============================================================
// RÉCEPTION — Étape 3 : « Qui a envoyé les colis ? » Le fournisseur (ou
// l'agent d'achat) : ce que Tina relève sur son bon d'entrée. La mémoire
// propose d'abord les fournisseurs déjà vus pour ce client : un toucher, et
// tout est rempli. Sinon : la société, le contact, le téléphone ; et, sous
// « Plus », l'email, le WeChat, l'adresse. « Passer » est toujours possible.
// Le même écran, avec `?edit`, corrige le fournisseur d'un dépôt ouvert.
// Refonte v2 (maquette 10/44) : « Passer » dans l'en-tête, les fournisseurs
// déjà vus en choix à rond, puis « ou un nouveau ».
// ============================================================
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { depositSupplier, type SupplierInfo, type SupplierKind } from '@/lib/reception';
import { useClientSuppliers, useReceptionDeposit, useSetSupplier } from '@/hooks/useReception';
import { BigButton, Dock, FOCUS_RING, ScreenTop, SURFACE, TEXT, TextArea, TextInput } from '@/mobile/designKit';
import { DepositLoadState } from '@/mobile/components/reception/bits';
import { CapsLabel, FitSegmented, RadioRow } from '@/mobile/components/cargo/v2';
import { useReceptionBack, useStillHere } from '@/mobile/components/reception/useReceptionBack';

export function ReceptionSupplier() {
  const navigate = useNavigate();
  const goBack = useReceptionBack();
  const stillHere = useStillHere();
  const { depositId } = useParams<{ depositId: string }>();
  const [params] = useSearchParams();
  const editing = params.has('edit');
  const { t } = useLanguage();
  const { data: deposit, isLoading, error, refetch } = useReceptionDeposit(depositId);
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

  // Sortir vers la fiche du dépôt : en correction, là d'où l'on vient ; pendant la création, en
  // remplaçant l'étape (le retour du téléphone ne ramène pas à un fournisseur déjà réglé).
  const depositPath = `/r/deposit/${depositId}`;
  const exit = () => (editing ? goBack(depositPath) : navigate(depositPath, { replace: true }));

  // Chargement et erreur gardent l'en-tête et sa flèche : jamais un sablier sans fin.
  if (!deposit) { // une relecture ratée en arrière-plan garde le formulaire
    return (
      <DepositLoadState title={editing ? t('rc_sup_edit') : t('rc_new_deposit')} onBack={() => goBack(depositPath)} isLoading={isLoading} error={error} onRetry={() => void refetch()} />
    );
  }
  const fill = (s: SupplierInfo) => { setKind(s.kind); setName(s.name); setContact(s.contact ?? ''); setPhone(s.phone ?? ''); setEmail(s.email ?? ''); setWechat(s.wechat ?? ''); setAddress(s.address ?? ''); setMore(!!(s.email || s.wechat || s.address)); };
  const canSave = name.trim().length > 0;

  const save = async () => {
    if (!canSave) return;
    if (set.isPending) return;
    const ok = await set.mutateAsync({ depositId: deposit.id, supplier: { kind, name: name.trim(), contact: contact.trim() || null, phone: phone.trim() || null, email: email.trim() || null, wechat: wechat.trim() || null, address: address.trim() || null } })
      .then(() => true, () => false); // le hook dit le refus ; on reste sur l'écran
    if (ok && stillHere()) exit(); // quitté pendant l'envoi : on ne navigue plus depuis un autre écran
  };

  return (
    <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
      <ScreenTop
        title={editing ? t('rc_sup_edit') : t('rc_new_deposit')}
        onBack={exit}
        right={editing ? undefined : (
          <>
            <button type="button" onClick={exit} className={cn('flex min-h-11 items-center rounded px-1 text-[16px] font-semibold underline underline-offset-[3px]', FOCUS_RING, TEXT.strong)}>{t('rc_v2_skip')}</button>
            <span className={cn('ml-2 shrink-0 text-[16px] font-semibold tabular-nums', TEXT.muted)}>3/4</span>
          </>
        )}
      />
      <div className="flex-1 space-y-5 px-5 pb-6 pt-5">
        <h2 className={cn('text-[24px] font-semibold leading-tight tracking-[-0.01em]', TEXT.strong)}>{t('rc_sup_title')}</h2>

        {/* La mémoire : les fournisseurs déjà vus pour ce client ; un toucher remplit tout. */}
        {recent && recent.length > 0 && (
          <section>
            <CapsLabel className="mb-1">{t('rc_sup_recent')}</CapsLabel>
            <div role="radiogroup" aria-label={t('rc_sup_recent')}>
              {recent.map((s, i) => (
                <RadioRow key={`${s.name}-${i}`} selected={s.name === name && (s.phone ?? '') === phone} onClick={() => fill(s)} title={s.name} hint={[t(`rc_sup_kind_${s.kind}`), s.contact, s.phone].filter(Boolean).join(' · ')} />
              ))}
            </div>
          </section>
        )}

        <section className="space-y-3">
          {recent && recent.length > 0 && <CapsLabel>{t('rc_v2_or_new')}</CapsLabel>}
          <FitSegmented<SupplierKind> ariaLabel={t('rc_sup_label')} value={kind} onChange={setKind} options={[{ value: 'supplier', label: t('rc_sup_kind_supplier') }, { value: 'buying_agent', label: t('rc_sup_kind_buying_agent') }]} />
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder={t('rc_sup_name')} aria-label={t('rc_sup_name')} autoCapitalize="words" className="h-14 text-[17px]" />
          <div className="grid grid-cols-2 gap-3">
            <TextInput value={contact} onChange={(e) => setContact(e.target.value)} placeholder={t('rc_sup_contact')} aria-label={t('rc_sup_contact')} autoCapitalize="words" className="h-14 text-[17px]" />
            <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('rc_sup_phone')} aria-label={t('rc_sup_phone')} inputMode="tel" className="h-14 text-[17px]" />
          </div>
          <button type="button" aria-expanded={more} onClick={() => setMore((o) => !o)} className={cn('flex min-h-11 items-center gap-2 rounded text-[16px] font-semibold', FOCUS_RING, TEXT.strong)}>
            {t('rc_sup_more')} <ChevronDown className={cn('h-5 w-5 transition-transform', more && 'rotate-180')} />
          </button>
          {more && (
            <div className="space-y-3">
              <TextInput value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('rc_sup_email')} aria-label={t('rc_sup_email')} inputMode="email" autoCapitalize="none" className="h-14 text-[17px]" />
              <TextInput value={wechat} onChange={(e) => setWechat(e.target.value)} placeholder={t('rc_sup_wechat')} aria-label={t('rc_sup_wechat')} autoCapitalize="none" className="h-14 text-[17px]" />
              <TextArea value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t('rc_sup_address')} aria-label={t('rc_sup_address')} rows={2} />
            </div>
          )}
        </section>
      </div>

      <Dock>
        <BigButton onClick={() => void save()} disabled={!canSave} loading={set.isPending}>{editing ? t('rc_save') : t('rc_continue_next')}</BigButton>
      </Dock>
    </div>
  );
}

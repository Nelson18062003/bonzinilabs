// ============================================================
// Desktop admin — corriger un dépôt : où il est entré (le mode, Sea ou Air),
// comment il est arrivé, qui l'a apporté, les notes, et le fournisseur.
// Le client se change depuis la fiche (« Changer de client »). Le lieu ne
// change plus dès qu'un colis est parti ou que le devis est réglé : la base
// le refuse, l'écran le dit avant.
// ============================================================
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSetSupplier, useUpdateDeposit } from '@/hooks/useReception';
import { BROUGHT_BY, SUPPLIER_KINDS, depositSupplier, parcelLockReason, type BroughtBy, type Deposit, type ReceptionLocation, type SupplierKind } from '@/lib/reception';
import { LocationMark, useReceptionLabels } from '@/mobile/components/reception/bits';
import { cn } from '@/lib/utils';
import { TEXT, SOFT_PILL, PRIMARY_PILL, CenterDialog, TextArea, TextInput } from '@/desktop/designKit';

const SUPPLIER_KIND_LABEL: Record<SupplierKind, string> = { supplier: 'Fournisseur', buying_agent: 'Agent d’achat' };
const blank = (v: string | null | undefined) => (v ?? '').trim();

type SupplierForm = { kind: SupplierKind; name: string; contact: string; phone: string; email: string; wechat: string; address: string };

export function DepositEditDialog({ deposit, open, onClose }: { deposit: Deposit; open: boolean; onClose: () => void }) {
  const labels = useReceptionLabels();
  const update = useUpdateDeposit();
  const setSupplier = useSetSupplier();
  const [location, setLocation] = useState<ReceptionLocation>(deposit.location);
  const [broughtBy, setBroughtBy] = useState<BroughtBy>(deposit.brought_by);
  const [repName, setRepName] = useState('');
  const [repPhone, setRepPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [sup, setSup] = useState<SupplierForm>({ kind: 'supplier', name: '', contact: '', phone: '', email: '', wechat: '', address: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const s = depositSupplier(deposit);
    setLocation(deposit.location);
    setBroughtBy(deposit.brought_by);
    setRepName(deposit.representative_name ?? '');
    setRepPhone(deposit.representative_phone ?? '');
    setNotes(deposit.notes ?? '');
    setSup({ kind: s?.kind ?? 'supplier', name: s?.name ?? '', contact: s?.contact ?? '', phone: s?.phone ?? '', email: s?.email ?? '', wechat: s?.wechat ?? '', address: s?.address ?? '' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, deposit.id]);

  const departed = deposit.parcels.some((p) => parcelLockReason(p) !== null);
  const paid = deposit.quote_status === 'paid' || deposit.quote_status === 'invoiced';
  const locationLocked = departed || paid;

  const before = depositSupplier(deposit);
  const supplierChanged =
    blank(sup.name) !== blank(before?.name) || (blank(sup.name) !== '' && sup.kind !== (before?.kind ?? 'supplier')) ||
    (['contact', 'phone', 'email', 'wechat', 'address'] as const).some((k) => blank(sup[k]) !== blank(before?.[k]));
  const depositChanged =
    location !== deposit.location || broughtBy !== deposit.brought_by || blank(repName) !== blank(deposit.representative_name) ||
    blank(repPhone) !== blank(deposit.representative_phone) || blank(notes) !== blank(deposit.notes);

  const submit = async () => {
    if (saving || (!depositChanged && !supplierChanged)) { if (!saving) onClose(); return; }
    setSaving(true);
    try {
      if (depositChanged) {
        await update.mutateAsync({ depositId: deposit.id, location, broughtBy, representativeName: repName, representativePhone: repPhone, notes });
      }
      if (supplierChanged) {
        await setSupplier.mutateAsync({ depositId: deposit.id, supplier: blank(sup.name) ? { ...sup, name: sup.name.trim() } : null });
      }
      toast.success(`Dépôt ${deposit.deposit_no} corrigé`);
      onClose();
    } catch {
      // Le hook a déjà affiché l'erreur ; on reste sur le formulaire.
    } finally {
      setSaving(false);
    }
  };

  const input = (id: string, label: string, value: string, set: (v: string) => void, placeholder?: string, className?: string) => (
    <label htmlFor={id} className={cn('block min-w-0', className)}>
      <span className={cn('mb-1 block text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>{label}</span>
      <TextInput id={id} value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder} className="h-9 rounded-md text-[13.5px]" />
    </label>
  );
  const sectionTitle = (t: string) => <div className={cn('mb-2 text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>{t}</div>;

  return (
    <CenterDialog
      open={open}
      onClose={onClose}
      onConfirm={() => void submit()}
      width={720}
      title={
        <span className="block">
          <span className={cn('block text-[16px] font-bold', TEXT.strong)}>Modifier le dépôt {deposit.deposit_no}</span>
          <span className={cn('block text-[12px]', TEXT.muted)}>Chaque correction est gardée au journal, avec l'avant et l'après</span>
        </span>
      }
      footer={
        <>
          <button type="button" onClick={onClose} className={cn('ml-auto h-9 px-4 text-[13px] font-semibold', SOFT_PILL)}>Annuler</button>
          <button type="button" onClick={() => void submit()} disabled={saving || (!depositChanged && !supplierChanged)} className={cn('inline-flex h-9 items-center gap-2 px-4 text-[13px] font-bold disabled:opacity-50', PRIMARY_PILL)}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          {sectionTitle('Où il est entré')}
          <div className="grid grid-cols-2 gap-2">
            {(['warehouse', 'office'] as ReceptionLocation[]).map((l) => (
              <button key={l} type="button" disabled={locationLocked && l !== deposit.location} onClick={() => setLocation(l)}
                className={cn('flex h-11 items-center gap-2.5 px-3 text-[13px] font-semibold disabled:opacity-40', location === l ? PRIMARY_PILL : SOFT_PILL)}>
                <LocationMark location={l} size={22} /> {labels.location(l)}
              </button>
            ))}
          </div>
          {locationLocked && <p className={cn('mt-1.5 text-[12px]', TEXT.muted)}>{departed ? 'Des colis sont déjà emballés dans un paquet avion ou partis' : 'Le devis est réglé'} : le lieu ne change plus.</p>}
        </div>

        <div>
          {sectionTitle('Comment il est arrivé')}
          <div className="grid grid-cols-4 gap-2">
            {BROUGHT_BY.map((b) => (
              <button key={b} type="button" onClick={() => setBroughtBy(b)} className={cn('min-h-9 px-2 py-1.5 text-[12.5px] font-semibold leading-tight', broughtBy === b ? PRIMARY_PILL : SOFT_PILL)}>
                {labels.broughtBy(b)}
              </button>
            ))}
          </div>
          {(broughtBy === 'representative' || repName || repPhone) && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              {input('de-rep', 'Apporté par (nom)', repName, setRepName, 'Le nom de la personne')}
              {input('de-rep-phone', 'Son téléphone', repPhone, setRepPhone, '+86 …')}
            </div>
          )}
        </div>

        <div>
          {sectionTitle('Le fournisseur')}
          <div className="mb-3 flex gap-2">
            {SUPPLIER_KINDS.map((k) => (
              <button key={k} type="button" onClick={() => setSup((s) => ({ ...s, kind: k }))} className={cn('h-8 px-3 text-[12.5px] font-semibold', sup.kind === k ? PRIMARY_PILL : SOFT_PILL)}>{SUPPLIER_KIND_LABEL[k]}</button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {input('de-s-name', 'Nom (société)', sup.name, (v) => setSup((s) => ({ ...s, name: v })), '广州鞋业…')}
            {input('de-s-contact', 'Contact', sup.contact, (v) => setSup((s) => ({ ...s, contact: v })))}
            {input('de-s-phone', 'Téléphone', sup.phone, (v) => setSup((s) => ({ ...s, phone: v })))}
            {input('de-s-email', 'E-mail', sup.email, (v) => setSup((s) => ({ ...s, email: v })))}
            {input('de-s-wechat', 'WeChat', sup.wechat, (v) => setSup((s) => ({ ...s, wechat: v })))}
            {input('de-s-address', 'Adresse', sup.address, (v) => setSup((s) => ({ ...s, address: v })), undefined, 'col-span-3')}
          </div>
          {!blank(sup.name) && (before?.name ?? '') !== '' && <p className={cn('mt-1.5 text-[12px]', TEXT.muted)}>Sans nom, le fournisseur est retiré du dépôt.</p>}
        </div>

        <div>
          {sectionTitle('Notes')}
          <TextArea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ce que l'équipe doit savoir sur ce dépôt" className="rounded-md text-[13.5px]" />
        </div>
      </div>
    </CenterDialog>
  );
}

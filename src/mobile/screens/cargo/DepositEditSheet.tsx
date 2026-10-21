// ============================================================
// Mobile admin — Cargo › un dépôt › « Modifier le dépôt » (menu « … » de
// 04/08). Les mêmes champs que la version ordinateur (DepositEditDialog),
// en feuille v2 : où il est entré (figé si un colis est parti ou si le
// devis est réglé), comment il est arrivé et par qui, le fournisseur au
// complet, les notes. Chaque correction est gardée au journal par la base.
// ============================================================
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useSetSupplier, useUpdateDeposit } from '@/hooks/useReception';
import { BROUGHT_BY, SUPPLIER_KINDS, depositSupplier, parcelLockReason, type BroughtBy, type Deposit, type ReceptionLocation, type SupplierKind } from '@/lib/reception';
import { cn } from '@/lib/utils';
import { BigButton, BottomSheet, TEXT, TextArea, TextInput } from '@/mobile/designKit';
import { CapsLabel, ChipRow } from '@/mobile/components/cargo/v2';
import { useReceptionLabels } from '@/mobile/components/reception/bits';

const SUPPLIER_KIND_LABEL: Record<SupplierKind, string> = { supplier: 'Fournisseur', buying_agent: 'Agent d’achat' };
const blank = (v: string | null | undefined) => (v ?? '').trim();
const LOCATIONS: ReceptionLocation[] = ['warehouse', 'office'];
type SupplierForm = { kind: SupplierKind; name: string; contact: string; phone: string; email: string; wechat: string; address: string };

export function DepositEditSheet({ deposit, open, onClose }: { deposit: Deposit; open: boolean; onClose: () => void }) {
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
    setLocation(deposit.location); setBroughtBy(deposit.brought_by);
    setRepName(deposit.representative_name ?? ''); setRepPhone(deposit.representative_phone ?? ''); setNotes(deposit.notes ?? '');
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
    if (saving) return;
    if (!depositChanged && !supplierChanged) { onClose(); return; }
    setSaving(true);
    try {
      if (depositChanged) await update.mutateAsync({ depositId: deposit.id, location, broughtBy, representativeName: repName, representativePhone: repPhone, notes });
      if (supplierChanged) await setSupplier.mutateAsync({ depositId: deposit.id, supplier: blank(sup.name) ? { ...sup, name: sup.name.trim() } : null });
      toast.success(`Dépôt ${deposit.deposit_no} corrigé`);
      onClose();
    } catch {
      // Le hook a déjà dit l'erreur ; on reste sur la feuille.
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, value: string, set: (v: string) => void, opts: { placeholder?: string; inputMode?: 'tel' | 'email' } = {}) => (
    <TextInput value={value} onChange={(e) => set(e.target.value)} placeholder={opts.placeholder ?? label} aria-label={label} inputMode={opts.inputMode} className="h-12" />
  );
  const setS = (k: keyof SupplierForm) => (v: string) => setSup((s) => ({ ...s, [k]: v }));

  return (
    <BottomSheet open={open} onClose={saving ? () => undefined : onClose} title={`Modifier ${deposit.deposit_no}`}>
      <div className="space-y-5">
        <div>
          <CapsLabel>Lieu</CapsLabel>
          <ChipRow<ReceptionLocation> className="-mx-5 mt-2" options={LOCATIONS.filter((l) => !locationLocked || l === deposit.location).map((l) => ({ value: l, label: labels.location(l) }))} value={location} onChange={setLocation} />
          {locationLocked && <p className={cn('mt-1.5 text-[15px]', TEXT.muted)}>{departed ? 'Colis déjà partis' : 'Devis réglé'} : lieu figé</p>}
        </div>

        <div>
          <CapsLabel>Apporté par</CapsLabel>
          <ChipRow<BroughtBy> className="-mx-5 mt-2" options={BROUGHT_BY.map((b) => ({ value: b, label: labels.broughtBy(b) }))} value={broughtBy} onChange={setBroughtBy} />
          {(broughtBy === 'representative' || repName || repPhone) && (
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {field('Nom', repName, setRepName)}
              {field('Téléphone', repPhone, setRepPhone, { inputMode: 'tel', placeholder: '+86 …' })}
            </div>
          )}
        </div>

        <div>
          <CapsLabel>Fournisseur</CapsLabel>
          <ChipRow<SupplierKind> className="-mx-5 mt-2" options={SUPPLIER_KINDS.map((k) => ({ value: k, label: SUPPLIER_KIND_LABEL[k] }))} value={sup.kind} onChange={(k) => setSup((s) => ({ ...s, kind: k }))} />
          <div className="mt-3 space-y-2.5">
            {field('Nom (société)', sup.name, setS('name'))}
            <div className="grid grid-cols-2 gap-2.5">
              {field('Contact', sup.contact, setS('contact'))}
              {field('Téléphone', sup.phone, setS('phone'), { inputMode: 'tel' })}
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {field('E-mail', sup.email, setS('email'), { inputMode: 'email' })}
              {field('WeChat', sup.wechat, setS('wechat'))}
            </div>
            {field('Adresse', sup.address, setS('address'))}
          </div>
          {!blank(sup.name) && blank(before?.name) !== '' && <p className={cn('mt-1.5 text-[15px]', TEXT.muted)}>Sans nom : fournisseur retiré</p>}
        </div>

        <div>
          <CapsLabel as="label">Notes</CapsLabel>
          <TextArea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Notes" className="mt-2" />
        </div>

        <BigButton onClick={() => void submit()} loading={saving}>Enregistrer</BigButton>
      </div>
    </BottomSheet>
  );
}

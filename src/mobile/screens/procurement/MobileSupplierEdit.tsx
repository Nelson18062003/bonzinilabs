import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useSupplier360, useUpsertSupplier } from '@/hooks/useProcurement';
import type { ProcSupplierKind, ProcVerificationStatus } from '@/integrations/supabase/procurement';
import { FieldLabel, Pill, PrimaryPill } from '@/components/treasury/ui';
import { PROC_INPUT as INPUT, SUPPLIER_KIND_OPTIONS, VERIF_OPTIONS } from './shared';
import { cn } from '@/lib/utils';

export function MobileSupplierEdit() {
  const navigate = useNavigate();
  const { supplierId } = useParams<{ supplierId: string }>();
  const isEdit = !!supplierId;
  const { hasPermission } = useAdminAuth();
  const upsert = useUpsertSupplier();
  const { data: existing } = useSupplier360(isEdit ? supplierId : undefined);

  const [displayName, setDisplayName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [kind, setKind] = useState<ProcSupplierKind>('factory');
  const [verif, setVerif] = useState<ProcVerificationStatus>('unverified');
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [wechat, setWechat] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [loaded, setLoaded] = useState(false);

  // Préremplissage en édition (une seule fois, quand la fiche arrive).
  useEffect(() => {
    if (isEdit && existing?.supplier && !loaded) {
      const s = existing.supplier;
      setDisplayName(s.display_name);
      setLegalName(s.legal_name ?? '');
      setKind(s.supplier_kind);
      setVerif(s.verification_status);
      setCategory((s.category ?? []).join(', '));
      setCity(s.city ?? '');
      setProvince(s.province ?? '');
      setWechat(s.wechat_id ?? '');
      setPhone(s.phone ?? '');
      setEmail(s.email ?? '');
      setNotes(s.verification_notes ?? '');
      setLoaded(true);
    }
  }, [isEdit, existing, loaded]);

  if (!hasPermission('canManageProcurement')) {
    return <Navigate to="/m/more/procurement" replace />;
  }

  const canSubmit = displayName.trim().length > 0 && !upsert.isPending;

  const handleSubmit = async () => {
    try {
      const r = await upsert.mutateAsync({
        p_id: supplierId ?? null,
        p_display_name: displayName.trim(),
        p_legal_name: legalName.trim() || null,
        p_supplier_kind: kind,
        p_category: category.split(',').map((c) => c.trim()).filter(Boolean),
        p_city: city.trim() || null,
        p_province: province.trim() || null,
        p_wechat_id: wechat.trim() || null,
        p_phone: phone.trim() || null,
        p_email: email.trim() || null,
        p_verification_status: verif,
        p_verification_notes: notes.trim() || null,
      });
      navigate(`/m/more/procurement/suppliers/${r.supplier_id}`, { replace: true });
    } catch {
      /* toast géré par le hook */
    }
  };

  return (
    <div className="flex flex-col min-h-full bg-background">
      <MobileHeader title={isEdit ? 'Modifier le fournisseur' : 'Nouveau fournisseur'} showBack
        backTo={isEdit ? `/m/more/procurement/suppliers/${supplierId}` : '/m/more/procurement/suppliers'} />

      <div className="px-5 py-6 space-y-5">
        <div>
          <FieldLabel>Nom *</FieldLabel>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Nom commercial / usine" className={INPUT} />
        </div>

        <div>
          <FieldLabel>Type</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {SUPPLIER_KIND_OPTIONS.map((k) => <Pill key={k.value} active={kind === k.value} onClick={() => setKind(k.value)}>{k.label}</Pill>)}
          </div>
        </div>

        <div>
          <FieldLabel>Vérification</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {VERIF_OPTIONS.map((v) => <Pill key={v.value} active={verif === v.value} onClick={() => setVerif(v.value)}>{v.label}</Pill>)}
          </div>
        </div>

        <div>
          <FieldLabel>Catégories (séparées par des virgules)</FieldLabel>
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex. électronique, accessoires" className={INPUT} />
        </div>

        <div className="flex gap-3">
          <div className="flex-1"><FieldLabel>Ville</FieldLabel><input value={city} onChange={(e) => setCity(e.target.value)} className={INPUT} /></div>
          <div className="flex-1"><FieldLabel>Province</FieldLabel><input value={province} onChange={(e) => setProvince(e.target.value)} className={INPUT} /></div>
        </div>

        <div><FieldLabel>WeChat ID</FieldLabel><input value={wechat} onChange={(e) => setWechat(e.target.value)} className={INPUT} /></div>
        <div className="flex gap-3">
          <div className="flex-1"><FieldLabel>Téléphone</FieldLabel><input value={phone} onChange={(e) => setPhone(e.target.value)} className={INPUT} /></div>
          <div className="flex-1"><FieldLabel>Email</FieldLabel><input value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} /></div>
        </div>

        <div><FieldLabel>Nom légal</FieldLabel><input value={legalName} onChange={(e) => setLegalName(e.target.value)} className={INPUT} /></div>

        <div>
          <FieldLabel>Notes (vérification)</FieldLabel>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={cn(INPUT, 'h-auto py-3 leading-relaxed')} />
        </div>

        <PrimaryPill onClick={handleSubmit} disabled={!canSubmit} loading={upsert.isPending} type="button">
          {isEdit ? 'Enregistrer' : 'Créer le fournisseur'}
        </PrimaryPill>
      </div>
    </div>
  );
}

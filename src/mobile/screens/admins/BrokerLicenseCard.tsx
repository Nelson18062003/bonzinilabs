/**
 * L'agrément d'un commissionnaire agréé en douane (rôle customs_broker), sur
 * sa fiche d'équipe. Sans agrément enregistré, le compte voit la file mais ne
 * peut ni prendre ni signer une fiche : la société et le numéro d'agrément
 * sont imprimés sur chaque classement signé.
 * Écriture : customs_broker_register (canManageUsers, garde serveur).
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { BadgeCheck, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BottomSheet, Button, Card, FormField, Holder, Line, Row, Segmented, TextInput, TEXT, TYPE } from '@/mobile/designKit';
import { useBrokerProfile, useRegisterBroker } from '@/hooks/useCustomsReview';

export function BrokerLicenseCard({ userId, canEdit }: { userId: string; canEdit: boolean }) {
  const profile = useBrokerProfile(userId);
  const register = useRegisterBroker();
  const [open, setOpen] = useState(false);
  const [company, setCompany] = useState('');
  const [license, setLicense] = useState('');
  const [representative, setRepresentative] = useState('');
  const [active, setActive] = useState<'yes' | 'no'>('yes');
  const [tried, setTried] = useState(false);

  const p = profile.data;
  const edit = () => {
    setCompany(p?.company ?? '');
    setLicense(p?.license_no ?? '');
    setRepresentative(p?.representative_no ?? '');
    setActive(p?.active === false ? 'no' : 'yes');
    setTried(false);
    setOpen(true);
  };
  const save = () => {
    setTried(true);
    if (company.trim().length < 2 || license.trim().length < 2) return;
    register.mutate(
      { userId, company: company.trim(), licenseNo: license.trim(), representativeNo: representative.trim() || null, active: active === 'yes' },
      {
        onSuccess: () => { toast.success('Agrément enregistré'); setOpen(false); },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  return (
    <Card className="space-y-2">
      <div className="flex items-center gap-3">
        <Holder icon={BadgeCheck} tone={p?.active ? 'success' : 'pending'} />
        <div className="min-w-0 flex-1">
          <p className={cn('text-[16px] font-semibold', TEXT.strong)}>Agrément de commissionnaire</p>
          <p className={cn('text-[14px]', TEXT.muted)}>
            {profile.isLoading ? 'Chargement…' : p ? (p.active ? 'Peut signer les classements' : 'Suspendu : ne signe plus') : 'Non enregistré : ne peut pas signer'}
          </p>
        </div>
        {canEdit && (
          <Button size="sm" variant="neutral" className="shrink-0" onClick={edit}>
            <Edit2 aria-hidden /> {p ? 'Modifier' : 'Saisir'}
          </Button>
        )}
      </div>
      {p && (
        <div className="px-1">
          <Row label="Société" value={p.company} />
          <Row label="N° d’agrément" value={p.license_no} />
          {p.representative_no && <Row label="N° de représentant" value={p.representative_no} />}
        </div>
      )}

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Agrément de commissionnaire">
        <div className="space-y-4">
          <Line>La société et le numéro d’agrément figurent sur chaque classement que ce compte signe. Vérifiez-les sur la décision d’agrément.</Line>
          <FormField label="Société agréée" htmlFor="br-company" error={tried && company.trim().length < 2 ? 'Indiquez la société.' : null}>
            <TextInput id="br-company" value={company} onChange={(e) => setCompany(e.target.value)} maxLength={160} placeholder="CITRA SARL" />
          </FormField>
          <FormField label="Numéro d’agrément (CAD)" htmlFor="br-license" error={tried && license.trim().length < 2 ? 'Indiquez le numéro d’agrément.' : null}>
            <TextInput id="br-license" value={license} onChange={(e) => setLicense(e.target.value)} maxLength={60} />
          </FormField>
          <FormField label="Numéro de représentant (facultatif)" htmlFor="br-rep" hint="Le déclarant en douane qui agit pour la société (art. 151).">
            <TextInput id="br-rep" value={representative} onChange={(e) => setRepresentative(e.target.value)} maxLength={60} />
          </FormField>
          <div className="space-y-2">
            <p className={cn(TYPE.bodyStrong, TEXT.strong)}>Peut signer</p>
            <Segmented value={active} onChange={setActive} options={[{ value: 'yes', label: 'Oui' }, { value: 'no', label: 'Suspendu' }]} />
          </div>
          <Button className="w-full" loading={register.isPending} onClick={save}>Enregistrer</Button>
        </div>
      </BottomSheet>
    </Card>
  );
}

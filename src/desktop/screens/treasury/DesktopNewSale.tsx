/**
 * Desktop admin — Nouvelle vente USDT (archétype C).
 *
 * Remplace le montage du wizard téléphone sur la route desktop.
 * Le récapitulatif de droite porte l'information qui décide : le **stock
 * après la vente**. Aujourd'hui l'opérateur ne découvre le stock négatif
 * qu'APRÈS l'enregistrement, dans un toast d'avertissement — ici il le voit
 * pendant la saisie, avant de valider.
 *
 * Logique reprise à l'identique du mobile : 3 modes (USDT+CNY → taux,
 * USDT+taux → CNY, CNY+taux → USDT) et compte CNY crédité OPTIONNEL — le cas
 * courant étant qu'aucun compte Bonzini n'est concerné.
 */
import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  TEXT,
  Card,
  CardHeader,
  Chip,
  SecLabel,
  SOFT_PILL,
  PrimaryPill,
  SoftPill,
  FormField,
  TextInput,
  CenterDialog,
} from '@/desktop/designKit';
import { OccurredAtField, PhoneInputWithCountry } from '@/components/form';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import {
  useCounterparties,
  useCreateCounterparty,
  useRecordUsdtSale,
  useTreasuryAccounts,
  useUsdtStock,
  useUsdtWac,
} from '@/hooks/useTreasury';
import { fmtNum, RATE_DECIMALS } from './treasuryFormat';
import { TreasuryMoneyInput } from './TreasuryMoneyInput';
import { TreasurySelect } from './TreasurySelect';

type Mode = 'usdt_cny' | 'usdt_rate' | 'cny_rate';

const MODES: ReadonlyArray<{ value: Mode; label: string }> = [
  { value: 'usdt_cny', label: 'USDT + CNY' },
  { value: 'usdt_rate', label: 'USDT + taux' },
  { value: 'cny_rate', label: 'CNY + taux' },
];

/** Valeur sentinelle du Select : Radix n'accepte pas la chaîne vide. */
const NO_ACCOUNT = '__none__';

function RecapRow({ label, value, unit, strong }: { label: string; value: string; unit?: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={cn('text-[12px]', TEXT.muted)}>{label}</span>
      <span className={cn('tabular-nums', strong ? cn('text-[15px] font-extrabold', TEXT.strong) : cn('text-[13px] font-semibold', TEXT.body))}>
        {value}
        {unit && <span className={cn('ml-1 text-[10.5px] font-normal', TEXT.muted)}>{unit}</span>}
      </span>
    </div>
  );
}

export function DesktopNewSale() {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const { data: buyers } = useCounterparties('cny_buyer');
  const { data: cnyAccounts } = useTreasuryAccounts('CNY');
  const { data: wac } = useUsdtWac();
  const { data: stock } = useUsdtStock();
  const create = useCreateCounterparty();
  const submit = useRecordUsdtSale();

  const [buyerId, setBuyerId] = useState('');
  const [cnyAccountId, setCnyAccountId] = useState('');
  const [occurredAt, setOccurredAt] = useState<string>(() => new Date().toISOString());
  const [mode, setMode] = useState<Mode>('usdt_cny');
  const [usdtAmount, setUsdtAmount] = useState<number | null>(null);
  const [cnyAmount, setCnyAmount] = useState<number | null>(null);
  const [rate, setRate] = useState<number | null>(null);
  const [externalRef, setExternalRef] = useState('');
  const [notes, setNotes] = useState('');

  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [newPhone, setNewPhone] = useState<string | null>(null);
  const [newWechat, setNewWechat] = useState('');

  const resolved = useMemo(() => {
    if (mode === 'usdt_cny') {
      const r = usdtAmount && cnyAmount && usdtAmount > 0 ? cnyAmount / usdtAmount : null;
      return { usdt: usdtAmount, cny: cnyAmount, rate: r };
    }
    if (mode === 'usdt_rate') {
      const c = usdtAmount && rate && rate > 0 ? usdtAmount * rate : null;
      return { usdt: usdtAmount, cny: c, rate };
    }
    const u = cnyAmount && rate && rate > 0 ? cnyAmount / rate : null;
    return { usdt: u, cny: cnyAmount, rate };
  }, [mode, usdtAmount, cnyAmount, rate]);

  if (!hasPermission('canManageTreasury')) {
    return <Navigate to="/m/more" replace />;
  }

  const costBasis = wac !== undefined && resolved.usdt ? resolved.usdt * wac : null;
  const stockAfter = stock !== undefined && resolved.usdt !== null ? stock - resolved.usdt : null;
  const willGoNegative = stockAfter !== null && stockAfter < 0;

  const valid = !!buyerId && resolved.usdt !== null && resolved.usdt > 0 && resolved.cny !== null && resolved.cny > 0;

  const handleSubmit = async () => {
    if (!valid || resolved.usdt === null || resolved.cny === null || submit.isPending) return;
    const result = await submit.mutateAsync({
      buyer_id: buyerId,
      cny_account_id: cnyAccountId || null,
      usdt_amount: resolved.usdt,
      cny_amount: resolved.cny,
      occurred_at: occurredAt,
      external_ref: externalRef || undefined,
      notes: notes || undefined,
    });
    if (result.success) navigate('/m/more/treasury');
  };

  const handleCreateBuyer = async () => {
    if (!newName.trim() || create.isPending) return;
    const result = await create.mutateAsync({
      type: 'cny_buyer',
      display_name: newName.trim(),
      legal_name: newCompany.trim() || undefined,
      phone: newPhone ?? undefined,
      wechat_id: newWechat.trim() || undefined,
    });
    if (result.success && result.id) {
      setBuyerId(result.id);
      setNewOpen(false);
      setNewName('');
      setNewCompany('');
      setNewPhone(null);
      setNewWechat('');
    }
  };

  return (
    <div className="mx-auto max-w-[1080px] space-y-4">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/m/more/treasury')}
          aria-label="Retour à la trésorerie"
          className={cn('flex h-9 w-9 items-center justify-center rounded-full', SOFT_PILL)}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h2 className={cn('text-[20px] font-bold tracking-tight', TEXT.strong)}>Nouvelle vente USDT</h2>
          <p className={cn('mt-0.5 text-[13px]', TEXT.muted)}>Sortie de stock : USDT vendu → CNY reçu</p>
        </div>
      </header>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <Card className="p-0">
            <CardHeader title="Acheteur" />
            <div className="space-y-3 p-5">
              <div className="flex items-end gap-2">
                <FormField label="Acheteur CNY" htmlFor="buyer" className="flex-1">
                  <TreasurySelect
                    id="buyer"
                    value={buyerId}
                    onChange={setBuyerId}
                    options={(buyers ?? []).map((b) => ({
                      value: b.id,
                      label: `${b.display_name}${b.wechat_id ? ` · ${b.wechat_id}` : b.phone ? ` · ${b.phone}` : ''}`,
                    }))}
                  />
                </FormField>
                <button type="button" onClick={() => setNewOpen(true)} className={cn('inline-flex h-9 shrink-0 items-center gap-1.5 px-3 text-[12px] font-bold', SOFT_PILL)}>
                  <Plus className="h-3.5 w-3.5" /> Nouveau
                </button>
              </div>

              <FormField
                label="Compte CNY crédité"
                htmlFor="cny-account"
                hint="À renseigner seulement si le CNY a atterri sur un compte Bonzini (cash Guangzhou, Alipay/WeChat…). Sinon laissez « aucun »."
              >
                <TreasurySelect
                  id="cny-account"
                  value={cnyAccountId || NO_ACCOUNT}
                  onChange={(v) => setCnyAccountId(v === NO_ACCOUNT ? '' : v)}
                  options={[
                    { value: NO_ACCOUNT, label: 'Aucun compte Bonzini concerné' },
                    ...(cnyAccounts ?? []).map((a) => ({ value: a.id, label: a.label })),
                  ]}
                />
              </FormField>
            </div>
          </Card>

          <Card className="p-0">
            <CardHeader title="Montant" />
            <div className="space-y-3 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn('text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>Je saisis</span>
                {MODES.map((m) => (
                  <Chip key={m.value} label={m.label} active={mode === m.value} onClick={() => setMode(m.value)} />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(mode === 'usdt_cny' || mode === 'usdt_rate') && (
                  <FormField label="USDT vendu" htmlFor="s-usdt">
                    <TreasuryMoneyInput id="s-usdt" currency="USDT" value={usdtAmount} onValueChange={setUsdtAmount} decimals={2} />
                  </FormField>
                )}
                {(mode === 'usdt_cny' || mode === 'cny_rate') && (
                  <FormField label="CNY reçu" htmlFor="s-cny">
                    <TreasuryMoneyInput id="s-cny" currency="CNY" value={cnyAmount} onValueChange={setCnyAmount} decimals={2} />
                  </FormField>
                )}
                {(mode === 'usdt_rate' || mode === 'cny_rate') && (
                  <FormField label="Taux" htmlFor="s-rate">
                    <TreasuryMoneyInput id="s-rate" currency="CNY/USDT" value={rate} onValueChange={setRate} decimals={4} />
                  </FormField>
                )}
              </div>
            </div>
          </Card>

          <Card className="p-0">
            <CardHeader title="Détails" meta="Date · référence · note" />
            <div className="space-y-3 p-5">
              {/* OccurredAtField porte déjà son propre libellé. */}
              <OccurredAtField value={occurredAt} onChange={setOccurredAt} />
              <p className={cn('text-[12px]', TEXT.muted)}>
                Antidatable — saisissez la date réelle de la vente.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Référence externe">
                  <TextInput value={externalRef} onChange={(e) => setExternalRef(e.target.value)} />
                </FormField>
                <FormField label="Note">
                  <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
                </FormField>
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:sticky lg:top-4">
          <Card className="p-0">
            <CardHeader title="Récapitulatif" />
            <div className="space-y-3 p-5">
              <RecapRow label="USDT vendu" value={fmtNum(resolved.usdt, 2)} unit="USDT" strong />
              <RecapRow label="CNY reçu" value={fmtNum(resolved.cny, 2)} unit="CNY" strong />
              <div className="border-t border-black/[0.06] pt-3 dark:border-white/[0.06]">
                <RecapRow label="Taux effectif" value={fmtNum(resolved.rate, RATE_DECIMALS.cnyPerUsdt)} unit="CNY/USDT" />
              </div>

              <div className="border-t border-black/[0.06] pt-3 dark:border-white/[0.06]">
                <SecLabel>Effet sur le stock</SecLabel>
                <div className="mt-2 space-y-2">
                  <RecapRow label="Coût des USDT vendus" value={fmtNum(costBasis, 0)} unit="XAF" />
                  <RecapRow label="Stock actuel" value={fmtNum(stock, 2)} unit="USDT" />
                  <RecapRow label="Stock après vente" value={fmtNum(stockAfter, 2)} unit="USDT" />
                </div>
              </div>

              {willGoNegative && (
                <div className="flex items-start gap-2 rounded-[10px] bg-[#FBE7E7] px-3 py-2.5 dark:bg-[#3A2526]">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#C0504D] dark:text-[#E79A9A]" />
                  <span className="text-[12px] font-medium text-[#C0504D] dark:text-[#E79A9A]">
                    Cette vente rendrait le stock négatif ({fmtNum(stockAfter, 2)} USDT). Il manque probablement un achat au
                    journal — saisissez-le d'abord, sinon le WAC et le bénéfice seront faux.
                  </span>
                </div>
              )}

              <PrimaryPill onClick={handleSubmit} disabled={!valid} loading={submit.isPending} className="w-full">
                Enregistrer la vente
              </PrimaryPill>
            </div>
          </Card>
        </div>
      </div>

      <CenterDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onConfirm={handleCreateBuyer}
        title="Nouvel acheteur CNY"
        width={440}
        footer={
          <>
            <PrimaryPill onClick={handleCreateBuyer} disabled={!newName.trim()} loading={create.isPending} className="flex-1">
              Créer
            </PrimaryPill>
            <SoftPill onClick={() => setNewOpen(false)} className="flex-1">Annuler</SoftPill>
          </>
        }
      >
        <div className="space-y-3">
          <FormField label="Nom" htmlFor="new-buyer">
            <TextInput id="new-buyer" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </FormField>
          <FormField label="Entreprise (optionnel)">
            <TextInput value={newCompany} onChange={(e) => setNewCompany(e.target.value)} />
          </FormField>
          <PhoneInputWithCountry label="Téléphone (optionnel)" value={newPhone} onValueChange={setNewPhone} defaultDialCode="+86" />
          <FormField label="WeChat ID (optionnel)">
            <TextInput value={newWechat} onChange={(e) => setNewWechat(e.target.value)} />
          </FormField>
        </div>
      </CenterDialog>
    </div>
  );
}

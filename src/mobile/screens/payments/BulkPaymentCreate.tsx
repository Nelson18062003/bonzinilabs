// ============================================================
// MODULE PAIEMENTS — Paiement groupé (bulk) : création
//
// Un seul client → plusieurs bénéficiaires de méthodes mixtes
// (Alipay / WeChat / Virement / Cash), payés ensemble depuis son
// wallet. Chaque ligne devient un vrai paiement (réutilise tout le
// module : traitement, preuves, reçu, remboursement par ligne).
//
// Création atomique tout-ou-rien via useCreatePaymentBatch →
// create_payment_batch (un verrou wallet, une vérif de solde).
// Conversion XAF↔¥ IDENTIQUE à MobileNewPayment (taux = ¥ / 1 000 000 XAF).
// Réutilise : PaymentMethodLogo (vrais logos), le carnet
// (useAdminClientBeneficiaries / useAdminCreateBeneficiary), l'upload QR
// du data layer (qr_code_files), et la validation par méthode (spec.ts).
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { useAllClients } from '@/hooks/useAdminDeposits';
import { useActiveDailyRate } from '@/hooks/useDailyRates';
import { getBaseRate } from '@/lib/rateCalculation';
import { useCreatePaymentBatch, type CreatePaymentBatchInput, type PaymentMethod } from '@/hooks/usePaymentBatches';
import {
  useAdminClientBeneficiaries,
  useAdminCreateBeneficiary,
  type Beneficiary,
} from '@/hooks/useBeneficiaries';
import {
  validateBeneficiaryInput,
  isBeneficiaryComplete,
  isSameBeneficiaryKey,
  type BeneficiaryInput,
  type RelationType,
  type IdentifierType,
} from '@/lib/beneficiaries/spec';
import { formatXAF, formatYuan } from '@/lib/formatters';
import { toStoredPath } from '@/lib/signedUrls';
import { validateUploadFile, cn } from '@/lib/utils';
import type { PaymentMethodKey } from '@/types/rates';
import { PaymentMethodLogo } from '@/mobile/components/payments/PaymentMethodLogo';
import {
  ChevronLeft, Plus, Search, Trash2, Pencil, Copy, Wallet, AlertTriangle, Users,
  QrCode, Check, Phone, Mail, Hash, Maximize2, RotateCcw, Landmark, Banknote, BookUser,
  ChevronRight, Lock, Info, X,
} from 'lucide-react';
import {
  SURFACE, TEXT, PAYMENT_METHOD, Card, Holder, Avatar, PrimaryPill, SoftPill,
  Segmented, FormField, TextInput, BottomSheet, SectionTitle,
} from '@/mobile/designKit';

const VIOLET = '#8B5CF6';
const AMBER = '#E8932A';
const GREEN = '#2E7D52';
const RED = '#C0504D';
const FALLBACK_RATE = 11530;
const UI_METHODS: PaymentMethodKey[] = ['alipay', 'wechat', 'virement', 'cash'];

const dbMethod = (m: PaymentMethodKey): PaymentMethod => (m === 'virement' ? 'bank_transfer' : m);
const fromDbMethod = (m: PaymentMethod): PaymentMethodKey => (m === 'bank_transfer' ? 'virement' : m);

/** A finalized beneficiary line (computed amounts frozen). */
interface DraftLine {
  id: string;
  method: PaymentMethodKey;
  xaf: number;
  cny: number;
  rate: number;
  rateIsCustom: boolean;
  alias: string;
  name: string;
  identifierType: IdentifierType;
  identifier: string;
  phone: string;
  email: string;
  bank: string;
  account: string;
  bankExtra: string;
  relation: RelationType;
  notes: string;
  clientComment: string;
  qrFile?: File;
  qrPreview?: string; // local blob (newly picked)
  qrStoredUrl?: string; // signed (from carnet) — display
  qrStoredPath?: string; // canonical (from carnet) — to send
  beneficiaryId?: string; // from carnet
  saveToCarnet: boolean;
}

/** ¥ ALWAYS before the number (amber unit). */
function Yen({ value, size = 'sm' }: { value: number; size?: 'sm' | 'md' | 'lg' }) {
  const sym = size === 'lg' ? 'text-[22px]' : size === 'md' ? 'text-[14px]' : 'text-[12px]';
  const num = size === 'lg' ? 'text-[32px] leading-none tracking-tight' : size === 'md' ? 'text-[15px]' : 'text-[13px]';
  return (
    <span className="inline-flex items-baseline gap-1 tabular-nums">
      <span className={cn('font-extrabold', sym)} style={{ color: AMBER }}>¥</span>
      <span className={cn('font-extrabold', num, TEXT.strong)}>{formatYuan(value)}</span>
    </span>
  );
}

function Chip({ icon: Icon, label, on, onClick }: { icon?: React.ComponentType<{ className?: string }>; label: string; on?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11.5px] font-bold transition active:scale-95',
        on ? 'text-white' : cn('bg-black/[0.05] dark:bg-white/[0.06]', TEXT.muted),
      )}
      style={on ? { background: VIOLET } : undefined}
    >
      {Icon && <Icon className="h-3 w-3" />} {label}
    </button>
  );
}

export function BulkPaymentCreate({ desktop = false }: { desktop?: boolean } = {}) {
  const navigate = useNavigate();
  const { t } = useTranslation('payments');
  const { data: clients = [] } = useAllClients();
  const { data: rateData } = useActiveDailyRate();
  const createBatch = useCreatePaymentBatch();
  const createBeneficiary = useAdminCreateBeneficiary();

  const methodLabel = (m: PaymentMethodKey) => t(`method.${dbMethod(m)}`, { defaultValue: PAYMENT_METHOD[m].label });

  const { data: walletsMap = new Map<string, number>() } = useQuery({
    queryKey: ['all-wallets-for-bulk-payment'],
    queryFn: async () => {
      const { data, error } = await supabaseAdmin.from('wallets').select('user_id, balance_xaf');
      if (error) throw error;
      return new Map((data ?? []).map((w) => [w.user_id, w.balance_xaf as number]));
    },
    staleTime: 30_000,
  });

  const [search, setSearch] = useState('');
  const [client, setClient] = useState<(typeof clients)[number] | null>(null);
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);

  // overlays
  const [editorOpen, setEditorOpen] = useState(false);
  const [carnetOpen, setCarnetOpen] = useState(false);
  const [recapOpen, setRecapOpen] = useState(false);
  const [qrZoom, setQrZoom] = useState<{ url: string; name: string } | null>(null);
  const [triedCommit, setTriedCommit] = useState(false);

  // editor fields
  const [editingId, setEditingId] = useState<string | null>(null);
  const [eMethod, setEMethod] = useState<PaymentMethodKey>('alipay');
  const [eCurrency, setECurrency] = useState<'xaf' | 'cny'>('cny');
  const [eRawAmount, setERawAmount] = useState('');
  const [eCustomRate, setECustomRate] = useState(false);
  const [eCustomRateStr, setECustomRateStr] = useState('');
  const [eAlias, setEAlias] = useState('');
  const [eName, setEName] = useState('');
  const [eIdType, setEIdType] = useState<IdentifierType>('id');
  const [eIdentifier, setEIdentifier] = useState('');
  const [ePhone, setEPhone] = useState('');
  const [eEmail, setEEmail] = useState('');
  const [eBank, setEBank] = useState('');
  const [eAccount, setEAccount] = useState('');
  const [eBankExtra, setEBankExtra] = useState('');
  const [eRelation, setERelation] = useState<RelationType>('supplier');
  const [eComment, setEComment] = useState('');
  const [eQrFile, setEQrFile] = useState<File | undefined>();
  const [eQrPreview, setEQrPreview] = useState<string | undefined>();
  const [eQrStoredUrl, setEQrStoredUrl] = useState<string | undefined>();
  const [eQrStoredPath, setEQrStoredPath] = useState<string | undefined>();
  const [eBeneficiaryId, setEBeneficiaryId] = useState<string | undefined>();
  const [eSaveToCarnet, setESaveToCarnet] = useState(false);
  const [eCh, setECh] = useState({ qr: false, id: false, phone: false, email: false });

  const { data: carnet = [] } = useAdminClientBeneficiaries(client?.user_id);

  const clientBalance = client ? walletsMap.get(client.user_id) ?? 0 : 0;
  const totalXaf = lines.reduce((s, l) => s + l.xaf, 0);
  const totalCny = lines.reduce((s, l) => s + l.cny, 0);
  const remaining = clientBalance - totalXaf;
  const overBudget = totalXaf > clientBalance;

  // Live conversion (mirrors MobileNewPayment).
  const eBaseRate = rateData ? getBaseRate(rateData, eMethod) : FALLBACK_RATE;
  const eRate = eCustomRate ? parseInt(eCustomRateStr) || FALLBACK_RATE : eBaseRate;
  const eRaw = parseInt(eRawAmount) || 0;
  const eXaf = eCurrency === 'xaf' ? eRaw : Math.round((eRaw * 1_000_000) / eRate);
  const eCny = eCurrency === 'xaf' ? Math.round((eRaw * eRate) / 1_000_000) : eRaw;

  const isCash = eMethod === 'cash';
  const isBank = eMethod === 'virement';
  const isQrMethod = eMethod === 'alipay' || eMethod === 'wechat';
  const hasQr = !!eQrFile || !!eQrStoredPath;

  // Per-method validation via the shared spec.
  const editorBenef: BeneficiaryInput = useMemo(() => ({
    payment_method: dbMethod(eMethod),
    alias: eAlias.trim() || eName.trim(),
    name: eName.trim(),
    identifier: eIdentifier.trim() || null,
    identifier_type: eIdentifier.trim() ? eIdType : (hasQr ? 'qr' : null),
    phone: ePhone.trim() || null,
    email: eEmail.trim() || null,
    bank_name: eBank.trim() || null,
    bank_account: eAccount.trim() || null,
    bank_extra: eBankExtra.trim() || null,
    qr_code_url: hasQr ? 'has-qr' : null,
    relation_type: eRelation,
    notes: eComment.trim() || null,
  }), [eMethod, eAlias, eName, eIdentifier, eIdType, ePhone, eEmail, eBank, eAccount, eBankExtra, eRelation, eComment, hasQr]);

  const benefErrors = validateBeneficiaryInput(editorBenef);
  const benefComplete = isBeneficiaryComplete(editorBenef);
  const amountValid = eXaf >= 1 && eCny >= 1;
  const editorValid = amountValid && benefComplete;

  function errMsg(): string | null {
    if (!amountValid) return t('bulk.errAmount', { defaultValue: 'Renseignez un montant valide' });
    const k = Object.values(benefErrors)[0];
    if (!k) return null;
    if (k.endsWith('accountChannelRequired')) return t('bulk.errChannel', { defaultValue: 'Ajoutez un QR, un ID, un téléphone ou un e-mail' });
    if (k.includes('nameRequired')) return t('bulk.errName', { defaultValue: 'Nom du bénéficiaire requis' });
    if (k.includes('bank_nameRequired')) return t('bulk.errBank', { defaultValue: 'Banque requise' });
    if (k.includes('bank_accountRequired')) return t('bulk.errAccount', { defaultValue: 'Numéro de compte requis' });
    if (k.includes('phoneRequired')) return t('bulk.errPhone', { defaultValue: 'Téléphone requis' });
    if (k.endsWith('tooLong')) return t('bulk.errLong', { defaultValue: 'Un champ est trop long' });
    return t('bulk.errIncomplete', { defaultValue: 'Bénéficiaire incomplet' });
  }

  const filtered = clients.filter((c) => {
    const full = `${c.first_name ?? ''} ${c.last_name ?? ''}`.toLowerCase();
    return full.includes(search.toLowerCase()) || (c.phone ?? '').includes(search);
  });

  // Revoke the local blob preview ONLY on unmount (via a ref). Revoking it on
  // every change races React StrictMode's double-invoke and blanks the preview.
  const qrPreviewRef = useRef<string | undefined>(undefined);
  qrPreviewRef.current = eQrPreview;
  useEffect(() => () => { if (qrPreviewRef.current) URL.revokeObjectURL(qrPreviewRef.current); }, []);

  function resetEditor() {
    setEMethod('alipay'); setECurrency('cny'); setERawAmount('');
    setECustomRate(false); setECustomRateStr('');
    setEAlias(''); setEName(''); setEIdType('id'); setEIdentifier('');
    setEPhone(''); setEEmail(''); setEBank(''); setEAccount(''); setEBankExtra('');
    setERelation('supplier'); setEComment('');
    setEQrFile(undefined); setEQrPreview(undefined); setEQrStoredUrl(undefined); setEQrStoredPath(undefined);
    setEBeneficiaryId(undefined); setESaveToCarnet(false); setTriedCommit(false);
    setECh({ qr: false, id: false, phone: false, email: false });
  }

  function openAdd() { resetEditor(); setEditingId(null); setEditorOpen(true); }

  function openEdit(l: DraftLine) {
    setEditingId(l.id);
    setEMethod(l.method); setECurrency('cny'); setERawAmount(String(l.cny));
    setECustomRate(l.rateIsCustom); setECustomRateStr(String(l.rate));
    setEAlias(l.alias); setEName(l.name); setEIdType(l.identifierType); setEIdentifier(l.identifier);
    setEPhone(l.phone); setEEmail(l.email); setEBank(l.bank); setEAccount(l.account); setEBankExtra(l.bankExtra);
    setERelation(l.relation); setEComment(l.clientComment);
    setEQrFile(l.qrFile); setEQrPreview(l.qrPreview); setEQrStoredUrl(l.qrStoredUrl); setEQrStoredPath(l.qrStoredPath);
    setEBeneficiaryId(l.beneficiaryId); setESaveToCarnet(l.saveToCarnet); setTriedCommit(false);
    setECh({ qr: !!(l.qrFile || l.qrStoredPath), id: !!l.identifier, phone: !!l.phone, email: !!l.email });
    setEditorOpen(true);
  }

  function pickFromCarnet(b: Beneficiary) {
    setEMethod(fromDbMethod(b.payment_method));
    setEAlias(b.alias); setEName(b.name);
    setEIdType((b.identifier_type as IdentifierType) || 'id');
    setEIdentifier(b.identifier ?? '');
    setEPhone(b.phone ?? ''); setEEmail(b.email ?? '');
    setEBank(b.bank_name ?? ''); setEAccount(b.bank_account ?? ''); setEBankExtra(b.bank_extra ?? '');
    setERelation((b.relation_type as RelationType) || 'supplier');
    setEQrFile(undefined); setEQrPreview(undefined);
    setEQrStoredUrl(b.qr_code_url ?? undefined);
    setEQrStoredPath(b.qr_code_url ? toStoredPath(b.qr_code_url) ?? undefined : undefined);
    setEBeneficiaryId(b.id); setESaveToCarnet(false);
    setECh({ qr: !!b.qr_code_url, id: !!b.identifier, phone: !!b.phone, email: !!b.email });
    setCarnetOpen(false);
  }

  function onQrPick(file?: File) {
    if (!file) return;
    try { validateUploadFile(file); } catch (e) { toast.error((e as Error).message); return; }
    if (eQrPreview) URL.revokeObjectURL(eQrPreview);
    setEQrFile(file);
    setEQrPreview(URL.createObjectURL(file));
    setEQrStoredUrl(undefined); setEQrStoredPath(undefined);
  }

  function removeQr() {
    if (eQrPreview) URL.revokeObjectURL(eQrPreview);
    setEQrFile(undefined); setEQrPreview(undefined); setEQrStoredUrl(undefined); setEQrStoredPath(undefined);
  }

  function toggleCh(ch: 'qr' | 'id' | 'phone' | 'email') {
    setECh((c) => {
      const on = !c[ch];
      if (!on) {
        if (ch === 'qr') removeQr();
        if (ch === 'id') setEIdentifier('');
        if (ch === 'phone') setEPhone('');
        if (ch === 'email') setEEmail('');
      }
      return { ...c, [ch]: on };
    });
  }

  function commitLine() {
    if (!editorValid) { setTriedCommit(true); return; }
    const draft: DraftLine = {
      id: editingId ?? crypto.randomUUID(),
      method: eMethod, xaf: eXaf, cny: eCny, rate: eRate, rateIsCustom: eCustomRate,
      alias: eAlias.trim() || eName.trim(), name: eName.trim(),
      identifierType: eIdType, identifier: eIdentifier.trim(),
      phone: ePhone.trim(), email: eEmail.trim(),
      bank: eBank.trim(), account: eAccount.trim(), bankExtra: eBankExtra.trim(),
      relation: eRelation, notes: '', clientComment: eComment.trim(),
      qrFile: eQrFile, qrPreview: eQrPreview, qrStoredUrl: eQrStoredUrl, qrStoredPath: eQrStoredPath,
      beneficiaryId: eBeneficiaryId, saveToCarnet: eSaveToCarnet,
    };
    // soft duplicate warning (does not block)
    const dup = lines.some((l) => l.id !== draft.id && isSameBeneficiaryKey(
      { ...editorBenef },
      {
        payment_method: dbMethod(l.method), alias: l.alias, name: l.name,
        identifier: l.identifier || null, bank_account: l.account || null,
      } as BeneficiaryInput,
    ));
    if (dup) toast(t('bulk.dupWarn', { defaultValue: 'Ce bénéficiaire est déjà dans le lot' }));
    setLines((prev) => (editingId ? prev.map((x) => (x.id === editingId ? draft : x)) : [...prev, draft]));
    setEditorOpen(false);
  }

  function lineComplete(l: DraftLine): boolean {
    return isBeneficiaryComplete({
      payment_method: dbMethod(l.method), alias: l.alias, name: l.name,
      identifier: l.identifier || null, identifier_type: l.identifier ? l.identifierType : (l.qrFile || l.qrStoredPath ? 'qr' : null),
      phone: l.phone || null, email: l.email || null,
      bank_name: l.bank || null, bank_account: l.account || null, bank_extra: l.bankExtra || null,
      qr_code_url: (l.qrFile || l.qrStoredPath) ? 'has-qr' : null, relation_type: l.relation, notes: null,
    });
  }

  async function confirmCreate() {
    if (!client || lines.length === 0 || overBudget) return;
    const input: CreatePaymentBatchInput = {
      user_id: client.user_id,
      note: note.trim() || undefined,
      lines: lines.map((l) => ({
        method: dbMethod(l.method),
        amount_xaf: l.xaf,
        amount_rmb: l.cny,
        exchange_rate: l.rate,
        rate_is_custom: l.rateIsCustom,
        beneficiary_name: l.name || undefined,
        beneficiary_identifier: l.identifier || undefined,
        beneficiary_identifier_type: l.identifier ? l.identifierType : ((l.qrFile || l.qrStoredPath) ? 'qr' : undefined),
        beneficiary_phone: l.phone || undefined,
        beneficiary_email: l.email || undefined,
        beneficiary_bank_name: l.bank || undefined,
        beneficiary_bank_account: l.account || undefined,
        beneficiary_bank_extra: l.bankExtra || undefined,
        beneficiary_qr_code_url: l.qrStoredPath || undefined,
        qr_code_files: l.qrFile ? [l.qrFile] : undefined,
        beneficiary_id: l.beneficiaryId || undefined,
        client_visible_comment: l.clientComment || undefined,
      })),
    };
    createBatch.mutate(input, {
      onSuccess: async (res) => {
        // persist flagged NEW beneficiaries to the client's carnet (best-effort)
        const toSave = lines.filter((l) => l.saveToCarnet && !l.beneficiaryId);
        for (const l of toSave) {
          try {
            await createBeneficiary.mutateAsync({
              client_id: client.user_id,
              payment_method: dbMethod(l.method),
              alias: l.alias, name: l.name,
              identifier: l.identifier || null,
              identifier_type: l.identifier ? l.identifierType : (l.qrFile ? 'qr' : null),
              phone: l.phone || null, email: l.email || null,
              bank_name: l.bank || null, bank_account: l.account || null, bank_extra: l.bankExtra || null,
              relation_type: l.relation,
              qr_code_file: l.qrFile,
            });
          } catch { /* the hook toasts; never block navigation on a carnet save */ }
        }
        navigate(res.batch_id ? `/m/payments/batch/${res.batch_id}` : '/m/payments');
      },
    });
  }

  return (
    <div className={cn('min-h-full', SURFACE.canvas)}>
      <div className={cn('mx-auto w-full max-w-3xl px-4 pb-44', desktop ? 'pt-8' : 'pt-6')}>
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Holder icon={ChevronLeft} size="sm" onClick={() => navigate('/m/payments')} ariaLabel={t('bulk.back', { defaultValue: 'Retour' })} />
          <div>
            <h1 className={cn('text-[22px] font-extrabold tracking-tight', TEXT.strong)}>{t('bulk.title', { defaultValue: 'Paiement groupé' })}</h1>
            <p className={cn('text-[13px]', TEXT.muted)}>{t('bulk.subtitle', { defaultValue: 'Plusieurs bénéficiaires, un seul client, payés ensemble' })}</p>
          </div>
        </div>

        {/* 1 — Client */}
        <SectionTitle>{t('bulk.clientToDebit', { defaultValue: 'Client à débiter' })}</SectionTitle>
        {client ? (
          <Card className="mb-6 flex items-center gap-3">
            <Avatar name={`${client.first_name ?? ''} ${client.last_name ?? ''}`} tone="info" />
            <div className="min-w-0 flex-1">
              <p className={cn('truncate text-[15px] font-bold', TEXT.strong)}>{client.first_name} {client.last_name}</p>
              <p className={cn('flex items-center gap-1.5 text-[12px]', TEXT.muted)}>
                <Wallet className="h-3.5 w-3.5" /> {t('form.balance', { defaultValue: 'Solde' })} {formatXAF(clientBalance)}
              </p>
            </div>
            <SoftPill onClick={() => { setClient(null); setLines([]); }} className="px-4 py-2 text-[13px]">{t('bulk.change', { defaultValue: 'Changer' })}</SoftPill>
          </Card>
        ) : (
          <Card className="mb-6">
            <div className="relative mb-3">
              <Search className={cn('pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2', TEXT.muted)} />
              <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('bulk.searchClient', { defaultValue: 'Rechercher un client (nom, téléphone)…' })} className="pl-9" />
            </div>
            <div className="max-h-72 space-y-1.5 overflow-y-auto">
              {filtered.slice(0, 40).map((c) => (
                <button key={c.user_id} type="button" onClick={() => { setClient(c); setSearch(''); }} className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
                  <Avatar name={`${c.first_name ?? ''} ${c.last_name ?? ''}`} size="sm" tone="info" />
                  <div className="min-w-0 flex-1">
                    <p className={cn('truncate text-[14px] font-semibold', TEXT.strong)}>{c.first_name} {c.last_name}</p>
                    {c.phone && <p className={cn('truncate text-[11.5px]', TEXT.muted)}>{c.phone}</p>}
                  </div>
                  <span className={cn('shrink-0 text-[12px] font-bold tabular-nums', TEXT.muted)}>{formatXAF(walletsMap.get(c.user_id) ?? 0)}</span>
                </button>
              ))}
              {filtered.length === 0 && <p className={cn('px-2 py-8 text-center text-[13px]', TEXT.muted)}>{t('bulk.noClientFound', { defaultValue: 'Aucun client trouvé.' })}</p>}
            </div>
          </Card>
        )}

        {/* 2 — Lines */}
        {client && (
          <>
            <SectionTitle action={{ label: t('bulk.add', { defaultValue: 'Ajouter' }), onClick: openAdd }}>
              {t('bulk.beneficiariesCount', { count: lines.length, defaultValue: `Bénéficiaires (${lines.length})` })}
            </SectionTitle>

            {lines.length === 0 ? (
              <Card className="mb-6 flex flex-col items-center py-10 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: `${VIOLET}14` }}>
                  <Users className="h-7 w-7" style={{ color: VIOLET }} />
                </span>
                <p className={cn('mt-3 text-[15px] font-extrabold', TEXT.strong)}>{t('bulk.emptyTitle', { defaultValue: 'Ajoutez votre premier fournisseur' })}</p>
                <p className={cn('mt-1 max-w-[280px] text-[12.5px]', TEXT.muted)}>{t('bulk.emptyBody', { defaultValue: 'Chaque ligne devient un paiement à part entière, réglé ensemble depuis le solde du client.' })}</p>
                <PrimaryPill onClick={openAdd} className="mt-4"><Plus className="h-4 w-4" /> {t('bulk.addBeneficiary', { defaultValue: 'Ajouter un bénéficiaire' })}</PrimaryPill>
              </Card>
            ) : (
              <div className="mb-6 space-y-2.5">
                {lines.map((l) => {
                  const ok = lineComplete(l);
                  return (
                    <Card key={l.id} className="flex items-center gap-3 p-3">
                      <PaymentMethodLogo method={dbMethod(l.method)} size={40} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={cn('truncate text-[14px] font-bold', TEXT.strong)}>{l.alias || l.name || methodLabel(l.method)}</span>
                          {ok ? <Check className="h-3.5 w-3.5 shrink-0" style={{ color: GREEN }} /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: AMBER }} />}
                        </div>
                        <p className={cn('truncate text-[12px]', TEXT.muted)}>{l.identifier || l.account || l.phone || methodLabel(l.method)}</p>
                      </div>
                      <div className="text-right">
                        <Yen value={l.cny} size="md" />
                        <p className={cn('text-[11px] tabular-nums', TEXT.muted)}>{formatXAF(l.xaf)}</p>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1">
                        <Holder icon={Pencil} size="sm" onClick={() => openEdit(l)} ariaLabel={t('detail.edit', { defaultValue: 'Modifier' })} />
                        <Holder icon={Copy} size="sm" onClick={() => setLines((p) => [...p, { ...l, id: crypto.randomUUID(), beneficiaryId: undefined, saveToCarnet: false }])} ariaLabel={t('bulk.duplicate', { defaultValue: 'Dupliquer' })} />
                        <Holder icon={Trash2} size="sm" tone="danger" onClick={() => setLines((p) => p.filter((x) => x.id !== l.id))} ariaLabel={t('bulk.remove', { defaultValue: 'Retirer' })} />
                      </div>
                    </Card>
                  );
                })}
                <button type="button" onClick={openAdd} className={cn('flex w-full items-center justify-center gap-2 rounded-[22px] border-2 border-dashed py-3.5 text-[13px] font-bold transition', 'border-black/10 hover:bg-black/[0.02] dark:border-white/10 dark:hover:bg-white/[0.03]', TEXT.muted)}>
                  <Plus className="h-4 w-4" /> {t('bulk.addBeneficiary', { defaultValue: 'Ajouter un bénéficiaire' })}
                </button>
              </div>
            )}

            <FormField label={t('bulk.note', { defaultValue: 'Note (optionnel)' })} className="mb-6">
              <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('bulk.notePlaceholder', { defaultValue: 'Référence interne, contexte…' })} />
            </FormField>
          </>
        )}
      </div>

      {/* Sticky total + per-method breakdown + CTA */}
      {client && lines.length > 0 && (
        <div className="sticky bottom-0 z-10 border-t border-black/[0.06] bg-[#ECEAF7]/85 px-4 py-3 backdrop-blur dark:border-white/[0.06] dark:bg-[#141320]/85">
          <div className="mx-auto max-w-3xl">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <Yen value={totalCny} size="lg" />
                  <span className={cn('text-[13px] font-semibold tabular-nums', TEXT.muted)}>{formatXAF(totalXaf)}</span>
                </div>
                <p className={cn('mt-0.5 flex items-center gap-1 text-[11.5px] font-medium tabular-nums', overBudget ? 'text-[#C0504D] dark:text-[#E79A9A]' : TEXT.muted)}>
                  {overBudget ? <><AlertTriangle className="h-3.5 w-3.5" /> {t('form.insufficientBalance', { defaultValue: 'Solde insuffisant' })}</> : <>{t('bulk.remaining', { amount: formatXAF(remaining), defaultValue: `Restant ${formatXAF(remaining)}` })}</>}
                </p>
              </div>
              <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: `${VIOLET}1A`, color: VIOLET }}>
                <Lock className="h-3 w-3" /> {t('bulk.locked', { defaultValue: 'solde verrouillé' })}
              </span>
            </div>
            <Breakdown lines={lines} />
            <PrimaryPill onClick={() => setRecapOpen(true)} disabled={overBudget} className="mt-2.5 w-full">
              {t('bulk.review', { count: lines.length, defaultValue: `Vérifier & créer (${lines.length})` })}
            </PrimaryPill>
          </div>
        </div>
      )}

      {/* ── Editor ── */}
      <BottomSheet open={editorOpen} onClose={() => setEditorOpen(false)} title={editingId ? t('bulk.editBeneficiary', { defaultValue: 'Modifier le bénéficiaire' }) : t('bulk.newBeneficiary', { defaultValue: 'Nouveau bénéficiaire' })}>
        <div className="space-y-4">
          {/* carnet shortcut */}
          {!editingId && carnet.length > 0 && (
            <button type="button" onClick={() => setCarnetOpen(true)} className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left ring-1 ring-inset ring-black/[0.06] dark:ring-white/[0.08]" style={{ background: `${VIOLET}0D` }}>
              <span className="flex h-9 w-9 items-center justify-center rounded-full text-white" style={{ background: VIOLET }}><BookUser className="h-4 w-4" /></span>
              <div className="flex-1">
                <p className={cn('text-[13.5px] font-bold', TEXT.strong)}>{t('bulk.fromCarnet', { defaultValue: 'Choisir dans le carnet' })}</p>
                <p className={cn('text-[11.5px]', TEXT.muted)}>{t('bulk.carnetCount', { count: carnet.length, defaultValue: `${carnet.length} bénéficiaires enregistrés` })}</p>
              </div>
              <ChevronRight className={cn('h-4 w-4', TEXT.muted)} />
            </button>
          )}

          {/* method */}
          <div className="grid grid-cols-4 gap-2">
            {UI_METHODS.map((m) => {
              const meta = PAYMENT_METHOD[m];
              const active = eMethod === m;
              return (
                <button key={m} type="button" onClick={() => setEMethod(m)} aria-label={methodLabel(m)} className={cn('flex flex-col items-center gap-1.5 rounded-2xl py-2.5 transition active:scale-95', active ? 'ring-2' : cn('ring-1 ring-inset ring-black/[0.06] dark:ring-white/[0.08]'))} style={active ? { ['--tw-ring-color' as string]: meta.color, backgroundColor: `${meta.color}12` } : undefined}>
                  <PaymentMethodLogo method={dbMethod(m)} size={34} />
                  <span className={cn('text-[11px] font-bold', active ? TEXT.strong : TEXT.muted)}>{methodLabel(m)}</span>
                </button>
              );
            })}
          </div>

          {/* amount + rate */}
          <div className="rounded-[22px] bg-black/[0.035] p-3.5 ring-1 ring-inset ring-black/[0.06] dark:bg-white/[0.04] dark:ring-white/[0.08]">
            <Segmented value={eCurrency} onChange={setECurrency} options={[{ value: 'cny', label: '¥ RMB' }, { value: 'xaf', label: 'XAF' }]} className="mb-2" />
            <TextInput inputMode="numeric" value={eRawAmount} onChange={(e) => setERawAmount(e.target.value.replace(/[^\d]/g, ''))} placeholder={eCurrency === 'cny' ? t('bulk.amountInRmb', { defaultValue: 'Montant en ¥' }) : t('bulk.amountInXaf', { defaultValue: 'Montant en XAF' })} />
            <div className="mt-2 flex items-center gap-1.5 px-1 text-[12px]">
              <span className={TEXT.muted}>≈</span>
              {eCurrency === 'cny' ? <span className={cn('font-bold tabular-nums', TEXT.strong)}>{formatXAF(eXaf)}</span> : <Yen value={eCny} size="sm" />}
            </div>
            {/* presets */}
            <div className="mt-3 flex gap-1.5">
              {(eCurrency === 'cny' ? [['¥1K', 1000], ['¥2,5K', 2500], ['¥5K', 5000]] : [['250K', 250000], ['500K', 500000], ['1M', 1000000]]).map(([lbl, val]) => (
                <button key={lbl as string} type="button" onClick={() => setERawAmount(String(val))} className={cn('flex-1 rounded-xl py-1.5 text-center text-[12px] font-bold transition active:scale-95', 'bg-black/[0.05] dark:bg-white/[0.06]', TEXT.muted)}>{lbl}</button>
              ))}
              <button type="button" onClick={() => { setECurrency('xaf'); setERawAmount(String(Math.max(0, remaining))); }} className="flex-1 rounded-xl py-1.5 text-center text-[12px] font-bold text-white transition active:scale-95" style={{ background: VIOLET }}>{t('bulk.all', { defaultValue: 'Restant' })}</button>
            </div>
            {/* rate */}
            <div className="mt-3 border-t border-black/[0.06] pt-3 dark:border-white/[0.07]">
              {!eCustomRate ? (
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className={cn('text-[12.5px] font-bold', TEXT.strong)}>{t('bulk.dailyRate', { defaultValue: 'Taux du jour' })}</span>
                      <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: `${GREEN}1F`, color: GREEN }}>auto</span>
                    </div>
                    <p className={cn('text-[12px] tabular-nums', TEXT.muted)}>1 000 000 XAF = <span className="font-bold" style={{ color: AMBER }}>¥{formatYuan(eBaseRate)}</span></p>
                  </div>
                  <button type="button" onClick={() => { setECustomRate(true); setECustomRateStr(String(eBaseRate)); }} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold" style={{ background: `${VIOLET}1F`, color: VIOLET }}>
                    <Pencil className="h-3.5 w-3.5" /> {t('bulk.personalize', { defaultValue: 'Personnaliser' })}
                  </button>
                </div>
              ) : (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className={cn('text-[12.5px] font-bold', TEXT.strong)}>{t('bulk.customRateLabel', { defaultValue: 'Taux personnalisé' })}</span>
                      <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: `${AMBER}26`, color: AMBER }}>manuel</span>
                    </div>
                    <button type="button" onClick={() => setECustomRate(false)} className="flex items-center gap-1 text-[11.5px] font-bold" style={{ color: VIOLET }}><RotateCcw className="h-3 w-3" /> {t('bulk.dailyRate', { defaultValue: 'Taux du jour' })}</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1"><TextInput inputMode="numeric" value={eCustomRateStr} onChange={(e) => setECustomRateStr(e.target.value.replace(/[^\d]/g, ''))} placeholder={String(eBaseRate)} /></div>
                    <span className={cn('text-[11px] font-medium leading-tight', TEXT.muted)}>¥ pour<br />1 000 000 XAF</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* name (always) */}
          <FormField label={t('form.beneficiaryName', { defaultValue: 'Nom du bénéficiaire' })}>
            <TextInput value={eName} onChange={(e) => setEName(e.target.value)} placeholder={t('bulk.fullName', { defaultValue: 'Nom complet' })} />
          </FormField>

          {/* alipay/wechat — choose one or several reachability channels */}
          {isQrMethod && (
            <div>
              <label className={cn('mb-1 ml-0.5 block text-[12.5px] font-bold', TEXT.strong)}>{t('bulk.channels', { defaultValue: 'Coordonnées du bénéficiaire' })}</label>
              <p className={cn('mb-2 ml-0.5 text-[11.5px]', TEXT.muted)}>{t('bulk.channelsHint', { defaultValue: 'Choisissez un ou plusieurs moyens (au moins un).' })}</p>
              <div className="mb-3 flex flex-wrap gap-1.5">
                <Chip icon={QrCode} label="QR code" on={eCh.qr} onClick={() => toggleCh('qr')} />
                <Chip icon={Hash} label="ID" on={eCh.id} onClick={() => toggleCh('id')} />
                <Chip icon={Phone} label={t('bulk.phone', { defaultValue: 'Téléphone' })} on={eCh.phone} onClick={() => toggleCh('phone')} />
                <Chip icon={Mail} label="E-mail" on={eCh.email} onClick={() => toggleCh('email')} />
              </div>
              {eCh.qr && (
                eQrPreview || eQrStoredUrl ? (
                  <div className="mb-3 flex items-center gap-3 rounded-2xl bg-black/[0.035] p-2.5 ring-1 ring-inset ring-black/[0.06] dark:bg-white/[0.05] dark:ring-white/[0.08]">
                    <button type="button" onClick={() => setQrZoom({ url: (eQrPreview || eQrStoredUrl)!, name: eName || methodLabel(eMethod) })} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-black/10">
                      <img src={eQrPreview || eQrStoredUrl} alt="QR" className="h-full w-full object-cover" />
                      <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full text-white ring-2 ring-white dark:ring-[#26242F]" style={{ background: VIOLET }}><Maximize2 className="h-3 w-3" /></span>
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={cn('flex items-center gap-1.5 text-[13px] font-bold', TEXT.strong)}><Check className="h-4 w-4" style={{ color: GREEN }} /> {t('bulk.qrAdded', { defaultValue: 'QR code ajouté' })}</p>
                      <p className="mt-0.5 text-[11.5px] font-semibold" style={{ color: VIOLET }}>{t('bulk.qrTapZoom', { defaultValue: 'Appuyer pour agrandir' })}</p>
                    </div>
                    <label className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-black/[0.05] dark:bg-white/[0.06]"><Pencil className={cn('h-3.5 w-3.5', TEXT.muted)} /><input type="file" accept="image/*" className="hidden" onChange={(e) => onQrPick(e.target.files?.[0])} /></label>
                  </div>
                ) : (
                  <label className="mb-3 flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-black/12 bg-black/[0.015] px-3.5 py-3 dark:border-white/15 dark:bg-white/[0.02]">
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => onQrPick(e.target.files?.[0])} />
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: `${VIOLET}1A` }}><QrCode className="h-6 w-6" style={{ color: VIOLET }} /></span>
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-[13px] font-bold', TEXT.strong)}>{t('bulk.qrAdd', { defaultValue: 'Ajouter le QR code' })}</p>
                      <p className={cn('text-[11.5px]', TEXT.muted)}>{t('bulk.qrHint', { defaultValue: 'Le plus fiable pour Alipay / WeChat' })}</p>
                    </div>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full text-white" style={{ background: VIOLET }}><Plus className="h-4 w-4" /></span>
                  </label>
                )
              )}
              {eCh.id && (
                <FormField label={t('bulk.identifier', { defaultValue: 'Identifiant' })}>
                  <TextInput value={eIdentifier} onChange={(e) => setEIdentifier(e.target.value)} placeholder={t('bulk.idPlaceholder', { defaultValue: 'ID Alipay / WeChat du fournisseur' })} />
                </FormField>
              )}
              {eCh.phone && (
                <FormField label={t('bulk.phone', { defaultValue: 'Téléphone' })}>
                  <TextInput value={ePhone} onChange={(e) => setEPhone(e.target.value)} placeholder="+86 …" />
                </FormField>
              )}
              {eCh.email && (
                <FormField label="E-mail">
                  <TextInput value={eEmail} onChange={(e) => setEEmail(e.target.value)} placeholder="nom@exemple.com" />
                </FormField>
              )}
            </div>
          )}

          {/* virement — bank coordinates */}
          {isBank && (
            <>
              <FormField label={t('bulk.bank', { defaultValue: 'Banque' })}>
                <div className="flex items-center gap-2">
                  <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-2xl" style={{ background: `${VIOLET}1F` }}><Landmark className="h-5 w-5" style={{ color: VIOLET }} /></span>
                  <div className="flex-1"><TextInput value={eBank} onChange={(e) => setEBank(e.target.value)} placeholder={t('bulk.bankPlaceholder', { defaultValue: 'Nom de la banque' })} /></div>
                </div>
              </FormField>
              <FormField label={t('bulk.account', { defaultValue: 'Numéro de compte / IBAN' })}>
                <TextInput value={eAccount} onChange={(e) => setEAccount(e.target.value)} placeholder={t('bulk.accountPlaceholder', { defaultValue: 'Compte / IBAN' })} />
              </FormField>
              <FormField label={t('bulk.bankExtra', { defaultValue: 'SWIFT / agence' })}>
                <TextInput value={eBankExtra} onChange={(e) => setEBankExtra(e.target.value)} placeholder="BKCHCNBJ…" />
              </FormField>
            </>
          )}

          {/* cash — phone (required) + auto withdrawal QR */}
          {isCash && (
            <>
              <FormField label={t('bulk.phoneReq', { defaultValue: 'Téléphone' })}>
                <div className="flex items-center gap-2">
                  <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-2xl" style={{ background: `${PAYMENT_METHOD.cash.color}1F` }}><Banknote className="h-5 w-5" style={{ color: PAYMENT_METHOD.cash.color }} /></span>
                  <div className="flex-1"><TextInput value={ePhone} onChange={(e) => setEPhone(e.target.value)} placeholder="+86 …" /></div>
                </div>
              </FormField>
              <div className="flex items-start gap-2 rounded-2xl px-3.5 py-3" style={{ background: `${VIOLET}14` }}>
                <Info className="mt-0.5 h-4 w-4 shrink-0" style={{ color: VIOLET }} />
                <p className={cn('text-[12px] leading-snug', TEXT.strong)}>{t('bulk.cashInfo', { defaultValue: 'Un QR de retrait est généré automatiquement — rien à joindre.' })}</p>
              </div>
            </>
          )}

          <FormField label={t('bulk.clientComment', { defaultValue: 'Commentaire visible par le client (optionnel)' })}>
            <TextInput value={eComment} onChange={(e) => setEComment(e.target.value)} placeholder={t('bulk.clientCommentPlaceholder', { defaultValue: 'Réf. commande, facture…' })} />
          </FormField>

          {/* save to carnet (only for a freshly typed beneficiary) */}
          {!eBeneficiaryId && (
            <button type="button" onClick={() => setESaveToCarnet((v) => !v)} className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left transition" style={{ background: eSaveToCarnet ? `${VIOLET}14` : undefined }}>
              <span className={cn('flex h-6 w-6 items-center justify-center rounded-md', eSaveToCarnet ? 'text-white' : cn('ring-1 ring-inset ring-black/15 dark:ring-white/20'))} style={eSaveToCarnet ? { background: VIOLET } : undefined}>{eSaveToCarnet && <Check className="h-4 w-4" />}</span>
              <div className="flex-1">
                <p className={cn('text-[13px] font-bold', TEXT.strong)}>{t('bulk.saveCarnet', { defaultValue: 'Enregistrer dans le carnet' })}</p>
                <p className={cn('text-[11.5px]', TEXT.muted)}>{t('bulk.saveCarnetHint', { defaultValue: 'Réutilisable pour les prochains paiements de ce client' })}</p>
              </div>
            </button>
          )}

          {/* alias + relation — carnet metadata, only when saving / editing a saved one */}
          {(eSaveToCarnet || eBeneficiaryId) && (
            <>
              <FormField label={t('bulk.alias', { defaultValue: 'Alias (libellé court)' })}>
                <TextInput value={eAlias} onChange={(e) => setEAlias(e.target.value)} placeholder={t('bulk.aliasPlaceholder', { defaultValue: 'Par défaut : le nom' })} />
              </FormField>
              <FormField label={t('bulk.relation', { defaultValue: 'Relation' })}>
                <div className="flex gap-1.5">
                  <Chip label={t('bulk.relSelf', { defaultValue: 'Soi-même' })} on={eRelation === 'self'} onClick={() => setERelation('self')} />
                  <Chip label={t('bulk.relSupplier', { defaultValue: 'Fournisseur' })} on={eRelation === 'supplier'} onClick={() => setERelation('supplier')} />
                  <Chip label={t('bulk.relOther', { defaultValue: 'Autre' })} on={eRelation === 'other'} onClick={() => setERelation('other')} />
                </div>
              </FormField>
            </>
          )}

          {triedCommit && errMsg() && (
            <p className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: RED }}><AlertTriangle className="h-3.5 w-3.5" /> {errMsg()}</p>
          )}

          <div className="flex gap-2.5 pt-1">
            <SoftPill onClick={() => setEditorOpen(false)} className="flex-1">{t('bulk.cancel', { defaultValue: 'Annuler' })}</SoftPill>
            <PrimaryPill onClick={commitLine} className="flex-1">{editingId ? t('bulk.save', { defaultValue: 'Enregistrer' }) : t('bulk.add', { defaultValue: 'Ajouter' })}</PrimaryPill>
          </div>
        </div>
      </BottomSheet>

      {/* ── Carnet picker ── */}
      <BottomSheet open={carnetOpen} onClose={() => setCarnetOpen(false)} title={t('bulk.carnetTitle', { defaultValue: 'Carnet du client' })}>
        <div className="space-y-2">
          {carnet.length === 0 && <p className={cn('py-8 text-center text-[13px]', TEXT.muted)}>{t('bulk.carnetEmpty', { defaultValue: 'Aucun bénéficiaire enregistré.' })}</p>}
          {carnet.map((b) => (
            <button key={b.id} type="button" onClick={() => pickFromCarnet(b)} className="flex w-full items-center gap-3 rounded-2xl p-2.5 text-left ring-1 ring-inset ring-black/[0.06] transition active:scale-[0.99] dark:ring-white/[0.08]">
              <PaymentMethodLogo method={b.payment_method} size={38} />
              <div className="min-w-0 flex-1">
                <p className={cn('truncate text-[14px] font-bold', TEXT.strong)}>{b.alias || b.name}</p>
                <p className={cn('truncate text-[11.5px]', TEXT.muted)}>{b.name} · {b.identifier || b.bank_account || b.phone || methodLabel(fromDbMethod(b.payment_method))}</p>
              </div>
              <ChevronRight className={cn('h-4 w-4 shrink-0', TEXT.muted)} />
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* ── Recap before atomic creation ── */}
      <BottomSheet open={recapOpen} onClose={() => setRecapOpen(false)} title={t('bulk.recapTitle', { defaultValue: 'Vérifier le lot' })}>
        <div className="space-y-2">
          {lines.map((l) => (
            <div key={l.id} className="flex items-center gap-3 rounded-2xl p-2.5 ring-1 ring-inset ring-black/[0.06] dark:ring-white/[0.08]">
              <PaymentMethodLogo method={dbMethod(l.method)} size={34} />
              <p className={cn('min-w-0 flex-1 truncate text-[13.5px] font-semibold', TEXT.strong)}>{l.alias || l.name || methodLabel(l.method)}</p>
              <div className="text-right">
                <Yen value={l.cny} size="sm" />
                <p className={cn('text-[10.5px] tabular-nums', TEXT.muted)}>{formatXAF(l.xaf)}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-2xl p-3" style={{ background: `${VIOLET}0F` }}>
          <div className="flex items-center justify-between">
            <span className={cn('text-[12.5px] font-bold', TEXT.strong)}>{t('bulk.totalDebited', { defaultValue: 'Total débité' })}</span>
            <Yen value={totalCny} size="md" />
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className={cn('text-[12px]', TEXT.muted)}>{t('bulk.remainingAfter', { defaultValue: 'Solde restant' })}</span>
            <span className="text-[12.5px] font-bold tabular-nums" style={{ color: overBudget ? RED : GREEN }}>{formatXAF(remaining)}</span>
          </div>
        </div>
        <div className="mt-4 flex gap-2.5">
          <SoftPill onClick={() => setRecapOpen(false)} className="flex-1">{t('bulk.back', { defaultValue: 'Retour' })}</SoftPill>
          <PrimaryPill onClick={confirmCreate} disabled={overBudget || lines.length === 0} loading={createBatch.isPending} className="flex-[1.4]"><Check className="h-4 w-4" /> {t('bulk.createBatch', { defaultValue: 'Créer le lot' })}</PrimaryPill>
        </div>
      </BottomSheet>

      {/* ── QR fullscreen (above the sheet: z-[70] > z-[60]) ── */}
      {qrZoom && (
        <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-4 bg-black/85 p-6" onClick={() => setQrZoom(null)} role="dialog" aria-modal="true">
          <img src={qrZoom.url} alt="QR" className="max-h-[68vh] w-auto max-w-[88vw] rounded-2xl bg-white p-3" onClick={(e) => e.stopPropagation()} />
          <p className="text-[15px] font-bold text-white">{qrZoom.name}</p>
          <button type="button" onClick={() => setQrZoom(null)} className="rounded-full bg-white/15 px-5 py-2.5 text-[14px] font-bold text-white backdrop-blur">{t('bulk.close', { defaultValue: 'Fermer' })}</button>
        </div>
      )}
    </div>
  );
}

/** Per-method spend breakdown bar + legend. */
function Breakdown({ lines }: { lines: DraftLine[] }) {
  const total = lines.reduce((s, l) => s + l.xaf, 0) || 1;
  const byMethod = UI_METHODS.map((m) => ({
    m, color: PAYMENT_METHOD[m].color,
    xaf: lines.filter((l) => l.method === m).reduce((s, l) => s + l.xaf, 0),
    cny: lines.filter((l) => l.method === m).reduce((s, l) => s + l.cny, 0),
  })).filter((x) => x.xaf > 0);
  if (byMethod.length <= 1) return null;
  return (
    <div className="mb-1">
      <div className="flex h-2 overflow-hidden rounded-full">
        {byMethod.map((s) => <span key={s.m} style={{ width: `${(s.xaf / total) * 100}%`, background: s.color }} />)}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
        {byMethod.map((s) => (
          <span key={s.m} className={cn('flex items-center gap-1 text-[10.5px] font-semibold', TEXT.muted)}>
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            {PAYMENT_METHOD[s.m].label} <span className="font-bold tabular-nums" style={{ color: AMBER }}>¥{formatYuan(s.cny)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

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
// i18n : namespace `payments` (réutilise method.* / form.*), clés `bulk.*`.
// Responsive : même écran pour le shell desktop et le conteneur mobile.
// ============================================================
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { useAllClients } from '@/hooks/useAdminDeposits';
import { useActiveDailyRate } from '@/hooks/useDailyRates';
import { getBaseRate } from '@/lib/rateCalculation';
import { useCreatePaymentBatch, type CreatePaymentBatchInput, type PaymentMethod } from '@/hooks/usePaymentBatches';
import { formatXAF, formatCurrencyRMB } from '@/lib/formatters';
import type { PaymentMethodKey } from '@/types/rates';
import { cn } from '@/lib/utils';
import { ChevronLeft, Plus, Search, Trash2, Pencil, Wallet, AlertTriangle, Users } from 'lucide-react';
import {
  SURFACE,
  TEXT,
  PAYMENT_METHOD,
  Card,
  Holder,
  Avatar,
  Amount,
  PrimaryPill,
  SoftPill,
  Segmented,
  FormField,
  TextInput,
  BottomSheet,
  SectionTitle,
} from '@/mobile/designKit';

const VIOLET = '#8B5CF6';
const FALLBACK_RATE = 11530;
const METHODS: PaymentMethodKey[] = ['alipay', 'wechat', 'virement', 'cash'];

/** A finalized beneficiary line (computed amounts frozen). */
interface DraftLine {
  id: string;
  method: PaymentMethodKey;
  xaf: number;
  cny: number;
  rate: number;
  name: string;
  identifier: string;
  phone: string;
  bank: string;
  account: string;
  notes: string;
}

const dbMethod = (m: PaymentMethodKey): PaymentMethod => (m === 'virement' ? 'bank_transfer' : m);

function MethodGlyph({ method, size = 'md' }: { method: PaymentMethodKey; size?: 'sm' | 'md' }) {
  const meta = PAYMENT_METHOD[method];
  const box = size === 'sm' ? 'h-8 w-8 text-[11px]' : 'h-10 w-10 text-[13px]';
  return (
    <span
      className={cn('flex shrink-0 items-center justify-center rounded-full font-black', box)}
      style={{ backgroundColor: `${meta.color}1A`, color: meta.color }}
    >
      {meta.cn.slice(0, 1)}
    </span>
  );
}

export function BulkPaymentCreate({ desktop = false }: { desktop?: boolean } = {}) {
  const navigate = useNavigate();
  const { t } = useTranslation('payments');
  const { data: clients = [] } = useAllClients();
  const { data: rateData } = useActiveDailyRate();
  const createBatch = useCreatePaymentBatch();

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

  // ── Line editor (BottomSheet) ──────────────────────────────────
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [eMethod, setEMethod] = useState<PaymentMethodKey>('alipay');
  const [eCurrency, setECurrency] = useState<'xaf' | 'cny'>('cny');
  const [eRawAmount, setERawAmount] = useState('');
  const [eCustomRate, setECustomRate] = useState(false);
  const [eCustomRateStr, setECustomRateStr] = useState('');
  const [eName, setEName] = useState('');
  const [eIdentifier, setEIdentifier] = useState('');
  const [ePhone, setEPhone] = useState('');
  const [eBank, setEBank] = useState('');
  const [eAccount, setEAccount] = useState('');
  const [eNotes, setENotes] = useState('');

  const clientBalance = client ? walletsMap.get(client.user_id) ?? 0 : 0;
  const totalXaf = lines.reduce((s, l) => s + l.xaf, 0);
  const totalCny = lines.reduce((s, l) => s + l.cny, 0);
  const remaining = clientBalance - totalXaf;
  const overBudget = totalXaf > clientBalance;

  // Editor live conversion — mirrors MobileNewPayment exactly.
  const eBaseRate = rateData ? getBaseRate(rateData, eMethod) : FALLBACK_RATE;
  const eRate = eCustomRate ? parseInt(eCustomRateStr) || FALLBACK_RATE : eBaseRate;
  const eRaw = parseInt(eRawAmount) || 0;
  const eXaf = eCurrency === 'xaf' ? eRaw : Math.round((eRaw * 1_000_000) / eRate);
  const eCny = eCurrency === 'xaf' ? Math.round((eRaw * eRate) / 1_000_000) : eRaw;

  const isCash = eMethod === 'cash';
  const isBank = eMethod === 'virement';
  const benefValid = isCash
    ? eName.trim().length > 0
    : isBank
      ? eName.trim().length > 0 && eBank.trim().length > 0 && eAccount.trim().length > 0
      : eName.trim().length > 0 && eIdentifier.trim().length > 0;
  const editorValid = eXaf >= 1 && eCny >= 1 && benefValid;

  const filtered = clients.filter((c) => {
    const full = `${c.first_name ?? ''} ${c.last_name ?? ''}`.toLowerCase();
    return full.includes(search.toLowerCase()) || (c.phone ?? '').includes(search);
  });

  function resetEditor() {
    setEMethod('alipay');
    setECurrency('cny');
    setERawAmount('');
    setECustomRate(false);
    setECustomRateStr('');
    setEName('');
    setEIdentifier('');
    setEPhone('');
    setEBank('');
    setEAccount('');
    setENotes('');
  }

  function openAdd() {
    resetEditor();
    setEditingId(null);
    setEditorOpen(true);
  }

  function openEdit(l: DraftLine) {
    setEditingId(l.id);
    setEMethod(l.method);
    setECurrency('cny');
    setERawAmount(String(l.cny));
    setECustomRate(false);
    setECustomRateStr(String(l.rate));
    setEName(l.name);
    setEIdentifier(l.identifier);
    setEPhone(l.phone);
    setEBank(l.bank);
    setEAccount(l.account);
    setENotes(l.notes);
    setEditorOpen(true);
  }

  function commitLine() {
    if (!editorValid) return;
    const draft: DraftLine = {
      id: editingId ?? crypto.randomUUID(),
      method: eMethod,
      xaf: eXaf,
      cny: eCny,
      rate: eRate,
      name: eName.trim(),
      identifier: eIdentifier.trim(),
      phone: ePhone.trim(),
      bank: eBank.trim(),
      account: eAccount.trim(),
      notes: eNotes.trim(),
    };
    setLines((prev) => (editingId ? prev.map((x) => (x.id === editingId ? draft : x)) : [...prev, draft]));
    setEditorOpen(false);
  }

  function submit() {
    if (!client || lines.length === 0 || overBudget) return;
    const input: CreatePaymentBatchInput = {
      user_id: client.user_id,
      note: note.trim() || undefined,
      lines: lines.map((l) => ({
        method: dbMethod(l.method),
        amount_xaf: l.xaf,
        amount_rmb: l.cny,
        exchange_rate: l.rate,
        beneficiary_name: l.name || undefined,
        beneficiary_identifier: l.identifier || undefined,
        beneficiary_identifier_type: l.identifier ? 'id' : undefined,
        beneficiary_phone: l.phone || undefined,
        beneficiary_bank_name: l.bank || undefined,
        beneficiary_bank_account: l.account || undefined,
        beneficiary_notes: l.notes || undefined,
      })),
    };
    createBatch.mutate(input, {
      onSuccess: (res) => navigate(res.batch_id ? `/m/payments/batch/${res.batch_id}` : '/m/payments'),
    });
  }

  return (
    <div className={cn('min-h-full', SURFACE.canvas)}>
      <div className={cn('mx-auto w-full max-w-3xl px-4 pb-40', desktop ? 'pt-8' : 'pt-6')}>
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Holder
            icon={ChevronLeft}
            size="sm"
            onClick={() => navigate('/m/payments')}
            ariaLabel={t('bulk.back', { defaultValue: 'Retour' })}
          />
          <div>
            <h1 className={cn('text-[22px] font-extrabold tracking-tight', TEXT.strong)}>
              {t('bulk.title', { defaultValue: 'Paiement groupé' })}
            </h1>
            <p className={cn('text-[13px]', TEXT.muted)}>
              {t('bulk.subtitle', { defaultValue: 'Plusieurs bénéficiaires, un seul client, payés ensemble' })}
            </p>
          </div>
        </div>

        {/* 1 — Client */}
        <SectionTitle>{t('bulk.clientToDebit', { defaultValue: 'Client à débiter' })}</SectionTitle>
        {client ? (
          <Card className="mb-6 flex items-center gap-3">
            <Avatar name={`${client.first_name ?? ''} ${client.last_name ?? ''}`} tone="info" />
            <div className="min-w-0 flex-1">
              <p className={cn('truncate text-[15px] font-bold', TEXT.strong)}>
                {client.first_name} {client.last_name}
              </p>
              <p className={cn('flex items-center gap-1.5 text-[12px]', TEXT.muted)}>
                <Wallet className="h-3.5 w-3.5" /> {t('form.balance', { defaultValue: 'Solde' })} {formatXAF(clientBalance)}
              </p>
            </div>
            <SoftPill onClick={() => setClient(null)} className="px-4 py-2 text-[13px]">
              {t('bulk.change', { defaultValue: 'Changer' })}
            </SoftPill>
          </Card>
        ) : (
          <Card className="mb-6">
            <div className="relative mb-3">
              <Search className={cn('pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2', TEXT.muted)} />
              <TextInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('bulk.searchClient', { defaultValue: 'Rechercher un client (nom, téléphone)…' })}
                className="pl-9"
              />
            </div>
            <div className="max-h-72 space-y-1.5 overflow-y-auto">
              {filtered.slice(0, 40).map((c) => (
                <button
                  key={c.user_id}
                  type="button"
                  onClick={() => {
                    setClient(c);
                    setSearch('');
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                >
                  <Avatar name={`${c.first_name ?? ''} ${c.last_name ?? ''}`} size="sm" tone="info" />
                  <div className="min-w-0 flex-1">
                    <p className={cn('truncate text-[14px] font-semibold', TEXT.strong)}>
                      {c.first_name} {c.last_name}
                    </p>
                    {c.phone && <p className={cn('truncate text-[11.5px]', TEXT.muted)}>{c.phone}</p>}
                  </div>
                  <span className={cn('shrink-0 text-[12px] font-bold tabular-nums', TEXT.muted)}>
                    {formatXAF(walletsMap.get(c.user_id) ?? 0)}
                  </span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className={cn('px-2 py-8 text-center text-[13px]', TEXT.muted)}>
                  {t('bulk.noClientFound', { defaultValue: 'Aucun client trouvé.' })}
                </p>
              )}
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
                <Holder icon={Users} size="lg" />
                <p className={cn('mt-3 text-[14px] font-medium', TEXT.muted)}>
                  {t('bulk.noBeneficiaries', { defaultValue: "Aucun bénéficiaire pour l'instant." })}
                </p>
                <PrimaryPill onClick={openAdd} className="mt-4">
                  <Plus className="h-4 w-4" /> {t('bulk.addBeneficiary', { defaultValue: 'Ajouter un bénéficiaire' })}
                </PrimaryPill>
              </Card>
            ) : (
              <div className="mb-6 space-y-2.5">
                {lines.map((l) => (
                  <Card key={l.id} className="flex items-center gap-3 p-3.5">
                    <MethodGlyph method={l.method} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={cn('truncate text-[14px] font-bold', TEXT.strong)}>
                          {l.name || methodLabel(l.method)}
                        </span>
                        <span className="shrink-0 text-[11px] font-bold" style={{ color: PAYMENT_METHOD[l.method].color }}>
                          {methodLabel(l.method)}
                        </span>
                      </div>
                      <p className={cn('truncate text-[12px]', TEXT.muted)}>
                        {l.identifier || l.account || l.phone || '—'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={cn('text-[14px] font-extrabold tabular-nums', TEXT.strong)}>
                        {formatCurrencyRMB(l.cny)}
                      </p>
                      <p className={cn('text-[11px] tabular-nums', TEXT.muted)}>{formatXAF(l.xaf)}</p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <Holder icon={Pencil} size="sm" onClick={() => openEdit(l)} ariaLabel={t('detail.edit', { defaultValue: 'Modifier' })} />
                      <Holder
                        icon={Trash2}
                        size="sm"
                        tone="danger"
                        onClick={() => setLines((prev) => prev.filter((x) => x.id !== l.id))}
                        ariaLabel={t('bulk.change', { defaultValue: 'Retirer' })}
                      />
                    </div>
                  </Card>
                ))}
                <button
                  type="button"
                  onClick={openAdd}
                  className={cn(
                    'flex w-full items-center justify-center gap-2 rounded-[22px] border-2 border-dashed py-3.5 text-[13px] font-bold transition',
                    'border-black/10 hover:bg-black/[0.02] dark:border-white/10 dark:hover:bg-white/[0.03]',
                    TEXT.muted,
                  )}
                >
                  <Plus className="h-4 w-4" /> {t('bulk.addBeneficiary', { defaultValue: 'Ajouter un bénéficiaire' })}
                </button>
              </div>
            )}

            {/* Optional note */}
            <FormField label={t('bulk.note', { defaultValue: 'Note (optionnel)' })} className="mb-6">
              <TextInput
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('bulk.notePlaceholder', { defaultValue: 'Référence interne, contexte…' })}
              />
            </FormField>
          </>
        )}
      </div>

      {/* Sticky summary + CTA */}
      {client && lines.length > 0 && (
        <div className="sticky bottom-0 z-10 border-t border-black/[0.06] bg-[#ECEAF7]/85 px-4 py-3 backdrop-blur dark:border-white/[0.06] dark:bg-[#141320]/85">
          <div className="mx-auto flex max-w-3xl items-center gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <Amount value={formatCurrencyRMB(totalCny)} size="md" />
                <span className={cn('text-[13px] font-semibold tabular-nums', TEXT.muted)}>{formatXAF(totalXaf)}</span>
              </div>
              <p
                className={cn(
                  'mt-0.5 flex items-center gap-1 text-[11.5px] font-medium tabular-nums',
                  overBudget ? 'text-[#C0504D] dark:text-[#E79A9A]' : TEXT.muted,
                )}
              >
                {overBudget && <AlertTriangle className="h-3.5 w-3.5" />}
                {overBudget
                  ? t('form.insufficientBalance', { defaultValue: 'Solde insuffisant' })
                  : t('bulk.remaining', { amount: formatXAF(remaining), defaultValue: `Restant ${formatXAF(remaining)}` })}
              </p>
            </div>
            <PrimaryPill
              onClick={submit}
              disabled={overBudget || lines.length === 0}
              loading={createBatch.isPending}
              className="shrink-0"
            >
              {t('bulk.create', { count: lines.length, defaultValue: `Créer (${lines.length})` })}
            </PrimaryPill>
          </div>
        </div>
      )}

      {/* Line editor */}
      <BottomSheet
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={
          editingId
            ? t('bulk.editBeneficiary', { defaultValue: 'Modifier le bénéficiaire' })
            : t('bulk.newBeneficiary', { defaultValue: 'Nouveau bénéficiaire' })
        }
      >
        <div className="space-y-4">
          {/* Method */}
          <div className="grid grid-cols-4 gap-2">
            {METHODS.map((m) => {
              const meta = PAYMENT_METHOD[m];
              const active = eMethod === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setEMethod(m)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-2xl border-2 p-2.5 transition',
                    SURFACE.card,
                    active ? '' : 'border-transparent',
                  )}
                  style={active ? { borderColor: meta.color } : undefined}
                >
                  <MethodGlyph method={m} size="sm" />
                  <span className={cn('truncate text-[11px] font-bold', active ? TEXT.strong : TEXT.muted)}>
                    {methodLabel(m)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Amount */}
          <div>
            <Segmented
              value={eCurrency}
              onChange={setECurrency}
              options={[
                { value: 'cny', label: '¥ RMB' },
                { value: 'xaf', label: 'XAF' },
              ]}
              className="mb-2"
            />
            <TextInput
              inputMode="numeric"
              value={eRawAmount}
              onChange={(e) => setERawAmount(e.target.value.replace(/[^\d]/g, ''))}
              placeholder={
                eCurrency === 'cny'
                  ? t('bulk.amountInRmb', { defaultValue: 'Montant en ¥' })
                  : t('bulk.amountInXaf', { defaultValue: 'Montant en XAF' })
              }
            />
            <div className={cn('mt-1.5 flex items-center justify-between px-1 text-[12px]', TEXT.muted)}>
              <span>
                ≈{' '}
                <span className="font-bold tabular-nums">
                  {eCurrency === 'cny' ? formatXAF(eXaf) : formatCurrencyRMB(eCny)}
                </span>
              </span>
              <button type="button" onClick={() => setECustomRate((v) => !v)} className="font-semibold" style={{ color: VIOLET }}>
                {eCustomRate
                  ? t('bulk.dailyRate', { defaultValue: 'Taux du jour' })
                  : t('bulk.customRate', { defaultValue: 'Taux personnalisé' })}
              </button>
            </div>
            {eCustomRate && (
              <FormField label={t('bulk.rateLabel', { defaultValue: 'Taux (¥ pour 1 000 000 XAF)' })} className="mt-2">
                <TextInput
                  inputMode="numeric"
                  value={eCustomRateStr}
                  onChange={(e) => setECustomRateStr(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder={String(eBaseRate)}
                />
              </FormField>
            )}
          </div>

          {/* Beneficiary fields */}
          <FormField label={t('form.beneficiaryName', { defaultValue: 'Nom du bénéficiaire' })}>
            <TextInput value={eName} onChange={(e) => setEName(e.target.value)} placeholder={t('bulk.fullName', { defaultValue: 'Nom complet' })} />
          </FormField>

          {!isCash && !isBank && (
            <FormField label={t('bulk.identifierLabel', { method: methodLabel(eMethod), defaultValue: `Identifiant ${methodLabel(eMethod)}` })}>
              <TextInput
                value={eIdentifier}
                onChange={(e) => setEIdentifier(e.target.value)}
                placeholder={t('bulk.identifierPlaceholder', { defaultValue: 'ID / téléphone / e-mail' })}
              />
            </FormField>
          )}

          {isBank && (
            <>
              <FormField label={t('bulk.bank', { defaultValue: 'Banque' })}>
                <TextInput value={eBank} onChange={(e) => setEBank(e.target.value)} placeholder={t('bulk.bankPlaceholder', { defaultValue: 'Nom de la banque' })} />
              </FormField>
              <FormField label={t('bulk.account', { defaultValue: 'Numéro de compte' })}>
                <TextInput value={eAccount} onChange={(e) => setEAccount(e.target.value)} placeholder={t('bulk.accountPlaceholder', { defaultValue: 'Compte / IBAN' })} />
              </FormField>
            </>
          )}

          {(isCash || !isBank) && (
            <FormField label={t('bulk.phoneOptional', { defaultValue: 'Téléphone (optionnel)' })}>
              <TextInput value={ePhone} onChange={(e) => setEPhone(e.target.value)} placeholder={t('bulk.phone', { defaultValue: 'Téléphone' })} />
            </FormField>
          )}

          <FormField label={t('bulk.note', { defaultValue: 'Note (optionnel)' })}>
            <TextInput value={eNotes} onChange={(e) => setENotes(e.target.value)} placeholder={t('bulk.precision', { defaultValue: 'Précision' })} />
          </FormField>

          <div className="flex gap-2.5 pt-1">
            <SoftPill onClick={() => setEditorOpen(false)} className="flex-1">
              {t('bulk.cancel', { defaultValue: 'Annuler' })}
            </SoftPill>
            <PrimaryPill onClick={commitLine} disabled={!editorValid} className="flex-1">
              {editingId ? t('bulk.save', { defaultValue: 'Enregistrer' }) : t('bulk.add', { defaultValue: 'Ajouter' })}
            </PrimaryPill>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

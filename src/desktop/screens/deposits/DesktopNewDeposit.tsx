/**
 * Desktop admin — « Nouveau dépôt » dans une FENÊTRE, par-dessus la liste
 * des dépôts (retour du 12/10/2026 : « je ne veux pas un écran à part
 * entière, je veux rester dans Dépôts, un pop-up, un mini formulaire »).
 *
 * L'ordre est celui du geste :
 *   1. le client (recherche nom, téléphone, BZ-…), son solde à droite ;
 *   2. le montant, grand, avec des montants ronds à un clic ;
 *   3. la méthode, en boutons (un clic, pas de menu), puis son type et la
 *      banque ou l'agence quand il le faut — et, repliées, les coordonnées à
 *      dicter au client ;
 *   4. la preuve (facultative ; Ctrl+V colle une capture) ;
 *   5. replié : la date de l'opération (antidater) et la note interne.
 * Le pied de la fenêtre résume le dépôt et porte « Créer le dépôt » (⌘⏎).
 * Même couche de données qu'avant : useAllClients + useAdminCreateDeposit.
 * L'URL reste /m/deposits/new (?clientId= pré-choisit le client) ; une fois
 * créé, la fiche du dépôt s'ouvre dans la liste.
 */
import { useState, useMemo, useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Copy, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useAllClients, useAdminCreateDeposit, useAdminWalletByUserId } from '@/hooks/useAdminDeposits';
import {
  SUB_METHOD_TO_DB_METHOD,
  type DepositMethodFamily,
  type DepositSubMethod,
} from '@/types/deposit';
import {
  methodFamilies,
  selectableMethodFamilies,
  getSubMethodsForFamily,
  banks,
  agencies,
  familyRequiresSubMethod,
  subMethodRequiresBankSelection,
  MOBILE_MONEY_TRANSACTION_LIMIT,
  orangeMoneyAccount,
  mtnMoneyAccount,
  waveAccount,
  omMerchantInfo,
  mtnMerchantInfo,
} from '@/data/depositMethodsData';
import { MIN_DEPOSIT_XAF, isValidXafAmount } from '@/lib/amountLimits';
import { formatCurrency } from '@/lib/formatters';
import { OperationDateCard, resolveOperationDate } from '@/mobile/components/OperationDateCard';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, FormDialog, MIcon, PrimaryPill, SoftPill } from '@/desktop/designKit';
import { ClientPickerField } from '@/desktop/components/ClientPickerField';
import { BigAmount, Choice, Disclosure, Section } from '@/desktop/components/formDialogParts';
import { PasteDropZone } from '@/components/upload/PasteDropZone';
import { FilePreviewGrid } from '@/components/upload/FilePreviewGrid';
import { TextArea } from '@/components/form';
import { DesktopDepositsScreen } from './DesktopDepositsScreen';

function fmt(n: number) {
  return Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function CopyLine({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Copié !');
    } catch {
      toast.error('Erreur lors de la copie');
    }
  };
  return (
    <button type="button" onClick={copy} className={cn('flex w-full items-center justify-between gap-2 rounded-2xl p-3 text-left', SURFACE.canvas)}>
      <span className={cn('shrink-0 text-[11px]', TEXT.muted)}>{label}</span>
      <span className={cn('inline-flex min-w-0 items-center gap-1.5 text-[13px] font-bold', TEXT.strong, mono && 'font-mono text-[12.5px]')}>
        <span className="truncate">{value}</span>
        <Copy className={cn('h-3.5 w-3.5 shrink-0', TEXT.muted)} />
      </span>
    </button>
  );
}

/** Coordonnées + instructions à communiquer, selon la méthode choisie. */
function coordinates(
  family: DepositMethodFamily | null,
  subMethod: DepositSubMethod | null,
  bank: string | null,
  agency: string | null,
  amount: number,
): { lines: { label: string; value: string; mono?: boolean }[]; instructions: string[] } | null {
  const montant = amount > 0 ? formatCurrency(amount) : 'le montant exact';
  if (family === 'BANK' && bank) {
    const b = banks.find((x) => x.bank === bank);
    if (!b) return null;
    return {
      lines: [
        { label: 'Banque', value: b.bonziniAccount.bankName },
        { label: 'N° compte', value: b.bonziniAccount.accountNumber, mono: true },
        { label: 'Titulaire', value: b.bonziniAccount.accountName },
        { label: 'IBAN', value: b.bonziniAccount.iban, mono: true },
        { label: 'SWIFT', value: b.bonziniAccount.swift, mono: true },
      ],
      instructions:
        subMethod === 'BANK_TRANSFER'
          ? ['Le client fait un virement vers ce compte', `Montant exact : ${montant}`, 'Il conserve le reçu → preuve']
          : [`Le client dépose en agence ${b.label}`, `Montant exact : ${montant}`, 'Il conserve le bordereau → preuve'],
    };
  }
  if (family === 'ORANGE_MONEY') {
    if (subMethod === 'OM_TRANSFER') {
      return {
        lines: [
          { label: 'Numéro', value: orangeMoneyAccount.phone, mono: true },
          { label: 'Titulaire', value: orangeMoneyAccount.accountName },
        ],
        instructions: ['Depuis sa puce commerciale Orange (compte UV), transfert de flotte', `Montant : ${montant}`, 'Capture de la confirmation → preuve'],
      };
    }
    return {
      lines: [
        { label: 'Code marchand', value: omMerchantInfo.merchantCode.replace('MONTANT', String(amount || '…')), mono: true },
        { label: 'Titulaire', value: omMerchantInfo.accountName },
      ],
      instructions: ['Le client compose le code marchand', 'Il valide avec son PIN Orange Money', 'Capture du SMS → preuve'],
    };
  }
  if (family === 'MTN_MONEY') {
    if (subMethod === 'MTN_TRANSFER') {
      return {
        lines: [
          { label: 'Numéro', value: mtnMoneyAccount.phone, mono: true },
          { label: 'Titulaire', value: mtnMoneyAccount.accountName },
        ],
        instructions: ['Depuis sa puce commerciale MTN (compte Float), transfert de flotte', `Montant : ${montant}`, 'Capture de la confirmation → preuve'],
      };
    }
    return {
      lines: [
        { label: 'Code marchand', value: mtnMerchantInfo.merchantCode.replace('MONTANT', String(amount || '…')), mono: true },
        { label: 'Titulaire', value: mtnMerchantInfo.accountName },
      ],
      instructions: ['Le client compose le code marchand', 'Il valide avec son PIN MTN', 'Capture du SMS → preuve'],
    };
  }
  if (family === 'WAVE') {
    return {
      lines: [
        { label: 'Numéro Wave', value: waveAccount.phone, mono: true },
        { label: 'Titulaire', value: waveAccount.accountName },
      ],
      instructions: ["Ouvrir l'app Wave → « Envoyer »", `Numéro : ${waveAccount.phone}`, `Montant : ${montant}`],
    };
  }
  if (family === 'AGENCY_BONZINI' && agency) {
    const a = agencies.find((x) => x.agency === agency);
    if (!a) return null;
    return {
      lines: [
        { label: 'Agence', value: a.label },
        { label: 'Adresse', value: a.address },
        { label: 'Horaires', value: a.hours },
      ],
      instructions: [`Le client se rend à ${a.label}`, "Pièce d'identité + espèces", 'Il conserve le reçu'],
    };
  }
  return null;
}

const PRESETS = [100_000, 250_000, 500_000, 1_000_000, 2_000_000, 5_000_000];

/** Les types d'opération, en mots courts (le détail reste en sous-titre). */
const SUB_SHORT: Partial<Record<DepositSubMethod, string>> = {
  BANK_TRANSFER: 'Virement',
  BANK_CASH_DEPOSIT: 'Dépôt au guichet',
  OM_TRANSFER: 'Transfert UV (flotte)',
  OM_WITHDRAWAL: 'Code marchand',
  MTN_TRANSFER: 'Transfert Float',
  MTN_WITHDRAWAL: 'Code marchand',
};

/**
 * /m/deposits/new sur ordinateur : la liste des dépôts, et la fenêtre par-
 * dessus. Fermer revient d'où l'on vient (la liste, la fiche d'un client…).
 */
export function DesktopNewDeposit() {
  const navigate = useNavigate();
  const location = useLocation();
  const close = () => (location.key !== 'default' ? navigate(-1) : navigate('/m/deposits'));
  return (
    <>
      <DesktopDepositsScreen />
      <NewDepositDialog onClose={close} onCreated={(id) => navigate(`/m/deposits/${id}`, { replace: true })} />
    </>
  );
}

export function NewDepositDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (depositId: string) => void }) {
  const [searchParams] = useSearchParams();
  const { data: clients = [], isLoading: clientsLoading } = useAllClients();
  const createDeposit = useAdminCreateDeposit();

  const [clientId, setClientId] = useState<string | null>(searchParams.get('clientId'));
  const [amount, setAmount] = useState<number | null>(null);
  const [family, setFamily] = useState<DepositMethodFamily | null>(null);
  const [subMethod, setSubMethod] = useState<DepositSubMethod | null>(null);
  const [bank, setBank] = useState<string | null>(null);
  const [agency, setAgency] = useState<string | null>(null);
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [adminComment, setAdminComment] = useState('');
  const [useCustomDate, setUseCustomDate] = useState(false);
  const [customDateStr, setCustomDateStr] = useState('');
  const [tried, setTried] = useState(false);

  const client = useMemo(() => clients.find((c) => c.user_id === clientId) ?? null, [clients, clientId]);
  const { data: wallet } = useAdminWalletByUserId(client?.user_id);
  const amountNum = amount ?? 0;

  const pickFamily = (f: DepositMethodFamily) => {
    setFamily(f);
    setBank(null);
    setAgency(null);
    if (familyRequiresSubMethod(f)) {
      // Un seul type possible : il est choisi d'office.
      const subs = getSubMethodsForFamily(f);
      setSubMethod(subs.length === 1 ? subs[0].subMethod : null);
    } else if (f === 'AGENCY_BONZINI') setSubMethod('AGENCY_CASH');
    else if (f === 'WAVE') setSubMethod('WAVE_TRANSFER');
  };

  const subs = family && familyRequiresSubMethod(family) ? getSubMethodsForFamily(family) : [];
  const needsBank = !!subMethod && subMethodRequiresBankSelection(subMethod);
  const needsAgency = family === 'AGENCY_BONZINI';

  const methodComplete =
    !!family &&
    (!familyRequiresSubMethod(family) || !!subMethod) &&
    (!needsBank || !!bank) &&
    (!needsAgency || !!agency);
  const amountValid = isValidXafAmount(amountNum, MIN_DEPOSIT_XAF);

  const methodError = !family
    ? 'Choisissez la méthode.'
    : familyRequiresSubMethod(family) && !subMethod
      ? 'Choisissez le type d’opération.'
      : needsBank && !bank
        ? 'Choisissez la banque.'
        : needsAgency && !agency
          ? 'Choisissez l’agence.'
          : null;
  const firstError = !client
    ? 'Choisissez le client.'
    : !amountValid
      ? `Montant invalide — minimum ${fmt(MIN_DEPOSIT_XAF)} XAF.`
      : methodError;
  const dirty = !!(clientId && !searchParams.get('clientId')) || amount !== null || !!family || proofFiles.length > 0 || !!adminComment.trim() || useCustomDate;

  const submit = useCallback(async () => {
    setTried(true);
    if (!client || !family || !amountValid || !methodComplete || createDeposit.isPending) return;
    // Re-vérifiée ici : la fenêtre peut rester ouverte au-delà du maximum du sélecteur.
    const opDate = resolveOperationDate(useCustomDate, customDateStr);
    if (opDate.error) {
      toast.error(opDate.error);
      return;
    }
    try {
      const result = await createDeposit.mutateAsync({
        user_id: client.user_id,
        amount_xaf: amountNum,
        method: subMethod ? SUB_METHOD_TO_DB_METHOD[subMethod] : 'bank_transfer',
        desired_date: opDate.date,
        bank_name: bank ? banks.find((b) => b.bank === bank)?.label : undefined,
        agency_name: agency ? agencies.find((a) => a.agency === agency)?.label : undefined,
        admin_comment: adminComment.trim() || undefined,
        proofFiles: proofFiles.length > 0 ? proofFiles : undefined,
      });
      onCreated(result.id);
    } catch {
      /* toast handled by the hook */
    }
  }, [client, family, amountValid, methodComplete, createDeposit, useCustomDate, customDateStr, amountNum, subMethod, bank, agency, adminComment, proofFiles, onCreated]);

  const coords = coordinates(family, subMethod, bank, agency, amountNum);
  const familyLabel = methodFamilies.find((f) => f.family === family)?.label;
  const subLabel = subMethod ? SUB_SHORT[subMethod] : undefined;
  const placeLabel = bank ? banks.find((b) => b.bank === bank)?.label : agency ? agencies.find((a) => a.agency === agency)?.label : undefined;
  const mmLimit = amountNum > MOBILE_MONEY_TRANSACTION_LIMIT && (family === 'ORANGE_MONEY' || family === 'MTN_MONEY' || family === 'WAVE');

  return (
    <FormDialog
      open
      onClose={onClose}
      onConfirm={submit}
      title="Nouveau dépôt"
      subtitle="Le portefeuille du client n’est crédité qu’à la validation de la preuve."
      dirty={dirty}
      discardTitle="Abandonner ce dépôt ?"
      width={640}
      footer={
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1 text-[13px] leading-snug">
            {tried && firstError ? (
              <p className="font-semibold text-red-700 dark:text-red-400">{firstError}</p>
            ) : client && amountNum > 0 ? (
              <p className={TEXT.muted}>
                <b className={cn('tabular-nums', TEXT.strong)}>{fmt(amountNum)} XAF</b>
                {family ? <> · {[familyLabel, subLabel, placeLabel].filter(Boolean).join(' · ')}</> : null} · pour{' '}
                <b className={TEXT.strong}>{`${client.first_name ?? ''} ${client.last_name ?? ''}`.trim()}</b>
                {proofFiles.length > 0 ? <> · {proofFiles.length} preuve{proofFiles.length > 1 ? 's' : ''}</> : null}
              </p>
            ) : (
              <p className={TEXT.muted}>⌘⏎ pour créer · Ctrl+V colle une preuve</p>
            )}
          </div>
          <SoftPill onClick={onClose} className="h-11 shrink-0 px-5">
            Annuler
          </SoftPill>
          <PrimaryPill onClick={submit} loading={createDeposit.isPending} className="h-11 shrink-0 px-6">
            Créer le dépôt
          </PrimaryPill>
        </div>
      }
    >
      <div className="space-y-6">
        <Section label="Client" htmlFor="nd-client" error={tried && !client ? 'Choisissez le client.' : null}>
          <ClientPickerField
            id="nd-client"
            clients={clients}
            value={clientId}
            onChange={(c) => setClientId(c.user_id)}
            loading={clientsLoading}
            invalid={tried && !client}
            autoFocus={!clientId}
            meta={(c) =>
              c.user_id === client?.user_id && wallet ? (
                <span className="leading-tight">
                  <span className={cn('block text-[11px]', TEXT.muted)}>Solde</span>
                  <span className={cn('block text-[13px] font-bold tabular-nums', TEXT.strong)}>{fmt(wallet.balance_xaf)} XAF</span>
                </span>
              ) : null
            }
          />
        </Section>

        <Section
          label="Montant"
          hint={`minimum ${fmt(MIN_DEPOSIT_XAF)} XAF`}
          htmlFor="nd-amount"
          error={tried && client && !amountValid ? `Indiquez un montant d’au moins ${fmt(MIN_DEPOSIT_XAF)} XAF.` : null}
        >
          <BigAmount id="nd-amount" value={amount} onChange={setAmount} currency="XAF" invalid={tried && !!client && !amountValid} ariaLabel="Montant du dépôt" />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setAmount(p)}
                className={cn(
                  'rounded-lg px-2.5 py-1 text-[12px] font-semibold tabular-nums transition',
                  amount === p ? 'bg-foreground text-background' : cn(SURFACE.holder, TEXT.strong, 'hover:bg-accent'),
                )}
              >
                {fmt(p)}
              </button>
            ))}
          </div>
        </Section>

        <Section label="Méthode" error={tried && client && amountValid ? methodError : null}>
          <div className="flex flex-wrap gap-2">
            {selectableMethodFamilies.map((f) => (
              <Choice key={f.family} active={family === f.family} onClick={() => pickFamily(f.family)} icon={<MIcon family={f.family} size={20} />}>
                {f.label}
              </Choice>
            ))}
          </div>

          {subs.length > 1 && (
            <div className="mt-3">
              <p className={cn('mb-1.5 text-[12px] font-semibold', TEXT.muted)}>Type d’opération</p>
              <div className="flex flex-wrap gap-2">
                {subs.map((sm) => (
                  <Choice
                    key={sm.subMethod}
                    active={subMethod === sm.subMethod}
                    onClick={() => {
                      setSubMethod(sm.subMethod);
                      setBank(null);
                    }}
                    meta={sm.description}
                  >
                    {SUB_SHORT[sm.subMethod] ?? sm.label}
                  </Choice>
                ))}
              </div>
            </div>
          )}
          {needsBank && (
            <div className="mt-3">
              <p className={cn('mb-1.5 text-[12px] font-semibold', TEXT.muted)}>Banque</p>
              <div className="flex flex-wrap gap-2">
                {banks.map((b) => (
                  <Choice key={b.bank} active={bank === b.bank} onClick={() => setBank(b.bank)}>
                    {b.label}
                  </Choice>
                ))}
              </div>
            </div>
          )}
          {needsAgency && (
            <div className="mt-3">
              <p className={cn('mb-1.5 text-[12px] font-semibold', TEXT.muted)}>Agence</p>
              <div className="flex flex-wrap gap-2">
                {agencies.map((a) => (
                  <Choice key={a.agency} active={agency === a.agency} onClick={() => setAgency(a.agency)} meta={a.address}>
                    {a.label}
                  </Choice>
                ))}
              </div>
            </div>
          )}
          {mmLimit && (
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[12.5px] font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
              Le montant dépasse la limite mobile money ({formatCurrency(MOBILE_MONEY_TRANSACTION_LIMIT)}) : prévoir plusieurs opérations.
            </p>
          )}
          {coords && methodComplete && (
            <div className="mt-3">
              <Disclosure title="Coordonnées à donner au client" summary={coords.lines[0]?.value}>
                <div className="space-y-1.5">
                  {coords.lines.map((l) => (
                    <CopyLine key={l.label} label={l.label} value={l.value} mono={l.mono} />
                  ))}
                </div>
                <ol className="space-y-1.5">
                  {coords.instructions.map((step, i) => (
                    <li key={step} className="flex gap-2.5">
                      <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold', SURFACE.holder)}>{i + 1}</span>
                      <span className={cn('text-[12.5px]', TEXT.muted)}>{step}</span>
                    </li>
                  ))}
                </ol>
              </Disclosure>
            </div>
          )}
        </Section>

        <Section label="Preuve" hint="facultatif · Ctrl+V colle une capture">
          <PasteDropZone onFiles={(files) => setProofFiles((prev) => [...prev, ...files])} enabled busy={createDeposit.isPending} compact />
          {proofFiles.length > 0 && (
            <div className="mt-2">
              <FilePreviewGrid files={proofFiles} onRemove={(i) => setProofFiles((prev) => prev.filter((_, idx) => idx !== i))} />
            </div>
          )}
          {proofFiles.length === 0 && (
            <p className={cn('mt-1.5 flex items-center gap-1.5 text-[12px]', TEXT.muted)}>
              <Info className="h-3.5 w-3.5 shrink-0" /> Sans preuve, le dépôt attend que le client l’envoie.
            </p>
          )}
        </Section>

        <Disclosure
          title="Plus d’options"
          summary={[useCustomDate ? 'date antidatée' : null, adminComment.trim() ? 'note' : null].filter(Boolean).join(' · ') || 'date, note interne'}
        >
          <OperationDateCard
            enabled={useCustomDate}
            value={customDateStr}
            onToggle={(on, nowLocal) => {
              setUseCustomDate(on);
              if (on && !customDateStr) setCustomDateStr(nowLocal);
            }}
            onChange={setCustomDateStr}
            accent="#10B981"
          />
          <TextArea
            id="nd-note"
            label="Note interne (visible des admins seulement)"
            value={adminComment}
            onChange={(e) => setAdminComment(e.target.value)}
            rows={3}
          />
        </Disclosure>
      </div>
    </FormDialog>
  );
}

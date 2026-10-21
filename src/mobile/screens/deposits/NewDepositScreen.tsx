/**
 * Nouveau dépôt, v2 (maquette validée index.html écran 8) — UN écran :
 * le client, le montant reçu, le moyen en tuiles (Orange, MTN, Banque,
 * Agence), la preuve, et UN bouton noir « Créditer 850 000 XAF ».
 *
 * Le constat d'usage (inventaire F) : 98 % des dépôts sont saisis par
 * l'équipe et validés dans la foulée (médiane 6 s). « Créditer » enchaîne
 * donc les deux RPC existantes — create_client_deposit (useAdminCreateDeposit,
 * preuves comprises) puis validate_deposit (useValidateDeposit) — après une
 * feuille de confirmation (solde avant → après, Prévenir le client).
 * « Enregistrer sans créditer » (dans « … ») ne fait que la première.
 * Rare, dans « … » : date de l'opération, note, coordonnées à donner.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarClock, ClipboardCopy, Save, StickyNote } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAdminCreateDeposit, useAllClients, useValidateDeposit } from '@/hooks/useAdminDeposits';
import { MIN_DEPOSIT_XAF, isValidXafAmount } from '@/lib/amountLimits';
import { ACCEPT_UPLOAD, partitionUploadFiles, rejectionMessage } from '@/lib/clipboardFiles';
import { copyToClipboard } from '@/lib/clipboard';
import { cn } from '@/lib/utils';
import {
  agencies, banks, getSubMethodsForFamily, mtnMerchantInfo, mtnMoneyAccount, MOBILE_MONEY_TRANSACTION_LIMIT, omMerchantInfo, orangeMoneyAccount,
  selectableMethodFamilies, waveAccount,
} from '@/data/depositMethodsData';
import { SUB_METHOD_TO_DB_METHOD, type AgencyOption, type BankOption, type DepositMethodFamily, type DepositSubMethod } from '@/types/deposit';
import {
  BigButton, BottomSheet, ConfirmSheet, Dock, Initials, KVBox, MoreButton, ScreenTop, SuccessView, TextArea, TEXT, WhoCard, useSheet, type KV,
} from '@/mobile/designKit';
import { DepositBankLogo } from '@/mobile/components/deposits/DepositLogos';
import { OperationDateCard, resolveOperationDate } from '@/mobile/components/OperationDateCard';
import { FilePreviewGrid } from '@/components/upload/FilePreviewGrid';
import { usePasteFiles } from '@/hooks/usePasteFiles';
import { ClientPicker, type PickedClient } from '@/mobile/screens/operations/ClientPicker';
import { ChoiceChips, DepositRound, FieldLabel, MenuSheet, MethodTile, PhotoDrop, TileGrid, ToggleRow } from '@/mobile/screens/operations/parts';
import { n0 } from '@/mobile/screens/operations/opsLabels';
import { useWalletsMap } from '@/mobile/screens/operations/opsQueries';

const FAMILY_SHORT: Record<DepositMethodFamily, string> = { ORANGE_MONEY: 'Orange', MTN_MONEY: 'MTN', WAVE: 'Wave', BANK: 'Banque', AGENCY_BONZINI: 'Agence' };
const FAMILY_LONG: Record<DepositMethodFamily, string> = { ORANGE_MONEY: 'Orange Money', MTN_MONEY: 'MTN MoMo', WAVE: 'Wave', BANK: 'Banque', AGENCY_BONZINI: 'Agence Bonzini' };
const SUB_SHORT: Partial<Record<DepositSubMethod, string>> = {
  OM_TRANSFER: 'Transfert', OM_WITHDRAWAL: 'Retrait', MTN_TRANSFER: 'Transfert', MTN_WITHDRAWAL: 'Retrait',
  BANK_TRANSFER: 'Virement', BANK_CASH_DEPOSIT: 'Espèces au guichet',
};
const nameOf = (c: { first_name?: string | null; last_name?: string | null } | null) => (c ? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() : '') || 'Client';

export function NewDepositScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const preselected = params.get('clientId');
  const { hasPermission } = useAdminAuth();
  const canCredit = hasPermission('canProcessDeposits');
  const { data: clients } = useAllClients();
  const { data: wallets } = useWalletsMap();
  const createDeposit = useAdminCreateDeposit();
  const validateDeposit = useValidateDeposit();

  const [client, setClient] = useState<PickedClient | null>(null);
  const [picking, setPicking] = useState(!preselected);
  const [amount, setAmount] = useState('');
  const [family, setFamily] = useState<DepositMethodFamily | null>(null);
  const [sub, setSub] = useState<DepositSubMethod | null>(null);
  const [bank, setBank] = useState<BankOption | null>(null);
  const [agency, setAgency] = useState<AgencyOption | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState('');
  const [customDate, setCustomDate] = useState<string | null>(null);
  const [notify, setNotify] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [noteSheet, setNoteSheet] = useState(false);
  const [dateSheet, setDateSheet] = useState(false);
  const [coordSheet, setCoordSheet] = useState(false);
  const [done, setDone] = useState<{ id: string; credited: boolean; amount: number } | null>(null);
  const more = useSheet();

  useEffect(() => {
    if (!preselected || !clients || client) return;
    const c = clients.find((x) => x.user_id === preselected);
    if (c) { setClient(c); setPicking(false); } else setPicking(true);
  }, [preselected, clients, client]);

  const amountNum = Number(amount) || 0;
  const amountOk = isValidXafAmount(amountNum, MIN_DEPOSIT_XAF);
  const subs = family ? getSubMethodsForFamily(family) : [];
  const needsSub = subs.length > 1;
  const effectiveSub: DepositSubMethod | null = family === 'AGENCY_BONZINI' ? 'AGENCY_CASH' : family === 'WAVE' ? 'WAVE_TRANSFER' : sub;
  const methodReady = !!family && !!effectiveSub && (family !== 'BANK' || !!bank) && (family !== 'AGENCY_BONZINI' || !!agency);
  const ready = !!client && amountOk && methodReady;
  const balance = client ? wallets?.get(client.user_id)?.balance ?? null : null;
  const methodLabel = family ? (family === 'BANK' && bank ? banks.find((b) => b.bank === bank)?.label.replace(/ Cameroun$/i, '') ?? 'Banque' : FAMILY_LONG[family]) : '';
  const mmOver = (family === 'ORANGE_MONEY' || family === 'MTN_MONEY') && amountNum > MOBILE_MONEY_TRANSACTION_LIMIT;

  const addFiles = (picked: File[]) => {
    const { accepted, rejected } = partitionUploadFiles(picked);
    const problem = rejectionMessage(rejected);
    if (problem) toast.error(problem);
    if (accepted.length) setFiles((prev) => [...prev, ...accepted]);
  };
  usePasteFiles({ onFiles: addFiles, enabled: !picking && !confirmOpen && !done });

  const chooseFamily = (f: DepositMethodFamily) => {
    setFamily(f);
    const s = getSubMethodsForFamily(f);
    setSub(s.length === 1 ? s[0].subMethod : null);
    setBank(null);
    setAgency(null);
  };

  const submit = async (credit: boolean) => {
    if (!client || !family || !effectiveSub) { toast.error('Informations manquantes'); return; }
    if (!amountOk || !Number.isSafeInteger(amountNum)) { toast.error(`Montant invalide — minimum ${MIN_DEPOSIT_XAF.toLocaleString('fr-FR')} XAF.`); return; }
    const opDate = resolveOperationDate(!!customDate, customDate ?? '');
    if (opDate.error) { toast.error(opDate.error); return; }
    try {
      const created = await createDeposit.mutateAsync({
        user_id: client.user_id,
        amount_xaf: amountNum,
        method: SUB_METHOD_TO_DB_METHOD[effectiveSub],
        desired_date: opDate.date,
        bank_name: bank ? banks.find((b) => b.bank === bank)?.label : undefined,
        agency_name: agency ? agencies.find((a) => a.agency === agency)?.label : undefined,
        admin_comment: note.trim() || undefined,
        proofFiles: files.length > 0 ? files : undefined,
      });
      if (credit && created?.id) {
        try {
          await validateDeposit.mutateAsync({ depositId: created.id, sendNotification: notify });
          setDone({ id: created.id, credited: true, amount: amountNum });
        } catch {
          // Le dépôt existe : il reste « à valider » sur sa fiche.
          setDone({ id: created.id, credited: false, amount: amountNum });
        }
      } else if (created?.id) {
        setDone({ id: created.id, credited: false, amount: amountNum });
      }
      setConfirmOpen(false);
    } catch { /* toast par le hook */ }
  };

  const reset = () => {
    setDone(null); setClient(null); setPicking(true); setAmount(''); setFamily(null); setSub(null); setBank(null); setAgency(null);
    setFiles([]); setNote(''); setCustomDate(null); setNotify(true);
  };

  const coords: KV[] = useMemo(() => {
    const row = (label: string, value: string): KV => ({ label, value, onClick: () => void copyToClipboard(value, label) });
    if (family === 'BANK' && bank) {
      const b = banks.find((x) => x.bank === bank)?.bonziniAccount;
      return b ? [row('Banque', b.bankName), row('Titulaire', b.accountName), row('N° de compte', b.accountNumber), row('IBAN', b.iban), row('SWIFT', b.swift)] : [];
    }
    if (family === 'ORANGE_MONEY') return sub === 'OM_WITHDRAWAL' ? [row('Code marchand', omMerchantInfo.merchantCode), row('Titulaire', omMerchantInfo.accountName)] : [row('Numéro', orangeMoneyAccount.phone), row('Titulaire', orangeMoneyAccount.accountName)];
    if (family === 'MTN_MONEY') return sub === 'MTN_WITHDRAWAL' ? [row('Code marchand', mtnMerchantInfo.merchantCode), row('Titulaire', mtnMerchantInfo.accountName)] : [row('Numéro', mtnMoneyAccount.phone), row('Titulaire', mtnMoneyAccount.accountName)];
    if (family === 'WAVE') return [row('Numéro', waveAccount.phone), row('Titulaire', waveAccount.accountName)];
    if (family === 'AGENCY_BONZINI' && agency) { const a = agencies.find((x) => x.agency === agency); return a ? [row('Agence', a.label), row('Adresse', a.address), row('Horaires', a.hours)] : []; }
    return [];
  }, [family, sub, bank, agency]);

  if (done) {
    return (
      <div className="flex min-h-full flex-col">
        <SuccessView
          title={done.credited ? 'Crédité' : 'Dépôt enregistré'}
          subtitle={<>{n0(done.amount)} XAF · {nameOf(client)}{done.credited && notify ? <><br />{(client?.first_name ?? 'Le client').trim()} est prévenu.</> : null}</>}
          primary={{ label: 'Nouveau dépôt', onClick: reset }}
          secondary={{ label: 'Voir le dépôt', onClick: () => navigate(`/m/deposits/${done.id}`) }}
        />
      </div>
    );
  }

  if (picking) {
    return (
      <div className="flex min-h-full flex-col">
        <ScreenTop title="Nouveau dépôt" onBack={() => { if (client) setPicking(false); else if (preselected) navigate(`/m/clients/${preselected}`); else navigate(-1); }} />
        <ClientPicker onPick={(c) => { setClient(c); setPicking(false); }} balances={wallets} selectedId={client?.user_id} />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <ScreenTop title="Nouveau dépôt" backTo={preselected ? `/m/clients/${preselected}` : undefined} right={<MoreButton onClick={more.show} />} />
      <div className="px-5 pb-4 pt-4">
        {client && (
          <WhoCard leading={<Initials name={nameOf(client)} />} name={nameOf(client)} line={balance != null ? `Solde ${n0(balance)} XAF` : client.phone ?? undefined} onClick={() => setPicking(true)} />
        )}

        <FieldLabel>Montant reçu</FieldLabel>
        <label className="flex h-[68px] items-center gap-2 rounded-lg border border-[#949494] px-4 focus-within:border-2 focus-within:border-[#2C2C2C] dark:border-[#6E6E6E] dark:focus-within:border-[#E3E3E3]">
          <input
            inputMode="numeric"
            enterKeyHint="done"
            aria-label="Montant reçu en XAF"
            placeholder="0"
            value={amount ? n0(amountNum) : ''}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, '').slice(0, 12))}
            className={cn('min-w-0 flex-1 bg-transparent !text-[32px] font-bold tabular-nums tracking-[-0.02em] outline-none placeholder:text-[#B3B3B3]', TEXT.strong)}
          />
          <span className={cn('text-[18px] font-semibold', TEXT.muted)}>XAF</span>
        </label>
        {amount && !amountOk && <p className="mt-1.5 text-[15px] font-medium text-[#C00F0C] dark:text-[#FCB3AD]">Minimum {n0(MIN_DEPOSIT_XAF)} XAF</p>}

        <FieldLabel>Par</FieldLabel>
        <TileGrid cols={Math.min(selectableMethodFamilies.length, 4)}>
          {selectableMethodFamilies.map((f) => (
            <MethodTile key={f.family} logo={<DepositRound family={f.family} size={40} />} label={FAMILY_SHORT[f.family]} selected={family === f.family} onClick={() => chooseFamily(f.family)} />
          ))}
        </TileGrid>
        {family && needsSub && (
          <ChoiceChips className="mt-3" options={subs.map((s) => ({ value: s.subMethod, label: SUB_SHORT[s.subMethod] ?? s.label }))} value={sub} onChange={setSub} />
        )}
        {family === 'BANK' && (
          <div className="mt-3">
            <TileGrid cols={4}>
              {banks.map((b) => (
                <MethodTile key={b.bank} logo={<DepositBankLogo bank={b.bank} size={36} radius={18} />} label={b.label.replace(/ Cameroun$/i, '').replace(/-BANK/i, '')} selected={bank === b.bank} onClick={() => setBank(b.bank)} />
              ))}
            </TileGrid>
          </div>
        )}
        {family === 'AGENCY_BONZINI' && (
          <ChoiceChips className="mt-3" options={agencies.map((a) => ({ value: a.agency, label: a.label }))} value={agency} onChange={setAgency} />
        )}
        {mmOver && <p className="mt-2 text-[15px] font-medium text-[#975102] dark:text-[#E8B931]">Plus de {n0(MOBILE_MONEY_TRANSACTION_LIMIT)} XAF : au-delà de la limite d'une opération mobile money</p>}

        <FieldLabel>Preuve</FieldLabel>
        <PhotoDrop label="Photo du reçu" accept={ACCEPT_UPLOAD} multiple onFiles={addFiles} />
        {files.length > 0 && <FilePreviewGrid className="mt-3" files={files} onRemove={(i) => setFiles((p) => p.filter((_, k) => k !== i))} />}
        {(note || customDate) && (
          <p className={cn('mt-3 text-[15px]', TEXT.muted)}>{[customDate ? 'Antidaté' : null, note ? `Note : ${note}` : null].filter(Boolean).join(' · ')}</p>
        )}
      </div>

      <Dock>
        <BigButton disabled={!ready} onClick={() => (canCredit ? setConfirmOpen(true) : void submit(false))} loading={!canCredit && createDeposit.isPending}>
          {canCredit ? `Créditer ${amountNum > 0 ? `${n0(amountNum)} XAF` : ''}`.trim() : 'Enregistrer le dépôt'}
        </BigButton>
      </Dock>

      <ConfirmSheet
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={<>Créditer {n0(amountNum)} XAF ?</>}
        subtitle={<>à {nameOf(client)}, par {methodLabel}</>}
        rows={balance != null ? [{ label: 'Solde avant', value: `${n0(balance)} XAF` }, { label: 'Solde après', value: `${n0(balance + amountNum)} XAF` }] : undefined}
        confirmLabel="Créditer"
        onConfirm={() => void submit(true)}
        loading={createDeposit.isPending || validateDeposit.isPending}
      >
        <ToggleRow label={`Prévenir ${(client?.first_name ?? 'le client').trim()}`} on={notify} onChange={setNotify} />
      </ConfirmSheet>

      <MenuSheet
        open={more.open}
        onClose={more.hide}
        items={[
          { label: "Date de l'opération", icon: CalendarClock, hint: customDate ? 'antidatée' : undefined, onClick: () => setDateSheet(true) },
          { label: 'Note', icon: StickyNote, hint: note ? '1' : undefined, onClick: () => setNoteSheet(true) },
          { label: 'Coordonnées à donner', icon: ClipboardCopy, onClick: () => setCoordSheet(true), disabled: coords.length === 0 },
          { label: 'Enregistrer sans créditer', icon: Save, onClick: () => void submit(false), hidden: !canCredit, disabled: !ready },
        ]}
      />

      <BottomSheet open={dateSheet} onClose={() => setDateSheet(false)}>
        <h3 className={cn('mb-4 text-[22px] font-semibold', TEXT.strong)}>Date de l'opération</h3>
        <OperationDateCard enabled={!!customDate} value={customDate ?? ''} onToggle={(on, now) => setCustomDate(on ? (customDate || now) : null)} onChange={setCustomDate} accent="#2C2C2C" />
        <BigButton className="mt-5" onClick={() => setDateSheet(false)}>OK</BigButton>
      </BottomSheet>

      <BottomSheet open={noteSheet} onClose={() => setNoteSheet(false)}>
        <h3 className={cn('mb-4 text-[22px] font-semibold', TEXT.strong)}>Note</h3>
        <TextArea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note interne" />
        <BigButton className="mt-5" onClick={() => setNoteSheet(false)}>OK</BigButton>
      </BottomSheet>

      <BottomSheet open={coordSheet} onClose={() => setCoordSheet(false)}>
        <h3 className={cn('mb-1 text-[22px] font-semibold', TEXT.strong)}>Coordonnées</h3>
        <p className={cn('mb-4 text-[16px]', TEXT.muted)}>{methodLabel}{effectiveSub && SUB_SHORT[effectiveSub] ? ` · ${SUB_SHORT[effectiveSub]}` : ''}</p>
        <KVBox rows={coords} />
      </BottomSheet>
    </div>
  );
}

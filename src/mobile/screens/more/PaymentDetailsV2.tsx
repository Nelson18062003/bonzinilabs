/**
 * Coordonnées de paiement — refonte v2 (maquette 06/15). Banques ou Mobile
 * Money ; le titulaire ; une ligne par banque (vrai logo, RIB, copier). En bas :
 * « Partager en PDF » et « Partager en image ». « … » : la langue du document
 * (FR, EN, les deux) et la mise en page (portrait, paysage).
 * Toucher une banque ou un opérateur : tout le détail (IBAN, SWIFT, RIB, code
 * de Retrait…), chaque ligne copiable, et son RIB seul en PDF ou en image.
 * Même source et mêmes documents que PaymentDetailsHub (src/lib/paymentDocuments).
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, FileText, Image as ImageIcon, Languages, RectangleHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { ImageSheet, bankText, initialDocLang, DOC_LANG_KEY, useDocuments } from '@/components/payment-details/PaymentDetailsHub';
import { DepositBankLogo, DepositMethodLogo } from '@/mobile/components/deposits/DepositLogos';
import { bankGuideData, type BankGuideAccount } from '@/lib/bankDetailsGuide';
import { LEGAL_NAME } from '@/lib/companyIdentity';
import { mobileMoneyGuideData, type GuideOrientation, type MobileMoneyOperator } from '@/lib/mobileMoneyGuide';
import type { DocLang } from '@/lib/pdf/docLang';
import { cn } from '@/lib/utils';
import {
  ActionSheet, BigButton, BottomSheet, BoxSegmented, Dock, FOCUS_RING, MoreButton, ScreenTop, SURFACE, TEXT, useSheet,
} from '@/mobile/designKit';

type Tab = 'banks' | 'momo';
const MENTION = 'Mention obligatoire : votre nom + n° de commande.';

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      toast.success('Copié');
      window.setTimeout(() => setCopied((c) => (c === id ? null : c)), 2000);
    } catch {
      toast.error('Copie impossible');
    }
  };
  return { copied, copy };
}
type Copier = ReturnType<typeof useCopy>;

function CopyButton({ id, text, copier, label }: { id: string; text: string; copier: Copier; label: string }) {
  const done = copier.copied === id;
  return (
    <button type="button" onClick={() => void copier.copy(id, text)} aria-label={label} className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border active:bg-[#F5F5F5] dark:active:bg-[#383838]', SURFACE.divider, FOCUS_RING, TEXT.strong)}>
      {done ? <Check className="h-6 w-6 text-[#02542D]" /> : <Copy className="h-6 w-6" />}
    </button>
  );
}

const rib = (a: BankGuideAccount) => `${a.bankCode} ${a.branchCode} ${a.accountNumber} ${a.ribKey}`;

export function PaymentDetailsV2() {
  const { i18n } = useTranslation();
  const [tab, setTab] = useState<Tab>('banks');
  const [orientation, setOrientation] = useState<GuideOrientation>('portrait');
  const [lang, setLangState] = useState<DocLang>(() => initialDocLang(i18n.language ?? 'fr'));
  const setLang = (l: DocLang) => { setLangState(l); try { localStorage.setItem(DOC_LANG_KEY, l); } catch { /* navigation privée */ } };
  const docs = useDocuments(orientation, lang);
  const copier = useCopy();
  const accounts = useMemo(() => bankGuideData().accounts, []);
  const operators = useMemo(() => mobileMoneyGuideData().operators, []);
  const more = useSheet();
  const langSheet = useSheet();
  const layoutSheet = useSheet();
  const [bank, setBank] = useState<BankGuideAccount | null>(null);
  const [op, setOp] = useState<MobileMoneyOperator | null>(null);

  const doc = tab === 'banks' ? ({ kind: 'banks' } as const) : ({ kind: 'mobile-money' } as const);
  const langLabel = lang === 'fr' ? 'Français' : lang === 'en' ? 'English' : 'Les deux';

  return (
    <div className="flex min-h-full flex-col">
      <ScreenTop title="Coordonnées de paiement" right={<MoreButton onClick={more.show} />} />
      <div className="space-y-3 px-5 pt-5">
        <BoxSegmented<Tab> ariaLabel="Moyen" value={tab} onChange={setTab} options={[{ value: 'banks', label: 'Banques' }, { value: 'momo', label: 'Mobile Money' }]} />
        {tab === 'banks' && (
          <button type="button" onClick={() => void copier.copy('holder', LEGAL_NAME)} className={cn('flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-3.5 text-left active:bg-[#F5F5F5] dark:active:bg-[#383838]', SURFACE.divider, FOCUS_RING)}>
            <span className={cn('shrink-0 text-[16px]', TEXT.muted)}>Titulaire</span>
            <span className={cn('min-w-0 truncate text-[16px] font-bold', TEXT.strong)}>{LEGAL_NAME}</span>
          </button>
        )}
      </div>
      <div className="px-5 pb-28 pt-2">
        {tab === 'banks'
          ? accounts.map((a) => (
            <div key={a.key} className={cn('flex items-center gap-3.5 border-b py-4 last:border-b-0', SURFACE.divider)}>
              <button type="button" onClick={() => setBank(a)} className={cn('flex min-w-0 flex-1 items-center gap-3.5 text-left', FOCUS_RING)}>
                <DepositBankLogo bank={a.key} size={52} radius={26} />
                <span className="min-w-0">
                  <span className={cn('block truncate text-[18px] font-semibold', TEXT.strong)}>{a.name}</span>
                  <span className={cn('block truncate text-[16px] tabular-nums', TEXT.muted)}>{rib(a)}</span>
                </span>
              </button>
              <CopyButton id={`${a.key}:rib`} text={rib(a)} copier={copier} label={`Copier le RIB ${a.short}`} />
            </div>
          ))
          : operators.map((o) => (
            <div key={o.key} className={cn('flex items-center gap-3.5 border-b py-4 last:border-b-0', SURFACE.divider)}>
              <button type="button" onClick={() => setOp(o)} className={cn('flex min-w-0 flex-1 items-center gap-3.5 text-left', FOCUS_RING)}>
                <DepositMethodLogo method={o.key === 'mtn' ? 'mtn_transfer' : 'om_transfer'} size={52} radius={26} />
                <span className="min-w-0">
                  <span className={cn('block truncate text-[18px] font-semibold', TEXT.strong)}>{o.name}</span>
                  <span className={cn('block truncate text-[16px] tabular-nums', TEXT.muted)}>{o.number} · {o.holder}</span>
                </span>
              </button>
              <CopyButton id={`${o.key}:number`} text={o.numberIntl} copier={copier} label={`Copier le numéro ${o.name}`} />
            </div>
          ))}
      </div>
      <Dock>
        <BigButton onClick={() => docs.run(doc, 'pdf')} loading={docs.isBusy(doc, 'pdf')} disabled={docs.busy !== null && !docs.isBusy(doc, 'pdf')}>Partager en PDF</BigButton>
        <BigButton variant="soft" onClick={() => docs.run(doc, 'png')} loading={docs.isBusy(doc, 'png')} disabled={docs.busy !== null && !docs.isBusy(doc, 'png')}>Partager en image</BigButton>
      </Dock>

      <ActionSheet
        open={more.open}
        onClose={more.hide}
        actions={[
          { label: 'Langue du document', hint: langLabel, icon: Languages, onClick: langSheet.show },
          { label: 'Mise en page', hint: orientation === 'portrait' ? 'Portrait' : 'Paysage', icon: RectangleHorizontal, onClick: layoutSheet.show },
        ]}
      />
      <ActionSheet open={langSheet.open} onClose={langSheet.hide} title="Langue du document" actions={[
        { label: 'Français', onClick: () => setLang('fr') },
        { label: 'English', onClick: () => setLang('en') },
        { label: 'Les deux', onClick: () => setLang('bi') },
      ]} />
      <ActionSheet open={layoutSheet.open} onClose={layoutSheet.hide} title="Mise en page" actions={[
        { label: 'Portrait', onClick: () => setOrientation('portrait') },
        { label: 'Paysage', onClick: () => setOrientation('landscape') },
      ]} />

      <BottomSheet open={bank != null} onClose={() => setBank(null)} title={bank?.name}>
        {bank && (
          <div>
            <DetailRow id={`${bank.key}:iban`} label="IBAN" value={bank.iban} copier={copier} />
            <DetailRow id={`${bank.key}:swift`} label="SWIFT / BIC" value={bank.swift} copier={copier} />
            <DetailRow id={`${bank.key}:rib2`} label="RIB" value={rib(bank)} copier={copier} />
            <DetailRow id={`${bank.key}:all`} label="Tout copier" value={bank.holder} copyText={bankText(bank, MENTION)} copier={copier} />
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <BigButton variant="soft" onClick={() => docs.run({ kind: 'rib', bank: bank.key }, 'pdf')} loading={docs.isBusy({ kind: 'rib', bank: bank.key }, 'pdf')}><FileText className="h-5 w-5" /> RIB · PDF</BigButton>
              <BigButton variant="soft" onClick={() => docs.run({ kind: 'rib', bank: bank.key }, 'png')} loading={docs.isBusy({ kind: 'rib', bank: bank.key }, 'png')}><ImageIcon className="h-5 w-5" /> RIB · Image</BigButton>
            </div>
          </div>
        )}
      </BottomSheet>
      <BottomSheet open={op != null} onClose={() => setOp(null)} title={op?.name}>
        {op && (
          <div>
            <DetailRow id={`${op.key}:n`} label="Flotte · numéro" value={op.number} copyText={op.numberIntl} copier={copier} />
            <DetailRow id={`${op.key}:h`} label="Titulaire" value={op.holder} copier={copier} />
            <DetailRow id={`${op.key}:c`} label="Retrait · code" value={op.merchantCode} copier={copier} />
            <p className="pt-3 text-[16px] font-semibold text-[#975102] dark:text-[#E8B931]">Nom différent ? Ne validez pas.</p>
          </div>
        )}
      </BottomSheet>
      <ImageSheet docs={docs} />
    </div>
  );
}

function DetailRow({ id, label, value, copyText, copier }: { id: string; label: string; value: string; copyText?: string; copier: Copier }) {
  return (
    <div className={cn('flex items-center gap-3 border-b py-3.5 last:border-b-0', SURFACE.divider)}>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-[15px]', TEXT.muted)}>{label}</span>
        <span className={cn('block break-words text-[17px] font-semibold tabular-nums', TEXT.strong)}>{value}</span>
      </span>
      <CopyButton id={id} text={copyText ?? value} copier={copier} label={`Copier ${label}`} />
    </div>
  );
}

// ============================================================
// COORDONNÉES DE PAIEMENT — la page unique où l'on trouve, côté client comme
// côté équipe, tout ce qu'il faut pour nous payer :
//   · BANQUES : le titulaire, et pour chaque banque l'IBAN, le SWIFT et les
//     4 cases du RIB, chacun copiable d'un toucher (ou « Tout copier ») ;
//   · MOBILE MONEY : Orange Money et MTN MoMo — la Flotte (numéro +
//     titulaire) et le Retrait (code à composer).
// Et en tête de chaque onglet, les documents à envoyer : PDF ou images
// (une par page, pour WhatsApp), en portrait ou en paysage. Les images
// s'ouvrent d'abord en aperçu : on envoie tout, ou une seule page.
// Les données viennent de la source unique de l'app
// (src/data/depositMethodsData.ts, via les modules des fiches) : l'écran,
// les PDF et les images disent toujours la même chose.
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, Download, FileText, Image as ImageIcon, Loader2, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, Button, BottomSheet, Segmented } from '@/mobile/designKit';
import { bankGuideData, type BankGuideAccount } from '@/lib/bankDetailsGuide';
import { mobileMoneyGuideData, type GuideOrientation, type MobileMoneyOperator } from '@/lib/mobileMoneyGuide';
import { paymentDocId, paymentDocImages, paymentDocPdf, paymentDocTitle, type PaymentDoc, type PaymentDocFormat } from '@/lib/paymentDocuments';
import { deliverFile, deliverFiles, downloadFile, downloadFiles } from '@/components/customer-code/exportShippingLabel';
import { LEGAL_NAME } from '@/lib/companyIdentity';
import { MTN_LOGO_PATH, MTN_YELLOW } from '@/lib/brand/mtnLogo';
import ecobankLogo from '@/assets/bank-logos/ecobank.png';
import ccaLogo from '@/assets/bank-logos/cca.png';
import ubaLogo from '@/assets/bank-logos/uba.png';
import afrilandLogo from '@/assets/bank-logos/afriland.png';
import orangeMoneyLogo from '@/assets/deposit-logos/orange-money.png';

type Tab = 'banks' | 'momo';

/** Le livret Mobile Money : couverture, Flotte, Retrait, Preuve. */
const MOMO_PAGES = 4;

const BANK_LOGO: Record<string, { src: string; plate: string; cover?: boolean }> = {
  ECOBANK: { src: ecobankLogo, plate: '#ffffff' },
  CCA: { src: ccaLogo, plate: '#663088', cover: true },
  UBA: { src: ubaLogo, plate: '#ffffff' },
  AFRILAND: { src: afrilandLogo, plate: '#ffffff' },
};

/* ─────────────── Logos officiels ─────────────── */

function BankLogo({ bank, className }: { bank: string; className?: string }) {
  const logo = BANK_LOGO[bank];
  if (!logo) return null;
  return (
    <div className={cn('flex h-12 w-[84px] shrink-0 items-center justify-center overflow-hidden rounded-lg ring-1 ring-black/[0.08]', className)} style={{ background: logo.plate }}>
      <img src={logo.src} alt="" className={logo.cover ? 'h-full w-full object-cover' : 'h-9 w-[70px] object-contain'} />
    </div>
  );
}

function OperatorLogo({ op }: { op: MobileMoneyOperator }) {
  if (op.key === 'mtn') {
    return (
      <div className="flex h-12 w-[84px] shrink-0 items-center justify-center rounded-lg" style={{ background: MTN_YELLOW }}>
        <svg viewBox="0 0 1280 640" className="h-8 w-16" aria-hidden><path d={MTN_LOGO_PATH} fill="#000" /></svg>
      </div>
    );
  }
  return (
    <div className="flex h-12 w-[84px] shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-black/[0.08]">
      <img src={orangeMoneyLogo} alt="" className="h-[18px] w-[68px] object-contain" />
    </div>
  );
}

/* ─────────────── Copie ─────────────── */

function useCopy() {
  const { t } = useTranslation('deposits');
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      toast.success(t('instructions.copySuccess'));
      window.setTimeout(() => setCopied((c) => (c === id ? null : c)), 2000);
    } catch {
      toast.error(t('instructions.copyError'));
    }
  };
  return { copied, copy };
}
type CopyApi = ReturnType<typeof useCopy>;

/** Une ligne « libellé → valeur » : un toucher copie la valeur. */
function CopyRow({ id, label, value, display, code, big, copier, last }: { id: string; label: string; value: string; display?: string; code?: boolean; big?: boolean; copier: CopyApi; last?: boolean }) {
  const done = copier.copied === id;
  return (
    <button
      type="button"
      onClick={() => void copier.copy(id, value)}
      className={cn('flex w-full items-center justify-between gap-3 py-3 text-left transition active:opacity-60', !last && 'border-b', SURFACE.divider)}
    >
      <div className="min-w-0">
        <div className={cn(TYPE.small, TEXT.muted)}>{label}</div>
        <div className={cn('mt-0.5 break-words font-semibold', big ? 'text-[20px] leading-snug' : 'text-[16px]', code && 'tabular-nums tracking-wide', TEXT.strong)}>{display ?? value}</div>
      </div>
      {done ? <Check className="h-5 w-5 shrink-0 text-[#2E7D52] dark:text-[#7FCBA0]" /> : <Copy className={cn('h-5 w-5 shrink-0', TEXT.muted)} />}
    </button>
  );
}

/**
 * Un code USSD ne se coupe qu'après un « * » : « *126*14*652403602* » puis
 * « MONTANT# », jamais « MONTA » / « NT# ». Espace sans chasse à l'affichage
 * seulement — la copie garde le code exact.
 */
function breakAfterStars(code: string): string {
  return code.replace(/\*/g, '*\u200B');
}

/* ─────────────── Documents : PDF ou images ─────────────── */

/**
 * Sur un ordinateur (souris, pas d'écran tactile), on TÉLÉCHARGE : la
 * feuille de partage de Windows ou de macOS n'a pas d'« Enregistrer ». Sur
 * téléphone, feuille de partage (WhatsApp, e-mail, Fichiers…).
 */
function prefersDownload(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(pointer: fine)').matches && !window.matchMedia('(any-pointer: coarse)').matches;
}

/** « rib-UBA:png » : ce qu'on fabrique, sans la mise en page (le bouton garde son sablier si on la change). */
function busyKey(doc: PaymentDoc, format: PaymentDocFormat): string {
  return paymentDocId(doc, format, 'portrait').replace(/:portrait$/, '');
}

interface Preview { doc: PaymentDoc; orientation: GuideOrientation; title: string; files: File[]; urls: string[] }

function useDocuments(orientation: GuideOrientation) {
  const { t } = useTranslation('deposits');
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  // Page quittée pendant la fabrication : on ne crée ni aperçu ni message.
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  // Les aperçus sont des URL « blob: » : on les rend au navigateur à la fermeture.
  useEffect(() => () => preview?.urls.forEach((u) => URL.revokeObjectURL(u)), [preview]);

  const run = (doc: PaymentDoc, format: PaymentDocFormat) => {
    if (busy) return;
    // La mise en page choisie AU MOMENT du toucher : la changer ensuite ne mélange rien.
    const layout = orientation;
    setBusy(busyKey(doc, format));
    const done = format === 'pdf'
      ? paymentDocPdf(doc, layout).then(async (file) => {
        if (prefersDownload()) { downloadFile(file); return 'downloaded' as const; }
        return deliverFile(file, paymentDocTitle(doc));
      }).then((o) => {
        if (o === 'downloaded' && mounted.current) toast.success(t('paymentDetails.downloaded', { defaultValue: 'Document téléchargé' }));
      })
      : paymentDocImages(doc, layout).then((files) => {
        if (!mounted.current) return;
        setPreview({ doc, orientation: layout, title: paymentDocTitle(doc), files, urls: files.map((f) => URL.createObjectURL(f)) });
      });
    void done
      .catch(() => {
        if (!mounted.current) return;
        toast.error(format === 'pdf'
          ? t('instructions.pdfError', { defaultValue: 'Impossible de créer le PDF, réessayez' })
          : t('paymentDetails.imagesError', { defaultValue: 'Impossible de créer les images, réessayez' }));
      })
      .finally(() => { if (mounted.current) setBusy(null); });
  };

  const isBusy = (doc: PaymentDoc, format: PaymentDocFormat) => busy === busyKey(doc, format);
  return { busy, run, isBusy, preview, closePreview: () => setPreview(null) };
}
type DocsApi = ReturnType<typeof useDocuments>;

/** Les deux boutons d'un document : PDF · Images. */
function DocButtons({ doc, docs, pdfLabel, imagesLabel }: { doc: PaymentDoc; docs: DocsApi; pdfLabel?: string; imagesLabel?: string }) {
  const { t } = useTranslation('deposits');
  const icon = (format: PaymentDocFormat) => {
    if (docs.isBusy(doc, format)) return <Loader2 className="h-5 w-5 animate-spin" />;
    return format === 'pdf' ? <FileText className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />;
  };
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button variant="primary" disabled={docs.busy !== null} onClick={() => docs.run(doc, 'pdf')} className="w-full">
        {icon('pdf')} {pdfLabel ?? t('paymentDetails.pdf', { defaultValue: 'PDF' })}
      </Button>
      <Button variant="neutral" disabled={docs.busy !== null} onClick={() => docs.run(doc, 'png')} className="w-full">
        {icon('png')} {imagesLabel ?? t('paymentDetails.images', { defaultValue: 'Images' })}
      </Button>
    </div>
  );
}

/** Les images prêtes : on les envoie toutes (le bouton en tête), ou on en garde une seule. */
function ImagesSheet({ docs }: { docs: DocsApi }) {
  const { t } = useTranslation('deposits');
  const [sending, setSending] = useState(false);
  const p = docs.preview;
  const count = p?.files.length ?? 0;
  const download = prefersDownload();
  const sendAll = () => {
    if (!p || sending) return;
    setSending(true);
    const go = download ? downloadFiles(p.files).then(() => 'downloaded' as const) : deliverFiles(p.files, p.title);
    void go
      .then((o) => { if (o === 'downloaded') toast.success(t('paymentDetails.downloaded', { defaultValue: 'Document téléchargé' })); })
      .finally(() => setSending(false));
  };
  const allLabel = download
    ? (count > 1 ? t('paymentDetails.downloadAll', { count, defaultValue: 'Télécharger les {{count}} images' }) : t('paymentDetails.downloadOne', { defaultValue: 'Télécharger l’image' }))
    : (count > 1 ? t('paymentDetails.sendAll', { count, defaultValue: 'Envoyer les {{count}} images' }) : t('paymentDetails.sendOne', { defaultValue: 'Envoyer l’image' }));
  return (
    <BottomSheet
      open={p !== null}
      onClose={docs.closePreview}
      title={t('paymentDetails.imagesReady', { count, defaultValue: count > 1 ? '{{count}} images prêtes' : 'Image prête' })}
      className="mx-auto w-full max-w-3xl"
    >
      {p ? (
        <div className="space-y-4">
          <Button variant="primary" onClick={sendAll} loading={sending} className="w-full">
            {download ? <Download className="h-5 w-5" /> : <Share2 className="h-5 w-5" />}
            {allLabel}
          </Button>
          {count > 1 ? <p className={cn(TYPE.small, TEXT.muted)}>{t('paymentDetails.imagesHint', { defaultValue: 'Ou touchez une page pour l’enregistrer seule.' })}</p> : null}
          <div className={cn('grid gap-3', count === 1 ? 'grid-cols-1' : p.orientation === 'landscape' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2 sm:grid-cols-3')}>
            {p.files.map((file, i) => (
              <button
                key={file.name}
                type="button"
                onClick={() => downloadFile(file)}
                className={cn('group overflow-hidden rounded-lg text-left', SURFACE.shadow)}
                aria-label={t('paymentDetails.saveOne', { page: i + 1, defaultValue: 'Enregistrer la page {{page}}' })}
              >
                <img src={p.urls[i]} alt="" className={cn('w-full bg-white object-contain', p.orientation === 'landscape' ? 'aspect-[297/210]' : 'aspect-[210/297]', count === 1 && 'max-h-[55vh]')} />
                <div className={cn('flex items-center justify-between gap-2 px-3 py-2', TYPE.smallStrong, TEXT.body)}>
                  <span>{t('paymentDetails.page', { page: i + 1, defaultValue: 'Page {{page}}' })}</span>
                  <Download className="h-4 w-4 shrink-0" />
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </BottomSheet>
  );
}

/* ─────────────── Banques ─────────────── */

/** La coordonnée d'une banque en texte, prête à coller dans un message — référence comprise. */
function bankText(a: BankGuideAccount, mention: string): string {
  return [
    a.holder,
    a.name,
    `IBAN : ${a.iban}`,
    `SWIFT : ${a.swift}`,
    `RIB : ${a.bankCode} ${a.branchCode} ${a.accountNumber} ${a.ribKey}`,
    mention,
  ].join('\n');
}

/** Le bouton « Copier les coordonnées » d'une carte. */
function CopyAllButton({ id, text, copier }: { id: string; text: string; copier: CopyApi }) {
  const { t } = useTranslation('deposits');
  return (
    <button
      type="button"
      onClick={() => void copier.copy(id, text)}
      className={cn('flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-3', TYPE.bodyStrong, SURFACE.inset, TEXT.body)}
    >
      {copier.copied === id ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
      {t('paymentDetails.copyAll', { defaultValue: 'Copier les coordonnées' })}
    </button>
  );
}

function BankCard({ a, copier, docs, mention }: { a: BankGuideAccount; copier: CopyApi; docs: DocsApi; mention: string }) {
  const { t } = useTranslation('deposits');
  const k = (field: string) => `${a.key}:${field}`;
  return (
    <section className={cn('rounded-2xl p-4', SURFACE.card, SURFACE.shadow)}>
      <div className="flex items-center gap-3">
        <BankLogo bank={a.key} />
        <div className="min-w-0 flex-1">
          <h3 className={cn(TYPE.lead, TEXT.strong)}>{a.name}</h3>
          <p className={cn(TYPE.small, TEXT.muted)}>{t('paymentDetails.zone', { defaultValue: 'Cameroun · Zone CEMAC' })}</p>
        </div>
      </div>
      <div className="mt-2">
        <CopyRow id={k('iban')} label={t('paymentDetails.iban', { defaultValue: 'IBAN · pour un virement' })} value={a.iban} code big copier={copier} />
        <CopyRow id={k('swift')} label={t('paymentDetails.swift', { defaultValue: 'SWIFT / BIC · depuis l’étranger' })} value={a.swift} code copier={copier} />
        <CopyRow
          id={k('rib')}
          label={t('paymentDetails.rib', { defaultValue: 'RIB · pour un dépôt au guichet' })}
          value={`${a.bankCode} ${a.branchCode} ${a.accountNumber} ${a.ribKey}`}
          code
          copier={copier}
          last
        />
        <div className={cn('mb-3 grid grid-cols-[1fr_1fr_1.9fr_0.7fr] gap-1 rounded-lg px-1 py-2 text-center', SURFACE.inset)}>
          {[
            [t('paymentDetails.bankCode', { defaultValue: 'Banque' }), a.bankCode],
            [t('paymentDetails.branchCode', { defaultValue: 'Agence' }), a.branchCode],
            [t('paymentDetails.accountNumber', { defaultValue: 'Compte' }), a.accountNumber],
            [t('paymentDetails.ribKey', { defaultValue: 'Clé' }), a.ribKey],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0">
              <div className={cn('text-[14px] font-semibold', TEXT.muted)}>{label}</div>
              <div className={cn('text-[16px] font-semibold tabular-nums', TEXT.strong)}>{value}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="mb-2"><CopyAllButton id={k('all')} text={bankText(a, mention)} copier={copier} /></div>
      <DocButtons
        doc={{ kind: 'rib', bank: a.key }}
        docs={docs}
        pdfLabel={t('paymentDetails.ribPdf', { defaultValue: 'RIB · PDF' })}
        imagesLabel={t('paymentDetails.ribImage', { defaultValue: 'RIB · Image' })}
      />
    </section>
  );
}

/* ─────────────── Mobile Money ─────────────── */

function OperatorCard({ op, copier }: { op: MobileMoneyOperator; copier: CopyApi }) {
  const { t } = useTranslation('deposits');
  const k = (field: string) => `${op.key}:${field}`;
  const from = op.key === 'mtn'
    ? t('paymentDetails.flotteFromMtn', { defaultValue: 'Depuis votre puce commerciale MTN (compte Float).' })
    : t('paymentDetails.flotteFromOm', { defaultValue: 'Depuis votre puce commerciale Orange (compte UV).' });
  const text = [
    op.name,
    `${t('paymentDetails.flotteShort', { defaultValue: 'Flotte' })} : ${op.number} — ${op.holder}`,
    `${t('paymentDetails.retraitShort', { defaultValue: 'Retrait' })} : ${op.merchantCode}`,
  ].join('\n');
  return (
    <section className={cn('rounded-2xl p-4', SURFACE.card, SURFACE.shadow)}>
      <div className="flex items-center gap-3">
        <OperatorLogo op={op} />
        <h3 className={cn('min-w-0 flex-1', TYPE.lead, TEXT.strong)}>{op.name}</h3>
      </div>
      <h4 className={cn('mt-4', TYPE.bodyStrong, TEXT.strong)}>{t('paymentDetails.flotte', { defaultValue: '1 · Flotte — transfert vers notre numéro' })}</h4>
      <p className={cn(TYPE.small, TEXT.muted)}>{from}</p>
      <CopyRow id={k('number')} label={t('paymentDetails.number', { defaultValue: 'Numéro' })} value={op.number} code big copier={copier} />
      <CopyRow id={k('holder')} label={t('paymentDetails.holder', { defaultValue: 'Titulaire (nom affiché avant de valider)' })} value={op.holder} copier={copier} last />
      <p className="mt-1 text-[16px] font-semibold text-[#975102] dark:text-[#E8B931]">{t('paymentDetails.nameCheck', { defaultValue: 'Nom différent ? Ne validez pas.' })}</p>
      <h4 className={cn('mt-5', TYPE.bodyStrong, TEXT.strong)}>{t('paymentDetails.retrait', { defaultValue: '2 · Retrait — notre code, avec le montant' })}</h4>
      <p className={cn(TYPE.small, TEXT.muted)}>{t('paymentDetails.retraitFrom', { defaultValue: 'Depuis votre compte Mobile Money.' })}</p>
      <CopyRow id={k('code')} label={t('paymentDetails.code', { defaultValue: 'Code à composer' })} value={op.merchantCode} display={breakAfterStars(op.merchantCode)} code big copier={copier} last />
      <p className={cn('mt-1 mb-3', TYPE.small, TEXT.muted)}>{t('paymentDetails.amountHint', { defaultValue: 'Remplacez MONTANT par la somme, en chiffres, sans espace.' })}</p>
      <CopyAllButton id={k('all')} text={text} copier={copier} />
    </section>
  );
}

/* ─────────────── La page ─────────────── */

/**
 * `clientCode` (page client) : l'identifiant du client (BZ-…), à écrire dans
 * le motif de ses virements — la règle de l'app (Mon identifiant client).
 * Côté équipe, la mention générale de la fiche envoyée aux clients.
 */
export function PaymentDetailsHub({ audience, initialTab = 'banks', clientCode }: { audience: 'client' | 'admin'; initialTab?: Tab; clientCode?: string | null }) {
  const { t } = useTranslation('deposits');
  const [tab, setTab] = useState<Tab>(initialTab);
  const [orientation, setOrientation] = useState<GuideOrientation>('portrait');
  const copier = useCopy();
  const docs = useDocuments(orientation);
  const accounts = useMemo(() => bankGuideData().accounts, []);
  const operators = useMemo(() => mobileMoneyGuideData().operators, []);
  const mention = audience === 'client'
    ? (clientCode
      ? t('paymentDetails.mentionClient', { code: clientCode, defaultValue: 'Dans le motif du virement, écrivez votre identifiant client : {{code}}.' })
      : t('paymentDetails.mentionClientNoCode', { defaultValue: 'Dans le motif du virement, écrivez votre identifiant client (BZ-…).' }))
    : t('paymentDetails.mention', { defaultValue: 'Mention obligatoire : votre nom + n° de commande.' });

  return (
    <div className="space-y-5">
      <p className={cn(TYPE.body, TEXT.muted)}>
        {audience === 'admin'
          ? t('paymentDetails.introAdmin', { defaultValue: 'Tout ce qu’un client doit avoir pour nous payer : à copier, ou à envoyer en PDF ou en images.' })
          : t('paymentDetails.introClient', { defaultValue: 'Pour recharger votre compte : par la banque ou par Mobile Money.' })}
      </p>

      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'banks', label: t('paymentDetails.tabBanks', { defaultValue: 'Banques' }) },
          { value: 'momo', label: t('paymentDetails.tabMomo', { defaultValue: 'Mobile Money' }) },
        ]}
      />

      {/* Les documents à envoyer, en tête : c'est ce qu'on vient chercher le plus souvent. */}
      <section className={cn('space-y-3 rounded-2xl p-4', SURFACE.card, SURFACE.shadow)}>
        <h2 className={cn(TYPE.bodyStrong, TEXT.strong)}>{t('paymentDetails.sendTitle', { defaultValue: 'Télécharger ou partager' })}</h2>
        <div>
          <div className={cn('mb-1.5', TYPE.small, TEXT.muted)}>{t('paymentDetails.layout', { defaultValue: 'Mise en page' })}</div>
          <Segmented<GuideOrientation>
            value={orientation}
            onChange={setOrientation}
            options={[
              { value: 'portrait', label: t('paymentDetails.portrait', { defaultValue: 'Portrait' }) },
              { value: 'landscape', label: t('paymentDetails.landscape', { defaultValue: 'Paysage' }) },
            ]}
          />
        </div>
        {tab === 'banks' ? (
          <div className="space-y-2">
            <div>
              <div className={cn(TYPE.bodyStrong, TEXT.strong)}>{t('paymentDetails.allBanks', { defaultValue: 'Toutes nos banques' })}</div>
              <div className={cn(TYPE.small, TEXT.muted)}>{t('paymentDetails.pages', { count: accounts.length + 2, defaultValue: '{{count}} pages, en français et en anglais' })}</div>
            </div>
            <DocButtons doc={{ kind: 'banks' }} docs={docs} />
            <p className={cn(TYPE.small, TEXT.muted)}>{t('paymentDetails.ribHint', { defaultValue: 'Le RIB d’une seule banque se trouve sous sa carte, plus bas.' })}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div>
              <div className={cn(TYPE.bodyStrong, TEXT.strong)}>{t('paymentDetails.momoSheet', { defaultValue: 'Fiche Mobile Money' })}</div>
              <div className={cn(TYPE.small, TEXT.muted)}>{t('paymentDetails.pages', { count: MOMO_PAGES, defaultValue: '{{count}} pages, en français et en anglais' })}</div>
            </div>
            <DocButtons doc={{ kind: 'mobile-money' }} docs={docs} />
          </div>
        )}
      </section>

      {tab === 'banks' ? (
        <div className="space-y-4">
          <section className={cn('rounded-2xl p-4', SURFACE.inset)}>
            <div className={cn(TYPE.small, TEXT.muted)}>{t('paymentDetails.soleHolder', { defaultValue: 'Titulaire de tous nos comptes' })}</div>
            <button type="button" onClick={() => void copier.copy('holder', LEGAL_NAME)} className="mt-0.5 flex w-full items-center justify-between gap-3 text-left">
              <span className={cn('text-[20px] font-semibold leading-snug', TEXT.strong)}>{LEGAL_NAME}</span>
              {copier.copied === 'holder' ? <Check className="h-5 w-5 shrink-0 text-[#2E7D52] dark:text-[#7FCBA0]" /> : <Copy className={cn('h-5 w-5 shrink-0', TEXT.muted)} />}
            </button>
            {/* La référence du virement : c'est elle qui permet de créditer le bon compte. */}
            <p className="mt-3 rounded-lg bg-[#FDF1DD] px-3 py-2.5 text-[16px] font-semibold leading-snug text-[#7A4F0E] dark:bg-[#3A2F1A] dark:text-[#E0B978]">{mention}</p>
          </section>
          {accounts.map((a) => <BankCard key={a.key} a={a} copier={copier} docs={docs} mention={mention} />)}
        </div>
      ) : (
        <div className="space-y-4">
          <p className={cn(TYPE.body, TEXT.body)}>{t('paymentDetails.chooseOne', { defaultValue: 'Deux façons de payer par Mobile Money : choisissez-en une seule.' })}</p>
          {operators.map((op) => <OperatorCard key={op.key} op={op} copier={copier} />)}
        </div>
      )}

      <ImagesSheet docs={docs} />
    </div>
  );
}

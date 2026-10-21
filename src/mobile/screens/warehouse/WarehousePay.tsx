// ============================================================
// ENTREPÔT — Encaisser à Douala. Un devis à solder à la fois : le reste à
// payer en grand, le montant reçu (le reste, par défaut), comment (les
// tuiles), une référence si ce n'est pas des espèces, une photo de la
// preuve si on veut. « Encaisser » demande confirmation, puis le reçu est
// aussitôt TÉLÉCHARGÉ (sur le téléphone comme sur le portable — jamais une
// feuille de partage à la place), « Partager » (WhatsApp) restant à un
// toucher sur téléphone ; et, quand tout est soldé, on revient aux colis
// pour la remise. Le lieu est toujours Douala, la date toujours maintenant.
// Refonte v2 (maquette 04/09) : tuiles de mode, solde avant / débité /
// après quand on prend sur le solde, un seul bouton noir.
// ============================================================
import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Banknote, Building2, Camera, MoreHorizontal, PlusCircle, Smartphone, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useClientAtWarehouse } from '@/hooks/useWarehouse';
import { useAddQuotePayment, useCargoQuote, usePayQuoteFromWallet, uploadPaymentProof } from '@/hooks/useCargoQuote';
import { useAdminWalletByUserId } from '@/hooks/useAdminDeposits';
import { useAdminShippingSettings } from '@/hooks/useShippingSettings';
import { DEFAULT_SHIPPING_SETTINGS, type ShippingSettings } from '@/lib/customerCode';
import { METHOD_LABEL, xaf, type PaymentMethod, type Quote, type QuotePayment } from '@/lib/cargoQuote';
import { buildReceiptPdf, readCargoDocLang } from '@/lib/cargoQuotePdf';
import { canShareFiles, deliverFile, downloadFile, prefersDownload } from '@/components/customer-code/exportShippingLabel';
import { isValidXafAmount, MIN_PAYMENT_XAF } from '@/lib/amountLimits';
import { releaseBlockers, type ClientQuoteSummary } from '@/lib/warehouse';
import { clientFullName } from '@/lib/reception';
import { cn } from '@/lib/utils';
import {
  BigButton, BigFigure, ConfirmSheet, Dock, EmptyLine, IconCircle, ItemList, ItemRow, KVBox, ScreenLoader, ScreenTop, SuccessView, SURFACE, TEXT, TextInput, type KV,
} from '@/mobile/designKit';
import { CapsLabel, UnitField } from '@/mobile/components/cargo/v2';
import { WhClientCard } from '@/mobile/components/warehouse/ClientCard';
import { readReleaseDraft } from './releaseDraft';

const METHODS: PaymentMethod[] = ['cash', 'mobile_money', 'bank_transfer', 'wallet', 'other'];
const METHOD_ICON: Record<PaymentMethod, React.ElementType> = { cash: Banknote, mobile_money: Smartphone, bank_transfer: Building2, wallet: Wallet, other: MoreHorizontal };
const TILE_LABEL: Record<PaymentMethod, string> = { cash: 'Espèces', mobile_money: 'Mobile', bank_transfer: 'Virement', wallet: 'Solde', other: 'Autre' };
const num = (s: string) => { const v = parseFloat(s.replace(/\s/g, '').replace(',', '.')); return Number.isFinite(v) ? v : null; };

/**
 * Le reçu d'un encaissement : TÉLÉCHARGÉ d'office, dans la langue retenue sur
 * l'appareil. Sur téléphone, « Partager » (WhatsApp) dans la notification : le
 * fichier est déjà prêt, la feuille s'ouvre dans le toucher.
 */
async function handReceipt(q: Quote, p: QuotePayment, settings: ShippingSettings): Promise<void> {
  try {
    const file = await buildReceiptPdf(q, p, settings, readCargoDocLang());
    downloadFile(file);
    const share = canShareFiles() && !prefersDownload();
    toast.success(`Reçu ${p.receipt_no} téléchargé`, share ? {
      duration: 10_000,
      action: { label: 'Partager', onClick: () => void deliverFile(file, `${p.receipt_no} · ${xaf(p.amount_xaf)}`) },
    } : undefined);
  } catch (e) {
    // L'argent est encaissé : seul le fichier manque, on le retrouve dans « Paiements et reçus ».
    toast.error(`Encaissé, mais le reçu ${p.receipt_no} n'a pas pu être préparé : ${(e as Error).message}`);
  }
}

/** Ce qui vient d'être encaissé : pour l'écran de succès et le reçu à refaire. */
interface Paid { quote: Quote; payment: QuotePayment | null; amount: number; method: PaymentMethod; left: number }

/** Le formulaire d'un devis : ce qu'il reste, ce qu'on reçoit, comment. */
function PayForm({ summary, onPaid }: { summary: ClientQuoteSummary; onPaid: (p: Paid) => void }) {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const { data: q, isLoading } = useCargoQuote(summary.deposit_id);
  const { data: settings } = useAdminShippingSettings();
  const add = useAddQuotePayment();
  const payWallet = usePayQuoteFromWallet();
  const { data: wallet, isLoading: walletLoading } = useAdminWalletByUserId(q?.client?.user_id ?? undefined);
  const fileRef = useRef<HTMLInputElement>(null);
  const [amount, setAmount] = useState(String(summary.balance_xaf));
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [reference, setReference] = useState('');
  const [proof, setProof] = useState<File | null>(null);
  const [asking, setAsking] = useState(false);
  const [saving, setSaving] = useState(false);
  if (isLoading || !q) return <ScreenLoader />;
  const balance = Math.max(0, Math.round(Number(q.total_xaf) - Number(q.amount_paid_xaf)));
  const raw = num(amount);
  const v = raw == null ? 0 : Math.round(raw);
  const walletXaf = Math.round(Number(wallet?.balance_xaf ?? 0));
  const noClient = method === 'wallet' && !q.client?.user_id;
  const short = method === 'wallet' && !walletLoading && v > walletXaf;
  const ok = isValidXafAmount(v, MIN_PAYMENT_XAF) && Number.isSafeInteger(v) && v <= balance && !noClient && !short;
  const left = balance - v;
  const over = raw != null && v > balance;

  const submit = async () => {
    if (!ok) return;
    setSaving(true);
    try {
      const { quote: fresh, payment } = method === 'wallet'
        ? await payWallet.mutateAsync({ quoteId: q.id, amount: v })
        : await (async () => {
          const proofPath = proof ? await uploadPaymentProof(q.id, proof) : null;
          return add.mutateAsync({ quoteId: q.id, amount: v, method, place: 'douala', reference: reference.trim() || undefined, proofPath });
        })();
      setAsking(false);
      // Le reçu ne peut plus bloquer la suite : l'encaissement est fait.
      if (payment) await handReceipt(fresh, payment, settings ?? DEFAULT_SHIPPING_SETTINGS);
      onPaid({ quote: fresh, payment: payment ?? null, amount: v, method, left });
    } catch (e) { toast.error((e as Error).message); } finally { setSaving(false); }
  };

  const walletRows: KV[] = [
    { label: 'Solde avant', value: walletLoading ? '…' : xaf(walletXaf) },
    { label: 'Débité', value: xaf(v) },
    { label: 'Solde après', value: walletLoading ? '…' : xaf(walletXaf - v), tone: short ? 'danger' : undefined },
  ];

  return (
    <>
      <div className="px-5 pt-5">
        <BigFigure label={`Reste à payer · ${summary.deposit_no}`} value={xaf(balance).replace(/\s?XAF$/, '')} unit="XAF" size="md"
          note={`Devis ${xaf(q.total_xaf)} · déjà ${xaf(q.amount_paid_xaf)}`} />

        <CapsLabel as="label" className="mt-6 block">Montant reçu</CapsLabel>
        <UnitField className="mt-2" big unit="XAF" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="0" invalid={over} aria-label="Montant reçu" />
        {over && <p className="mt-1.5 text-[15px] font-medium text-[#C00F0C] dark:text-[#FCB3AD]">Plus que le reste · {xaf(balance)}</p>}
        {!over && v > 0 && left > 0 && <p className={cn('mt-1.5 text-[15px]', TEXT.muted)}>Il restera {xaf(left)}</p>}

        <CapsLabel className="mt-6">Comment</CapsLabel>
        <div className="mt-2 grid grid-cols-3 gap-2.5" role="radiogroup" aria-label="Mode de paiement">
          {METHODS.map((m) => {
            const on = m === method;
            return (
              <button key={m} type="button" role="radio" aria-checked={on} aria-label={METHOD_LABEL[m]} onClick={() => setMethod(m)}
                className={cn('flex flex-col items-center gap-2 rounded-lg border px-2 py-3.5', on ? 'border-2 border-[#2C2C2C] dark:border-[#E3E3E3]' : 'border-[#D9D9D9] dark:border-[#444444]')}>
                <IconCircle icon={METHOD_ICON[m]} />
                <span className={cn('text-[15px] font-semibold', TEXT.strong)}>{TILE_LABEL[m]}</span>
              </button>
            );
          })}
        </div>

        {method === 'wallet' && (noClient
          ? <p className="mt-4 text-[15px] font-medium text-[#975102] dark:text-[#E8B931]">Dépôt sans client</p>
          : (
            <>
              <KVBox className="mt-4" rows={walletRows} />
              {short && hasPermission('canProcessDeposits') && (
                <ItemList className="-mx-5 pt-1">
                  <ItemRow leading={<IconCircle icon={PlusCircle} />} title="Recharger le compte" subtitle={`Il manque ${xaf(v - walletXaf)}`} onClick={() => navigate(`/m/deposits/new?clientId=${q.client!.user_id}`)} chevron />
                </ItemList>
              )}
            </>
          ))}

        {method !== 'cash' && method !== 'wallet' && (
          <>
            <CapsLabel as="label" className="mt-6 block">Référence</CapsLabel>
            <TextInput value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Facultatif" className="mt-2 h-12" aria-label="Référence de l'opération" />
          </>
        )}
        {method !== 'wallet' && (
          <ItemList className="-mx-5 pt-3">
            <input ref={fileRef} type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={(e) => setProof(e.target.files?.[0] ?? null)} />
            <ItemRow leading={<IconCircle icon={Camera} />} title={proof ? 'Preuve jointe' : 'Photo de la preuve'} subtitle={proof ? proof.name : 'Facultatif'} onClick={() => fileRef.current?.click()} chevron />
          </ItemList>
        )}
      </div>

      <Dock>
        <BigButton onClick={() => setAsking(true)} disabled={!ok}>Encaisser {ok ? xaf(v) : ''}</BigButton>
      </Dock>

      <ConfirmSheet
        open={asking}
        onClose={() => setAsking(false)}
        title={`Encaisser ${xaf(v)} ?`}
        subtitle={[`Devis ${summary.deposit_no}`, q.client ? clientFullName(q.client) : null].filter(Boolean).join(' · ')}
        rows={[
          { label: 'Mode', value: METHOD_LABEL[method] },
          ...(method === 'wallet' ? [{ label: 'Solde', before: xaf(walletXaf), value: xaf(walletXaf - v) }] : []),
          { label: 'Reste à payer', before: xaf(balance), value: xaf(left), tone: left === 0 ? 'success' as const : undefined },
          ...(reference.trim() ? [{ label: 'Référence', value: reference.trim() }] : []),
        ]}
        confirmLabel="Encaisser"
        onConfirm={() => void submit()}
        loading={saving}
      />
    </>
  );
}

export function WarehousePay() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const { data, isLoading, error, refetch } = useClientAtWarehouse(code);
  const { data: settings } = useAdminShippingSettings();
  const [which, setWhich] = useState<string | null>(null);
  const [paid, setPaid] = useState<Paid | null>(null);
  const back = `/w/remise/${code}`;
  if (isLoading) return <ScreenLoader className="min-h-[100dvh]" />;
  if (error || !data) {
    return (
      <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
        <ScreenTop title="Encaisser" backTo={back} />
        <EmptyLine action={{ label: 'Réessayer', onClick: () => void refetch() }}>{(error as Error | null)?.message ?? 'Client introuvable'}</EmptyLine>
      </div>
    );
  }

  const draft = readReleaseDraft(code);
  const chosen = draft ? data.ready.filter((p) => draft.ids.includes(p.id)) : data.ready;
  const due = releaseBlockers(chosen.length ? chosen : data.ready, data.quotes).filter((q) => q.total_xaf > 0 && q.balance_xaf > 0);
  const current = due.length === 1 ? due[0] : due.find((q) => q.id === which) ?? null;

  if (paid) {
    // Encore un devis à solder ? « Devis suivant ». Sinon, la remise.
    const others = due.filter((q) => q.id !== paid.quote.id);
    const more = paid.left > 0 || others.length > 0;
    return (
      <div className={cn('min-h-[100dvh]', SURFACE.canvas)}>
        <SuccessView
          title="Encaissé"
          subtitle={[xaf(paid.amount), METHOD_LABEL[paid.method], paid.payment?.receipt_no].filter(Boolean).join(' · ')}
          rows={[{ label: 'Reste sur ce devis', value: xaf(paid.left), tone: paid.left === 0 ? 'success' : undefined }]}
          primary={more
            ? { label: paid.left > 0 ? 'Encaisser le reste' : 'Devis suivant', onClick: () => { setPaid(null); setWhich(paid.left > 0 ? paid.quote.id : null); void refetch(); } }
            : { label: 'Remettre les colis', onClick: () => navigate(back, { replace: true }) }}
          secondary={paid.payment ? { label: `Reçu ${paid.payment.receipt_no} (PDF)`, onClick: () => void handReceipt(paid.quote, paid.payment!, settings ?? DEFAULT_SHIPPING_SETTINGS) } : undefined}
        />
      </div>
    );
  }

  const onBack = current && due.length > 1 ? () => setWhich(null) : undefined;
  return (
    <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
      <ScreenTop title="Encaisser" backTo={onBack ? undefined : back} onBack={onBack} />
      <div className="px-5 pt-4">
        <WhClientCard client={data.client} tag={due.length ? { tone: 'pending', label: 'À payer' } : { tone: 'success', label: 'Payé' }} />
      </div>
      {due.length === 0 ? (
        <SuccessView title="Tout est payé" primary={{ label: 'Remettre les colis', onClick: () => navigate(back, { replace: true }) }} />
      ) : current ? (
        <PayForm key={current.id} summary={current} onPaid={(p) => { setPaid(p); void refetch(); }} />
      ) : (
        <div className="pt-4">
          <CapsLabel className="px-5">Quel devis solder ?</CapsLabel>
          <ItemList>
            {due.map((q) => (
              <ItemRow key={q.id} leading={<IconCircle icon={Banknote} />} title={[q.deposit_no, q.quote_no].filter(Boolean).join(' · ')} subtitle={`Reste ${xaf(q.balance_xaf)} sur ${xaf(q.total_xaf)}`} onClick={() => setWhich(q.id)} chevron />
            ))}
          </ItemList>
        </div>
      )}
    </div>
  );
}

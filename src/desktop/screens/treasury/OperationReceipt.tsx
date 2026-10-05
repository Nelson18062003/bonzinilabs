/**
 * Trésorerie — le reçu d'un achat ou d'une vente d'USDT.
 *
 * C'est une IMAGE avant d'être un écran : on la copie et on la colle dans
 * WhatsApp ou WeChat pour le fournisseur ou l'acheteur. D'où des couleurs
 * écrites en dur (le reçu est blanc, même en thème sombre), une largeur fixe,
 * et rien d'interne (ni note, ni coût moyen, ni grand livre).
 *
 * En tête, la bande aux trois couleurs du logo ; puis le montant en grand,
 * le taux, ce qui a été payé ou reçu, et les détails qu'on vient vérifier.
 */
import { forwardRef, useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Copy, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { LEGAL_NAME, WEBSITE } from '@/lib/companyIdentity';
import { captureNodePng, copyNodePng, prewarmFontEmbedCss, triggerDownload } from '@/lib/nodeImage';
import { cn } from '@/lib/utils';
import { BTN } from './tstyle';
import { fmtLongDate, fmtNum } from './treasuryFormat';
import { receiptFilename, receiptNumber, type ReceiptData } from './receiptData';

const INK = '#16131F';
const MUTED = '#6E6A7C';
const LINE = '#ECEAF2';
const SOFT = '#F7F6FB';

export const OperationReceipt = forwardRef<HTMLDivElement, { data: ReceiptData; className?: string }>(function OperationReceipt({ data, className }, ref) {
  const purchase = data.kind === 'purchase';
  const counterDecimals = data.counterCur === 'XAF' ? 0 : 2;
  const rateUnit = purchase ? 'XAF / USDT' : 'CNY / USDT';
  const accountsLabel = purchase ? 'Payé depuis' : 'Encaissé sur';

  return (
    <div
      ref={ref}
      className={cn('relative w-[420px] overflow-hidden rounded-[22px] bg-white', className)}
      style={{ color: INK, fontFamily: '"DM Sans", system-ui, sans-serif', boxShadow: '0 1px 2px rgba(22,19,31,0.06), 0 8px 28px rgba(22,19,31,0.08)' }}
    >
      {/* Les trois couleurs du logo. */}
      <div className="flex h-[6px]">
        <div className="flex-1" style={{ background: 'hsl(258 100% 60%)' }} />
        <div className="flex-1" style={{ background: 'hsl(36 100% 55%)' }} />
        <div className="flex-1" style={{ background: 'hsl(16 100% 55%)' }} />
      </div>

      <div className="px-8 pb-7 pt-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <img src="/assets/bonzini-logo.jpg" alt="" className="h-9 w-9 rounded-[10px]" crossOrigin="anonymous" />
            <div className="leading-tight">
              <div className="text-[16px] font-bold tracking-[-0.01em]">Bonzini</div>
              <div className="text-[9.5px] font-semibold tracking-[0.08em]" style={{ color: MUTED }}>
                {LEGAL_NAME}
              </div>
            </div>
          </div>
          <span
            className="rounded-full px-3 py-1 text-[12px] font-semibold"
            style={purchase ? { background: '#E8F7EF', color: '#127A47' } : { background: '#EFEBFF', color: '#5B33D6' }}
          >
            {purchase ? 'Achat d’USDT' : 'Vente d’USDT'}
          </span>
        </div>

        <div className="mt-8">
          <div className="text-[13px] font-medium" style={{ color: MUTED }}>
            {purchase ? 'USDT achetés' : 'USDT vendus'}
          </div>
          <div className="mt-1 flex items-baseline gap-2" style={{ textDecoration: data.voided ? 'line-through' : undefined }}>
            <span className="text-[44px] font-bold leading-none tracking-[-0.03em] tabular-nums">{fmtNum(data.usdt, 2)}</span>
            <span className="text-[18px] font-semibold" style={{ color: MUTED }}>
              USDT
            </span>
          </div>
          {data.rate ? (
            <div className="mt-2 text-[14px]" style={{ color: MUTED }}>
              au taux de <span className="font-semibold tabular-nums" style={{ color: INK }}>{fmtNum(data.rate, purchase ? 2 : 4)}</span> {rateUnit}
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex items-center justify-between rounded-2xl px-5 py-4" style={{ background: SOFT }}>
          <span className="text-[14px] font-medium" style={{ color: MUTED }}>
            {purchase ? 'Montant payé' : 'Montant reçu'}
          </span>
          <span className="text-[22px] font-bold tracking-[-0.02em] tabular-nums">
            {fmtNum(data.counter, counterDecimals)} <span className="text-[14px] font-semibold" style={{ color: MUTED }}>{data.counterCur}</span>
          </span>
        </div>

        <div className="mt-6 border-t border-dashed" style={{ borderColor: LINE }} />

        <dl className="mt-2">
          {data.counterparty && (
            <Row label={purchase ? 'Fournisseur' : 'Acheteur'}>
              <div>{data.counterparty.name}</div>
              {(data.counterparty.phone || data.counterparty.wechat) && (
                <div className="text-[12.5px] font-normal" style={{ color: MUTED }}>
                  {[data.counterparty.phone, data.counterparty.wechat && `WeChat ${data.counterparty.wechat}`].filter(Boolean).join(' · ')}
                </div>
              )}
            </Row>
          )}
          {data.accounts.length > 0 && (
            <Row label={accountsLabel}>
              {data.accounts.length === 1 ? (
                data.accounts[0].label
              ) : (
                data.accounts.map((a) => (
                  <div key={a.label}>
                    {a.label} <span className="font-normal tabular-nums" style={{ color: MUTED }}>· {fmtNum(a.amount, counterDecimals)} {data.counterCur}</span>
                  </div>
                ))
              )}
            </Row>
          )}
          <Row label="Date">{fmtLongDate(data.at).replace(/^./, (c) => c.toUpperCase())}</Row>
          {data.ref && <Row label="Référence">{data.ref}</Row>}
          <Row label="N° d’opération">
            <span className="tabular-nums tracking-[0.02em]">{receiptNumber(data.kind, data.id)}</span>
          </Row>
        </dl>

        {data.voided && (
          <div className="mt-5 rounded-2xl px-5 py-4 text-[13px]" style={{ background: '#FDECEC', color: '#B42318' }}>
            <div className="text-[14px] font-bold">Opération annulée</div>
            {data.voidReason && <div className="mt-0.5">{data.voidReason}</div>}
          </div>
        )}

        <div className="mt-7 text-center text-[11.5px]" style={{ color: MUTED }}>
          Bonzini · {WEBSITE}
        </div>
      </div>
    </div>
  );
});

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b py-3 last:border-0" style={{ borderColor: LINE }}>
      <dt className="shrink-0 pt-px text-[13px]" style={{ color: MUTED }}>
        {label}
      </dt>
      <dd className="text-right text-[14px] font-semibold leading-snug">{children}</dd>
    </div>
  );
}

/** « Copier l'image » et « Télécharger » pour un reçu affiché. */
export function ReceiptActions({ target, data, className }: { target: RefObject<HTMLDivElement>; data: ReceiptData; className?: string }) {
  const [busy, setBusy] = useState<'copy' | 'download' | null>(null);
  const warmed = useRef(false);

  // La première capture réécrit les polices en base64 : on la paie pendant
  // que l'opérateur regarde le reçu, pas après son clic.
  useEffect(() => {
    if (!warmed.current && target.current) {
      warmed.current = true;
      prewarmFontEmbedCss(target.current);
    }
  });

  const copy = useCallback(async () => {
    if (busy || !target.current) return;
    setBusy('copy');
    try {
      const outcome = await copyNodePng(target.current, receiptFilename(data), { pixelRatio: 2, backgroundColor: '#ffffff' });
      toast.success(outcome === 'copied' ? 'Reçu copié — collez-le dans WhatsApp ou WeChat' : 'Reçu téléchargé — ce navigateur ne sait pas copier une image');
    } catch {
      toast.error('Impossible de copier le reçu');
    } finally {
      setBusy(null);
    }
  }, [busy, target, data]);

  const download = useCallback(async () => {
    if (busy || !target.current) return;
    setBusy('download');
    try {
      triggerDownload(await captureNodePng(target.current, { pixelRatio: 2, backgroundColor: '#ffffff' }), receiptFilename(data));
    } catch {
      toast.error('Impossible de télécharger le reçu');
    } finally {
      setBusy(null);
    }
  }, [busy, target, data]);

  return (
    <div className={cn('flex gap-2', className)}>
      <button type="button" className={cn(BTN.primary, 'flex-1')} onClick={() => void copy()} disabled={!!busy}>
        {busy === 'copy' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />} Copier l’image
      </button>
      <button type="button" className={cn(BTN.soft, 'flex-1')} onClick={() => void download()} disabled={!!busy}>
        {busy === 'download' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Télécharger
      </button>
    </div>
  );
}

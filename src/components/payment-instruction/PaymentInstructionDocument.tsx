// ============================================================
// L'INSTRUCTION DE PAIEMENT — la carte que le partenaire chinois reçoit.
//
// Partagée par la fenêtre de l'ordinateur (PaymentInstructionDialog) et la
// feuille du téléphone (MobilePaymentInstructionSheet) : même contenu, même
// ordre, mêmes libellés bilingues EN / 中文 que la page PDF. Le fond reste
// blanc quel que soit le thème : c'est un document, pas un écran — et c'est
// cette carte, entière, que « Copier / Partager l'image » capture.
// ============================================================
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { formatRMB } from '@/lib/pdf/helpers';
import { formatDateIso, methodLabel, usesQrCode, type PaymentInstructionEntry } from '@/lib/paymentInstruction';

/** Le document se lit toujours sur fond clair, quel que soit le thème de l'app. */
const DOC = { strong: '#17151F', muted: '#6E6A80', line: 'rgba(0,0,0,0.08)', violet: '#5B21B6' };

function DocField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px]" style={{ color: DOC.muted }}>
        {label}
      </div>
      <div
        className={cn('mt-0.5 break-words text-[13.5px] font-semibold', mono && 'font-mono tracking-[0.02em]')}
        style={{ color: DOC.strong }}
      >
        {value}
      </div>
    </div>
  );
}

export const PaymentInstructionDocument = forwardRef<HTMLDivElement, { entry: PaymentInstructionEntry; className?: string }>(
  function PaymentInstructionDocument({ entry, className }, ref) {
    const isQr = usesQrCode(entry.method);
    return (
      <div ref={ref} className={cn('overflow-hidden rounded-2xl bg-white ring-1 ring-black/[0.08]', className)}>
        {/* En-tête : la méthode et la référence, comme en haut de la page PDF. */}
        <div
          className="flex items-center justify-between gap-3 px-4 py-2.5"
          style={{ borderBottom: `1px solid ${DOC.line}` }}
        >
          <span className="truncate text-[12.5px] font-bold" style={{ color: DOC.strong }}>
            {methodLabel(entry.method)}
          </span>
          <span className="shrink-0 font-mono text-[11.5px] font-bold" style={{ color: DOC.muted }}>
            {entry.reference}
          </span>
        </div>

        {/* Le montant, en grand : c'est la seule chose qui doit être lue de loin. */}
        <div className="px-4 py-4 text-center">
          <div className="text-[10px] uppercase tracking-[0.1em]" style={{ color: DOC.muted }}>
            Amount to send · 付款金额
          </div>
          <div className="mt-1 text-[34px] font-extrabold leading-none tabular-nums" style={{ color: DOC.violet }}>
            ¥{formatRMB(entry.amount_rmb)}
          </div>
          <div className="mt-1 text-[11px]" style={{ color: DOC.muted }}>
            RMB · 人民币 — {formatDateIso(entry.created_at)}
          </div>
        </div>

        {isQr && entry.beneficiary_qr_code_url && (
          <div className="flex flex-col items-center px-4 pb-3">
            <div className="rounded-xl bg-white p-2" style={{ border: `1px solid ${DOC.line}` }}>
              <img
                src={entry.beneficiary_qr_code_url}
                crossOrigin="anonymous"
                alt={`QR code ${methodLabel(entry.method)} — ${entry.reference}`}
                className="block h-[190px] w-[190px] bg-white object-contain"
              />
            </div>
            <div className="mt-1.5 text-[10px]" style={{ color: DOC.muted }}>
              QR Code · 二维码 — {methodLabel(entry.method)}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 px-4 pb-4" style={{ borderTop: `1px solid ${DOC.line}`, paddingTop: 12 }}>
          {entry.method === 'bank_transfer' ? (
            <>
              {entry.beneficiary_name && <DocField label="Beneficiary · 收款人" value={entry.beneficiary_name} />}
              {entry.beneficiary_bank_name && <DocField label="Bank · 银行" value={entry.beneficiary_bank_name} />}
              {entry.beneficiary_bank_account && (
                <DocField label="Account · 账号" value={entry.beneficiary_bank_account} mono />
              )}
              {entry.beneficiary_bank_extra && (
                <DocField label="SWIFT / IBAN · 银行代码" value={entry.beneficiary_bank_extra} mono />
              )}
            </>
          ) : (
            <>
              {entry.beneficiary_name && <DocField label="Name · 姓名" value={entry.beneficiary_name} />}
              {entry.beneficiary_identifier && (
                <DocField
                  label={entry.method === 'wechat' ? 'WeChat ID · 微信号' : 'Alipay ID · 支付宝账号'}
                  value={entry.beneficiary_identifier}
                  mono
                />
              )}
            </>
          )}
          {entry.beneficiary_phone && <DocField label="Phone · 电话" value={entry.beneficiary_phone} mono />}
          {entry.beneficiary_email && <DocField label="Email · 邮箱" value={entry.beneficiary_email} />}
          {entry.beneficiary_notes && (
            <div className="col-span-2">
              <DocField label="Notes · 备注" value={entry.beneficiary_notes} />
            </div>
          )}
        </div>
      </div>
    );
  },
);

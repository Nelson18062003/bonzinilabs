// ============================================================
// APP CLIENT — Accueil · carte « Mon identifiant ».
// Le code est visible sans un clic de plus : c'est ce que le client recopie
// dans le libellé de son virement. Le QR miniature annonce l'étiquette colis
// et la carte entière mène à la page complète (/my-code).
// ============================================================
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { customerQrPayload } from '@/lib/customerCode';
import { SURFACE, TEXT } from '@/mobile/designKit';

export const CustomerIdCard = ({ code }: { code?: string | null }) => {
  const navigate = useNavigate();
  const { t } = useTranslation('client');

  if (!code) return null;

  return (
    <button
      type="button"
      onClick={() => navigate('/my-code')}
      className={cn('flex w-full items-center gap-3.5 rounded-[22px] p-3.5 text-left transition active:scale-[0.99]', SURFACE.card, SURFACE.shadow)}
    >
      <div className="shrink-0 rounded-2xl bg-white p-1.5 ring-1 ring-black/[0.06]">
        <QRCodeSVG value={customerQrPayload(code)} size={52} level="M" marginSize={0} />
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn('text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>{t('myCode.cardTitle', { defaultValue: 'Mon identifiant client' })}</div>
        <div className={cn('mt-0.5 text-[22px] font-black leading-none tracking-[0.04em] tabular-nums', TEXT.strong)}>{code}</div>
        <div className={cn('mt-1 truncate text-[12px]', TEXT.muted)}>{t('myCode.cardHint', { defaultValue: 'Virements · étiquette colis QR' })}</div>
      </div>
      <ChevronRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
    </button>
  );
};

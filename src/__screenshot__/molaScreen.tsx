/**
 * DEV-ONLY maquette — the FULL Mola screen in the reference design language:
 * soft lilac canvas, sticky "Nouvelle conversation" button (option B), chat
 * bubbles (dark user pill / white assistant card), a confirmation card, and the
 * composer. Rendered at /screenshot.html?screen=mola-screen. This is the spec
 * for the real MobileAssistantScreen rework.
 */
import type { ReactNode } from 'react';
import { ArrowLeft, Bot, Plus, Paperclip, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

const HOLDER = 'bg-[#EDEAFA] text-[#2C2740] dark:bg-[#2F2C3D] dark:text-[#E7E5F0]';
const SOFT_SHADOW = 'shadow-[0_8px_30px_-12px_rgba(46,32,92,0.20)] dark:shadow-none';

function Circle({ children }: { children: ReactNode }) {
  return <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', HOLDER)}>{children}</div>;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-[7px] text-[13.5px]">
      <span className="text-[#8E8BA0] dark:text-[#9B98AD]">{label}</span>
      <span className="text-right font-semibold tabular-nums text-[#1B1A24] dark:text-[#F2F1F7]">{value}</span>
    </div>
  );
}

function ConfirmPayment() {
  return (
    <div className={cn('rounded-[26px] bg-white p-5 dark:bg-[#211F2B]', SOFT_SHADOW)}>
      <div className="flex items-center gap-3">
        <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[15px] font-bold', HOLDER)}>ST</div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[16px] font-bold leading-tight text-[#1B1A24] dark:text-[#F2F1F7]">Régler Shenzhen Tech Co.</div>
          <div className="mt-0.5 truncate text-[13px] text-[#8E8BA0] dark:text-[#9B98AD]">Paiement fournisseur · pour Awa Diop</div>
        </div>
      </div>
      <div className="mt-5">
        <div className="text-[12px] font-medium text-[#8E8BA0] dark:text-[#9B98AD]">Montant à débiter</div>
        <div className="mt-1.5 text-[30px] font-extrabold leading-none tracking-tight tabular-nums text-[#1B1A24] dark:text-[#F2F1F7]">
          12 500 000<span className="ml-1.5 text-[15px] font-bold text-[#AAA7BD] dark:text-[#6F6C82]">XAF</span>
        </div>
        <div className="mt-1.5 text-[12px] text-[#8E8BA0] dark:text-[#9B98AD]">≈ 178 500 CNY · taux 70,03</div>
      </div>
      <div className="mt-4">
        <Row label="Client" value="Awa Diop · BZ-CL-0042" />
        <Row label="Méthode" value="Alipay" />
        <Row label="Solde du client après" value="36 250 000 XAF" />
      </div>
      <div className="mt-5 flex gap-2.5">
        <button className="flex-1 rounded-full bg-[#1C1B22] py-[13px] text-[14px] font-bold text-white dark:bg-[#F2F1F7] dark:text-[#1B1A24]">Confirmer</button>
        <button className="rounded-full bg-[#EDEAFA] px-6 py-[13px] text-[14px] font-semibold text-[#2C2740] dark:bg-[#2F2C3D] dark:text-[#E7E5F0]">Annuler</button>
      </div>
    </div>
  );
}

export function MolaScreen() {
  return (
    <div className="flex min-h-screen flex-col bg-[#ECEAF7] dark:bg-[#141320]">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-6">
        <Circle><ArrowLeft className="h-4 w-4" /></Circle>
        <Circle><Bot className="h-4 w-4" /></Circle>
        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-bold leading-tight text-[#1B1A24] dark:text-[#F2F1F7]">Mola</div>
          <div className="truncate text-[11px] text-[#8E8BA0] dark:text-[#9B98AD]">Directeur des opérations</div>
        </div>
      </div>

      {/* Option B — sticky "new conversation" (shown because a conversation exists) */}
      <div className="px-4 pb-1">
        <button className="flex w-full items-center justify-center gap-1.5 rounded-full bg-[#1C1B22] py-2.5 text-[13.5px] font-bold text-white dark:bg-[#F2F1F7] dark:text-[#1B1A24]">
          <Plus className="h-4 w-4" /> Nouvelle conversation
        </button>
      </div>

      {/* Conversation */}
      <div className="flex-1 space-y-3 px-4 py-3">
        <div className="flex justify-end">
          <div className="max-w-[80%] rounded-[20px] rounded-br-md bg-[#1C1B22] px-4 py-2.5 text-[14px] leading-relaxed text-white dark:bg-[#34323F]">
            Paie Shenzhen Tech 12,5M via Alipay pour Awa Diop
          </div>
        </div>

        <div className="flex justify-start">
          <div className={cn('max-w-[85%] rounded-[20px] rounded-bl-md bg-white px-4 py-2.5 text-[14px] leading-relaxed text-[#1B1A24] dark:bg-[#211F2B] dark:text-[#F2F1F7]', SOFT_SHADOW)}>
            D'accord. Voici le paiement à confirmer 👇
          </div>
        </div>

        <ConfirmPayment />
      </div>

      {/* Composer */}
      <div className="flex items-center gap-2 px-4 pb-7 pt-2">
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#2C2740] dark:bg-[#211F2B] dark:text-[#E7E5F0]', SOFT_SHADOW)}>
          <Paperclip className="h-5 w-5" />
        </div>
        <div className={cn('flex-1 rounded-full bg-white px-4 py-3 text-[14px] text-[#9B98AD] dark:bg-[#211F2B]', SOFT_SHADOW)}>
          Écris, dicte ou joins un fichier…
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1C1B22] text-white dark:bg-[#F2F1F7] dark:text-[#1B1A24]">
          <Send className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

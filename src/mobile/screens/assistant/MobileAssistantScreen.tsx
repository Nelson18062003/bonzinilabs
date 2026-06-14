import { useEffect, useRef, useState } from 'react';
import { Send, Bot, Loader2, Paperclip, X, FileText, Check, Loader, AlertTriangle, Plus, Wallet, Download, Maximize2 } from 'lucide-react';
import { toast } from 'sonner';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { ViewportShell } from '@/components/layout/ViewportShell';
import { useAdminAssistant, type AssistantProposal } from '@/hooks/useAdminAssistant';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { MolaMascot } from '@/components/MolaMascot';
import { validateUploadFile, cn } from '@/lib/utils';

const SUGGESTIONS = [
  'Volume de la semaine ?',
  'Derniers dépôts en attente',
  'Taux Alipay du jour',
  'Paiements en cours',
];

const MAX_FILES = 5;
// Hauteur max du champ de saisie avant qu'il ne défile lui-même (≈ 5 lignes).
const COMPOSER_MAX_H = 128;

// Langage visuel (réf Ofspace "Banking App UI") : canvas lilas doux, cartes
// blanches à ombre diffuse (sans bordure dure), pastilles rondes neutres,
// chiffres focaux, pilules sombres. Aucun dégradé, aucun trait de séparation.
const CANVAS = 'bg-[#ECEAF7] dark:bg-[#141320]';
const CARD = 'bg-white dark:bg-[#211F2B]';
const SOFT = 'shadow-[0_8px_30px_-12px_rgba(46,32,92,0.18)] dark:shadow-none';
const HOLDER = 'bg-[#EDEAFA] text-[#2C2740] dark:bg-[#2F2C3D] dark:text-[#E7E5F0]';

interface PendingFile {
  id: string;
  file: File;
  url: string;
  isPdf: boolean;
}

// Rendu léger du texte : **gras** → <strong>. Le reste en texte brut
// (whitespace-pre-wrap gère les retours à la ligne). Pas de HTML injecté.
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\*\*[^*]+\*\*$/.test(p)
          ? <strong key={i}>{p.slice(2, -2)}</strong>
          : <span key={i}>{p}</span>,
      )}
    </>
  );
}

// Prévisualisation plein écran d'une image générée (flyer, preuve, QR, reçu).
// Tap sur le fond ou Échap → ferme. Bouton dédié pour télécharger / ouvrir.
// (Fonctionnalité venue de main / PR #140 — conservée dans le nouveau langage.)
function ImagePreview({ image, onClose }: { image: { url: string; name: string }; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-black/90 backdrop-blur-md"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Prévisualisation : ${image.name}`}
    >
      <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+14px)]" onClick={(e) => e.stopPropagation()}>
        <span className="truncate text-sm font-medium text-white/90">{image.name}</span>
        <button onClick={onClose} aria-label="Fermer la prévisualisation" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition active:scale-95 active:bg-white/20">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex flex-1 items-center justify-center overflow-auto px-3 py-1" onClick={(e) => e.stopPropagation()}>
        <img src={image.url} alt={image.name} className="max-h-full max-w-full rounded-xl object-contain shadow-2xl" />
      </div>
      <div className="px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-3" onClick={(e) => e.stopPropagation()}>
        <a href={image.url} target="_blank" rel="noopener noreferrer" download={image.name} className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-3 text-sm font-semibold text-black transition active:scale-[0.99]">
          <Download className="h-4 w-4" /> Télécharger / ouvrir
        </a>
      </div>
    </div>
  );
}

// Carte de confirmation d'une action sensible (créer/valider dépôt, paiement, taux…).
// Même contrat de données (ProposalSummary) ; seul l'habillage change.
function ConfirmationCard({
  proposal,
  onConfirm,
  onCancel,
}: {
  proposal: AssistantProposal;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { summary, state, resultText } = proposal;

  // États « résultat » → carte compacte (la proposition se replie en résultat).
  if (state === 'done' || state === 'failed' || state === 'cancelled') {
    const variant = {
      done: { holder: 'bg-[#DEEFE5] text-[#2E7D52] dark:bg-[#1E3A2C] dark:text-[#7FCBA0]', Icon: Check, title: 'Action exécutée' },
      failed: { holder: 'bg-[#FBE7E7] text-[#C0504D] dark:bg-[#3A2526] dark:text-[#E79A9A]', Icon: AlertTriangle, title: 'Échec' },
      cancelled: { holder: HOLDER, Icon: X, title: 'Action annulée' },
    }[state];
    const Icon = variant.Icon;
    return (
      <div className={cn('w-full rounded-[22px] p-4', CARD, SOFT)}>
        <div className="flex items-center gap-3">
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', variant.holder)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-bold text-[#1B1A24] dark:text-[#F2F1F7]">{variant.title}</div>
            {resultText && <div className="text-[12.5px] text-[#8E8BA0] dark:text-[#9B98AD]">{resultText}</div>}
          </div>
        </div>
      </div>
    );
  }

  // pending / executing → carte complète
  const danger = !!summary.danger;
  const executing = state === 'executing';
  return (
    <div className={cn('w-full rounded-[26px] p-5', CARD, SOFT)}>
      <div className="flex items-center gap-3">
        <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-full', danger ? 'bg-[#FBE7E7] text-[#B23A3A] dark:bg-[#3A2526] dark:text-[#E79A9A]' : HOLDER)}>
          {danger ? <AlertTriangle className="h-5 w-5" /> : <Wallet className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-bold leading-tight text-[#1B1A24] dark:text-[#F2F1F7]">{summary.title}</div>
          {summary.subtitle && <div className="mt-0.5 text-[13px] text-[#8E8BA0] dark:text-[#9B98AD]">{summary.subtitle}</div>}
        </div>
      </div>

      {danger && (
        <div className="mt-4 flex items-start gap-2 rounded-2xl bg-[#FBEFEF] px-3.5 py-2.5 dark:bg-[#2C1F20]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#C0504D]" />
          <p className="text-[12.5px] leading-snug text-[#9B4A47] dark:text-[#E0A3A1]">Action sensible — vérifie bien avant de confirmer.</p>
        </div>
      )}

      {summary.amount && (
        <div className="mt-5 text-[30px] font-extrabold leading-none tracking-tight tabular-nums text-[#1B1A24] dark:text-[#F2F1F7]">
          {summary.amount}
        </div>
      )}

      {summary.lines.length > 0 && (
        <div className="mt-4">
          {summary.lines.map((l, i) => (
            <div key={i} className="flex items-center justify-between gap-3 py-[7px] text-[13.5px]">
              <span className="text-[#8E8BA0] dark:text-[#9B98AD]">{l.label}</span>
              <span className="text-right font-semibold tabular-nums text-[#1B1A24] dark:text-[#F2F1F7]">{l.value}</span>
            </div>
          ))}
        </div>
      )}

      {executing ? (
        <div className="mt-5 flex items-center justify-center gap-2 rounded-full bg-[#EDEAFA] py-[13px] text-[14px] font-semibold text-[#2C2740] dark:bg-[#2F2C3D] dark:text-[#E7E5F0]">
          <Loader className="h-4 w-4 animate-spin" /> Exécution…
        </div>
      ) : (
        <div className="mt-5 flex gap-2.5">
          <button
            onClick={onConfirm}
            className={cn('flex-1 rounded-full py-[13px] text-[14px] font-bold', danger ? 'bg-[#D14343] text-white' : 'bg-[#1C1B22] text-white dark:bg-[#F2F1F7] dark:text-[#1B1A24]')}
          >
            {summary.confirmLabel}
          </button>
          <button
            onClick={onCancel}
            className="rounded-full bg-[#EDEAFA] px-6 py-[13px] text-[14px] font-semibold text-[#2C2740] dark:bg-[#2F2C3D] dark:text-[#E7E5F0]"
          >
            Annuler
          </button>
        </div>
      )}
    </div>
  );
}

export function MobileAssistantScreen({ desktop = false }: { desktop?: boolean } = {}) {
  const { profile } = useAdminAuth();
  const { messages, isLoading, sendMessage, confirmProposal, cancelProposal, reset, loadHistory } = useAdminAssistant();
  const [input, setInput] = useState('');
  const [pending, setPending] = useState<PendingFile[]>([]);
  // Image en cours de prévisualisation plein écran (générée par Mola ou pièce jointe).
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reprend la dernière conversation au montage (historique)
  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Le cadre (ViewportShell) suit le clavier via --vvh (CSS, sans re-render).
  // Ici on se contente de garder la conversation collée au bas quand le clavier
  // s'ouvre/se ferme — opération DOM pure, aucun re-render React.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const stickToBottom = () => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    };
    vv.addEventListener('resize', stickToBottom);
    return () => vv.removeEventListener('resize', stickToBottom);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isLoading, pending]);

  // Libère les object URLs au démontage
  useEffect(() => () => { pending.forEach((p) => URL.revokeObjectURL(p.url)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Réinitialise la hauteur du champ après envoi / nouvelle conversation.
  const resetComposerHeight = () => {
    const el = textareaRef.current;
    if (el) el.style.height = 'auto';
  };

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    const room = MAX_FILES - pending.length;
    if (room <= 0) {
      toast.error(`Maximum ${MAX_FILES} fichiers par message.`);
      return;
    }
    const next: PendingFile[] = [];
    for (const file of Array.from(list).slice(0, room)) {
      try {
        validateUploadFile(file); // lève une erreur si invalide (taille / type)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Fichier non autorisé');
        continue;
      }
      next.push({
        id: crypto.randomUUID(),
        file,
        url: URL.createObjectURL(file),
        isPdf: file.type === 'application/pdf',
      });
    }
    if (next.length) setPending((prev) => [...prev, ...next]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePending = (id: string) => {
    setPending((prev) => {
      const found = prev.find((p) => p.id === id);
      if (found) URL.revokeObjectURL(found.url);
      return prev.filter((p) => p.id !== id);
    });
  };

  const handleSend = () => {
    if ((!input.trim() && pending.length === 0) || isLoading) return;
    sendMessage(input, pending.map((p) => p.file));
    setInput('');
    resetComposerHeight();
    pending.forEach((p) => URL.revokeObjectURL(p.url));
    setPending([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNew = () => {
    if (isLoading) return;
    reset();
    setInput('');
    resetComposerHeight();
    pending.forEach((p) => URL.revokeObjectURL(p.url));
    setPending([]);
  };

  const canSend = (!!input.trim() || pending.length > 0) && !isLoading;
  const isEmpty = messages.length === 0;

  const header = (
    <div className={CANVAS}>
      <MobileHeader
        title="Mola"
        subtitle="Directeur des Opérations"
        showBack={!desktop}
        leading={
          <MolaMascot
            className="h-9 w-9"
            fallback={
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EDEAFA] text-[#2C2740] dark:bg-[#2F2C3D] dark:text-[#E7E5F0]">
                <Bot className="h-5 w-5" />
              </div>
            }
          />
        }
        className="border-transparent bg-transparent backdrop-blur-none"
      />
      {/* Bouton explicite « nouvelle conversation » — visible uniquement quand
          une conversation existe, et toujours présent (zone d'en-tête fixe). */}
      {!isEmpty && (
        <div className="px-4 pb-2">
          <button
            onClick={handleNew}
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-1.5 rounded-full bg-[#1C1B22] py-2.5 text-[13.5px] font-bold text-white transition-opacity active:opacity-90 disabled:opacity-50 dark:bg-[#F2F1F7] dark:text-[#1B1A24]"
          >
            <Plus className="h-4 w-4" /> Nouvelle conversation
          </button>
        </div>
      )}
    </div>
  );

  const composer = (
    <div className={cn(CANVAS, 'px-4 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]')}>
      {/* Plateau d'aperçu des pièces jointes en attente */}
      {pending.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {pending.map((p) => (
            <div key={p.id} className="relative shrink-0">
              {p.isPdf ? (
                <div className={cn('flex h-16 w-16 flex-col items-center justify-center rounded-2xl px-1 text-[10px] text-[#8E8BA0]', CARD, SOFT)}>
                  <FileText className="mb-1 h-5 w-5" />
                  <span className="max-w-[56px] truncate">{p.file.name}</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setPreview({ url: p.url, name: p.file.name })}
                  aria-label={`Prévisualiser ${p.file.name}`}
                  className={cn('block overflow-hidden rounded-2xl transition active:scale-95', SOFT)}
                >
                  <img src={p.url} alt={p.file.name} className="h-16 w-16 object-cover" />
                </button>
              )}
              <button
                onClick={() => removePending(p.id)}
                aria-label="Retirer"
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#1C1B22] text-white dark:bg-[#F2F1F7] dark:text-[#1B1A24]"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          aria-label="Joindre un fichier"
          className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#2C2740] disabled:opacity-40 dark:text-[#E7E5F0]', CARD, SOFT)}
        >
          <Paperclip className="h-5 w-5" />
        </button>
        {/* Composeur de chat : textarea brut requis pour l'auto-grow (type
            WhatsApp). La police est fixée à 16px → le zoom iOS visé par la règle
            ne peut pas se produire. Même choix que MessageInput.tsx. */}
        {/* eslint-disable-next-line no-restricted-syntax */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={(e) => {
            // Auto-grow (comportement type WhatsApp/iMessage) : la barre grandit
            // ligne par ligne jusqu'à COMPOSER_MAX_H, puis défile à l'intérieur.
            const el = e.currentTarget;
            el.style.height = 'auto';
            el.style.height = Math.min(el.scrollHeight, COMPOSER_MAX_H) + 'px';
          }}
          rows={1}
          placeholder="Écris, dicte ou joins un fichier…"
          className={cn('max-h-32 flex-1 resize-none rounded-[22px] px-4 py-3 text-[16px] text-[#1B1A24] outline-none placeholder:text-[#9B98AD] focus:ring-2 focus:ring-[#C9C2F0] dark:text-[#F2F1F7] dark:focus:ring-[#4A4660]', CARD, SOFT)}
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Envoyer"
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1C1B22] text-white transition-opacity dark:bg-[#F2F1F7] dark:text-[#1B1A24]',
            !canSend && 'opacity-40',
          )}
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div>
  );

  const body = (
    <>
      {isEmpty ? (
        <div className="flex flex-col items-center pt-10 text-center">
          <MolaMascot
            className="h-24 w-24 drop-shadow-[0_10px_22px_rgba(251,87,19,0.28)]"
            fallback={
              <div className={cn('flex h-16 w-16 items-center justify-center rounded-full text-[#2C2740] dark:text-[#E7E5F0]', CARD, SOFT)}>
                <Bot className="h-8 w-8" />
              </div>
            }
          />
          <h2 className="mt-4 text-lg font-bold text-[#1B1A24] dark:text-[#F2F1F7]">
            Bonjour {profile?.first_name || ''} 👋
          </h2>
          <p className="mt-1 max-w-xs text-sm text-[#6B6880] dark:text-[#9B98AD]">
            Je suis Mola, ton directeur des opérations. Pose-moi une question sur la plateforme — clients, dépôts, paiements, taux, statistiques.
            Tu peux écrire, <span className="font-semibold text-[#1B1A24] dark:text-[#F2F1F7]">dicter avec le micro du clavier</span>,
            ou <span className="font-semibold text-[#1B1A24] dark:text-[#F2F1F7]">joindre une capture ou un PDF</span> (📎).
          </p>
          <div className="mt-6 grid w-full max-w-sm grid-cols-1 gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className={cn('rounded-[18px] px-4 py-3 text-left text-sm font-medium text-[#1B1A24] transition-opacity active:opacity-80 dark:text-[#F2F1F7]', CARD, SOFT)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((m) => (
            <div key={m.id} className={cn('flex flex-col gap-2', m.role === 'user' ? 'items-end' : 'w-full items-start')}>
              <div className={cn('flex w-full items-end gap-2', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                {m.role !== 'user' && (
                  <MolaMascot
                    className="h-7 w-7 shrink-0 self-end"
                    alt=""
                    fallback={
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center self-end rounded-full bg-[#EDEAFA] text-[#2C2740] dark:bg-[#2F2C3D] dark:text-[#E7E5F0]">
                        <Bot className="h-4 w-4" />
                      </div>
                    }
                  />
                )}
              <div
                className={cn(
                  'max-w-[85%] whitespace-pre-wrap break-words rounded-[20px] px-4 py-2.5 text-[15px] leading-relaxed',
                  m.role === 'user'
                    ? 'rounded-br-md bg-[#1C1B22] text-white dark:bg-[#34323F]'
                    : m.error
                      ? 'rounded-bl-md bg-[#FBEFEF] text-[#9B4A47] dark:bg-[#2C1F20] dark:text-[#E0A3A1]'
                      : cn('rounded-bl-md text-[#1B1A24] dark:text-[#F2F1F7]', CARD, SOFT),
                )}
              >
                {m.attachments?.length ? (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {m.attachments.map((a, i) =>
                      a.kind === 'image' && a.url ? (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setPreview({ url: a.url!, name: a.name })}
                          className="overflow-hidden rounded-xl transition active:scale-95"
                        >
                          <img src={a.url} alt={a.name} className="h-24 w-24 object-cover" />
                        </button>
                      ) : (
                        <div key={i} className="flex items-center gap-2 rounded-xl bg-black/5 px-3 py-2 text-xs dark:bg-white/10">
                          <FileText className="h-4 w-4 shrink-0" />
                          <span className="max-w-[140px] truncate">{a.name}</span>
                        </div>
                      ),
                    )}
                  </div>
                ) : null}
                {m.text && <RichText text={m.text} />}
              </div>
              </div>
              {m.images?.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPreview({ url: img.url, name: img.name })}
                  className={cn('group relative block max-w-[85%] overflow-hidden rounded-[20px] text-left transition active:scale-[0.99]', CARD, SOFT)}
                >
                  <img src={img.url} alt={img.name} className="h-auto w-full" />
                  <div className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm">
                    <Maximize2 className="h-4 w-4" />
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 text-xs text-[#8E8BA0] dark:text-[#9B98AD]">
                    <FileText className="h-3.5 w-3.5" /> {img.name} — appuyer pour prévisualiser
                  </div>
                </button>
              ))}
              {m.proposals?.map((p) => (
                <ConfirmationCard
                  key={p.id}
                  proposal={p}
                  onConfirm={() => confirmProposal(p.id)}
                  onCancel={() => cancelProposal(p.id)}
                />
              ))}
            </div>
          ))}
          {isLoading && (
            <div className="flex items-end justify-start gap-2">
              <MolaMascot
                className="h-7 w-7 shrink-0"
                alt=""
                breathing
                fallback={
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EDEAFA] text-[#2C2740] dark:bg-[#2F2C3D] dark:text-[#E7E5F0]">
                    <Bot className="h-4 w-4" />
                  </div>
                }
              />
              <div className={cn('flex items-center gap-2 rounded-[20px] rounded-bl-md px-4 py-3 text-[#6B6880] dark:text-[#9B98AD]', CARD, SOFT)}>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Mola réfléchit…</span>
              </div>
            </div>
          )}
        </div>
      )}

      {preview && <ImagePreview image={preview} onClose={() => setPreview(null)} />}
    </>
  );

  if (desktop) {
    return (
      <div className={cn('mx-auto flex h-[calc(100vh-120px)] min-h-[560px] max-w-3xl flex-col overflow-hidden rounded-[24px] shadow-[0_8px_30px_-12px_rgba(46,32,92,0.22)] ring-1 ring-black/[0.05] dark:shadow-none dark:ring-white/[0.06]', CANVAS)}>
        <div className="shrink-0">{header}</div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">{body}</div>
        <div className="shrink-0">{composer}</div>
      </div>
    );
  }

  return (
    <ViewportShell header={header} footer={composer} scrollRef={scrollRef} scrollClassName="px-4 py-3" className={CANVAS}>
      {body}
    </ViewportShell>
  );
}

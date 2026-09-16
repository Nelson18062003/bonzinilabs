import { useEffect, useRef, useState } from 'react';
import { uid } from '@/lib/uid';
import { Send, Bot, Loader2, Paperclip, X, FileText, Check, Loader, AlertTriangle, Plus, Wallet, Download, Maximize2 } from 'lucide-react';
import { toast } from 'sonner';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { ViewportShell } from '@/components/layout/ViewportShell';
import { useAdminAssistant, type AssistantProposal } from '@/hooks/useAdminAssistant';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { MolaMascot } from '@/components/MolaMascot';
import { validateUploadFile, cn } from '@/lib/utils';
import { MOBILE_TAB_BAR_HEIGHT } from '@/mobile/components/layout/MobileTabBar';
import { SURFACE } from '@/mobile/designKit';

const SUGGESTIONS = [
  'Volume de la semaine ?',
  'Derniers dépôts en attente',
  'Où en sont mes conteneurs ?',
  'Taux Alipay du jour',
];

const MAX_FILES = 5;
// Hauteur max du champ de saisie avant qu'il ne défile lui-même (≈ 5 lignes).
const COMPOSER_MAX_H = 128;

// Langage visuel (réf Ofspace "Banking App UI") : canvas lilas doux, cartes
// blanches à ombre diffuse (sans bordure dure), pastilles rondes neutres,
// chiffres focaux, pilules sombres. Aucun dégradé, aucun trait de séparation.
const CANVAS = SURFACE.canvas;
const CARD = SURFACE.card;
const SOFT = SURFACE.shadow;
const HOLDER = SURFACE.holder;

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
        <span className="truncate text-[16px] font-medium text-white/90">{image.name}</span>
        <button onClick={onClose} aria-label="Fermer la prévisualisation" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition active:scale-95 active:bg-white/20">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex flex-1 items-center justify-center overflow-auto px-3 py-1" onClick={(e) => e.stopPropagation()}>
        <img src={image.url} alt={image.name} className="max-h-full max-w-full rounded-lg object-contain shadow-2xl" />
      </div>
      <div className="px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-3" onClick={(e) => e.stopPropagation()}>
        <a href={image.url} target="_blank" rel="noopener noreferrer" download={image.name} className="flex w-full items-center justify-center gap-2 rounded-lg bg-white py-3 text-[16px] font-semibold text-black transition active:scale-[0.99]">
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
      done: { holder: 'bg-[#CFF7D3] text-[#02542D] dark:bg-[#02542D] dark:text-[#CFF7D3]', Icon: Check, title: 'Action exécutée' },
      failed: { holder: 'bg-[#FDD3D0] text-[#900B09] dark:bg-[#900B09] dark:text-[#FDD3D0]', Icon: AlertTriangle, title: 'Échec' },
      cancelled: { holder: HOLDER, Icon: X, title: 'Action annulée' },
    }[state];
    const Icon = variant.Icon;
    return (
      <div className={cn('w-full rounded-lg p-4', CARD, SOFT)}>
        <div className="flex items-center gap-3">
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', variant.holder)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[16px] font-bold text-[#1E1E1E] dark:text-[#F5F5F5]">{variant.title}</div>
            {resultText && <div className="text-[16px] text-[#5A5A5A] dark:text-[#CDCDCD]">{resultText}</div>}
          </div>
        </div>
      </div>
    );
  }

  // pending / executing → carte complète
  const danger = !!summary.danger;
  const executing = state === 'executing';
  return (
    <div className={cn('w-full rounded-lg p-5', CARD, SOFT)}>
      <div className="flex items-center gap-3">
        <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-full', danger ? 'bg-[#FDD3D0] text-[#900B09] dark:bg-[#900B09] dark:text-[#FDD3D0]' : HOLDER)}>
          {danger ? <AlertTriangle className="h-5 w-5" /> : <Wallet className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-bold leading-tight text-[#1E1E1E] dark:text-[#F5F5F5]">{summary.title}</div>
          {summary.subtitle && <div className="mt-0.5 text-[16px] text-[#5A5A5A] dark:text-[#CDCDCD]">{summary.subtitle}</div>}
        </div>
      </div>

      {danger && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-[#FDD3D0] px-3.5 py-2.5 dark:bg-[#900B09]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#900B09]" />
          <p className="text-[16px] leading-snug text-[#900B09] dark:text-[#FDD3D0]">Action sensible — vérifie bien avant de confirmer.</p>
        </div>
      )}

      {summary.amount && (
        <div className="mt-5 text-[24px] font-bold leading-none tracking-tight tabular-nums text-[#1E1E1E] dark:text-[#F5F5F5]">
          {summary.amount}
        </div>
      )}

      {summary.lines.length > 0 && (
        <div className="mt-4">
          {summary.lines.map((l, i) => (
            <div key={i} className="flex items-center justify-between gap-3 py-[7px] text-[16px]">
              <span className="text-[#5A5A5A] dark:text-[#CDCDCD]">{l.label}</span>
              <span className="text-right font-semibold tabular-nums text-[#1E1E1E] dark:text-[#F5F5F5]">{l.value}</span>
            </div>
          ))}
        </div>
      )}

      {executing ? (
        <div className="mt-5 flex items-center justify-center gap-2 rounded-lg bg-[#F5F5F5] py-[13px] text-[16px] font-semibold text-[#1E1E1E] dark:bg-[#383838] dark:text-[#F5F5F5]">
          <Loader className="h-4 w-4 animate-spin" /> Exécution…
        </div>
      ) : (
        <div className="mt-5 flex gap-2.5">
          <button
            onClick={onConfirm}
            className={cn('flex-1 rounded-lg py-[13px] text-[16px] font-bold', danger ? 'bg-[#EC221F] text-white' : 'bg-[#2C2C2C] text-white dark:bg-[#F5F5F5] dark:text-[#1E1E1E]')}
          >
            {summary.confirmLabel}
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg bg-[#F5F5F5] px-6 py-[13px] text-[16px] font-semibold text-[#1E1E1E] dark:bg-[#383838] dark:text-[#F5F5F5]"
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
        id: uid(),
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
        showBack={false}
        leading={
          <MolaMascot
            className="h-9 w-9"
            fallback={
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F5F5F5] text-[#1E1E1E] dark:bg-[#383838] dark:text-[#F5F5F5]">
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
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#2C2C2C] py-2.5 text-[16px] font-bold text-white transition-opacity active:opacity-90 disabled:opacity-50 dark:bg-[#F5F5F5] dark:text-[#1E1E1E]"
          >
            <Plus className="h-4 w-4" /> Nouvelle conversation
          </button>
        </div>
      )}
    </div>
  );

  const composer = (
    <div className={cn(CANVAS, 'border-t px-4 pt-2', SURFACE.divider)} style={{ paddingBottom: desktop ? 12 : `calc(0.75rem + max(0px, ${MOBILE_TAB_BAR_HEIGHT}px + env(safe-area-inset-bottom, 0px) - var(--vvk, 0px)))` }}>
      {/* Plateau d'aperçu des pièces jointes en attente */}
      {pending.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {pending.map((p) => (
            <div key={p.id} className="relative shrink-0">
              {p.isPdf ? (
                <div className={cn('flex h-16 w-16 flex-col items-center justify-center rounded-lg px-1 text-[16px] text-[#5A5A5A]', CARD, SOFT)}>
                  <FileText className="mb-1 h-5 w-5" />
                  <span className="max-w-[56px] truncate">{p.file.name}</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setPreview({ url: p.url, name: p.file.name })}
                  aria-label={`Prévisualiser ${p.file.name}`}
                  className={cn('block overflow-hidden rounded-lg transition active:scale-95', SOFT)}
                >
                  <img src={p.url} alt={p.file.name} className="h-16 w-16 object-cover" />
                </button>
              )}
              <button
                onClick={() => removePending(p.id)}
                aria-label="Retirer"
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#2C2C2C] text-white dark:bg-[#F5F5F5] dark:text-[#1E1E1E]"
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
          className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#1E1E1E] disabled:opacity-40 dark:text-[#F5F5F5]', CARD, SOFT)}
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
          placeholder="Écris à Mola…"
          className={cn('max-h-32 flex-1 resize-none rounded-lg px-3 py-2 text-[16px] text-[#1E1E1E] outline-none placeholder:text-[#B3B3B3] focus:border-[#2C2C2C] focus:ring-1 focus:ring-[#2C2C2C] dark:text-[#F5F5F5] dark:focus:border-[#E3E3E3] dark:focus:ring-[#E3E3E3]', SURFACE.field, CARD)}
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Envoyer"
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#2C2C2C] text-white transition-opacity dark:bg-[#F5F5F5] dark:text-[#1E1E1E]',
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
            className="h-24 w-24"
            fallback={
              <div className={cn('flex h-16 w-16 items-center justify-center rounded-full text-[#1E1E1E] dark:text-[#F5F5F5]', CARD, SOFT)}>
                <Bot className="h-8 w-8" />
              </div>
            }
          />
          <h2 className="mt-4 text-lg font-bold text-[#1E1E1E] dark:text-[#F5F5F5]">
            Bonjour {profile?.first_name || ''} 👋
          </h2>
          <p className="mt-1 max-w-xs text-[16px] text-[#5A5A5A] dark:text-[#CDCDCD]">
            Je suis Mola, ton directeur des opérations. Pose-moi une question sur la plateforme — clients, dépôts, paiements, taux, statistiques.
            Tu peux écrire, <span className="font-semibold text-[#1E1E1E] dark:text-[#F5F5F5]">dicter avec le micro du clavier</span>,
            ou <span className="font-semibold text-[#1E1E1E] dark:text-[#F5F5F5]">joindre une capture ou un PDF</span> (📎).
          </p>
          <div className="mt-6 grid w-full max-w-sm grid-cols-1 gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className={cn('rounded-lg px-4 py-3 text-left text-[16px] font-medium text-[#1E1E1E] transition-colors active:bg-[#F5F5F5] dark:text-[#F5F5F5] dark:active:bg-[#383838]', CARD, SOFT)}
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
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center self-end rounded-full bg-[#F5F5F5] text-[#1E1E1E] dark:bg-[#383838] dark:text-[#F5F5F5]">
                        <Bot className="h-4 w-4" />
                      </div>
                    }
                  />
                )}
              <div
                className={cn(
                  'max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-4 py-2.5 text-[16px] leading-relaxed',
                  m.role === 'user'
                    ? 'rounded-br-md bg-[#2C2C2C] text-white dark:bg-[#383838]'
                    : m.error
                      ? 'rounded-bl-md bg-[#FDD3D0] text-[#900B09] dark:bg-[#900B09] dark:text-[#FDD3D0]'
                      : cn('rounded-bl-md text-[#1E1E1E] dark:text-[#F5F5F5]', CARD, SOFT),
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
                          className="overflow-hidden rounded-lg transition active:scale-95"
                        >
                          <img src={a.url} alt={a.name} className="h-24 w-24 object-cover" />
                        </button>
                      ) : (
                        <div key={i} className="flex items-center gap-2 rounded-lg bg-black/5 px-3 py-2 text-[16px] dark:bg-white/10">
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
                  className={cn('group relative block max-w-[85%] overflow-hidden rounded-lg text-left transition active:scale-[0.99]', CARD, SOFT)}
                >
                  <img src={img.url} alt={img.name} className="h-auto w-full" />
                  <div className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm">
                    <Maximize2 className="h-4 w-4" />
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 text-[16px] text-[#5A5A5A] dark:text-[#CDCDCD]">
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
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F5F5F5] text-[#1E1E1E] dark:bg-[#383838] dark:text-[#F5F5F5]">
                    <Bot className="h-4 w-4" />
                  </div>
                }
              />
              <div className={cn('flex items-center gap-2 rounded-lg rounded-bl-md px-4 py-3 text-[#5A5A5A] dark:text-[#CDCDCD]', CARD, SOFT)}>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-[16px]">Mola réfléchit…</span>
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
      <div className={cn('mx-auto flex h-[calc(100vh-120px)] min-h-[560px] max-w-3xl flex-col overflow-hidden rounded-lg shadow-[0_8px_30px_-12px_rgba(46,32,92,0.22)] ring-1 ring-black/[0.05] dark:shadow-none dark:ring-white/[0.06]', CANVAS)}>
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

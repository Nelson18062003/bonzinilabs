import { useEffect, useRef, useState } from 'react';
import { Send, Bot, Loader2, Paperclip, X, FileText, Check, Loader, AlertTriangle, SquarePen } from 'lucide-react';
import { toast } from 'sonner';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { ViewportShell } from '@/components/layout/ViewportShell';
import { useAdminAssistant, type AssistantProposal } from '@/hooks/useAdminAssistant';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { validateUploadFile, cn } from '@/lib/utils';

const SUGGESTIONS = [
  'Volume de la semaine ?',
  'Derniers dépôts en attente',
  'Taux Alipay du jour',
  'Paiements en cours',
];

// Dégradé d'identité (3 couleurs du logo : violet → orange)
const BRAND_GRADIENT = 'bg-gradient-to-br from-[hsl(258,100%,60%)] to-[hsl(16,100%,55%)]';
const MAX_FILES = 5;
// Hauteur max du champ de saisie avant qu'il ne défile lui-même (≈ 5 lignes).
const COMPOSER_MAX_H = 128;

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

// Carte de confirmation d'une action sensible (créer/valider dépôt, paiement, taux…)
function ConfirmationCard({
  proposal,
  onConfirm,
  onCancel,
}: {
  proposal: AssistantProposal;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { summary, state } = proposal;
  const accent = summary.danger ? 'hsl(16,100%,55%)' : 'hsl(258,100%,60%)';

  return (
    <div
      className="w-full max-w-[92%] rounded-2xl border border-border bg-card overflow-hidden shadow-sm"
      style={{ borderLeftWidth: 4, borderLeftColor: accent }}
    >
      <div className="px-4 pt-3 pb-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          {summary.danger ? 'Action sensible' : 'À confirmer'}
        </p>
        <p className="font-semibold text-[15px]">{summary.title}</p>
        {summary.subtitle && <p className="text-xs text-muted-foreground mt-0.5">{summary.subtitle}</p>}
      </div>

      {summary.amount && (
        <div className="px-4 pb-1">
          <span className="text-2xl font-extrabold tracking-tight">{summary.amount}</span>
        </div>
      )}

      <div className="px-4 py-2 space-y-1.5">
        {summary.lines.map((l, i) => (
          <div key={i} className="flex items-center justify-between gap-3 text-[13px]">
            <span className="text-muted-foreground shrink-0">{l.label}</span>
            <span className="font-medium text-right">{l.value}</span>
          </div>
        ))}
      </div>

      {/* Zone d'action / état */}
      {state === 'pending' && (
        <div className="flex gap-2 p-3">
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl py-3 text-sm font-bold text-white"
            style={{ background: `linear-gradient(135deg, ${accent}, hsl(16,100%,55%))` }}
          >
            {summary.confirmLabel}
          </button>
          <button onClick={onCancel} className="px-4 rounded-xl py-3 text-sm font-semibold bg-muted text-foreground">
            Annuler
          </button>
        </div>
      )}
      {state === 'executing' && (
        <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
          <Loader className="w-4 h-4 animate-spin" /> Exécution…
        </div>
      )}
      {state === 'done' && (
        <div className="flex items-center gap-2 p-3 text-sm font-medium text-green-600 dark:text-green-400">
          <Check className="w-4 h-4" /> {proposal.resultText || 'Action exécutée'}
        </div>
      )}
      {state === 'cancelled' && (
        <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
          <X className="w-4 h-4" /> Action annulée
        </div>
      )}
      {state === 'failed' && (
        <div className="flex items-center gap-2 p-3 text-sm text-destructive">
          <AlertTriangle className="w-4 h-4" /> {proposal.resultText || 'Échec'}
        </div>
      )}
    </div>
  );
}

export function MobileAssistantScreen() {
  const { profile } = useAdminAuth();
  const { messages, isLoading, sendMessage, confirmProposal, cancelProposal, reset, loadHistory } = useAdminAssistant();
  const [input, setInput] = useState('');
  const [pending, setPending] = useState<PendingFile[]>([]);
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
    <MobileHeader
      title="Mola"
      subtitle="Directeur des Opérations"
      showBack
      rightElement={
        <button
          onClick={handleNew}
          aria-label="Nouvelle conversation"
          className="flex items-center justify-center w-10 h-10 -mr-2 rounded-full active:bg-muted transition-colors"
        >
          <SquarePen className="w-5 h-5" />
        </button>
      }
    />
  );

  const composer = (
    <div className="border-t border-border bg-background px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
      {/* Plateau d'aperçu des pièces jointes en attente */}
      {pending.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {pending.map((p) => (
            <div key={p.id} className="relative shrink-0">
              {p.isPdf ? (
                <div className="w-16 h-16 rounded-lg border border-border bg-muted flex flex-col items-center justify-center px-1 text-[10px] text-muted-foreground">
                  <FileText className="w-5 h-5 mb-1" />
                  <span className="truncate max-w-[56px]">{p.file.name}</span>
                </div>
              ) : (
                <img src={p.url} alt={p.file.name} className="w-16 h-16 object-cover rounded-lg border border-border" />
              )}
              <button
                onClick={() => removePending(p.id)}
                aria-label="Retirer"
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-foreground text-background flex items-center justify-center"
              >
                <X className="w-3 h-3" />
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
          className="w-11 h-11 rounded-full flex items-center justify-center bg-muted text-foreground shrink-0 active:bg-muted/70 disabled:opacity-40"
        >
          <Paperclip className="w-5 h-5" />
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
          className="flex-1 resize-none max-h-32 px-4 py-3 rounded-2xl bg-muted text-[16px] outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground"
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Envoyer"
          className={cn(
            'w-11 h-11 rounded-full flex items-center justify-center text-white shrink-0 transition-opacity',
            BRAND_GRADIENT,
            (!canSend) && 'opacity-40',
          )}
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );

  return (
    <ViewportShell header={header} footer={composer} scrollRef={scrollRef} scrollClassName="px-4 py-4">
      {isEmpty ? (
        <div className="flex flex-col items-center text-center pt-10">
          <div className={cn('w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg', BRAND_GRADIENT)}>
            <Bot className="w-8 h-8" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">
            Bonjour {profile?.first_name || ''} 👋
          </h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-xs">
            Je suis Mola, ton directeur des opérations. Pose-moi une question sur la plateforme — clients, dépôts, paiements, taux, statistiques.
            Tu peux écrire, <span className="font-medium text-foreground">dicter avec le micro du clavier</span>,
            ou <span className="font-medium text-foreground">joindre une capture ou un PDF</span> (📎).
          </p>
          <div className="mt-6 grid grid-cols-1 gap-2 w-full max-w-sm">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="text-left text-sm px-4 py-3 rounded-xl border border-border bg-card active:bg-muted transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((m) => (
            <div key={m.id} className={cn('flex flex-col gap-2', m.role === 'user' ? 'items-end' : 'items-start')}>
              <div
                className={cn(
                  'max-w-[85%] px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap break-words rounded-2xl',
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : m.error
                      ? 'bg-destructive/10 text-destructive rounded-bl-md'
                      : 'bg-muted text-foreground rounded-bl-md',
                )}
              >
                {m.attachments?.length ? (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {m.attachments.map((a, i) =>
                      a.kind === 'image' && a.url ? (
                        <img
                          key={i}
                          src={a.url}
                          alt={a.name}
                          className="w-24 h-24 object-cover rounded-lg border border-black/10"
                        />
                      ) : (
                        <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background/40 border border-black/10 text-xs">
                          <FileText className="w-4 h-4 shrink-0" />
                          <span className="truncate max-w-[140px]">{a.name}</span>
                        </div>
                      ),
                    )}
                  </div>
                ) : null}
                {m.text && <RichText text={m.text} />}
              </div>
              {m.images?.map((img, i) => (
                <a
                  key={i}
                  href={img.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={img.name}
                  className="block max-w-[85%] rounded-2xl overflow-hidden border border-border bg-card"
                >
                  <img src={img.url} alt={img.name} className="w-full h-auto" />
                  <div className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5" /> {img.name} — appuyer pour ouvrir / télécharger
                  </div>
                </a>
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
            <div className="flex justify-start">
              <div className="bg-muted text-muted-foreground rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Mola réfléchit…</span>
              </div>
            </div>
          )}
        </div>
      )}
    </ViewportShell>
  );
}

import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useLatestMacroSnapshot, useRecentBriefs, useRecentTrumpPosts, useLatestPrediction } from '@/hooks/useMacroBriefs';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { TrendingUp, TrendingDown, Minus, Loader2, AlertCircle, Newspaper } from 'lucide-react';

export function MobileBriefsScreen() {
  const { data: macro, isLoading: loadingMacro } = useLatestMacroSnapshot();
  const { data: briefs, isLoading: loadingBriefs } = useRecentBriefs(3);
  const { data: trumpPosts, isLoading: loadingTrump } = useRecentTrumpPosts(5);
  const { data: prediction } = useLatestPrediction();

  const fmt = (n: number | null | undefined, d = 2) =>
    n === null || n === undefined || !Number.isFinite(n)
      ? '—'
      : n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });

  return (
    <div className="flex flex-col min-h-full">
      <MobileHeader title="Veille macro" backTo="/m/more" />

      <div className="flex-1 px-4 py-4 space-y-4">
        {/* Prédiction IA */}
        {prediction && (
          <div className="rounded-2xl border-2 border-purple-600/20 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wide">
                Prédiction IA · 24h
              </div>
              <span className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(prediction.created_at), { locale: fr, addSuffix: true })}
              </span>
            </div>
            <div className="flex items-center gap-3 mb-3">
              <div className="text-3xl font-extrabold text-purple-700 dark:text-purple-300">
                {prediction.predicted_rate.toLocaleString('fr-FR')}
              </div>
              <div className={`flex items-center gap-1 text-sm font-bold ${
                prediction.direction === 'up' ? 'text-green-600' :
                prediction.direction === 'down' ? 'text-red-600' : 'text-muted-foreground'
              }`}>
                {prediction.direction === 'up' && <TrendingUp className="w-4 h-4" />}
                {prediction.direction === 'down' && <TrendingDown className="w-4 h-4" />}
                {prediction.direction === 'flat' && <Minus className="w-4 h-4" />}
                {(prediction.predicted_rate - prediction.current_rate >= 0 ? '+' : '')}
                {prediction.predicted_rate - prediction.current_rate}
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground mb-2">
              Confiance : {(prediction.confidence * 100).toFixed(0)}% · Taux actuel : {prediction.current_rate.toLocaleString('fr-FR')}
            </div>
            {prediction.reasoning && (
              <div className="text-xs text-foreground/80 leading-relaxed mb-3">
                {prediction.reasoning}
              </div>
            )}
            {prediction.action_recommended && (
              <div className="text-xs font-semibold bg-purple-600/10 dark:bg-purple-400/20 text-purple-700 dark:text-purple-300 rounded-lg px-3 py-2">
                🎯 {prediction.action_recommended}
              </div>
            )}
          </div>
        )}

        {/* Snapshot macro */}
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Macro · dernier snapshot
            </div>
            {loadingMacro && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
            {macro && (
              <span className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(macro.captured_at), { locale: fr, addSuffix: true })}
              </span>
            )}
          </div>
          {macro ? (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-muted/50 rounded-lg p-2.5">
                <div className="text-[10px] uppercase text-muted-foreground">🛢 Brent</div>
                <div className="font-bold">{fmt(macro.oil_brent)} $</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-2.5">
                <div className="text-[10px] uppercase text-muted-foreground">💵 DXY</div>
                <div className="font-bold">{fmt(macro.dxy)}</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-2.5">
                <div className="text-[10px] uppercase text-muted-foreground">🇪🇺 EUR/USD</div>
                <div className="font-bold">{fmt(macro.eur_usd, 4)}</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-2.5">
                <div className="text-[10px] uppercase text-muted-foreground">🇨🇳 USD/CNY</div>
                <div className="font-bold">{fmt(macro.cny_usd, 4)}</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-2.5">
                <div className="text-[10px] uppercase text-muted-foreground">₿ BTC</div>
                <div className="font-bold">{macro.btc_usd ? Math.round(macro.btc_usd).toLocaleString('fr-FR') : '—'} $</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-2.5">
                <div className="text-[10px] uppercase text-muted-foreground">🛢 WTI</div>
                <div className="font-bold">{fmt(macro.oil_wti)} $</div>
              </div>
            </div>
          ) : !loadingMacro ? (
            <div className="text-xs text-muted-foreground py-4 text-center">
              Aucun snapshot. Lance fetch-macro pour démarrer.
            </div>
          ) : null}
        </div>

        {/* Posts Trump */}
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              🇺🇸 Trump · derniers posts Iran
            </div>
            {loadingTrump && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
          </div>
          {trumpPosts && trumpPosts.length > 0 ? (
            <div className="space-y-2.5">
              {trumpPosts.map((p) => (
                <div key={p.id} className="border-l-2 border-red-500/50 pl-3 py-1">
                  <div className="text-[10px] text-muted-foreground mb-1">
                    {format(new Date(p.posted_at), 'dd/MM HH:mm', { locale: fr })}
                  </div>
                  <div className="text-xs leading-relaxed whitespace-pre-wrap">
                    {p.content.slice(0, 280)}{p.content.length > 280 ? '…' : ''}
                  </div>
                </div>
              ))}
            </div>
          ) : !loadingTrump ? (
            <div className="text-xs text-muted-foreground py-4 text-center">
              Aucun post Iran récent.
            </div>
          ) : null}
        </div>

        {/* Headlines news */}
        {macro?.news_headlines && Array.isArray(macro.news_headlines) && macro.news_headlines.length > 0 && (
          <div className="rounded-2xl border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Newspaper className="w-4 h-4 text-muted-foreground" />
              <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                News · top {macro.news_headlines.length}
              </div>
            </div>
            <div className="space-y-2">
              {macro.news_headlines.slice(0, 6).map((h, i) => (
                <div key={i} className="text-xs leading-relaxed">
                  <span className="text-[10px] text-muted-foreground mr-1.5">[{h.source.replace('Google News (', '').replace(')', '')}]</span>
                  {h.title}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Briefs récents */}
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Briefs envoyés
            </div>
            {loadingBriefs && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
          </div>
          {briefs && briefs.length > 0 ? (
            <div className="space-y-2.5">
              {briefs.map((b) => (
                <div key={b.id} className="bg-muted/30 rounded-lg p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold uppercase">
                      {b.brief_type === 'morning' && '🌅 Matin'}
                      {b.brief_type === 'evening' && '🌆 Soir'}
                      {b.brief_type === 'alert' && '🚨 Alerte'}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(b.sent_at), { locale: fr, addSuffix: true })}
                    </span>
                  </div>
                  {!b.telegram_sent && (
                    <div className="flex items-center gap-1 text-[10px] text-red-600 mb-1">
                      <AlertCircle className="w-3 h-3" />
                      Échec Telegram : {b.telegram_error}
                    </div>
                  )}
                  <div className="text-[11px] text-muted-foreground line-clamp-3 whitespace-pre-line">
                    {b.message_text.slice(0, 200)}…
                  </div>
                </div>
              ))}
            </div>
          ) : !loadingBriefs ? (
            <div className="text-xs text-muted-foreground py-4 text-center">
              Aucun brief encore envoyé.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

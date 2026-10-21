/**
 * Veille macro — refonte v2 (maquette 10/64). La prédiction USD/CNY du
 * lendemain en gros, sa confiance et son conseil ; puis Brent, WTI, DXY,
 * EUR/USD, USD/CNY, BTC. « … » : le raisonnement, les posts Trump, les
 * actualités, les briefs envoyés. Lecture seule, mêmes hooks (useMacroBriefs).
 */
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Brain, Megaphone, Newspaper, Send } from 'lucide-react';
import { useLatestMacroSnapshot, useLatestPrediction, useRecentBriefs, useRecentTrumpPosts } from '@/hooks/useMacroBriefs';
import { cn } from '@/lib/utils';
import {
  ActionSheet, BottomSheet, EmptyLine, HeroFigure, Initials, ItemList, ItemRow, MoreButton, ScreenLoader, ScreenTop, Tag, TEXT, useSheet,
} from '@/mobile/designKit';

const fmt = (n: number | null | undefined, d = 2) =>
  n == null || !Number.isFinite(n) ? '—' : n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/\u202F/g, '\u00A0');
const ago = (iso: string) => formatDistanceToNow(new Date(iso), { locale: fr, addSuffix: true });

function Code({ text }: { text: string }) {
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F5F5F5] text-[14px] font-bold text-[#1E1E1E] dark:bg-[#383838] dark:text-[#F5F5F5]">{text}</span>
  );
}

export function BriefsV2() {
  const macro = useLatestMacroSnapshot();
  const prediction = useLatestPrediction();
  const briefs = useRecentBriefs(5);
  const posts = useRecentTrumpPosts(10);
  const more = useSheet();
  const why = useSheet();
  const postsSheet = useSheet();
  const newsSheet = useSheet();
  const briefsSheet = useSheet();
  const p = prediction.data;
  const m = macro.data;
  const when = m ? ago(m.captured_at) : undefined;
  const news = m?.news_headlines && Array.isArray(m.news_headlines) ? m.news_headlines : [];

  const rows = m ? [
    { code: 'BR', title: 'Brent', value: `${fmt(m.oil_brent)} $` },
    { code: 'WTI', title: 'WTI', value: `${fmt(m.oil_wti)} $` },
    { code: 'DXY', title: 'DXY', value: fmt(m.dxy, 1) },
    { code: '€/$', title: 'EUR/USD', value: fmt(m.eur_usd, 4) },
    { code: '¥/$', title: 'USD/CNY', value: fmt(m.cny_usd, 4) },
    { code: '₿', title: 'BTC', value: `${m.btc_usd ? Math.round(m.btc_usd).toLocaleString('fr-FR').replace(/\u202F/g, '\u00A0') : '—'} $` },
  ] : [];

  return (
    <div className="flex min-h-full flex-col pb-10">
      <ScreenTop title="Veille macro" right={<MoreButton onClick={more.show} />} />
      {p && (
        <div className="px-5 pt-5">
          <HeroFigure
            label="USD/CNY · demain"
            value={fmt(p.predicted_rate, 3)}
            sub={[
              <>Confiance <b className="font-bold">{Math.round(p.confidence * 100)} %</b></>,
              ...(p.action_recommended ? [<Tag key="a" tone="neutral">{p.action_recommended.length > 28 ? `${p.action_recommended.slice(0, 26)}…` : p.action_recommended}</Tag>] : []),
            ]}
            onClick={why.show}
          />
        </div>
      )}
      {macro.isLoading ? (
        <ScreenLoader />
      ) : !m ? (
        <EmptyLine>Aucune donnée macro pour l'instant.</EmptyLine>
      ) : (
        <ItemList className="pt-3">
          {rows.map((r) => (
            <ItemRow key={r.title} leading={<Code text={r.code} />} title={r.title} subtitle={when} amount={r.value} />
          ))}
        </ItemList>
      )}

      <ActionSheet
        open={more.open}
        onClose={more.hide}
        actions={[
          { label: 'Le raisonnement', icon: Brain, onClick: why.show, hidden: !p },
          { label: 'Posts Trump · Iran', icon: Megaphone, onClick: postsSheet.show },
          { label: 'Actualités', hint: news.length ? `${news.length}` : undefined, icon: Newspaper, onClick: newsSheet.show, hidden: news.length === 0 },
          { label: 'Briefs envoyés', icon: Send, onClick: briefsSheet.show },
        ]}
      />
      <BottomSheet open={why.open} onClose={why.hide} title="Prédiction · 24 h">
        {p && (
          <div className="space-y-3">
            <p className={cn('text-[17px]', TEXT.body)}>Taux actuel <b>{fmt(p.current_rate, 4)}</b> · prévu <b>{fmt(p.predicted_rate, 4)}</b> · {ago(p.created_at)}</p>
            {p.reasoning && <p className={cn('whitespace-pre-line text-[16px] leading-relaxed', TEXT.body)}>{p.reasoning}</p>}
            {p.action_recommended && <p className={cn('text-[17px] font-semibold', TEXT.strong)}>{p.action_recommended}</p>}
          </div>
        )}
      </BottomSheet>
      <BottomSheet open={postsSheet.open} onClose={postsSheet.hide} title="Posts Trump · Iran">
        {(posts.data ?? []).length === 0 ? <p className={cn('text-[16px]', TEXT.muted)}>Aucun post récent.</p> : (
          <div>
            {(posts.data ?? []).map((t) => (
              <div key={t.id} className="border-b border-[#D9D9D9] py-3 last:border-b-0 dark:border-[#444444]">
                <div className={cn('text-[15px]', TEXT.muted)}>{ago(t.posted_at)}</div>
                <p className={cn('mt-1 whitespace-pre-wrap text-[16px] leading-relaxed', TEXT.body)}>{t.content.slice(0, 400)}{t.content.length > 400 ? '…' : ''}</p>
              </div>
            ))}
          </div>
        )}
      </BottomSheet>
      <BottomSheet open={newsSheet.open} onClose={newsSheet.hide} title="Actualités">
        <div>
          {news.slice(0, 12).map((h, i) => (
            <a key={i} href={h.link} target="_blank" rel="noreferrer" className="block border-b border-[#D9D9D9] py-3 last:border-b-0 dark:border-[#444444]">
              <span className={cn('block text-[15px]', TEXT.muted)}>{h.source.replace('Google News (', '').replace(')', '')}</span>
              <span className={cn('block text-[16px] font-semibold leading-snug', TEXT.strong)}>{h.title}</span>
            </a>
          ))}
        </div>
      </BottomSheet>
      <BottomSheet open={briefsSheet.open} onClose={briefsSheet.hide} title="Briefs envoyés">
        {(briefs.data ?? []).length === 0 ? <p className={cn('text-[16px]', TEXT.muted)}>Aucun brief envoyé.</p> : (
          <div>
            {(briefs.data ?? []).map((b) => (
              <div key={b.id} className="border-b border-[#D9D9D9] py-3 last:border-b-0 dark:border-[#444444]">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2.5">
                    <Initials name={b.brief_type === 'morning' ? 'Matin' : b.brief_type === 'evening' ? 'Soir' : 'Alerte'} size={36} />
                    <span className={cn('text-[16px] font-semibold', TEXT.strong)}>{b.brief_type === 'morning' ? 'Matin' : b.brief_type === 'evening' ? 'Soir' : 'Alerte'}</span>
                  </span>
                  {b.telegram_sent ? <span className={cn('text-[15px]', TEXT.muted)}>{ago(b.sent_at)}</span> : <Tag tone="danger">Échec Telegram</Tag>}
                </div>
                <p className={cn('mt-2 line-clamp-4 whitespace-pre-line text-[16px]', TEXT.body)}>{b.message_text}</p>
              </div>
            ))}
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

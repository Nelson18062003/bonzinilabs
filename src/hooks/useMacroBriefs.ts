import { useQuery } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';

export interface MacroSnapshot {
  id: number;
  captured_at: string;
  oil_brent: number | null;
  oil_wti: number | null;
  dxy: number | null;
  eur_usd: number | null;
  cny_usd: number | null;
  btc_usd: number | null;
  eth_usd: number | null;
  news_headlines: Array<{ title: string; source: string; published_at: string; link: string }> | null;
  news_by_source: Record<string, Array<{ title: string; source: string; published_at: string; link: string }>> | null;
  trump_posts_recent: Array<{ posted_at: string; content: string; is_iran_related: boolean }> | null;
  expert_mentions: Record<string, Array<{ title: string; source: string; published_at: string }>> | null;
}

export interface BriefLog {
  id: string;
  sent_at: string;
  brief_type: 'morning' | 'evening' | 'alert';
  message_text: string;
  telegram_sent: boolean;
  telegram_error: string | null;
}

export interface TrumpPost {
  id: number;
  posted_at: string;
  content: string;
  is_iran_related: boolean;
  raw_link: string | null;
}

export interface RatePrediction {
  id: string;
  created_at: string;
  current_rate: number;
  predicted_rate: number;
  direction: 'up' | 'down' | 'flat';
  confidence: number;
  key_drivers: string[];
  reasoning: string;
  scenarios: {
    bullish: { rate: number; probability: number; trigger: string };
    base: { rate: number; probability: number; trigger: string };
    bearish: { rate: number; probability: number; trigger: string };
  };
  action_recommended: string;
  actual_rate: number | null;
  error_abs: number | null;
}

export function useLatestMacroSnapshot() {
  return useQuery({
    queryKey: ['macro-snapshot', 'latest'],
    queryFn: async () => {
      const { data, error } = await supabaseAdmin
        .from('macro_snapshots')
        .select('*')
        .order('captured_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as MacroSnapshot | null;
    },
    staleTime: 60_000,
  });
}

export function useRecentBriefs(limit = 5) {
  return useQuery({
    queryKey: ['briefs-log', limit],
    queryFn: async () => {
      const { data, error } = await supabaseAdmin
        .from('briefs_log')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as BriefLog[];
    },
    staleTime: 30_000,
  });
}

export function useRecentTrumpPosts(limit = 10) {
  return useQuery({
    queryKey: ['trump-posts', limit],
    queryFn: async () => {
      const { data, error } = await supabaseAdmin
        .from('trump_posts')
        .select('*')
        .eq('is_iran_related', true)
        .order('posted_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as TrumpPost[];
    },
    staleTime: 60_000,
  });
}

export function useLatestPrediction() {
  return useQuery({
    queryKey: ['rate-prediction', 'latest'],
    queryFn: async () => {
      const { data, error } = await supabaseAdmin
        .from('rate_predictions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as RatePrediction | null;
    },
    staleTime: 60_000,
  });
}

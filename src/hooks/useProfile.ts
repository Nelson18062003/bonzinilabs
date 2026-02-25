import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Profile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  avatar_url: string | null;
  date_of_birth: string | null;
  company_name: string | null;
  activity_sector: string | null;
  neighborhood: string | null;
  city: string | null;
  country: string | null;
  created_at: string;
  updated_at: string;
}

export function useMyProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-profile', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return data as Profile;
    },
    enabled: !!user,
  });
}

export function useProfileByUserId(userId: string | undefined) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return data as Profile;
    },
    enabled: !!userId,
  });
}

export function useAllProfiles() {
  return useQuery({
    queryKey: ['all-profiles'],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;
      if (!profiles) return [];

      const { data: wallets, error: walletsError } = await supabase
        .from('wallets')
        .select('*');

      if (walletsError) throw walletsError;

      const walletMap = new Map(wallets?.map(w => [w.user_id, w]) || []);

      return profiles.map(profile => ({
        ...profile,
        wallet: walletMap.get(profile.user_id) || null,
      }));
    },
  });
}

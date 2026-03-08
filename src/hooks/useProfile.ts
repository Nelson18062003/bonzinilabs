import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Profile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
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
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        user_id: data.user_id,
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone: data.phone,
        avatar_url: data.avatar_url,
        date_of_birth: data.date_of_birth,
        company_name: data.company_name,
        activity_sector: data.activity_sector,
        neighborhood: data.neighborhood,
        city: data.city,
        country: data.country,
        created_at: data.created_at,
        updated_at: data.updated_at,
      } as Profile;
    },
    enabled: !!user,
  });
}

// For admin: fetch client profile by user ID
export function useProfileByUserId(userId: string | undefined) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        user_id: data.user_id,
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone,
        avatar_url: data.avatar_url,
        date_of_birth: data.date_of_birth,
        company_name: data.company_name,
        activity_sector: data.activity_sector,
        neighborhood: data.neighborhood,
        city: data.city,
        country: data.country,
        created_at: data.created_at,
        updated_at: data.updated_at,
      } as Profile;
    },
    enabled: !!userId,
  });
}

// For admin: fetch all clients with wallets
export function useAllProfiles() {
  return useQuery({
    queryKey: ['all-profiles'],
    queryFn: async () => {
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (clientsError) throw clientsError;
      if (!clients) return [];

      // Fetch wallets
      const { data: wallets, error: walletsError } = await supabase
        .from('wallets')
        .select('*');

      if (walletsError) throw walletsError;

      const walletMap = new Map(wallets?.map(w => [w.user_id, w]) || []);

      return clients.map(client => ({
        id: client.id,
        user_id: client.user_id,
        first_name: client.first_name,
        last_name: client.last_name,
        phone: client.phone,
        avatar_url: client.avatar_url,
        date_of_birth: client.date_of_birth,
        company_name: client.company_name,
        activity_sector: client.activity_sector,
        neighborhood: client.neighborhood,
        city: client.city,
        country: client.country,
        created_at: client.created_at,
        updated_at: client.updated_at,
        wallet: walletMap.get(client.user_id) || null,
      }));
    },
  });
}

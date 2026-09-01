/**
 * Numéros WhatsApp d'un client — lecture et écriture.
 *
 * L'écriture passe par `admin_set_client_phones`, une RPC SECURITY DEFINER
 * gardée par `admin_has_permission(…, 'canManageUsers')`. Aucune politique
 * d'écriture n'existe sur `client_phones` : il n'y a donc pas d'autre
 * chemin, et cacher le bouton dans l'UI ne serait pas la protection.
 *
 * La RPC remplace le LOT complet et prend le premier élément comme numéro
 * principal. L'ordre du tableau porte donc le sens — pas de drapeau à
 * cocher côté client, donc pas de lot sans principal ni à deux principaux.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabaseAdmin } from '@/integrations/supabase/client';

export interface ClientPhone {
  id: string;
  phoneE164: string;
  countryIso: string | null;
  label: string | null;
  isPrimary: boolean;
}

/**
 * Un numéro tel qu'on l'envoie à la RPC.
 *
 * `type` et non `interface` : le paramètre est un `jsonb`, donc typé `Json`
 * côté client, et `Json` exige une signature d'index — qu'une `interface`
 * ne fournit pas, contrairement à un alias de type.
 */
export type ClientPhoneInput = {
  phone_e164: string;
  country_iso?: string | null;
  label?: string | null;
};

/**
 * `userId` — et non `clients.id`. Toute l'application appelle « identifiant
 * du client » son user_id : `admin_create_client` renvoie
 * `clientId = new_user_id`, et l'objet client du front porte
 * `id: client.user_id`. Passer ici la clé primaire de `clients` renverrait
 * une liste vide SANS erreur : l'exemple même de l'échec silencieux.
 */
export function useClientPhones(userId: string | undefined) {
  return useQuery<ClientPhone[]>({
    queryKey: ['client-phones', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      // Jointure interne plutôt que deux allers-retours : on filtre le
      // parent depuis l'enfant.
      const { data, error } = await supabaseAdmin
        .from('client_phones')
        .select('id, phone_e164, country_iso, label, is_primary, clients!inner(user_id)')
        .eq('clients.user_id', userId!)
        // Le principal d'abord, puis les autres dans leur ordre d'ajout.
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        phoneE164: r.phone_e164,
        countryIso: r.country_iso,
        label: r.label,
        isPrimary: r.is_primary,
      }));
    },
  });
}

export function useSetClientPhones() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, phones }: { userId: string; phones: ClientPhoneInput[] }) => {
      const { data, error } = await supabaseAdmin.rpc('admin_set_client_phones', {
        p_user_id: userId,
        p_phones: phones,
      });
      if (error) throw new Error(error.message);

      // La RPC renvoie `{success:false, error}` sur refus métier — elle ne
      // lève pas. Sans ce test, un refus d'autorisation passerait pour un
      // succès et l'écran afficherait des numéros qui ne sont pas en base.
      const result = data as { success?: boolean; error?: string } | null;
      if (!result?.success) throw new Error(result?.error || 'Enregistrement des numéros impossible');
      return result;
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['client-phones', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['admin-clients'] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
    },
  });
}

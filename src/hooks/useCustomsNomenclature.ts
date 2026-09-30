import { useQuery } from '@tanstack/react-query';
import { customsKeys } from '@/lib/queryKeys';
import { NOMENCLATURE_URL, parseNomenclature, type RawNomenclature } from '@/lib/customs/nomenclature';

/**
 * La nomenclature du simulateur de droits : un fichier statique versionné
 * (public/data/customs/), lu une fois et gardé pour la session. Aucune session
 * Supabase n'est nécessaire — le simulateur est public.
 */
export function useCustomsNomenclature() {
  return useQuery({
    queryKey: customsKeys.nomenclature(1),
    queryFn: async () => {
      const res = await fetch(NOMENCLATURE_URL);
      if (!res.ok) throw new Error(`nomenclature: HTTP ${res.status}`);
      return parseNomenclature((await res.json()) as RawNomenclature);
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 2,
  });
}

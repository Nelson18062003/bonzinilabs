import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabaseAdmin } from '@/integrations/supabase/client';
import type { CargoEvent, CargoShipment, CargoVesselPosition } from '@/lib/cargo/model';

// ⚠ Module ADMIN : tout passe par supabaseAdmin (voir .claude/rules/supabase-clients.md).

export function useCargoShipments() {
  return useQuery({
    queryKey: ['cargo', 'shipments'],
    queryFn: async () => {
      const { data, error } = await supabaseAdmin
        .from('cargo_shipments')
        .select('*')
        .order('eta_carrier', { ascending: true, nullsFirst: false })
        .order('eta_promised', { ascending: true });
      if (error) throw error;
      return (data ?? []) as CargoShipment[];
    },
    staleTime: 30_000,
  });
}

export function useCargoVesselPositions() {
  return useQuery({
    queryKey: ['cargo', 'positions'],
    queryFn: async () => {
      const { data, error } = await supabaseAdmin.from('cargo_vessel_positions').select('*');
      if (error) throw error;
      return (data ?? []) as CargoVesselPosition[];
    },
    staleTime: 30_000,
  });
}

export function useCargoEvents(shipmentId: string | null) {
  return useQuery({
    queryKey: ['cargo', 'events', shipmentId],
    enabled: !!shipmentId,
    queryFn: async () => {
      const { data, error } = await supabaseAdmin
        .from('cargo_events')
        .select('*')
        .eq('shipment_id', shipmentId!)
        .order('event_time', { ascending: true });
      if (error) throw error;
      return (data ?? []) as CargoEvent[];
    },
    staleTime: 30_000,
  });
}

/**
 * Bouton « Rafraîchir » : la RPC déclenche l'edge function via pg_net (on ne
 * peut pas l'invoquer depuis le front, cf. règle supabase-clients). La
 * synchronisation prend quelques secondes : on relit les données après.
 */
export function useRequestCargoSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabaseAdmin.rpc('request_cargo_sync');
      if (error) throw error;
      const res = data as { success?: boolean; error?: string } | null;
      if (res && res.success === false) throw new Error(res.error ?? 'Refus');
    },
    onSuccess: () => {
      toast.success('Synchronisation lancée — les données se mettent à jour dans quelques secondes');
      window.setTimeout(() => qc.invalidateQueries({ queryKey: ['cargo'] }), 8_000);
      window.setTimeout(() => qc.invalidateQueries({ queryKey: ['cargo'] }), 25_000);
    },
    onError: (e: Error) => toast.error(`Synchronisation impossible : ${e.message}`),
  });
}

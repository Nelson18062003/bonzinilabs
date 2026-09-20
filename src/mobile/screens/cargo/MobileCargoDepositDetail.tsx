// ============================================================
// Mobile admin — Cargo › un dépôt de colis, tel que le réceptionnaire l'a
// enregistré : le client, qui l'a apporté, qui l'a reçu, chaque colis avec
// sa photo, son poids, son volume, et où il en est (à l'entrepôt, ou chargé
// dans telle boîte). Un dépôt orphelin s'attribue d'ici.
// ============================================================
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Search, UserSearch } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAssignDeposit, useReceptionDeposit, useReceptionSearch } from '@/hooks/useReception';
import { clientFullName, formatCbm, formatKg, initials } from '@/lib/reception';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, BottomSheet, Button, Card, Holder, Row, ScreenError, ScreenLoader, StatusPill, TextInput } from '@/mobile/designKit';
import { LocationMark, ParcelRow, formatDateTime, useReceptionLabels } from '@/mobile/components/reception/bits';

export function MobileCargoDepositDetail() {
  const navigate = useNavigate();
  const { depositId } = useParams<{ depositId: string }>();
  const { hasPermission } = useAdminAuth();
  const labels = useReceptionLabels();
  const { data: deposit, isLoading, error, refetch } = useReceptionDeposit(depositId);
  const [assignOpen, setAssignOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => { const id = setTimeout(() => setDebounced(query), 250); return () => clearTimeout(id); }, [query]);
  const search = useReceptionSearch(assignOpen ? debounced : '');
  const assign = useAssignDeposit();

  if (!hasPermission('canViewCargo')) return <Navigate to="/m" replace />;
  if (isLoading) return <ScreenLoader className="min-h-[100dvh]" />;
  if (error || !deposit) return <ScreenError description={(error as Error | null)?.message ?? 'Dépôt introuvable'} onRetry={() => void refetch()} />;

  const name = deposit.client ? clientFullName(deposit.client) : 'Client à attribuer';
  const st = labels.status(deposit);
  const loaded = deposit.parcels.filter((p) => p.shipment_id);
  const waiting = deposit.parcels.length - loaded.length;

  return (
    <div className={cn('flex min-h-full flex-col', SURFACE.canvas)}>
      <MobileHeader title={deposit.deposit_no} subtitle={labels.location(deposit.location)} showBack backTo="/m/cargo/reception" />

      <div className="space-y-6 px-4 pb-10 pt-4">
        <Card className="space-y-4">
          <button type="button" disabled={!deposit.client} onClick={() => deposit.client && navigate(`/m/clients/${deposit.client.user_id}`)} className="flex w-full items-center gap-4 text-left">
            <Holder size="lg" tone={deposit.client ? 'neutral' : 'pending'}>{deposit.client ? initials(name) : '?'}</Holder>
            <span className="min-w-0 flex-1">
              <span className={cn('block', TYPE.bodyStrong, TEXT.strong)}>{name}</span>
              <span className={cn('mt-0.5 block', TYPE.small, TEXT.muted)}>
                {deposit.client ? [deposit.client.customer_code, deposit.client.phone, deposit.client.city].filter(Boolean).join(' · ') : "Personne ne sait encore à qui il est"}
              </span>
            </span>
            <StatusPill tone={st.tone} label={st.label} />
          </button>
          <div className={cn('border-t', SURFACE.divider)}>
            <Row label="Apporté par" value={<>{labels.broughtBy(deposit.brought_by)}{deposit.representative_name && <span className={cn('block font-normal', TYPE.small, TEXT.muted)}>{deposit.representative_name}{deposit.representative_phone ? ` · ${deposit.representative_phone}` : ''}</span>}</>} />
            <Row label="Mode" value={<span className="inline-flex items-center gap-2"><LocationMark location={deposit.location} size={24} />{labels.location(deposit.location)}</span>} />
            <Row label="Reçu le" value={formatDateTime(deposit.closed_at ?? deposit.opened_at)} />
            <Row label="Par" value={deposit.received_by_name ?? '—'} />
            <Row label="Total" value={`${deposit.parcels.length} colis · ${formatKg(deposit.total_weight_kg)} · ${formatCbm(deposit.total_cbm)}`} />
          </div>
          {!deposit.client && hasPermission('canReceiveParcels') && (
            <Button variant="primary" className="h-12 w-full" onClick={() => setAssignOpen(true)}><UserSearch /> Attribuer à un client</Button>
          )}
        </Card>

        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className={cn(TYPE.lead, TEXT.strong)}>Colis</h2>
            <span className={cn('tabular-nums', TYPE.small, TEXT.muted)}>
              {waiting > 0 && `${waiting} à l'entrepôt`}{waiting > 0 && loaded.length > 0 && ' · '}{loaded.length > 0 && `${loaded.length} chargés`}
            </span>
          </div>
          <Card className="py-0 [&>*]:border-b [&>*]:border-[#D9D9D9] [&>*:last-child]:border-b-0 dark:[&>*]:border-[#444444]">
            {deposit.parcels.map((p) => (
              <div key={p.id}>
                <ParcelRow parcel={p} />
                {p.shipment_id && (
                  <button type="button" onClick={() => navigate(`/m/cargo/${p.shipment_id}/dedans`)} className="-mt-2 mb-3 inline-flex">
                    <StatusPill tone="info" label={`Chargé · ${p.container_number ?? 'boîte'}`} className="h-7 text-[14px]" />
                  </button>
                )}
              </div>
            ))}
          </Card>
        </section>
      </div>

      <BottomSheet open={assignOpen} onClose={() => setAssignOpen(false)} title="Attribuer à un client">
        <div className="space-y-4">
          <div className="relative">
            <Search className={cn('pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2', TEXT.muted)} />
            <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nom, téléphone, BZ-…" className="h-12 pl-12" autoFocus />
          </div>
          {(search.data ?? []).map((c) => {
            const n = clientFullName(c);
            return (
              <button
                key={c.user_id}
                type="button"
                onClick={async () => {
                  await assign.mutateAsync({ depositId: deposit.id, clientUserId: c.user_id });
                  toast.success('Dépôt attribué', { description: n });
                  setAssignOpen(false);
                }}
                className={cn('flex w-full items-center gap-4 rounded-lg px-2 py-3 text-left', SURFACE.inset)}
              >
                <Holder>{initials(n)}</Holder>
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate', TYPE.bodyStrong, TEXT.strong)}>{n} <span className={cn('tabular-nums', TYPE.small, TEXT.muted)}>{c.customer_code}</span></span>
                  <span className={cn('block truncate', TYPE.small, TEXT.muted)}>{[c.phone, c.city].filter(Boolean).join(' · ')}</span>
                </span>
              </button>
            );
          })}
        </div>
      </BottomSheet>
    </div>
  );
}

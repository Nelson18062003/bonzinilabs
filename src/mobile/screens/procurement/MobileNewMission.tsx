import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Search, Check, X } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useSearchClients } from '@/hooks/useClientManagement';
import { useCreateMission } from '@/hooks/useProcurement';
import { FieldLabel, PrimaryPill, SOFT_CARD } from '@/components/treasury/ui';
import { cn } from '@/lib/utils';

const INPUT = 'h-[52px] w-full rounded-2xl bg-muted/60 px-4 text-[15px] text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-foreground/10';

interface SelectedClient { id: string; name: string; phone: string }

export function MobileNewMission() {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const createMission = useCreateMission();

  const [search, setSearch] = useState('');
  const [client, setClient] = useState<SelectedClient | null>(null);
  const [label, setLabel] = useState('');
  const [location, setLocation] = useState('');
  const [startedOn, setStartedOn] = useState('');
  const [endedOn, setEndedOn] = useState('');
  const [note, setNote] = useState('');

  const { data: results } = useSearchClients(search);

  if (!hasPermission('canManageProcurement')) {
    return <Navigate to="/m/more/procurement" replace />;
  }

  const canSubmit = !!client && label.trim().length > 0 && !createMission.isPending;

  const handleSubmit = async () => {
    if (!client) return;
    try {
      const r = await createMission.mutateAsync({
        p_client_user_id: client.id,
        p_label: label.trim(),
        p_location: location.trim() || null,
        p_started_on: startedOn || null,
        p_ended_on: endedOn || null,
        p_summary_note: note.trim() || null,
      });
      navigate(`/m/more/procurement/missions/${r.mission_id}`, { replace: true });
    } catch {
      /* toast géré par le hook */
    }
  };

  return (
    <div className="flex flex-col min-h-full bg-background">
      <MobileHeader title="Nouvelle mission" showBack backTo="/m/more/procurement/missions" />

      <div className="px-5 py-6 space-y-5">
        {/* Client */}
        <div>
          <FieldLabel>Client *</FieldLabel>
          {client ? (
            <div className={cn(SOFT_CARD, 'flex items-center gap-3 p-3.5')}>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-bonzini-violet/15 text-bonzini-violet">
                <Check className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold text-foreground">{client.name}</div>
                <div className="truncate text-[12px] text-muted-foreground">{client.phone}</div>
              </div>
              <button onClick={() => setClient(null)} aria-label="Changer de client" className="text-muted-foreground active:opacity-70">
                <X className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher (nom, téléphone)…"
                  className={cn(INPUT, 'pl-11')}
                />
              </div>
              {search.length >= 2 && (
                <div className={cn(SOFT_CARD, 'mt-2 max-h-64 divide-y divide-border overflow-y-auto')}>
                  {(results ?? []).length === 0 ? (
                    <div className="p-3.5 text-[13px] text-muted-foreground">Aucun client trouvé.</div>
                  ) : (
                    (results ?? []).map((c) => (
                      <button
                        key={c.id}
                        onClick={() => { setClient({ id: c.id, name: `${c.firstName} ${c.lastName}`.trim(), phone: c.phone }); setSearch(''); }}
                        className="flex w-full items-center justify-between p-3.5 text-left active:bg-muted/50"
                      >
                        <span className="truncate text-[14px] font-medium text-foreground">{c.firstName} {c.lastName}</span>
                        <span className="ml-3 shrink-0 text-[12px] text-muted-foreground">{c.phone}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Libellé */}
        <div>
          <FieldLabel>Libellé de la mission *</FieldLabel>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. Sourcing Yiwu — mai 2026" className={INPUT} />
        </div>

        {/* Lieu */}
        <div>
          <FieldLabel>Lieu</FieldLabel>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ex. Guangzhou / Yiwu" className={INPUT} />
        </div>

        {/* Dates */}
        <div className="flex gap-3">
          <div className="flex-1">
            <FieldLabel>Début</FieldLabel>
            <input type="date" value={startedOn} onChange={(e) => setStartedOn(e.target.value)} className={INPUT} />
          </div>
          <div className="flex-1">
            <FieldLabel>Fin</FieldLabel>
            <input type="date" value={endedOn} onChange={(e) => setEndedOn(e.target.value)} className={INPUT} />
          </div>
        </div>

        {/* Note */}
        <div>
          <FieldLabel>Note</FieldLabel>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Contexte, objectif…" rows={3}
            className={cn(INPUT, 'h-auto py-3 leading-relaxed')} />
        </div>

        <PrimaryPill onClick={handleSubmit} disabled={!canSubmit} loading={createMission.isPending} type="button">
          Créer la mission
        </PrimaryPill>
      </div>
    </div>
  );
}

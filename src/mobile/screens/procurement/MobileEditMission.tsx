import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useMissionReport, useUpdateMission } from '@/hooks/useProcurement';
import type { ProcMissionStatus } from '@/integrations/supabase/procurement';
import { FieldLabel, Pill, PrimaryPill } from '@/components/treasury/ui';
import { PROC_INPUT as INPUT, MISSION_STATUS_OPTIONS } from './shared';
import { cn } from '@/lib/utils';

export function MobileEditMission() {
  const navigate = useNavigate();
  const { missionId } = useParams<{ missionId: string }>();
  const { hasPermission } = useAdminAuth();
  const { data } = useMissionReport(missionId);
  const updateMission = useUpdateMission();

  const [label, setLabel] = useState('');
  const [location, setLocation] = useState('');
  const [startedOn, setStartedOn] = useState('');
  const [endedOn, setEndedOn] = useState('');
  const [status, setStatus] = useState<ProcMissionStatus>('active');
  const [note, setNote] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (data?.mission && !loaded) {
      const m = data.mission;
      setLabel(m.label);
      setLocation(m.location ?? '');
      setStartedOn(m.started_on ?? '');
      setEndedOn(m.ended_on ?? '');
      setStatus(m.status);
      setNote(m.summary_note ?? '');
      setLoaded(true);
    }
  }, [data, loaded]);

  if (!hasPermission('canManageProcurement') || !missionId) {
    return <Navigate to="/m/more/procurement" replace />;
  }

  const handleSubmit = async () => {
    try {
      await updateMission.mutateAsync({
        p_mission_id: missionId,
        p_label: label.trim() || null,
        p_location: location.trim() || null,
        p_started_on: startedOn || null,
        p_ended_on: endedOn || null,
        p_status: status,
        p_summary_note: note.trim() || null,
      });
      navigate(`/m/more/procurement/missions/${missionId}`, { replace: true });
    } catch { /* toast */ }
  };

  return (
    <div className="flex flex-col min-h-full bg-background">
      <MobileHeader title="Modifier la mission" showBack backTo={`/m/more/procurement/missions/${missionId}`} />
      <div className="px-5 py-6 space-y-5">
        <div><FieldLabel>Libellé</FieldLabel><input value={label} onChange={(e) => setLabel(e.target.value)} className={INPUT} /></div>
        <div><FieldLabel>Lieu</FieldLabel><input value={location} onChange={(e) => setLocation(e.target.value)} className={INPUT} /></div>
        <div className="flex gap-3">
          <div className="flex-1"><FieldLabel>Début</FieldLabel><input type="date" value={startedOn} onChange={(e) => setStartedOn(e.target.value)} className={INPUT} /></div>
          <div className="flex-1"><FieldLabel>Fin</FieldLabel><input type="date" value={endedOn} onChange={(e) => setEndedOn(e.target.value)} className={INPUT} /></div>
        </div>
        <div>
          <FieldLabel>Statut</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {MISSION_STATUS_OPTIONS.map((x) => <Pill key={x.value} active={status === x.value} onClick={() => setStatus(x.value)}>{x.label}</Pill>)}
          </div>
        </div>
        <div><FieldLabel>Note</FieldLabel><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={cn(INPUT, 'h-auto py-3 leading-relaxed')} /></div>
        <PrimaryPill onClick={handleSubmit} disabled={label.trim().length === 0 || updateMission.isPending} loading={updateMission.isPending} type="button">
          Enregistrer
        </PrimaryPill>
      </div>
    </div>
  );
}

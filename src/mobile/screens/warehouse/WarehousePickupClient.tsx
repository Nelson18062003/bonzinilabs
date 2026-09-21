// ============================================================
// ENTREPÔT — Le client est là. Ses colis prêts (cochés d'office), ce qui
// n'est pas encore arrivé, et ce qui BLOQUE : un devis non soldé. L'agent
// encaisse sur place (même feuille que l'admin, lieu Douala), puis
// « Remettre n colis » : qui emporte, sa signature, et le bon de retrait.
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SignaturePad from 'react-signature-canvas';
import { Banknote, Check, Eraser, PackageCheck } from 'lucide-react';
import { toast } from 'sonner';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { UnknownCodeError, UnpaidError, uploadSignature, useClientAtWarehouse, useReleaseParcels } from '@/hooks/useWarehouse';
import { useCargoQuote } from '@/hooks/useCargoQuote';
import { useAdminShippingSettings } from '@/hooks/useShippingSettings';
import { DEFAULT_SHIPPING_SETTINGS } from '@/lib/customerCode';
import { quoteWord, releaseBlockers, transportLabel, warehouseStage, type ClientQuoteSummary } from '@/lib/warehouse';
import { xaf } from '@/lib/cargoQuote';
import { clientFullName, formatDims, formatKg, initials } from '@/lib/reception';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, BottomSheet, Card, FormField, Holder, PrimaryPill, ScreenError, ScreenLoader, SoftPill, StatusPill, TextInput } from '@/mobile/designKit';
import { TextArea } from '@/components/form';
import { QuotePayments } from '@/mobile/screens/cargo/QuotePayments';
import { useReceptionLabels } from '@/mobile/components/reception/bits';

const BOX = (on: boolean) => cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md border-2', on ? 'border-[#2C2C2C] bg-[#2C2C2C] text-white dark:border-[#E3E3E3] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]' : 'border-[#949494]');

/** La feuille « Encaisser » de l'admin, ici pour un devis : on la charge, on encaisse, la liste se rafraîchit. */
function PaySheet({ quote, open, onClose }: { quote: ClientQuoteSummary | null; open: boolean; onClose: () => void }) {
  const { data: q, isLoading } = useCargoQuote(quote?.deposit_id);
  const { data: settings } = useAdminShippingSettings();
  const [request, setRequest] = useState<{ kind: 'pay'; n: number } | null>(null);
  useEffect(() => { if (open && q && quote) setRequest({ kind: 'pay', n: Date.now() }); }, [open, q?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <BottomSheet open={open} onClose={onClose} title={quote ? `Devis ${quote.quote_no} · ${quote.deposit_no}` : 'Encaisser'}>
      {isLoading || !q ? <ScreenLoader /> : <QuotePayments quote={q} settings={settings ?? DEFAULT_SHIPPING_SETTINGS} request={request} />}
    </BottomSheet>
  );
}

export function WarehousePickupClient() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const { hasPermission } = useAdminAuth();
  const labels = useReceptionLabels();
  const { data, isLoading, error, refetch } = useClientAtWarehouse(code);
  const release = useReleaseParcels();
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [paying, setPaying] = useState<ClientQuoteSummary | null>(null);
  const [handing, setHanding] = useState(false);
  const [who, setWho] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [sigEmpty, setSigEmpty] = useState(true);
  const [saving, setSaving] = useState(false);
  const sig = useRef<SignaturePad>(null);

  const ready = useMemo(() => data?.ready ?? [], [data]);
  useEffect(() => { if (data && picked === null) setPicked(new Set(ready.map((p) => p.id))); }, [data, ready, picked]);

  if (isLoading) return <ScreenLoader className="min-h-[100dvh]" />;
  if (error instanceof UnknownCodeError) return <ScreenError title="Client inconnu" description={`Aucun client ne porte le code ${error.code || code}.`} onRetry={() => navigate('/w/remise')} retryLabel="Scanner à nouveau" />;
  if (error || !data) return <ScreenError description={(error as Error | null)?.message ?? 'Client introuvable'} onRetry={() => void refetch()} />;

  const client = data.client;
  const name = clientFullName(client);
  const chosen = ready.filter((p) => picked?.has(p.id));
  const blockers = releaseBlockers(chosen, data.quotes);
  const canRelease = hasPermission('canReleaseParcels');
  const canCollect = hasPermission('canCollectParcelPayments');
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s ?? []); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const kg = chosen.reduce((s, p) => s + Number(p.weight_kg ?? 0), 0);

  const submit = async () => {
    if (chosen.length === 0 || !who.trim()) return;
    setSaving(true);
    try {
      const signaturePath = sig.current && !sig.current.isEmpty() ? await uploadSignature(sig.current.toDataURL('image/png')) : null;
      const rel = await release.mutateAsync({ parcelIds: chosen.map((p) => p.id), pickedByName: who.trim(), pickedByPhone: phone.trim() || undefined, signaturePath, note: note.trim() || undefined });
      setHanding(false);
      navigate(`/w/bon/${rel.id}`, { replace: true, state: { signature: sig.current?.toDataURL('image/png') ?? null } });
    } catch (e) {
      if (e instanceof UnpaidError) toast.error('Remise bloquée', { description: e.message });
      else toast.error((e as Error).message);
    } finally { setSaving(false); }
  };

  return (
    <div className={cn('flex min-h-full flex-col', SURFACE.canvas)}>
      <MobileHeader title={name} subtitle={`${client.customer_code}${client.phone ? ` · ${client.phone}` : ''}`} showBack backTo="/w/remise" />
      <div className="space-y-5 px-4 pb-40 pt-4">
        <Card className="flex items-center gap-3">
          <Holder size="lg">{initials(name)}</Holder>
          <span className="min-w-0 flex-1">
            <span className={cn('block', TYPE.bodyStrong, TEXT.strong)}>{ready.length > 0 ? `${ready.length} colis prêt${ready.length > 1 ? 's' : ''} à remettre` : 'Rien de prêt à remettre'}</span>
            <span className={cn('block', TYPE.small, TEXT.muted)}>{data.not_ready.length > 0 ? `${data.not_ready.length} autre${data.not_ready.length > 1 ? 's' : ''} pas encore là` : 'Tout ce qui est arrivé est ici'}{data.releases.length > 0 ? ` · ${data.releases.length} retrait${data.releases.length > 1 ? 's' : ''} déjà fait${data.releases.length > 1 ? 's' : ''}` : ''}</span>
          </span>
        </Card>

        {/* Ce qui bloque : les devis à solder. */}
        {blockers.length > 0 && (
          <Card className="space-y-3 border-[#E8B931] bg-[#FFF1C2] dark:bg-[#522504]">
            <p className={cn(TYPE.bodyStrong, 'text-[#682D03] dark:text-[#FFF1C2]')}>Remise bloquée : {blockers.length > 1 ? 'des devis ne sont pas soldés' : 'le devis n\'est pas soldé'}.</p>
            {blockers.map((q) => (
              <div key={q.id} className="flex items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className={cn('block tabular-nums', TYPE.bodyStrong, 'text-[#682D03] dark:text-[#FFF1C2]')}>{q.deposit_no}{q.quote_no ? ` · ${q.quote_no}` : ''}</span>
                  <span className={cn('block tabular-nums', TYPE.small, 'text-[#682D03] dark:text-[#FFF1C2]')}>{q.total_xaf <= 0 ? 'Sans prix : Guangzhou doit poser le devis' : `Reste ${xaf(q.balance_xaf)} sur ${xaf(q.total_xaf)}`}</span>
                </span>
                {canCollect && q.total_xaf > 0 && <PrimaryPill onClick={() => setPaying(q)} className="h-11 px-4 text-[15px]"><Banknote /> Encaisser</PrimaryPill>}
              </div>
            ))}
          </Card>
        )}

        {ready.length > 0 && (
          <section>
            <h2 className={cn('mb-2', TYPE.lead, TEXT.strong)}>Prêts à remettre</h2>
            <Card className="py-0">
              {ready.map((p) => {
                const on = !!picked?.has(p.id);
                const qw = quoteWord(p);
                return (
                  <button key={p.id} type="button" onClick={() => toggle(p.id)} aria-pressed={on} className={cn('flex w-full items-center gap-3 border-b py-3 text-left last:border-b-0', SURFACE.divider)}>
                    <span className={BOX(on)}>{on && <Check className="h-5 w-5" strokeWidth={3} />}</span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block tabular-nums', TYPE.body, TEXT.strong)}><b>{p.parcel_no}</b> · {p.description || labels.kind(p.kind)}</span>
                      <span className={cn('block tabular-nums', TYPE.small, TEXT.muted)}>{formatKg(p.weight_kg)} · {formatDims(p)} · {transportLabel(p)}{p.warehouse_location ? ` · place ${p.warehouse_location}` : ''}{p.condition === 'damaged' ? ' · abîmé' : ''}</span>
                    </span>
                    <StatusPill tone={qw.ok ? 'success' : 'pending'} label={qw.text} />
                  </button>
                );
              })}
            </Card>
          </section>
        )}

        {data.not_ready.length > 0 && (
          <section>
            <h2 className={cn('mb-2', TYPE.lead, TEXT.strong)}>Pas encore là</h2>
            <Card className="py-0">
              {data.not_ready.map((p) => { const st = warehouseStage(p); return (
                <div key={p.id} className={cn('flex items-center gap-3 border-b py-3 last:border-b-0', SURFACE.divider)}>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block tabular-nums', TYPE.body, TEXT.strong)}><b>{p.parcel_no}</b> · {p.description || labels.kind(p.kind)}</span>
                    <span className={cn('block tabular-nums', TYPE.small, TEXT.muted)}>{transportLabel(p)}</span>
                  </span>
                  <StatusPill tone={st.tone} label={st.label} />
                </div>
              ); })}
            </Card>
          </section>
        )}
      </div>

      {canRelease && ready.length > 0 && (
        <div className={cn('fixed inset-x-0 bottom-0 z-30 space-y-2 border-t px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3', SURFACE.canvas, SURFACE.divider)}>
          <div className={cn('flex items-center justify-between', TYPE.body)}>
            <span className={TEXT.muted}>Sélection</span>
            <span className={cn('font-semibold tabular-nums', TEXT.strong)}>{chosen.length} colis · {formatKg(kg)}</span>
          </div>
          <PrimaryPill onClick={() => { setWho(name); setHanding(true); }} disabled={chosen.length === 0 || blockers.length > 0} className="h-14 w-full text-[17px]">
            <PackageCheck /> {blockers.length > 0 ? 'Encaissez d\'abord' : `Remettre ${chosen.length} colis`}
          </PrimaryPill>
        </div>
      )}

      <PaySheet quote={paying} open={paying !== null} onClose={() => { setPaying(null); void refetch(); }} />

      <BottomSheet open={handing} onClose={() => !saving && setHanding(false)} title={`Remettre ${chosen.length} colis`}>
        <div className="space-y-4">
          <FormField label="Qui emporte les colis" htmlFor="rl-who" hint="Le client, ou la personne qu'il envoie."><TextInput id="rl-who" value={who} onChange={(e) => setWho(e.target.value)} className="h-12" /></FormField>
          <FormField label="Son téléphone" htmlFor="rl-phone"><TextInput id="rl-phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="Facultatif" className="h-12" /></FormField>
          <FormField label="Signature" htmlFor="rl-sig" hint="Signez avec le doigt, dans le cadre.">
            <div className={cn('relative overflow-hidden rounded-lg border-2 border-dashed bg-white', SURFACE.divider)} style={{ height: 160 }}>
              <SignaturePad ref={sig} penColor="#1E1E1E" canvasProps={{ className: 'h-full w-full', style: { touchAction: 'none' } }} onEnd={() => setSigEmpty(!!sig.current?.isEmpty())} />
              {sigEmpty && <span className={cn('pointer-events-none absolute inset-0 flex items-center justify-center', TYPE.body, TEXT.muted)}>Signature de {who || 'la personne'}</span>}
              {!sigEmpty && <button type="button" onClick={() => { sig.current?.clear(); setSigEmpty(true); }} aria-label="Effacer" className={cn('absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full', SURFACE.holder)}><Eraser className="h-4 w-4" /></button>}
            </div>
          </FormField>
          <TextArea id="rl-note" label="Remarque" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Facultatif" controlClassName="min-h-[56px]" />
          <PrimaryPill onClick={() => void submit()} disabled={!who.trim()} loading={saving} className="h-14 w-full text-[17px]"><PackageCheck /> Confirmer la remise</PrimaryPill>
          <SoftPill onClick={() => setHanding(false)} className="h-11 w-full text-[15px]">Annuler</SoftPill>
        </div>
      </BottomSheet>
    </div>
  );
}

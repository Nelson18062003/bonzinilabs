// ============================================================
// ENTREPÔT — Remettre, étape 2 sur 3 : « Quels colis emporte-t-il ? » Le
// client en tête, ses colis prêts cochés d'office, ce qui n'est pas encore là
// replié. En bas, UNE phrase et UN bouton : « Remettre n colis » — ou, si un
// devis n'est pas soldé, « Encaisser d'abord », qui mène à l'écran de caisse.
// Rien ne sort sans être payé : la base le garantit, l'écran l'explique.
// Refonte v2 (maquette 04/16) : le client en carte, ses colis prêts en
// photos (un toucher décoche), le devis et le reste à payer ; « pas encore
// là », les paiements et reçus, les bons déjà faits s'ouvrent en feuilles.
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, FileSignature, Package, Receipt } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { UnknownCodeError, useClientAtWarehouse } from '@/hooks/useWarehouse';
import { nParcels, releaseBlockers, releaseWord, warehouseStage } from '@/lib/warehouse';
import { xaf } from '@/lib/cargoQuote';
import { clientFullName, formatKg } from '@/lib/reception';
import { cn } from '@/lib/utils';
import {
  BigButton, BottomSheet, Dock, EmptyLine, IconCircle, Initials, ItemList, ItemRow, KVBox, ScreenLoader, ScreenTop, SURFACE, TEXT, TONE_TEXT, Tag,
} from '@/mobile/designKit';
import { WarehouseReceipts } from '@/mobile/components/warehouse/WarehouseReceipts';
import { ParcelLine, ParcelThumb, formatDateTime } from '@/mobile/components/reception/bits';
import { CapsLabel } from '@/mobile/components/cargo/v2';
import { readReleaseDraft, writeReleaseDraft } from './releaseDraft';

export function WarehousePickupClient() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const { hasPermission } = useAdminAuth();
  const { data, isLoading, error, refetch } = useClientAtWarehouse(code);
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [laterOpen, setLaterOpen] = useState(false);
  const [moneyOpen, setMoneyOpen] = useState(false);

  const ready = useMemo(() => data?.ready ?? [], [data]);
  // Tout est coché d'office ; un brouillon (retour depuis l'étape 3) garde son choix.
  useEffect(() => {
    if (!data || picked !== null) return;
    const draft = readReleaseDraft(code);
    const keep = draft ? ready.filter((p) => draft.ids.includes(p.id)) : ready;
    setPicked(new Set(keep.map((p) => p.id)));
  }, [data, ready, picked, code]);

  const shell = (body: React.ReactNode) => (
    <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
      <ScreenTop title="Remise" backTo="/w/remise" />
      {body}
    </div>
  );
  if (isLoading) return <ScreenLoader className="min-h-[100dvh]" />;
  if (error instanceof UnknownCodeError) return shell(<EmptyLine action={{ label: 'Scanner à nouveau', onClick: () => navigate('/w/remise') }}>Aucun client ne porte le code {error.code || code}.</EmptyLine>);
  if (error || !data) return shell(<EmptyLine action={{ label: 'Réessayer', onClick: () => void refetch() }}>{(error as Error | null)?.message ?? 'Client introuvable'}</EmptyLine>);

  const client = data.client;
  const chosen = ready.filter((p) => picked?.has(p.id));
  const blockers = releaseBlockers(chosen, data.quotes);
  const canRelease = hasPermission('canReleaseParcels');
  const canCollect = hasPermission('canCollectParcelPayments');
  const word = releaseWord(chosen.length, blockers);
  const due = blockers.reduce((sum, q) => sum + q.balance_xaf, 0);
  const unpriced = blockers.some((q) => q.total_xaf <= 0);
  const kg = chosen.reduce((sum, p) => sum + Number(p.weight_kg ?? 0), 0);
  const toggle = (id: string) => setPicked((x) => { const n = new Set(x ?? []); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const next = () => { writeReleaseDraft({ code: client.customer_code, ids: chosen.map((p) => p.id), who: readReleaseDraft(code)?.who, phone: readReleaseDraft(code)?.phone }); navigate(`/w/remise/${code}/qui`); };
  // Les devis des colis prêts : ce qu'on doit encore, devis par devis.
  const deposits = new Set(ready.map((p) => p.deposit_id));
  const quotes = data.quotes.filter((q) => deposits.has(q.deposit_id));
  const allPaid = quotes.length > 0 && quotes.every((q) => q.balance_xaf <= 0 && q.total_xaf > 0);

  return (
    <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
      <ScreenTop title="Remise" backTo="/w/remise" step="2/3" />
      <div className="flex-1 px-5 pb-6 pt-4">
        <div className="flex items-center gap-3.5 rounded-lg border border-[#D9D9D9] px-4 py-3.5 dark:border-[#444444]">
          <Initials name={clientFullName(client)} />
          <span className="min-w-0 flex-1">
            <span className={cn('block truncate text-[17px] font-semibold', TEXT.strong)}>{clientFullName(client)}</span>
            <span className={cn('block truncate text-[15px] tabular-nums', TEXT.muted)}>{[client.customer_code, client.phone].filter(Boolean).join(' · ')}</span>
          </span>
          {quotes.length > 0 && <Tag tone={allPaid ? 'success' : 'pending'}>{allPaid ? 'Payé' : 'À payer'}</Tag>}
        </div>

        {ready.length === 0 ? <EmptyLine>Rien à remettre.</EmptyLine> : (
          <>
            <CapsLabel className="mt-6">Prêts · {nParcels(ready.length)} · {formatKg(ready.reduce((x, p) => x + Number(p.weight_kg ?? 0), 0))}</CapsLabel>
            {/* Les colis prêts, en photos : tous cochés d'office, un toucher décoche ce qui reste. */}
            <div className="mt-3 grid grid-cols-3 gap-3 rounded-lg border border-[#D9D9D9] p-3 dark:border-[#444444]">
              {ready.map((p) => {
                const on = !!picked?.has(p.id);
                return (
                  <button key={p.id} type="button" onClick={() => toggle(p.id)} aria-pressed={on} aria-label={p.parcel_no} className={cn('min-w-0 text-center', !on && 'opacity-40')}>
                    <span className="relative block">
                      <ParcelThumb path={p.photo_path} size="aspect-square h-auto w-full" />
                      {on && <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#2C2C2C] text-white dark:bg-[#E3E3E3] dark:text-[#1E1E1E]"><Check className="h-4 w-4" strokeWidth={3} /></span>}
                    </span>
                    <span className={cn('mt-1.5 block truncate text-[15px] tabular-nums', TEXT.muted)}>{[p.warehouse_location, String(p.seq).padStart(2, '0')].filter(Boolean).join(' · ')}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {quotes.length > 0 && (
          <KVBox
            className="mt-5"
            rows={quotes.flatMap((q) => [
              { label: `Devis ${q.deposit_no}`, value: q.total_xaf > 0 ? xaf(q.total_xaf) : 'Sans prix' },
              { label: 'Reste à payer', value: <span className="inline-flex items-center gap-2">{xaf(q.balance_xaf)}<Tag tone={q.balance_xaf <= 0 && q.total_xaf > 0 ? 'success' : 'pending'}>{q.balance_xaf <= 0 && q.total_xaf > 0 ? 'Payé' : 'À payer'}</Tag></span> },
            ])}
          />
        )}

        <ItemList className="-mx-5 pt-3">
          {data.not_ready.length > 0 && <ItemRow leading={<IconCircle icon={Package} />} title={`${nParcels(data.not_ready.length)} pas encore là`} onClick={() => setLaterOpen(true)} chevron />}
          {data.quotes.length > 0 && <ItemRow leading={<IconCircle icon={Receipt} />} title="Paiements et reçus" subtitle={`${data.quotes.length} devis`} onClick={() => setMoneyOpen(true)} chevron />}
          {data.releases.map((r) => (
            <ItemRow key={r.id} leading={<IconCircle icon={FileSignature} />} title={`${r.release_no} · ${nParcels(r.parcel_count)}`} subtitle={`${r.picked_by_name} · ${formatDateTime(r.released_at)}`} onClick={() => navigate(`/w/bon/${r.id}`)} chevron />
          ))}
        </ItemList>
      </div>

      {ready.length > 0 && (
        <Dock>
          {blockers.length > 0 && <p className={cn('text-center text-[15px] font-semibold', TONE_TEXT[word.tone === 'bad' ? 'danger' : 'pending'])}>{word.text}</p>}
          {due > 0 && !unpriced ? (
            canCollect ? <BigButton onClick={() => navigate(`/w/remise/${code}/encaisser`)}>Encaisser d'abord · {xaf(due)}</BigButton>
            : <p className={cn('text-center text-[15px]', TEXT.muted)}>Seules les opérations encaissent.</p>
          ) : (
            canRelease && <BigButton onClick={next} disabled={chosen.length === 0 || blockers.length > 0}>Remettre {nParcels(chosen.length)} · {formatKg(kg)}</BigButton>
          )}
        </Dock>
      )}

      <BottomSheet open={laterOpen} onClose={() => setLaterOpen(false)} title="Pas encore là">
        {data.not_ready.map((p) => { const st = warehouseStage(p); return <ParcelLine key={p.id} parcel={p} title={p.parcel_no} subtitle={p.description || p.kind} right={<Tag tone={st.tone === 'info' ? 'neutral' : st.tone}>{st.label}</Tag>} />; })}
      </BottomSheet>
      <BottomSheet open={moneyOpen} onClose={() => setMoneyOpen(false)} title="Paiements et reçus">
        <WarehouseReceipts quotes={data.quotes} />
      </BottomSheet>
    </div>
  );
}

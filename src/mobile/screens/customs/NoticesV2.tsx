/**
 * Veille douane — refonte v2 (maquettes 10/55, 10/56, 10/57).
 * La liste : Réglementation ou Perturbations, une ligne par avis (gravité ou
 * brouillon), « Voir les avis terminés ». Toucher un avis : sa fiche, avec
 * ses conteneurs touchés et « … » (Corriger, Partager le lien, Retirer).
 * « + » : publier un avis. Écriture : canManageCustoms, comme avant
 * (customs_notice_upsert / customs_notice_archive). Session supabaseAdmin.
 */
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Anchor, Archive, FileText, PenLine, Plus, Share2, Ship, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAdminNotices, useArchiveNotice, useUpsertNotice, type NoticeDraft } from '@/hooks/useCustomsReview';
import { useCargoShipments } from '@/hooks/useCargo';
import { toShipmentLike } from '@/lib/cargo/disruptions';
import { copyToClipboard } from '@/lib/clipboard';
import { formatHs } from '@/lib/customs/hsCode';
import type { Confidence } from '@/lib/customs/levies';
import { PLACE_FR, affectedShipments, phaseOf, sortNotices, type Notice, type NoticeKind, type NoticeStatus } from '@/lib/customs/notices';
import { cn } from '@/lib/utils';
import {
  ActionSheet, BigButton, BoxSegmented, ConfirmSheet, Dock, EmptyLine, FOCUS_RING, IconCircle, ItemList, ItemRow, KVBox, MoreButton, ScreenLoader,
  ScreenTop, SectionHead, Tag, TEXT, TextArea, TextInput, useSheet, type Tone,
} from '@/mobile/designKit';
import { BIG_FIELD, ChoiceTiles, FieldBlock } from '@/mobile/screens/more/parts';
import { HeaderIcon } from '@/mobile/screens/support/CannedResponsesV2';

const SEVERITY: Record<Notice['severity'], { label: string; tone: Tone }> = {
  high: { label: 'Fort', tone: 'danger' },
  medium: { label: 'Moyen', tone: 'pending' },
  low: { label: 'Faible', tone: 'neutral' },
};
const KIND_LABEL: Record<NoticeKind, string> = { regulation: 'Réglementation', disruption: 'Perturbation' };
const CONFIDENCE: Record<Confidence, string> = { officiel: 'officiel', observe: 'observé', marche: 'confiance moyenne', a_verifier: 'à vérifier' } as Record<Confidence, string>;

const shortDay = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : null);
const placeName = (p: string) => PLACE_FR[p] ?? p;

function noticeIcon(n: Notice): React.ElementType {
  if (n.kind === 'regulation') return FileText;
  if (n.places.some((p) => p.includes('-'))) return Truck;
  if (/port|quai|escale/i.test(n.title)) return Anchor;
  return Ship;
}

function subline(n: Notice): string {
  const where = n.places.length ? n.places.map(placeName).join(', ') : null;
  const delay = n.delay_days ? `retard ≈ ${n.delay_days} j` : null;
  const since = n.starts_on ? `depuis le ${shortDay(n.starts_on)}` : null;
  return [n.kind === 'disruption' ? (delay ? delay.charAt(0).toUpperCase() + delay.slice(1) : where) : where, since].filter(Boolean).join(' · ') || KIND_LABEL[n.kind];
}

export function NoticesV2() {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission } = useAdminAuth();
  const canManage = hasPermission('canManageCustoms');
  const canCargo = hasPermission('canViewCargo');
  const q = useAdminNotices(true);
  const cargo = useCargoShipments({ enabled: canCargo });

  const [tab, setTab] = useState<NoticeKind | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Notice | 'new' | null>(null);

  const all = useMemo(() => sortNotices(q.data ?? []), [q.data]);
  const hash = decodeURIComponent(location.hash.replace('#', ''));
  // Un lien vers un avis (#slug, depuis le simulateur ou une notification) ouvre sa fiche.
  useEffect(() => {
    const hit = hash ? all.find((n) => n.slug === hash) : undefined;
    if (hit) setOpenId(hit.id);
  }, [hash, all]);

  const hot = all.some((n) => n.kind === 'disruption' && n.published && phaseOf(n) !== 'past');
  const current: NoticeKind = tab ?? (hot ? 'disruption' : 'regulation');
  const count = (k: NoticeKind) => all.filter((n) => n.kind === k && phaseOf(n) !== 'past').length;
  const inTab = all.filter((n) => n.kind === current);
  const past = inTab.filter((n) => phaseOf(n) === 'past');
  const visible = inTab.filter((n) => showPast || phaseOf(n) !== 'past');
  const shipments = useMemo(() => (cargo.data ?? []).map(toShipmentLike), [cargo.data]);

  const open = all.find((n) => n.id === openId) ?? null;
  if (editing) return <NoticeEditorV2 notice={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />;
  if (open) {
    return (
      <NoticeDetail
        n={open}
        canManage={canManage}
        hits={canCargo && open.kind === 'disruption' ? affectedShipments(open, shipments) : []}
        onBack={() => { setOpenId(null); if (hash) navigate({ hash: '' }, { replace: true }); }}
        onEdit={() => setEditing(open)}
      />
    );
  }

  return (
    <div className="flex min-h-full flex-col pb-8">
      <ScreenTop title="Veille douane" backTo="/m/douane" right={canManage ? <HeaderIcon icon={Plus} label="Publier un avis" onClick={() => setEditing('new')} /> : undefined} />
      <div className="px-5 pt-5">
        <BoxSegmented<NoticeKind>
          ariaLabel="Type d'avis"
          value={current}
          onChange={(k) => { setTab(k); setShowPast(false); }}
          options={[
            { value: 'regulation', label: `Réglementation ${count('regulation')}` },
            { value: 'disruption', label: `Perturbations ${count('disruption')}` },
          ]}
        />
      </div>
      {q.isLoading ? (
        <ScreenLoader />
      ) : q.isError ? (
        <EmptyLine action={{ label: 'Réessayer', onClick: () => void q.refetch() }}>La veille n'a pas pu être chargée.</EmptyLine>
      ) : visible.length === 0 ? (
        <EmptyLine>{current === 'disruption' ? 'Aucune perturbation en ce moment.' : 'Aucun avis réglementaire.'}</EmptyLine>
      ) : (
        <ItemList className="pt-2">
          {visible.map((n) => (
            <ItemRow
              key={n.id}
              leading={<IconCircle icon={noticeIcon(n)} />}
              title={n.title}
              subtitle={subline(n)}
              tag={!n.published ? { tone: 'neutral', label: 'Brouillon' } : phaseOf(n) === 'past' ? { tone: 'neutral', label: 'Terminé' } : SEVERITY[n.severity]}
              onClick={() => setOpenId(n.id)}
            />
          ))}
        </ItemList>
      )}
      {past.length > 0 && (
        <div className="px-5 pt-5">
          <button type="button" onClick={() => setShowPast(!showPast)} className={cn('h-11 rounded text-[17px] font-semibold underline underline-offset-[3px]', FOCUS_RING, TEXT.strong)}>
            {showPast ? 'Masquer les avis terminés' : `Voir les avis terminés (${past.length})`}
          </button>
        </div>
      )}
    </div>
  );
}

function NoticeDetail({
  n, canManage, hits, onBack, onEdit,
}: {
  n: Notice;
  canManage: boolean;
  hits: ReturnType<typeof affectedShipments>;
  onBack: () => void;
  onEdit: () => void;
}) {
  const navigate = useNavigate();
  const archive = useArchiveNotice();
  const more = useSheet();
  const retire = useSheet();
  const share = async () => {
    const url = `${window.location.origin}/douane/veille#${n.slug}`;
    if (navigator.share) {
      try { await navigator.share({ title: n.title, url }); return; } catch { /* annulé : on copie */ }
    }
    await copyToClipboard(url, 'Lien de l’avis');
  };
  const rows = [
    n.delay_days ? { label: 'Retard', value: `≈ ${n.delay_days} jours` } : null,
    n.starts_on ? { label: 'Depuis', value: shortDay(n.starts_on) } : null,
    n.ends_on ? { label: "Jusqu'au", value: shortDay(n.ends_on) } : null,
    n.places.length ? { label: 'Lieux', value: n.places.map(placeName).join(', ') } : null,
    n.hs_specs.length ? { label: 'Codes SH', value: n.hs_specs.slice(0, 6).map(formatHs).join(', ') } : null,
    { label: 'Source', value: [n.source_label, CONFIDENCE[n.confidence]].filter(Boolean).join(' · ') || '—' },
    n.advice ? { label: 'À faire', value: n.advice } : null,
  ].filter((r): r is { label: string; value: string } => r != null);

  return (
    <div className="flex min-h-full flex-col pb-8">
      <ScreenTop title="Avis" onBack={onBack} right={<MoreButton onClick={more.show} />} />
      <div className="px-5 pt-5">
        <div className="flex flex-wrap gap-2">
          {!n.published && <Tag tone="neutral">Brouillon</Tag>}
          <Tag tone={SEVERITY[n.severity].tone}>{SEVERITY[n.severity].label}</Tag>
          <Tag tone="neutral">{KIND_LABEL[n.kind]}</Tag>
        </div>
        <h2 className={cn('mt-3 text-[28px] font-bold leading-tight tracking-[-0.01em]', TEXT.strong)}>{n.title}</h2>
        <p className={cn('mt-3 text-[17px] leading-relaxed', TEXT.body)}>{n.summary}</p>
        <KVBox rows={rows} className="mt-5" />
        {n.source_url && (
          <a href={n.source_url} target="_blank" rel="noreferrer" className={cn('mt-3 inline-flex h-11 items-center text-[16px] font-semibold underline underline-offset-[3px]', TEXT.strong)}>Ouvrir la source</a>
        )}
      </div>
      {hits.length > 0 && (
        <>
          <SectionHead title={`Conteneurs touchés · ${hits.length}`} />
          <ItemList>
            {hits.map(({ shipment: s, where }) => (
              <ItemRow
                key={s.id}
                leading={<IconCircle icon={Ship} />}
                title={s.container_number}
                subtitle={[s.client_label, where === 'origin' ? `départ ${s.etd ? s.etd.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—'}` : `arrivée ${s.eta ? s.eta.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—'}`].filter(Boolean).join(' · ')}
                tag={n.delay_days ? { tone: 'danger', label: `+${n.delay_days} j` } : undefined}
                onClick={() => navigate(`/m/cargo/${s.id}`)}
              />
            ))}
          </ItemList>
        </>
      )}
      <ActionSheet
        open={more.open}
        onClose={more.hide}
        title={<>{n.title}</>}
        actions={[
          { label: 'Corriger', icon: PenLine, onClick: onEdit, hidden: !canManage },
          { label: 'Partager le lien', icon: Share2, onClick: () => void share(), hidden: !n.published },
          { label: "Retirer l'avis", hint: 'Républiable en le corrigeant', icon: Archive, danger: true, onClick: retire.show, hidden: !canManage || !n.published },
        ]}
      />
      <ConfirmSheet
        open={retire.open}
        onClose={retire.hide}
        title="Retirer cet avis ?"
        subtitle={n.title}
        confirmLabel="Retirer"
        cancelLabel="Pas maintenant"
        danger
        loading={archive.isPending}
        onConfirm={() => archive.mutate(n.id, {
          onSuccess: () => { retire.hide(); toast.success('Avis retiré'); onBack(); },
          onError: (e) => toast.error((e as Error).message),
        })}
      />
    </div>
  );
}

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'avis';

const EMPTY: NoticeDraft = {
  slug: '', kind: 'disruption', title: '', summary: '', advice: null, status: 'in_force', severity: 'medium',
  starts_on: null, ends_on: null, delay_days: null, hs_specs: [], places: [], source_label: null, source_url: null,
  confidence: 'marche', published: false,
};

/** Publier ou corriger un avis (10/56). Mêmes règles que l'éditeur d'avant ; le serveur revalide tout. */
function NoticeEditorV2({ notice, onDone }: { notice: Notice | null; onDone: () => void }) {
  const upsert = useUpsertNotice();
  const [d, setD] = useState<NoticeDraft>(() => (notice ? { ...notice } : EMPTY));
  const [specs, setSpecs] = useState(() => (notice?.hs_specs ?? []).join(', '));
  const [places, setPlaces] = useState(() => (notice?.places ?? []).join(', '));
  const [slugTouched, setSlugTouched] = useState(!!notice);
  const [extras, setExtras] = useState(!!notice);
  const [tried, setTried] = useState(false);
  const set = <K extends keyof NoticeDraft>(k: K, v: NoticeDraft[K]) => setD((x) => ({ ...x, [k]: v }));

  const errors = {
    title: d.title.trim().length < 3 ? 'Un titre (3 caractères au moins).' : null,
    summary: d.summary.trim().length < 3 ? 'Ce qui se passe, en une ou deux phrases.' : null,
    dates: d.starts_on && d.ends_on && d.ends_on < d.starts_on ? 'La fin précède le début.' : null,
    url: d.source_url && !/^https:\/\/\S+$/.test(d.source_url) ? 'Une adresse https://' : null,
  };

  const save = (publish: boolean) => {
    setTried(true);
    if (Object.values(errors).some(Boolean)) {
      if (errors.dates || errors.url) setExtras(true);
      return;
    }
    const payload: NoticeDraft = {
      ...d,
      slug: d.slug || slugify(d.title),
      title: d.title.trim(),
      summary: d.summary.trim(),
      advice: d.advice?.trim() || null,
      hs_specs: specs.split(/[,;\s]+/).map((s) => s.replace(/\D/g, '')).filter((s) => s.length >= 2),
      places: places.split(/[,;\s]+/).map((s) => s.trim().toUpperCase()).filter(Boolean),
      source_label: d.source_label?.trim() || null,
      source_url: d.source_url?.trim() || null,
      published: publish,
    };
    upsert.mutate(payload, {
      onSuccess: (r) => {
        toast.success(publish ? (r.notified > 0 ? `Avis publié · ${r.notified} client${r.notified > 1 ? 's' : ''} prévenu${r.notified > 1 ? 's' : ''}` : 'Avis publié') : 'Brouillon enregistré');
        onDone();
      },
      onError: (e) => toast.error((e as Error).message),
    });
  };

  return (
    <div className="flex min-h-full flex-col">
      <ScreenTop title={notice ? "Corriger l'avis" : 'Publier un avis'} onBack={onDone} />
      {/* Deux boutons dans le bas : la cale du Dock n'en compte qu'un. */}
      <div className="space-y-6 px-5 pb-24 pt-5">
        <BoxSegmented<NoticeKind>
          ariaLabel="Type d'avis"
          value={d.kind}
          onChange={(v) => set('kind', v)}
          options={[{ value: 'regulation', label: 'Réglementation' }, { value: 'disruption', label: 'Perturbation' }]}
        />
        <FieldBlock label="Titre" htmlFor="nt-title" error={tried ? errors.title : null}>
          <TextInput id="nt-title" value={d.title} maxLength={160} className={BIG_FIELD} onChange={(e) => { set('title', e.target.value); if (!slugTouched) set('slug', slugify(e.target.value)); }} />
        </FieldBlock>
        <FieldBlock label="Gravité">
          <ChoiceTiles<Notice['severity']>
            ariaLabel="Gravité"
            value={d.severity}
            onChange={(v) => set('severity', v)}
            options={[{ value: 'low', label: 'Faible' }, { value: 'medium', label: 'Moyen' }, { value: 'high', label: 'Fort' }]}
          />
        </FieldBlock>
        <div className="grid grid-cols-2 gap-3">
          {d.kind === 'disruption' ? (
            <FieldBlock label="Retard (jours)" htmlFor="nt-delay">
              <TextInput id="nt-delay" inputMode="numeric" className={BIG_FIELD} value={d.delay_days ?? ''} onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); set('delay_days', v ? Math.min(120, Number(v)) : null); }} />
            </FieldBlock>
          ) : (
            <FieldBlock label="Statut">
              <select
                aria-label="Statut"
                value={d.status}
                onChange={(e) => set('status', e.target.value as NoticeStatus)}
                className={cn('h-14 w-full rounded-lg border border-[#949494] bg-white px-3 text-[17px] dark:bg-[#2C2C2C]', TEXT.strong)}
              >
                <option value="in_force">En vigueur</option>
                <option value="announced">Annoncé</option>
                <option value="watch">À confirmer</option>
              </select>
            </FieldBlock>
          )}
          <FieldBlock label="Depuis" htmlFor="nt-start">
            <TextInput id="nt-start" type="date" className={BIG_FIELD} value={d.starts_on ?? ''} onChange={(e) => set('starts_on', e.target.value || null)} />
          </FieldBlock>
        </div>
        <FieldBlock label="Lieux" htmlFor="nt-places">
          <TextInput id="nt-places" value={places} placeholder="CMDLA, CN…" autoCapitalize="characters" className={BIG_FIELD} onChange={(e) => setPlaces(e.target.value)} />
        </FieldBlock>
        <FieldBlock label="Codes SH visés" htmlFor="nt-codes">
          <TextInput id="nt-codes" inputMode="numeric" value={specs} placeholder="tous" className={BIG_FIELD} onChange={(e) => setSpecs(e.target.value)} />
        </FieldBlock>
        <FieldBlock label="Ce qui se passe" htmlFor="nt-summary" error={tried ? errors.summary : null}>
          <TextArea id="nt-summary" rows={3} maxLength={600} value={d.summary} onChange={(e) => set('summary', e.target.value)} className="px-4 py-3.5 !text-[17px]" />
        </FieldBlock>
        {!extras ? (
          <button type="button" onClick={() => setExtras(true)} className={cn('flex h-11 items-center gap-2.5 rounded text-[17px] font-semibold', FOCUS_RING, TEXT.strong)}>
            <Plus className="h-6 w-6" /> À faire, source, fin
          </button>
        ) : (
          <div className="space-y-6">
            <FieldBlock label="À faire" htmlFor="nt-advice">
              <TextArea id="nt-advice" rows={2} maxLength={1000} value={d.advice ?? ''} onChange={(e) => set('advice', e.target.value)} className="px-4 py-3.5 !text-[17px]" />
            </FieldBlock>
            <FieldBlock label="Fin" htmlFor="nt-end" error={tried ? errors.dates : null}>
              <TextInput id="nt-end" type="date" className={BIG_FIELD} value={d.ends_on ?? ''} onChange={(e) => set('ends_on', e.target.value || null)} />
            </FieldBlock>
            <FieldBlock label="Source" htmlFor="nt-src">
              <TextInput id="nt-src" value={d.source_label ?? ''} maxLength={200} className={BIG_FIELD} onChange={(e) => set('source_label', e.target.value)} />
            </FieldBlock>
            <FieldBlock label="Lien (https)" htmlFor="nt-url" error={tried ? errors.url : null}>
              <TextInput id="nt-url" type="url" value={d.source_url ?? ''} className={BIG_FIELD} onChange={(e) => set('source_url', e.target.value)} />
            </FieldBlock>
            <FieldBlock label="Confiance">
              <ChoiceTiles<Confidence>
                ariaLabel="Confiance"
                value={d.confidence}
                onChange={(v) => set('confidence', v)}
                options={[{ value: 'officiel', label: 'Officiel' }, { value: 'marche', label: 'Marché' }, { value: 'a_verifier', label: 'À vérifier' }]}
              />
            </FieldBlock>
            <FieldBlock label="Identifiant du lien" htmlFor="nt-slug">
              <TextInput id="nt-slug" value={d.slug} maxLength={80} className={BIG_FIELD} onChange={(e) => { setSlugTouched(true); set('slug', slugify(e.target.value)); }} />
            </FieldBlock>
          </div>
        )}
      </div>
      <Dock>
        <BigButton loading={upsert.isPending && d.published !== false} onClick={() => save(true)}>Publier</BigButton>
        <BigButton variant="soft" disabled={upsert.isPending} onClick={() => save(false)}>Enregistrer en brouillon</BigButton>
      </Dock>
    </div>
  );
}

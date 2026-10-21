/**
 * Justificatifs, v2 (maquette 06-messages-douane-outils/14) : Dépôts /
 * Paiements, une grille de reçus (le vrai logo du moyen, le montant, le
 * client, la date). Un appui ouvre la pièce en grand, puis le dépôt ou le
 * paiement. Les pièces des paiements manquaient partout : elles sont là.
 * « … » : rechercher (client, nom du fichier).
 *
 * L'écran ordinateur garde MobileProofsScreen (prop `desktop`), inchangé.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Search } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAdminProofs } from '@/hooks/useAdminData';
import { cn } from '@/lib/utils';
import {
  BoxSegmented, EmptyLine, MethodCircle, MoreButton, ScreenTop, SearchBox, TEXT, SURFACE, FOCUS_RING, toMethodKey, useSheet,
} from '@/mobile/designKit';
import { SkeletonListScreen } from '@/mobile/components/ui/SkeletonCard';
import { DepositRound, MenuSheet, Viewer, type StageItem } from './parts';
import { n0, shortWhen, yuan } from './opsLabels';
import { usePaymentProofsFeed } from './opsQueries';

type Tab = 'deposits' | 'payments';

interface Tile {
  id: string;
  url: string | null;
  isImage: boolean;
  name: string;
  logo: React.ReactNode;
  amount: string;
  client: string;
  date: string;
  open: string;
  openLabel: string;
}

/** « Fatou N. » : le prénom et l'initiale, comme sur un reçu. */
const shortName = (full: string) => {
  if (!full.trim() || /inconnu/i.test(full)) return 'Client';
  const [first, ...rest] = full.trim().split(/\s+/);
  const last = rest.join(' ');
  return last ? `${first} ${last.charAt(0)}.` : first || 'Client';
};

function download(url: string, name: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  a.click();
}

export function ProofsScreen() {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const canDeposits = hasPermission('canViewDeposits');
  const canPayments = hasPermission('canViewPayments');
  const [tab, setTab] = useState<Tab>(canDeposits ? 'deposits' : 'payments');
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [viewing, setViewing] = useState<Tile | null>(null);
  const more = useSheet();

  const deposits = useAdminProofs();
  const payments = usePaymentProofsFeed(tab === 'payments' && canPayments);

  const tiles: Tile[] = useMemo(() => {
    if (tab === 'deposits') {
      return (deposits.data ?? []).filter((p) => !p.deleted_at).map((p) => ({
        id: p.id,
        url: p.signedUrl ?? null,
        isImage: !!p.file_type?.startsWith('image/'),
        name: p.file_name,
        logo: <DepositRound method={p.deposits?.method} bankName={p.deposits?.bank_name} size={32} />,
        amount: p.deposits ? n0(p.deposits.amount_xaf) : '—',
        client: shortName(p.clientName ?? ''),
        date: shortWhen(p.uploaded_at),
        open: p.deposit_id ? `/m/deposits/${p.deposit_id}` : '',
        openLabel: 'Voir le dépôt',
      }));
    }
    return (payments.data ?? []).map((p) => ({
      id: p.id,
      url: p.signedUrl,
      isImage: !!p.file_type?.startsWith('image/'),
      name: p.file_name,
      logo: <MethodCircle method={toMethodKey(p.method)} size={32} />,
      amount: yuan(p.amount_rmb),
      client: shortName(p.clientName),
      date: shortWhen(p.created_at),
      open: `/m/payments/${p.payment_id}`,
      openLabel: 'Voir le paiement',
    }));
  }, [tab, deposits.data, payments.data]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return tiles;
    return tiles.filter((x) => x.client.toLowerCase().includes(t) || x.name.toLowerCase().includes(t));
  }, [tiles, q]);

  const loading = tab === 'deposits' ? deposits.isLoading : payments.isLoading;
  const isError = tab === 'deposits' ? deposits.isError : payments.isError;
  const refetch = tab === 'deposits' ? deposits.refetch : payments.refetch;
  const allowed = tab === 'deposits' ? canDeposits : canPayments;

  const segments = [
    ...(canDeposits ? [{ value: 'deposits' as const, label: 'Dépôts' }] : []),
    ...(canPayments ? [{ value: 'payments' as const, label: 'Paiements' }] : []),
  ];

  const item: StageItem | null = viewing ? { id: viewing.id, url: viewing.url, isImage: viewing.isImage, name: viewing.name } : null;

  return (
    <div className="flex min-h-full flex-col pb-6">
      <ScreenTop title="Justificatifs" backTo="/m/more" right={<MoreButton onClick={more.show} />} />
      {searching && (
        <div className="px-5 pt-3">
          <SearchBox value={q} onChange={setQ} autoFocus placeholder="Client ou fichier" />
        </div>
      )}
      {segments.length > 1 && (
        <div className="px-5 pt-3">
          <BoxSegmented<Tab> value={tab} onChange={setTab} options={segments} />
        </div>
      )}

      {!allowed ? (
        <EmptyLine>Vous n'avez pas accès à ces pièces.</EmptyLine>
      ) : loading ? (
        <div className="px-5 pt-4"><SkeletonListScreen count={3} /></div>
      ) : isError ? (
        <EmptyLine action={{ label: 'Réessayer', onClick: () => void refetch() }}>Les pièces n'ont pas pu être chargées.</EmptyLine>
      ) : shown.length === 0 ? (
        <EmptyLine>{q ? 'Aucune pièce trouvée.' : 'Aucune pièce.'}</EmptyLine>
      ) : (
        <div className="grid grid-cols-3 gap-x-3 gap-y-4 px-5 pt-4">
          {shown.map((x) => (
            <button key={x.id} type="button" onClick={() => setViewing(x)} className={cn('min-w-0 text-left', FOCUS_RING)}>
              <span className={cn('relative block aspect-[3/4] overflow-hidden rounded-lg border bg-[#F5F5F5] dark:bg-[#383838]', SURFACE.divider)}>
                {x.isImage && x.url ? (
                  <img src={x.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center"><FileText className={cn('h-8 w-8', TEXT.muted)} /></span>
                )}
                <span className="absolute left-1.5 top-1.5">{x.logo}</span>
              </span>
              <span className={cn('mt-1.5 block truncate text-[16px] font-bold tabular-nums', TEXT.strong)}>{x.amount}</span>
              <span className={cn('block truncate text-[15px] font-semibold', TEXT.body)}>{x.client}</span>
              <span className={cn('block truncate text-[14px]', TEXT.muted)}>{x.date}</span>
            </button>
          ))}
        </div>
      )}

      <MenuSheet
        open={more.open}
        onClose={more.hide}
        items={[{ label: searching ? 'Fermer la recherche' : 'Rechercher', icon: Search, onClick: () => { if (searching) setQ(''); setSearching(!searching); } }]}
      />

      <Viewer
        item={item}
        onClose={() => setViewing(null)}
        actions={viewing ? [
          { label: 'Télécharger', onClick: () => { if (viewing.url) download(viewing.url, viewing.name); }, hidden: !viewing.url },
          { label: viewing.openLabel, onClick: () => { const to = viewing.open; setViewing(null); if (to) navigate(to); }, hidden: !viewing.open },
        ] : []}
      />
    </div>
  );
}

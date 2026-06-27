import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import {
  Search,
  FileText,
  Download,
  Image,
  File,
  ArrowDownToLine,
} from 'lucide-react';
import { useAdminProofs } from '@/hooks/useAdminData';
import { formatDate } from '@/lib/formatters';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { SkeletonListScreen } from '@/mobile/components/ui/SkeletonCard';
import { PullToRefresh } from '@/mobile/components/ui/PullToRefresh';
import { cn } from '@/lib/utils';
import {
  SURFACE,
  TEXT,
  Card,
  Row,
  StatCard,
  StatusPill,
  TextInput,
  BottomSheet,
  PrimaryPill,
} from '@/mobile/designKit';

// Vignette de preuve : affiche l'image signée et retombe sur une icône si le
// chargement échoue (URL absente/expirée, fichier illisible…).
function ProofThumb({ url, alt, fallback }: { url: string | null | undefined; alt: string; fallback: ReactNode }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) return <>{fallback}</>;
  return (
    <img
      src={url}
      alt={alt}
      className="h-full w-full object-cover"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export function MobileProofsScreen({ desktop = false }: { desktop?: boolean } = {}) {
  const { t } = useTranslation('common');
  const { data: proofs, isLoading, refetch } = useAdminProofs();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [selectedProof, setSelectedProof] = useState<typeof proofs extends (infer T)[] | undefined ? T : never | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const filteredProofs = proofs?.filter((proof) => {
    if (!debouncedSearch) return true;
    const s = debouncedSearch.toLowerCase();
    return (
      proof.clientName.toLowerCase().includes(s) ||
      proof.file_name.toLowerCase().includes(s)
    );
  }) || [];

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
      return <Image className={cn('h-6 w-6', TEXT.muted)} />;
    }
    return <File className={cn('h-6 w-6', TEXT.muted)} />;
  };

  const isImage = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
  };

  const handlePreview = (proof: typeof selectedProof) => {
    setSelectedProof(proof);
    setPreviewOpen(true);
  };

  return (
    <div className={desktop ? '' : 'flex min-h-screen flex-col'}>
      {desktop ? (
        <header className="mb-5">
          <h2 className={cn('text-[26px] font-extrabold tracking-tight', TEXT.strong)}>{t('proofs', { defaultValue: 'Justificatifs' })}</h2>
          <p className={cn('mt-1 text-[14px]', TEXT.muted)}>{t('proofsSubtitle', { defaultValue: 'Preuves de dépôts envoyées par les clients' })}</p>
        </header>
      ) : (
        <MobileHeader title={t('proofs', { defaultValue: 'Justificatifs' })} backTo="/m/more" showBack />
      )}

      <PullToRefresh onRefresh={refetch} className={desktop ? '' : cn('flex-1 overflow-y-auto', SURFACE.canvas)}>
        {/* Stats */}
        <div className={cn('grid grid-cols-2 gap-3', desktop ? 'max-w-md py-1' : 'px-4 py-5')}>
          <StatCard icon={FileText} label="Total" value={proofs?.length || 0} />
          <StatCard icon={ArrowDownToLine} label="Dépôts" value={proofs?.length || 0} tone="success" />
        </div>

        {/* Search */}
        <div className={desktop ? 'max-w-sm py-4' : 'px-4 pb-4'}>
          <div className="relative">
            <Search className={cn('absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2', TEXT.muted)} />
            <TextInput
              type="text"
              placeholder={t('searchByClientOrFile', { defaultValue: 'Rechercher par client ou fichier...' })}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Proofs Grid */}
        {isLoading ? (
          <div className={desktop ? 'pb-6' : 'px-4 pb-6'}>
            <SkeletonListScreen count={4} />
          </div>
        ) : (
          <div className={desktop ? 'pb-6' : 'px-4 pb-6'}>
            <div className={cn('grid gap-3', desktop ? 'grid-cols-3 xl:grid-cols-5' : 'grid-cols-2')}>
              {filteredProofs.map((proof) => (
                <button
                  key={proof.id}
                  onClick={() => handlePreview(proof)}
                  className={cn('overflow-hidden rounded-[22px] text-left transition active:scale-[0.99]', SURFACE.card, SURFACE.shadow)}
                >
                  {/* Thumbnail */}
                  <div className="relative flex aspect-square items-center justify-center bg-[#EDEAFA] dark:bg-[#2F2C3D]">
                    <ProofThumb
                      url={isImage(proof.file_name) ? proof.signedUrl : null}
                      alt={proof.file_name}
                      fallback={getFileIcon(proof.file_name)}
                    />
                    <div className="absolute right-2 top-2">
                      <StatusPill tone="success" label="Dépôt" className="px-2 py-0.5 text-[10px]" />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <p className={cn('truncate text-[14px] font-semibold', TEXT.strong)}>{proof.file_name}</p>
                    <p className={cn('truncate text-[12px]', TEXT.muted)}>{proof.clientName}</p>
                    <p className={cn('mt-1 text-[10px]', TEXT.muted)}>
                      {formatDate(proof.uploaded_at)}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            {filteredProofs.length === 0 && (
              <div className={cn('py-12 text-center', TEXT.muted)}>
                {t('noProofsFound', { defaultValue: 'Aucun justificatif trouvé' })}
              </div>
            )}
          </div>
        )}
      </PullToRefresh>

      {/* Preview */}
      <BottomSheet open={previewOpen} onClose={() => setPreviewOpen(false)} title={selectedProof?.file_name}>
        {selectedProof?.signedUrl && isImage(selectedProof.file_name) && (
          <img
            src={selectedProof.signedUrl}
            alt={selectedProof.file_name}
            className="w-full rounded-2xl"
          />
        )}

        <div className="mt-4">
          <Row label="Client" value={selectedProof?.clientName ?? '—'} />
          <Row label="Type" value="Dépôt" />
          <Row label="Date" value={selectedProof ? formatDate(selectedProof.uploaded_at) : '—'} />
        </div>

        <PrimaryPill
          onClick={() => selectedProof?.signedUrl && window.open(selectedProof.signedUrl, '_blank')}
          disabled={!selectedProof?.signedUrl}
          className="mt-5 w-full"
        >
          <Download className="h-5 w-5" />
          {t('download', { defaultValue: 'Télécharger' })}
        </PrimaryPill>
      </BottomSheet>
    </div>
  );
}

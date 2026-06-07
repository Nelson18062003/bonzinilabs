/**
 * DEV-ONLY preview — the shared design kit (`src/mobile/designKit/components.tsx`)
 * rendered as a gallery on the Ofspace canvas, in light + dark. One sample of
 * EACH component so the kit can be validated visually before screens migrate.
 *
 * Rendered by the harness at /screenshot.html?screen=kit. Phase 0.3 of the
 * mobile refonte (docs/refonte-progress.md). Not part of the production build.
 */
import { useState } from 'react';
import { Wallet, ArrowDownToLine, Users, TrendingUp, Search } from 'lucide-react';
import {
  SURFACE,
  TEXT,
  Card,
  Holder,
  Avatar,
  Row,
  Amount,
  PrimaryPill,
  SoftPill,
  StatusPill,
  StatCard,
  Segmented,
  FormField,
  TextInput,
  BottomSheet,
  ScreenLoader,
  ScreenError,
  SectionTitle,
  depositStatusTone,
  paymentStatusTone,
  clientStatusTone,
  roleMeta,
  type Tone,
} from '@/mobile/designKit';
import { cn } from '@/lib/utils';

/** Small captioned wrapper so each sample reads clearly in the gallery. */
function Sample({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className={cn('px-1 text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>{name}</h3>
      {children}
    </section>
  );
}

const TONES: Tone[] = ['success', 'pending', 'danger', 'info', 'neutral'];

export function Kit() {
  const [seg, setSeg] = useState<'all' | 'in' | 'out'>('all');
  const [query, setQuery] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div
      className={cn('min-h-screen px-4 py-7', SURFACE.canvas)}
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <div className="mx-auto max-w-md space-y-6">
        <div>
          <div className={cn('text-[22px] font-extrabold tracking-tight', TEXT.strong)}>Design kit</div>
          <div className={cn('text-[13px]', TEXT.muted)}>Langage Ofspace/Mola — composants partagés</div>
        </div>

        {/* Card */}
        <Sample name="Card">
          <Card>
            <div className={cn('text-[15px] font-bold', TEXT.strong)}>Surface élevée</div>
            <div className={cn('mt-1 text-[13px]', TEXT.muted)}>
              Blanc, ombre douce, sans bordure dure. La base de tout écran.
            </div>
          </Card>
        </Sample>

        {/* Holder (tones) */}
        <Sample name="Holder (par tone)">
          <Card>
            <div className="flex items-center gap-3">
              <Holder icon={Wallet} />
              {TONES.map((t) => (
                <Holder key={t} icon={Wallet} tone={t} />
              ))}
            </div>
          </Card>
        </Sample>

        {/* Avatar */}
        <Sample name="Avatar (initiales)">
          <Card>
            <div className="flex items-center gap-3">
              <Avatar name="Awa Diop" />
              <Avatar name="Jean Kamga" size="sm" />
              <Avatar name="Shenzhen Tech Co." size="lg" tone="info" />
              <Avatar name="Marie" tone="success" />
            </div>
          </Card>
        </Sample>

        {/* Amount */}
        <Sample name="Amount">
          <Card className="space-y-3">
            <Amount value="12 500 000" unit="XAF" size="xl" />
            <Amount value="2 500 000" unit="XAF" />
            <Amount value="178 500" unit="CNY" size="md" />
          </Card>
        </Sample>

        {/* Row */}
        <Sample name="Row (sans filet)">
          <Card>
            <Row label="Client" value="Awa Diop · BZ-CL-0042" />
            <Row label="Méthode" value="Alipay" />
            <Row label="Solde après" value="36 250 000 XAF" />
          </Card>
        </Sample>

        {/* Pills */}
        <Sample name="Pills">
          <div className="flex flex-wrap items-center gap-2">
            <PrimaryPill>Confirmer</PrimaryPill>
            <PrimaryPill danger>Rejeter</PrimaryPill>
            <SoftPill>Annuler</SoftPill>
            <PrimaryPill loading>Confirmer</PrimaryPill>
            <PrimaryPill disabled>Indisponible</PrimaryPill>
          </div>
        </Sample>

        {/* StatusPill — wired to the unified tone helpers */}
        <Sample name="StatusPill (statuts unifiés)">
          <Card className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <StatusPill tone={depositStatusTone('validated')} label="Dépôt validé" />
              <StatusPill tone={depositStatusTone('pending_review')} label="Dépôt en revue" />
              <StatusPill tone={paymentStatusTone('completed')} label="Paiement payé" />
              <StatusPill tone={paymentStatusTone('processing')} label="Paiement en cours" />
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusPill tone={clientStatusTone('active')} label="Client actif" />
              <StatusPill tone={clientStatusTone('suspended')} label="Suspendu" />
              <StatusPill tone={roleMeta('super_admin').tone} label={roleMeta('super_admin').label} />
              <StatusPill tone={roleMeta('cash_agent').tone} label={roleMeta('cash_agent').label} />
            </div>
          </Card>
        </Sample>

        {/* StatCard */}
        <Sample name="StatCard">
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={Wallet} tone="info" label="Trésorerie" value="48,7M" unit="XAF" hint="96 clients actifs" />
            <StatCard icon={ArrowDownToLine} tone="pending" label="Dépôts à traiter" value="3" hint="8,2M aujourd'hui" />
            <StatCard icon={Users} tone="success" label="Clients" value="128" hint="+12 ce mois" />
            <StatCard icon={TrendingUp} tone="neutral" label="Volume semaine" value="86,2M" unit="XAF" />
          </div>
        </Sample>

        {/* Segmented */}
        <Sample name="Segmented / Tabs">
          <Segmented
            value={seg}
            onChange={setSeg}
            options={[
              { value: 'all', label: 'Tout' },
              { value: 'in', label: 'Dépôts' },
              { value: 'out', label: 'Paiements' },
            ]}
          />
        </Sample>

        {/* Form */}
        <Sample name="FormField + TextInput">
          <Card className="space-y-4">
            <FormField label="Nom du client" hint="Tel qu'il figure sur la pièce d'identité.">
              <TextInput placeholder="Awa Diop" value={query} onChange={(e) => setQuery(e.target.value)} />
            </FormField>
            <FormField label="Référence" error="Référence introuvable.">
              <TextInput placeholder="BZ-CL-0000" defaultValue="BZ-CL-9999" />
            </FormField>
            <FormField label="Recherche">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9B98AD]" />
                <TextInput placeholder="Rechercher…" className="pl-10" />
              </div>
            </FormField>
          </Card>
        </Sample>

        {/* BottomSheet — live trigger + a static inline preview of the panel */}
        <Sample name="BottomSheet">
          <div className="space-y-3">
            <PrimaryPill onClick={() => setSheetOpen(true)}>Ouvrir le panneau</PrimaryPill>
            {/* Inline (non-overlay) replica so the panel is visible in the capture. */}
            <div
              className={cn(
                'overflow-hidden rounded-[28px] p-5',
                SURFACE.card,
                'shadow-[0_-12px_40px_-12px_rgba(46,32,92,0.30)] dark:shadow-none dark:ring-1 dark:ring-white/[0.06]',
              )}
            >
              <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-black/10 dark:bg-white/15" />
              <div className={cn('mb-4 text-[17px] font-bold', TEXT.strong)}>Filtrer les dépôts</div>
              <Row label="Statut" value="Tous" />
              <Row label="Période" value="30 derniers jours" />
              <div className="mt-4 flex gap-2.5">
                <PrimaryPill className="flex-1">Appliquer</PrimaryPill>
                <SoftPill>Réinitialiser</SoftPill>
              </div>
            </div>
          </div>
          <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Filtrer les dépôts">
            <Row label="Statut" value="Tous" />
            <Row label="Période" value="30 derniers jours" />
            <div className="mt-4 flex gap-2.5">
              <PrimaryPill className="flex-1" onClick={() => setSheetOpen(false)}>
                Appliquer
              </PrimaryPill>
              <SoftPill onClick={() => setSheetOpen(false)}>Réinitialiser</SoftPill>
            </div>
          </BottomSheet>
        </Sample>

        {/* SectionTitle */}
        <Sample name="SectionTitle">
          <SectionTitle action={{ label: 'Voir tout', onClick: () => {} }}>Derniers dépôts</SectionTitle>
        </Sample>

        {/* States */}
        <Sample name="ScreenLoader">
          <Card className="p-0">
            <ScreenLoader />
          </Card>
        </Sample>
        <Sample name="ScreenError">
          <Card className="p-0">
            <ScreenError description="Impossible de charger les données." onRetry={() => {}} />
          </Card>
        </Sample>
      </div>
    </div>
  );
}

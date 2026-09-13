/**
 * « Combien va coûter la sortie ? » — le coût à quai en six questions.
 *
 * La v0 de la manœuvre 1 (docs/strategy) : pas de lecture de proforma, pas
 * de nouvelle table. On répond à six questions en français, et l'écran rend
 * une fourchette honnête : le vert s'additionne, le jaune est une fourchette,
 * le rouge est une action. Depuis un dossier (?shipment=), le fret, le poids
 * et le port sont déjà remplis.
 */
import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCargoShipment } from '@/hooks/useCargo';
import { landedCost, rangeSentence, DEFAULT_XAF_PER, DEFAULT_PORT_DUES_XAF, type DutyBand, type Incoterm, type LandedCostInput } from '@/lib/cargo/landedCost';
import { cn } from '@/lib/utils';
import { TEXT, TYPE, SURFACE, Button, Card, FormField, Line, TextInput } from '@/mobile/designKit';
import { Pick } from './Pick';

const CURRENCIES = ['USD', 'CNY', 'EUR', 'XAF'] as const;
const INCOTERMS: readonly Incoterm[] = ['EXW', 'FOB', 'CFR', 'CIF'];
const INCOTERM_LABEL: Record<string, string> = { EXW: 'EXW — tout est à nous', FOB: 'FOB — le fret est à nous', CFR: 'CFR — fret compris', CIF: 'CIF — fret et assurance compris' };
const BANDS = ['0', '5', '10', '20', '30'] as const;
const BAND_HINT: Record<number, string> = {
  0: 'exempté', 5: 'première nécessité', 10: 'matières premières, biens d’équipement', 20: 'biens intermédiaires', 30: 'consommation courante',
};
const num = (v: string) => { const n = Number(v.replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : null; };
const fmt = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} XAF`;

export function MobileCargoCout({ desktop = false }: { desktop?: boolean } = {}) {
  const { hasPermission } = useAdminAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const shipmentId = params.get('shipment');
  const { data: s } = useCargoShipment(shipmentId);

  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>('USD');
  const [rate, setRate] = useState(String(DEFAULT_XAF_PER.USD));
  const [weight, setWeight] = useState('');
  const [incoterm, setIncoterm] = useState<Incoterm>('FOB');
  const [band, setBand] = useState<DutyBand>(10);
  const [vatExempt, setVatExempt] = useState<'oui' | 'non'>('non');
  const [freight, setFreight] = useState('');
  const [portDues, setPortDues] = useState(String(DEFAULT_PORT_DUES_XAF));
  const [besc, setBesc] = useState('');
  const [fees, setFees] = useState('');
  const [trucking, setTrucking] = useState('');
  const [prefilled, setPrefilled] = useState<string | null>(null);

  // Depuis un dossier : le fret, le poids et le port sont déjà là.
  if (s && prefilled !== s.id) {
    setPrefilled(s.id);
    if (s.freight_usd != null) setFreight(String(Math.round(s.freight_usd)));
    if (s.gross_weight_kg != null) setWeight(String(Math.round(Number(s.gross_weight_kg))));
    if (s.pod_unlocode === 'CMKBI') setPortDues('');
  }

  const pickCurrency = (c: (typeof CURRENCIES)[number]) => { setCurrency(c); setRate(String(DEFAULT_XAF_PER[c])); };

  const input: LandedCostInput | null = useMemo(() => {
    const a = num(amount), x = num(rate);
    if (a == null || x == null) return null;
    return {
      goodsAmount: a, currency, xafPerUnit: x, grossWeightKg: num(weight), incoterm, dutyBand: band, vatExempt: vatExempt === 'oui',
      freightUsd: num(freight), portDuesXaf: num(portDues), bescXaf: num(besc), fileFeesXaf: num(fees), truckingXaf: num(trucking),
    };
  }, [amount, currency, rate, weight, incoterm, band, vatExempt, freight, portDues, besc, fees, trucking]);
  const result = useMemo(() => (input ? landedCost(input) : null), [input]);

  if (!hasPermission('canViewCargo')) return <Navigate to="/m" replace />;

  return (
    <div className={desktop ? 'mx-auto max-w-2xl' : 'flex min-h-full flex-col'}>
      {!desktop && <MobileHeader title="Le coût à quai" showBack backTo={shipmentId ? `/m/cargo/${shipmentId}/couts` : '/m/cargo'} />}

      <div className={cn('flex flex-col gap-6 px-5 pb-10 pt-4', SURFACE.canvas)}>
        <Line>
          {s ? <>Pour le conteneur de <b className={TEXT.strong}>{s.client_label}</b> ({s.container_number}). </> : null}
          Six questions, et vous saurez ce que la sortie va coûter. Ce qui est sûr s'additionne, ce qui est estimé est une fourchette, ce qui est un risque est une action.
        </Line>

        <section className="space-y-4">
          <FormField label="1. Combien coûte la marchandise sur la proforma ?" htmlFor="lc-amount">
            <TextInput id="lc-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="6 057" className="text-[20px] font-semibold tabular-nums" />
          </FormField>
          <Pick options={CURRENCIES} value={currency} onChange={pickCurrency} label={(c) => c} />
          {currency !== 'XAF' && (
            <FormField label={`Un ${currency} vaut combien de XAF ?`} htmlFor="lc-rate">
              <TextInput id="lc-rate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} className="tabular-nums" />
            </FormField>
          )}

          <FormField label="2. Combien pèse-t-elle, en kilos (poids brut) ?" htmlFor="lc-weight">
            <TextInput id="lc-weight" inputMode="numeric" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="1 750" className="tabular-nums" />
          </FormField>

          <FormField label="3. Qu'est-ce qui est compris dans le prix ?">
            <Pick options={INCOTERMS} value={incoterm} onChange={setIncoterm} label={(v) => INCOTERM_LABEL[v]} />
          </FormField>

          <FormField label="4. Quel droit de douane pour ce produit ?">
            <Pick options={BANDS} value={String(band) as (typeof BANDS)[number]} onChange={(b) => setBand(Number(b) as DutyBand)} label={(b) => `${b} %`} />
            <Line className={cn('mt-2', TEXT.muted)}>{band} % : {BAND_HINT[band]}. Le taux vient du code SH du produit (tarif CEMAC).</Line>
          </FormField>

          <FormField label="5. La TVA est-elle exonérée pour ce produit ?">
            <Pick options={['non', 'oui'] as const} value={vatExempt} onChange={setVatExempt} label={(v) => (v === 'oui' ? 'Oui, exonérée' : 'Non, 19,25 %')} />
            <Line className={cn('mt-2', TEXT.muted)}>Oui si le code SH figure à l'annexe 1 du Code général des impôts (par exemple les tracteurs agricoles).</Line>
          </FormField>

          <FormField label="6. Le fret annoncé par le transitaire, en dollars (si vous l'avez)" htmlFor="lc-freight">
            <TextInput id="lc-freight" inputMode="decimal" value={freight} onChange={(e) => setFreight(e.target.value)} placeholder="Sinon, une fourchette" className="tabular-nums" />
          </FormField>

          <details className="group">
            <summary className={cn('cursor-pointer list-none text-[16px] font-semibold', TEXT.strong)}>Ce que vous connaissez en plus (facultatif)</summary>
            <div className="mt-3 space-y-3">
              <FormField label="Les droits de port du terminal, en XAF" htmlFor="lc-port" hint="77 000 à Douala (DIT). Vide : estimé.">
                <TextInput id="lc-port" inputMode="numeric" value={portDues} onChange={(e) => setPortDues(e.target.value)} className="tabular-nums" />
              </FormField>
              <FormField label="Le BESC, en XAF" htmlFor="lc-besc">
                <TextInput id="lc-besc" inputMode="numeric" value={besc} onChange={(e) => setBesc(e.target.value)} className="tabular-nums" />
              </FormField>
              <FormField label="Les frais de dossier et de documentation, en XAF" htmlFor="lc-fees">
                <TextInput id="lc-fees" inputMode="numeric" value={fees} onChange={(e) => setFees(e.target.value)} className="tabular-nums" />
              </FormField>
              <FormField label="Le camion jusqu'au client, en XAF" htmlFor="lc-truck">
                <TextInput id="lc-truck" inputMode="numeric" value={trucking} onChange={(e) => setTrucking(e.target.value)} className="tabular-nums" />
              </FormField>
            </div>
          </details>
        </section>

        {!result ? (
          <Line className={TEXT.muted}>Le résultat s'écrit ici dès que le montant de la marchandise est saisi.</Line>
        ) : (
          <section className="space-y-4">
            <Card className="space-y-3">
              <p className={cn(TYPE.lead, TEXT.strong)}>À prévoir : {rangeSentence(result.total.low, result.total.high)}</p>
              <Line className={TEXT.muted}>
                Dont la valeur en douane : {rangeSentence(result.customsValue.low, result.customsValue.high)} (marchandise, fret et assurance — c'est sur elle que la douane calcule).
              </Line>
              <ul className={cn('divide-y', SURFACE.divider)}>
                {result.lines.map((l) => (
                  <li key={l.key} className="flex items-start gap-3 py-2.5">
                    <span aria-hidden className={cn('mt-2 inline-block h-3 w-3 shrink-0 rounded-full', l.confidence === 'certain' ? 'bg-[#14AE5C]' : 'bg-[#E8B931]')} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className={cn('text-[16px] font-semibold', TEXT.strong)}>{l.label}</span>
                        <span className={cn('text-[16px] font-semibold tabular-nums', TEXT.strong)}>{l.note ?? rangeSentence(l.low, l.high)}</span>
                      </span>
                      <span className={cn('block text-[16px] leading-snug', TEXT.muted)}>{l.why}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <Line className={TEXT.muted}>Vert : sûr. Jaune : estimé, en fourchette.</Line>
            </Card>

            <Card className="space-y-2">
              <p className={cn(TYPE.lead, TEXT.strong)}>Ce qui dépend de la vitesse</p>
              <Line>
                Le conteneur a <b className={TEXT.strong}>{result.freeDays} jours</b> au port sans frais. Au-delà, chaque jour coûte environ <b className={TEXT.strong}>{fmt(result.demurragePerDayXaf)}</b>. Ce n'est pas dans le total : cela dépend de vous.
              </Line>
            </Card>

            <Card className="space-y-2">
              <p className={cn(TYPE.lead, 'text-[#C00F0C] dark:text-[#EC221F]')}>Pour ne pas payer plus</p>
              <ul className="space-y-2">
                {result.actions.map((a) => <li key={a}><Line>{a}</Line></li>)}
              </ul>
            </Card>

            {result.caveats.length > 0 && (
              <div className="space-y-1">
                <p className={cn('text-[16px] font-semibold', TEXT.strong)}>Ce qui n'est pas compté</p>
                {result.caveats.map((k) => <Line key={k} className={TEXT.muted}>{k}</Line>)}
              </div>
            )}

            {s && (
              <Button variant="neutral" className="w-full" onClick={() => navigate(`/m/cargo/${s.id}/couts`)}>Revenir aux coûts du dossier</Button>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

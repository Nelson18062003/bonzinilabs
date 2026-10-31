/**
 * « Combien va coûter la sortie ? » — le coût à quai en six questions.
 *
 * La v0 de la manœuvre 1 (docs/strategy) : pas de lecture de proforma, pas
 * de nouvelle table. On répond à six questions en français, et l'écran rend
 * une fourchette honnête : le vert s'additionne, le jaune est une fourchette,
 * le rouge est une action. Depuis un dossier (?shipment=), le fret, le poids
 * et le port sont déjà remplis.
 *
 * Refonte v2 (maquette 10/36), sur téléphone seulement : les six questions,
 * puis la fourchette en grand et chaque poste marqué Sûr, Estimé ou Risque ;
 * « Revoir les 6 réponses » en bas. L'ordinateur (`desktop`) est inchangé.
 */
import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCargoShipment } from '@/hooks/useCargo';
import { landedCost, rangeSentence, DEFAULT_XAF_PER, DEFAULT_PORT_DUES_XAF, type DutyBand, type Incoterm, type LandedCostInput } from '@/lib/cargo/landedCost';
import { cn } from '@/lib/utils';
import { Anchor, CalendarDays, CircleDollarSign, FileText, Landmark, Package, Shield, ShieldAlert, Ship, Truck } from 'lucide-react';
import {
  TEXT, TYPE, SURFACE, BigButton, BottomSheet, Button, Card, Chip, Dock, FormField, IconCircle, ItemList, ItemRow, Line, ScreenTop, TextInput, type Tone,
} from '@/mobile/designKit';
import { CapsLabel, UnitField } from '@/mobile/components/cargo/v2';
import { boxNo } from './fleet';
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
/** « 9,8 à 10,1 M » : la fourchette du total, en millions. */
const millions = (n: number) => (n / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
const bigRange = (lo: number, hi: number) => (millions(lo) === millions(hi) ? `${millions(hi)} M` : `${millions(lo)} à ${millions(hi)} M`);
/** « 450 à 650 k », « 5 040 000 » : une ligne, compacte. */
const kilo = (n: number) => (n >= 1_000_000 ? `${millions(n)} M` : n >= 10_000 ? `${Math.round(n / 1000).toLocaleString('fr-FR')} k` : Math.round(n).toLocaleString('fr-FR'));
const shortRange = (lo: number, hi: number) => (lo === hi ? Math.round(hi).toLocaleString('fr-FR') : `${kilo(lo)} à ${kilo(hi)}`);
/** « Le droit de douane, 30 % » → « Droit de douane 30 % ». */
const plainLabel = (l: string) => { const t = l.replace(/^(Le |La |Les |L')/, '').replace(', environ ', ' ~').replace(', ', ' '); return t.charAt(0).toUpperCase() + t.slice(1); };
const LINE_ICON: Record<string, React.ElementType> = { goods: Package, freight: Ship, insurance: Shield, duty: Shield, vat: CircleDollarSign, other: Landmark, port: Anchor, stamp: FileText, besc: FileText, fees: FileText, trucking: Truck };

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
  const [view, setView] = useState<'form' | 'result'>('form');
  const [sheet, setSheet] = useState<'extra' | 'actions' | 'caveats' | null>(null);
  const [openLine, setOpenLine] = useState<string | null>(null);

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

  if (desktop) return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-2 px-5 pt-4">
        <h2 className={cn('text-[24px] font-bold tracking-tight', TEXT.strong)}>Le coût à quai</h2>
      </header>

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

  // ── Téléphone (v2) ─────────────────────────────────────────────────────
  const back = shipmentId ? `/m/cargo/${shipmentId}/couts` : '/m/cargo';
  const showResult = view === 'result' && !!result;
  const kg = num(weight);
  const head = [s ? `Pour ${boxNo(s.container_number)}` : null, incoterm, kg ? `${Math.round(kg).toLocaleString('fr-FR')} kg` : null].filter(Boolean).join(' · ');
  const conf = (c: string): { tone: Tone; label: string } => (c === 'certain' ? { tone: 'success', label: 'Sûr' } : { tone: 'pending', label: 'Estimé' });
  const open = openLine ? result?.lines.find((l) => l.key === openLine) ?? null : null;

  return (
    <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
      <ScreenTop title="Le coût à quai" onBack={showResult ? () => setView('form') : undefined} backTo={showResult ? undefined : back} />
      {showResult && result ? (
        <>
          <div className="flex-1 pb-6 pt-6">
            <div className="px-5 text-center">
              {head && <p className={cn('text-[15px]', TEXT.muted)}>{head}</p>}
              <p className="mt-2">
                <span className={cn('text-[44px] font-bold leading-none tracking-[-0.03em] tabular-nums', TEXT.strong)}>{bigRange(result.total.low, result.total.high)}</span>
                <span className={cn('ml-2 text-[22px] font-semibold', TEXT.muted)}>XAF</span>
              </p>
              <p className={cn('mt-2 text-[15px] tabular-nums', TEXT.muted)}>Valeur en douane {shortRange(result.customsValue.low, result.customsValue.high)}</p>
            </div>
            <ItemList className="mt-4">
              {result.lines.map((l) => (
                <ItemRow
                  key={l.key}
                  leading={<IconCircle icon={LINE_ICON[l.key] ?? FileText} />}
                  title={plainLabel(l.label)}
                  subtitle={l.note}
                  amount={l.note ? undefined : shortRange(l.low, l.high)}
                  tag={conf(l.confidence)}
                  onClick={() => setOpenLine(l.key)}
                />
              ))}
              <ItemRow
                leading={<IconCircle icon={CalendarDays} />}
                title={`Franchise ${result.freeDays} jours`}
                subtitle={`Puis ≈ ${fmt(result.demurragePerDayXaf)} / jour`}
                tag={{ tone: 'danger', label: 'Risque' }}
                onClick={() => setSheet('actions')}
              />
              {result.caveats.length > 0 && <ItemRow leading={<IconCircle icon={ShieldAlert} />} title="Pas compté" subtitle={`${result.caveats.length} point${result.caveats.length > 1 ? 's' : ''}`} onClick={() => setSheet('caveats')} chevron />}
              {s && <ItemRow leading={<IconCircle icon={CircleDollarSign} />} title="Coûts du dossier" onClick={() => navigate(`/m/cargo/${s.id}/couts`)} chevron />}
            </ItemList>
          </div>
          <Dock><BigButton variant="soft" onClick={() => setView('form')}>Revoir les 6 réponses</BigButton></Dock>
        </>
      ) : (
        <>
          <div className="flex-1 space-y-6 px-5 pb-6 pt-5">
            {s && <p className={cn('text-[15px]', TEXT.muted)}>{s.client_label} · {boxNo(s.container_number)}</p>}
            <div>
              <CapsLabel as="label">1 · La marchandise (proforma)</CapsLabel>
              <UnitField className="mt-2" unit={currency} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="6 057" aria-label="Montant de la proforma" />
              <div className="mt-2.5 flex flex-wrap gap-2">{CURRENCIES.map((c) => <Chip key={c} active={c === currency} onClick={() => pickCurrency(c)} label={c} />)}</div>
              {currency !== 'XAF' && (
                <div className="mt-3"><CapsLabel as="label">1 {currency} =</CapsLabel><UnitField className="mt-2" unit="XAF" value={rate} onChange={(e) => setRate(e.target.value)} aria-label={`Un ${currency} en XAF`} /></div>
              )}
            </div>
            <div><CapsLabel as="label">2 · Poids brut</CapsLabel><UnitField className="mt-2" unit="kg" inputMode="numeric" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="1 750" aria-label="Poids brut" /></div>
            <div>
              <CapsLabel>3 · Compris dans le prix</CapsLabel>
              <div className="mt-2.5 flex flex-wrap gap-2">{INCOTERMS.map((v) => <Chip key={v} active={v === incoterm} onClick={() => setIncoterm(v)} label={v} />)}</div>
              <p className={cn('mt-2 text-[15px]', TEXT.muted)}>{INCOTERM_LABEL[incoterm].split('— ')[1]}</p>
            </div>
            <div>
              <CapsLabel>4 · Droit de douane</CapsLabel>
              <div className="mt-2.5 flex flex-wrap gap-2">{BANDS.map((b) => <Chip key={b} active={Number(b) === band} onClick={() => setBand(Number(b) as DutyBand)} label={`${b} %`} />)}</div>
              <p className={cn('mt-2 text-[15px]', TEXT.muted)}>{BAND_HINT[band]}</p>
            </div>
            <div>
              <CapsLabel>5 · TVA exonérée ?</CapsLabel>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <Chip active={vatExempt === 'non'} onClick={() => setVatExempt('non')} label="Non · 19,25 %" />
                <Chip active={vatExempt === 'oui'} onClick={() => setVatExempt('oui')} label="Oui" />
              </div>
            </div>
            <div><CapsLabel as="label">6 · Fret annoncé</CapsLabel><UnitField className="mt-2" unit="USD" value={freight} onChange={(e) => setFreight(e.target.value)} placeholder="Si connu" aria-label="Fret annoncé en USD" /></div>
            <ItemList className="-mx-5">
              <ItemRow leading={<IconCircle icon={Anchor} />} title="Ce que vous savez en plus" subtitle="Port, BESC, dossier, camion" onClick={() => setSheet('extra')} chevron />
            </ItemList>
          </div>
          <Dock><BigButton onClick={() => setView('result')} disabled={!result}>Voir le coût</BigButton></Dock>
        </>
      )}

      <BottomSheet open={sheet === 'extra'} onClose={() => setSheet(null)} title="En plus">
        <div className="space-y-4">
          <div><CapsLabel as="label">Droits de port</CapsLabel><UnitField className="mt-2" unit="XAF" inputMode="numeric" value={portDues} onChange={(e) => setPortDues(e.target.value)} placeholder="Estimé" aria-label="Droits de port" /></div>
          <div><CapsLabel as="label">BESC</CapsLabel><UnitField className="mt-2" unit="XAF" inputMode="numeric" value={besc} onChange={(e) => setBesc(e.target.value)} aria-label="BESC" /></div>
          <div><CapsLabel as="label">Frais de dossier</CapsLabel><UnitField className="mt-2" unit="XAF" inputMode="numeric" value={fees} onChange={(e) => setFees(e.target.value)} aria-label="Frais de dossier" /></div>
          <div><CapsLabel as="label">Camion jusqu'au client</CapsLabel><UnitField className="mt-2" unit="XAF" inputMode="numeric" value={trucking} onChange={(e) => setTrucking(e.target.value)} aria-label="Camion" /></div>
          <BigButton onClick={() => setSheet(null)}>OK</BigButton>
        </div>
      </BottomSheet>
      <BottomSheet open={sheet === 'actions' && !!result} onClose={() => setSheet(null)} title="Pour ne pas payer plus">
        {result && (
          <ul className="space-y-3">
            <li className={cn('text-[16px] font-semibold', TEXT.strong)}>{result.freeDays} jours sans frais, puis ≈ {fmt(result.demurragePerDayXaf)} par jour.</li>
            {result.actions.map((x) => <li key={x} className={cn('text-[16px]', TEXT.body)}>{x}</li>)}
          </ul>
        )}
      </BottomSheet>
      <BottomSheet open={sheet === 'caveats' && !!result} onClose={() => setSheet(null)} title="Pas compté">
        {result && <ul className="space-y-3">{result.caveats.map((k) => <li key={k} className={cn('text-[16px]', TEXT.body)}>{k}</li>)}</ul>}
      </BottomSheet>
      <BottomSheet open={!!open} onClose={() => setOpenLine(null)} title={open ? plainLabel(open.label) : ''}>
        {open && (
          <div className="space-y-2">
            <p className={cn('text-[22px] font-bold tabular-nums', TEXT.strong)}>{open.note ?? rangeSentence(open.low, open.high)}</p>
            <p className={cn('text-[16px]', TEXT.body)}>{open.why}</p>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

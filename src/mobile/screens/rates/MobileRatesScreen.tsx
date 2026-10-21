/**
 * Taux du jour — l'accueil du module (refonte v2, maquette 08-taux/01 et 02).
 *
 * Façon Wave : le chiffre qui compte (Alipay pour 1 000 000 XAF), quatre gros
 * ronds (Publier, Simuler, Flyer, Marché), puis les taux du Cameroun avec
 * ceux de la publication précédente. Le reste est dans « … » : taux par pays,
 * écarts et paliers, historique, copie du texte du jour.
 *
 * Sans `canManageRates` : ni Publier, ni Marché, ni réglages ; simulateur,
 * historique, pays et flyer restent en lecture.
 */
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowUpToLine, Calculator, Copy, FileText, Globe, History, Layers, TrendingUp } from 'lucide-react';
import { PullToRefresh } from '@/mobile/components/ui/PullToRefresh';
import {
  ActionCircles, ActionSheet, EmptyLine, HeroFigure, ItemList, ItemRow, RoundButton, ScreenError, ScreenLoader, SectionHead, useSheet,
  type CircleAction, type SheetAction,
} from '@/mobile/designKit';
import { MoreHorizontal } from 'lucide-react';
import { REFERENCE_COUNTRY_KEY } from '@/lib/countryRates';
import { buildFlyerData, flyerCaption, type FlyerLang } from '@/lib/rateFlyer';
import { GroupCircle, ModuleTop } from './parts';
import { dayLabel, hm, nb, rateGroups, signed } from './rateFormat';
import { useRatesData } from './useRatesData';

function savedFlyerLang(): FlyerLang {
  try { return localStorage.getItem('bz.flyer.lang') === 'en' ? 'en' : 'fr'; } catch { return 'fr'; }
}

export function MobileRatesScreen() {
  const navigate = useNavigate();
  const more = useSheet();
  const { activeRate, previous, base, prevBase, adjustments, sheets, isLoading, isError, canManage, refetch } = useRatesData();

  const go = (path: string) => () => navigate(path);

  const actions: CircleAction[] = canManage
    ? [
        { label: 'Publier', icon: ArrowUpToLine, onClick: go('/m/more/rates/publish'), primary: true },
        { label: 'Simuler', icon: Calculator, onClick: go('/m/more/rates/simulator') },
        { label: 'Flyer', icon: FileText, onClick: go('/m/more/rates/flyer') },
        { label: 'Marché', icon: TrendingUp, onClick: go('/m/more/rates/market') },
      ]
    : [
        { label: 'Simuler', icon: Calculator, onClick: go('/m/more/rates/simulator'), primary: true },
        { label: 'Flyer', icon: FileText, onClick: go('/m/more/rates/flyer') },
        { label: 'Historique', icon: History, onClick: go('/m/more/rates/history') },
      ];

  const copyText = async () => {
    if (!activeRate) { toast.error('Aucun taux publié'); return; }
    const flyer = buildFlyerData(activeRate, adjustments, REFERENCE_COUNTRY_KEY, new Date(), savedFlyerLang());
    try {
      await navigator.clipboard.writeText(flyerCaption(flyer));
      toast.success('Texte copié');
    } catch {
      toast.error('Copie impossible sur cet appareil');
    }
  };

  const menu: SheetAction[] = [
    { label: 'Taux par pays', hint: sheets.length > 1 ? `Cameroun et ${sheets.length - 1} pays` : undefined, icon: Globe, onClick: go('/m/more/rates/countries') },
    { label: 'Écarts pays et paliers', icon: Layers, onClick: go('/m/more/rates/settings'), hidden: !canManage },
    { label: 'Historique des taux', icon: History, onClick: go('/m/more/rates/history') },
    { label: 'Copier les taux en texte', hint: 'Pour WhatsApp', icon: Copy, onClick: () => void copyText() },
  ];

  // « +26 sur hier » : écart avec la publication précédente, nommée par son jour.
  const delta = base && prevBase ? base.alipay - prevBase.alipay : null;
  const prevDay = previous ? dayLabel(previous.effective_at) : null;
  const deltaLabel = delta != null && prevDay
    ? <><b className="font-bold">{signed(delta)}</b> {prevDay === 'Hier' ? 'sur hier' : `sur le ${prevDay}`}</>
    : null;
  const prevWord = prevDay === 'Hier' ? 'Hier' : prevDay ?? '';

  return (
    <div className="flex min-h-full flex-col pb-4">
      <ModuleTop
        title="Taux du jour"
        backTo="/m/more"
        right={<RoundButton icon={MoreHorizontal} ariaLabel="Plus d'actions" onClick={more.show} />}
      />

      <PullToRefresh onRefresh={async () => { await refetch(); }}>
        {isLoading ? (
          <ScreenLoader />
        ) : isError ? (
          <ScreenError title="Taux indisponibles" description="Réessayez dans un instant." />
        ) : (
          <>
            <div className="px-5 pt-3.5">
              {activeRate && base ? (
                <HeroFigure
                  label="Alipay · pour 1 000 000 XAF"
                  value={<>¥&nbsp;{nb(base.alipay)}</>}
                  sub={[deltaLabel, `Depuis ${hm(activeRate.effective_at)}`].filter(Boolean)}
                />
              ) : (
                <HeroFigure label="Taux du jour" value="—" sub={['Aucun taux publié']} />
              )}
            </div>

            <ActionCircles actions={actions} />

            <SectionHead
              title="Cameroun"
              link={sheets.length > 1 ? { label: `${sheets.length} pays`, onClick: go('/m/more/rates/countries') } : undefined}
            />
            {base ? (
              <ItemList>
                {rateGroups(base, prevBase).map((g) => (
                  <ItemRow
                    key={g.key}
                    leading={<GroupCircle methods={g.methods} />}
                    title={g.label}
                    subtitle={g.prev != null && prevWord ? `${prevWord} ${nb(g.prev)}` : undefined}
                    amount={<>¥&nbsp;{nb(g.value)}</>}
                  />
                ))}
              </ItemList>
            ) : (
              <EmptyLine action={canManage ? { label: 'Publier les taux', onClick: go('/m/more/rates/publish') } : undefined}>
                Aucun taux publié
              </EmptyLine>
            )}
          </>
        )}
      </PullToRefresh>

      <ActionSheet open={more.open} onClose={more.hide} actions={menu} />
    </div>
  );
}

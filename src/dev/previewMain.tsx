// Dev-only entry for the Accueil design previews. Loaded by /preview.html.
// ?v=1|2 = base layouts; ?v=p1|p2 = premium balance-card iterations.
// ?t=light|dark selects the theme.
import { createRoot } from 'react-dom/client';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/dm-sans/800.css';
import '@fontsource/dm-sans/900.css';
import '../index.css';
import S1 from './WalletPreviewS1';
import S2 from './WalletPreviewS2';
import Premium from './WalletPreviewPremium';
import DepositPreviews from './DepositPreviews';
import PaymentPreviews from './PaymentPreviews';
import HistoryPreviews from './HistoryPreviews';

const params = new URLSearchParams(location.search);
const v = params.get('v') ?? '1';
const theme = (params.get('t') ?? 'light') as 'light' | 'dark';

let node;
if (v.startsWith('dep-')) node = <DepositPreviews screen={v.slice(4)} />;
else if (v.startsWith('pay-')) node = <PaymentPreviews screen={v.slice(4)} />;
else if (v.startsWith('hist-')) node = <HistoryPreviews screen={v.slice(5)} />;
else if (v === 'p1') node = <Premium theme={theme} card="1" />;
else if (v === 'p2') node = <Premium theme={theme} card="2" />;
else if (v === '2') node = <S2 theme={theme} />;
else node = <S1 theme={theme} />;

createRoot(document.getElementById('root')!).render(node);

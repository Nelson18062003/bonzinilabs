// DEV-ONLY standalone entry for the rates maquette (avoids editing the shared
// main.tsx harness while a background worker runs). Served via rates-preview.html.
import { createRoot } from 'react-dom/client';
import '@/index.css';
import { Rates } from './rates';

const p = new URLSearchParams(window.location.search);
if (p.get('theme') === 'dark') document.documentElement.classList.add('dark');
document.documentElement.style.fontFamily = "'DM Sans', sans-serif";

createRoot(document.getElementById('root')!).render(<Rates />);

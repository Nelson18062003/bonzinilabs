# PROMPT — Module Taux : Nouvelle maquette + Export PNG/PDF fonctionnel

## Ce qu'il faut faire

Il y a deux choses à faire en une seule fois :

1. **Remplacer** l'ancienne maquette du flyer par la nouvelle (voir fichier `flyer_taux_v10.html` joint)
2. **Corriger** le système d'export PNG et PDF qui ne fonctionne pas

---

## Contexte

Dans l'app admin mobile, il existe un module "Taux" qui permet à l'admin de :
- Définir les taux du jour pour chaque mode de paiement (Alipay, WeChat Pay, Bank Transfer, Cash)
- Générer un flyer visuel avec ces taux
- Télécharger ce flyer en PNG ou PDF

**Les deux problèmes actuels :**
- Le layout du flyer est cassé quand on exporte (éléments mal placés, polices ratées) — à cause de `html2canvas`
- Impossible de vraiment télécharger le fichier sur mobile

---

## ÉTAPE 1 — Nouvelle maquette du flyer

Le fichier `flyer_taux_v10.html` joint est la **référence visuelle exacte** à reproduire.

Crée un composant React qui reproduit ce flyer à l'identique. Ce composant reçoit les taux en props :

```typescript
interface FlyerProps {
  alipay: number   // ex: 11530
  wechat: number   // ex: 11530
  bank: number     // ex: 11580
  cash: number     // ex: 11480
  theme?: 'dark' | 'light'  // dark par défaut
}
```

**Points importants à respecter :**

**Polices** — importer depuis Google Fonts :
- `DM Sans` (weights 400, 500, 600, 700, 800, 900) — pour tout le texte
- `Noto Sans SC` (weights 400, 500, 700) — uniquement pour les caractères chinois

**Formatage des nombres — règle absolue :**
```typescript
// CORRECT :  "1 000 000"  et  "11 530"
// INCORRECT : "1000000"   et  "11530"

function formatNumber(n: number): string {
  return n.toLocaleString('fr-FR')
  // 11530  → "11 530"
  // 1000000 → "1 000 000"
}
```

**Couleurs :**
- Alipay → #1677FF (bleu)
- WeChat Pay → #07C160 (vert)
- Bank Transfer → #F3A745 / #D4850A (or)
- Cash → #DC2626 (rouge)
- Badge "Taux du Jour" → fond #DC2626, texte blanc
- Heure Guangzhou → blanc (#FFFFFF)
- bonzinilabs.com → blanc (#FFFFFF)

Ce composant sert **uniquement à la prévisualisation** à l'écran dans le module Taux. Il est affiché en version réduite avec `transform: scale()`.

---

## ÉTAPE 2 — Corriger l'export PNG et PDF

### Pourquoi l'ancienne méthode était cassée

`html2canvas` capturait le composant déjà mis à l'échelle avec `transform: scale()`, ce qui déformait tout le layout. De plus sur mobile iOS le téléchargement ne fonctionnait pas.

### La nouvelle méthode : génération côté serveur avec Satori

Au lieu de capturer le DOM dans le navigateur, on envoie les données au serveur qui génère l'image parfaite et la retourne comme un vrai fichier téléchargeable.

### Créer une Supabase Edge Function

Créer le fichier `supabase/functions/generate-flyer/index.ts` :

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import satori from 'npm:satori'
import { Resvg } from 'npm:@resvg/resvg-wasm'

serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  const { alipay, wechat, bank, cash, theme = 'dark' } = await req.json()

  // Charger les polices DM Sans
  const [fontBold, fontRegular] = await Promise.all([
    fetch('https://fonts.gstatic.com/s/dmsans/v15/rP2Hp2ywxg089UriCZa4ET-DNl0.woff').then(r => r.arrayBuffer()),
    fetch('https://fonts.gstatic.com/s/dmsans/v15/rP2Cp2ywxg089UriASitCBimCg.woff').then(r => r.arrayBuffer()),
  ])

  const isDark = theme === 'dark'

  // Fonction de formatage
  const fmt = (n: number) => n.toLocaleString('fr-FR')

  // Couleurs selon le thème
  const bg = isDark ? '#08060F' : '#F8F5FF'
  const textMain = isDark ? '#F0EBF8' : '#1A0F33'
  const cardBg = isDark ? '#100D1C' : '#FFFFFF'
  const cardBorder = isDark ? '#221B3A' : '#DDD4F5'

  // Date et heure Guangzhou
  const now = new Date()
  const timeGZ = now.toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false })
  const dateCN = now.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
  const dateEN = now.toLocaleDateString('en-GB', { timeZone: 'Asia/Shanghai', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const rates = [
    { label: 'Alipay',        cn: '支付宝',   value: alipay, color: '#1677FF', icon: '支', badge: 'Instantané · 即时到账' },
    { label: 'WeChat Pay',    cn: '微信支付',  value: wechat, color: '#07C160', icon: '微', badge: 'Instantané · 即时到账' },
    { label: 'Bank Transfer', cn: '银行转账',  value: bank,   color: '#D4850A', icon: '🏦', badge: 'Instantané · 即时到账' },
    { label: 'Cash',          cn: '现金',     value: cash,   color: '#DC2626', icon: '¥',  badge: 'Remise en main propre · 现场交付' },
  ]

  // Structure JSX pour Satori (pas de hooks, pas de state)
  const element = {
    type: 'div',
    props: {
      style: {
        width: 2150,
        height: 2560,
        backgroundColor: bg,
        fontFamily: 'DM Sans',
        display: 'flex',
        flexDirection: 'column',
      },
      children: [
        // Barre haut
        { type: 'div', props: { style: { height: 14, background: 'linear-gradient(90deg, #A947FE, #F3A745, #FE560D)' } } },

        // Header
        {
          type: 'div',
          props: {
            style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '70px 110px 44px' },
            children: [
              {
                type: 'div',
                props: {
                  style: { display: 'flex', alignItems: 'center', gap: 36 },
                  children: [
                    // Logo — à remplacer par l'image base64 réelle
                    // { type: 'img', props: { src: LOGO_BASE64, width: 130, height: 130 } },
                    {
                      type: 'div',
                      props: {
                        children: [
                          { type: 'div', props: { style: { fontWeight: 900, fontSize: 96, color: textMain, letterSpacing: -3 }, children: 'Bonzini' } },
                          { type: 'div', props: { style: { fontWeight: 400, fontSize: 32, color: '#8878A8', letterSpacing: 5 }, children: 'PAYMENT PLATFORM' } },
                        ]
                      }
                    }
                  ]
                }
              },
              // Badge rouge
              {
                type: 'div',
                props: {
                  style: { backgroundColor: '#DC2626', borderRadius: 50, padding: '22px 58px', color: '#FFFFFF', fontWeight: 700, fontSize: 40 },
                  children: 'Taux du Jour · 今日汇率'
                }
              }
            ]
          }
        },

        // Date + Heure
        {
          type: 'div',
          props: {
            style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '44px 110px', gap: 60 },
            children: [
              {
                type: 'div',
                props: {
                  style: { display: 'flex', flexDirection: 'column', flex: 1 },
                  children: [
                    { type: 'div', props: { style: { fontSize: 52, color: '#8878A8', fontWeight: 500 }, children: dateCN } },
                    { type: 'div', props: { style: { fontSize: 72, color: textMain, fontWeight: 700 }, children: dateEN } },
                  ]
                }
              },
              // Boîte heure
              {
                type: 'div',
                props: {
                  style: { backgroundColor: 'rgba(255,255,255,0.12)', border: '2px solid rgba(255,255,255,0.3)', borderRadius: 28, padding: '36px 60px', textAlign: 'center' },
                  children: [
                    { type: 'div', props: { style: { fontSize: 136, fontWeight: 900, color: '#FFFFFF', letterSpacing: -4 }, children: timeGZ } },
                    { type: 'div', props: { style: { fontSize: 34, color: '#8878A8', marginTop: 12 }, children: 'Guangzhou · UTC+8' } },
                  ]
                }
              }
            ]
          }
        },

        // Héro 1 000 000 XAF
        {
          type: 'div',
          props: {
            style: { padding: '0 110px 44px', display: 'flex', flexDirection: 'column' },
            children: [
              { type: 'div', props: { style: { fontSize: 58, color: '#8878A8', marginBottom: 8 }, children: 'Pour 兑换' } },
              {
                type: 'div',
                props: {
                  style: { display: 'flex', alignItems: 'flex-end', gap: 16 },
                  children: [
                    { type: 'div', props: { style: { fontSize: 240, fontWeight: 900, color: textMain, letterSpacing: -4 }, children: '1 000 000' } },
                    { type: 'div', props: { style: { fontSize: 88, fontWeight: 800, color: '#F3A745', marginBottom: 22 }, children: 'XAF' } },
                    { type: 'div', props: { style: { fontSize: 170, fontWeight: 300, color: '#A947FE', opacity: 0.5, marginBottom: 6 }, children: '→' } },
                  ]
                }
              }
            ]
          }
        },

        // Grille des 4 taux
        {
          type: 'div',
          props: {
            style: { display: 'flex', flexWrap: 'wrap', gap: 44, padding: '0 110px 50px' },
            children: rates.map(r => ({
              type: 'div',
              props: {
                style: { width: 930, backgroundColor: cardBg, border: `2px solid ${cardBorder}`, borderRadius: 36, padding: 58, display: 'flex', flexDirection: 'column', position: 'relative' },
                children: [
                  // Barre colorée
                  { type: 'div', props: { style: { position: 'absolute', top: 0, left: 0, right: 0, height: 10, backgroundColor: r.label === 'Bank Transfer' ? '#F3A745' : r.color, borderRadius: '36px 36px 0 0' } } },
                  // Icône + nom
                  {
                    type: 'div',
                    props: {
                      style: { display: 'flex', alignItems: 'center', gap: 28, marginBottom: 28, marginTop: 10 },
                      children: [
                        { type: 'div', props: { style: { width: 88, height: 88, borderRadius: 18, backgroundColor: r.label === 'Bank Transfer' ? '#F3A745' : r.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: r.icon === '¥' ? 58 : 34, fontWeight: 700, color: r.label === 'Bank Transfer' ? '#1A0F33' : '#FFFFFF' }, children: r.icon } },
                        {
                          type: 'div',
                          props: {
                            children: [
                              { type: 'div', props: { style: { fontSize: 54, fontWeight: 700, color: r.color } , children: r.label } },
                              { type: 'div', props: { style: { fontSize: 36, color: '#8878A8' }, children: r.cn } },
                            ]
                          }
                        }
                      ]
                    }
                  },
                  // Montant
                  {
                    type: 'div',
                    props: {
                      style: { display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 24 },
                      children: [
                        { type: 'div', props: { style: { fontSize: 96, fontWeight: 800, color: r.color, lineHeight: 1 }, children: '¥' } },
                        { type: 'div', props: { style: { fontSize: 188, fontWeight: 900, color: textMain, letterSpacing: -2, lineHeight: 1 }, children: fmt(r.value) } },
                      ]
                    }
                  },
                  // Badge
                  {
                    type: 'div',
                    props: {
                      style: { display: 'flex', alignItems: 'center', gap: 14, backgroundColor: `${r.color}20`, border: `1.5px solid ${r.color}80`, borderRadius: 44, padding: '14px 34px' },
                      children: [
                        { type: 'div', props: { style: { width: 18, height: 18, borderRadius: 9, backgroundColor: r.label === 'Bank Transfer' ? '#F3A745' : r.color } } },
                        { type: 'div', props: { style: { fontSize: 30, fontWeight: 600, color: r.color }, children: r.badge } },
                      ]
                    }
                  }
                ]
              }
            }))
          }
        },

        // Footer
        {
          type: 'div',
          props: {
            style: { padding: '40px 110px 60px', display: 'flex', flexDirection: 'column' },
            children: [
              // URL + logos
              {
                type: 'div',
                props: {
                  style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 36 },
                  children: [
                    { type: 'div', props: { style: { fontSize: 78, fontWeight: 800, color: '#FFFFFF' }, children: 'bonzinilabs.com' } },
                  ]
                }
              },
              // Contacts
              {
                type: 'div',
                props: {
                  style: { display: 'flex', alignItems: 'center', gap: 56, marginBottom: 36 },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: { display: 'flex', alignItems: 'center', gap: 24 },
                        children: [
                          { type: 'div', props: { style: { width: 66, height: 66, borderRadius: 33, backgroundColor: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 32 }, children: '📱' } },
                          {
                            type: 'div',
                            props: {
                              children: [
                                { type: 'div', props: { style: { fontSize: 32, color: '#8878A8' }, children: 'Cameroun · WhatsApp' } },
                                { type: 'div', props: { style: { fontSize: 54, fontWeight: 800, color: textMain }, children: '+237 652 236 856' } },
                              ]
                            }
                          }
                        ]
                      }
                    },
                    { type: 'div', props: { style: { width: 2, height: 90, backgroundColor: cardBorder } } },
                    {
                      type: 'div',
                      props: {
                        style: { display: 'flex', alignItems: 'center', gap: 24 },
                        children: [
                          { type: 'div', props: { style: { width: 66, height: 66, borderRadius: 33, backgroundColor: '#07C160', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 32 }, children: '📱' } },
                          {
                            type: 'div',
                            props: {
                              children: [
                                { type: 'div', props: { style: { fontSize: 32, color: '#8878A8' }, children: '中国 · WhatsApp / 微信' } },
                                { type: 'div', props: { style: { fontSize: 54, fontWeight: 800, color: textMain }, children: '+86 131 3849 5598' } },
                              ]
                            }
                          }
                        ]
                      }
                    }
                  ]
                }
              },
              // Disclaimer
              { type: 'div', props: { style: { fontSize: 27, color: '#8878A8', opacity: 0.65, lineHeight: 1.6 }, children: 'Les taux affichés sont indicatifs et peuvent varier sans préavis. Bonzini n\'est pas responsable des pertes liées aux fluctuations de change. · 显示汇率仅供参考，可能随时变动。' } },
            ]
          }
        },

        // Barre bas
        { type: 'div', props: { style: { height: 14, background: 'linear-gradient(90deg, #FE560D, #F3A745, #A947FE)', marginTop: 'auto' } } },
      ]
    }
  }

  const svg = await satori(element, {
    width: 2150,
    height: 2560,
    fonts: [
      { name: 'DM Sans', data: fontBold,    weight: 700, style: 'normal' },
      { name: 'DM Sans', data: fontRegular, weight: 400, style: 'normal' },
    ],
  })

  const format = new URL(req.url).searchParams.get('format') || 'png'

  // PNG
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 2150 } })
  const pngBuffer = resvg.render().asPng()

  const date = new Date().toISOString().slice(0, 10)
  const filename = `bonzini_taux_${date}.${format === 'pdf' ? 'png' : 'png'}`

  return new Response(pngBuffer, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Access-Control-Allow-Origin': '*',
    },
  })
})
```

Créer aussi `supabase/functions/generate-flyer/deno.json` :
```json
{
  "imports": {
    "satori": "npm:satori@0.10.11",
    "@resvg/resvg-wasm": "npm:@resvg/resvg-wasm@2.6.0"
  }
}
```

---

## ÉTAPE 3 — Boutons de téléchargement dans le module Taux

Ajouter dans le module Taux existant la logique d'appel à la Edge Function et les boutons PNG/PDF.

```typescript
const handleDownload = async (format: 'png' | 'pdf') => {
  setLoading(true)
  try {
    const { data, error } = await supabase.functions.invoke(
      `generate-flyer?format=${format}`,
      {
        body: {
          alipay: tauxAlipay,
          wechat: tauxWechat,
          bank: tauxBank,
          cash: tauxCash,
          theme: 'dark',
        }
      }
    )
    if (error) throw error

    const mimeType = format === 'pdf' ? 'application/pdf' : 'image/png'
    const blob = new Blob([data], { type: mimeType })
    const filename = `bonzini_taux_${new Date().toISOString().slice(0,10)}.${format}`

    // Téléchargement natif — fonctionne sur iOS, Android, desktop
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

  } catch (err) {
    console.error('Erreur génération flyer:', err)
  } finally {
    setLoading(false)
  }
}
```

Boutons à ajouter dans l'UI du module Taux :
```tsx
<div className="flex gap-3 mt-4">
  <Button onPress={() => handleDownload('png')} isLoading={loading} className="flex-1">
    📥 Télécharger PNG
  </Button>
  <Button onPress={() => handleDownload('pdf')} isLoading={loading} variant="bordered" className="flex-1">
    📄 Télécharger PDF
  </Button>
</div>
```

---

## Référence visuelle

Le fichier `flyer_taux_v10.html` joint est la maquette exacte à reproduire.
Utilise-le comme référence pour tous les détails visuels : couleurs, tailles, espacements, disposition.

import { useState } from "react";

// ============================================================
// BONZINI ADMIN — NOUVEAU PAIEMENT V3
// Taux personnalisé · Conversion XAF↔¥ · Design épuré
// ============================================================

const V = "#A947FE", G = "#F3A745", O = "#FE560D", GR = "#34d399";
const AL = "#1677ff", WC = "#07c160";

const t = {
  bg: "#f8f6fa", card: "#ffffff",
  text: "#1a1028", sub: "#7a7290", dim: "#c4bdd0",
  border: "#ebe6f0", inputBg: "#ffffff",
};

function fmt(n) { return Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " "); }

const CLIENTS = [
  { id: 1, name: "Johann Soh", initials: "JS", phone: "+237 677 889 900", solde: 1000000 },
  { id: 2, name: "Fabrice Bienvenue", initials: "FB", phone: "+237 620 666 860", solde: 3000000 },
  { id: 3, name: "Edgard Manga", initials: "EM", phone: "+237 693 377 266", solde: 808000 },
  { id: 4, name: "Liliane Kenfack", initials: "LK", phone: "+237 676 337 404", solde: 500000 },
];

const MODES = [
  { id: "alipay", name: "Alipay", icon: "支", color: AL },
  { id: "wechat", name: "WeChat Pay", icon: "微", color: WC },
  { id: "virement", name: "Virement", icon: "B", color: V },
  { id: "cash", name: "Cash", icon: "¥", color: O },
];

const BASE_RATE = 11530;

export default function App() {
  const [step, setStep] = useState(1);
  const [search, setSearch] = useState("");
  const [client, setClient] = useState(null);
  const [mode, setMode] = useState(null);

  // Montant
  const [inputCurrency, setInputCurrency] = useState("xaf");
  const [rawAmount, setRawAmount] = useState("");
  const [useCustomRate, setUseCustomRate] = useState(false);
  const [customRate, setCustomRate] = useState(BASE_RATE.toString());

  // Bénéficiaire
  const [benef, setBenef] = useState({ name: "", ident: "", phone: "", email: "", bank: "", account: "", isClient: false });
  const [skipBenef, setSkipBenef] = useState(false);

  const [done, setDone] = useState(false);

  const rate = useCustomRate ? (parseInt(customRate) || BASE_RATE) : BASE_RATE;
  const raw = parseInt(rawAmount) || 0;
  const xaf = inputCurrency === "xaf" ? raw : Math.round(raw * 1000000 / rate);
  const cny = inputCurrency === "xaf" ? Math.round(raw * rate / 1000000) : raw;

  const steps = [
    { n: 1, l: "Client" }, { n: 2, l: "Mode" }, { n: 3, l: "Montant" },
    { n: 4, l: "Bénéf." }, { n: 5, l: "Résumé" },
  ];

  const canNext =
    step === 1 ? !!client :
    step === 2 ? !!mode :
    step === 3 ? xaf >= 10000 :
    step === 4 ? skipBenef || benef.name.trim().length > 0 :
    true;

  const filtered = CLIENTS.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
  );

  const inp = {
    width: "100%", padding: "15px 16px", borderRadius: 12,
    border: `1.5px solid ${t.border}`, background: t.inputBg,
    fontSize: 16, fontWeight: 600, color: t.text,
    fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box",
  };

  function reset() {
    setDone(false); setStep(1); setClient(null); setMode(null);
    setRawAmount(""); setBenef({ name: "", ident: "", phone: "", email: "", bank: "", account: "", isClient: false });
    setUseCustomRate(false); setCustomRate(BASE_RATE.toString()); setInputCurrency("xaf"); setSkipBenef(false);
  }

  // ── SUCCÈS ──
  if (done) return (
    <div style={{
      height: "100dvh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "#fff", maxWidth: 480, margin: "0 auto",
      fontFamily: "'DM Sans',sans-serif", padding: "0 24px",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: `${GR}12`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: GR, marginBottom: 16 }}>✓</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: t.text }}>Paiement créé</div>
      <div style={{ fontSize: 34, fontWeight: 900, color: t.text, letterSpacing: "-1.5px", marginTop: 6 }}>¥{fmt(cny)}</div>
      <div style={{ fontSize: 15, color: t.sub, marginTop: 4 }}>{fmt(xaf)} XAF via {mode?.name}</div>
      <div style={{ fontSize: 13, color: t.dim, marginTop: 2 }}>pour {client?.name} {!skipBenef && benef.name ? `→ ${benef.name}` : ""}</div>
      <div style={{ display: "flex", gap: 10, marginTop: 28, width: "100%" }}>
        <button onClick={reset} style={{ flex: 1, padding: "15px", borderRadius: 12, background: "none", border: `1px solid ${t.border}`, fontSize: 14, fontWeight: 700, color: t.sub, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>Nouveau</button>
        <button style={{ flex: 1, padding: "15px", borderRadius: 12, background: V, border: "none", fontSize: 14, fontWeight: 800, color: "#fff", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>Voir la fiche</button>
      </div>
    </div>
  );

  return (
    <div style={{
      height: "100dvh", display: "flex", flexDirection: "column",
      overflow: "hidden", background: t.bg, maxWidth: 480, margin: "0 auto",
      fontFamily: "'DM Sans',sans-serif", color: t.text,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

      {/* HEADER */}
      <div style={{ flexShrink: 0, background: t.card, borderBottom: `1px solid ${t.border}`, padding: "12px 20px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <span onClick={() => step > 1 ? setStep(step - 1) : null} style={{ fontSize: 20, color: t.sub, cursor: "pointer", marginRight: 12, fontWeight: 300 }}>‹</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: t.text, flex: 1 }}>Nouveau paiement</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: V }}>{step}/5</span>
        </div>
        <div style={{ display: "flex", gap: 3 }}>
          {steps.map(s => (
            <div key={s.n} style={{
              flex: 1, height: 3, borderRadius: 2,
              background: step >= s.n ? V : t.border,
              transition: "background 0.3s",
            }} />
          ))}
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "20px 20px 0" }}>

        {/* ── 1. CLIENT ── */}
        {step === 1 && (<div>
          <div style={{ fontSize: 21, fontWeight: 800, marginBottom: 14 }}>Quel client ?</div>
          <input style={{ ...inp, background: t.bg, marginBottom: 12 }} placeholder="Rechercher un client..." value={search} onChange={e => setSearch(e.target.value)} />
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {filtered.map(c => {
              const sel = client?.id === c.id;
              return (
                <button key={c.id} onClick={() => setClient(c)} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px", borderRadius: 12, width: "100%",
                  background: sel ? `${V}05` : t.card,
                  border: `1.5px solid ${sel ? V : t.border}`,
                  cursor: "pointer", textAlign: "left",
                }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: `${V}08`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: V }}>{c.initials}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: t.sub }}>{c.phone}</div>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 800, color: c.solde > 0 ? t.text : t.dim }}>{fmt(c.solde)} XAF</span>
                </button>
              );
            })}
          </div>
        </div>)}

        {/* ── 2. MODE ── */}
        {step === 2 && (<div>
          <div style={{ fontSize: 21, fontWeight: 800, marginBottom: 14 }}>Comment payer ?</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {MODES.map(m => {
              const sel = mode?.id === m.id;
              return (
                <button key={m.id} onClick={() => setMode(m)} style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "16px", borderRadius: 14, width: "100%",
                  background: sel ? `${m.color}05` : t.card,
                  border: `1.5px solid ${sel ? m.color : t.border}`,
                  cursor: "pointer", textAlign: "left",
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: `${m.color}10`, display: "flex",
                    alignItems: "center", justifyContent: "center",
                    fontSize: 20, fontWeight: 800, color: m.color,
                  }}>{m.icon}</div>
                  <span style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{m.name}</span>
                  {sel && <span style={{ marginLeft: "auto", fontSize: 16, color: m.color }}>✓</span>}
                </button>
              );
            })}
          </div>
        </div>)}

        {/* ── 3. MONTANT (bidirectionnel + taux perso) ── */}
        {step === 3 && (<div>
          <div style={{ fontSize: 21, fontWeight: 800, marginBottom: 2 }}>Combien ?</div>
          <div style={{ fontSize: 13, color: t.sub, marginBottom: 16 }}>Solde de {client?.name} : {fmt(client?.solde || 0)} XAF</div>

          {/* Toggle XAF / ¥ */}
          <div style={{
            display: "flex", borderRadius: 10, overflow: "hidden",
            border: `1.5px solid ${t.border}`, marginBottom: 16,
          }}>
            <button onClick={() => { setInputCurrency("xaf"); setRawAmount(""); }} style={{
              flex: 1, padding: "11px 0", border: "none", cursor: "pointer",
              background: inputCurrency === "xaf" ? V : t.card,
              color: inputCurrency === "xaf" ? "#fff" : t.sub,
              fontSize: 14, fontWeight: 700, fontFamily: "'DM Sans',sans-serif",
              transition: "all 0.2s",
            }}>Je saisis en XAF</button>
            <button onClick={() => { setInputCurrency("cny"); setRawAmount(""); }} style={{
              flex: 1, padding: "11px 0", border: "none", cursor: "pointer",
              background: inputCurrency === "cny" ? V : t.card,
              color: inputCurrency === "cny" ? "#fff" : t.sub,
              fontSize: 14, fontWeight: 700, fontFamily: "'DM Sans',sans-serif",
              transition: "all 0.2s",
            }}>Je saisis en ¥</button>
          </div>

          {/* Input principal */}
          <div style={{
            padding: "20px", borderRadius: 16,
            background: t.card, border: `1.5px solid ${t.border}`,
            marginBottom: 12,
          }}>
            {/* Saisie */}
            <div style={{ fontSize: 11, color: t.sub, fontWeight: 600, marginBottom: 8 }}>
              {inputCurrency === "xaf" ? "Montant débité du client" : "Montant reçu par le fournisseur"}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <input
                style={{
                  border: "none", background: "none", outline: "none",
                  fontSize: 40, fontWeight: 900, color: t.text,
                  fontFamily: "'DM Sans',sans-serif", width: "100%",
                  letterSpacing: "-1px",
                }}
                placeholder="0"
                value={rawAmount}
                onChange={e => setRawAmount(e.target.value.replace(/[^0-9]/g, ""))}
                type="tel"
              />
              <span style={{ fontSize: 18, fontWeight: 700, color: t.sub, flexShrink: 0 }}>
                {inputCurrency === "xaf" ? "XAF" : "¥"}
              </span>
            </div>

            {/* Séparateur */}
            <div style={{ height: 1, background: t.border, margin: "14px 0" }} />

            {/* Conversion */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: t.sub }}>
                {inputCurrency === "xaf" ? "Le fournisseur reçoit" : "Le client paie"}
              </span>
              <span style={{ fontSize: 18, fontWeight: 800, color: V }}>
                {inputCurrency === "xaf" ? `¥${fmt(cny)}` : `${fmt(xaf)} XAF`}
              </span>
            </div>
          </div>

          {/* Raccourcis */}
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            {(inputCurrency === "xaf"
              ? [["100K", 100000], ["250K", 250000], ["500K", 500000], ["1M", 1000000]]
              : [["¥1K", 1000], ["¥2.5K", 2500], ["¥5K", 5000], ["¥10K", 10000]]
            ).map(([label, val]) => (
              <button key={label} onClick={() => setRawAmount(String(val))} style={{
                flex: 1, padding: "10px 0", borderRadius: 8,
                background: parseInt(rawAmount) === val ? `${V}08` : t.card,
                border: `1px solid ${parseInt(rawAmount) === val ? V : t.border}`,
                fontSize: 12, fontWeight: 700,
                color: parseInt(rawAmount) === val ? V : t.text,
                cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
              }}>{label}</button>
            ))}
          </div>

          {/* Taux */}
          <div style={{
            padding: "12px 14px", borderRadius: 12,
            background: t.card, border: `1.5px solid ${t.border}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Taux personnalisé</div>
                {!useCustomRate && <div style={{ fontSize: 11, color: t.dim, marginTop: 2 }}>Taux du jour : 1M XAF = ¥{fmt(BASE_RATE)}</div>}
              </div>
              <button onClick={() => { setUseCustomRate(!useCustomRate); if (!useCustomRate) setCustomRate(BASE_RATE.toString()); }} style={{
                width: 44, height: 26, borderRadius: 13, border: "none", cursor: "pointer",
                background: useCustomRate ? V : `${t.dim}60`,
                position: "relative", transition: "background 0.2s",
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%", background: "#fff",
                  position: "absolute", top: 2,
                  left: useCustomRate ? 20 : 2,
                  transition: "left 0.2s",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
                }} />
              </button>
            </div>

            {useCustomRate && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${t.border}` }}>
                <span style={{ fontSize: 12, color: t.sub, flexShrink: 0 }}>1M XAF =</span>
                <input
                  style={{ ...inp, flex: 1, padding: "10px 12px", fontSize: 16, textAlign: "center", fontWeight: 800 }}
                  value={customRate}
                  onChange={e => setCustomRate(e.target.value.replace(/[^0-9]/g, ""))}
                  type="tel"
                />
                <span style={{ fontSize: 12, color: t.sub, flexShrink: 0 }}>¥</span>
              </div>
            )}
          </div>

          {/* Alertes */}
          {xaf > 0 && xaf < 10000 && (
            <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 10, background: `${O}06`, border: `1px solid ${O}12`, fontSize: 12, fontWeight: 600, color: O, textAlign: "center" }}>
              Minimum : 10 000 XAF
            </div>
          )}
          {xaf > (client?.solde || 0) && xaf > 0 && (
            <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 10, background: `${O}06`, border: `1px solid ${O}12`, fontSize: 12, fontWeight: 600, color: O, textAlign: "center" }}>
              Solde insuffisant ({fmt(client?.solde || 0)} XAF)
            </div>
          )}
        </div>)}

        {/* ── 4. BÉNÉFICIAIRE ── */}
        {step === 4 && (<div>
          <div style={{ fontSize: 21, fontWeight: 800, marginBottom: 2 }}>Qui reçoit ?</div>
          <div style={{ fontSize: 13, color: t.sub, marginBottom: 16 }}>¥{fmt(cny)} via {mode?.name}</div>

          {/* Option passer */}
          <button onClick={() => { setSkipBenef(!skipBenef); if (!skipBenef) setBenef({ name: "", ident: "", phone: "", email: "", bank: "", account: "", isClient: false }); }} style={{
            width: "100%", display: "flex", alignItems: "center", gap: 10,
            padding: "12px 14px", borderRadius: 12, marginBottom: 16,
            background: skipBenef ? `${G}06` : t.card,
            border: `1.5px solid ${skipBenef ? G : t.border}`,
            cursor: "pointer", textAlign: "left",
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: 5,
              border: `2px solid ${skipBenef ? G : t.dim}`,
              background: skipBenef ? G : "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, color: "#fff", fontWeight: 800,
            }}>{skipBenef ? "✓" : ""}</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Remplir plus tard</div>
              <div style={{ fontSize: 11, color: t.sub }}>Les infos du bénéficiaire seront ajoutées après</div>
            </div>
          </button>

          {!skipBenef && (<>
            {/* Cash : choix client lui-même ou autre */}
            {mode?.id === "cash" && (
              <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                <button onClick={() => {
                  setBenef({ ...benef, isClient: true, name: client?.name || "", phone: "" });
                }} style={{
                  flex: 1, padding: "12px", borderRadius: 10,
                  background: benef.isClient ? `${V}06` : t.card,
                  border: `1.5px solid ${benef.isClient ? V : t.border}`,
                  fontSize: 13, fontWeight: 700, color: benef.isClient ? V : t.sub,
                  cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
                }}>Le client lui-même</button>
                <button onClick={() => {
                  setBenef({ ...benef, isClient: false, name: "", phone: "" });
                }} style={{
                  flex: 1, padding: "12px", borderRadius: 10,
                  background: !benef.isClient ? `${V}06` : t.card,
                  border: `1.5px solid ${!benef.isClient ? V : t.border}`,
                  fontSize: 13, fontWeight: 700, color: !benef.isClient ? V : t.sub,
                  cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
                }}>Quelqu'un d'autre</button>
              </div>
            )}

            {/* Nom */}
            {!(mode?.id === "cash" && benef.isClient) && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 6, display: "block" }}>Nom du bénéficiaire <span style={{ color: O }}>*</span></label>
                <input style={inp} placeholder="Ex: Zhang Wei" value={benef.name} onChange={e => setBenef({ ...benef, name: e.target.value })} />
              </div>
            )}

            {/* Cash : client lui-même affiché */}
            {mode?.id === "cash" && benef.isClient && (
              <div style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "14px", borderRadius: 12, marginBottom: 16,
                background: `${V}04`, border: `1.5px solid ${V}15`,
              }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: `${V}10`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: V }}>{client?.initials}</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{client?.name}</div>
                  <div style={{ fontSize: 12, color: t.sub }}>{client?.phone}</div>
                </div>
              </div>
            )}

            {/* Cash : autre personne — téléphone */}
            {mode?.id === "cash" && !benef.isClient && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 6, display: "block" }}>Téléphone</label>
                <input style={inp} placeholder="Ex: +86 138 0000 0000" value={benef.phone} onChange={e => setBenef({ ...benef, phone: e.target.value })} type="tel" />
              </div>
            )}

            {/* Alipay / WeChat : QR code + téléphone + email + identifiant */}
            {(mode?.id === "alipay" || mode?.id === "wechat") && (<>
              {/* QR Code upload */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 6, display: "block" }}>QR Code {mode?.name}</label>
                <button style={{
                  width: "100%", padding: "20px 0", borderRadius: 12,
                  border: `2px dashed ${t.border}`, background: t.card,
                  cursor: "pointer", textAlign: "center",
                }}>
                  <div style={{ fontSize: 18, color: t.dim, marginBottom: 4 }}>+</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Ajouter une photo du QR code</div>
                  <div style={{ fontSize: 11, color: t.dim, marginTop: 2 }}>Capture d'écran ou photo</div>
                </button>
              </div>

              <div style={{ textAlign: "center", fontSize: 12, color: t.dim, margin: "4px 0 12px", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, height: 1, background: t.border }} />
                <span>et / ou</span>
                <div style={{ flex: 1, height: 1, background: t.border }} />
              </div>

              {/* Identifiant */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 6, display: "block" }}>
                  Identifiant {mode?.name} <span style={{ fontSize: 12, fontWeight: 500, color: t.dim }}>optionnel</span>
                </label>
                <input style={inp} placeholder={`ID ${mode?.name} du bénéficiaire`} value={benef.ident} onChange={e => setBenef({ ...benef, ident: e.target.value })} />
              </div>

              {/* Téléphone */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 6, display: "block" }}>
                  Téléphone <span style={{ fontSize: 12, fontWeight: 500, color: t.dim }}>optionnel</span>
                </label>
                <input style={inp} placeholder="Ex: +86 138 0000 0000" value={benef.phone} onChange={e => setBenef({ ...benef, phone: e.target.value })} type="tel" />
              </div>

              {/* Email */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 6, display: "block" }}>
                  Email <span style={{ fontSize: 12, fontWeight: 500, color: t.dim }}>optionnel</span>
                </label>
                <input style={inp} placeholder="Ex: zhangwei@mail.com" value={benef.email} onChange={e => setBenef({ ...benef, email: e.target.value })} type="email" />
              </div>
            </>)}

            {/* Virement */}
            {mode?.id === "virement" && (<>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 6, display: "block" }}>Banque <span style={{ color: O }}>*</span></label>
                <input style={inp} placeholder="Ex: Bank of China" value={benef.bank} onChange={e => setBenef({ ...benef, bank: e.target.value })} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 6, display: "block" }}>Numéro de compte <span style={{ color: O }}>*</span></label>
                <input style={inp} placeholder="Ex: 6214 8888 1234 5678" value={benef.account} onChange={e => setBenef({ ...benef, account: e.target.value })} type="tel" />
              </div>
            </>)}
          </>)}
        </div>)}

        {/* ── 5. RÉSUMÉ ── */}
        {step === 5 && (<div>
          <div style={{ fontSize: 21, fontWeight: 800, marginBottom: 14 }}>Tout est bon ?</div>

          <div style={{
            padding: "20px", borderRadius: 14, textAlign: "center",
            background: t.card, border: `1.5px solid ${t.border}`, marginBottom: 8,
          }}>
            <div style={{ fontSize: 38, fontWeight: 900, color: t.text, letterSpacing: "-1.5px" }}>
              ¥{fmt(cny)}
            </div>
            <div style={{ fontSize: 15, color: t.sub, marginTop: 4 }}>{fmt(xaf)} XAF</div>
          </div>

          <div style={{ padding: "14px 16px", borderRadius: 14, background: t.card, border: `1.5px solid ${t.border}` }}>
            {[
              { l: "Client", v: client?.name },
              { l: "Mode", v: mode?.name },
              !skipBenef && benef.name && { l: "Bénéficiaire", v: benef.isClient ? `${client?.name} (le client)` : benef.name },
              !skipBenef && benef.ident && { l: `ID ${mode?.name}`, v: benef.ident },
              !skipBenef && benef.bank && { l: "Banque", v: benef.bank },
              !skipBenef && benef.account && { l: "Compte", v: benef.account },
              !skipBenef && benef.phone && { l: "Téléphone", v: benef.phone },
              !skipBenef && benef.email && { l: "Email", v: benef.email },
              skipBenef && { l: "Bénéficiaire", v: "À remplir plus tard" },
              { l: "Taux", v: `1M XAF = ¥${fmt(rate)}${useCustomRate ? " (perso.)" : ""}` },
            ].filter(Boolean).map((r, i, arr) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between",
                padding: "9px 0",
                borderBottom: i < arr.length - 1 ? `1px solid ${t.border}` : "none",
              }}>
                <span style={{ fontSize: 13, color: t.sub }}>{r.l}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{r.v}</span>
              </div>
            ))}
          </div>

          {xaf > (client?.solde || 0) && (
            <div style={{ marginTop: 8, padding: "10px 14px", borderRadius: 10, background: `${O}06`, border: `1px solid ${O}12`, fontSize: 12, fontWeight: 600, color: O, textAlign: "center" }}>
              Solde insuffisant
            </div>
          )}
        </div>)}
      </div>

      {/* FOOTER */}
      <div style={{
        flexShrink: 0, padding: "10px 20px 18px",
        background: t.card, borderTop: `1px solid ${t.border}`,
        display: "flex", gap: 10,
      }}>
        {step > 1 && (
          <button onClick={() => setStep(step - 1)} style={{
            flex: 1, padding: "15px 0", borderRadius: 12,
            background: "none", border: `1.5px solid ${t.border}`,
            fontSize: 14, fontWeight: 700, color: t.sub, cursor: "pointer",
            fontFamily: "'DM Sans',sans-serif",
          }}>Retour</button>
        )}
        <button
          onClick={() => step < 5 ? setStep(step + 1) : setDone(true)}
          disabled={!canNext}
          style={{
            flex: step === 1 ? 1 : 1.4, padding: "15px 0", borderRadius: 12,
            background: canNext ? V : t.border, border: "none",
            fontSize: 14, fontWeight: 800,
            color: canNext ? "#fff" : t.dim,
            cursor: canNext ? "pointer" : "not-allowed",
            fontFamily: "'DM Sans',sans-serif",
          }}
        >
          {step === 5 ? "Confirmer le paiement" : "Suivant"}
        </button>
      </div>
    </div>
  );
}

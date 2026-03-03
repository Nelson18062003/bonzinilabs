import { useState, useRef, useEffect } from "react";

const METHODS = [
  { key: "alipay", label: "Alipay", desc: "Paiement via Alipay", icon: "支", bg: "#1677ff" },
  { key: "wechat", label: "WeChat Pay", desc: "Paiement via WeChat", icon: "微", bg: "#07c160" },
  { key: "virement", label: "Virement bancaire", desc: "Transfert vers compte bancaire", icon: "🏦", bg: "#8b5cf6" },
  { key: "cash", label: "Cash", desc: "Retrait au bureau Bonzini", icon: "¥", bg: "#dc2626" },
];
const RATES = { cash: 11800, alipay: 11650, wechat: 11700, virement: 11750 };
const CLIENT = { name: "Abo YOYO", phone: "+242069610466", balance: 13546808 };

const SAVED_BEN_AW = [
  { id: 1, name: "Zhang Wei", identifier: "zhangwei@alipay.cn", type: "email" },
  { id: 2, name: "Li Ming", identifier: "138****5678", type: "phone" },
];
const SAVED_BEN_VIR = [
  { id: 1, name: "Liu Yan", bank: "Bank of China", account: "6222 **** **** 8901" },
  { id: 2, name: "Zhao Min", bank: "ICBC", account: "6212 **** **** 3456" },
];

function tierPct(a) { return a >= 1000000 ? 0 : a >= 400000 ? -1 : -2; }
function calcRate(m, a) { return RATES[m] * (1 + tierPct(a) / 100); }

const F = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const STEPS = ["Mode", "Montant", "Bénéficiaire", "Résumé"];

export default function App() {
  const [step, setStep] = useState(0);
  const [method, setMethod] = useState(null);

  // Amount — bidirectional
  const [direction, setDirection] = useState("xaf"); // xaf | rmb
  const [amtXaf, setAmtXaf] = useState("");
  const [amtRmb, setAmtRmb] = useState("");

  // Beneficiary
  const [benMode, setBenMode] = useState("new"); // existing | new
  const [benSelected, setBenSelected] = useState(null);
  const [benName, setBenName] = useState("");
  const [benPhone, setBenPhone] = useState("");
  const [benEmail, setBenEmail] = useState("");
  const [benBank, setBenBank] = useState("");
  const [benAccount, setBenAccount] = useState("");
  const [benIdType, setBenIdType] = useState("qr"); // qr | id | phone | email
  const [benIdentifier, setBenIdentifier] = useState("");
  const [benNotes, setBenNotes] = useState("");

  const [showSuccess, setShowSuccess] = useState(false);
  const ref = useRef(null);

  const mi = method ? METHODS.find(m => m.key === method) : null;

  // Compute amounts based on direction
  const nXaf = parseInt(amtXaf) || 0;
  const nRmb = parseFloat(amtRmb) || 0;
  const primaryXaf = direction === "xaf" ? nXaf : 0;
  const rate = method ? (direction === "xaf" && nXaf >= 10000 ? calcRate(method, nXaf) : direction === "rmb" && nRmb > 0 ? calcRate(method, nRmb * 1e6 / RATES[method]) : 0) : 0;

  // Derived values
  let displayXaf = 0, displayRmb = 0;
  if (direction === "xaf" && nXaf >= 10000 && method) {
    const r = calcRate(method, nXaf);
    displayXaf = nXaf;
    displayRmb = nXaf * (r / 1e6);
  } else if (direction === "rmb" && nRmb > 0 && method) {
    // Reverse: from RMB, estimate XAF, then get precise rate
    const estXaf = nRmb / (RATES[method] / 1e6);
    const r = calcRate(method, estXaf);
    displayRmb = nRmb;
    displayXaf = nRmb / (r / 1e6);
  }
  const finalRate = displayXaf > 0 && method ? calcRate(method, displayXaf) : 0;
  const finalXaf = Math.round(displayXaf);
  const finalRmb = displayRmb;

  useEffect(() => { ref.current?.scrollTo({ top: 0, behavior: "smooth" }); }, [step]);

  const canNext = () => {
    if (step === 0) return !!method;
    if (step === 1) {
      if (direction === "xaf") return nXaf >= 10000 && nXaf <= CLIENT.balance;
      return nRmb > 0 && finalXaf <= CLIENT.balance && finalXaf >= 10000;
    }
    if (step === 2) return true;
    return true;
  };

  const go = d => {
    if (d > 0 && canNext()) setStep(Math.min(step + 1, 3));
    else if (d < 0 && step > 0) setStep(step - 1);
  };

  const reset = () => {
    setShowSuccess(false); setStep(0); setMethod(null);
    setAmtXaf(""); setAmtRmb(""); setDirection("xaf");
    setBenMode("new"); setBenSelected(null);
    setBenName(""); setBenPhone(""); setBenEmail("");
    setBenBank(""); setBenAccount(""); setBenIdentifier(""); setBenNotes("");
  };

  const getBenSummary = () => {
    if (benMode === "existing" && benSelected) {
      if (benSelected.bank) return { filled: true, name: benSelected.name, detail: `${benSelected.bank} • ${benSelected.account}` };
      return { filled: true, name: benSelected.name, detail: benSelected.identifier };
    }
    if (benName.trim()) {
      let detail = "";
      if (method === "virement") detail = [benBank, benAccount].filter(Boolean).join(" • ");
      else if (benIdentifier) detail = benIdentifier;
      else if (benPhone) detail = benPhone;
      if (benEmail && detail) detail += ` • ${benEmail}`;
      else if (benEmail) detail = benEmail;
      return { filled: true, name: benName, detail };
    }
    return { filled: false };
  };
  const benSummary = getBenSummary();

  // Styles
  const card = (x = {}) => ({ background: "#fff", borderRadius: 14, border: "1px solid rgba(0,0,0,0.06)", padding: "14px 16px", marginBottom: 12, ...x });
  const lbl = { fontSize: 12, color: "#888", fontWeight: 600, marginBottom: 8 };
  const inp = { width: "100%", padding: "13px 14px", borderRadius: 12, border: "1px solid #e5e5e5", background: "#fafafa", color: "#1a1a2e", fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: F };
  const selBtn = (active, color = "#7c3aed") => ({
    flex: 1, padding: "12px 10px", borderRadius: 11, cursor: "pointer", fontFamily: F, textAlign: "left",
    border: active ? `2px solid ${color}` : "1px solid #e5e5e5",
    background: active ? `${color}08` : "#fff",
  });

  // ═══ SUCCESS SCREEN ═══
  if (showSuccess) {
    return (
      <div style={{ maxWidth: 430, margin: "0 auto", height: "100dvh", display: "flex", flexDirection: "column", background: "#fff", fontFamily: F, color: "#1a1a2e", overflow: "hidden", position: "relative" }}>
        <style>{`
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes scaleIn { from { transform: scale(0); } to { transform: scale(1); } }
          @keyframes slideUp { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
          @keyframes drawCheck { 0% { stroke-dashoffset: 50; } 100% { stroke-dashoffset: 0; } }
        `}</style>
        <div style={{ position: "absolute", top: 16, left: 16, right: 16, zIndex: 10, background: "#f0fdf4", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, border: "1px solid #dcfce7", animation: "slideUp 0.3s ease" }}>
          <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff", flexShrink: 0 }}>✓</div>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#166534" }}>Paiement créé avec succès</span>
        </div>
        <div style={{ flexShrink: 0, background: "#fff", borderBottom: "1px solid #f0f0f0", padding: "14px 16px" }}>
          <span style={{ fontSize: 18, fontWeight: 700 }}>Succès</span>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 28, animation: "scaleIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)" }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: 50, animation: "drawCheck 0.5s ease 0.3s both" }} /></svg>
          </div>
          <div style={{ textAlign: "center", animation: "slideUp 0.4s ease 0.2s both" }}>
            <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Paiement créé !</div>
            <div style={{ fontSize: 14, color: "#888", marginBottom: 12 }}>Votre demande a été enregistrée</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: mi?.bg || "#7c3aed" }}>¥ {finalRmb.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}</div>
            <div style={{ fontSize: 14, color: "#999", marginTop: 6 }}>{finalXaf.toLocaleString("fr-FR")} XAF débités de votre solde</div>
          </div>
        </div>
        <div style={{ flexShrink: 0, padding: "12px 16px 28px", display: "flex", flexDirection: "column", gap: 10, animation: "slideUp 0.4s ease 0.4s both" }}>
          <button style={{ width: "100%", padding: 16, borderRadius: 14, border: "none", background: "linear-gradient(135deg, #a855f7, #7c3aed)", color: "#fff", fontSize: 16, fontWeight: 700, fontFamily: F, cursor: "pointer" }}>Voir le paiement</button>
          <button onClick={reset} style={{ width: "100%", padding: 14, borderRadius: 14, border: "1px solid #e5e5e5", background: "#fff", color: "#555", fontSize: 14, fontWeight: 600, fontFamily: F, cursor: "pointer" }}>Mes paiements</button>
          <button onClick={reset} style={{ width: "100%", padding: 10, background: "none", border: "none", color: "#999", fontSize: 14, cursor: "pointer", fontFamily: F }}>Retour à l'accueil</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 430, margin: "0 auto", height: "100dvh", display: "flex", flexDirection: "column", background: "#f5f5f7", fontFamily: F, color: "#1a1a2e", overflow: "hidden" }}>

      {/* ═══ HEADER ═══ */}
      <div style={{ flexShrink: 0, background: "#fff", borderBottom: "1px solid #eee" }}>
        <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #f0f0f0" }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg, #f97316, #ef4444, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff", fontWeight: 800 }}>✦</div>
          <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.3 }}>BONZINI</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 13, color: "#ccc" }}>🔔 0</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", padding: "12px 16px 10px" }}>
          <button onClick={() => go(-1)} style={{ background: "none", border: "none", fontSize: 20, color: "#1a1a2e", cursor: step > 0 ? "pointer" : "default", opacity: step > 0 ? 1 : 0.2, width: 32, textAlign: "left" }}>←</button>
          <span style={{ fontSize: 18, fontWeight: 700 }}>Nouveau paiement</span>
        </div>
        {/* Named steps */}
        <div style={{ display: "flex", gap: 4, padding: "0 16px 12px" }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ height: 4, borderRadius: 2, marginBottom: 5, background: i < step ? "rgba(124,58,237,0.4)" : i === step ? "#7c3aed" : "#e5e5e5", transition: "background 0.3s" }} />
              <span style={{ fontSize: 9, fontWeight: 600, color: i <= step ? "#7c3aed" : "#ccc" }}>{s}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ SCROLLABLE ═══ */}
      <div ref={ref} style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{ padding: "16px 16px 24px" }}>

          {/* ─── STEP 1: MODE ─── */}
          {step === 0 && <>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, lineHeight: 1.3 }}>Comment votre bénéficiaire souhaite recevoir ?</h2>
            </div>
            {METHODS.map(pm => {
              const sel = method === pm.key;
              return (
                <div key={pm.key} onClick={() => setMethod(pm.key)} style={{
                  ...card({ marginBottom: 10, cursor: "pointer" }),
                  border: sel ? `2px solid ${pm.bg}` : "1px solid rgba(0,0,0,0.06)",
                  background: sel ? `${pm.bg}08` : "#fff",
                  display: "flex", alignItems: "center", gap: 14,
                }}>
                  <div style={{ width: 48, height: 48, borderRadius: 13, background: pm.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: pm.key === "virement" ? 20 : 22, fontWeight: 900, color: "#fff", flexShrink: 0, fontFamily: pm.key !== "virement" ? "serif" : F }}>{pm.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>{pm.label}</div>
                    <div style={{ fontSize: 13, color: "#999" }}>{pm.desc}</div>
                  </div>
                  {sel && <div style={{ width: 24, height: 24, borderRadius: "50%", background: pm.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#fff" }}>✓</div>}
                </div>
              );
            })}
          </>}

          {/* ─── STEP 2: MONTANT ─── */}
          {step === 1 && <>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Montant à envoyer</h2>
              <p style={{ fontSize: 13, color: "#888", margin: "4px 0 0" }}>
                Solde disponible : <span style={{ color: "#10b981", fontWeight: 600 }}>{CLIENT.balance.toLocaleString("fr-FR")} XAF</span>
              </p>
            </div>

            {/* Direction toggle */}
            <div style={{ display: "flex", background: "#fff", borderRadius: 12, padding: 3, marginBottom: 14, border: "1px solid #e5e5e5" }}>
              {[{ k: "xaf", l: "Par XAF" }, { k: "rmb", l: "Par RMB" }].map(d => (
                <button key={d.k} onClick={() => { setDirection(d.k); setAmtXaf(""); setAmtRmb(""); }} style={{
                  flex: 1, padding: "10px", borderRadius: 10, border: "none",
                  background: direction === d.k ? "#7c3aed" : "transparent",
                  color: direction === d.k ? "#fff" : "#888",
                  fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: F,
                }}>{d.l}</button>
              ))}
            </div>

            {/* Amount card */}
            <div style={{
              background: "linear-gradient(135deg, #7c3aed, #a855f7)",
              borderRadius: 18, padding: "22px 20px", marginBottom: 14, color: "#fff",
            }}>
              {/* Input line */}
              <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 4 }}>
                {direction === "xaf" ? "Vous envoyez" : "Bénéficiaire reçoit"}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", marginBottom: 16 }}>
                {direction === "rmb" && <span style={{ fontSize: 28, fontWeight: 800, marginRight: 4 }}>¥</span>}
                <input
                  type="text" inputMode="numeric"
                  placeholder="0"
                  value={direction === "xaf" ? amtXaf : amtRmb}
                  onChange={e => {
                    const v = e.target.value.replace(/[^\d.,]/g, "");
                    if (direction === "xaf") setAmtXaf(v.replace(/[.,]/g, ""));
                    else setAmtRmb(v);
                  }}
                  style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 32, fontWeight: 800, color: "#fff", fontFamily: F, minWidth: 0 }}
                />
                {direction === "xaf" && <span style={{ fontSize: 15, fontWeight: 600, opacity: 0.7 }}>XAF</span>}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <div style={{ height: 1, flex: 1, background: "rgba(255,255,255,0.15)" }} />
                <span style={{ fontSize: 14, opacity: 0.4 }}>⇅</span>
                <div style={{ height: 1, flex: 1, background: "rgba(255,255,255,0.15)" }} />
              </div>

              {/* Computed line */}
              <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 4 }}>
                {direction === "xaf" ? "Bénéficiaire reçoit" : "Montant débité"}
              </div>
              <div style={{ display: "flex", alignItems: "baseline" }}>
                {direction === "xaf" ? (
                  <>
                    <span style={{ fontSize: 26, fontWeight: 800 }}>
                      ¥ {finalRmb > 0 ? finalRmb.toLocaleString("fr-FR", { maximumFractionDigits: 2 }) : "0,00"}
                    </span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 26, fontWeight: 800 }}>
                      {finalXaf > 0 ? finalXaf.toLocaleString("fr-FR") : "0"}
                    </span>
                    <span style={{ fontSize: 15, fontWeight: 600, opacity: 0.7, marginLeft: 6 }}>XAF</span>
                  </>
                )}
              </div>
            </div>

            {/* Quick amounts */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {(direction === "xaf" ? [100000, 250000, 500000, 1000000] : [1000, 2500, 5000, 10000]).map(v => (
                <button key={v} onClick={() => direction === "xaf" ? setAmtXaf(String(v)) : setAmtRmb(String(v))} style={{
                  flex: 1, padding: "11px 4px", borderRadius: 11, fontFamily: F,
                  border: (direction === "xaf" ? parseInt(amtXaf) === v : parseFloat(amtRmb) === v) ? "2px solid #7c3aed" : "1px solid #e5e5e5",
                  background: (direction === "xaf" ? parseInt(amtXaf) === v : parseFloat(amtRmb) === v) ? "#f3e8ff" : "#fff",
                  color: (direction === "xaf" ? parseInt(amtXaf) === v : parseFloat(amtRmb) === v) ? "#7c3aed" : "#888",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}>
                  {direction === "xaf"
                    ? (v >= 1e6 ? "1M" : `${v / 1000}K`)
                    : `¥${v.toLocaleString("fr-FR")}`
                  }
                </button>
              ))}
            </div>

            {/* Rate info */}
            {finalRate > 0 && (
              <div style={{
                ...card(), display: "flex", alignItems: "center", justifyContent: "space-between",
                background: `${mi.bg}06`, border: `1px solid ${mi.bg}18`,
              }}>
                <div>
                  <div style={{ fontSize: 11, color: "#999" }}>Taux appliqué — {mi.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a2e" }}>
                    1M XAF = <span style={{ color: mi.bg }}>{Math.round(finalRate).toLocaleString("fr-FR")} CNY</span>
                  </div>
                </div>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: mi.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900, color: "#fff", flexShrink: 0, fontFamily: method !== "virement" ? "serif" : F }}>{mi.icon}</div>
              </div>
            )}

            {/* Errors */}
            {direction === "xaf" && nXaf > 0 && nXaf < 10000 && (
              <div style={{ padding: "10px 14px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", fontSize: 13, color: "#dc2626" }}>⚠️ Montant minimum : 10 000 XAF</div>
            )}
            {direction === "xaf" && nXaf > CLIENT.balance && (
              <div style={{ padding: "10px 14px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", fontSize: 13, color: "#dc2626" }}>⚠️ Solde insuffisant</div>
            )}
            {direction === "rmb" && finalXaf > CLIENT.balance && finalXaf > 0 && (
              <div style={{ padding: "10px 14px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", fontSize: 13, color: "#dc2626" }}>⚠️ Solde insuffisant ({finalXaf.toLocaleString("fr-FR")} XAF nécessaires)</div>
            )}
          </>}

          {/* ─── STEP 3: BÉNÉFICIAIRE ─── */}
          {step === 2 && <>
            <div style={{ marginBottom: 4 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Bénéficiaire</h2>
              <p style={{ fontSize: 13, color: "#888", margin: "6px 0 0", lineHeight: 1.5 }}>
                Ces informations permettent à Bonzini d'effectuer le paiement. Vous pouvez les compléter plus tard.
              </p>
            </div>

            {/* Mode toggle — existing vs new */}
            <div style={{ display: "flex", gap: 8, margin: "16px 0 14px" }}>
              {[{ k: "existing", l: "Existant" }, { k: "new", l: "Nouveau" }].map(b => (
                <button key={b.k} onClick={() => { setBenMode(b.k); setBenSelected(null); }} style={selBtn(benMode === b.k)}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: benMode === b.k ? "#7c3aed" : "#1a1a2e" }}>{b.l}</div>
                </button>
              ))}
            </div>

            {/* ── EXISTING ── */}
            {method !== "cash" && benMode === "existing" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                {(method === "virement" ? SAVED_BEN_VIR : SAVED_BEN_AW).map(b => {
                  const sel = benSelected?.id === b.id;
                  const clr = mi.bg;
                  return (
                    <div key={b.id} onClick={() => setBenSelected(b)} style={{
                      ...card({ marginBottom: 0, cursor: "pointer" }),
                      border: sel ? `2px solid ${clr}` : "1px solid rgba(0,0,0,0.06)",
                      background: sel ? `${clr}06` : "#fff",
                      display: "flex", alignItems: "center", gap: 12,
                    }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: `${clr}12`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900, color: clr, fontFamily: method !== "virement" ? "serif" : F, flexShrink: 0 }}>
                        {method === "virement" ? "🏦" : mi.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{b.name}</div>
                        <div style={{ fontSize: 12, color: "#999", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {b.bank ? `${b.bank} • ${b.account}` : b.identifier}
                        </div>
                      </div>
                      {sel && <div style={{ width: 22, height: 22, borderRadius: "50%", background: clr, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff" }}>✓</div>}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── NEW — Alipay / WeChat ── */}
            {(method === "alipay" || method === "wechat") && benMode === "new" && <>
              <div style={{ marginBottom: 0, marginTop: 4 }}>
                <div style={lbl}>QR Code du bénéficiaire <span style={{ fontWeight: 400, color: "#bbb" }}>(recommandé)</span></div>
                <div style={{ border: "2px dashed #ddd", borderRadius: 14, padding: "24px 16px", textAlign: "center", cursor: "pointer", background: "#fafafa" }}>
                  <div style={{ fontSize: 26, marginBottom: 6, opacity: 0.25 }}>⬆</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#555" }}>Ajouter le QR code {mi.label}</div>
                  <div style={{ fontSize: 12, color: "#bbb", marginTop: 4 }}>Fourni par votre bénéficiaire</div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0" }}>
                <div style={{ flex: 1, height: 1, background: "#e5e5e5" }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: "#bbb", textTransform: "uppercase", letterSpacing: 0.5 }}>ou renseignez les infos</span>
                <div style={{ flex: 1, height: 1, background: "#e5e5e5" }} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div><div style={lbl}>Nom du bénéficiaire</div><input value={benName} onChange={e => setBenName(e.target.value)} placeholder="Nom complet" style={inp} /></div>
                <div><div style={lbl}>Téléphone / ID {mi.label}</div><input value={benIdentifier} onChange={e => setBenIdentifier(e.target.value)} placeholder={`Numéro ou identifiant ${mi.label}`} style={inp} /></div>
                <div><div style={lbl}>Email <span style={{ fontWeight: 400, color: "#bbb" }}>(optionnel)</span></div><input value={benEmail} onChange={e => setBenEmail(e.target.value)} placeholder="email@exemple.com" style={inp} /></div>
              </div>
            </>}

            {/* ── NEW — Virement ── */}
            {method === "virement" && benMode === "new" && <>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div><div style={lbl}>Nom du titulaire</div><input value={benName} onChange={e => setBenName(e.target.value)} placeholder="Nom complet" style={inp} /></div>
                <div><div style={lbl}>Nom de la banque</div><input value={benBank} onChange={e => setBenBank(e.target.value)} placeholder="ex: Bank of China" style={inp} /></div>
                <div><div style={lbl}>Numéro de compte</div><input value={benAccount} onChange={e => setBenAccount(e.target.value)} placeholder="Numéro de compte" style={inp} /></div>
              </div>
            </>}

            {/* ── CASH ── */}
            {method === "cash" && benMode === "existing" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                {SAVED_BEN_AW.map(b => {
                  const sel = benSelected?.id === b.id;
                  return (
                    <div key={b.id} onClick={() => setBenSelected(b)} style={{
                      ...card({ marginBottom: 0, cursor: "pointer" }),
                      border: sel ? "2px solid #dc2626" : "1px solid rgba(0,0,0,0.06)",
                      background: sel ? "rgba(220,38,38,0.04)" : "#fff",
                      display: "flex", alignItems: "center", gap: 12,
                    }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(220,38,38,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900, color: "#dc2626", fontFamily: "serif", flexShrink: 0 }}>¥</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{b.name}</div>
                        <div style={{ fontSize: 12, color: "#999" }}>{b.identifier}</div>
                      </div>
                      {sel && <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff" }}>✓</div>}
                    </div>
                  );
                })}
              </div>
            )}

            {method === "cash" && benMode === "new" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div><div style={lbl}>Nom complet</div><input value={benName} onChange={e => setBenName(e.target.value)} placeholder="Nom et prénom" style={inp} /></div>
                <div><div style={lbl}>Numéro de téléphone</div><input value={benPhone} onChange={e => setBenPhone(e.target.value)} placeholder="+86..." style={inp} /></div>
                <div><div style={lbl}>Email <span style={{ fontWeight: 400, color: "#bbb" }}>(optionnel)</span></div><input value={benEmail} onChange={e => setBenEmail(e.target.value)} placeholder="email@exemple.com" style={inp} /></div>
              </div>
            )}

            {/* Notes */}
            <div style={{ marginTop: 14 }}>
              <div style={lbl}>Notes <span style={{ fontWeight: 400, color: "#bbb" }}>(optionnel)</span></div>
              <textarea value={benNotes} onChange={e => setBenNotes(e.target.value)}
                placeholder="Instructions supplémentaires pour Bonzini"
                rows={3} style={{ ...inp, resize: "none", lineHeight: 1.4 }} />
            </div>
          </>}

          {/* ─── STEP 4: RÉSUMÉ ─── */}
          {step === 3 && <>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Récapitulatif</h2>
            </div>

            {/* Hero */}
            <div style={{ ...card({ textAlign: "center", padding: "26px 20px" }) }}>
              <div style={{ width: 54, height: 54, borderRadius: 14, background: mi.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 900, color: "#fff", margin: "0 auto 14px", fontFamily: method !== "virement" ? "serif" : F }}>{mi.icon}</div>
              <div style={{ fontSize: 13, color: "#999", marginBottom: 4 }}>Vous envoyez</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: mi.bg }}>¥ {finalRmb.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}</div>
              <div style={{ fontSize: 14, color: "#999", marginTop: 4 }}>({finalXaf.toLocaleString("fr-FR")} XAF)</div>
            </div>

            {/* Details */}
            <div style={{ ...card(), padding: 0, overflow: "hidden" }}>
              {[
                { l: "Méthode", v: mi.label },
                { l: "Taux appliqué", v: `1M XAF = ¥ ${Math.round(finalRate).toLocaleString("fr-FR")}` },
                null,
                { l: "Montant débité", v: `${finalXaf.toLocaleString("fr-FR")} XAF`, bold: true },
                { l: "Nouveau solde", v: `${(CLIENT.balance - finalXaf).toLocaleString("fr-FR")} XAF` },
              ].map((row, i) => {
                if (!row) return <div key={i} style={{ height: 1, background: "#f0f0f0" }} />;
                return (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "13px 16px" }}>
                    <span style={{ fontSize: 14, color: row.bold ? "#1a1a2e" : "#888", fontWeight: row.bold ? 700 : 400 }}>{row.l}</span>
                    <span style={{ fontSize: 14, fontWeight: row.bold ? 800 : 600, color: "#1a1a2e" }}>{row.v}</span>
                  </div>
                );
              })}
            </div>

            {/* Beneficiary */}
            {benSummary.filled ? (
              <div style={card()}>
                <div style={lbl}>Bénéficiaire</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{benSummary.name}</div>
                {benSummary.detail && <div style={{ fontSize: 13, color: "#888" }}>{benSummary.detail}</div>}
              </div>
            ) : (
              <div style={{ ...card(), background: "#fffbeb", border: "1px solid #fef3c7", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>ℹ️</span>
                <span style={{ fontSize: 13, color: "#92400e", lineHeight: 1.4 }}>Vous pourrez ajouter les informations du bénéficiaire après la création.</span>
              </div>
            )}
          </>}

        </div>
      </div>

      {/* ═══ FOOTER ═══ */}
      <div style={{ flexShrink: 0, padding: "12px 16px 28px", background: "#f5f5f7", borderTop: "1px solid #eee" }}>
        {step < 3 ? (
          <>
            <button onClick={() => go(1)} disabled={!canNext()} style={{
              width: "100%", padding: 16, borderRadius: 14, border: "none",
              background: canNext() ? "linear-gradient(135deg, #a855f7, #7c3aed)" : "#e5e5e5",
              color: canNext() ? "#fff" : "#bbb",
              fontSize: 16, fontWeight: 700, fontFamily: F,
              cursor: canNext() ? "pointer" : "not-allowed",
            }}>
              {step === 2 ? "Continuer avec ces informations" : "Continuer"}
            </button>
            {step === 2 && (
              <button onClick={() => {
                setBenName(""); setBenPhone(""); setBenEmail(""); setBenBank("");
                setBenAccount(""); setBenIdentifier(""); setBenSelected(null);
                go(1);
              }} style={{
                width: "100%", padding: 12, marginTop: 4, background: "none", border: "none",
                color: "#888", fontSize: 14, cursor: "pointer", fontFamily: F,
              }}>Ajouter plus tard</button>
            )}
          </>
        ) : (
          <button onClick={() => setShowSuccess(true)} style={{
            width: "100%", padding: 16, borderRadius: 14, border: "none",
            background: "linear-gradient(135deg, #a855f7, #7c3aed)",
            color: "#fff", fontSize: 16, fontWeight: 700, fontFamily: F, cursor: "pointer",
          }}>Confirmer le paiement</button>
        )}
      </div>
    </div>
  );
}

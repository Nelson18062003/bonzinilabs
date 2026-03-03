import { useState, useRef, useEffect } from "react";

const METHODS = [
  { key: "alipay", label: "Alipay", desc: "QR code Alipay", icon: "支", bg: "#1677ff" },
  { key: "wechat", label: "WeChat Pay", desc: "QR code WeChat", icon: "微", bg: "#07c160" },
  { key: "virement", label: "Virement bancaire", desc: "Compte bancaire chinois", icon: "🏦", bg: "#8b5cf6" },
  { key: "cash", label: "Cash", desc: "Retrait en espèces", icon: "¥", bg: "#dc2626" },
];
const RATES = { cash: 11800, alipay: 11650, wechat: 11700, virement: 11750 };
const CLIENTS = [
  { id: 1, name: "Abo YOYO", phone: "+242069610466", ini: "AY", bal: 13546808, col: "#10b981" },
  { id: 2, name: "Alan Nems", phone: "+330745535252", ini: "AN", bal: 0, col: "#3b82f6" },
  { id: 3, name: "Alexis Kebeuden", phone: "+237652236857", ini: "AK", bal: 58696, col: "#f59e0b" },
  { id: 4, name: "Bello Abbo", phone: "+23790999890", ini: "BA", bal: 0, col: "#ef4444" },
  { id: 5, name: "Billy Donkeu", phone: "+237655443322", ini: "BD", bal: 2450000, col: "#8b5cf6" },
  { id: 6, name: "Chris Mbala", phone: "+237677889900", ini: "CM", bal: 890000, col: "#06b6d4" },
];

// Existing beneficiaries (simulated)
const SAVED_BEN_ALIPAY = [
  { id: 1, name: "Zhang Wei", identifier: "zhangwei@alipay.cn", type: "email" },
  { id: 2, name: "Li Ming", identifier: "138****5678", type: "phone" },
];
const SAVED_BEN_WECHAT = [
  { id: 1, name: "Wang Fang", identifier: "wangfang_wx", type: "id" },
  { id: 2, name: "Chen Lu", identifier: "139****1234", type: "phone" },
];
const SAVED_BEN_VIREMENT = [
  { id: 1, name: "Liu Yan", bank: "Bank of China", account: "6222 **** **** 8901" },
  { id: 2, name: "Zhao Min", bank: "ICBC", account: "6212 **** **** 3456" },
];

function tierPct(a) { return a >= 1000000 ? 0 : a >= 400000 ? -1 : -2; }
function calcRate(m, a) { return RATES[m] * (1 + tierPct(a) / 100); }

const F = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const STEPS = ["Client", "Mode", "Montant", "Bénéficiaire", "Résumé"];

export default function App() {
  const [step, setStep] = useState(0);
  const [q, setQ] = useState("");
  const [client, setClient] = useState(null);
  const [method, setMethod] = useState(null);
  const [amt, setAmt] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [customVal, setCustomVal] = useState("");
  const [dateSel, setDateSel] = useState("today");
  const [dateCustom, setDateCustom] = useState("2026-03-03");
  const [notes, setNotes] = useState("");

  // Cash beneficiary
  const [cashBenType, setCashBenType] = useState("self");
  const [cashBen, setCashBen] = useState({ name: "", phone: "", email: "" });

  // Alipay / WeChat beneficiary
  const [awBenMode, setAwBenMode] = useState("existing"); // existing | new
  const [awBenSelected, setAwBenSelected] = useState(null);
  const [awBenNew, setAwBenNew] = useState({ name: "", identifier: "", type: "qr" });

  // Virement beneficiary
  const [virBenMode, setVirBenMode] = useState("existing");
  const [virBenSelected, setVirBenSelected] = useState(null);
  const [virBenNew, setVirBenNew] = useState({ name: "", bank: "", account: "", extra: "" });

  const [skipBen, setSkipBen] = useState(false);
  const [done, setDone] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const ref = useRef(null);

  const n = parseInt(amt) || 0;
  const mi = method ? METHODS.find(m => m.key === method) : null;
  const rate = n >= 10000 && method ? (useCustom && customVal ? parseFloat(customVal) : calcRate(method, n)) : 0;
  const cny = rate > 0 ? n * (rate / 1e6) : 0;

  const filtered = CLIENTS.filter(c =>
    c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q)
  );

  useEffect(() => { ref.current?.scrollTo({ top: 0, behavior: "smooth" }); }, [step]);

  // Can always proceed on beneficiary step (it's optional)
  const canNext = () => {
    if (step === 0) return !!client;
    if (step === 1) return !!method;
    if (step === 2) return n >= 10000;
    if (step === 3) return true; // beneficiary is optional
    return true;
  };

  const go = d => {
    if (d > 0 && canNext()) setStep(Math.min(step + 1, 4));
    else if (d < 0) setStep(Math.max(step - 1, 0));
  };

  // Get beneficiary summary for recap
  const getBenSummary = () => {
    if (skipBen) return { filled: false };
    if (method === "cash") {
      if (cashBenType === "self") return { filled: true, name: client.name, detail: "Le client lui-même" };
      if (cashBen.name.trim()) return { filled: true, name: cashBen.name, detail: cashBen.phone + (cashBen.email ? ` • ${cashBen.email}` : "") };
      return { filled: false };
    }
    if (method === "alipay" || method === "wechat") {
      if (awBenMode === "existing" && awBenSelected) return { filled: true, name: awBenSelected.name, detail: awBenSelected.identifier };
      if (awBenMode === "new" && awBenNew.name.trim()) return { filled: true, name: awBenNew.name, detail: awBenNew.identifier };
      return { filled: false };
    }
    if (method === "virement") {
      if (virBenMode === "existing" && virBenSelected) return { filled: true, name: virBenSelected.name, detail: `${virBenSelected.bank} • ${virBenSelected.account}` };
      if (virBenMode === "new" && virBenNew.name.trim()) return { filled: true, name: virBenNew.name, detail: `${virBenNew.bank} • ${virBenNew.account}` };
      return { filled: false };
    }
    return { filled: false };
  };

  const benSummary = getBenSummary();

  // Styles
  const card = (x = {}) => ({
    background: "rgba(255,255,255,0.04)", borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.06)", padding: "14px 16px", marginBottom: 12, ...x,
  });
  const lbl = { fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 };
  const inp = { width: "100%", padding: "12px 14px", borderRadius: 11, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#fff", fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: F };
  const selBtn = (active, color = "#7c3aed") => ({
    flex: 1, padding: "11px 10px", borderRadius: 10, cursor: "pointer", fontFamily: F, textAlign: "left",
    border: active ? `1.5px solid ${color}` : "1px solid rgba(255,255,255,0.06)",
    background: active ? `${color}10` : "transparent",
  });

  return (
    <div style={{
      maxWidth: 430, margin: "0 auto", height: "100dvh",
      display: "flex", flexDirection: "column",
      background: "#0c0e18", fontFamily: F, color: "#fff", overflow: "hidden",
    }}>

      {/* ═══ HEADER ═══ */}
      <div style={{ flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 10px" }}>
          <button onClick={() => go(-1)} style={{
            background: "none", border: "none", fontSize: 22, color: "#fff",
            cursor: step > 0 ? "pointer" : "default", opacity: step > 0 ? 1 : 0.15, width: 36, textAlign: "left",
          }}>←</button>
          <span style={{ fontSize: 17, fontWeight: 700 }}>Nouveau paiement</span>
          <div style={{ width: 36 }} />
        </div>
        <div style={{ display: "flex", gap: 4, padding: "0 16px 12px" }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ flex: 1, textAlign: "center" }}>
              <div style={{
                height: 3, borderRadius: 2, marginBottom: 4,
                background: i < step ? "rgba(124,58,237,0.45)" : i === step ? "#7c3aed" : "rgba(255,255,255,0.06)",
              }} />
              <span style={{ fontSize: 9, fontWeight: 600, color: i <= step ? "#a78bfa" : "rgba(255,255,255,0.12)" }}>{s}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ SCROLLABLE CONTENT ═══ */}
      <div ref={ref} style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{ padding: "16px 16px 24px" }}>

          {/* ─── STEP 1: CLIENT ─── */}
          {step === 0 && <>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Sélectionner un client</h2>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", margin: "4px 0 0" }}>Choisissez le client pour ce paiement</p>
            </div>

            <div style={{ position: "relative", marginBottom: 12 }}>
              <span style={{ position: "absolute", left: 14, top: 12, opacity: 0.25 }}>🔍</span>
              <input placeholder="Nom ou téléphone..." value={q} onChange={e => setQ(e.target.value)}
                style={{ ...inp, paddingLeft: 38 }} />
            </div>

            {filtered.map(c => (
              <div key={c.id} onClick={() => setClient(c)} style={{
                ...card({ marginBottom: 8, cursor: "pointer" }),
                border: client?.id === c.id ? "2px solid #7c3aed" : "1px solid rgba(255,255,255,0.06)",
                background: client?.id === c.id ? "rgba(124,58,237,0.08)" : "rgba(255,255,255,0.02)",
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, background: `${c.col}15`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 800, color: c.col, flexShrink: 0,
                }}>{c.ini}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{c.phone}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: c.bal > 0 ? "#10b981" : "rgba(255,255,255,0.12)" }}>
                    {c.bal > 0 ? c.bal.toLocaleString("fr-FR") : "0"}
                  </div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.18)" }}>XAF</div>
                </div>
              </div>
            ))}
          </>}

          {/* ─── STEP 2: MODE ─── */}
          {step === 1 && <>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Mode de paiement</h2>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", margin: "4px 0 0" }}>Comment le bénéficiaire recevra les fonds ?</p>
            </div>

            {METHODS.map(pm => {
              const sel = method === pm.key;
              return (
                <div key={pm.key} onClick={() => setMethod(pm.key)} style={{
                  ...card({ marginBottom: 10, cursor: "pointer" }),
                  border: sel ? `2px solid ${pm.bg}` : "1px solid rgba(255,255,255,0.06)",
                  background: sel ? `${pm.bg}0d` : "rgba(255,255,255,0.02)",
                  display: "flex", alignItems: "center", gap: 14,
                }}>
                  <div style={{
                    width: 46, height: 46, borderRadius: 12, background: pm.bg,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: pm.key === "virement" ? 20 : 22, fontWeight: 900, color: "#fff", flexShrink: 0,
                    fontFamily: pm.key !== "virement" ? "serif" : F,
                  }}>{pm.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{pm.label}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>{pm.desc}</div>
                  </div>
                  {sel && (
                    <div style={{
                      width: 22, height: 22, borderRadius: "50%", background: pm.bg,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, color: "#fff",
                    }}>✓</div>
                  )}
                </div>
              );
            })}
          </>}

          {/* ─── STEP 3: MONTANT ─── */}
          {step === 2 && <>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Montant du paiement</h2>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", margin: "4px 0 0" }}>
                Solde : <span style={{ color: "#10b981", fontWeight: 600 }}>{client.bal.toLocaleString("fr-FR")} XAF</span>
              </p>
            </div>

            {/* Amount block */}
            <div style={card()}>
              <div style={lbl}>Vous envoyez</div>
              <div style={{ display: "flex", alignItems: "center" }}>
                <input type="text" inputMode="numeric" placeholder="0" value={amt}
                  onChange={e => setAmt(e.target.value.replace(/\D/g, ""))}
                  style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 28, fontWeight: 800, color: "#fff", fontFamily: F, minWidth: 0 }}
                />
                <span style={{ fontSize: 14, color: "rgba(255,255,255,0.25)", flexShrink: 0 }}>XAF</span>
              </div>

              <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "12px 0" }} />

              <div style={lbl}>Bénéficiaire reçoit</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 24, fontWeight: 800, color: cny > 0 ? mi.bg : "rgba(255,255,255,0.1)" }}>
                  ¥ {cny > 0 ? cny.toLocaleString("fr-FR", { maximumFractionDigits: 2 }) : "0,00"}
                </span>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>RMB</span>
              </div>

              {/* Taux dynamique — seulement quand montant >= 10000 */}
              {n >= 10000 && (
                <div style={{
                  marginTop: 12, padding: "9px 12px", borderRadius: 10,
                  background: `${mi.bg}0a`, border: `1px solid ${mi.bg}18`,
                  fontSize: 12,
                }}>
                  <span style={{ color: "rgba(255,255,255,0.35)" }}>Taux appliqué : </span>
                  <span style={{ fontWeight: 700, color: mi.bg }}>{Math.round(rate).toLocaleString("fr-FR")} CNY</span>
                  <span style={{ color: "rgba(255,255,255,0.2)" }}> / 1M XAF</span>
                </div>
              )}
            </div>

            {/* Min warning */}
            {n > 0 && n < 10000 && (
              <div style={{ padding: "9px 14px", borderRadius: 10, marginBottom: 12, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", fontSize: 12, color: "#f87171" }}>
                ⚠️ Montant minimum : 10 000 XAF
              </div>
            )}

            {/* Quick amounts */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {[100000, 250000, 500000, 1000000].map(v => (
                <button key={v} onClick={() => setAmt(String(v))} style={{
                  flex: 1, padding: "10px 4px", borderRadius: 10, fontFamily: F,
                  border: parseInt(amt) === v ? "1.5px solid #7c3aed" : "1px solid rgba(255,255,255,0.06)",
                  background: parseInt(amt) === v ? "rgba(124,58,237,0.1)" : "transparent",
                  color: parseInt(amt) === v ? "#a78bfa" : "rgba(255,255,255,0.3)",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}>{v >= 1e6 ? "1M" : `${v / 1000}K`}</button>
              ))}
            </div>

            {/* Custom rate */}
            <div style={{ ...card(), display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Taux personnalisé</span>
              <div onClick={() => { setUseCustom(!useCustom); if (!useCustom) setCustomVal(String(RATES[method])); }}
                style={{
                  width: 42, height: 24, borderRadius: 12, cursor: "pointer",
                  background: useCustom ? "#7c3aed" : "rgba(255,255,255,0.1)", position: "relative",
                }}>
                <div style={{
                  width: 18, height: 18, borderRadius: "50%", background: "#fff",
                  position: "absolute", top: 3, left: useCustom ? 21 : 3, transition: "left 0.2s",
                }} />
              </div>
            </div>
            {useCustom && (
              <div style={{ ...card(), paddingTop: 10, paddingBottom: 10 }}>
                <div style={lbl}>CNY pour 1 000 000 XAF</div>
                <input value={customVal} onChange={e => setCustomVal(e.target.value)}
                  style={{ ...inp, fontSize: 18, fontWeight: 700, textAlign: "center" }} />
              </div>
            )}

            {/* Date */}
            <div style={card()}>
              <div style={lbl}>Date du paiement</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[{ k: "today", l: "Aujourd'hui" }, { k: "yesterday", l: "Hier" }, { k: "custom", l: "📅 Autre" }].map(d => (
                  <button key={d.k} onClick={() => setDateSel(d.k)} style={{
                    flex: 1, padding: "9px 4px", borderRadius: 9, border: "none", fontFamily: F,
                    background: dateSel === d.k ? "#7c3aed" : "rgba(255,255,255,0.04)",
                    color: dateSel === d.k ? "#fff" : "rgba(255,255,255,0.3)",
                    fontWeight: 600, fontSize: 12, cursor: "pointer",
                  }}>{d.l}</button>
                ))}
              </div>
              {dateSel === "custom" && (
                <input type="date" value={dateCustom} onChange={e => setDateCustom(e.target.value)}
                  style={{ ...inp, marginTop: 8, colorScheme: "dark" }} />
              )}
            </div>

            {/* Notes */}
            <div style={card()}>
              <div style={lbl}>Notes / instructions</div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="Instructions internes..."
                style={{ ...inp, resize: "none", lineHeight: 1.4 }} />
            </div>
          </>}

          {/* ─── STEP 4: BÉNÉFICIAIRE ─── */}
          {step === 3 && <>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Bénéficiaire</h2>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", margin: "4px 0 0" }}>
                {method === "cash" ? "Qui recevra le retrait en espèces ?" :
                 method === "virement" ? "Compte bancaire du destinataire" :
                 `Compte ${mi.label} du destinataire`}
              </p>
            </div>

            {/* Skip option */}
            <div onClick={() => setSkipBen(!skipBen)} style={{
              ...card({ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }),
              border: skipBen ? "1.5px solid #f59e0b" : "1px solid rgba(255,255,255,0.06)",
              background: skipBen ? "rgba(245,158,11,0.06)" : "rgba(255,255,255,0.02)",
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: skipBen ? "#f59e0b" : "#fff" }}>Passer cette étape</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>Compléter plus tard dans la fiche</div>
              </div>
              <div style={{
                width: 20, height: 20, borderRadius: 6, 
                border: skipBen ? "none" : "1.5px solid rgba(255,255,255,0.15)",
                background: skipBen ? "#f59e0b" : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, color: "#fff",
              }}>{skipBen ? "✓" : ""}</div>
            </div>

            {!skipBen && <>
              {/* ── CASH ── */}
              {method === "cash" && <>
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  {[
                    { k: "self", l: "Le client", d: client.name },
                    { k: "other", l: "Autre personne", d: "Définir ci-dessous" },
                  ].map(b => (
                    <button key={b.k} onClick={() => setCashBenType(b.k)} style={selBtn(cashBenType === b.k)}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: cashBenType === b.k ? "#a78bfa" : "#fff" }}>{b.l}</div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>{b.d}</div>
                    </button>
                  ))}
                </div>
                {cashBenType === "other" && (
                  <div style={card({ display: "flex", flexDirection: "column", gap: 10 })}>
                    <div><div style={lbl}>Nom complet *</div><input value={cashBen.name} onChange={e => setCashBen({ ...cashBen, name: e.target.value })} placeholder="Nom et prénom" style={inp} /></div>
                    <div><div style={lbl}>Téléphone *</div><input value={cashBen.phone} onChange={e => setCashBen({ ...cashBen, phone: e.target.value })} placeholder="+237..." style={inp} /></div>
                    <div><div style={lbl}>E-mail <span style={{ fontWeight: 400, textTransform: "none" }}>(optionnel)</span></div><input value={cashBen.email} onChange={e => setCashBen({ ...cashBen, email: e.target.value })} placeholder="email@exemple.com" style={inp} /></div>
                  </div>
                )}
              </>}

              {/* ── ALIPAY / WECHAT ── */}
              {(method === "alipay" || method === "wechat") && <>
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  {[
                    { k: "existing", l: "Bénéficiaire existant" },
                    { k: "new", l: "Nouveau bénéficiaire" },
                  ].map(b => (
                    <button key={b.k} onClick={() => { setAwBenMode(b.k); setAwBenSelected(null); }} style={selBtn(awBenMode === b.k)}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: awBenMode === b.k ? "#a78bfa" : "#fff" }}>{b.l}</div>
                    </button>
                  ))}
                </div>

                {awBenMode === "existing" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {(method === "alipay" ? SAVED_BEN_ALIPAY : SAVED_BEN_WECHAT).map(b => (
                      <div key={b.id} onClick={() => setAwBenSelected(b)} style={{
                        ...card({ marginBottom: 0, cursor: "pointer" }),
                        border: awBenSelected?.id === b.id ? `1.5px solid ${mi.bg}` : "1px solid rgba(255,255,255,0.06)",
                        background: awBenSelected?.id === b.id ? `${mi.bg}10` : "rgba(255,255,255,0.02)",
                        display: "flex", alignItems: "center", gap: 12,
                      }}>
                        <div style={{
                          width: 38, height: 38, borderRadius: 10, background: `${mi.bg}18`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 16, fontWeight: 900, color: mi.bg, fontFamily: "serif", flexShrink: 0,
                        }}>{mi.icon}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{b.name}</div>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{b.identifier}</div>
                        </div>
                        {awBenSelected?.id === b.id && (
                          <div style={{ width: 20, height: 20, borderRadius: "50%", background: mi.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff" }}>✓</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {awBenMode === "new" && (
                  <div style={card({ display: "flex", flexDirection: "column", gap: 10 })}>
                    <div><div style={lbl}>Nom du bénéficiaire</div><input value={awBenNew.name} onChange={e => setAwBenNew({ ...awBenNew, name: e.target.value })} placeholder="Nom complet" style={inp} /></div>

                    <div style={lbl}>Méthode d'identification</div>
                    <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                      {[
                        { k: "qr", l: "QR Code" },
                        { k: "id", l: `ID ${mi.label}` },
                        { k: "email", l: "Email" },
                        { k: "phone", l: "Téléphone" },
                      ].map(t => (
                        <button key={t.k} onClick={() => setAwBenNew({ ...awBenNew, type: t.k })} style={{
                          flex: 1, padding: "8px 4px", borderRadius: 8, border: "none", fontFamily: F,
                          background: awBenNew.type === t.k ? "#7c3aed" : "rgba(255,255,255,0.04)",
                          color: awBenNew.type === t.k ? "#fff" : "rgba(255,255,255,0.3)",
                          fontSize: 10, fontWeight: 600, cursor: "pointer",
                        }}>{t.l}</button>
                      ))}
                    </div>

                    {awBenNew.type === "qr" ? (
                      <div style={{
                        padding: 20, borderRadius: 12, border: "2px dashed rgba(255,255,255,0.1)",
                        textAlign: "center",
                      }}>
                        <div style={{ fontSize: 28, marginBottom: 6, opacity: 0.3 }}>📷</div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Scanner ou importer un QR code</div>
                      </div>
                    ) : (
                      <div>
                        <div style={lbl}>
                          {awBenNew.type === "id" ? `Identifiant ${mi.label}` : awBenNew.type === "email" ? "Adresse e-mail" : "Numéro de téléphone"}
                        </div>
                        <input value={awBenNew.identifier} onChange={e => setAwBenNew({ ...awBenNew, identifier: e.target.value })}
                          placeholder={awBenNew.type === "id" ? "ex: user_123" : awBenNew.type === "email" ? "email@exemple.com" : "+86..."}
                          style={inp}
                        />
                      </div>
                    )}
                  </div>
                )}
              </>}

              {/* ── VIREMENT ── */}
              {method === "virement" && <>
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  {[
                    { k: "existing", l: "Compte existant" },
                    { k: "new", l: "Nouveau compte" },
                  ].map(b => (
                    <button key={b.k} onClick={() => { setVirBenMode(b.k); setVirBenSelected(null); }} style={selBtn(virBenMode === b.k)}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: virBenMode === b.k ? "#a78bfa" : "#fff" }}>{b.l}</div>
                    </button>
                  ))}
                </div>

                {virBenMode === "existing" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {SAVED_BEN_VIREMENT.map(b => (
                      <div key={b.id} onClick={() => setVirBenSelected(b)} style={{
                        ...card({ marginBottom: 0, cursor: "pointer" }),
                        border: virBenSelected?.id === b.id ? "1.5px solid #8b5cf6" : "1px solid rgba(255,255,255,0.06)",
                        background: virBenSelected?.id === b.id ? "rgba(139,92,246,0.08)" : "rgba(255,255,255,0.02)",
                        display: "flex", alignItems: "center", gap: 12,
                      }}>
                        <div style={{
                          width: 38, height: 38, borderRadius: 10, background: "rgba(139,92,246,0.15)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 16, flexShrink: 0,
                        }}>🏦</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{b.name}</div>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{b.bank} • {b.account}</div>
                        </div>
                        {virBenSelected?.id === b.id && (
                          <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#8b5cf6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff" }}>✓</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {virBenMode === "new" && (
                  <div style={card({ display: "flex", flexDirection: "column", gap: 10 })}>
                    <div><div style={lbl}>Nom du titulaire</div><input value={virBenNew.name} onChange={e => setVirBenNew({ ...virBenNew, name: e.target.value })} placeholder="Nom complet" style={inp} /></div>
                    <div><div style={lbl}>Nom de la banque</div><input value={virBenNew.bank} onChange={e => setVirBenNew({ ...virBenNew, bank: e.target.value })} placeholder="ex: Bank of China" style={inp} /></div>
                    <div><div style={lbl}>Numéro de compte</div><input value={virBenNew.account} onChange={e => setVirBenNew({ ...virBenNew, account: e.target.value })} placeholder="Numéro de compte" style={inp} /></div>
                    <div><div style={lbl}>Informations complémentaires <span style={{ fontWeight: 400, textTransform: "none" }}>(optionnel)</span></div><input value={virBenNew.extra} onChange={e => setVirBenNew({ ...virBenNew, extra: e.target.value })} placeholder="SWIFT, branche, etc." style={inp} /></div>
                  </div>
                )}
              </>}
            </>}
          </>}

          {/* ─── STEP 5: RÉCAPITULATIF ─── */}
          {step === 4 && <>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Récapitulatif</h2>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", margin: "4px 0 0" }}>Vérifiez avant de confirmer</p>
            </div>

            {/* Client */}
            <div style={{ ...card(), display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, background: `${client.col}15`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 800, color: client.col, flexShrink: 0,
              }}>{client.ini}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{client.name}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{client.phone}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>Solde après</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#10b981" }}>{(client.bal - n).toLocaleString("fr-FR")} XAF</div>
              </div>
            </div>

            {/* Amounts */}
            <div style={{ ...card(), background: `${mi.bg}08`, border: `1px solid ${mi.bg}15` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>Montant débité</span>
                <span style={{ fontSize: 17, fontWeight: 800 }}>{n.toLocaleString("fr-FR")} XAF</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>Montant à payer</span>
                <span style={{ fontSize: 17, fontWeight: 800, color: mi.bg }}>¥ {cny.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} RMB</span>
              </div>
              <div style={{ height: 1, background: "rgba(255,255,255,0.05)", marginBottom: 8 }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "rgba(255,255,255,0.3)" }}>Taux{useCustom ? " (personnalisé)" : ""}</span>
                <span style={{ fontWeight: 600 }}>1M XAF = {Math.round(rate).toLocaleString("fr-FR")} CNY</span>
              </div>
            </div>

            {/* Method */}
            <div style={{ ...card(), display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, background: mi.bg,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 17, fontWeight: 900, color: "#fff", flexShrink: 0,
                fontFamily: method !== "virement" ? "serif" : F,
              }}>{mi.icon}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{mi.label}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{mi.desc}</div>
              </div>
            </div>

            {/* Beneficiary */}
            <div style={card()}>
              <div style={lbl}>Bénéficiaire</div>
              {skipBen || !benSummary.filled ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} />
                  <span style={{ fontSize: 13, color: "#f59e0b", fontWeight: 500 }}>À compléter dans la fiche de paiement</span>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{benSummary.name}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{benSummary.detail}</div>
                </>
              )}
            </div>

            {/* Date */}
            <div style={{ ...card(), display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>📅 Date</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                {dateSel === "today" ? "Aujourd'hui" : dateSel === "yesterday" ? "Hier" : dateCustom.split("-").reverse().join("/")}
              </span>
            </div>

            {/* Notes */}
            {notes && (
              <div style={card()}>
                <div style={lbl}>Notes</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{notes}</div>
              </div>
            )}
          </>}

        </div>
      </div>

      {/* ═══ FOOTER ═══ */}
      {!showSuccess && (
        <div style={{
          flexShrink: 0, padding: "12px 16px 24px",
          borderTop: "1px solid rgba(255,255,255,0.04)", background: "#0c0e18",
        }}>
          {step < 4 ? (
            <button onClick={() => go(1)} disabled={!canNext()} style={{
              width: "100%", padding: 16, borderRadius: 14, border: "none",
              background: canNext() ? "linear-gradient(135deg, #a78bfa, #7c3aed)" : "rgba(255,255,255,0.04)",
              color: canNext() ? "#fff" : "rgba(255,255,255,0.15)",
              fontSize: 16, fontWeight: 700, fontFamily: F,
              cursor: canNext() ? "pointer" : "not-allowed",
            }}>
              {step === 3 ? "Voir le récapitulatif" : "Continuer"}
            </button>
          ) : (
            <button onClick={() => setShowSuccess(true)} style={{
              width: "100%", padding: 16, borderRadius: 14, border: "none",
              background: "linear-gradient(135deg, #a78bfa, #7c3aed)",
              color: "#fff", fontSize: 16, fontWeight: 700, fontFamily: F, cursor: "pointer",
            }}>
              Confirmer le paiement
            </button>
          )}
        </div>
      )}

      {/* ═══ SUCCESS OVERLAY ═══ */}
      {showSuccess && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 50,
          background: "#0c0e18",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          animation: "fadeIn 0.3s ease",
        }}>
          <style>{`
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes scaleIn { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            @keyframes drawCheck {
              0% { stroke-dashoffset: 50; }
              100% { stroke-dashoffset: 0; }
            }
            @keyframes pulseRing {
              0% { transform: scale(0.8); opacity: 0; }
              50% { opacity: 0.3; }
              100% { transform: scale(1.6); opacity: 0; }
            }
          `}</style>

          {/* Animated circle + check */}
          <div style={{ position: "relative", marginBottom: 32 }}>
            {/* Pulse ring */}
            <div style={{
              position: "absolute", inset: -20,
              borderRadius: "50%", border: "3px solid #10b981",
              animation: "pulseRing 1.5s ease-out infinite",
            }} />
            <div style={{
              width: 90, height: 90, borderRadius: "50%",
              background: "linear-gradient(135deg, #10b981, #059669)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 40px rgba(16,185,129,0.3)",
              animation: "scaleIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
            }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                <path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                  style={{ strokeDasharray: 50, animation: "drawCheck 0.5s ease 0.3s both" }}
                />
              </svg>
            </div>
          </div>

          {/* Text */}
          <div style={{ animation: "slideUp 0.4s ease 0.3s both", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Paiement créé</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>
              {n.toLocaleString("fr-FR")} XAF → <span style={{ color: mi.bg, fontWeight: 700 }}>¥ {cny.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} RMB</span>
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.25)" }}>
              {mi.label} • {client.name}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{
            animation: "slideUp 0.4s ease 0.5s both",
            display: "flex", flexDirection: "column", gap: 10,
            width: "100%", padding: "0 24px", marginTop: 40,
          }}>
            <button onClick={() => { setShowSuccess(false); setStep(0); setClient(null); setMethod(null); setAmt(""); setNotes(""); setSkipBen(false); setCashBenType("self"); setCashBen({ name: "", phone: "", email: "" }); setAwBenMode("existing"); setAwBenSelected(null); setVirBenMode("existing"); setVirBenSelected(null); }} style={{
              width: "100%", padding: 15, borderRadius: 14, border: "none",
              background: "linear-gradient(135deg, #a78bfa, #7c3aed)",
              color: "#fff", fontSize: 15, fontWeight: 700, fontFamily: F, cursor: "pointer",
            }}>
              Nouveau paiement
            </button>
            <button onClick={() => setShowSuccess(false)} style={{
              width: "100%", padding: 15, borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.1)", background: "transparent",
              color: "rgba(255,255,255,0.5)", fontSize: 14, fontWeight: 600, fontFamily: F, cursor: "pointer",
            }}>
              Voir la fiche de paiement
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

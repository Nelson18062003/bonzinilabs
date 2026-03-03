import { useState } from "react";
import { XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart, CartesianGrid } from "recharts";

const PAYMENT_METHODS = [
  { key: "cash", label: "Cash", icon: "💵", color: "#10b981", chartColor: "#10b981" },
  { key: "alipay", label: "Alipay", icon: "🔵", color: "#1677ff", chartColor: "#3b82f6" },
  { key: "wechat", label: "WeChat", icon: "🟢", color: "#07c160", chartColor: "#f59e0b" },
  { key: "virement", label: "Virement", icon: "🏦", color: "#8b5cf6", chartColor: "#8b5cf6" },
];

const COUNTRIES = [
  { key: "cameroun", label: "Cameroun", flag: "🇨🇲", adjustment: 0, isRef: true },
  { key: "gabon", label: "Gabon", flag: "🇬🇦", adjustment: -1.5 },
  { key: "tchad", label: "Tchad", flag: "🇹🇩", adjustment: -1.5 },
  { key: "rca", label: "Centrafrique", flag: "🇨🇫", adjustment: -1.5 },
  { key: "congo", label: "Congo", flag: "🇨🇬", adjustment: -1.5 },
  { key: "guinee", label: "Guinée Éq.", flag: "🇬🇶", adjustment: -1.5 },
];

const TIERS = [
  { key: "t3", label: "≥ 1 000 000 XAF", shortLabel: "≥1M", adjustment: 0, isRef: true },
  { key: "t2", label: "400 000 – 999 999 XAF", shortLabel: "400K–999K", adjustment: -1 },
  { key: "t1", label: "10 000 – 399 999 XAF", shortLabel: "10K–399K", adjustment: -2 },
];

const CHART_DATA_30D = [
  { date: "01/02", cash: 11520, alipay: 11370, wechat: 11420, virement: 11470 },
  { date: "03/02", cash: 11480, alipay: 11330, wechat: 11380, virement: 11430 },
  { date: "05/02", cash: 11500, alipay: 11350, wechat: 11400, virement: 11450 },
  { date: "07/02", cash: 11490, alipay: 11340, wechat: 11390, virement: 11440 },
  { date: "10/02", cash: 11510, alipay: 11360, wechat: 11410, virement: 11460 },
  { date: "12/02", cash: 11550, alipay: 11400, wechat: 11450, virement: 11500 },
  { date: "14/02", cash: 11580, alipay: 11430, wechat: 11480, virement: 11530 },
  { date: "16/02", cash: 11560, alipay: 11410, wechat: 11460, virement: 11510 },
  { date: "18/02", cash: 11610, alipay: 11460, wechat: 11510, virement: 11560 },
  { date: "20/02", cash: 11650, alipay: 11500, wechat: 11550, virement: 11600 },
  { date: "22/02", cash: 11680, alipay: 11530, wechat: 11580, virement: 11630 },
  { date: "23/02", cash: 11610, alipay: 11460, wechat: 11510, virement: 11560 },
  { date: "24/02", cash: 11680, alipay: 11530, wechat: 11580, virement: 11630 },
  { date: "25/02", cash: 11700, alipay: 11550, wechat: 11600, virement: 11650 },
  { date: "26/02", cash: 11705, alipay: 11555, wechat: 11605, virement: 11655 },
  { date: "27/02", cash: 11750, alipay: 11600, wechat: 11650, virement: 11700 },
  { date: "02/03", cash: 11800, alipay: 11650, wechat: 11700, virement: 11750 },
];
const CHART_DATA_7D = CHART_DATA_30D.slice(-7);
const CHART_DATA_3M = [
  { date: "Déc", cash: 11200, alipay: 11050, wechat: 11100, virement: 11150 },
  { date: "Mi-Déc", cash: 11280, alipay: 11130, wechat: 11180, virement: 11230 },
  { date: "Jan", cash: 11350, alipay: 11200, wechat: 11250, virement: 11300 },
  { date: "Mi-Jan", cash: 11400, alipay: 11250, wechat: 11300, virement: 11350 },
  { date: "Fév", cash: 11500, alipay: 11350, wechat: 11400, virement: 11450 },
  { date: "Mi-Fév", cash: 11600, alipay: 11450, wechat: 11500, virement: 11550 },
  { date: "Mars", cash: 11800, alipay: 11650, wechat: 11700, virement: 11750 },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null;
  return (
    <div style={{ background: "rgba(26,26,46,0.95)", borderRadius: 10, padding: "10px 14px", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color }} />
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{p.name}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginLeft: "auto", paddingLeft: 12 }}>{p.value.toLocaleString("fr-FR")}</span>
        </div>
      ))}
    </div>
  );
};

export default function RateAdmin() {
  const [activeTab, setActiveTab] = useState("rates");
  const [activeSubTab, setActiveSubTab] = useState("set");
  const [direction, setDirection] = useState("xaf_cny");
  const [dateOption, setDateOption] = useState("now");
  const [chartPeriod, setChartPeriod] = useState("30J");
  const [visibleLines, setVisibleLines] = useState({ cash: true, alipay: true, wechat: true, virement: true });
  const [customDate, setCustomDate] = useState("2026-03-03");
  const [customHour, setCustomHour] = useState(8);
  const [customMin, setCustomMin] = useState(0);

  const [rates, setRates] = useState({ cash: "11800", alipay: "11650", wechat: "11700", virement: "11750" });
  const [countries, setCountries] = useState(COUNTRIES.reduce((acc, c) => ({ ...acc, [c.key]: c.adjustment }), {}));
  const [tiers, setTiers] = useState(TIERS.reduce((acc, t) => ({ ...acc, [t.key]: t.adjustment }), {}));
  const [simulator, setSimulator] = useState({ amount: "500000", method: "cash", country: "cameroun" });
  const [showSuccess, setShowSuccess] = useState(false);

  const handleApply = () => { setShowSuccess(true); setTimeout(() => setShowSuccess(false), 2500); };
  const toggleLine = (key) => {
    const next = { ...visibleLines, [key]: !visibleLines[key] };
    if (Object.values(next).filter(Boolean).length < 1) return;
    setVisibleLines(next);
  };

  const chartData = chartPeriod === "7J" ? CHART_DATA_7D : chartPeriod === "3M" ? CHART_DATA_3M : CHART_DATA_30D;
  const allCashVals = chartData.map(d => d.cash);
  const stats = { min: Math.min(...allCashVals), max: Math.max(...allCashVals), avg: Math.round(allCashVals.reduce((a, b) => a + b, 0) / allCashVals.length) };

  const simRate = parseFloat(rates[simulator.method]) || 0;
  const simAmount = parseFloat(simulator.amount) || 0;
  const simTierKey = simAmount >= 1000000 ? "t3" : simAmount >= 400000 ? "t2" : "t1";
  const simFinalRate = simRate * (1 + countries[simulator.country] / 100) * (1 + tiers[simTierKey] / 100);
  const simResult = simAmount * (simFinalRate / 1000000);

  const historyData = [
    { date: "02 mars 2026", time: "07:23", cash: 11800, alipay: 11650, wechat: 11700, virement: 11750, active: true, change: "+0,4%" },
    { date: "27 fév. 2026", time: "08:42", cash: 11750, alipay: 11600, wechat: 11650, virement: 11700, change: "+0,4%" },
    { date: "26 fév. 2026", time: "07:58", cash: 11705, alipay: 11555, wechat: 11605, virement: 11655, change: "+0,0%" },
    { date: "25 fév. 2026", time: "05:37", cash: 11700, alipay: 11550, wechat: 11600, virement: 11650, change: "+0,2%" },
    { date: "24 fév. 2026", time: "07:16", cash: 11680, alipay: 11530, wechat: 11580, virement: 11630, change: "+0,6%" },
  ];

  const font = "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

  return (
    <div style={{ maxWidth: 430, margin: "0 auto", minHeight: "100vh", background: "#f8f9fb", fontFamily: font, position: "relative" }}>
      {/* Status bar */}
      <div style={{ padding: "8px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, fontWeight: 600, color: "#1a1a2e", background: "#fff" }}>
        <span>23:39</span><span style={{ fontSize: 11, color: "#999" }}>bonzinilabs.com</span><span>5G 🔋</span>
      </div>

      {/* Header */}
      <div style={{ background: "#fff", padding: "12px 20px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #eee" }}>
        <button style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#666" }}>←</button>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", margin: 0 }}>Taux de change</h1>
        <button onClick={() => { setActiveTab("rates"); setActiveSubTab("set"); }} style={{ background: "#7c3aed", border: "none", borderRadius: "50%", width: 36, height: 36, color: "#fff", fontSize: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(124,58,237,0.3)" }}>+</button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", background: "#fff", padding: "0 12px", borderBottom: "1px solid #eee" }}>
        {[{ key: "rates", label: "📊 Taux" }, { key: "config", label: "⚙️ Config" }, { key: "simulator", label: "🧮 Simuler" }].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            flex: 1, padding: "14px 6px", background: "none", border: "none",
            borderBottom: activeTab === tab.key ? "3px solid #7c3aed" : "3px solid transparent",
            color: activeTab === tab.key ? "#7c3aed" : "#999", fontWeight: activeTab === tab.key ? 700 : 500,
            fontSize: 13, cursor: "pointer",
          }}>{tab.label}</button>
        ))}
      </div>

      <div style={{ padding: 16, paddingBottom: 100 }}>

        {/* ========== TAUX ========== */}
        {activeTab === "rates" && (<>
          <div style={{ display: "flex", background: "#eee", borderRadius: 12, padding: 3, marginBottom: 16 }}>
            {[{ key: "set", label: "Définir" }, { key: "chart", label: "Graphique" }, { key: "history", label: "Historique" }].map(st => (
              <button key={st.key} onClick={() => setActiveSubTab(st.key)} style={{
                flex: 1, padding: "10px 8px", borderRadius: 10, border: "none",
                background: activeSubTab === st.key ? "#fff" : "transparent",
                color: activeSubTab === st.key ? "#1a1a2e" : "#888",
                fontWeight: activeSubTab === st.key ? 600 : 400, fontSize: 13, cursor: "pointer",
                boxShadow: activeSubTab === st.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              }}>{st.label}</button>
            ))}
          </div>

          {/* DÉFINIR */}
          {activeSubTab === "set" && (<>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {[{ key: "cny_xaf", label: "1 CNY → XAF" }, { key: "xaf_cny", label: "1M XAF → CNY" }].map(d => (
                <button key={d.key} onClick={() => setDirection(d.key)} style={{
                  flex: 1, padding: 12, borderRadius: 12,
                  border: direction === d.key ? "2px solid #7c3aed" : "2px solid #e5e7eb",
                  background: direction === d.key ? "#f3e8ff" : "#fff",
                  color: direction === d.key ? "#7c3aed" : "#666", fontWeight: 600, fontSize: 13, cursor: "pointer",
                }}>{d.label}</button>
              ))}
            </div>

            <p style={{ fontSize: 13, color: "#888", marginBottom: 12, fontWeight: 500 }}>
              {direction === "xaf_cny" ? "CNY pour 1 000 000 XAF par mode :" : "XAF pour 1 CNY par mode :"}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {PAYMENT_METHODS.map(pm => (
                <div key={pm.key} style={{
                  background: "#fff", borderRadius: 14, padding: "14px 16px",
                  display: "flex", alignItems: "center", gap: 12,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.04)", border: "1px solid #f0f0f0",
                }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: `${pm.color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{pm.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a2e", marginBottom: 2 }}>{pm.label}</div>
                    <div style={{ fontSize: 11, color: "#aaa" }}>{direction === "xaf_cny" ? "CNY / 1M XAF" : "XAF / 1 CNY"}</div>
                  </div>
                  <input type="text" value={rates[pm.key]} onChange={e => setRates({ ...rates, [pm.key]: e.target.value })}
                    style={{ width: 100, padding: "10px 12px", borderRadius: 10, border: "2px solid #e5e7eb", fontSize: 16, fontWeight: 700, color: "#1a1a2e", textAlign: "right", outline: "none" }}
                    onFocus={e => e.target.style.borderColor = "#7c3aed"} onBlur={e => e.target.style.borderColor = "#e5e7eb"}
                  />
                </div>
              ))}
            </div>

            {/* IMPROVED PREVIEW - clearer explanation */}
            <div style={{
              background: "linear-gradient(135deg, #f8f0ff, #eef2ff)", borderRadius: 14, padding: 16, marginBottom: 20, border: "1px solid #e8daff",
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#7c3aed", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
                ⚡ Vérification de vos taux saisis
              </div>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 12 }}>
                Voici les taux tels que vous les avez saisis ci-dessus. Ce sont les taux de base (meilleur cas : Cameroun, gros montant ≥ 1M XAF). Les ajustements pays et tranches s'appliqueront automatiquement.
              </div>
              {PAYMENT_METHODS.map(pm => {
                const val = parseFloat(rates[pm.key]) || 0;
                return (
                  <div key={pm.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(124,58,237,0.1)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 16 }}>{pm.icon}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e" }}>{pm.label}</div>
                        <div style={{ fontSize: 11, color: "#aaa" }}>1M XAF = {val.toLocaleString("fr-FR")} CNY</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#7c3aed" }}>{val.toLocaleString("fr-FR")}</div>
                      <div style={{ fontSize: 10, color: "#aaa" }}>CNY</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* DATE D'EFFET - with custom date+time */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#1a1a2e", marginBottom: 10 }}>Date d'effet</p>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                {[{ key: "now", label: "Maintenant" }, { key: "today", label: "Aujourd'hui" }, { key: "yesterday", label: "Hier" }].map(d => (
                  <button key={d.key} onClick={() => setDateOption(d.key)} style={{
                    flex: 1, padding: "10px 8px", borderRadius: 10, border: "none",
                    background: dateOption === d.key ? "#7c3aed" : "#f3f4f6",
                    color: dateOption === d.key ? "#fff" : "#666", fontWeight: 600, fontSize: 12, cursor: "pointer",
                  }}>{d.label}</button>
                ))}
              </div>

              {/* Custom date button */}
              <button
                onClick={() => setDateOption("custom")}
                style={{
                  width: "100%", padding: "12px 16px", borderRadius: 10,
                  border: dateOption === "custom" ? "2px solid #7c3aed" : "2px solid #e5e7eb",
                  background: dateOption === "custom" ? "#f3e8ff" : "#fff",
                  color: dateOption === "custom" ? "#7c3aed" : "#888",
                  fontWeight: 500, fontSize: 13, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  marginBottom: dateOption === "custom" ? 10 : 0,
                }}
              >
                📅 Autre date...
              </button>

              {/* Custom date + time picker */}
              {dateOption === "custom" && (
                <div style={{
                  background: "#fff", borderRadius: 12, padding: 14,
                  border: "1px solid #e5e7eb", display: "flex", flexDirection: "column", gap: 12,
                }}>
                  {/* Date input */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 6 }}>Date</label>
                    <input
                      type="date"
                      value={customDate}
                      onChange={e => setCustomDate(e.target.value)}
                      style={{
                        width: "100%", padding: "10px 12px", borderRadius: 8,
                        border: "2px solid #e5e7eb", fontSize: 14, fontWeight: 600,
                        color: "#1a1a2e", outline: "none", boxSizing: "border-box",
                      }}
                      onFocus={e => e.target.style.borderColor = "#7c3aed"}
                      onBlur={e => e.target.style.borderColor = "#e5e7eb"}
                    />
                  </div>

                  {/* Time picker with +/- buttons */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 6 }}>Heure</label>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      <button onClick={() => setCustomHour(h => Math.max(0, h - 1))} style={{
                        width: 40, height: 40, borderRadius: 10, border: "1px solid #e5e7eb",
                        background: "#f9fafb", fontSize: 18, cursor: "pointer", color: "#666",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>−</button>
                      <div style={{
                        width: 56, height: 44, borderRadius: 10, background: "#f3f4f6",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 22, fontWeight: 800, color: "#1a1a2e",
                      }}>{String(customHour).padStart(2, "0")}</div>
                      <button onClick={() => setCustomHour(h => Math.min(23, h + 1))} style={{
                        width: 40, height: 40, borderRadius: 10, border: "1px solid #e5e7eb",
                        background: "#f9fafb", fontSize: 18, cursor: "pointer", color: "#666",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>+</button>

                      <span style={{ fontSize: 22, fontWeight: 800, color: "#1a1a2e" }}>:</span>

                      <button onClick={() => setCustomMin(m => Math.max(0, m - 1))} style={{
                        width: 40, height: 40, borderRadius: 10, border: "1px solid #e5e7eb",
                        background: "#f9fafb", fontSize: 18, cursor: "pointer", color: "#666",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>−</button>
                      <div style={{
                        width: 56, height: 44, borderRadius: 10, background: "#f3f4f6",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 22, fontWeight: 800, color: "#1a1a2e",
                      }}>{String(customMin).padStart(2, "0")}</div>
                      <button onClick={() => setCustomMin(m => Math.min(59, m + 1))} style={{
                        width: 40, height: 40, borderRadius: 10, border: "1px solid #e5e7eb",
                        background: "#f9fafb", fontSize: 18, cursor: "pointer", color: "#666",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>+</button>
                    </div>
                  </div>

                  {/* Summary */}
                  <div style={{
                    background: "#f8f0ff", borderRadius: 8, padding: "8px 12px",
                    textAlign: "center", fontSize: 13, color: "#7c3aed", fontWeight: 600,
                  }}>
                    📅 {customDate.split("-").reverse().join("/")} à {String(customHour).padStart(2, "0")}:{String(customMin).padStart(2, "0")}
                  </div>
                </div>
              )}
            </div>

            <button onClick={handleApply} style={{
              width: "100%", padding: 16, borderRadius: 14, border: "none",
              background: showSuccess ? "linear-gradient(135deg, #10b981, #059669)" : "linear-gradient(135deg, #a78bfa, #7c3aed)",
              color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 15px rgba(124,58,237,0.3)",
            }}>{showSuccess ? "✓ Taux appliqués !" : "Appliquer les nouveaux taux"}</button>
          </>)}

          {/* GRAPHIQUE */}
          {activeSubTab === "chart" && (<>
            <div style={{ display: "flex", background: "#fff", borderRadius: 12, padding: 3, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              {["7J", "30J", "3M"].map(p => (
                <button key={p} onClick={() => setChartPeriod(p)} style={{
                  flex: 1, padding: 10, borderRadius: 10, border: "none",
                  background: chartPeriod === p ? "#7c3aed" : "transparent",
                  color: chartPeriod === p ? "#fff" : "#888", fontWeight: 600, fontSize: 13, cursor: "pointer",
                }}>{p}</button>
              ))}
            </div>

            <div style={{ background: "#fff", borderRadius: 16, padding: "16px 8px 8px", marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <div style={{ padding: "0 8px", marginBottom: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a2e" }}>Tendance des taux</div>
                <div style={{ fontSize: 12, color: "#999" }}>CNY pour 1 000 000 XAF</div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                  <defs>
                    {PAYMENT_METHODS.map(pm => (
                      <linearGradient key={pm.key} id={`grad_${pm.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={pm.chartColor} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={pm.chartColor} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#aaa" }} axisLine={{ stroke: "#eee" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#aaa" }} axisLine={false} tickLine={false} domain={["dataMin - 50", "dataMax + 50"]} tickFormatter={v => v.toLocaleString("fr-FR")} />
                  <Tooltip content={<CustomTooltip />} />
                  {PAYMENT_METHODS.map(pm => visibleLines[pm.key] && (
                    <Area key={pm.key} type="monotone" dataKey={pm.key} name={pm.label}
                      stroke={pm.chartColor} strokeWidth={2.5} fill={`url(#grad_${pm.key})`}
                      dot={chartData.length <= 10 ? { r: 3, fill: pm.chartColor, strokeWidth: 0 } : false}
                      activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", gap: 6, padding: "10px 8px 6px", flexWrap: "wrap", justifyContent: "center" }}>
                {PAYMENT_METHODS.map(pm => (
                  <button key={pm.key} onClick={() => toggleLine(pm.key)} style={{
                    display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 20,
                    border: `2px solid ${visibleLines[pm.key] ? pm.chartColor : "#ddd"}`,
                    background: visibleLines[pm.key] ? `${pm.chartColor}12` : "#fafafa", cursor: "pointer",
                  }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: visibleLines[pm.key] ? pm.chartColor : "#ccc" }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: visibleLines[pm.key] ? pm.chartColor : "#aaa" }}>{pm.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {[{ label: "Min", value: stats.min, color: "#ef4444" }, { label: "Moy", value: stats.avg, color: "#f59e0b" }, { label: "Max", value: stats.max, color: "#10b981" }].map(s => (
                <div key={s.label} style={{ flex: 1, background: "#fff", borderRadius: 12, padding: "12px 10px", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                  <div style={{ fontSize: 10, color: "#aaa", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value.toLocaleString("fr-FR")}</div>
                  <div style={{ fontSize: 10, color: "#ccc" }}>CNY (Cash)</div>
                </div>
              ))}
            </div>

            <div style={{ background: "#fff", borderRadius: 16, padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a2e", marginBottom: 4 }}>Écart entre modes</div>
              <div style={{ fontSize: 12, color: "#999", marginBottom: 14 }}>Différence vs Cash (référence)</div>
              {PAYMENT_METHODS.map(pm => {
                const last = chartData[chartData.length - 1];
                const diff = last[pm.key] - last.cash;
                const barW = pm.key === "cash" ? 100 : Math.max(8, (1 - Math.abs(diff) / 200) * 100);
                return (
                  <div key={pm.key} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 14 }}>{pm.icon}</span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: "#555" }}>{pm.label}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#1a1a2e" }}>{last[pm.key].toLocaleString("fr-FR")}</span>
                        {pm.key !== "cash" ? (
                          <span style={{ fontSize: 11, fontWeight: 600, color: "#ef4444", background: "#fef2f2", padding: "2px 8px", borderRadius: 10 }}>{diff}</span>
                        ) : (
                          <span style={{ fontSize: 10, background: "#dcfce7", color: "#16a34a", padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>REF</span>
                        )}
                      </div>
                    </div>
                    <div style={{ height: 6, background: "#f3f4f6", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${barW}%`, background: pm.chartColor, borderRadius: 3, transition: "width 0.5s" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>)}

          {/* HISTORIQUE */}
          {activeSubTab === "history" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {historyData.map((h, i) => (
                <div key={i} style={{
                  background: "#fff", borderRadius: 14, padding: 16,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                  border: h.active ? "2px solid #7c3aed" : "1px solid #f0f0f0",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontSize: 13, color: "#888" }}>{h.date} à {h.time}</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      {h.active && <span style={{ background: "#dcfce7", color: "#16a34a", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>Actif</span>}
                      <span style={{ background: h.change.startsWith("-") ? "#fef2f2" : "#f0fdf4", color: h.change.startsWith("-") ? "#ef4444" : "#16a34a", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>{h.change}</span>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {PAYMENT_METHODS.map(pm => (
                      <div key={pm.key} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", background: "#f9fafb", borderRadius: 8 }}>
                        <span style={{ fontSize: 16 }}>{pm.icon}</span>
                        <div>
                          <div style={{ fontSize: 11, color: "#aaa" }}>{pm.label}</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a2e" }}>{h[pm.key].toLocaleString("fr-FR")}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>)}

        {/* ========== CONFIG ========== */}
        {activeTab === "config" && (<>
          <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 18 }}>🌍</span>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1a1a2e", margin: 0 }}>Ajustements par pays</h3>
            </div>
            <p style={{ fontSize: 12, color: "#999", marginBottom: 14 }}>Cameroun = référence (0%).</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {COUNTRIES.map(c => (
                <div key={c.key} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px",
                  background: c.isRef ? "#f0fdf4" : "#f9fafb", borderRadius: 10,
                  border: c.isRef ? "1px solid #bbf7d0" : "1px solid #f0f0f0",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 20 }}>{c.flag}</span>
                    <span style={{ fontSize: 14, fontWeight: 500, color: "#1a1a2e" }}>{c.label}</span>
                    {c.isRef && <span style={{ fontSize: 10, background: "#dcfce7", color: "#16a34a", padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>REF</span>}
                  </div>
                  {c.isRef ? <span style={{ fontSize: 14, fontWeight: 700, color: "#16a34a" }}>0 %</span> : (
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <input type="text" value={countries[c.key]}
                        onChange={e => setCountries({ ...countries, [c.key]: parseFloat(e.target.value) || 0 })}
                        style={{ width: 60, padding: "8px 10px", borderRadius: 8, border: "2px solid #e5e7eb", fontSize: 14, fontWeight: 700, textAlign: "right", color: "#dc2626", outline: "none" }}
                        onFocus={e => e.target.style.borderColor = "#7c3aed"} onBlur={e => e.target.style.borderColor = "#e5e7eb"}
                      /><span style={{ fontSize: 14, fontWeight: 600, color: "#888" }}>%</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 18 }}>📊</span>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1a1a2e", margin: 0 }}>Ajustements par tranche</h3>
            </div>
            <p style={{ fontSize: 12, color: "#999", marginBottom: 14 }}>Pourcentage selon le montant.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {TIERS.map(t => (
                <div key={t.key} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", padding: 12,
                  background: t.isRef ? "#f0fdf4" : "#f9fafb", borderRadius: 10,
                  border: t.isRef ? "1px solid #bbf7d0" : "1px solid #f0f0f0",
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a2e" }}>{t.shortLabel}</div>
                    <div style={{ fontSize: 11, color: "#aaa" }}>{t.label}</div>
                  </div>
                  {t.isRef ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#16a34a" }}>0 %</span>
                      <span style={{ fontSize: 10, background: "#dcfce7", color: "#16a34a", padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>REF</span>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <input type="text" value={tiers[t.key]}
                        onChange={e => setTiers({ ...tiers, [t.key]: parseFloat(e.target.value) || 0 })}
                        style={{ width: 60, padding: "8px 10px", borderRadius: 8, border: "2px solid #e5e7eb", fontSize: 14, fontWeight: 700, textAlign: "right", color: "#dc2626", outline: "none" }}
                        onFocus={e => e.target.style.borderColor = "#7c3aed"} onBlur={e => e.target.style.borderColor = "#e5e7eb"}
                      /><span style={{ fontSize: 14, fontWeight: 600, color: "#888" }}>%</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button onClick={handleApply} style={{
            width: "100%", padding: 16, borderRadius: 14, border: "none",
            background: showSuccess ? "linear-gradient(135deg, #10b981, #059669)" : "linear-gradient(135deg, #f59e0b, #d97706)",
            color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 15px rgba(245,158,11,0.3)",
          }}>{showSuccess ? "✓ Sauvegardé !" : "Sauvegarder la configuration"}</button>
        </>)}

        {/* ========== SIMULATEUR ========== */}
        {activeTab === "simulator" && (<>
          <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1a1a2e", margin: "0 0 4px" }}>Simulateur de taux</h3>
            <p style={{ fontSize: 12, color: "#999", marginBottom: 16 }}>Testez n'importe quelle combinaison.</p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#555", display: "block", marginBottom: 6 }}>Montant (XAF)</label>
              <input type="text" value={simulator.amount} onChange={e => setSimulator({ ...simulator, amount: e.target.value })}
                style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: "2px solid #e5e7eb", fontSize: 18, fontWeight: 700, color: "#1a1a2e", outline: "none", boxSizing: "border-box" }}
                onFocus={e => e.target.style.borderColor = "#7c3aed"} onBlur={e => e.target.style.borderColor = "#e5e7eb"}
              />
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                {["50000", "250000", "500000", "1000000", "2000000"].map(v => (
                  <button key={v} onClick={() => setSimulator({ ...simulator, amount: v })} style={{
                    flex: 1, padding: "8px 4px", borderRadius: 8,
                    border: simulator.amount === v ? "2px solid #7c3aed" : "1px solid #e5e7eb",
                    background: simulator.amount === v ? "#f3e8ff" : "#fff",
                    color: simulator.amount === v ? "#7c3aed" : "#888", fontSize: 11, fontWeight: 600, cursor: "pointer",
                  }}>{parseInt(v) >= 1000000 ? `${parseInt(v)/1000000}M` : `${parseInt(v)/1000}K`}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#555", display: "block", marginBottom: 6 }}>Mode de paiement</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {PAYMENT_METHODS.map(pm => (
                  <button key={pm.key} onClick={() => setSimulator({ ...simulator, method: pm.key })} style={{
                    padding: 12, borderRadius: 10,
                    border: simulator.method === pm.key ? `2px solid ${pm.color}` : "2px solid #e5e7eb",
                    background: simulator.method === pm.key ? `${pm.color}10` : "#fff",
                    display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
                  }}>
                    <span style={{ fontSize: 18 }}>{pm.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e" }}>{pm.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#555", display: "block", marginBottom: 6 }}>Pays du client</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                {COUNTRIES.map(c => (
                  <button key={c.key} onClick={() => setSimulator({ ...simulator, country: c.key })} style={{
                    padding: "10px 6px", borderRadius: 10,
                    border: simulator.country === c.key ? "2px solid #7c3aed" : "2px solid #e5e7eb",
                    background: simulator.country === c.key ? "#f3e8ff" : "#fff",
                    cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  }}>
                    <span style={{ fontSize: 20 }}>{c.flag}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: simulator.country === c.key ? "#7c3aed" : "#888" }}>{c.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* RESULT - with XAF amount included */}
          <div style={{ background: "linear-gradient(135deg, #1a1a2e, #2d1b69)", borderRadius: 16, padding: 20, color: "#fff" }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Résultat de la simulation</div>

            {/* XAF sent */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 14px", background: "rgba(255,255,255,0.08)", borderRadius: 10, marginBottom: 8,
            }}>
              <div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 0.5 }}>Vous envoyez</div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{simAmount.toLocaleString("fr-FR")}</div>
              </div>
              <div style={{
                background: "rgba(255,255,255,0.12)", padding: "6px 14px", borderRadius: 8,
                fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.7)",
              }}>XAF</div>
            </div>

            {/* Arrow */}
            <div style={{ textAlign: "center", margin: "4px 0", fontSize: 18, opacity: 0.4 }}>↓</div>

            {/* CNY received */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 14px", background: "rgba(124,58,237,0.2)", borderRadius: 10,
              border: "1px solid rgba(124,58,237,0.3)", marginBottom: 16,
            }}>
              <div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 0.5 }}>Client reçoit</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#a78bfa" }}>{simResult.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}</div>
              </div>
              <div style={{
                background: "rgba(167,139,250,0.2)", padding: "6px 14px", borderRadius: 8,
                fontSize: 14, fontWeight: 700, color: "#a78bfa",
              }}>CNY</div>
            </div>

            {/* Breakdown */}
            <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Détail du calcul</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ opacity: 0.6 }}>Taux base ({PAYMENT_METHODS.find(p => p.key === simulator.method)?.label})</span>
                <span style={{ fontWeight: 600 }}>{parseFloat(rates[simulator.method]).toLocaleString("fr-FR")} CNY</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ opacity: 0.6 }}>Ajust. pays ({COUNTRIES.find(c => c.key === simulator.country)?.label})</span>
                <span style={{ fontWeight: 600, color: countries[simulator.country] < 0 ? "#f87171" : "#4ade80" }}>{countries[simulator.country]}%</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ opacity: 0.6 }}>Ajust. tranche ({TIERS.find(t => t.key === simTierKey)?.shortLabel})</span>
                <span style={{ fontWeight: 600, color: tiers[simTierKey] < 0 ? "#f87171" : "#4ade80" }}>{tiers[simTierKey]}%</span>
              </div>
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: 8, display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span style={{ fontWeight: 600 }}>Taux final appliqué</span>
                <span style={{ fontWeight: 800, color: "#a78bfa" }}>{simFinalRate.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} CNY</span>
              </div>
            </div>

            <div style={{ marginTop: 12, fontSize: 10, opacity: 0.3, textAlign: "center" }}>
              {simAmount.toLocaleString("fr-FR")} XAF × ({simFinalRate.toLocaleString("fr-FR", {maximumFractionDigits:2})} / 1 000 000) = {simResult.toLocaleString("fr-FR", {maximumFractionDigits:2})} CNY
            </div>
          </div>
        </>)}
      </div>

      {/* Bottom nav */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "#fff", borderTop: "1px solid #eee", display: "flex", justifyContent: "space-around", padding: "10px 0 20px" }}>
        {[{ icon: "🏠", label: "Accueil" }, { icon: "📥", label: "Dépôts" }, { icon: "📤", label: "Paiements" }, { icon: "👥", label: "Clients" }, { icon: "•••", label: "Plus", active: true }].map((item, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer" }}>
            <span style={{ fontSize: 18 }}>{item.icon}</span>
            <span style={{ fontSize: 10, fontWeight: item.active ? 700 : 400, color: item.active ? "#7c3aed" : "#999" }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

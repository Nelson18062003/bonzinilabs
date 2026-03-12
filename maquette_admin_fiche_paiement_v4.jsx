import { useState, useRef } from "react";

// ============================================================
// BONZINI ADMIN — FICHE PAIEMENT V4
// Ultra simplifié · Cash = signature (pas de preuve photo)
// ============================================================

const V = "#A947FE", G = "#F3A745", O = "#FE560D", GR = "#34d399";
const AL = "#1677ff", WC = "#07c160", RED = "#ef4444";

const t = { bg: "#f8f6fa", card: "#fff", text: "#1a1028", sub: "#7a7290", dim: "#c4bdd0", border: "#ebe6f0" };

function fmt(n) { return Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " "); }

const STATUS = {
  waiting_beneficiary_info: { label: "En attente d'infos", color: G },
  ready_for_payment: { label: "Prêt", color: "#3b82f6" },
  processing: { label: "En cours", color: V },
  completed: { label: "Terminé", color: GR },
  rejected: { label: "Refusé", color: RED },
  cash_pending: { label: "En attente scan", color: G },
  cash_scanned: { label: "Scanné", color: V },
};

const MODES = {
  alipay: { name: "Alipay", icon: "支", color: AL },
  wechat: { name: "WeChat", icon: "微", color: WC },
  bank_transfer: { name: "Virement", icon: "B", color: V },
  cash: { name: "Cash", icon: "¥", color: O },
};

const inp = {
  width: "100%", padding: "13px 14px", borderRadius: 10,
  border: `1.5px solid ${t.border}`, background: t.bg,
  fontSize: 15, fontWeight: 600, color: t.text,
  fontFamily: "'DM Sans',sans-serif", outline: "none", boxSizing: "border-box",
};

// ─── Signature Pad simple ───
function SignaturePad({ onDone }) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  function getPos(e) {
    const r = canvasRef.current.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    return { x: touch.clientX - r.left, y: touch.clientY - r.top };
  }

  function start(e) {
    e.preventDefault();
    setDrawing(true);
    setHasDrawn(true);
    const ctx = canvasRef.current.getContext("2d");
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function move(e) {
    if (!drawing) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const p = getPos(e);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = t.text;
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function stop() { setDrawing(false); }

  function clear() {
    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setHasDrawn(false);
  }

  return (
    <div>
      <canvas
        ref={canvasRef} width={380} height={120}
        style={{ width: "100%", height: 120, borderRadius: 10, border: `2px dashed ${t.border}`, background: "#fff", cursor: "crosshair", touchAction: "none" }}
        onMouseDown={start} onMouseMove={move} onMouseUp={stop} onMouseLeave={stop}
        onTouchStart={start} onTouchMove={move} onTouchEnd={stop}
      />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        <button onClick={clear} style={{ padding: "4px 10px", borderRadius: 5, background: "none", border: `1px solid ${t.border}`, fontSize: 10, fontWeight: 600, color: t.sub, cursor: "pointer" }}>Effacer</button>
        {hasDrawn && <button onClick={onDone} style={{ padding: "5px 14px", borderRadius: 6, background: V, border: "none", fontSize: 11, fontWeight: 700, color: "#fff", cursor: "pointer" }}>Confirmer la signature</button>}
      </div>
    </div>
  );
}

export default function App() {
  const [st, setSt] = useState("ready_for_payment");
  const [md, setMd] = useState("alipay");
  const [showQR, setShowQR] = useState(false);
  const [editBenef, setEditBenef] = useState(false);
  const [signed, setSigned] = useState(false);
  const [signing, setSigning] = useState(false);
  const [proofs, setProofs] = useState(["processing", "completed"].includes(st) ? [
    { id: 1, name: "capture_alipay.jpg", size: "312 Ko", date: "09 mars, 14:01" },
  ] : []);

  const s = STATUS[st];
  const m = MODES[md];
  const isLocked = ["completed", "rejected"].includes(st);
  const isCash = md === "cash";
  const hasBenef = st !== "waiting_beneficiary_info";
  const canEdit = !isLocked && !["cash_pending", "cash_scanned"].includes(st);

  const mainAction =
    st === "ready_for_payment" ? { label: "Passer en cours", color: V } :
    st === "processing" ? { label: "Valider le paiement", color: GR } :
    null;

  return (
    <div style={{
      height: "100dvh", display: "flex", flexDirection: "column",
      overflow: "hidden", background: t.bg, maxWidth: 480, margin: "0 auto",
      fontFamily: "'DM Sans',sans-serif", color: t.text,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

      {/* HEADER */}
      <div style={{ flexShrink: 0, background: t.card, borderBottom: `1px solid ${t.border}`, padding: "10px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18, color: t.sub, cursor: "pointer", fontWeight: 300 }}>‹</span>
            <span style={{ fontSize: 14, fontWeight: 800 }}>BZ-PY-2026-0026</span>
          </div>
          <button style={{ padding: "5px 12px", borderRadius: 7, background: V, border: "none", fontSize: 11, fontWeight: 700, color: "#fff", cursor: "pointer" }}>Reçu</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "0 20px 20px" }}>

        {/* DEMO */}
        <div style={{ margin: "8px 0", padding: "6px 8px", borderRadius: 6, background: "#fff8e1", border: "1px solid #ffe082", fontSize: 8 }}>
          <div style={{ fontWeight: 800, marginBottom: 3, color: "#795548" }}>DEMO :</div>
          <div style={{ display: "flex", gap: 2, flexWrap: "wrap", marginBottom: 3 }}>
            {Object.entries(STATUS).map(([k, v]) => (
              <button key={k} onClick={() => { setSt(k); setSigned(false); setSigning(false); setProofs(["processing","completed"].includes(k) ? [{ id: 1, name: "capture_alipay.jpg", size: "312 Ko", date: "09 mars, 14:01" }] : []); }} style={{ padding: "2px 5px", borderRadius: 3, border: "none", cursor: "pointer", background: st === k ? v.color : "#eee", color: st === k ? "#fff" : "#888", fontSize: 7, fontWeight: 700 }}>{v.label}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 2 }}>
            {Object.entries(MODES).map(([k, v]) => (
              <button key={k} onClick={() => { setMd(k); if (k === "cash" && !["cash_pending","cash_scanned","completed","rejected"].includes(st)) setSt("cash_pending"); if (k !== "cash" && ["cash_pending","cash_scanned"].includes(st)) setSt("ready_for_payment"); setSigned(false); setSigning(false); setProofs([]); }} style={{ padding: "2px 5px", borderRadius: 3, border: "none", cursor: "pointer", background: md === k ? v.color : "#eee", color: md === k ? "#fff" : "#888", fontSize: 7, fontWeight: 700 }}>{v.name}</button>
            ))}
          </div>
        </div>

        {/* ── STATUT ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0" }}>
          <span style={{ padding: "4px 10px", borderRadius: 6, background: `${s.color}10`, fontSize: 12, fontWeight: 800, color: s.color }}>{s.label}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 20, height: 20, borderRadius: 5, background: `${m.color}10`, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: m.color }}>{m.icon}</span>
            <span style={{ fontSize: 12, fontWeight: 700 }}>{m.name}</span>
          </div>
        </div>

        {/* ── MONTANT (la seule grosse zone) ── */}
        <div style={{
          padding: "20px 16px", borderRadius: 14,
          background: t.card, border: `1px solid ${t.border}`,
          textAlign: "center", marginBottom: 8,
        }}>
          <div style={{ fontSize: 38, fontWeight: 900, letterSpacing: "-1.5px", lineHeight: 1 }}>¥{fmt(5765)}</div>
          <div style={{ fontSize: 14, color: t.sub, marginTop: 6 }}>{fmt(500000)} XAF</div>
          <div style={{ height: 1, background: t.border, margin: "12px 40px" }} />
          <div style={{ display: "flex", justifyContent: "space-around", fontSize: 11 }}>
            <div><span style={{ color: t.dim }}>Taux </span><span style={{ fontWeight: 700 }}>1M XAF = ¥{fmt(11530)}</span></div>
            <div><span style={{ color: t.dim }}>Client </span><span style={{ fontWeight: 700 }}>Liliane Kenfack</span></div>
          </div>
        </div>

        {/* ── BÉNÉFICIAIRE ── */}
        <div style={{
          padding: "12px 14px", borderRadius: 12,
          background: t.card, border: `1px solid ${t.border}`, marginBottom: 8,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 800 }}>Bénéficiaire</span>
            {hasBenef && canEdit && !editBenef && (
              <button onClick={() => setEditBenef(true)} style={{ fontSize: 10, fontWeight: 600, color: V, background: "none", border: "none", cursor: "pointer" }}>Modifier</button>
            )}
          </div>

          {/* Pas d'infos */}
          {!hasBenef && !editBenef && (
            <div>
              <div style={{ padding: "14px", borderRadius: 8, textAlign: "center", border: `2px dashed ${G}25`, background: `${G}03`, marginBottom: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Infos manquantes</div>
                <div style={{ fontSize: 11, color: t.sub, marginTop: 2 }}>Ajoutez les infos pour traiter ce paiement</div>
              </div>
              <button onClick={() => setEditBenef(true)} style={{ width: "100%", padding: "10px", borderRadius: 8, background: V, border: "none", fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer" }}>Ajouter</button>
            </div>
          )}

          {/* Infos remplies */}
          {hasBenef && !editBenef && (
            <div>
              {isCash ? (
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>Liliane Kenfack</div>
                  <div style={{ fontSize: 11, color: t.sub, marginTop: 1 }}>Le client · +237 676 337 404</div>
                </div>
              ) : md === "bank_transfer" ? (
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>Mr Soap</div>
                  <div style={{ fontSize: 11, color: t.sub, marginTop: 1 }}>Bank of China · 6214 •••• 5678</div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>Mr Soap</div>
                  <div style={{ fontSize: 11, color: t.sub, marginTop: 1 }}>Mr.soap(**排)</div>

                  {/* QR Alipay/WeChat */}
                  <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                    <button onClick={() => setShowQR(!showQR)} style={{ padding: "4px 10px", borderRadius: 5, background: `${m.color}06`, border: `1px solid ${m.color}10`, fontSize: 10, fontWeight: 700, color: m.color, cursor: "pointer" }}>{showQR ? "Masquer QR" : "Voir QR"}</button>
                    {canEdit && <button style={{ padding: "4px 8px", borderRadius: 5, background: "none", border: `1px solid ${t.border}`, fontSize: 10, fontWeight: 600, color: t.sub, cursor: "pointer" }}>Changer QR</button>}
                    {canEdit && <button style={{ padding: "4px 8px", borderRadius: 5, background: "none", border: `1px solid ${RED}12`, fontSize: 10, fontWeight: 600, color: RED, cursor: "pointer" }}>Retirer QR</button>}
                  </div>

                  {showQR && (
                    <div style={{ marginTop: 6, padding: 10, borderRadius: 8, background: t.bg, border: `1px solid ${t.border}`, textAlign: "center" }}>
                      <div style={{ width: 120, height: 120, margin: "0 auto", borderRadius: 6, background: "#fff", border: "1px solid #ddd", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: m.color }}>{m.icon}</span>
                      </div>
                      <div style={{ display: "flex", gap: 4, justifyContent: "center", marginTop: 6 }}>
                        <button style={{ padding: "3px 8px", borderRadius: 4, background: "none", border: `1px solid ${t.border}`, fontSize: 9, fontWeight: 600, color: t.sub, cursor: "pointer" }}>Agrandir</button>
                        <button style={{ padding: "3px 8px", borderRadius: 4, background: "none", border: `1px solid ${t.border}`, fontSize: 9, fontWeight: 600, color: t.sub, cursor: "pointer" }}>Télécharger</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Mode édition */}
          {editBenef && (
            <div>
              {(md === "alipay" || md === "wechat") && (<>
                <div style={{ marginBottom: 8 }}><label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 3 }}>Nom</label><input style={inp} defaultValue={hasBenef ? "Mr Soap" : ""} placeholder="Ex: Zhang Wei" /></div>
                <div style={{ marginBottom: 8 }}><label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 3 }}>QR Code</label>
                  <button style={{ width: "100%", padding: "12px", borderRadius: 8, border: `2px dashed ${t.border}`, background: t.bg, cursor: "pointer", textAlign: "center", fontSize: 12, fontWeight: 700 }}>+ Ajouter le QR code</button>
                </div>
                <div style={{ marginBottom: 8 }}><label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 3 }}>ID {m.name} <span style={{ fontWeight: 400, color: t.dim }}>optionnel</span></label><input style={inp} defaultValue={hasBenef ? "Mr.soap(**排)" : ""} /></div>
              </>)}
              {md === "bank_transfer" && (<>
                <div style={{ marginBottom: 8 }}><label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 3 }}>Titulaire</label><input style={inp} defaultValue={hasBenef ? "Mr Soap" : ""} placeholder="Nom complet" /></div>
                <div style={{ marginBottom: 8 }}><label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 3 }}>Banque</label><input style={inp} defaultValue={hasBenef ? "Bank of China" : ""} /></div>
                <div style={{ marginBottom: 8 }}><label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 3 }}>Compte</label><input style={inp} defaultValue={hasBenef ? "6214 8888 1234 5678" : ""} /></div>
              </>)}
              {isCash && (<>
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  <button style={{ flex: 1, padding: "10px", borderRadius: 8, background: `${V}06`, border: `1.5px solid ${V}`, fontSize: 12, fontWeight: 700, color: V, cursor: "pointer" }}>Le client</button>
                  <button style={{ flex: 1, padding: "10px", borderRadius: 8, background: t.card, border: `1.5px solid ${t.border}`, fontSize: 12, fontWeight: 700, color: t.sub, cursor: "pointer" }}>Autre</button>
                </div>
              </>)}
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setEditBenef(false)} style={{ flex: 1, padding: "10px", borderRadius: 8, background: "none", border: `1px solid ${t.border}`, fontSize: 12, fontWeight: 700, color: t.sub, cursor: "pointer" }}>Annuler</button>
                <button onClick={() => setEditBenef(false)} style={{ flex: 1, padding: "10px", borderRadius: 8, background: V, border: "none", fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer" }}>OK</button>
              </div>
            </div>
          )}
        </div>

        {/* ── PREUVE / SIGNATURE (adaptatif au mode) ── */}
        {isCash ? (
          /* CASH → Signature */
          <div style={{
            padding: "12px 14px", borderRadius: 12,
            background: t.card, border: `1px solid ${t.border}`, marginBottom: 8,
          }}>
            <span style={{ fontSize: 12, fontWeight: 800, display: "block", marginBottom: 8 }}>Signature</span>

            {st === "completed" || signed ? (
              /* Signature faite */
              <div>
                <div style={{ width: "100%", height: 80, borderRadius: 8, background: "#fff", border: "1px solid #eee", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontFamily: "cursive", fontSize: 24, color: t.text, opacity: 0.6 }}>Liliane K.</span>
                </div>
                <div style={{ fontSize: 10, color: t.dim, marginTop: 4 }}>Signé le 09 mars 2026 à 14:02</div>
              </div>
            ) : signing ? (
              /* Zone de signature active */
              <SignaturePad onDone={() => { setSigned(true); setSigning(false); }} />
            ) : (
              /* Pas encore signé */
              <div>
                <div style={{ padding: "16px", borderRadius: 8, textAlign: "center", border: `2px dashed ${t.border}`, background: t.bg, marginBottom: 6 }}>
                  <div style={{ fontSize: 12, color: t.sub }}>Le bénéficiaire doit signer avant la remise des fonds</div>
                </div>
                {!isLocked && (
                  <button onClick={() => setSigning(true)} style={{ width: "100%", padding: "10px", borderRadius: 8, background: O, border: "none", fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer" }}>Faire signer</button>
                )}
              </div>
            )}
          </div>
        ) : (
          /* ALIPAY/WECHAT/VIREMENT → Preuves multiples */
          <div style={{
            padding: "12px 14px", borderRadius: 12,
            background: t.card, border: `1px solid ${t.border}`, marginBottom: 8,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 800 }}>Preuves ({proofs.length})</span>
              {!isLocked && (
                <button onClick={() => setProofs([...proofs, { id: Date.now(), name: `preuve_${proofs.length + 1}.jpg`, size: "180 Ko", date: "09 mars, 14:05" }])} style={{ fontSize: 10, fontWeight: 700, color: V, background: "none", border: "none", cursor: "pointer" }}>+ Ajouter</button>
              )}
            </div>

            {proofs.length === 0 ? (
              <div>
                <div style={{ padding: "14px", borderRadius: 8, textAlign: "center", border: `2px dashed ${t.border}`, background: t.bg }}>
                  <div style={{ fontSize: 12, color: t.sub }}>Aucune preuve ajoutée</div>
                </div>
                {!isLocked && (
                  <button onClick={() => setProofs([{ id: 1, name: "capture_alipay.jpg", size: "312 Ko", date: "09 mars, 14:01" }])} style={{ width: "100%", padding: "10px", borderRadius: 8, background: "none", border: `1px solid ${V}20`, fontSize: 12, fontWeight: 700, color: V, cursor: "pointer", marginTop: 6 }}>+ Ajouter une preuve</button>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {proofs.map((p, idx) => (
                  <div key={p.id} style={{
                    borderRadius: 8, border: `1px solid ${t.border}`, overflow: "hidden",
                  }}>
                    {/* Preview */}
                    <div style={{
                      width: "100%", aspectRatio: idx === 0 ? "16/9" : "16/7",
                      background: `linear-gradient(135deg, ${idx === 0 ? "#e8eef6" : "#eef0f8"}, #f0ecf8)`,
                      position: "relative",
                    }}>
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ width: "55%", background: "rgba(255,255,255,0.8)", borderRadius: 6, padding: "6px 8px" }}>
                          <div style={{ fontSize: 7, fontWeight: 700, color: m.color, textTransform: "uppercase" }}>{m.name}</div>
                          <div style={{ fontSize: 12, fontWeight: 900, marginTop: 1 }}>-¥{fmt(5765)}</div>
                        </div>
                      </div>
                      <div style={{ position: "absolute", top: 4, left: 4, padding: "2px 5px", borderRadius: 3, background: "rgba(255,255,255,0.85)", fontSize: 8, fontWeight: 700, color: t.sub }}>
                        {p.name} · {p.size}
                      </div>
                    </div>

                    {/* Actions sous le preview */}
                    <div style={{ display: "flex", gap: 4, padding: "6px 8px", background: t.bg }}>
                      <button style={{ padding: "3px 6px", borderRadius: 4, background: "none", border: `1px solid ${t.border}`, fontSize: 9, fontWeight: 600, color: t.sub, cursor: "pointer" }}>Agrandir</button>
                      <button style={{ padding: "3px 6px", borderRadius: 4, background: "none", border: `1px solid ${t.border}`, fontSize: 9, fontWeight: 600, color: t.sub, cursor: "pointer" }}>Télécharger</button>
                      {!isLocked && <>
                        <span style={{ flex: 1 }} />
                        <button onClick={() => setProofs(proofs.filter(x => x.id !== p.id))} style={{ padding: "3px 6px", borderRadius: 4, background: "none", border: `1px solid ${RED}12`, fontSize: 9, fontWeight: 600, color: RED, cursor: "pointer" }}>Supprimer</button>
                      </>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── INFOS (minimal) ── */}
        <div style={{
          padding: "10px 14px", borderRadius: 10,
          background: t.card, border: `1px solid ${t.border}`, marginBottom: 8,
        }}>
          {[
            { l: "Référence", v: "BZ-PY-2026-0026" },
            { l: "Date", v: "09 mars 2026, 13:49" },
            st === "rejected" && { l: "Motif refus", v: "QR code illisible", color: RED },
          ].filter(Boolean).map((r, i, a) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < a.length - 1 ? `1px solid ${t.border}` : "none" }}>
              <span style={{ fontSize: 11, color: t.sub }}>{r.l}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: r.color || t.text }}>{r.v}</span>
            </div>
          ))}
        </div>

        {/* ── ACTIONS ── */}
        {!isLocked && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {mainAction && (
              <button style={{ width: "100%", padding: "13px", borderRadius: 10, background: mainAction.color, border: "none", fontSize: 14, fontWeight: 700, color: "#fff", cursor: "pointer" }}>{mainAction.label}</button>
            )}
            {st !== "completed" && (
              <button style={{ width: "100%", padding: "11px", borderRadius: 10, background: "none", border: `1px solid ${RED}12`, fontSize: 12, fontWeight: 600, color: RED, cursor: "pointer" }}>Refuser</button>
            )}
            <button style={{ width: "100%", padding: "11px", borderRadius: 10, background: "none", border: `1px solid ${t.border}`, fontSize: 11, fontWeight: 600, color: t.dim, cursor: "pointer" }}>Supprimer</button>
          </div>
        )}
      </div>
    </div>
  );
}

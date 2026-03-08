"use client";
import { useState } from "react";

const AMOUNTS: Record<string, number> = {
  "100K": 100000,
  "500K": 500000,
  "1M": 1000000,
  "5M": 5000000,
};

const DISPLAY: Record<string, string> = {
  "100K": "100 000",
  "500K": "500 000",
  "1M": "1 000 000",
  "5M": "5 000 000",
};

export function PaymentSimulator({ alipayRate = 11610 }: { alipayRate?: number }) {
  const [selected, setSelected] = useState("500K");

  const xaf = AMOUNTS[selected];
  const cny = Math.round((xaf * alipayRate) / 1000000);
  const cnyDisplay = cny.toLocaleString("fr-FR");

  return (
    <div className="bg-gradient-to-[160deg] from-brand-surface-light to-brand-surface rounded-[24px] p-7 border border-brand-dim shadow-[0_20px_80px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.04)]">
      {/* Title */}
      <div className="font-body text-[11px] font-bold text-brand-muted uppercase tracking-[2px] mb-4">
        Simulateur de paiement
      </div>

      {/* XAF input */}
      <div className="bg-brand-violet-deep rounded-[14px] p-4 border border-brand-dim mb-2.5">
        <div className="font-body text-[10px] text-brand-muted font-semibold mb-1.5">
          VOUS ENVOYEZ
        </div>
        <div className="flex items-center justify-between">
          <span className="font-display text-[28px] font-extrabold text-white tracking-[-1px]">
            {DISPLAY[selected]}
          </span>
          <span className="font-body text-xs font-bold bg-brand-gold/15 text-brand-gold px-3 py-[5px] rounded-lg">
            XAF
          </span>
        </div>
      </div>

      {/* Arrow */}
      <div className="text-center my-1">
        <div className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-brand-violet text-white text-base shadow-[0_4px_20px_rgba(166,74,247,0.4)]">
          ↓
        </div>
      </div>

      {/* CNY output */}
      <div className="bg-brand-violet-deep rounded-[14px] p-4 border border-brand-dim mt-2.5">
        <div className="font-body text-[10px] text-brand-muted font-semibold mb-1.5">
          FOURNISSEUR REÇOIT
        </div>
        <div className="flex items-center justify-between">
          <span className="font-display text-[28px] font-extrabold text-brand-gold tracking-[-1px]">
            ¥{cnyDisplay}
          </span>
          <span className="font-body text-xs font-bold bg-method-alipay/15 text-method-alipay px-3 py-[5px] rounded-lg">
            支 Alipay
          </span>
        </div>
      </div>

      {/* Rate info */}
      <div className="flex justify-between mt-3.5 font-body text-[11px] text-brand-muted">
        <span>Taux: 1M XAF = ¥{alipayRate.toLocaleString("fr-FR")}</span>
        <span className="text-green-400 font-bold flex items-center gap-1">
          <span className="w-[5px] h-[5px] rounded-full bg-green-400 inline-block" />
          Instantané
        </span>
      </div>

      {/* Quick amounts */}
      <div className="flex gap-1.5 mt-3.5">
        {Object.keys(AMOUNTS).map((q) => (
          <button
            key={q}
            onClick={() => setSelected(q)}
            className={`flex-1 py-2 rounded-lg font-body font-bold text-[11px] border transition-all ${
              selected === q
                ? "bg-brand-violet/20 text-brand-violet-glow border-brand-violet/30"
                : "bg-brand-dim/50 text-brand-muted border-transparent hover:bg-brand-dim/70"
            }`}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

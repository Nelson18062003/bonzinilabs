import { Reveal } from "./Reveal";

const methods = [
  {
    icon: "支",
    name: "Alipay",
    color: "#1677ff",
    tag: "Le plus populaire",
    desc: "QR code ou identifiant. Paiement instantané vers n'importe quel compte Alipay en Chine.",
  },
  {
    icon: "微",
    name: "WeChat Pay",
    color: "#07c160",
    tag: "Rapide",
    desc: "Via l'écosystème WeChat. Idéal pour les fournisseurs qui utilisent WeChat au quotidien.",
  },
  {
    icon: "🏦",
    name: "Virement",
    color: "#a64af7",
    tag: "Gros montants",
    desc: "Directement sur le compte bancaire de votre fournisseur. Pour les commandes importantes.",
  },
  {
    icon: "¥",
    name: "Cash",
    color: "#fe560d",
    tag: "Sur place",
    desc: "Remise en espèces avec signature de réception. Pour les fournisseurs qui préfèrent le cash.",
  },
];

export function Methods() {
  return (
    <section className="py-[100px] px-6 bg-brand-surface">
      <div className="max-w-[1200px] mx-auto">
        <Reveal>
          <div className="text-center mb-14">
            <span className="font-body text-xs font-bold text-brand-gold uppercase tracking-[3px]">
              Modes de paiement
            </span>
            <h2
              className="font-display font-extrabold text-white mt-2.5 tracking-[-2px]"
              style={{ fontSize: "clamp(28px, 4.5vw, 48px)" }}
            >
              Le mode que votre fournisseur préfère
            </h2>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {methods.map((m, i) => (
            <Reveal key={m.name} delay={i * 0.1}>
              <MethodCard method={m} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function MethodCard({
  method,
}: {
  method: (typeof methods)[0];
}) {
  return (
    <div
      className="group p-8 rounded-[20px] bg-brand-violet-deep border border-brand-dim cursor-pointer relative overflow-hidden transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1.5"
      style={
        {
          "--method-color": method.color,
        } as React.CSSProperties
      }
    >
      {/* Glow orb */}
      <div
        className="absolute bottom-[-40px] right-[-40px] w-[120px] h-[120px] rounded-full pointer-events-none transition-opacity group-hover:opacity-20"
        style={{ background: `${method.color}06` }}
      />

      <div className="flex justify-between items-start mb-5">
        <div
          className="w-14 h-14 rounded-[16px] flex items-center justify-center text-[26px] font-bold"
          style={{
            background: `${method.color}12`,
            color: method.color,
          }}
        >
          {method.icon}
        </div>
        <span
          className="font-body text-[10px] font-bold uppercase tracking-[0.5px] px-[10px] py-1 rounded-[20px]"
          style={{
            color: method.color,
            background: `${method.color}12`,
          }}
        >
          {method.tag}
        </span>
      </div>

      <h3 className="font-display font-extrabold text-[22px] text-white tracking-[-0.5px] mb-2">
        {method.name}
      </h3>
      <p className="font-body text-sm text-brand-muted leading-[1.6]">
        {method.desc}
      </p>
    </div>
  );
}

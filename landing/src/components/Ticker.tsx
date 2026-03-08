const items = [
  "Alipay",
  "WeChat Pay",
  "Virement bancaire",
  "Cash RMB",
  "Cameroun",
  "Gabon",
  "Tchad",
  "RCA",
  "Congo",
  "Paiement instantané",
  "Meilleur taux",
  "Sans carte",
];

export function Ticker() {
  const repeated = [...items, ...items, ...items];

  return (
    <div className="overflow-hidden bg-brand-violet py-[14px]">
      <div
        className="flex gap-12 whitespace-nowrap"
        style={{ animation: "ticker 30s linear infinite" }}
      >
        {repeated.map((t, i) => (
          <span
            key={i}
            className="font-display text-sm font-bold text-white tracking-[1px] uppercase flex items-center gap-3 flex-shrink-0"
          >
            <span className="w-[5px] h-[5px] rounded-full bg-brand-gold inline-block" />
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

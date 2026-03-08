import { Reveal } from "./Reveal";
import { Counter } from "./Counter";

const stats = [
  { end: 5, suffix: " pays", label: "Zone CEMAC couverte" },
  { end: 4, suffix: " modes", label: "De paiement acceptés" },
  { end: 5, suffix: " min", prefix: "<", label: "Temps de traitement moyen" },
  { end: 0, suffix: " frais", label: "Cachés. Jamais." },
];

export function Stats() {
  return (
    <section className="py-20 px-6 bg-brand-violet-deep">
      <div className="max-w-[1000px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-10 justify-items-center">
        {stats.map((s, i) => (
          <Reveal key={i} delay={i * 0.1}>
            <div className="text-center">
              <div
                className="font-display font-extrabold tracking-[-3px]"
                style={{ fontSize: "clamp(48px, 8vw, 72px)" }}
              >
                <span
                  style={{
                    background: "linear-gradient(135deg, #f3a745, #fe560d)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  <Counter end={s.end} prefix={s.prefix ?? ""} suffix={s.suffix} />
                </span>
              </div>
              <div className="font-body text-sm text-brand-muted font-medium mt-1">
                {s.label}
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

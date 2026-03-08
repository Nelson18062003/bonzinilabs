"use client";
import { useState, useEffect } from "react";
import { BonziniLogo } from "./BonziniLogo";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        scrolled
          ? "bg-brand-violet-deep/85 backdrop-blur-[20px] saturate-[180%] border-b border-brand-violet/10"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-[1200px] mx-auto h-[72px] flex items-center justify-between px-6">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <BonziniLogo size={28} />
          <span className="font-display font-extrabold text-xl text-white tracking-[-0.5px]">
            Bonzini
          </span>
        </div>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-7">
          {["Fonctionnement", "Tarifs", "FAQ"].map((t) => (
            <a
              key={t}
              href={`#${t.toLowerCase()}`}
              className="font-body text-sm font-medium text-brand-muted hover:text-white transition-colors"
            >
              {t}
            </a>
          ))}
          <button className="font-body font-bold text-[13px] text-white bg-gradient-to-br from-brand-violet to-[#8b3cf0] border-none px-[22px] py-[10px] rounded-full cursor-pointer transition-all hover:shadow-[0_0_30px_rgba(166,74,247,0.5)]">
            Envoyer un paiement
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-white p-2"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Menu"
        >
          {menuOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-brand-surface/95 backdrop-blur-xl border-t border-brand-dim px-6 py-4 flex flex-col gap-4">
          {["Fonctionnement", "Tarifs", "FAQ"].map((t) => (
            <a
              key={t}
              href={`#${t.toLowerCase()}`}
              onClick={() => setMenuOpen(false)}
              className="font-body text-sm font-medium text-brand-muted hover:text-white transition-colors py-2"
            >
              {t}
            </a>
          ))}
          <button className="font-body font-bold text-[13px] text-white bg-gradient-to-br from-brand-violet to-[#8b3cf0] border-none px-6 py-3 rounded-full cursor-pointer w-full">
            Envoyer un paiement
          </button>
        </div>
      )}
    </nav>
  );
}

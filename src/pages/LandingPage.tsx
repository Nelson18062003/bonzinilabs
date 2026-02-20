import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { BonziniLogo } from '@/components/BonziniLogo';
import { cn } from '@/lib/utils';
import {
  Loader2,
  ChevronDown,
  ArrowRight,
  Menu,
  X,
  UserPlus,
  ArrowDownToLine,
  CheckCircle2,
  TrendingUp,
  Zap,
  Shield,
  Activity,
  Headphones,
  Smartphone,
} from 'lucide-react';

// ── Shared animation variants ────────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as number[] },
  },
};

// ── LandingNav ───────────────────────────────────────────────────────────────
function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-[#0a0515]/85 backdrop-blur-xl border-b border-white/10'
          : 'bg-transparent',
      )}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          aria-label="Accueil"
        >
          <BonziniLogo size="sm" showText textPosition="right" className="[&_span]:text-white [&_span]:font-bold" />
        </button>

        {/* Desktop nav */}
        <div className="hidden sm:flex items-center gap-3">
          <Link
            to="/auth"
            className="text-white/80 hover:text-white text-sm font-medium transition-colors px-4 py-2"
          >
            Se connecter
          </Link>
          <Link
            to="/auth"
            className="btn-primary-gradient text-sm px-5 py-2.5 rounded-xl font-semibold"
          >
            Créer un compte
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden text-white/80 hover:text-white p-2 transition-colors"
          onClick={() => setMobileOpen(v => !v)}
          aria-label="Menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className="sm:hidden bg-[#0a0515]/95 backdrop-blur-xl border-b border-white/10 px-4 pb-4 space-y-2"
        >
          <Link
            to="/auth"
            className="block py-3 text-white/80 hover:text-white text-sm font-medium transition-colors"
            onClick={() => setMobileOpen(false)}
          >
            Se connecter
          </Link>
          <Link
            to="/auth"
            className="block btn-primary-gradient text-center py-3 rounded-xl text-sm font-semibold"
            onClick={() => setMobileOpen(false)}
          >
            Créer un compte
          </Link>
        </motion.div>
      )}
    </header>
  );
}

// ── HeroSection ──────────────────────────────────────────────────────────────
function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#0a0515] via-[#0f0a2e] to-[#0a0515]">
      {/* Animated gradient orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full"
          style={{
            background: 'radial-gradient(circle, hsl(258 100% 60% / 0.22) 0%, transparent 70%)',
            top: '-15%',
            left: '-20%',
          }}
          animate={{ x: [0, 40, 0], y: [0, -25, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute w-[700px] h-[700px] rounded-full"
          style={{
            background: 'radial-gradient(circle, hsl(280 100% 55% / 0.18) 0%, transparent 70%)',
            bottom: '-25%',
            right: '-25%',
          }}
          animate={{ x: [0, -30, 0], y: [0, 20, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        />
        <motion.div
          className="absolute w-[350px] h-[350px] rounded-full"
          style={{
            background: 'radial-gradient(circle, hsl(258 100% 80% / 0.07) 0%, transparent 70%)',
            top: '45%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-4 sm:px-6 max-w-4xl mx-auto pt-20">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          {/* Badge */}
          <motion.div variants={itemVariants} className="flex justify-center">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[hsl(258_100%_60%/0.18)] border border-[hsl(258_100%_60%/0.3)] text-[hsl(258_100%_80%)] text-xs font-semibold tracking-wide uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-[hsl(258_100%_60%)] animate-pulse" />
              Transferts vers la Chine
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={itemVariants}
            className="text-4xl sm:text-5xl lg:text-7xl font-extrabold text-white leading-[1.08] tracking-tight"
          >
            Envoyez de l'argent{' '}
            <br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-[hsl(258_100%_80%)] via-white to-[hsl(258_100%_70%)] bg-clip-text text-transparent">
              en Chine.
            </span>{' '}
            Simplement.
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            variants={itemVariants}
            className="text-base sm:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed"
          >
            La solution de référence pour la diaspora africaine.
            Transférez vos fonds vers Alipay, WeChat Pay ou par virement bancaire
            — en toute sécurité, au meilleur taux.
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2"
          >
            <Link
              to="/auth"
              className="w-full sm:w-auto btn-primary-gradient px-8 py-4 rounded-xl text-base font-semibold text-center transition-all duration-300 hover:-translate-y-0.5"
              style={{ boxShadow: '0 8px 32px -8px hsl(258 100% 60% / 0.55)' }}
            >
              Créer un compte gratuit
            </Link>
            <Link
              to="/auth"
              className="w-full sm:w-auto px-8 py-4 rounded-xl text-base font-semibold border border-white/20 text-white hover:bg-white/10 hover:border-white/30 transition-all duration-300 text-center backdrop-blur-sm"
            >
              Se connecter
            </Link>
          </motion.div>

          {/* Trust stats */}
          <motion.div
            variants={itemVariants}
            className="flex flex-wrap items-center justify-center gap-8 sm:gap-14 pt-4"
          >
            {[
              { value: '500+', label: 'Clients actifs' },
              { value: '#1', label: 'Meilleur taux du marché' },
              { value: '24h', label: 'Délai de paiement' },
            ].map(stat => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl sm:text-3xl font-extrabold text-white">{stat.value}</div>
                <div className="text-xs sm:text-sm text-white/45 mt-0.5">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/25"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <ChevronDown className="w-6 h-6" />
      </motion.div>
    </section>
  );
}

// ── TrustBar ─────────────────────────────────────────────────────────────────
function TrustBar() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  const methods = [
    { emoji: '📱', chineseLabel: '支付宝', label: 'Alipay' },
    { emoji: '💬', chineseLabel: '微信支付', label: 'WeChat Pay' },
    { emoji: '🏦', chineseLabel: '银行转账', label: 'Virement' },
  ];

  return (
    <section className="bg-[#0a0515] border-y border-white/5 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <motion.div
          ref={ref}
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12"
        >
          <p className="text-white/35 text-xs uppercase tracking-widest font-semibold whitespace-nowrap">
            Modes de paiement acceptés
          </p>
          <div className="flex items-center gap-8 sm:gap-12">
            {methods.map(m => (
              <div key={m.label} className="flex flex-col items-center gap-1.5">
                <span className="text-2xl">{m.emoji}</span>
                <span className="text-white/40 text-xs font-medium">{m.label}</span>
                <span className="text-white/20 text-[10px]">{m.chineseLabel}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ── HowItWorksSection ────────────────────────────────────────────────────────
function HowItWorksSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  const steps = [
    {
      icon: UserPlus,
      title: 'Créez votre compte',
      description:
        'Inscription gratuite en 2 minutes. Renseignez vos informations personnelles. Commencez immédiatement.',
    },
    {
      icon: ArrowDownToLine,
      title: 'Déposez vos fonds',
      description:
        'Effectuez un dépôt en XAF depuis votre Mobile Money ou compte bancaire. Votre solde Bonzini est crédité rapidement.',
    },
    {
      icon: CheckCircle2,
      title: 'Votre destinataire reçoit',
      description:
        'Vos fonds arrivent sur le compte Alipay, WeChat Pay ou bancaire de votre fournisseur en Chine sous 24h.',
    },
  ];

  return (
    <section className="bg-gradient-to-b from-[#0a0515] to-[#080312] py-24 px-4">
      <div className="max-w-5xl mx-auto">
        <motion.div
          ref={ref}
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
        >
          {/* Section header */}
          <motion.div variants={itemVariants} className="text-center mb-16">
            <p className="text-[hsl(258_100%_70%)] text-xs font-semibold uppercase tracking-widest mb-3">
              Processus simple
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 tracking-tight">
              Comment ça marche ?
            </h2>
            <p className="text-white/50 text-base sm:text-lg max-w-xl mx-auto">
              Trois étapes, et votre argent arrive à destination.
            </p>
          </motion.div>

          {/* Steps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6 relative">
            {/* Connecting line — desktop only */}
            <div className="hidden md:block absolute top-11 left-[calc(16.67%+28px)] right-[calc(16.67%+28px)] h-px bg-gradient-to-r from-[hsl(258_100%_60%/0.3)] via-[hsl(258_100%_60%/0.6)] to-[hsl(258_100%_60%/0.3)]" />

            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                variants={itemVariants}
                className="relative flex flex-col items-center text-center px-4"
              >
                {/* Icon circle */}
                <div className="relative mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-[hsl(258_100%_60%/0.15)] border border-[hsl(258_100%_60%/0.25)] flex items-center justify-center backdrop-blur-sm">
                    <step.icon className="w-6 h-6 text-[hsl(258_100%_70%)]" />
                  </div>
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[hsl(258_100%_60%)] text-white text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                </div>

                <h3 className="text-white font-bold text-lg sm:text-xl mb-3">{step.title}</h3>
                <p className="text-white/45 text-sm leading-relaxed">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ── PaymentMethodsSection ────────────────────────────────────────────────────
function PaymentMethodsSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  const methods = [
    {
      emoji: '📱',
      chineseLabel: '支付宝',
      title: 'Alipay',
      description:
        'Le portefeuille numérique le plus utilisé en Chine. Idéal pour les paiements instantanés à vos fournisseurs et partenaires.',
      badge: 'Instantané',
      badgeClass: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    },
    {
      emoji: '💬',
      chineseLabel: '微信支付',
      title: 'WeChat Pay',
      description:
        'Intégré à l\'application WeChat, incontournable pour les commerçants chinois. Transfert direct vers leur compte.',
      badge: 'Populaire',
      badgeClass: 'text-green-400 bg-green-400/10 border-green-400/20',
    },
    {
      emoji: '🏦',
      chineseLabel: '银行转账',
      title: 'Virement bancaire',
      description:
        'Pour les montants importants ou les entreprises sans portefeuille numérique. Sécurisé et fiable, idéal pour les grandes transactions.',
      badge: 'Grandes sommes',
      badgeClass: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
    },
  ];

  return (
    <section className="bg-[#080312] py-24 px-4">
      <div className="max-w-5xl mx-auto">
        <motion.div
          ref={ref}
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
        >
          {/* Section header */}
          <motion.div variants={itemVariants} className="text-center mb-14">
            <p className="text-[hsl(258_100%_70%)] text-xs font-semibold uppercase tracking-widest mb-3">
              Modes de paiement
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 tracking-tight">
              Trois façons d'envoyer
            </h2>
            <p className="text-white/50 text-base max-w-xl mx-auto">
              Choisissez le mode qui convient le mieux à votre destinataire en Chine.
            </p>
          </motion.div>

          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {methods.map(m => (
              <motion.div
                key={m.title}
                variants={itemVariants}
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                className="relative p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-[hsl(258_100%_60%/0.35)] hover:bg-white/[0.07] transition-colors duration-300"
              >
                {/* Header */}
                <div className="flex items-center gap-4 mb-5">
                  <span className="text-4xl">{m.emoji}</span>
                  <div>
                    <p className="text-white/25 text-xs font-medium">{m.chineseLabel}</p>
                    <h3 className="text-white font-bold text-xl leading-tight">{m.title}</h3>
                  </div>
                </div>

                <p className="text-white/45 text-sm leading-relaxed mb-5">{m.description}</p>

                <span
                  className={cn(
                    'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border',
                    m.badgeClass,
                  )}
                >
                  {m.badge}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ── WhyBonziniSection ────────────────────────────────────────────────────────
function WhyBonziniSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  const features = [
    {
      icon: TrendingUp,
      title: 'Meilleur taux du marché',
      description:
        'Nous négocions quotidiennement le taux XAF/CNY pour vous garantir la meilleure conversion possible.',
      highlight: true,
    },
    {
      icon: Zap,
      title: 'Rapide',
      description:
        'Vos paiements sont traités en moins de 24 heures. Fini l\'attente de plusieurs jours ouvrables.',
      highlight: false,
    },
    {
      icon: Shield,
      title: 'Sécurisé',
      description:
        'Toutes vos transactions sont vérifiées manuellement par notre équipe. Zéro risque de fraude.',
      highlight: false,
    },
    {
      icon: Activity,
      title: 'Suivi en temps réel',
      description:
        'Recevez des notifications à chaque étape de votre transfert. Vous savez toujours où est votre argent.',
      highlight: false,
    },
    {
      icon: Headphones,
      title: 'Support réactif',
      description:
        'Une équipe disponible pour répondre à toutes vos questions. Nous parlons votre langue.',
      highlight: false,
    },
    {
      icon: Smartphone,
      title: 'Simple & intuitif',
      description:
        'Interface conçue pour être utilisée par tous. Aucune expertise financière requise.',
      highlight: false,
    },
  ];

  return (
    <section className="bg-gradient-to-b from-[#080312] to-[#0a0515] py-24 px-4">
      <div className="max-w-5xl mx-auto">
        <motion.div
          ref={ref}
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
        >
          {/* Section header */}
          <motion.div variants={itemVariants} className="text-center mb-14">
            <p className="text-[hsl(258_100%_70%)] text-xs font-semibold uppercase tracking-widest mb-3">
              Pourquoi nous choisir
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 tracking-tight">
              Pourquoi Bonzini ?
            </h2>
            <p className="text-white/50 text-base max-w-xl mx-auto">
              Nous avons pensé à chaque détail pour vous offrir l'expérience la plus fluide possible.
            </p>
          </motion.div>

          {/* Features grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map(f => (
              <motion.div
                key={f.title}
                variants={itemVariants}
                className={cn(
                  'p-6 rounded-2xl border transition-all duration-300',
                  f.highlight
                    ? 'bg-[hsl(258_100%_60%/0.12)] border-[hsl(258_100%_60%/0.3)] hover:bg-[hsl(258_100%_60%/0.18)]'
                    : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/[0.07]',
                )}
              >
                <div
                  className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center mb-4',
                    f.highlight ? 'bg-[hsl(258_100%_60%/0.25)]' : 'bg-white/10',
                  )}
                >
                  <f.icon
                    className={cn(
                      'w-5 h-5',
                      f.highlight ? 'text-[hsl(258_100%_72%)]' : 'text-white/60',
                    )}
                  />
                </div>
                <h3 className="text-white font-bold text-base mb-2">{f.title}</h3>
                <p className="text-white/45 text-sm leading-relaxed">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ── CtaBannerSection ─────────────────────────────────────────────────────────
function CtaBannerSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <section className="py-24 px-4 bg-[#0a0515]">
      <div className="max-w-4xl mx-auto">
        <motion.div
          ref={ref}
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[hsl(258_100%_60%)] via-[#5a2fd4] to-[#3d1fa3] px-8 py-16 sm:py-20 text-center"
          style={{ boxShadow: '0 24px 80px -16px hsl(258 100% 60% / 0.5)' }}
        >
          {/* Decorative blobs */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl" aria-hidden="true">
            <div className="absolute w-72 h-72 rounded-full bg-white/10 blur-3xl -top-12 -right-12" />
            <div className="absolute w-52 h-52 rounded-full bg-white/5 blur-2xl bottom-0 left-0" />
          </div>

          {/* Content */}
          <div className="relative z-10">
            <motion.p
              variants={itemVariants}
              className="text-white/65 text-xs font-semibold uppercase tracking-widest mb-4"
            >
              Commencez dès aujourd'hui
            </motion.p>

            <motion.h2
              variants={itemVariants}
              className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-5 tracking-tight"
            >
              Prêt à commencer ?
            </motion.h2>

            <motion.p
              variants={itemVariants}
              className="text-white/65 text-base sm:text-lg max-w-xl mx-auto mb-8 leading-relaxed"
            >
              Rejoignez plus de 500 entrepreneurs de la diaspora africaine qui font déjà
              confiance à Bonzini pour leurs transferts vers la Chine.
            </motion.p>

            <motion.div
              variants={itemVariants}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Link
                to="/auth"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white text-[hsl(258_100%_45%)] font-bold px-8 py-4 rounded-xl text-base hover:bg-white/92 transition-all duration-200 hover:-translate-y-0.5 shadow-[0_4px_20px_rgba(0,0,0,0.25)]"
              >
                Créer mon compte gratuitement
                <ArrowRight className="w-5 h-5" />
              </Link>
            </motion.div>

            <motion.p
              variants={itemVariants}
              className="mt-5 text-white/35 text-xs"
            >
              Inscription gratuite — Aucune carte bancaire requise
            </motion.p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ── LandingFooter ────────────────────────────────────────────────────────────
function LandingFooter() {
  return (
    <footer className="bg-[#080312] border-t border-white/5 px-4 py-14">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 mb-10">
          {/* Brand */}
          <div className="space-y-4">
            <BonziniLogo size="sm" showText textPosition="right" className="[&_span]:text-white [&_span]:font-bold" />
            <p className="text-white/35 text-sm leading-relaxed max-w-xs">
              La solution de transfert d'argent vers la Chine pour la diaspora africaine francophone.
            </p>
          </div>

          {/* Quick links */}
          <div>
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-4">
              Accès rapide
            </p>
            <ul className="space-y-2.5">
              {[
                { label: 'Se connecter', to: '/auth' },
                { label: 'Créer un compte', to: '/auth' },
              ].map(link => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    className="text-white/35 hover:text-white/70 text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact + Legal */}
          <div>
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-4">
              Contact
            </p>
            <ul className="space-y-2.5 mb-6">
              <li>
                <a
                  href="mailto:contact@bonzinilabs.com"
                  className="text-white/35 hover:text-white/70 text-sm transition-colors"
                >
                  contact@bonzinilabs.com
                </a>
              </li>
            </ul>
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-4">
              Légal
            </p>
            <ul className="space-y-2.5">
              {['Mentions légales', 'Confidentialité', 'CGU'].map(item => (
                <li key={item}>
                  <a href="#" className="text-white/35 hover:text-white/70 text-sm transition-colors">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-white/20 text-xs">
            © {new Date().getFullYear()} BonziniLabs. Tous droits réservés.
          </p>
          <p className="text-white/20 text-xs">
            Fait avec soin pour la diaspora africaine 🌍
          </p>
        </div>
      </div>
    </footer>
  );
}

// ── LandingPage (default export) ─────────────────────────────────────────────
export default function LandingPage() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  // Redirect authenticated users directly to the wallet
  useEffect(() => {
    if (!isLoading && user) {
      navigate('/wallet', { replace: true });
    }
  }, [user, isLoading, navigate]);

  // Show spinner while checking auth to avoid flash of landing page for logged-in users
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0515]">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(258_100%_60%)]" />
      </div>
    );
  }

  // Avoid rendering landing page while redirect is in progress
  if (user) return null;

  return (
    <div className="min-h-screen bg-[#0a0515] text-white">
      <LandingNav />
      <HeroSection />
      <TrustBar />
      <HowItWorksSection />
      <PaymentMethodsSection />
      <WhyBonziniSection />
      <CtaBannerSection />
      <LandingFooter />
    </div>
  );
}

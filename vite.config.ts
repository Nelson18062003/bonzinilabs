import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      // DEV-ONLY: swap the analytics data hooks for static fixtures so the
      // screenshot harness can render the analytics dashboard. Gated by an
      // env var → never active in production or normal dev.
      ...(process.env.SCREENSHOT_MOCK === "1"
        ? {
            "@/hooks/useTreasury": path.resolve(__dirname, "./src/__screenshot__/mockTreasury.ts"),
            "@/contexts/AdminAuthContext": path.resolve(__dirname, "./src/__screenshot__/mockAdminAuth.ts"),
            "@/hooks/useCargo": path.resolve(__dirname, "./src/__screenshot__/mockCargo.ts"),
            "@/hooks/useAdminDeposits": path.resolve(__dirname, "./src/__screenshot__/mockDeposits.ts"),
            "@/hooks/usePayments": path.resolve(__dirname, "./src/__screenshot__/mockPayments.ts"),
            "@/hooks/useClientManagement": path.resolve(__dirname, "./src/__screenshot__/mockClients.ts"),
            "@/hooks/useBeneficiaries": path.resolve(__dirname, "./src/__screenshot__/mockBeneficiaries.ts"),
          }
        : {}),
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Les drapeaux SVG (flag-icons, 245 fichiers, la plupart < 4 Ko) restent
    // des fichiers séparés chargés à la demande : inlinés en base64, ils
    // gonfleraient le bundle de ~400 Ko pour un sélecteur de pays.
    assetsInlineLimit: (filePath) => (filePath.includes("flag-icons") ? false : undefined),
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        admin: path.resolve(__dirname, "m/index.html"),
        agent: path.resolve(__dirname, "a/index.html"),
      },
      output: {
        manualChunks(id) {
          // PDF et graphiques : PAS de chunk manuel. Forcés dans un chunk nommé,
          // Rollup y rangeait aussi ~1 ko d'aides partagées (tslib, clsx, le
          // préchargeur Vite) et le point d'entrée les tirait au premier
          // rendu : 2,6 Mo (830 ko gzip) pour ouvrir Mola. Laissés au découpage
          // naturel, ils ne partent qu'avec la route qui les importe.
          // Animation (~80KB) — framer-motion
          if (id.includes('framer-motion')) {
            return 'chunk-motion';
          }
          // Radix UI + shadcn base (~150KB) — shared UI primitives
          if (id.includes('@radix-ui/')) {
            return 'chunk-radix';
          }
          // React Query + React ecosystem
          // `react/` seul attrapait aussi lucide-react/, qrcode.react/, @phosphor-icons/react/…
          if (id.includes('@tanstack/react-query') || id.includes('/node_modules/react-dom/') || id.includes('/node_modules/react/') || id.includes('/node_modules/scheduler/')) {
            return 'chunk-react';
          }
          // Supabase client
          if (id.includes('@supabase/')) {
            return 'chunk-supabase';
          }
        },
      },
    },
  },
}));

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
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        admin: path.resolve(__dirname, "m/index.html"),
        agent: path.resolve(__dirname, "a/index.html"),
      },
      output: {
        manualChunks(id) {
          // PDF libs (~2.2MB) — loaded only when user generates a PDF
          if (id.includes('@react-pdf/renderer') || id.includes('jspdf') || id.includes('jspdf-autotable') || id.includes('html2canvas')) {
            return 'chunk-pdf';
          }
          // Charts (~400KB) — only on rates screen
          if (id.includes('recharts') || id.includes('d3-')) {
            return 'chunk-charts';
          }
          // Animation (~80KB) — framer-motion
          if (id.includes('framer-motion')) {
            return 'chunk-motion';
          }
          // Radix UI + shadcn base (~150KB) — shared UI primitives
          if (id.includes('@radix-ui/')) {
            return 'chunk-radix';
          }
          // React Query + React ecosystem
          if (id.includes('@tanstack/react-query') || id.includes('react-dom') || id.includes('react/')) {
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

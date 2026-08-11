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
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const moduleId = id.replace(/\\/g, '/');
          if (!moduleId.includes('/node_modules/')) return undefined;
          if (moduleId.includes('/chart.js/')) return 'chart';
          if (moduleId.includes('/framer-motion/')) return 'motion';
          if (moduleId.includes('/@radix-ui/')) return 'radix';
          if (moduleId.includes('/@supabase/')) return 'supabase';
          if (moduleId.includes('/@tanstack/')) return 'query';
          if (moduleId.includes('/react-router') || moduleId.includes('/@remix-run/')) return 'router';
          if (moduleId.includes('/react/') || moduleId.includes('/react-dom/') || moduleId.includes('/scheduler/')) return 'react';
          if (moduleId.includes('/react-hook-form/') || moduleId.includes('/@hookform/') || moduleId.includes('/zod/')) return 'forms';
          return undefined;
        },
      },
    },
  },
}));

import { defineConfig } from 'vite';

// Second build: the firmware's standalone control page. Bundles the SHARED
// gesture/sensor handlers + WebSocket transport + the ported UIBuilder into one
// self-contained IIFE, which scripts/embed-bundle.mjs then writes into
// Arduino IDE/SmartMouse/smartmouse_bundle.h (served by the ESP at /smartmouse.js).
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false, // keep the cards bundle produced by the primary build
    lib: {
      entry: 'standalone/standalone.ts',
      formats: ['iife'],
      name: 'SmartMouseStandalone',
      fileName: () => 'smartmouse-standalone.js',
    },
    rollupOptions: {
      external: [],
    },
  },
});

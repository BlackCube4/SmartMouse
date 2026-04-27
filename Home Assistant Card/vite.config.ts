import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    lib: {
      // Our single entry point that imports all 4 cards
      entry: 'main.ts',
      formats: ['es'],
      fileName: () => 'smartmouse-cards.js'
    },
    rollupOptions: {
      external: [], // Do not externalize anything, bundle it all for HA
    }
  }
});
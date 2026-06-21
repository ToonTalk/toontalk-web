import { defineConfig } from 'vite';

export default defineConfig({
  // Don't auto-open a browser on `npm run dev` — it popped up a window on every
  // (re)start, covering whatever was on the other monitor. Open localhost:3000
  // yourself once, on the screen you want; reloads/HMR reuse that tab.
  server: { port: 3000, open: false },
  build: { outDir: 'dist', sourcemap: true },
});

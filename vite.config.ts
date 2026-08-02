import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  // A BUILD uses a relative base so `dist/` runs from any directory — opened as
  // `localhost:8000/dist/`, from a GitHub Pages project sub-path, or straight off
  // disk. With the default absolute base the bundle asked for `/assets/index-*.js`
  // at the SERVER root, 404'd, and the page sat black on index.html's "starting…".
  // The dev server keeps the absolute base it needs (relative base isn't supported
  // there), so `npm run dev` is unaffected. Runtime assets go through
  // `assetUrl()` (src/config/asset-url.ts), which reads this via BASE_URL.
  base: command === 'build' ? './' : '/',
  // Don't auto-open a browser on `npm run dev` — it popped up a window on every
  // (re)start, covering whatever was on the other monitor. Open localhost:3000
  // yourself once, on the screen you want; reloads/HMR reuse that tab.
  server: { port: 3000, open: false },
  build: { outDir: 'dist', sourcemap: true },
}));

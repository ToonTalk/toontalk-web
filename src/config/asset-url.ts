/**
 * Resolve a runtime asset path against the app's base URL.
 *
 * Assets used to be fetched with ABSOLUTE paths (`/assets/…`), which only works
 * when the app is served from the web ROOT. Opening a production build from a
 * sub-path — `localhost:8000/dist/`, or a GitHub Pages project site — then asked
 * the server for `/assets/…` at its root, got 404s, and the app hung on a black
 * screen still showing index.html's "starting…" text.
 *
 * `import.meta.env.BASE_URL` is Vite's `base` (see vite.config.ts): `/` for the
 * dev server, `./` for a build — so a built page resolves assets relative to the
 * document and works from any directory.
 */
export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const rel = path.replace(/^\/+/, ''); // '/assets/x.png' → 'assets/x.png'
  return base.endsWith('/') ? base + rel : `${base}/${rel}`;
}

import { defineConfig, loadEnv } from 'vite';
import { brands, DEFAULT_BRAND, loc } from './src/brands/index.js';

// VITE_BRAND   which brand this build ships as (default: solmara)
// VITE_SITE_URL absolute URL of the deployed game, with trailing slash — needed for
//               link previews (og:image must be absolute). Example: https://juego.marca.es/
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env };
  const brand = brands[env.VITE_BRAND] || brands[DEFAULT_BRAND];
  const lang = brand.locale.default;
  const vars = {
    id: brand.id,
    lang,
    brand: brand.brand.name,
    title: `${loc(brand.game.title, lang)} · ${brand.brand.name}`,
    description: loc(brand.game.pitch, lang),
    site: env.VITE_SITE_URL || './',
    ...brand.colors,
  };
  return {
    base: './', // relative paths: works at a domain root, in a sub-folder or inside an iframe
    define: { 'import.meta.env.VITE_BRAND': JSON.stringify(brand.id) },
    plugins: [
      {
        name: 'brand-html',
        transformIndexHtml: {
          order: 'pre', // before Vite minifies the inline CSS
          handler: (html) => html.replace(/\{\{(\w+)\}\}/g, (m, k) => vars[k] ?? m),
        },
      },
    ],
    build: { target: 'es2020', chunkSizeWarningLimit: 900 },
    server: { host: true },
  };
});

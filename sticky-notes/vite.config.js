import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Where the app will be served from. Defaults to the domain root; GitHub
// Pages serves a project site from /<repo>/, so the workflow sets this and
// every URL below is built from it — a manifest whose scope does not match
// the page it is served from will not install on Android.
const base = process.env.APP_BASE ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: `${base}index.html`,
        // Google Fonts are precached on first run so the app keeps its
        // typeface offline — a home-screen app that falls back to Times the
        // moment the signal drops looks broken.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'Sticky Notes',
        short_name: 'Notes',
        description: 'A private sticky notes board that works offline on your phone.',
        theme_color: '#f5f1e8',
        background_color: '#f5f1e8',
        display: 'standalone',
        orientation: 'portrait',
        scope: base,
        start_url: base,
        categories: ['productivity', 'utilities'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icons/icon-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        // Long-pressing the home-screen icon on Android offers these.
        shortcuts: [
          { name: 'New note', short_name: 'New note', url: `${base}?new=note` },
          { name: 'New checklist', short_name: 'Checklist', url: `${base}?new=list` },
        ],
        // Puts the app in Android's share sheet: sharing text from any app
        // opens a pre-filled note. GET keeps it a plain navigation, so no
        // service-worker POST handler is needed.
        share_target: {
          action: base,
          method: 'GET',
          params: { title: 'share_title', text: 'share_text', url: 'share_url' },
        },
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
  },
});

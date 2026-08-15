import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Our own service worker handles notification clicks and FCM, so we let
      // Workbox generate the caching SW and import ours into it.
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        importScripts: ['sw-custom.js'],
        navigateFallback: 'index.html',
        // Firestore/Auth traffic must never be served from cache.
        navigateFallbackDenylist: [/^\/__/, /firebaseapp\.com/, /googleapis\.com/],
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
        name: 'Momentum — Habits, Goals & Rewards',
        short_name: 'Momentum',
        description:
          'Build habits, break bad ones, track goals and earn XP, badges and rewards along the way.',
        theme_color: '#0b0a1f',
        background_color: '#0b0a1f',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        categories: ['productivity', 'lifestyle', 'health'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: "Today's check-in", short_name: 'Check in', url: '/?view=today' },
          { name: 'My goals', short_name: 'Goals', url: '/?view=goals' },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
});

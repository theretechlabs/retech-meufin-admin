import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Em dev, /api/* vai para a meufin-api local (same-origin), como o nginx faz
  // em produção. Assim o cookie de sessão HttpOnly funciona sem CORS nem Domain.
  const apiProxyTarget = env.API_PROXY_TARGET || 'http://localhost:8002'

  return {
    plugins: [
      react(),
      // PWA: manifest + service worker (Workbox). Ícones gerados por `npm run pwa:icons`.
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
        manifest: {
          name: 'MeuFin',
          short_name: 'MeuFin',
          description: 'MeuFin — finanças familiares. The Retech.',
          lang: 'pt-BR',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          theme_color: '#050506',
          background_color: '#050506',
          icons: [
            { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // Só a casca (bundle, fontes, ícones) fica em cache. Nada de /api:
          // o SPA fallback não pode responder index.html a chamada de API.
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
          navigateFallbackDenylist: [/^\/api\//],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'google-fonts',
                expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: apiProxyTarget,
          // Mantém o Host do browser: a verificação CSRF da API compara Origin com Host.
          changeOrigin: false,
        },
      },
    },
  }
})

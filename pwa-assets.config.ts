import { defineConfig } from '@vite-pwa/assets-generator/config'

// Gera os PNGs do PWA a partir de public/pwa-icon.svg: `npm run pwa:icons`.
// O SVG já tem fundo escuro; padding 0 nos ícones normais e no apple-touch
// (iOS arredonda sozinho). Maskable ganha margem para a safe zone do Android.
const BG = '#050506'

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    transparent: { sizes: [64, 192, 512], padding: 0, favicons: [[48, 'favicon.ico']] },
    maskable: { sizes: [512], padding: 0.12, resizeOptions: { background: BG } },
    apple: { sizes: [180], padding: 0, resizeOptions: { background: BG } },
  },
  images: ['public/pwa-icon.svg'],
})

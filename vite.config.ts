import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Publicado em https://eitorbrandao.github.io/cidade-feliz/
export default defineConfig({
  base: '/cidade-feliz/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2}'] },
      manifest: {
        name: 'Cidade Feliz',
        short_name: 'Cidade Feliz',
        description: 'Construa sua cidade, colete aluguéis e faça amizade com os vizinhos.',
        lang: 'pt-BR',
        theme_color: '#5cc0f2',
        background_color: '#8fd3f5',
        display: 'standalone',
        orientation: 'any',
        start_url: '/cidade-feliz/',
        scope: '/cidade-feliz/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
    }),
  ],
})

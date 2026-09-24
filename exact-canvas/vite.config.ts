import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

const host = process.env.TAURI_DEV_HOST

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Tauri expects a fixed port and swallows Rust errors on stderr
  clearScreen: false,
  server: {
    // Harus sama dengan devUrl & CSP di src-tauri/tauri.conf.json (1421/1422)
    // — kalau berbeda, `npm run app` menunggu selamanya di port yang kosong.
    port: 1421,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1422 } : undefined,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    // Dua halaman: aplikasi utama, dan halaman TV yang ringan (tanpa React)
    // untuk browser smart TV yang mesinnya lebih lemah.
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        tv: fileURLToPath(new URL('./tv.html', import.meta.url)),
      },
    },
    target: ['safari15', 'chrome79'],
    minify: process.env.TAURI_ENV_DEBUG ? false : 'esbuild',
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    // Aplikasi ini memuat berkasnya dari disk, bukan dari jaringan — satu
    // bundel besar justru lebih cepat daripada banyak permintaan kecil.
    chunkSizeWarningLimit: 1200,
  },
})

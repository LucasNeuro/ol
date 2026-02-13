import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { copyFileSync, existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Plugin para copiar _redirects, _headers e 404.html após o build (SPA fallback em produção)
const copyRedirectsPlugin = () => {
  return {
    name: 'copy-redirects',
    writeBundle() {
      const distDir = join(__dirname, 'dist')

      // Copiar _redirects (Netlify e outros: /* → /index.html 200)
      const redirectsSource = join(__dirname, 'public', '_redirects')
      const redirectsDest = join(distDir, '_redirects')
      if (existsSync(redirectsSource)) {
        try {
          copyFileSync(redirectsSource, redirectsDest)
          console.log('✅ Arquivo _redirects copiado para dist/')
        } catch (error) {
          console.warn('⚠️ Erro ao copiar _redirects:', error.message)
        }
      }

      // Copiar _headers
      const headersSource = join(__dirname, 'public', '_headers')
      const headersDest = join(distDir, '_headers')
      if (existsSync(headersSource)) {
        try {
          copyFileSync(headersSource, headersDest)
          console.log('✅ Arquivo _headers copiado para dist/')
        } catch (error) {
          console.warn('⚠️ Erro ao copiar _headers:', error.message)
        }
      }

      // 404.html = cópia de index.html (fallback para hosts que servem 404 em rotas inexistentes, ex.: /redefinir-senha)
      const indexPath = join(distDir, 'index.html')
      const fallback404 = join(distDir, '404.html')
      if (existsSync(indexPath)) {
        try {
          copyFileSync(indexPath, fallback404)
          console.log('✅ 404.html criado (SPA fallback para /redefinir-senha etc.)')
        } catch (error) {
          console.warn('⚠️ Erro ao criar 404.html:', error.message)
        }
      }
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), copyRedirectsPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    // Remover console.logs em produção
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: mode === 'production', // Remove console.* em produção
        drop_debugger: mode === 'production', // Remove debugger statements
        pure_funcs: mode === 'production' ? ['console.log', 'console.info', 'console.debug', 'console.warn'] : []
      }
    },
    // Source maps apenas em dev
    sourcemap: mode !== 'production',
  },
  esbuild: {
    // Remove console.logs durante o dev build também (opcional)
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  }
}))



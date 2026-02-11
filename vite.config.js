import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { copyFileSync, existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Plugin para copiar _redirects e _headers após o build (para Render Static Site)
const copyRedirectsPlugin = () => {
  return {
    name: 'copy-redirects',
    writeBundle() {
      // Copiar _redirects
      const redirectsSource = join(__dirname, 'public', '_redirects')
      const redirectsDest = join(__dirname, 'dist', '_redirects')
      
      if (existsSync(redirectsSource)) {
        try {
          copyFileSync(redirectsSource, redirectsDest)
          console.log('✅ Arquivo _redirects copiado para dist/')
        } catch (error) {
          console.warn('⚠️ Erro ao copiar _redirects:', error.message)
        }
      } else {
        console.warn('⚠️ Arquivo _redirects não encontrado em public/')
      }

      // Copiar _headers
      const headersSource = join(__dirname, 'public', '_headers')
      const headersDest = join(__dirname, 'dist', '_headers')
      
      if (existsSync(headersSource)) {
        try {
          copyFileSync(headersSource, headersDest)
          console.log('✅ Arquivo _headers copiado para dist/')
        } catch (error) {
          console.warn('⚠️ Erro ao copiar _headers:', error.message)
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



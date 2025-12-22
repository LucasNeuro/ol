import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { copyFileSync, existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Plugin para copiar _redirects após o build (para Render Static Site)
const copyRedirectsPlugin = () => {
  return {
    name: 'copy-redirects',
    writeBundle() {
      const sourceFile = join(__dirname, 'public', '_redirects')
      const destFile = join(__dirname, 'dist', '_redirects')
      
      if (existsSync(sourceFile)) {
        try {
          copyFileSync(sourceFile, destFile)
          console.log('✅ Arquivo _redirects copiado para dist/')
        } catch (error) {
          console.warn('⚠️ Erro ao copiar _redirects:', error.message)
        }
      } else {
        console.warn('⚠️ Arquivo _redirects não encontrado em public/')
      }
    },
  }
}

export default defineConfig({
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
})



/**
 * Script para copiar _redirects e _headers para dist após o build
 * Necessário para Render Static Site funcionar corretamente com rotas SPA
 */

import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

const destDir = join(rootDir, 'dist')

// Criar pasta dist se não existir
if (!existsSync(destDir)) {
  mkdirSync(destDir, { recursive: true })
}

// Copiar _redirects
const redirectsSource = join(rootDir, 'public', '_redirects')
const redirectsDest = join(destDir, '_redirects')

try {
  if (existsSync(redirectsSource)) {
    copyFileSync(redirectsSource, redirectsDest)
    console.log('✅ Arquivo _redirects copiado para dist/')
  } else {
    console.warn('⚠️ Arquivo _redirects não encontrado em public/')
  }
} catch (error) {
  console.error('❌ Erro ao copiar _redirects:', error.message)
  process.exit(1)
}

// Copiar _headers
const headersSource = join(rootDir, 'public', '_headers')
const headersDest = join(destDir, '_headers')

try {
  if (existsSync(headersSource)) {
    copyFileSync(headersSource, headersDest)
    console.log('✅ Arquivo _headers copiado para dist/')
  } else {
    console.log('ℹ️ Arquivo _headers não encontrado (opcional)')
  }
} catch (error) {
  console.warn('⚠️ Erro ao copiar _headers:', error.message)
}
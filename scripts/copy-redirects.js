/**
 * Script para copiar _redirects para dist após o build
 * Necessário para Render Static Site funcionar corretamente com rotas SPA
 */

import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

const sourceFile = join(rootDir, 'public', '_redirects')
const destDir = join(rootDir, 'dist')
const destFile = join(destDir, '_redirects')

try {
  if (existsSync(sourceFile)) {
    // Criar pasta dist se não existir
    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true })
    }
    
    copyFileSync(sourceFile, destFile)
    console.log('✅ Arquivo _redirects copiado para dist/')
  } else {
    console.warn('⚠️ Arquivo _redirects não encontrado em public/')
  }
} catch (error) {
  console.error('❌ Erro ao copiar _redirects:', error.message)
  process.exit(1)
}


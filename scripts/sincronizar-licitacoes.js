/**
 * Script para popular a tabela licitações no Supabase a partir da API do PNCP.
 * Uso: npm run sincronizar-licitacoes [dias]
 * Ex.: npm run sincronizar-licitacoes 7   (últimos 7 dias)
 * Requer .env com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (ou SUPABASE_URL e SUPABASE_ANON_KEY).
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { sincronizarLicitacoesComCliente } from '../src/lib/sync.js'

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('❌ Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (ou SUPABASE_URL e SUPABASE_ANON_KEY) no .env')
  process.exit(1)
}

const supabase = createClient(url, key)
const dias = parseInt(process.argv[2] || '7', 10)
const dataFinal = new Date()
const dataInicial = new Date()
dataInicial.setDate(dataFinal.getDate() - dias)

console.log(`📡 Sincronizando licitações dos últimos ${dias} dia(s)...`)
const resultado = await sincronizarLicitacoesComCliente(supabase, dataInicial, dataFinal)
console.log('✅ Resultado:', resultado)
if (!resultado.sucesso) process.exit(1)

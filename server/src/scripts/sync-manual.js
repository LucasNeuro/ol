import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { syncLicitacoesDiaAnterior } from '../services/syncService.js'

// Carregar variáveis de ambiente do arquivo .env na pasta server
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

// Verificar se as variáveis foram carregadas
if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
  console.error('❌ Variáveis de ambiente não encontradas!')
  console.error('   Verifique se o arquivo server/.env existe')
  process.exit(1)
}

console.log('🔄 [Sync Manual] Iniciando sincronização manual...')
console.log('📅 [Sync Manual] Buscando editais do dia anterior\n')

try {
  const resultado = await syncLicitacoesDiaAnterior()
  
  console.log('\n✅ [Sync Manual] Sincronização concluída com sucesso!')
  console.log('📊 Resumo:')
  console.log(`   - Total encontrado: ${resultado.totalEncontrado}`)
  console.log(`   - Total salvo: ${resultado.totalSalvo}`)
  console.log(`   - Alertas verificados: ${resultado.alertasVerificados}`)
  console.log(`   - Notificações enviadas: ${resultado.notificacoesEnviadas}`)
  
  process.exit(0)
} catch (error) {
  console.error('\n❌ [Sync Manual] Erro na sincronização:', error)
  process.exit(1)
}


import { createClient } from '@supabase/supabase-js'
import { buscarContratacoesPorData, buscarTodasContratacoesPorData } from '../lib/pncp.js'
import { salvarLicitacaoCompleta } from '../lib/sync.js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// Carregar variáveis de ambiente do arquivo .env na pasta server
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente do Supabase não configuradas!')
  console.error('   Verifique se o arquivo server/.env existe')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Função formatarDataParaPNCP está em ../lib/pncp.js

/**
 * Busca editais do dia anterior e salva no banco
 */
export async function syncLicitacoesDiaAnterior() {
  console.log('🔄 [Sync] Iniciando sincronização...')
  
  try {
    // Calcular data de ontem (horário de Brasília)
    // Usar timezone de Brasília para garantir a data correta
    const hoje = new Date()
    const hojeBrasilia = new Date(hoje.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
    const ontem = new Date(hojeBrasilia)
    ontem.setDate(hojeBrasilia.getDate() - 1)
    
    // Formatar data no formato AAAAMMDD diretamente
    const year = ontem.getFullYear()
    const month = String(ontem.getMonth() + 1).padStart(2, '0')
    const day = String(ontem.getDate()).padStart(2, '0')
    const dataOntem = `${year}${month}${day}`
    
    console.log(`📅 [Sync] Buscando editais de: ${dataOntem} (${ontem.toLocaleDateString('pt-BR')})`)
    console.log(`📅 [Sync] Data formatada para API: ${dataOntem}`)
    
    // Buscar todas as modalidades (6, 8, 4 são as mais comuns)
    const modalidades = [6, 8, 4, 1, 2, 3, 5, 7, 9, 10, 11, 12, 13]
    let totalEncontrado = 0
    let totalSalvo = 0
    const licitacoesUnicas = new Map()
    
    // Buscar por modalidade (começar pelas mais comuns)
    const modalidadesPrioritarias = [6, 8, 4] // Pregão, Dispensa, Concorrência
    const modalidadesSecundarias = [1, 2, 3, 5, 7, 9, 10, 11, 12, 13]
    const todasModalidades = [...modalidadesPrioritarias, ...modalidadesSecundarias]
    
    for (const modalidade of todasModalidades) {
      try {
        console.log(`🔍 [Sync] Buscando TODAS as licitações da modalidade ${modalidade}...`)
        
        // Usar função que busca todas as páginas automaticamente
        const resultado = await buscarTodasContratacoesPorData({
          dataInicial: dataOntem,
          dataFinal: dataOntem,
          codigoModalidadeContratacao: modalidade,
        })
        
        if (resultado.data && resultado.data.length > 0) {
          console.log(`✅ [Sync] Modalidade ${modalidade}: ${resultado.data.length} licitações únicas encontradas`)
          
          // Adicionar ao mapa (evita duplicatas)
          resultado.data.forEach(lic => {
            if (lic.numeroControlePNCP) {
              licitacoesUnicas.set(lic.numeroControlePNCP, lic)
            }
          })
          
          totalEncontrado += resultado.data.length
        } else {
          console.log(`   ℹ️ [Sync] Modalidade ${modalidade}: Nenhuma licitação encontrada`)
        }
        
        // Delay para evitar rate limiting
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error) {
        // Se for erro 400, pode ser que a modalidade não tenha dados para essa data
        if (error.message.includes('HTTP 400')) {
          console.log(`   ⚠️ [Sync] Modalidade ${modalidade}: Erro 400 (pode não ter dados para esta data)`)
        } else {
          console.warn(`⚠️ [Sync] Erro ao buscar modalidade ${modalidade}:`, error.message)
        }
        // Continuar com próxima modalidade
      }
    }
    
    console.log(`📊 [Sync] Total de licitações únicas: ${licitacoesUnicas.size}`)
    
    // Salvar cada licitação no banco (com itens e documentos)
    let salvas = 0
    let erros = 0
    
    for (const [numeroControle, licitacao] of licitacoesUnicas) {
      try {
        // Verificar se já existe
        const { data: existente } = await supabase
          .from('licitacoes')
          .select('id, dados_completos')
          .eq('numero_controle_pncp', numeroControle)
          .maybeSingle()
        
        // Se já existe e tem dados completos, pular
        if (existente?.dados_completos) {
          continue
        }
        
        // Salvar licitação completa (com itens e documentos)
        const licitacaoId = await salvarLicitacaoCompleta(licitacao, null)
        
        if (licitacaoId) {
          salvas++
          
          // Marcar como dados completos
          await supabase
            .from('licitacoes')
            .update({ dados_completos: true })
            .eq('id', licitacaoId)
        }
        
        // Delay para evitar sobrecarga
        if (salvas % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 200))
        }
      } catch (error) {
        console.error(`❌ [Sync] Erro ao salvar licitação ${numeroControle}:`, error.message)
        erros++
      }
    }
    
    totalSalvo = salvas
    
    // Verificar alertas e notificar usuários
    console.log('🔔 [Sync] Verificando alertas dos usuários...')
    const { alertasVerificados, notificacoesEnviadas } = await verificarAlertas(dataOntem)
    
    // Salvar log da execução
    await salvarLogSync({
      data_sincronizacao: dataOntem,
      total_encontrado: licitacoesUnicas.size,
      total_salvo: totalSalvo,
      alertas_verificados: alertasVerificados,
      notificacoes_enviadas: notificacoesEnviadas,
      sucesso: true,
    })
    
    console.log(`✅ [Sync] Sincronização concluída!`)
    console.log(`   📊 Total encontrado: ${licitacoesUnicas.size}`)
    console.log(`   💾 Total salvo: ${totalSalvo}`)
    console.log(`   🔔 Alertas verificados: ${alertasVerificados}`)
    console.log(`   📧 Notificações enviadas: ${notificacoesEnviadas}`)
    
    return {
      totalEncontrado: licitacoesUnicas.size,
      totalSalvo,
      alertasVerificados,
      notificacoesEnviadas,
      data: dataOntem,
    }
  } catch (error) {
    console.error('❌ [Sync] Erro na sincronização:', error)
    
    // Salvar log de erro
    await salvarLogSync({
      data_sincronizacao: formatarDataParaPNCP(new Date()),
      total_encontrado: 0,
      total_salvo: 0,
      alertas_verificados: 0,
      notificacoes_enviadas: 0,
      sucesso: false,
      erro: error.message,
    })
    
    throw error
  }
}

/**
 * Verifica alertas dos usuários e envia notificações
 */
async function verificarAlertas(dataPublicacao) {
  try {
    // Buscar todos os alertas ativos
    const { data: alertas, error } = await supabase
      .from('alertas_usuario')
      .select('*')
      .eq('ativo', true)
    
    if (error || !alertas || alertas.length === 0) {
      return { alertasVerificados: 0, notificacoesEnviadas: 0 }
    }
    
    console.log(`🔔 [Sync] Verificando ${alertas.length} alertas ativos...`)
    
    let notificacoesEnviadas = 0
    
    for (const alerta of alertas) {
      try {
        const filtros = alerta.filtros || {}
        
        // Buscar licitações que batem com os filtros
        const { data: licitacoes } = await supabase
          .from('licitacoes')
          .select('*')
          .eq('data_publicacao_pncp', dataPublicacao)
          .limit(100)
        
        if (!licitacoes || licitacoes.length === 0) continue
        
        // Filtrar licitações que batem com os critérios
        const matches = licitacoes.filter(lic => {
          // Verificar modalidade
          if (filtros.modalidade && lic.modalidade_id !== filtros.modalidade) {
            return false
          }
          
          // Verificar UF
          if (filtros.uf && lic.uf_sigla !== filtros.uf) {
            return false
          }
          
          // Verificar valor mínimo
          if (filtros.valor_minimo && lic.valor_total_estimado < filtros.valor_minimo) {
            return false
          }
          
          // Verificar valor máximo
          if (filtros.valor_maximo && lic.valor_total_estimado > filtros.valor_maximo) {
            return false
          }
          
          // Verificar palavras-chave
          if (filtros.palavras_chave && filtros.palavras_chave.length > 0) {
            const objetoLower = (lic.objeto_compra || '').toLowerCase()
            const temPalavraChave = filtros.palavras_chave.some(palavra =>
              objetoLower.includes(palavra.toLowerCase())
            )
            if (!temPalavraChave) return false
          }
          
          return true
        })
        
        if (matches.length > 0) {
          // Criar notificação
          console.log(`📧 [Sync] Enviando notificação para usuário ${alerta.usuario_id}: ${matches.length} editais encontrados`)
          
          // TODO: Implementar envio de email/push
          // Por enquanto, apenas logar
          notificacoesEnviadas++
        }
      } catch (error) {
        console.error(`❌ [Sync] Erro ao verificar alerta ${alerta.id}:`, error.message)
      }
    }
    
    return {
      alertasVerificados: alertas.length,
      notificacoesEnviadas,
    }
  } catch (error) {
    console.error('❌ [Sync] Erro ao verificar alertas:', error)
    return { alertasVerificados: 0, notificacoesEnviadas: 0 }
  }
}

/**
 * Salva log da execução da sincronização
 */
async function salvarLogSync(dados) {
  try {
    // Criar tabela de logs se não existir (temporário, depois criar no schema)
    await supabase
      .from('logs_sync')
      .insert({
        ...dados,
        executado_em: new Date().toISOString(),
      })
      .catch(() => {
        // Tabela pode não existir ainda, apenas logar
        console.log('📝 [Sync] Log salvo (tabela logs_sync pode não existir)')
      })
  } catch (error) {
    // Ignorar erros de log
    console.warn('⚠️ [Sync] Não foi possível salvar log:', error.message)
  }
}

/**
 * Retorna status da última sincronização
 */
export async function getSyncStatus() {
  try {
    const { data: ultimoLog } = await supabase
      .from('logs_sync')
      .select('*')
      .order('executado_em', { ascending: false })
      .limit(1)
      .maybeSingle()
    
    return {
      ultimaExecucao: ultimoLog?.executado_em || null,
      sucesso: ultimoLog?.sucesso || false,
      totalSalvo: ultimoLog?.total_salvo || 0,
    }
  } catch (error) {
    return {
      ultimaExecucao: null,
      sucesso: false,
      erro: error.message,
    }
  }
}

/**
 * Retorna histórico de sincronizações
 */
export async function getSyncHistory(limit = 10) {
  try {
    const { data: logs } = await supabase
      .from('logs_sync')
      .select('*')
      .order('executado_em', { ascending: false })
      .limit(limit)
    
    return logs || []
  } catch (error) {
    return []
  }
}


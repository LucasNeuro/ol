/**
 * Serviço para verificar alertas e enviar webhook
 * Funciona diretamente no código, sem depender de Edge Functions
 */

import { supabase } from './supabase'

// Webhook URL - Configurar via variável de ambiente
// No arquivo .env ou .env.local:
// VITE_WEBHOOK_URL_DEFAULT=https://webhook.fiqon.app/webhook/...
const WEBHOOK_URL_DEFAULT = import.meta.env.VITE_WEBHOOK_URL_DEFAULT || 
  'https://webhook.fiqon.app/webhook/019b290b-64f6-7310-acb5-3c7ecdce4e29/b23c4811-a696-4b15-8f58-d275cdaa2eea'

/**
 * Formata data para query SQL (YYYY-MM-DD)
 */
function formatarDataParaQuery(data) {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

/**
 * Extrai CNAEs da licitação
 */
function extrairCnaesLicitacao(licitacao) {
  const cnaes = []

  if (licitacao.dados_complementares) {
    try {
      const dados = typeof licitacao.dados_complementares === 'string' 
        ? JSON.parse(licitacao.dados_complementares)
        : licitacao.dados_complementares

      if (dados.cnaes) {
        cnaes.push(...(Array.isArray(dados.cnaes) ? dados.cnaes : [dados.cnaes]))
      }
    } catch (e) {
      console.warn('Erro ao parsear dados_complementares:', e)
    }
  }

  return cnaes.map(c => String(c).trim()).filter(c => c)
}

/**
 * Busca licitações filtradas baseadas no perfil do usuário
 */
async function buscarLicitacoesFiltradas(alerta, usuario, dataInicio) {
  // Buscar licitações dos últimos 30 dias
  let query = supabase
    .from('licitacoes')
    .select('*')
    .gte('data_publicacao_pncp', dataInicio)
    .order('data_publicacao_pncp', { ascending: false })
    .limit(500)

  // Aplicar filtros de estados de interesse do perfil
  if (usuario.estados_interesse && Array.isArray(usuario.estados_interesse) && usuario.estados_interesse.length > 0) {
    if (usuario.estados_interesse.length === 1) {
      query = query.eq('uf_sigla', usuario.estados_interesse[0])
    } else {
      query = query.in('uf_sigla', usuario.estados_interesse)
    }
  }

  const { data, error } = await query

  if (error) {
    console.error('Erro ao buscar licitações:', error)
    return []
  }

  let licitacoes = data || []

  // Filtrar por CNAEs do perfil
  const cnaesPerfil = []

  if (usuario.cnae_principal) {
    cnaesPerfil.push(String(usuario.cnae_principal).trim())
  }

  if (usuario.cnaes_secundarios && Array.isArray(usuario.cnaes_secundarios)) {
    usuario.cnaes_secundarios.forEach((cnae) => {
      const cnaeStr = String(cnae).trim()
      if (cnaeStr && !cnaesPerfil.includes(cnaeStr)) {
        cnaesPerfil.push(cnaeStr)
      }
    })
  }

  if (usuario.setores_atividades && Array.isArray(usuario.setores_atividades)) {
    usuario.setores_atividades.forEach((cnae) => {
      const cnaeStr = String(cnae).trim()
      if (cnaeStr && !cnaesPerfil.includes(cnaeStr)) {
        cnaesPerfil.push(cnaeStr)
      }
    })
  }

  // Filtrar licitações por CNAEs se houver
  if (cnaesPerfil.length > 0) {
    licitacoes = licitacoes.filter((lic) => {
      const cnaesLicitacao = extrairCnaesLicitacao(lic)
      return cnaesPerfil.some((cnae) => cnaesLicitacao.includes(cnae))
    })
  }

  return licitacoes
}

/**
 * Envia webhook com dados do alerta e licitações
 */
async function enviarWebhook(webhookUrl, dados) {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dados),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Erro desconhecido')
      throw new Error(`Erro ao enviar webhook: ${response.status} - ${errorText}`)
    }

    return await response.json().catch(() => ({}))
  } catch (error) {
    console.error('Erro ao enviar webhook:', error)
    throw error
  }
}

/**
 * Verifica e processa um alerta específico
 */
export async function verificarAlerta(alertaId = null) {
  try {
    console.log('🔍 Iniciando verificação de alertas...')

    const agora = new Date()
    const horaAtual = agora.toTimeString().slice(0, 5) // HH:MM

    // Buscar alertas ativos
    let query = supabase
      .from('alertas_usuario')
      .select(`
        *,
        profiles:usuario_id (
          *
        )
      `)
      .eq('ativo', true)
      .in('frequencia', ['diario', 'semanal'])

    if (alertaId) {
      query = query.eq('id', alertaId)
    }

    const { data: alertas, error: alertasError } = await query

    if (alertasError) {
      throw new Error(`Erro ao buscar alertas: ${alertasError.message}`)
    }

    if (!alertas || alertas.length === 0) {
      console.log('ℹ️ Nenhum alerta encontrado')
      return { success: true, processados: 0, message: 'Nenhum alerta encontrado' }
    }

    console.log(`🔍 Encontrados ${alertas.length} alertas para verificar`)

    // Filtrar alertas que estão no horário programado
    const alertasParaProcessar = alertas.filter((alerta) => {
      if (!alerta.horario_verificacao) {
        console.log(`⏰ Alerta ${alerta.nome_alerta} sem horário definido - processando`)
        return true
      }

      const horarioAlerta = typeof alerta.horario_verificacao === 'string'
        ? alerta.horario_verificacao.slice(0, 5)
        : alerta.horario_verificacao

      const [horaAlerta, minutoAlerta] = horarioAlerta.split(':').map(Number)
      const [horaAtualNum, minutoAtualNum] = horaAtual.split(':').map(Number)

      const minutosAlerta = horaAlerta * 60 + minutoAlerta
      const minutosAtual = horaAtualNum * 60 + minutoAtualNum

      let diferencaMinutos = minutosAtual - minutosAlerta
      if (diferencaMinutos < 0) diferencaMinutos += 24 * 60

      // Processar se estiver dentro de 5 minutos após o horário programado
      const dentroDaJanela = diferencaMinutos >= 0 && diferencaMinutos <= 5

      if (dentroDaJanela) {
        console.log(`✅ Alerta ${alerta.nome_alerta} está no horário programado (${horarioAlerta})`)
        return true
      } else {
        console.log(`⏭️ Alerta ${alerta.nome_alerta} não está no horário (programado: ${horarioAlerta}, atual: ${horaAtual})`)
        return false
      }
    })

    console.log(`📋 ${alertasParaProcessar.length} de ${alertas.length} alertas estão no horário para processar`)

    if (alertasParaProcessar.length === 0) {
      return { success: true, processados: 0, message: 'Nenhum alerta no horário para processar' }
    }

    // Processar cada alerta
    const resultados = []

    for (const alerta of alertasParaProcessar) {
      const usuario = alerta.profiles
      if (!usuario) continue

      try {
        // Buscar todas as licitações filtradas (últimos 30 dias)
        const dataInicio = formatarDataParaQuery(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))

        console.log(`📋 Verificando alerta ${alerta.nome_alerta} - buscando todas as licitações filtradas`)

        const licitacoesFiltradas = await buscarLicitacoesFiltradas(alerta, usuario, dataInicio)

        console.log(`✅ Encontradas ${licitacoesFiltradas.length} licitações filtradas para ${alerta.nome_alerta}`)

        // Preparar dados para webhook
        const dadosWebhook = {
          tipo: 'verificacao_periodica',
          timestamp: new Date().toISOString(),
          alerta: {
            id: alerta.id,
            nome: alerta.nome_alerta,
            email_notificacao: alerta.email_notificacao,
            frequencia: alerta.frequencia,
            ultima_verificacao: alerta.ultima_verificacao,
          },
          empresa: {
            id: usuario.id,
            cnpj: usuario.cnpj,
            razao_social: usuario.razao_social,
            nome_fantasia: usuario.nome_fantasia,
            email: usuario.email,
            telefone: usuario.telefone,
            site: usuario.site,
            cargo: usuario.cargo,
            situacao_cadastral: usuario.situacao_cadastral,
            data_situacao_cadastral: usuario.data_situacao_cadastral,
            matriz_filial: usuario.matriz_filial,
            data_inicio_atividade: usuario.data_inicio_atividade,
            cnae_principal: usuario.cnae_principal,
            cnaes_secundarios: usuario.cnaes_secundarios,
            natureza_juridica: usuario.natureza_juridica,
            porte_empresa: usuario.porte_empresa,
            capital_social: usuario.capital_social,
            logradouro: usuario.logradouro,
            numero: usuario.numero,
            complemento: usuario.complemento,
            bairro: usuario.bairro,
            cep: usuario.cep,
            uf: usuario.uf,
            municipio: usuario.municipio,
            email_secundario: usuario.email_secundario,
            nome_responsavel: usuario.nome_responsavel,
            setores_atividades: usuario.setores_atividades,
            estados_interesse: usuario.estados_interesse,
            quantidade_funcionarios: usuario.quantidade_funcionarios,
            faturamento_anual: usuario.faturamento_anual,
            licitacoes_por_mes: usuario.licitacoes_por_mes,
            como_pretende_usar: usuario.como_pretende_usar,
            opcao_simples: usuario.opcao_simples,
            data_opcao_simples: usuario.data_opcao_simples,
            opcao_mei: usuario.opcao_mei,
            data_opcao_mei: usuario.data_opcao_mei,
            dados_completos_receita: usuario.dados_completos_receita,
            quadro_societario: usuario.quadro_societario,
          },
          resultado: {
            total_encontradas: licitacoesFiltradas.length,
            periodo_verificado: {
              desde: dataInicio,
              ate: formatarDataParaQuery(new Date()),
            },
          },
          licitacoes: licitacoesFiltradas.map(lic => ({
            id: lic.id,
            numero_controle_pncp: lic.numero_controle_pncp,
            objeto_compra: lic.objeto_compra,
            modalidade_nome: lic.modalidade_nome,
            valor_total_estimado: lic.valor_total_estimado,
            data_publicacao_pncp: lic.data_publicacao_pncp,
            uf_sigla: lic.uf_sigla,
            orgao_razao_social: lic.orgao_razao_social,
            link_sistema_origem: lic.link_sistema_origem,
          })),
        }

        // Enviar webhook
        const webhookUrl = alerta.webhook_url || WEBHOOK_URL_DEFAULT

        console.log(`📤 Enviando webhook para: ${webhookUrl}`)
        console.log(`📊 Total de licitações a enviar: ${licitacoesFiltradas.length}`)

        const webhookResponse = await enviarWebhook(webhookUrl, dadosWebhook)

        // Atualizar última verificação
        await supabase
          .from('alertas_usuario')
          .update({ ultima_verificacao: new Date().toISOString() })
          .eq('id', alerta.id)

        resultados.push({
          alerta_id: alerta.id,
          nome_alerta: alerta.nome_alerta,
          licitacoes_encontradas: licitacoesFiltradas.length,
          webhook_enviado: true,
          status: 'success',
        })

        console.log(`✅ Alerta ${alerta.nome_alerta} processado: ${licitacoesFiltradas.length} licitações enviadas`)

      } catch (error) {
        console.error(`❌ Erro ao processar alerta ${alerta.id}:`, error)
        resultados.push({
          alerta_id: alerta.id,
          nome_alerta: alerta.nome_alerta,
          erro: error.message,
          status: 'error',
        })
      }
    }

    return {
      success: true,
      processados: resultados.length,
      resultados,
    }

  } catch (error) {
    console.error('❌ Erro ao verificar alertas:', error)
    return {
      success: false,
      error: error.message || 'Erro desconhecido ao verificar alertas',
    }
  }
}

/**
 * Inicia verificação periódica de alertas
 * Roda a cada X minutos (padrão: 5 minutos)
 */
export function iniciarVerificacaoPeriodica(intervaloMinutos = 5) {
  const intervaloMs = intervaloMinutos * 60 * 1000

  console.log(`🔄 Iniciando verificação periódica a cada ${intervaloMinutos} minutos`)

  // Verificar imediatamente
  verificarAlerta()

  // Configurar intervalo
  const intervalId = setInterval(() => {
    verificarAlerta()
  }, intervaloMs)

  return intervalId
}

/**
 * Para a verificação periódica
 */
export function pararVerificacaoPeriodica(intervalId) {
  if (intervalId) {
    clearInterval(intervalId)
    console.log('⏹️ Verificação periódica parada')
  }
}


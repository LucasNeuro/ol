/**
 * API Route para Vercel - Verificar Alertas
 * Esta função serverless é chamada automaticamente pelo Vercel Cron
 * 
 * Configurar no vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/verificar-alertas",
 *     "schedule": "*/5 * * * *"
 *   }]
 * }
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const webhookUrlDefault = process.env.WEBHOOK_URL_DEFAULT || 
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
      // Ignorar erros de parsing
    }
  }

  return cnaes.map(c => String(c).trim()).filter(c => c)
}

/**
 * Busca licitações filtradas baseadas no perfil do usuário
 */
async function buscarLicitacoesFiltradas(supabase, alerta, usuario, dataInicio) {
  let query = supabase
    .from('licitacoes')
    .select('*')
    .gte('data_publicacao_pncp', dataInicio)
    .order('data_publicacao_pncp', { ascending: false })
    .limit(500)

  if (usuario.estados_interesse && Array.isArray(usuario.estados_interesse) && usuario.estados_interesse.length > 0) {
    if (usuario.estados_interesse.length === 1) {
      query = query.eq('uf_sigla', usuario.estados_interesse[0])
    } else {
      query = query.in('uf_sigla', usuario.estados_interesse)
    }
  }

  const { data, error } = await query

  if (error) {
    console.error('Erro ao buscar licitações:', error.message)
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

  if (cnaesPerfil.length > 0) {
    licitacoes = licitacoes.filter((lic) => {
      const cnaesLicitacao = extrairCnaesLicitacao(lic)
      return cnaesPerfil.some((cnae) => cnaesLicitacao.includes(cnae))
    })
  }

  return licitacoes
}

/**
 * Envia webhook
 */
async function enviarWebhook(webhookUrl, dados) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(dados),
  })

  if (!response.ok) {
    throw new Error(`Erro ao enviar webhook: ${response.status}`)
  }

  return await response.json().catch(() => ({}))
}

/**
 * Handler principal da API Route
 * Formato Vercel: export default async function handler(req, res)
 */
export default async function handler(req, res) {
  // Permitir GET (para cron job) e POST (para teste manual)
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // CORS headers (opcional, mas útil)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ 
        error: 'Variáveis de ambiente não configuradas',
        message: 'Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY'
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const agora = new Date()
    const horaAtual = agora.toTimeString().slice(0, 5)

    // Buscar alertas ativos
    const { data: alertas, error: alertasError } = await supabase
      .from('alertas_usuario')
      .select(`
        *,
        profiles:usuario_id (
          *
        )
      `)
      .eq('ativo', true)
      .in('frequencia', ['diario', 'semanal'])

    if (alertasError) {
      throw new Error(`Erro ao buscar alertas: ${alertasError.message}`)
    }

    if (!alertas || alertas.length === 0) {
      return res.status(200).json({ 
        success: true, 
        processados: 0,
        message: 'Nenhum alerta encontrado'
      })
    }

    // Filtrar alertas no horário
    const alertasParaProcessar = alertas.filter((alerta) => {
      if (!alerta.horario_verificacao) {
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

      return diferencaMinutos >= 0 && diferencaMinutos <= 5
    })

    if (alertasParaProcessar.length === 0) {
      return res.status(200).json({ 
        success: true, 
        processados: 0,
        message: 'Nenhum alerta no horário para processar'
      })
    }

    // Processar cada alerta
    const resultados = []

    for (const alerta of alertasParaProcessar) {
      const usuario = alerta.profiles
      if (!usuario) continue

      try {
        const dataInicio = formatarDataParaQuery(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
        const licitacoesFiltradas = await buscarLicitacoesFiltradas(supabase, alerta, usuario, dataInicio)

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
            uf: usuario.uf,
            municipio: usuario.municipio,
            cnae_principal: usuario.cnae_principal,
            cnaes_secundarios: usuario.cnaes_secundarios,
            setores_atividades: usuario.setores_atividades,
            estados_interesse: usuario.estados_interesse,
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

        const webhookUrl = alerta.webhook_url || webhookUrlDefault
        await enviarWebhook(webhookUrl, dadosWebhook)

        await supabase
          .from('alertas_usuario')
          .update({ ultima_verificacao: new Date().toISOString() })
          .eq('id', alerta.id)

        resultados.push({
          alerta_id: alerta.id,
          nome_alerta: alerta.nome_alerta,
          licitacoes_encontradas: licitacoesFiltradas.length,
          status: 'success',
        })

      } catch (error) {
        resultados.push({
          alerta_id: alerta.id,
          nome_alerta: alerta.nome_alerta,
          erro: error.message,
          status: 'error',
        })
      }
    }

    return res.status(200).json({
      success: true,
      processados: resultados.length,
      resultados,
    })

  } catch (error) {
    console.error('Erro ao verificar alertas:', error)
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro desconhecido',
    })
  }
}


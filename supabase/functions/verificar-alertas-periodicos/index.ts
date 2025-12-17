// ============================================
// EDGE FUNCTION: verificar-alertas-periodicos
// ============================================
// Verifica periodicamente os alertas e busca novas licitações
// Pode ser chamada manualmente ou via cron job
// Envia webhook mesmo quando não há novas licitações (com status vazio)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Webhook URL padrão - Configurar no Supabase Dashboard > Settings > Edge Functions > Secrets
// Nome da variável: WEBHOOK_URL_DEFAULT
const WEBHOOK_URL_DEFAULT = Deno.env.get('WEBHOOK_URL_DEFAULT') || 'https://webhook.fiqon.app/webhook/019b290b-64f6-7310-acb5-3c7ecdce4e29/b23c4811-a696-4b15-8f58-d275cdaa2eea'

// Log para verificar se está usando variável de ambiente
console.log('🔗 Webhook URL configurada:', Deno.env.get('WEBHOOK_URL_DEFAULT') ? '✅ Usando variável de ambiente' : '⚠️ Usando valor padrão do código')

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verificar autenticação (aceita GET ou POST)
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization')
    const apikeyHeader = req.headers.get('apikey') || req.headers.get('x-api-key')
    
    // Se não tiver autenticação, retornar erro 401
    if (!authHeader && !apikeyHeader) {
      console.error('❌ Requisição sem autenticação')
      return new Response(
        JSON.stringify({ 
          error: 'Unauthorized',
          message: 'Esta função requer autenticação. Envie o header Authorization com Bearer token ou apikey.'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 401 
        }
      )
    }

    // Aceitar tanto GET quanto POST
    let alerta_id = null
    if (req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}))
        alerta_id = body.alerta_id
      } catch (e) {
        // Se não conseguir parsear JSON, continuar sem alerta_id
      }
    } else if (req.method === 'GET') {
      // Para GET, tentar pegar alerta_id da query string
      const url = new URL(req.url)
      alerta_id = url.searchParams.get('alerta_id')
    }

    console.log('🔍 Iniciando verificação periódica de alertas...')
    console.log(`📋 Método: ${req.method}, Alerta ID: ${alerta_id || 'todos'}`)

    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 1. Buscar alertas ativos que precisam ser verificados
    // Obter hora atual para verificar se está no horário programado
    const agora = new Date()
    const horaAtual = agora.toTimeString().slice(0, 5) // HH:MM
    const horaAtualComSegundos = agora.toTimeString().slice(0, 8) // HH:MM:SS
    
    console.log(`🕐 Hora atual: ${horaAtualComSegundos}`)

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

    // Se alerta_id fornecido, processar apenas esse alerta
    if (alerta_id) {
      query = query.eq('id', alerta_id)
    }

    const { data: alertas, error: alertasError } = await query

    if (alertasError) {
      throw new Error(`Erro ao buscar alertas: ${alertasError.message}`)
    }

    console.log(`🔍 Encontrados ${alertas?.length || 0} alertas para verificar`)

    if (!alertas || alertas.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhum alerta encontrado para verificação',
          processados: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // 2. Filtrar alertas que estão no horário programado
    const alertasParaProcessar = alertas?.filter((alerta: any) => {
      // Se não tem horário definido, processar (para compatibilidade)
      if (!alerta.horario_verificacao) {
        console.log(`⏰ Alerta ${alerta.nome_alerta} sem horário definido - processando`)
        return true
      }

      // Converter horário do banco (TIME) para string HH:MM
      const horarioAlerta = typeof alerta.horario_verificacao === 'string'
        ? alerta.horario_verificacao.slice(0, 5) // Se vier como "13:25:00", pegar "13:25"
        : alerta.horario_verificacao

      // Verificar se está dentro de uma janela de 5 minutos do horário programado
      const [horaAlerta, minutoAlerta] = horarioAlerta.split(':').map(Number)
      const [horaAtualNum, minutoAtualNum] = horaAtual.split(':').map(Number)
      
      const minutosAlerta = horaAlerta * 60 + minutoAlerta
      const minutosAtual = horaAtualNum * 60 + minutoAtualNum
      
      // Diferença em minutos (considerando que pode ser no dia seguinte)
      let diferencaMinutos = minutosAtual - minutosAlerta
      if (diferencaMinutos < 0) diferencaMinutos += 24 * 60
      
      // Processar se estiver dentro de 5 minutos após o horário programado
      const dentroDaJanela = diferencaMinutos >= 0 && diferencaMinutos <= 5
      
      // Para frequência semanal, também verificar se já passou 7 dias desde a última verificação
      if (alerta.frequencia === 'semanal' && alerta.ultima_verificacao) {
        const ultimaVerificacao = new Date(alerta.ultima_verificacao)
        const diasDesdeUltimaVerificacao = (agora.getTime() - ultimaVerificacao.getTime()) / (1000 * 60 * 60 * 24)
        if (diasDesdeUltimaVerificacao < 7) {
          console.log(`⏭️ Alerta ${alerta.nome_alerta} (semanal) ainda não completou 7 dias desde última verificação`)
          return false
        }
      }
      
      if (dentroDaJanela) {
        console.log(`✅ Alerta ${alerta.nome_alerta} está no horário programado (${horarioAlerta})`)
        return true
      } else {
        console.log(`⏭️ Alerta ${alerta.nome_alerta} não está no horário (programado: ${horarioAlerta}, atual: ${horaAtual})`)
        return false
      }
    }) || []

    console.log(`📋 ${alertasParaProcessar.length} de ${alertas?.length || 0} alertas estão no horário para processar`)

    if (alertasParaProcessar.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhum alerta no horário programado para verificar',
          hora_atual: horaAtualComSegundos,
          processados: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // 3. Processar cada alerta
    const resultados = []

    for (const alerta of alertasParaProcessar) {
      const usuario = alerta.profiles
      if (!usuario) continue

      try {
        // Buscar TODAS as licitações filtradas (últimos 30 dias para não sobrecarregar)
        const dataInicio = formatarDataParaQuery(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))

        console.log(`📋 Verificando alerta ${alerta.nome_alerta} - buscando todas as licitações filtradas`)

        // 3. Buscar TODAS as licitações que correspondem aos critérios
        const licitacoesFiltradas = await buscarLicitacoesFiltradas(
          supabase,
          alerta,
          usuario,
          dataInicio
        )

        console.log(`✅ Encontradas ${licitacoesFiltradas.length} licitações filtradas para ${alerta.nome_alerta}`)

        // 4. Preparar dados para webhook
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
            // Dados completos da empresa do perfil
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

        // 5. Enviar webhook SEMPRE (mesmo se não houver licitações)
        // Prioridade: 1) webhook_url do alerta, 2) WEBHOOK_URL_DEFAULT da variável de ambiente, 3) valor padrão
        const webhookUrl = alerta.webhook_url || WEBHOOK_URL_DEFAULT
        
        console.log(`📤 Enviando webhook para: ${webhookUrl}`)
        console.log(`📊 Total de licitações a enviar: ${licitacoesFiltradas.length}`)
        console.log(`🔍 Fonte da URL: ${alerta.webhook_url ? 'Alerta específico' : Deno.env.get('WEBHOOK_URL_DEFAULT') ? 'Variável de ambiente' : 'Valor padrão'}`)

        let webhookResponse
        try {
          webhookResponse = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(dadosWebhook),
          })

          if (!webhookResponse.ok) {
            const errorText = await webhookResponse.text().catch(() => 'Erro desconhecido')
            console.error(`❌ Erro ao enviar webhook: ${webhookResponse.status} - ${errorText}`)
          } else {
            console.log(`✅ Webhook enviado com sucesso! Status: ${webhookResponse.status}`)
          }
        } catch (webhookError: any) {
          console.error(`❌ Erro ao fazer requisição webhook:`, webhookError.message)
          throw webhookError
        }

        // 6. Atualizar última verificação
        await supabase
          .from('alertas_usuario')
          .update({ ultima_verificacao: new Date().toISOString() })
          .eq('id', alerta.id)

        resultados.push({
          alerta_id: alerta.id,
          nome_alerta: alerta.nome_alerta,
          licitacoes_encontradas: licitacoesFiltradas.length,
          webhook_enviado: webhookResponse?.ok || false,
          status: webhookResponse?.status || 0,
        })

        console.log(`✅ Alerta ${alerta.nome_alerta} processado: ${licitacoesFiltradas.length} licitações filtradas enviadas`)

      } catch (error) {
        console.error(`❌ Erro ao processar alerta ${alerta.id}:`, error)
        resultados.push({
          alerta_id: alerta.id,
          nome_alerta: alerta.nome_alerta,
          erro: error.message,
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_processados: resultados.length,
        resultados,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('❌ Erro ao verificar alertas:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro desconhecido ao verificar alertas',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

/**
 * Busca TODAS as licitações filtradas que correspondem aos critérios do alerta
 * Usa filtros do alerta + perfil da empresa
 * Busca dos últimos 30 dias (ou período configurado)
 */
async function buscarLicitacoesFiltradas(
  supabase: any,
  alerta: any,
  usuario: any,
  dataInicio: string
): Promise<any[]> {
  const filtros = alerta.filtros || {}
  const filtrosAvancados = alerta.filtros_avancados || {}

  // Construir query base
  let query = supabase
    .from('licitacoes')
    .select('*')
    .gte('data_publicacao_pncp', dataInicio)
    .order('data_publicacao_pncp', { ascending: false })

  // Aplicar filtros de estados de interesse do perfil
  if (usuario.estados_interesse && Array.isArray(usuario.estados_interesse) && usuario.estados_interesse.length > 0) {
    // Se tiver apenas um estado, usar filtro direto
    if (usuario.estados_interesse.length === 1) {
      query = query.eq('uf_sigla', usuario.estados_interesse[0])
    } else {
      // Se tiver múltiplos estados, usar filtro IN
      query = query.in('uf_sigla', usuario.estados_interesse)
    }
  } else if (filtros.uf) {
    // Fallback para filtro do alerta se não tiver estados de interesse
    query = query.eq('uf_sigla', filtros.uf)
  }

  // Aplicar filtros básicos do alerta (se não foram sobrescritos pelo perfil)
  if (filtros.modalidade) {
    query = query.ilike('modalidade_nome', `%${filtros.modalidade}%`)
  }

  if (filtros.valorMinimo) {
    query = query.gte('valor_total_estimado', parseFloat(filtros.valorMinimo))
  }

  if (filtros.valorMaximo) {
    query = query.lte('valor_total_estimado', parseFloat(filtros.valorMaximo))
  }

  if (filtros.buscaObjeto) {
    query = query.ilike('objeto_compra', `%${filtros.buscaObjeto}%`)
  }

  // Aplicar filtros de exclusão
  if (filtrosAvancados.filtros_exclusao) {
    const exclusoes = filtrosAvancados.filtros_exclusao

    if (exclusoes.excluirUfs && Array.isArray(exclusoes.excluirUfs) && exclusoes.excluirUfs.length > 0) {
      query = query.not('uf_sigla', 'in', `(${exclusoes.excluirUfs.map((uf: string) => `"${uf}"`).join(',')})`)
    }

    if (exclusoes.excluirModalidades && Array.isArray(exclusoes.excluirModalidades) && exclusoes.excluirModalidades.length > 0) {
      exclusoes.excluirModalidades.forEach((modalidade: string) => {
        query = query.not('modalidade_nome', 'ilike', `%${modalidade}%`)
      })
    }
  }

  const { data, error } = await query.limit(500) // Limitar a 500 resultados (aumentado para pegar mais licitações)

  if (error) {
    console.error('Erro ao buscar licitações:', error)
    return []
  }

  // Filtrar por CNAEs do perfil (setores_atividades + cnae_principal)
  let licitacoes = data || []

  // Coletar todos os CNAEs do perfil
  const cnaesPerfil: string[] = []
  
  if (usuario.cnae_principal) {
    cnaesPerfil.push(String(usuario.cnae_principal).trim())
  }

  if (usuario.cnaes_secundarios && Array.isArray(usuario.cnaes_secundarios)) {
    usuario.cnaes_secundarios.forEach((cnae: any) => {
      const cnaeStr = String(cnae).trim()
      if (cnaeStr && !cnaesPerfil.includes(cnaeStr)) {
        cnaesPerfil.push(cnaeStr)
      }
    })
  }

  // Adicionar CNAEs de setores_atividades
  if (usuario.setores_atividades && Array.isArray(usuario.setores_atividades)) {
    usuario.setores_atividades.forEach((cnae: any) => {
      const cnaeStr = String(cnae).trim()
      if (cnaeStr && !cnaesPerfil.includes(cnaeStr)) {
        cnaesPerfil.push(cnaeStr)
      }
    })
  }

  // Adicionar CNAEs dos filtros avançados do alerta
  if (filtrosAvancados.filtros_cnaes && Object.keys(filtrosAvancados.filtros_cnaes).length > 0) {
    Object.keys(filtrosAvancados.filtros_cnaes).forEach((cnae: string) => {
      const cnaeStr = String(cnae).trim()
      if (cnaeStr && !cnaesPerfil.includes(cnaeStr)) {
        cnaesPerfil.push(cnaeStr)
      }
    })
  }

  // Filtrar licitações por CNAEs se houver
  if (cnaesPerfil.length > 0) {
    licitacoes = licitacoes.filter((lic: any) => {
      const cnaesLicitacao = extrairCnaesLicitacao(lic)
      // Verificar se há interseção entre CNAEs do perfil e da licitação
      return cnaesPerfil.some((cnae: string) => cnaesLicitacao.includes(cnae))
    })
  }

  return licitacoes
}

/**
 * Extrai CNAEs da licitação
 */
function extrairCnaesLicitacao(licitacao: any): string[] {
  const cnaes: string[] = []

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
 * Formata data para query SQL (YYYY-MM-DD)
 */
function formatarDataParaQuery(data: Date): string {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}


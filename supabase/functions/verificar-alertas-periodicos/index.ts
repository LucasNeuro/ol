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

// Webhook URL padrão
const WEBHOOK_URL_DEFAULT = Deno.env.get('WEBHOOK_URL_DEFAULT') || 'https://webhook.fiqon.app/webhook/019afae9-4e94-72fc-b30f-c60f686bacf5/9b0754d5-af77-4c95-b991-67d9a81fee99'

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { alerta_id } = await req.json().catch(() => ({})) // Opcional: pode processar um alerta específico

    console.log('🔍 Iniciando verificação periódica de alertas...')

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
          id,
          razao_social,
          cnae_principal,
          cnaes_secundarios
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
        // Calcular data de início da busca (última verificação ou 7 dias atrás)
        const ultimaVerificacao = alerta.ultima_verificacao 
          ? new Date(alerta.ultima_verificacao)
          : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 dias atrás se nunca verificou

        const dataInicio = formatarDataParaQuery(ultimaVerificacao)

        console.log(`📋 Verificando alerta ${alerta.nome_alerta} desde ${dataInicio}`)

        // 3. Buscar novas licitações que correspondem aos critérios
        const novasLicitacoes = await buscarLicitacoesNovas(
          supabase,
          alerta,
          dataInicio
        )

        console.log(`✅ Encontradas ${novasLicitacoes.length} novas licitações para ${alerta.nome_alerta}`)

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
            id: usuario.id,
            razao_social: usuario.razao_social,
            cnae_principal: usuario.cnae_principal,
            cnaes_secundarios: usuario.cnaes_secundarios,
          },
          resultado: {
            total_encontradas: novasLicitacoes.length,
            periodo_verificado: {
              desde: dataInicio,
              ate: formatarDataParaQuery(new Date()),
            },
          },
          licitacoes: novasLicitacoes.map(lic => ({
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

        // 5. Enviar webhook (sempre, mesmo se não houver novas licitações)
        const webhookUrl = alerta.webhook_url || WEBHOOK_URL_DEFAULT
        
        console.log(`📤 Enviando webhook para: ${webhookUrl}`)

        const webhookResponse = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(dadosWebhook),
        })

        // 6. Atualizar última verificação
        await supabase
          .from('alertas_usuario')
          .update({ ultima_verificacao: new Date().toISOString() })
          .eq('id', alerta.id)

        resultados.push({
          alerta_id: alerta.id,
          nome_alerta: alerta.nome_alerta,
          novas_licitacoes: novasLicitacoes.length,
          webhook_enviado: webhookResponse.ok,
          status: webhookResponse.status,
        })

        console.log(`✅ Alerta ${alerta.nome_alerta} processado: ${novasLicitacoes.length} novas licitações`)

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
 * Busca novas licitações que correspondem aos critérios do alerta
 */
async function buscarLicitacoesNovas(
  supabase: any,
  alerta: any,
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

  // Aplicar filtros básicos
  if (filtros.uf) {
    query = query.eq('uf_sigla', filtros.uf)
  }

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

  const { data, error } = await query.limit(100) // Limitar a 100 resultados

  if (error) {
    console.error('Erro ao buscar licitações:', error)
    return []
  }

  // Filtrar por CNAEs se necessário (filtro mais complexo, fazer em memória)
  let licitacoes = data || []

  if (filtrosAvancados.filtros_cnaes && Object.keys(filtrosAvancados.filtros_cnaes).length > 0) {
    const cnaesFiltro = Object.keys(filtrosAvancados.filtros_cnaes)
    licitacoes = licitacoes.filter((lic: any) => {
      const cnaesLicitacao = extrairCnaesLicitacao(lic)
      return cnaesFiltro.some((cnae: string) => cnaesLicitacao.includes(cnae))
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


// ============================================
// EDGE FUNCTION: enviar-alerta-webhook
// ============================================
// Processa alertas quando uma nova licitação é inserida
// Verifica se corresponde aos critérios configurados e envia webhook

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Webhook URL padrão - pode ser sobrescrito por variável de ambiente ou por alerta específico
const WEBHOOK_URL_DEFAULT = Deno.env.get('WEBHOOK_URL_DEFAULT') || 'https://webhook.fiqon.app/webhook/019afae9-4e94-72fc-b30f-c60f686bacf5/9b0754d5-af77-4c95-b991-67d9a81fee99'

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { licitacao_id } = await req.json()

    if (!licitacao_id) {
      throw new Error('licitacao_id é obrigatório')
    }

    console.log('🔔 Processando alertas para licitação:', licitacao_id)

    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 1. Buscar dados completos da licitação
    const { data: licitacao, error: licitacaoError } = await supabase
      .from('licitacoes')
      .select('*')
      .eq('id', licitacao_id)
      .single()

    if (licitacaoError || !licitacao) {
      throw new Error(`Licitação não encontrada: ${licitacaoError?.message}`)
    }

    console.log('📋 Licitação encontrada:', licitacao.numero_controle_pncp)

    // 2. Buscar todos os alertas ativos
    const { data: alertas, error: alertasError } = await supabase
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
      .eq('frequencia', 'imediato') // Apenas alertas imediatos

    if (alertasError) {
      throw new Error(`Erro ao buscar alertas: ${alertasError.message}`)
    }

    console.log(`🔍 Encontrados ${alertas?.length || 0} alertas ativos`)

    if (!alertas || alertas.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhum alerta ativo encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // 3. Verificar cada alerta e enviar webhook se corresponder
    const alertasEnviados = []
    const alertasIgnorados = []

    for (const alerta of alertas) {
      const usuario = alerta.profiles
      if (!usuario) continue

      // Verificar se a licitação corresponde aos critérios do alerta
      const corresponde = verificarCriteriosAlerta(licitacao, alerta, usuario)

      if (corresponde) {
        try {
          // Preparar dados para o webhook
          const dadosWebhook = prepararDadosWebhook(licitacao, alerta, usuario)

          // Usar webhook_url do alerta se configurado, senão usar o padrão
          const webhookUrl = alerta.webhook_url || WEBHOOK_URL_DEFAULT
          
          console.log(`📤 Enviando webhook para: ${webhookUrl}`)

          // Enviar webhook
          const webhookResponse = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(dadosWebhook),
          })

          if (webhookResponse.ok) {
            alertasEnviados.push({
              alerta_id: alerta.id,
              usuario_id: alerta.usuario_id,
              nome_alerta: alerta.nome_alerta,
            })
            console.log(`✅ Alerta enviado: ${alerta.nome_alerta} (${alerta.usuario_id})`)
          } else {
            const errorText = await webhookResponse.text()
            console.error(`❌ Erro ao enviar webhook para alerta ${alerta.id}:`, errorText)
          }
        } catch (error) {
          console.error(`❌ Erro ao processar alerta ${alerta.id}:`, error)
        }
      } else {
        alertasIgnorados.push({
          alerta_id: alerta.id,
          motivo: 'Não corresponde aos critérios',
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        licitacao_id,
        alertas_enviados: alertasEnviados.length,
        alertas_ignorados: alertasIgnorados.length,
        detalhes: {
          enviados: alertasEnviados,
          ignorados: alertasIgnorados,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('❌ Erro ao processar alertas:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro desconhecido ao processar alertas',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

/**
 * Verifica se a licitação corresponde aos critérios do alerta
 */
function verificarCriteriosAlerta(licitacao: any, alerta: any, usuario: any): boolean {
  const filtros = alerta.filtros || {}

  // 1. Verificar UF
  if (filtros.uf && licitacao.uf_sigla !== filtros.uf) {
    return false
  }

  // 2. Verificar Modalidade
  if (filtros.modalidade && licitacao.modalidade_nome !== filtros.modalidade) {
    return false
  }

  // 3. Verificar Valor Mínimo
  if (filtros.valorMinimo) {
    const valorMin = parseFloat(filtros.valorMinimo)
    const valorLicitacao = parseFloat(licitacao.valor_total_estimado || 0)
    if (valorLicitacao < valorMin) {
      return false
    }
  }

  // 4. Verificar CNAEs (se configurado)
  if (filtros.cnaes && Array.isArray(filtros.cnaes) && filtros.cnaes.length > 0) {
    // Buscar CNAEs da licitação (pode estar em dados_complementares)
    const cnaesLicitacao = extrairCnaesLicitacao(licitacao)
    
    // Verificar se há interseção entre CNAEs do alerta e da licitação
    const temIntersecao = filtros.cnaes.some((cnae: string) => 
      cnaesLicitacao.includes(cnae)
    )

    if (!temIntersecao) {
      return false
    }
  } else {
    // Se não há filtro de CNAE específico, usar CNAEs da empresa
    const cnaesEmpresa = obterCnaesEmpresa(usuario)
    if (cnaesEmpresa.length > 0) {
      const cnaesLicitacao = extrairCnaesLicitacao(licitacao)
      const temIntersecao = cnaesEmpresa.some((cnae: string) => 
        cnaesLicitacao.includes(cnae)
      )

      if (!temIntersecao) {
        return false
      }
    }
  }

  // 5. Verificar busca por texto no objeto
  if (filtros.buscaObjeto) {
    const objetoLower = (licitacao.objeto_compra || '').toLowerCase()
    const buscaLower = filtros.buscaObjeto.toLowerCase()
    if (!objetoLower.includes(buscaLower)) {
      return false
    }
  }

  return true
}

/**
 * Extrai CNAEs da licitação (pode estar em diferentes lugares)
 */
function extrairCnaesLicitacao(licitacao: any): string[] {
  const cnaes: string[] = []

  // Tentar extrair de dados_complementares
  if (licitacao.dados_complementares) {
    const dados = typeof licitacao.dados_complementares === 'string' 
      ? JSON.parse(licitacao.dados_complementares)
      : licitacao.dados_complementares

    // CNAEs podem estar em diferentes campos dependendo da estrutura
    if (dados.cnaes) {
      cnaes.push(...(Array.isArray(dados.cnaes) ? dados.cnaes : [dados.cnaes]))
    }
  }

  return cnaes.map(c => String(c).trim()).filter(c => c)
}

/**
 * Obtém CNAEs da empresa do usuário
 */
function obterCnaesEmpresa(usuario: any): string[] {
  const cnaes: string[] = []

  if (usuario.cnae_principal) {
    cnaes.push(String(usuario.cnae_principal).trim())
  }

  if (usuario.cnaes_secundarios) {
    try {
      const secundarios = Array.isArray(usuario.cnaes_secundarios)
        ? usuario.cnaes_secundarios
        : JSON.parse(usuario.cnaes_secundarios)
      
      secundarios.forEach((cnae: any) => {
        const cnaeStr = String(cnae).trim()
        if (cnaeStr && !cnaes.includes(cnaeStr)) {
          cnaes.push(cnaeStr)
        }
      })
    } catch (e) {
      console.warn('Erro ao parsear CNAEs secundários:', e)
    }
  }

  return cnaes
}

/**
 * Prepara dados para enviar no webhook
 */
function prepararDadosWebhook(licitacao: any, alerta: any, usuario: any): any {
  return {
    tipo: 'nova_licitacao',
    timestamp: new Date().toISOString(),
    alerta: {
      id: alerta.id,
      nome: alerta.nome_alerta,
      email_notificacao: alerta.email_notificacao,
    },
    empresa: {
      id: usuario.id,
      razao_social: usuario.razao_social,
      cnae_principal: usuario.cnae_principal,
      cnaes_secundarios: usuario.cnaes_secundarios,
    },
    licitacao: {
      id: licitacao.id,
      numero_controle_pncp: licitacao.numero_controle_pncp,
      numero_compra: licitacao.numero_compra,
      ano_compra: licitacao.ano_compra,
      objeto_compra: licitacao.objeto_compra,
      informacao_complementar: licitacao.informacao_complementar,
      modalidade_nome: licitacao.modalidade_nome,
      valor_total_estimado: licitacao.valor_total_estimado,
      data_abertura_proposta: licitacao.data_abertura_proposta,
      data_encerramento_proposta: licitacao.data_encerramento_proposta,
      data_publicacao_pncp: licitacao.data_publicacao_pncp,
      orgao_razao_social: licitacao.orgao_razao_social,
      orgao_cnpj: licitacao.orgao_cnpj,
      municipio_nome: licitacao.municipio_nome,
      uf_sigla: licitacao.uf_sigla,
      link_sistema_origem: licitacao.link_sistema_origem,
      dados_complementares: licitacao.dados_complementares,
    },
  }
}


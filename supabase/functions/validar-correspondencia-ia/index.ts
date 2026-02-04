import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ItemLote {
  id: string
  objeto: string
}

interface RequestBody {
  objetoLicitacao?: string
  lotes?: ItemLote[]
  /** Atividades do cadastro (setores_atividades): setor + subsetores por setor */
  atividadesEmpresa: Array<{
    setor?: string
    subsetores?: string[]
  }>
  /** Estados de interesse do cadastro (estados_interesse). Vazio ou com "Nacional" = âmbito nacional */
  estadosInteresse?: string[]
  userId?: string
}

function buildPrompt(
  objetoLicitacao: string,
  atividadesTexto: string,
  estadosTexto: string | null
): string {
  let prompt = `Você é um especialista em licitações públicas no Brasil. Decida se esta licitação é RELEVANTE para a empresa com base APENAS no que está sendo comprado ou contratado (objeto da licitação), NÃO no nome do órgão ou da secretaria.

OBJETO DA LICITAÇÃO (o que está sendo comprado/contratado):
"""
${objetoLicitacao.substring(0, 2000)}${objetoLicitacao.length > 2000 ? '...' : ''}
"""

ATIVIDADES CADASTRADAS DA EMPRESA (setores e subsetores escolhidos no cadastro):
"""
${atividadesTexto}
"""
`
  if (estadosTexto) {
    prompt += `
ESTADOS DE INTERESSE DA EMPRESA (apenas estes estados ou âmbito nacional):
"""
${estadosTexto}
"""
- Se o objeto da licitação mencionar entrega, execução ou abrangência restrita a estado(s) que NÃO estão na lista acima, responda NÃO.
`
  }
  prompt += `
REGRAS:
- Considere SOMENTE o OBJETO da licitação (produto ou serviço que está sendo comprado). Ignore se o órgão é "Secretaria de Saúde", "Fundo de Saúde" etc.; o que importa é O QUE está sendo comprado.
- RESPONDA "SIM" só se o que está sendo comprado/contratado tem relação direta com as atividades cadastradas (ex.: empresa de medicamentos e material hospitalar → objeto sobre compra de medicamentos, material médico, equipamento hospitalar = SIM).
- RESPONDA "NÃO" se o objeto é sobre outro tipo de compra/serviço, mesmo que o órgão seja da área (ex.: empresa só de medicamentos/material hospitalar e o objeto é "revisão preventiva de veículo" ou "manutenção de frota" = NÃO; "reforma de prédio" = NÃO; "pavimentação" = NÃO).
- Manutenção de veículos, revisão de veículos, frotas, mecânica automotiva: NÃO é relevante para empresa cuja atividade é medicamentos, material médico-hospitalar, serviços médicos, etc.
- NA DÚVIDA, responda NÃO para evitar licitações fora do perfil.

Responda APENAS: SIM ou NÃO.`
  return prompt
}

async function validarUm(
  objetoLicitacao: string,
  atividadesTexto: string,
  estadosTexto: string | null,
  mistralApiKey: string
): Promise<boolean> {
  const prompt = buildPrompt(objetoLicitacao, atividadesTexto, estadosTexto)

  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${mistralApiKey}`
    },
    body: JSON.stringify({
      model: 'mistral-small-latest',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 10
    })
  })

  if (!response.ok) {
    if (response.status === 429) throw new Error('RATE_LIMIT')
    throw new Error(`Mistral ${response.status}`)
  }

  const data = await response.json()
  const resposta = data.choices[0]?.message?.content?.trim().toUpperCase() || ''
  return resposta === 'SIM' || resposta.includes('SIM')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const body: RequestBody = await req.json()
    const { objetoLicitacao, lotes, atividadesEmpresa, estadosInteresse, userId } = body

    if (!atividadesEmpresa || atividadesEmpresa.length === 0) {
      return new Response(
        JSON.stringify({ error: 'atividadesEmpresa é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const mistralApiKey = Deno.env.get('MISTRAL_API_KEY')
    if (!mistralApiKey) {
      return new Response(
        JSON.stringify({ resultado: null, mensagem: 'IA não disponível' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Atividades: exatamente o formato da coluna setores_atividades (setor + subsetores)
    const atividadesTexto = atividadesEmpresa
      .map(a => {
        const subsetores = a.subsetores && Array.isArray(a.subsetores) ? a.subsetores.join(', ') : ''
        return `${a.setor || 'Setor'}: ${subsetores || 'Sem subsetores'}`
      })
      .join('\n')

    // Estados: do cadastro (estados_interesse). Nacional ou vazio = não restringir por estado no prompt
    const temNacional = estadosInteresse && Array.isArray(estadosInteresse) &&
      estadosInteresse.some((e: string) => String(e).toUpperCase() === 'NACIONAL')
    const estadosTexto =
      estadosInteresse && Array.isArray(estadosInteresse) && estadosInteresse.length > 0 && !temNacional
        ? estadosInteresse.join(', ')
        : null

    // Modo lote (vários objetos em uma requisição)
    if (lotes && Array.isArray(lotes) && lotes.length > 0) {
      const MAX_LOTE = 20
      const slice = lotes.slice(0, MAX_LOTE)
      const resultados: Array<{ id: string; resultado: boolean }> = []

      for (const item of slice) {
        try {
          const resultado = await validarUm(item.objeto, atividadesTexto, estadosTexto, mistralApiKey)
          resultados.push({ id: item.id, resultado })
        } catch (e) {
          resultados.push({ id: item.id, resultado: false })
          if ((e as Error).message === 'RATE_LIMIT') break
        }
      }

      return new Response(
        JSON.stringify({ resultados, usadoIA: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Modo único (compatível com o que já existia)
    if (!objetoLicitacao) {
      return new Response(
        JSON.stringify({ error: 'objetoLicitacao ou lotes é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const resultado = await validarUm(objetoLicitacao, atividadesTexto, estadosTexto, mistralApiKey)
    return new Response(
      JSON.stringify({ resultado, usadoIA: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('❌ Erro na Edge Function validar-correspondencia-ia:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro interno do servidor',
        resultado: null,
        mensagem: 'Erro ao validar com IA, use filtro semântico como fallback'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})


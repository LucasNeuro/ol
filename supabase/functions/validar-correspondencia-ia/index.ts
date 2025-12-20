import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface RequestBody {
  objetoLicitacao: string
  atividadesEmpresa: Array<{
    setor?: string
    subsetores?: string[]
  }>
  userId?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    })
  }

  try {
    const body: RequestBody = await req.json()
    const { objetoLicitacao, atividadesEmpresa, userId } = body

    if (!objetoLicitacao || !atividadesEmpresa || atividadesEmpresa.length === 0) {
      return new Response(
        JSON.stringify({ error: 'objetoLicitacao e atividadesEmpresa são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Obter API key do Mistral das variáveis de ambiente
    const mistralApiKey = Deno.env.get('MISTRAL_API_KEY')
    if (!mistralApiKey) {
      console.warn('⚠️ MISTRAL_API_KEY não configurada. Retornando null para usar filtro semântico.')
      return new Response(
        JSON.stringify({ 
          resultado: null,
          mensagem: 'IA não disponível, use filtro semântico como fallback'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Preparar contexto das atividades do profile
    let atividadesTexto = ''
    if (Array.isArray(atividadesEmpresa) && atividadesEmpresa.length > 0) {
      atividadesTexto = atividadesEmpresa
        .map(a => {
          const subsetores = a.subsetores && Array.isArray(a.subsetores) 
            ? a.subsetores.join(', ') 
            : ''
          return `${a.setor || 'Setor'}: ${subsetores || 'Sem subsetores específicos'}`
        })
        .join('\n')
    } else {
      atividadesTexto = 'Nenhuma atividade cadastrada'
    }

    // Preparar prompt otimizado para Mistral
    const prompt = `Você é um assistente especializado em análise de licitações públicas no Brasil.

Analise se o objeto da licitação abaixo está relacionado às atividades da empresa listadas.

OBJETO DA LICITAÇÃO:
${objetoLicitacao.substring(0, 2000)}${objetoLicitacao.length > 2000 ? '...' : ''}

ATIVIDADES DA EMPRESA (do cadastro):
${atividadesTexto}

IMPORTANTE:
- Responda "SIM" APENAS se o objeto da licitação está diretamente relacionado às atividades cadastradas
- Responda "NÃO" se o objeto não tem relação clara com as atividades
- Seja rigoroso: evite falsos positivos
- Considere sinônimos e termos relacionados ao setor

Responda APENAS com "SIM" ou "NÃO", sem explicações.`

    // Chamar API Mistral
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mistralApiKey}`
      },
      body: JSON.stringify({
        model: 'mistral-small-latest', // Usar modelo mais recente
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1, // Baixa temperatura para respostas mais determinísticas
        max_tokens: 10 // Apenas "SIM" ou "NÃO"
      })
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Erro desconhecido')
      console.error('❌ Erro na API Mistral:', response.status, errorText)
      
      // Se for rate limit, retornar null para usar filtro semântico
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ 
            resultado: null,
            mensagem: 'Rate limit atingido, use filtro semântico como fallback'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      throw new Error(`Erro na API Mistral: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const resposta = data.choices[0]?.message?.content?.trim().toUpperCase() || ''
    const resultado = resposta === 'SIM' || resposta.includes('SIM')
    
    // Log para debug (opcional)
    console.log(`✅ [IA] Validação concluída: ${resultado ? 'SIM' : 'NÃO'}`, {
      objetoResumido: objetoLicitacao.substring(0, 100),
      atividades: atividadesEmpresa.length
    })

    return new Response(
      JSON.stringify({
        resultado,
        confianca: resultado ? 'alta' : 'baixa',
        usadoIA: true
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
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


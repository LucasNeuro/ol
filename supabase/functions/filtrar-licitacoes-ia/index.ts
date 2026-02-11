// ============================================
// EDGE FUNCTION: FILTRAR LICITAÇÕES POR IA
// ============================================
// Recebe JWT do usuário, carrega perfil (setores_atividades, estados_interesse),
// busca licitações no banco, reduz por estado + palavras do setor, valida com IA
// e retorna apenas as aprovadas. Frontend usa como fonte única quando ativo.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const LIMITE_LICITACOES_BANCO = 1500
const LIMITE_PARA_IA = 80
const DIAS_ATRAS = 7

function normalizar(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extrairPalavrasSetores(setoresAtividades: Array<{ setor?: string; subsetores?: string[] }>): string[] {
  const palavras = new Set<string>()
  for (const s of setoresAtividades || []) {
    if (s.setor) {
      normalizar(s.setor).split(/\s+/).filter(p => p.length > 3).forEach(p => palavras.add(p))
    }
    for (const sub of s.subsetores || []) {
      if (sub) normalizar(sub).split(/\s+/).filter(p => p.length > 3).forEach(p => palavras.add(p))
    }
  }
  return Array.from(palavras)
}

function obterObjeto(lic: { objeto_compra?: string; dados_completos?: { objetoCompra?: string; objeto_compra?: string } }): string {
  const dc = lic.dados_completos
  const obj = (typeof dc === 'object' && dc !== null)
    ? (dc.objetoCompra ?? dc.objeto_compra ?? '')
    : ''
  return (obj || lic.objeto_compra || '').trim()
}

function buildPrompt(
  objetoLicitacao: string,
  atividadesTexto: string,
  estadosTexto: string | null
): string {
  let prompt = `Você é um especialista em licitações públicas no Brasil. Decida se esta licitação é RELEVANTE para a empresa com base APENAS no que está sendo comprado ou contratado (objeto da licitação), NÃO no nome do órgão.

OBJETO DA LICITAÇÃO:
"""
${objetoLicitacao.substring(0, 2000)}${objetoLicitacao.length > 2000 ? '...' : ''}
"""

ATIVIDADES CADASTRADAS DA EMPRESA:
"""
${atividadesTexto}
"""
`
  if (estadosTexto) {
    prompt += `
ESTADOS DE INTERESSE: ${estadosTexto}
- Se o objeto mencionar entrega/execução restrita a estado(s) que NÃO estão na lista, responda NÃO.
`
  }
  prompt += `
REGRAS: Considere SOMENTE o OBJETO. "SIM" só se o que está sendo comprado tem relação direta com as atividades. "NÃO" para reforma, veículo, publicidade, assessoria, previdência, etc. NA DÚVIDA, NÃO.

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
      'Authorization': `Bearer ${mistralApiKey}`,
    },
    body: JSON.stringify({
      model: 'mistral-small-latest',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 10,
    }),
  })
  if (!response.ok) {
    if (response.status === 429) throw new Error('RATE_LIMIT')
    throw new Error(`Mistral ${response.status}`)
  }
  const data = await response.json()
  const resposta = data.choices?.[0]?.message?.content?.trim().toUpperCase() || ''
  return resposta === 'SIM' || resposta.includes('SIM')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const mistralApiKey = Deno.env.get('MISTRAL_API_KEY') ?? ''

  if (!supabaseUrl || !serviceKey || !anonKey) {
    return new Response(
      JSON.stringify({ error: 'Configuração Supabase ausente' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Não autorizado' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const jwt = authHeader.slice(7)
  const supabaseAuth = createClient(supabaseUrl, anonKey)
  const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(jwt)
  if (userError || !user) {
    return new Response(
      JSON.stringify({ error: 'Token inválido ou expirado' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('setores_atividades, estados_interesse')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ licitacoes: [], mensagem: 'Perfil não encontrado' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const setoresAtividades = (profile.setores_atividades as Array<{ setor?: string; subsetores?: string[] }>) || []
    const estadosInteresse = (profile.estados_interesse as string[]) || []

    if (!setoresAtividades.length) {
      return new Response(
        JSON.stringify({ licitacoes: [], mensagem: 'Nenhum setor cadastrado' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const atividadesTexto = setoresAtividades
      .map(a => {
        const sub = (a.subsetores && Array.isArray(a.subsetores)) ? a.subsetores.join(', ') : ''
        return `${a.setor || 'Setor'}: ${sub || 'Sem subsetores'}`
      })
      .join('\n')

    const temNacional = estadosInteresse.some((e: string) => String(e).toUpperCase() === 'NACIONAL')
    const estadosTexto = estadosInteresse.length > 0 && !temNacional ? estadosInteresse.join(', ') : null

    const fim = new Date()
    const inicio = new Date(fim.getTime() - DIAS_ATRAS * 24 * 60 * 60 * 1000)
    const dataInicio = inicio.toISOString().slice(0, 10)
    const dataFim = fim.toISOString().slice(0, 10)

    let query = supabase
      .from('licitacoes')
      .select('id, numero_controle_pncp, objeto_compra, data_publicacao_pncp, data_atualizacao, uf_sigla, modalidade_nome, orgao_razao_social, valor_total_estimado, dados_completos, anexos, itens')
      .gte('data_publicacao_pncp', dataInicio)
      .lte('data_publicacao_pncp', dataFim)
      .order('data_publicacao_pncp', { ascending: false })
      .limit(LIMITE_LICITACOES_BANCO)

    if (estadosTexto && !temNacional && estadosInteresse.length > 0) {
      const ufs = estadosInteresse.map((e: string) => String(e).toUpperCase().trim())
      query = query.in('uf_sigla', ufs)
    }

    const { data: licitacoesBrutas, error: licError } = await query

    if (licError) {
      console.error('Erro ao buscar licitações:', licError)
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar licitações', licitacoes: [] }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const licitacoes = licitacoesBrutas || []
    const palavrasSetor = extrairPalavrasSetores(setoresAtividades)

    const candidatas = palavrasSetor.length === 0
      ? licitacoes
      : licitacoes.filter(lic => {
          const obj = normalizar(obterObjeto(lic))
          return palavrasSetor.some(p => obj.includes(p))
        })

    const paraIA = candidatas.slice(0, LIMITE_PARA_IA)
    const aprovadas: typeof licitacoes = []

    if (mistralApiKey) {
      for (const lic of paraIA) {
        try {
          const objeto = obterObjeto(lic)
          if (!objeto) continue
          const ok = await validarUm(objeto, atividadesTexto, estadosTexto, mistralApiKey)
          if (ok) aprovadas.push(lic)
        } catch (e) {
          if ((e as Error).message === 'RATE_LIMIT') break
        }
      }
    } else {
      return new Response(
        JSON.stringify({
          licitacoes: [],
          total_candidatas: candidatas.length,
          mensagem: 'IA não configurada (MISTRAL_API_KEY). Use filtro local.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        licitacoes: aprovadas,
        total_brutas: licitacoes.length,
        total_candidatas: candidatas.length,
        total_aprovadas: aprovadas.length,
        usado_ia: true,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Erro filtrar-licitacoes-ia:', err)
    return new Response(
      JSON.stringify({ error: (err as Error).message, licitacoes: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

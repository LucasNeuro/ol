// ============================================
// EDGE FUNCTION: TAVILY SEARCH (Tool para o assistente)
// ============================================
// Pesquisa na web via Tavily API. Usada pelo chat-documento quando o usuário
// pede análise de mercado, tendências ou informações externas sobre o edital.
// Docs: https://docs.tavily.com/documentation/api-reference/endpoint/search

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const query = (body.query || body.q || '').trim()
    const maxResults = Math.min(20, Math.max(1, Number(body.max_results) || 5))
    const topic = body.topic === 'news' ? 'news' : 'general'
    const searchDepth = body.search_depth === 'advanced' ? 'advanced' : 'basic'

    if (!query) {
      return new Response(
        JSON.stringify({ success: false, error: 'Parâmetro query é obrigatório' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const rawKey = Deno.env.get('TAVILY_API_KEY')
    const apiKey = rawKey ? rawKey.trim() : ''
    if (!apiKey) {
      console.error('TAVILY_API_KEY não configurada')
      return new Response(
        JSON.stringify({
          success: false,
          error: 'TAVILY_API_KEY não configurada. Supabase → Edge Functions → Secrets → TAVILY_API_KEY (obtenha em https://app.tavily.com)',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Tavily Search API
    const tavilyRes = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey.startsWith('tvly-') ? `Bearer ${apiKey}` : `Bearer tvly-${apiKey}`,
      },
      body: JSON.stringify({
        query,
        search_depth: searchDepth,
        max_results: maxResults,
        topic,
        include_answer: false,
      }),
    })

    if (!tavilyRes.ok) {
      const errText = await tavilyRes.text()
      console.error('Tavily API error:', tavilyRes.status, errText)
      return new Response(
        JSON.stringify({
          success: false,
          error: `Tavily API: ${tavilyRes.status}`,
          details: errText.slice(0, 200),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 }
      )
    }

    const data = await tavilyRes.json()
    const results = (data.results || []).map((r: { title?: string; url?: string; content?: string }) => ({
      title: r.title || '',
      url: r.url || '',
      content: (r.content || '').slice(0, 500),
    }))

    return new Response(
      JSON.stringify({
        success: true,
        query,
        results,
        summary: results.length
          ? `Encontradas ${results.length} fontes. Use-as para enriquecer a resposta sobre análise de mercado ou contexto externo.`
          : 'Nenhum resultado encontrado para essa busca.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('tavily-search error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Erro ao executar pesquisa',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

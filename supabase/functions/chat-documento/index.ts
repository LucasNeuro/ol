import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// TESTE: chave no código para validar 401. REMOVA após o teste e use só o Secret (fallback abaixo).
const TEST_MISTRAL_API_KEY = 'PJ0ycgJfwpx7hoyzjLohMoMkCTSusHtp'

serve(async (req) => {
 
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { 
      pergunta, 
      documentoUrl, 
      documentoId,
      dadosEmpresa = null,
      historico = [] 
    } = await req.json()

    if (!pergunta || !documentoUrl) {
      throw new Error('Parâmetros obrigatórios: pergunta, documentoUrl')
    }

    // Validar URL do documento
    try {
      new URL(documentoUrl)
    } catch {
      throw new Error('URL do documento inválida')
    }

    const MAX_HISTORICO = 6
    console.log('💬 Nova pergunta:', pergunta)
    console.log('📄 Documento URL:', documentoUrl)
    console.log('🏢 Dados empresa:', dadosEmpresa ? 'Sim' : 'Não')
    console.log('📚 Histórico (total/limitado):', historico?.length ?? 0, '/', Math.min(MAX_HISTORICO, historico?.length ?? 0), 'mensagens')

    // Verificar se a URL é acessível (opcional, mas recomendado)
    // O Document QnA do Mistral precisa de URL pública e acessível
    if (!documentoUrl.startsWith('http://') && !documentoUrl.startsWith('https://')) {
      console.warn('⚠️ URL do documento não parece ser uma URL HTTP válida')
    }

    // Chave: 1) teste no código (TEST_MISTRAL_API_KEY), 2) fallback = Secret MISTRAL_API_KEY
    let rawKey = Deno.env.get('MISTRAL_API_KEY')
    if (rawKey && typeof rawKey === 'string') {
      rawKey = rawKey
        .replace(/\r?\n|\r/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^["']|["']$/g, '')
      if (rawKey.toLowerCase().startsWith('bearer ')) rawKey = rawKey.slice(7).trim()
      rawKey = rawKey.replace(/[\x00-\x1F\x7F]/g, '')
    }
    const mistralApiKey = (TEST_MISTRAL_API_KEY && TEST_MISTRAL_API_KEY.trim()) || rawKey || ''
    const usandoChaveTeste = !!(TEST_MISTRAL_API_KEY && TEST_MISTRAL_API_KEY.trim())
    const prefix = mistralApiKey.length >= 2 ? mistralApiKey.slice(0, 2) + '...' : '(vazia)'
    console.log('MISTRAL_API_KEY:', usandoChaveTeste ? 'chave de teste (código)' : 'Secret', 'comprimento:', mistralApiKey.length, 'prefixo:', prefix)

    if (!mistralApiKey) {
      throw new Error('MISTRAL_API_KEY não encontrada. Supabase → Edge Functions → Secrets → adicione MISTRAL_API_KEY e faça redeploy da função chat-documento.')
    }


    // Preparar contexto da empresa para o system prompt
    let contextoEmpresa = ''
    if (dadosEmpresa) {
      const empresaInfo = []
      
      if (dadosEmpresa.razao_social) empresaInfo.push(`Razão Social: ${dadosEmpresa.razao_social}`)
      if (dadosEmpresa.nome_fantasia) empresaInfo.push(`Nome Fantasia: ${dadosEmpresa.nome_fantasia}`)
      if (dadosEmpresa.cnpj) empresaInfo.push(`CNPJ: ${dadosEmpresa.cnpj}`)
      if (dadosEmpresa.uf) empresaInfo.push(`Estado: ${dadosEmpresa.uf}`)
      if (dadosEmpresa.municipio) empresaInfo.push(`Município: ${dadosEmpresa.municipio}`)
      if (dadosEmpresa.cnae_principal) empresaInfo.push(`CNAE Principal: ${dadosEmpresa.cnae_principal}`)
      if (dadosEmpresa.porte_empresa) empresaInfo.push(`Porte: ${dadosEmpresa.porte_empresa}`)
      if (dadosEmpresa.natureza_juridica) empresaInfo.push(`Natureza Jurídica: ${dadosEmpresa.natureza_juridica}`)
      if (dadosEmpresa.capital_social) empresaInfo.push(`Capital Social: R$ ${dadosEmpresa.capital_social.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)
      if (dadosEmpresa.setores_atividades && Array.isArray(dadosEmpresa.setores_atividades) && dadosEmpresa.setores_atividades.length > 0) {
        empresaInfo.push(`Setores de Atividade: ${dadosEmpresa.setores_atividades.join(', ')}`)
      }
      if (dadosEmpresa.estados_interesse && Array.isArray(dadosEmpresa.estados_interesse) && dadosEmpresa.estados_interesse.length > 0) {
        empresaInfo.push(`Estados de Interesse: ${dadosEmpresa.estados_interesse.join(', ')}`)
      }
      
      if (empresaInfo.length > 0) {
        contextoEmpresa = `\n\nDADOS DA EMPRESA DO USUÁRIO:\n${empresaInfo.join('\n')}\n\nUse essas informações para dar respostas mais precisas sobre a participação da empresa nesta licitação. Considere o porte da empresa, localização, setores de atividade e outros dados relevantes ao analisar a viabilidade de participação.`
      }
    }

    // Limitar histórico para evitar estouro de contexto (128k) e lentidão
    const historicoLimitado = Array.isArray(historico) ? historico.slice(-MAX_HISTORICO) : []

    // Preparar mensagens: documento só na mensagem ATUAL (evita N cópias do PDF = menos tokens e mais rápido)
    const systemPrompt = `# Identidade
Você é o Assistente do Sistema Licitação: especialista em licitações públicas brasileiras (Lei 14.133/2021, Pregão, RDC, etc.). Sua única fonte de verdade nesta conversa é o documento PDF anexado na última mensagem (acessado via Document QnA). Responda sempre com base nele e mantenha coerência com o histórico.

# Skills (competências obrigatórias)
- **Análise de edital**: extrair e citar objeto, órgão, valor estimado, datas, modalidade, tipo de licitação, requisitos de habilitação e de proposta.
- **Citação com origem**: toda informação deve ser atribuível ao documento (ex.: "Conforme o edital, na seção X...", "O valor estimado consta como R$ ...").
- **Requisitos técnicos e jurídicos**: identificar e explicar exigências de qualificação técnica, econômico-financeira, certidões e cláusulas relevantes.
- **Comparação empresa × edital**: quando houver dados da empresa do usuário, use-os para avaliar aderência (setor, CNAE, porte, UF) sem inventar requisitos do documento.
- **Honestidade de cobertura**: se a informação não existir no documento, responda de forma explícita: "Não encontrei essa informação no documento" ou "O documento não detalha esse ponto".
- **Nunca alucinar**: proibir-se de inventar valores, datas, artigos, páginas ou requisitos que não estejam no PDF.

# Regras rígidas
1. Responda SOMENTE com base no conteúdo do PDF anexado e no histórico da conversa.
2. Cite o documento de forma específica (seção, página, valor, data) quando possível.
3. Não invente nem deduza informações que o documento não explicita.
4. Em perguntas sobre "minha empresa pode participar?", use os dados da empresa apenas para contextualizar; os requisitos devem vir exclusivamente do edital.
5. Respostas objetivas: 1 a 3 parágrafos, em português (PT-BR), tom profissional e cordial.

# Formato de saída
- Idioma: português (PT-BR).
- Tom: cordial e profissional.
- Tamanho: direto ao ponto (evitar textos longos sem necessidade).
- Valores: use o formato do documento ou R$ X.XXX,XX quando aplicável.${contextoEmpresa}

# Nota técnica
O PDF está anexado apenas na última mensagem do usuário. Use-o para responder à pergunta atual; o histórico contém apenas texto (sem novo anexo).`

    const messages = [
      {
        role: "system",
        content: systemPrompt,
      },
      // Histórico só como texto (sem document_url) para não repetir o PDF e estourar contexto
      ...historicoLimitado.map((msg: any) => ({
        role: msg.role,
        content: Array.isArray(msg.content) ? (msg.content.find((c: any) => c.type === 'text')?.text ?? msg.content) : msg.content
      })),
      // Documento apenas na mensagem atual: uma única cópia processada pela API
      {
        role: "user",
        content: [
          { type: "text", text: pergunta },
          { type: "document_url", document_url: documentoUrl }
        ]
      }
    ]

    // Apenas Document QnA: uma única chamada à Mistral, sem tools/chamadas externas (mais rápido, sem CORS extra)
    const MISTRAL_TIMEOUT_MS = 120000 // 120 segundos
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), MISTRAL_TIMEOUT_MS)

    console.log('📤 Enviando para Mistral API (Document QnA apenas)...')

    const mistralResponse = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${mistralApiKey}` },
      body: JSON.stringify({
        model: 'mistral-medium-latest', // mais rápido que large; use mistral-small-latest se quiser ainda mais velocidade
        messages,
        temperature: 0.5,
        max_tokens: 2000,
      }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!mistralResponse.ok) {
      const errorText = await mistralResponse.text()
      if (mistralResponse.status === 401) {
        // Log da resposta da Mistral para diagnóstico (ex.: billing, key invalid)
        console.error('Mistral 401 resposta:', errorText)
        // Passos oficiais Mistral Quickstart: billing em admin.mistral.ai; API keys em console.mistral.ai
        throw new Error(
          'Chave da Mistral rejeitada (401). Siga a documentação oficial: 1) Ative o Billing: acesse https://admin.mistral.ai → Organization → Billing, adicione forma de pagamento e escolha um plano (Experiment ou Scale). ' +
          '2) Crie a chave em https://console.mistral.ai → API Keys (no seu Workspace) → Create new key; copie e guarde (só aparece uma vez). ' +
          '3) Chave nova pode levar alguns minutos para ativar. ' +
          '4) No Supabase: Edge Functions → Secrets → MISTRAL_API_KEY = valor da chave (sem aspas, sem "Bearer"). Depois: supabase functions deploy chat-documento'
        )
      }
      throw new Error(`Erro Mistral API: ${mistralResponse.status} - ${errorText}`)
    }

    const mistralData = await mistralResponse.json()
    const resposta = mistralData?.choices?.[0]?.message?.content?.trim()
    if (!resposta) {
      throw new Error('Resposta vazia da API Mistral. Tente reformular a pergunta.')
    }

    console.log('✅ Resposta recebida:', resposta.substring(0, 100) + '...')
    const usage = mistralData?.usage || {}
    console.log('📊 Tokens usados:', { prompt: usage.prompt_tokens || 0, completion: usage.completion_tokens || 0, total: usage.total_tokens || 0 })

    // Registrar acesso ao documento (se documentoId fornecido)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (documentoId && supabaseUrl && serviceKey) {
      const supabase = createClient(supabaseUrl, serviceKey)

      await supabase.rpc('registrar_acesso_documento', { doc_id: documentoId })
    }

    // 5. Salvar histórico de conversa (opcional)
    // TODO: Implementar salvamento do histórico

    // 6. Retornar resposta
    return new Response(
      JSON.stringify({
        success: true,
        resposta: resposta,
        tokens: {
          prompt: usage.prompt_tokens ?? 0,
          completion: usage.completion_tokens ?? 0,
          total: usage.total_tokens ?? 0
        },
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('❌ Erro ao processar chat:', error)
    let mensagem = error?.message || 'Erro desconhecido ao processar chat'
    if (error?.name === 'AbortError' || mensagem.includes('signal has been aborted')) {
      mensagem = 'A resposta está demorando mais que o limite (timeout). O documento pode ser grande ou o modelo está sob carga. Tente uma pergunta mais objetiva ou aguarde e tente novamente.'
    }
    return new Response(
      JSON.stringify({
        success: false,
        error: mensagem
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})


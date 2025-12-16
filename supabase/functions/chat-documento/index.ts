

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
 
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { 
      pergunta, 
      documentoUrl, 
      documentoId,
      historico = [] 
    } = await req.json()

    if (!pergunta || !documentoUrl) {
      throw new Error('Parâmetros obrigatórios: pergunta, documentoUrl')
    }

    console.log('💬 Nova pergunta:', pergunta)
    console.log('📄 Documento:', documentoUrl)

   
    const mistralApiKey = Deno.env.get('MISTRAL_API_KEY')
    
    if (!mistralApiKey) {
      throw new Error('MISTRAL_API_KEY não configurada')
    }


    // Preparar mensagens com system prompt em português - Assistente Conversacional Especializado
    const messages = [
      {
        role: "system",
        content: `Você é o "Assistente Sistema Licitação", um especialista em licitações públicas brasileiras. Você tem acesso COMPLETO ao conteúdo do documento PDF do edital e pode conversar LITERALMENTE sobre qualquer parte dele.

SUA FUNÇÃO:
- Você pode ler, analisar e responder perguntas sobre QUALQUER parte do documento PDF fornecido
- Você tem acesso ao texto completo do documento através do Document QnA da Mistral
- Responda como se você tivesse lido o documento inteiro e pudesse citar informações específicas

ESTILO DE RESPOSTA:
- Sempre responda em português (PT-BR), com tom cordial, natural e conversacional
- Responda em 1-2 parágrafos curtos, direto ao ponto
- Evite títulos, listas numeradas e markdown; use texto corrido e natural
- Cite informações específicas do documento quando relevante (ex: "Segundo o edital, na página X...")
- Se não encontrar algo no documento, seja honesto e diga que não encontrou essa informação específica
- Para perguntas gerais sobre licitações, explique com precisão e linguagem acessível
- Seja útil, prestativo e sempre convide para mais perguntas

IMPORTANTE:
- Você está conversando LITERALMENTE com o documento - use o Document QnA para buscar informações precisas
- Nunca invente informações que não estão no documento
- Se a pergunta for sobre algo que não está no documento, diga claramente
- Nunca responda em inglês`
      },
      ...historico.map((msg: any) => ({
        role: msg.role,
        content: msg.content
      })),
      {
        role: "user",
        content: [
          {
            type: "text",
            text: pergunta
          },
          {
            type: "document_url",
            document_url: documentoUrl
          }
        ]
      }
    ]

    console.log('📤 Enviando para Mistral API...')

    // 3. Chamar Mistral API com timeout e retry
    let mistralResponse
    let retries = 2
    let lastError
    
    while (retries > 0) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 60000) // 60s timeout
        
        mistralResponse = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${mistralApiKey}`
          },
          body: JSON.stringify({
            model: 'mistral-small-latest',
            messages: messages,
            temperature: 0.5,
            max_tokens: 2000 // Aumentado para respostas mais completas
          }),
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        if (mistralResponse.ok) {
          break
        } else if (mistralResponse.status >= 500 && retries > 1) {
          retries--
          await new Promise(resolve => setTimeout(resolve, 3000))
          continue
        } else {
          const errorText = await mistralResponse.text()
          throw new Error(`Erro Mistral API: ${mistralResponse.status} - ${errorText}`)
        }
      } catch (error) {
        lastError = error
        if (error.name === 'AbortError') {
          throw new Error('Timeout ao processar pergunta (60s)')
        }
        retries--
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 3000))
        }
      }
    }
    
    if (!mistralResponse || !mistralResponse.ok) {
      const errorText = lastError?.message || 'Erro desconhecido'
      throw new Error(errorText)
    }

    if (!mistralResponse.ok) {
      const errorText = await mistralResponse.text()
      console.error('❌ Erro Mistral API:', errorText)
      throw new Error(`Erro Mistral API: ${mistralResponse.status} - ${errorText}`)
    }

    const mistralData = await mistralResponse.json()
    const resposta = mistralData.choices[0].message.content

    console.log('✅ Resposta recebida:', resposta.substring(0, 100) + '...')

    // 4. Registrar acesso ao documento (se documentoId fornecido)
    if (documentoId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseServiceKey)

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
          prompt: mistralData.usage.prompt_tokens,
          completion: mistralData.usage.completion_tokens,
          total: mistralData.usage.total_tokens
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
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro desconhecido ao processar chat'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})




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


    const messages = [
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

    // 3. Chamar Mistral API
    const mistralResponse = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mistralApiKey}`
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: messages,
        temperature: 0.3, // Menor temperatura = mais preciso
        max_tokens: 1000
      })
    })

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


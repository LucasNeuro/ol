// ============================================
// EDGE FUNCTION: ENVIAR FEEDBACK
// ============================================
// Envia feedback do usuário para webhook do Make.com

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    })
  }

  try {
    // Parse do body
    let body
    try {
      body = await req.json()
    } catch (parseError) {
      console.error('❌ Erro ao fazer parse do JSON:', parseError)
      return new Response(
        JSON.stringify({ error: 'Body inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { email, mensagem, usuario } = body

    if (!email || !mensagem) {
      return new Response(
        JSON.stringify({ error: 'Email e mensagem são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('📝 [Feedback] Recebido feedback:', { email, usuario, mensagemLength: mensagem.length })

    // URL do webhook do Make.com
    // Pode ser configurado via variável de ambiente ou usar o valor padrão
    const webhookUrl = Deno.env.get('WEBHOOK_URL_OPINION') || 
                       'https://hook.us2.make.com/lrbhqdmmg1x2ak6tzz7t2mswh0pagtd'

    if (!webhookUrl) {
      return new Response(
        JSON.stringify({ error: 'Webhook URL não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('📤 [Feedback] Enviando para webhook:', webhookUrl)

    // Enviar para o webhook do Make.com
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        mensagem,
        usuario: usuario || 'Usuário não identificado',
        data: new Date().toISOString(),
        origem: 'Sistema Licitação',
      }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Erro desconhecido')
      console.error('❌ [Feedback] Erro ao enviar para webhook:', response.status, errorText)
      return new Response(
        JSON.stringify({ error: `Erro ao enviar feedback: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const responseData = await response.text().catch(() => 'OK')

    console.log('✅ [Feedback] Feedback enviado com sucesso')

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Feedback enviado com sucesso',
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
    console.error('❌ [Feedback] Erro ao processar feedback:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})


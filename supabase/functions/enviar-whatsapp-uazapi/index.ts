  // ============================================
  // EDGE FUNCTION: ENVIAR WHATSAPP VIA UAZAPI
  // ============================================
  // Recebe o payload da licitação + telefone e envia mensagem de texto
  // para o WhatsApp usando a API UAZAPI (token em variável de ambiente).
  // Inclui rate limiting para prevenir abuso.

  import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
  import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  const UAZAPI_BASE = Deno.env.get('UAZAPI_BASE_URL') || 'https://atendemais.uazapi.com'
  const LIMITE_POR_HORA = 10
  const LIMITE_POR_DIA = 50

  function formatarData (valor: string | null): string {
    if (!valor) return 'Não informado'
    try {
      const d = new Date(valor)
      if (isNaN(d.getTime())) return valor
      return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    } catch {
      return valor
    }
  }

  function montarTexto (body: Record<string, unknown>): string {
    const objeto = (body.objeto_licitacao ?? body.objeto ?? 'Não informado') as string
    const orgao = (body.orgao ?? 'Não informado') as string
    const modalidade = (body.modalidade ?? 'Não informado') as string
    const valor = (body.valor_total_formatado ?? body.valor_total ?? 'Não informado') as string
    const uf = (body.uf ?? '') as string
    const pub = formatarData((body.data_publicacao ?? null) as string | null)
    const abertura = formatarData((body.data_abertura ?? null) as string | null)
    const encerramento = formatarData((body.data_encerramento ?? null) as string | null)
    let text = `📋 *Licitação*\n\n*Objeto:* ${objeto}\n*Órgão:* ${orgao}\n*Modalidade:* ${modalidade}\n*Valor:* ${valor}\n*UF:* ${uf || '—'}\n*Publicação:* ${pub}\n*Abertura:* ${abertura}\n*Encerramento:* ${encerramento}`
    return text
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

    try {
      let body: Record<string, unknown>
      try {
        body = await req.json()
      } catch {
        return new Response(
          JSON.stringify({ error: 'Body inválido (JSON esperado)' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const telefone = (body.telefone ?? body.number) as string
      if (!telefone || !String(telefone).replace(/\D/g, '').match(/^\d{10,15}$/)) {
        return new Response(
          JSON.stringify({ error: 'Campo telefone obrigatório (ex: 5511999999999)' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const uazapiToken = Deno.env.get('UAZAPI_TOKEN') ?? Deno.env.get('UAZAPI_BEARER_TOKEN')
      if (!uazapiToken) {
        console.error('❌ [WhatsApp UAZAPI] UAZAPI_TOKEN ou UAZAPI_BEARER_TOKEN não configurado')
        return new Response(
          JSON.stringify({ error: 'Serviço WhatsApp não configurado' }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Rate limiting: verificar se usuário não excedeu limite
      const authHeader = req.headers.get('Authorization')
      if (authHeader) {
        try {
          const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
          const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
          
          if (supabaseUrl && supabaseKey) {
            const supabase = createClient(supabaseUrl, supabaseKey, {
              global: { headers: { Authorization: authHeader } }
            })

            const { data: { user } } = await supabase.auth.getUser()
            
            if (user) {
              const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
              const { data: envios, error: rateError } = await supabase
                .from('whatsapp_rate_limit')
                .select('id')
                .eq('user_id', user.id)
                .eq('status', 'success')
                .gte('timestamp', oneHourAgo)

              if (!rateError && envios && envios.length >= LIMITE_POR_HORA) {
                console.warn(`⚠️ [WhatsApp UAZAPI] Rate limit atingido para usuário ${user.id}`)
                return new Response(
                  JSON.stringify({ error: `Limite de ${LIMITE_POR_HORA} envios por hora atingido` }),
                  { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
              }
            }
          }
        } catch (rateLimitError) {
          console.error('⚠️ [WhatsApp UAZAPI] Erro ao verificar rate limit:', rateLimitError)
          // Continuar mesmo se rate limit check falhar (não bloquear envio)
        }
      }

      // Preparar dados para UAZAPI
      const number = String(telefone).replace(/\D/g, '')
      const finalNumber = number.startsWith('55') ? number : `55${number}`
      const text = montarTexto(body)

      // Usar mensagem interativa de BOTÕES (type: button) para SIM / NÃO sobre o edital
      const url = `${UAZAPI_BASE.replace(/\/$/, '')}/send/menu`
      // UAZAPI: header 'token' com token da instância; opcional 'instance' com ID
      const tokenValue = uazapiToken.replace(/^Bearer\s+/i, '').trim()
      const instanceId = Deno.env.get('UAZAPI_INSTANCE_ID')?.trim()

      // Debug: logar primeiros/últimos chars do token (não logar completo)
      console.log(`🔑 [WhatsApp UAZAPI] Token length: ${tokenValue.length}, starts: ${tokenValue.substring(0, 4)}, ends: ${tokenValue.substring(tokenValue.length - 4)}`)
      console.log(`📞 [WhatsApp UAZAPI] Enviando para: ${finalNumber}`)
      console.log(`🌐 [WhatsApp UAZAPI] URL: ${url}`)

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'token': tokenValue,
      }
      if (instanceId) {
        headers['instance'] = instanceId
        console.log(`🆔 [WhatsApp UAZAPI] Instance ID: ${instanceId}`)
      }

      // Botões de resposta rápida: o id é o texto que chega como resposta
      // Usamos track_id para amarrar a resposta ao número de controle da licitação
      const trackId =
        (body.numero_controle as string | undefined) ||
        (body.numero_controle_pncp as string | undefined) ||
        ''

      const menuPayload = {
        number: finalNumber,
        type: 'button',
        text,
        choices: [
          'Sim, tenho interesse neste edital|sim_interesse',
          'Não tenho interesse neste edital|nao_interesse',
        ],
        footerText: 'Toque em uma das opções abaixo para responder.',
         // Campos de rastreamento da UAZAPI – importantes para o webhook
        track_source: 'sistema-licitacao',
        track_id: trackId,
        async: true,
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(menuPayload),
      })

      const responseText = await response.text().catch(() => '')
      if (!response.ok) {
        console.error('❌ [WhatsApp UAZAPI]', response.status, responseText)
        let errMessage = `UAZAPI retornou ${response.status}`
        try {
          const data = JSON.parse(responseText)
          if (data?.message) errMessage = data.message
        } catch {
          if (responseText) errMessage = responseText.slice(0, 200)
        }
        return new Response(
          JSON.stringify({ error: errMessage }),
          { status: response.status >= 500 ? 502 : response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      let result: unknown = { ok: true }
      try {
        result = responseText ? JSON.parse(responseText) : result
      } catch {
        // ignore
      }

      // Gravar (número, track_id) para o webhook poder enviar documentos quando o usuário clicar em "Sim"
      if (trackId) {
        try {
          const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
          const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
          if (supabaseUrl && serviceKey) {
            const supabaseAdmin = createClient(supabaseUrl, serviceKey)
            await supabaseAdmin.from('whatsapp_ultima_licitacao').insert({
              numero_telefone: finalNumber,
              track_id: trackId,
            })
            console.log('📌 [WhatsApp UAZAPI] Registrado whatsapp_ultima_licitacao para fallback do webhook')
          }
        } catch (e) {
          console.warn('⚠️ [WhatsApp UAZAPI] Não foi possível gravar whatsapp_ultima_licitacao:', e)
        }
      }

      return new Response(
        JSON.stringify({ success: true, data: result }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } catch (err) {
      console.error('❌ [WhatsApp UAZAPI]', err)
      return new Response(
        JSON.stringify({ error: err instanceof Error ? err.message : 'Erro ao enviar mensagem' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  })
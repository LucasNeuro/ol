// ============================================
// EDGE FUNCTION: WEBHOOK WHATSAPP (GLOBAL)
// ============================================
// Processa webhooks do UAZAPI quando usuário interage com mensagens
// (cliques em botões, respostas, etc.).
//
// Agora também:
// - Detecta clique no botão "Sim, tenho interesse neste edital" (id: sim_interesse)
// - Usa o track_id (nº de controle da licitação) para buscar documentos no Supabase
// - Envia um carrossel de PDFs do edital via /send/carousel

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const UAZAPI_BASE = Deno.env.get('UAZAPI_BASE_URL') || 'https://atendemais.uazapi.com'

// Imagem padrão para os cartões do carrossel de documentos
const DEFAULT_DOC_IMAGE =
  Deno.env.get('UAZAPI_DOC_IMAGE_URL') ||
  'https://via.placeholder.com/400x200.png?text=Documento+do+Edital'

interface Documento {
  urlDocumento: string
  nomeArquivo: string
}

// ============================================
// HELPER: Enviar mensagem de texto simples
// ============================================
async function enviarTexto(number: string, text: string, token: string, instanceId?: string) {
  const url = `${UAZAPI_BASE.replace(/\/$/, '')}/send/text`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'token': token,
  }
  if (instanceId) headers['instance'] = instanceId

  await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ number, text }),
  })
}

// ============================================
// HELPER: Mostrar "digitando..." para o usuário (feedback visual)
// UAZAPI: /send/chatstate com state "composing" (ou "typing" conforme a API)
// ============================================
async function enviarEstadoDigitando(number: string, token: string, instanceId?: string) {
  const base = UAZAPI_BASE.replace(/\/$/, '')
  const url = Deno.env.get('UAZAPI_CHATSTATE_URL') || `${base}/send/chatstate`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'token': token,
  }
  if (instanceId) headers['instance'] = instanceId
  const state = Deno.env.get('UAZAPI_CHATSTATE_STATE') || 'composing'
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ number, state }),
    })
    if (!res.ok) {
      console.warn('[Webhook] chatstate não disponível ou falhou:', res.status, await res.text().catch(() => ''))
    }
  } catch (e) {
    console.warn('[Webhook] Erro ao enviar estado digitando:', e)
  }
}

// ============================================
// HELPER: Enviar documento (PDF) simples (/send/media)
// (mantido para usos futuros, se precisar)
// ============================================
async function enviarDocumento(
  number: string,
  fileUrl: string,
  docName: string,
  text: string,
  token: string,
  instanceId?: string
) {
  const url = `${UAZAPI_BASE.replace(/\/$/, '')}/send/media`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'token': token,
  }
  if (instanceId) headers['instance'] = instanceId

  await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      number,
      type: 'document',
      file: fileUrl,
      docName,
      text,
    }),
  })
}

// ============================================
// HELPER: Enviar CARROSSEL de documentos do edital
// ============================================
async function enviarCarrosselDocumentos(
  number: string,
  trackId: string,
  supabase: any,
  token: string,
  instanceId?: string
) {
  try {
    console.log('📄 [Webhook] Montando carrossel de documentos para trackId:', trackId)

    // Buscar licitação pelo número de controle (trackId)
    const { data: licitacoes, error: errorLicitacao } = await supabase
      .from('licitacoes')
      .select('id, numero_controle_pncp, anexos, dados_completos')
      .eq('numero_controle_pncp', trackId)
      .limit(1)

    if (errorLicitacao || !licitacoes || licitacoes.length === 0) {
      console.error('❌ [Webhook] Licitação não encontrada para track_id:', trackId, errorLicitacao)
      await enviarTexto(
        number,
        '⚠️ Não consegui localizar os documentos deste edital. Tente novamente mais tarde ou acesse diretamente pelo PNCP.',
        token,
        instanceId
      )
      return
    }

    const licitacao = licitacoes[0]
    console.log('✅ [Webhook] Licitação encontrada:', licitacao.numero_controle_pncp)

    const documentos: Documento[] = []

    // 1. Documentos da tabela licitacao_documentos
    const { data: docsDb, error: errorDocs } = await supabase
      .from('licitacao_documentos')
      .select('url_documento, nome_arquivo')
      .eq('licitacao_id', licitacao.id)

    if (!errorDocs && docsDb && docsDb.length > 0) {
      docsDb.forEach((doc: any) => {
        if (doc.url_documento) {
          documentos.push({
            urlDocumento: doc.url_documento,
            nomeArquivo: doc.nome_arquivo || 'Documento.pdf',
          })
        }
      })
      console.log(`📄 ${docsDb.length} documentos encontrados na tabela licitacao_documentos`)
    }

    // 2. Anexos no campo anexos
    if (licitacao.anexos && Array.isArray(licitacao.anexos)) {
      licitacao.anexos.forEach((anexo: any) => {
        const url = anexo.url || anexo.urlDocumento || anexo.linkDocumento || anexo.link
        const nome = anexo.nomeArquivo || anexo.nome || anexo.nomeDocumento || anexo.tipoDocumentoNome
        if (url && !documentos.some(d => d.urlDocumento === url)) {
          documentos.push({
            urlDocumento: url,
            nomeArquivo: nome || 'Documento.pdf',
          })
        }
      })
      console.log(`📎 ${licitacao.anexos.length} anexos encontrados em licitacao.anexos`)
    }

    // 3. Documentos em dados_completos (anexos + documentos)
    if (licitacao.dados_completos) {
      let dadosCompletos = licitacao.dados_completos
      if (typeof dadosCompletos === 'string') {
        try {
          dadosCompletos = JSON.parse(dadosCompletos)
        } catch (e) {
          console.warn('⚠️ [Webhook] Erro ao parsear dados_completos:', e)
        }
      }

      if (dadosCompletos.anexos && Array.isArray(dadosCompletos.anexos)) {
        dadosCompletos.anexos.forEach((anexo: any) => {
          const url = anexo.url || anexo.urlDocumento || anexo.linkDocumento || anexo.link
          const nome = anexo.nomeArquivo || anexo.nome || anexo.nomeDocumento
          if (url && !documentos.some(d => d.urlDocumento === url)) {
            documentos.push({
              urlDocumento: url,
              nomeArquivo: nome || 'Documento.pdf',
            })
          }
        })
        console.log(`📦 ${dadosCompletos.anexos.length} anexos encontrados em dados_completos.anexos`)
      }

      if (dadosCompletos.documentos && Array.isArray(dadosCompletos.documentos)) {
        dadosCompletos.documentos.forEach((doc: any) => {
          const url = doc.url || doc.urlDocumento || doc.linkDocumento || doc.link
          const nome = doc.nomeArquivo || doc.nome || doc.nomeDocumento
          if (url && !documentos.some(d => d.urlDocumento === url)) {
            documentos.push({
              urlDocumento: url,
              nomeArquivo: nome || 'Documento.pdf',
            })
          }
        })
        console.log(`📄 ${dadosCompletos.documentos.length} documentos encontrados em dados_completos.documentos`)
      }
    }

    if (documentos.length === 0) {
      console.warn('⚠️ [Webhook] Nenhum documento encontrado para esta licitação')
      await enviarTexto(
        number,
        '⚠️ Não encontrei documentos cadastrados para este edital.',
        token,
        instanceId
      )
      return
    }

    console.log(`📦 [Webhook] Total de ${documentos.length} documentos únicos encontrados`)

    const docsParaMostrar = documentos.slice(0, 5) // limitar a 5 para não ficar pesado

    const carousel = docsParaMostrar.map((doc) => ({
      text: `${doc.nomeArquivo}\nClique para abrir o PDF`,
      image: DEFAULT_DOC_IMAGE,
      buttons: [
        {
          id: doc.urlDocumento,
          text: 'Abrir PDF',
          type: 'URL' as const,
        },
      ],
    }))

    const urlCarousel = `${UAZAPI_BASE.replace(/\/$/, '')}/send/carousel`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'token': token,
    }
    if (instanceId) headers['instance'] = instanceId

    const payload = {
      number,
      text: '📄 Documentos deste edital (clique para abrir):',
      carousel,
      async: true,
    }

    console.log('📤 [Webhook] Enviando carrossel de documentos para:', number)

    const response = await fetch(urlCarousel, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })

    const responseText = await response.text().catch(() => '')
    if (!response.ok) {
      console.error('❌ [Webhook] Erro ao enviar carrossel:', response.status, responseText)
      await enviarTexto(
        number,
        '❌ Ocorreu um erro ao enviar os documentos. Tente novamente mais tarde.',
        token,
        instanceId
      )
      return
    }

    console.log('✅ [Webhook] Carrossel enviado com sucesso:', responseText)
  } catch (err) {
    console.error('❌ [Webhook] Erro ao montar/enviar carrossel:', err)
  }
}

// Normaliza número para comparação (55...)
function normalizarNumero(num: string): string {
  const digits = String(num).replace(/\D/g, '')
  return digits.startsWith('55') ? digits : `55${digits}`
}

// Reconhece "Sim, tenho interesse" pelo texto da mensagem (quando UAZAPI envia como mensagem, não como buttonId)
function ehSimInteresse(texto: string): boolean {
  if (!texto || typeof texto !== 'string') return false
  const t = texto.trim().toLowerCase()
  return t === 'sim_interesse' || t.includes('sim, tenho interesse neste edital')
}

// ============================================
// PROCESSAR CLIQUE EM BOTÃO (ou mensagem de texto que é resposta do botão)
// ============================================
async function processarClique(webhook: Record<string, any>, supabase: any, ehEventoMessages = false) {
  try {
    const mensagem = webhook.mensagem || webhook.message || webhook.data?.message || webhook.data || {}
    // UAZAPI pode enviar chat.id (ex: "5511999999999@c.us"), message.from, chat.lead_phone, chatId, sender
    const chat = webhook.chat || webhook.data?.chat || {}
    const fromRaw = (webhook.from || webhook.chatId || webhook.sender || webhook.participant ||
      mensagem.from || webhook.data?.from || webhook.contactId || mensagem.senderId ||
      chat.lead_phone || chat.phone || chat.id || '') as string
    let from = fromRaw ? String(fromRaw).replace(/@c\.us$|@s\.whatsapp\.net$/i, '').trim() : ''
    // Se chat.id for id interno (ex: "r56e6fa77a1bf2c"), não usar como número
    if (from && /^[a-z0-9]{10,}$/i.test(from) && !/^\d+$/.test(from)) {
      from = (chat.lead_phone || chat.phone || webhook.from || mensagem.from || '') as string
    }
    const numeroNorm = from ? normalizarNumero(from) : ''

    // Fallback para EventType "messages" sem número: usar último envio da tabela (quem recebeu a licitação por último)
    let numeroNormFallback = ''
    let trackIdFallback = ''
    if ((!from && !numeroNorm) && ehEventoMessages) {
      try {
        const { data: row } = await supabase
          .from('whatsapp_ultima_licitacao')
          .select('numero_telefone, track_id')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (row?.numero_telefone) {
          numeroNormFallback = normalizarNumero(row.numero_telefone)
          trackIdFallback = (row.track_id || '') as string
          console.log('📌 [Webhook] Evento "messages" sem número no payload – usando último envio da tabela:', numeroNormFallback, 'track_id:', trackIdFallback || '—')
        }
      } catch (e) {
        console.warn('⚠️ [Webhook] Fallback número (último envio):', e)
      }
    }

    if (!from && !numeroNorm && !numeroNormFallback) {
      console.warn('⚠️ [Webhook] Webhook inválido: falta "from" (remetente). Chaves do payload:', Object.keys(webhook), 'chat:', Object.keys(chat))
      return
    }

    const numeroNormFinal = numeroNorm || numeroNormFallback

    // track_id: do payload ou tabela de fallback (buscar cedo para poder assumir sim_interesse em eventos "messages")
    let trackId = (mensagem.track_id ||
      mensagem.trackId ||
      webhook.track_id ||
      webhook.trackId ||
      webhook.metadata?.track_id ||
      '') as string
    if (!trackId && numeroNormFinal) {
      try {
        const { data: row } = await supabase
          .from('whatsapp_ultima_licitacao')
          .select('track_id')
          .eq('numero_telefone', numeroNormFinal)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (row?.track_id) {
          trackId = row.track_id
          console.log('📌 [Webhook] track_id obtido da tabela whatsapp_ultima_licitacao:', trackId)
        }
      } catch (e) {
        console.warn('⚠️ [Webhook] Fallback track_id (tabela whatsapp_ultima_licitacao):', e)
      }
    }
    if (!trackId && trackIdFallback) {
      trackId = trackIdFallback
      console.log('📌 [Webhook] track_id do fallback (último envio):', trackId)
    }

    // buttonId: payload, texto da mensagem, ou (se EventType "messages" + temos track_id) assumir sim_interesse
    let buttonId = (mensagem.buttonId || mensagem.button_id || webhook.buttonId || mensagem.selectedId || '') as string
    const textoMsg = (mensagem.text || mensagem.body || webhook.data?.text || webhook.data?.body || webhook.text || webhook.body || '') as string
    if (!buttonId && textoMsg && ehSimInteresse(textoMsg)) {
      buttonId = 'sim_interesse'
      console.log('🔘 [Webhook] Reconhecido "sim_interesse" pelo texto da mensagem')
    }
    if (!buttonId && ehEventoMessages && trackId) {
      buttonId = 'sim_interesse'
      console.log('🔘 [Webhook] Assumindo sim_interesse (EventType messages + track_id da tabela)')
    }

    if (!buttonId) {
      console.warn('⚠️ [Webhook] Webhook inválido: não identificamos botão nem texto "sim_interesse"')
      return
    }

    const fromDisplay = numeroNormFinal || numeroNorm || from
    const numeroParaEnvio = numeroNormFinal || numeroNorm || from // número no formato 55... para a UAZAPI
    console.log(`🔘 [Webhook] Clique detectado: ${buttonId} de ${fromDisplay} (track_id: ${trackId || '—'})`)

    const token = Deno.env.get('UAZAPI_TOKEN') ?? Deno.env.get('UAZAPI_BEARER_TOKEN')
    if (!token) {
      console.error('❌ [Webhook] UAZAPI_TOKEN não configurado')
      return
    }

    const tokenValue = token.replace(/^Bearer\s+/i, '').trim()
    const instanceId = Deno.env.get('UAZAPI_INSTANCE_ID')?.trim()

    // 1) Novo fluxo: SIM interesse no edital -> mandar carrossel de documentos
    if (buttonId === 'sim_interesse') {
      console.log('📄 [Webhook] Usuário confirmou interesse no edital (sim_interesse)')

      if (!trackId) {
        console.warn('⚠️ [Webhook] sim_interesse sem track_id – não é possível localizar a licitação.')
        await enviarTexto(
          numeroParaEnvio,
          'Recebemos seu interesse, mas não conseguimos localizar este edital (track_id ausente).',
          tokenValue,
          instanceId
        )
        return
      }

      // Feedback: mostrar "digitando..." enquanto preparamos os documentos
      await enviarEstadoDigitando(numeroParaEnvio, tokenValue, instanceId)
      await enviarCarrosselDocumentos(numeroParaEnvio, trackId, supabase, tokenValue, instanceId)
      return
    }

    // 2) Fluxo antigo: "docs" -> placeholder (pode futuramente reaproveitar enviarCarrosselDocumentos)
    if (buttonId === 'docs') {
      console.log('📄 [Webhook] Usuário solicitou documentos (botão docs)')

      await enviarTexto(
        numeroParaEnvio,
        '📄 *Documentos da Licitação*\n\nEstamos preparando os documentos para você. Em breve, você receberá os PDFs do edital.',
        tokenValue,
        instanceId
      )

      // TODO: Opcionalmente chamar enviarCarrosselDocumentos aqui também
      return
    }

    // 3) Fluxo antigo: "detalhes"
    if (buttonId === 'detalhes') {
      console.log('ℹ️ [Webhook] Usuário solicitou detalhes completos')

      await enviarTexto(
        numeroParaEnvio,
        'ℹ️ *Detalhes Completos*\n\nEstamos buscando os detalhes completos da licitação. Aguarde alguns instantes.',
        tokenValue,
        instanceId
      )

      return
    }

    // 4) Botão com URL (link PNCP, etc.)
    if (buttonId.startsWith('http')) {
      console.log('🔗 [Webhook] Usuário clicou em um link (provavelmente PNCP):', buttonId)
      // Somente registra clique; não precisa responder
      return
    }

    console.warn(`⚠️ [Webhook] Botão desconhecido: ${buttonId}`)
  } catch (err) {
    console.error('❌ [Webhook] Erro ao processar clique:', err)
  }
}

// ============================================
// MAIN HANDLER
// ============================================
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
    let body: Record<string, any>
    try {
      body = await req.json()
    } catch {
      return new Response(
        JSON.stringify({ error: 'Body inválido (JSON esperado)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const logPayload = JSON.stringify(body)
    console.log('📥 [Webhook] Recebido:', logPayload.slice(0, 500))

    // Criar cliente Supabase com service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ [Webhook] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurado')
      return new Response(
        JSON.stringify({ error: 'Configuração inválida' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Identificar tipo de webhook (UAZAPI usa EventType com E e T maiúsculos)
    const tipo = (body.EventType || body.event_type || body.tipo || body.type || body.event || '') as string
    const mensagem = body.mensagem || body.message || body.Message || body.data?.message || body.data || {}
    const chat = body.chat || body.data?.chat || {}
    // Texto da mensagem: vários caminhos possíveis no payload UAZAPI
    const firstMsg = Array.isArray(body.messages) ? body.messages[0] : null
    const evento = body.event || body.data?.event || {}
    const textoRecebidoRaw = (
      mensagem.text || mensagem.body || mensagem.content || mensagem.caption ||
      body.message?.text || body.message?.body || body.Message?.text || body.Message?.body ||
      body.data?.text || body.data?.body || body.text || body.body ||
      evento.text || evento.body || evento.message?.text ||
      firstMsg?.text || firstMsg?.body ||
      chat.lastMessage?.text || chat.lastMessage?.body ||
      chat.text || chat.body || ''
    )
    const textoRecebido = typeof textoRecebidoRaw === 'string' ? textoRecebidoRaw : ''

    // Diagnóstico: quando for "messages" logar mais payload para achar texto e número
    if (tipo === 'messages') {
      if (!textoRecebido.trim()) {
        console.log('[Webhook] Evento "messages" sem texto. Chaves body:', Object.keys(body).join(', '))
        if (body.message && typeof body.message === 'object') {
          console.log('[Webhook] body.message:', JSON.stringify(body.message).slice(0, 400))
        }
        if (body.data && typeof body.data === 'object') {
          console.log('[Webhook] body.data:', JSON.stringify(body.data).slice(0, 400))
        }
        console.log('[Webhook] body.chat keys:', Object.keys(chat).join(', '), '| chat:', JSON.stringify(chat).slice(0, 500))
      }
      // Log maior do payload para inspecionar onde vêm texto/número (só em messages)
      console.log('[Webhook] Payload "messages" (até 1200 chars):', logPayload.slice(0, 1200))
    }

    // Disparar processamento quando:
    // 1) for evento de clique em botão (button_click ou payload com buttonId), ou
    // 2) for evento de mensagem recebida (messages) e o texto for a resposta do botão "Sim...", ou
    // 3) for EventType "messages" (sempre processar; dentro de processarClique usamos track_id da tabela como fallback)
    const pareceCliqueBotao = tipo === 'button_click' || !!body.mensagem?.buttonId || !!body.message?.button_id
    const pareceRespostaSim = (tipo === 'messages' || tipo === 'message' || !tipo) && ehSimInteresse(textoRecebido)
    const ehEventoMessages = tipo === 'messages' || tipo === 'message'

    if (pareceCliqueBotao || pareceRespostaSim || ehEventoMessages) {
      await processarClique(body, supabase, ehEventoMessages)
    } else {
      console.log(`ℹ️ [Webhook] Tipo de webhook ignorado: ${tipo}`)
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Webhook processado' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('❌ [Webhook] Erro:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Erro ao processar webhook' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})


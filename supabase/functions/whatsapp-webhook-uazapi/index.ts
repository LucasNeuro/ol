// ============================================
// EDGE FUNCTION: WHATSAPP WEBHOOK UAZAPI
// ============================================
// Recebe callbacks da UAZAPI (mensagens recebidas / cliques em botões)
// e, quando o usuário clicar em "Sim, tenho interesse neste edital",
// envia automaticamente um menu/carrossel com os PDFs do edital.
//
// IMPORTANTE:
// - Configure a UAZAPI para apontar o webhook HTTP para esta função:
//   https://<sua-instancia-supabase>.functions.supabase.co/whatsapp-webhook-uazapi
// - Garanta que o payload da UAZAPI inclua:
//   - number (telefone do contato)
//   - buttonId ou campo equivalente com o ID do botão clicado
//   - track_id (enviado na primeira mensagem via enviar-whatsapp-uazapi)
//
// Qualquer diferença de campos pode ser ajustada facilmente nas extrações abaixo.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const UAZAPI_BASE = Deno.env.get('UAZAPI_BASE_URL') || 'https://atendemais.uazapi.com'

// Imagem padrão para os cartões do carrossel (pode ser configurada por env)
const DEFAULT_DOC_IMAGE =
  Deno.env.get('UAZAPI_DOC_IMAGE_URL') ||
  'https://via.placeholder.com/400x200.png?text=Documento+do+Edital'

interface Documento {
  urlDocumento: string
  nomeArquivo: string
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    let body: any
    try {
      body = await req.json()
    } catch (e) {
      console.error('❌ [Webhook UAZAPI] Erro ao fazer parse do JSON:', e)
      return new Response(
        JSON.stringify({ error: 'Body inválido (JSON esperado)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('📥 [Webhook UAZAPI] Payload recebido:', JSON.stringify(body, null, 2))

    // EXTRAÇÃO FLEXÍVEL DOS CAMPOS IMPORTANTES -----------------------------
    const number: string =
      body.number ||
      body.chatId ||
      body.from ||
      ''

    // ID do botão clicado – ajustar conforme o formato real da UAZAPI
    const buttonId: string =
      body.buttonId ||
      body.button_id ||
      body.selectedId ||
      body.selected_id ||
      body.data?.id ||
      body.message?.button?.id ||
      body.interactive?.id ||
      ''

    // track_id que mandamos na primeira mensagem (numero_controle da licitação)
    const trackId: string =
      body.track_id ||
      body.trackId ||
      body.metadata?.track_id ||
      ''

    if (!number) {
      console.warn('⚠️ [Webhook UAZAPI] Campo number não encontrado. Ignorando.')
      return new Response(
        JSON.stringify({ ok: true, ignored: true, reason: 'missing_number' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!buttonId) {
      console.log('ℹ️ [Webhook UAZAPI] Mensagem recebida sem buttonId. Nada a fazer.')
      return new Response(
        JSON.stringify({ ok: true, ignored: true, reason: 'no_button' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Só reagimos ao botão "sim_interesse"
    if (buttonId !== 'sim_interesse') {
      console.log(`ℹ️ [Webhook UAZAPI] ButtonId diferente de sim_interesse (${buttonId}). Ignorando.`)
      return new Response(
        JSON.stringify({ ok: true, ignored: true, reason: 'button_not_handled' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!trackId) {
      console.warn('⚠️ [Webhook UAZAPI] track_id não encontrado. Não é possível localizar a licitação.')
      return new Response(
        JSON.stringify({ ok: false, error: 'track_id ausente. Ajuste o envio inicial para incluir track_id.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('🔎 [Webhook UAZAPI] number:', number, 'track_id:', trackId)

    // BUSCAR DOCUMENTOS DA LICITAÇÃO ---------------------------------------
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ [Webhook UAZAPI] Variáveis SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configuradas')
      return new Response(
        JSON.stringify({ error: 'Configuração do Supabase não encontrada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // trackId foi enviado como numero_controle da licitação
    const { data: licitacoes, error: errorLicitacao } = await supabase
      .from('licitacoes')
      .select('id, numero_controle_pncp, anexos, dados_completos')
      .eq('numero_controle_pncp', trackId)
      .limit(1)

    if (errorLicitacao || !licitacoes || licitacoes.length === 0) {
      console.error('❌ [Webhook UAZAPI] Licitação não encontrada para track_id:', trackId, errorLicitacao)
      return new Response(
        JSON.stringify({ error: 'Licitação não encontrada para este track_id' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const licitacao = licitacoes[0]
    console.log('✅ [Webhook UAZAPI] Licitação encontrada:', licitacao.numero_controle_pncp)

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

    // 2. Anexos em licitacao.anexos
    if (licitacao.anexos && Array.isArray(licitacao.anexos)) {
      licitacao.anexos.forEach((anexo: any) => {
        const url = anexo.url || anexo.urlDocumento || anexo.linkDocumento || anexo.link
        const nome = anexo.nomeArquivo || anexo.nome || anexo.nomeDocumento || anexo.tipoDocumentoNome
        if (url) {
          if (!documentos.some(d => d.urlDocumento === url)) {
            documentos.push({
              urlDocumento: url,
              nomeArquivo: nome || 'Documento.pdf',
            })
          }
        }
      })
      console.log(`📎 ${licitacao.anexos.length} anexos encontrados no campo anexos`)
    }

    // 3. Documentos em dados_completos (anexos + documentos)
    if (licitacao.dados_completos) {
      let dadosCompletos = licitacao.dados_completos
      if (typeof dadosCompletos === 'string') {
        try {
          dadosCompletos = JSON.parse(dadosCompletos)
        } catch (e) {
          console.warn('⚠️ Erro ao parsear dados_completos:', e)
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
        console.log(`📦 ${dadosCompletos.anexos.length} anexos encontrados em dados_completos`)
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
        console.log(`📄 ${dadosCompletos.documentos.length} documentos encontrados em dados_completos`)
      }
    }

    if (documentos.length === 0) {
      console.warn('⚠️ [Webhook UAZAPI] Nenhum documento encontrado para esta licitação')
      return new Response(
        JSON.stringify({ ok: true, warning: 'Nenhum documento encontrado para esta licitação' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📦 [Webhook UAZAPI] Total de ${documentos.length} documentos únicos encontrados`)

    // Montar carrossel (ou lista de botões) com os documentos ---------------
    const docsParaMostrar = documentos.slice(0, 5) // limitar a 5 para não ficar pesado

    const carousel = docsParaMostrar.map((doc, index) => ({
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

    const uazapiToken = Deno.env.get('UAZAPI_TOKEN') ?? Deno.env.get('UAZAPI_BEARER_TOKEN')
    if (!uazapiToken) {
      console.error('❌ [Webhook UAZAPI] UAZAPI_TOKEN ou UAZAPI_BEARER_TOKEN não configurado')
      return new Response(
        JSON.stringify({ error: 'Serviço WhatsApp não configurado' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const url = `${UAZAPI_BASE.replace(/\/$/, '')}/send/carousel`
    const tokenValue = uazapiToken.replace(/^Bearer\s+/i, '').trim()

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'token': tokenValue,
    }

    const instanceId = Deno.env.get('UAZAPI_INSTANCE_ID')?.trim()
    if (instanceId) {
      headers['instance'] = instanceId
    }

    const payload = {
      number,
      text: '📄 Documentos deste edital (clique para abrir):',
      carousel,
      async: true,
    }

    console.log('📤 [Webhook UAZAPI] Enviando carrossel de documentos para:', number)

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })

    const responseText = await response.text().catch(() => '')
    if (!response.ok) {
      console.error('❌ [Webhook UAZAPI] Erro ao enviar carrossel:', response.status, responseText)
      return new Response(
        JSON.stringify({ error: 'Falha ao enviar carrossel para UAZAPI', status: response.status }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ [Webhook UAZAPI] Carrossel enviado com sucesso:', responseText)

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('❌ [Webhook UAZAPI] Erro inesperado:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}
)


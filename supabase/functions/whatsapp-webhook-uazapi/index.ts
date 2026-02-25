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

function normalizarNumero(num: string): string {
  const digits = String(num || '').replace(/\D/g, '')
  return digits.startsWith('55') ? digits : `55${digits}`
}

async function enviarTexto(numero: string, text: string, token: string, instanceId?: string) {
  const url = `${UAZAPI_BASE.replace(/\/$/, '')}/send/text`
  const headers: Record<string, string> = { 'Content-Type': 'application/json', token }
  if (instanceId) headers['instance'] = instanceId
  await fetch(url, { method: 'POST', headers, body: JSON.stringify({ number: numero, text }) })
}

// Fluxo recuperação de senha (Sim/Não + digitar nova senha). Retorna true se tratou.
async function processarPasswordResetUazapi(body: any, supabase: any): Promise<boolean> {
  const numberRaw = body.number || body.chatId || body.from || body.data?.number || ''
  if (!numberRaw) return false
  const numero = normalizarNumero(numberRaw)

  // Reconhecer clique no botão do card em qualquer formato que a UAZAPI enviar
  const buttonId = (
    body.buttonId || body.button_id || body.selectedId || body.selected_id ||
    body.message?.button?.id || body.data?.buttonId || body.data?.id || body.data?.selectedId ||
    body.selectedReplyId || body.interactive?.button_reply?.id || body.reply?.id || ''
  ) as string
  const texto = (
    body.text || body.body || body.message?.text || body.message?.body ||
    body.data?.text || body.data?.message?.text || body.payload?.text || body.content?.text || ''
  ).toString().trim()

  const { data: row } = await supabase
    .from('password_reset_pendente')
    .select('id, user_id, estado, created_at')
    .eq('telefone', numero)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!row) return false

  const token = Deno.env.get('UAZAPI_TOKEN') ?? Deno.env.get('UAZAPI_BEARER_TOKEN')
  if (!token) return false
  const tokenValue = token.replace(/^Bearer\s+/i, '').trim()
  const instanceId = Deno.env.get('UAZAPI_INSTANCE_ID')?.trim()

  const EXPIRA_MIN = 15
  const criado = new Date(row.created_at).getTime()
  if (Date.now() - criado > EXPIRA_MIN * 60 * 1000) {
    await supabase.from('password_reset_pendente').delete().eq('id', row.id)
    await enviarTexto(numero, '⏱ Solicitação expirada. Solicite novamente pelo site em "Esqueci minha senha".', tokenValue, instanceId)
    return true
  }

  if (row.estado === 'aguardando_confirmacao') {
    const idOuTexto = `${buttonId} ${texto}`.trim()
    // Clique no card "Sim, redefinir senha" (buttonId ou texto da mensagem)
    const ehSim =
      buttonId === 'sim_redefinir' || /sim_redefinir/i.test(buttonId) || /sim, redefinir/i.test(buttonId) ||
      /^sim$/i.test(texto) || /sim, redefinir/i.test(texto) || /sim, redefinir senha/i.test(texto) || /sim, redefinir senha/i.test(idOuTexto)
    const ehNao =
      buttonId === 'nao_redefinir' || /nao_redefinir/i.test(buttonId) || /n[aã]o, encerrar/i.test(buttonId) ||
      /^n[aã]o$/i.test(texto) || /n[aã]o, encerrar/i.test(texto)

    if (ehNao) {
      await supabase.from('password_reset_pendente').delete().eq('id', row.id)
      await enviarTexto(numero, '📋 *Encerrado*\n\nPara redefinir a senha depois, entre em contato com o administrador da conta.', tokenValue, instanceId)
      return true
    }
    // Nova lógica: qualquer resposta que NÃO seja claramente \"Não\" leva direto para o passo de digitar a nova senha.
    // Isso evita o fallback redundante \"Toque em uma das opções...\" e simplifica o fluxo para o usuário.
    if (ehSim) {
      console.log('[password_reset] Confirmado como SIM (explícito).')
    } else {
      console.log('[password_reset] Resposta não reconhecida como SIM/NÃO; assumindo confirmação e avançando para nova senha.')
    }

    await supabase.from('password_reset_pendente').update({ estado: 'aguardando_senha' }).eq('id', row.id)
    const msgSenha =
      '🔐 *Redefinição de senha*\n\n' +
      'Agora, *digite sua nova senha* aqui nesta conversa.\n\n' +
      '✅ *Regras de segurança:*\n' +
      '• Pelo menos *6 caracteres*\n' +
      '• Use letras e números\n' +
      '• Evite usar dados fáceis (CPF, 123456, data de nascimento)\n\n' +
      '✍️ *Como fazer:*\n' +
      'Responda com a senha desejada (apenas a senha, sem aspas).'
    await enviarTexto(numero, msgSenha, tokenValue, instanceId)
    return true
  }

  if (row.estado === 'aguardando_senha') {
    const novaSenha = texto
    if (!novaSenha || novaSenha.length < 6) {
      await enviarTexto(numero, 'Senha deve ter no mínimo 6 caracteres. Tente novamente.', tokenValue, instanceId)
      return true
    }
    const { error: updateError } = await supabase.auth.admin.updateUserById(row.user_id, { password: novaSenha })
    await supabase.from('password_reset_pendente').delete().eq('id', row.id)
    if (updateError) {
      await enviarTexto(numero, 'Não foi possível alterar a senha. Tente novamente ou entre em contato com o suporte.', tokenValue, instanceId)
      return true
    }
    await enviarTexto(numero, '✅ *Senha alterada com sucesso!*\n\nAgora você pode fazer login com a nova senha no site.', tokenValue, instanceId)
    return true
  }

  return false
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

    const number: string = body.number || body.chatId || body.from || ''

    if (!number) {
      console.warn('⚠️ [Webhook UAZAPI] Campo number não encontrado. Ignorando.')
      return new Response(
        JSON.stringify({ ok: true, ignored: true, reason: 'missing_number' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey)
      const tratouReset = await processarPasswordResetUazapi(body, supabase)
      if (tratouReset) {
        console.log('✅ [Webhook UAZAPI] Fluxo de recuperação de senha processado.')
        return new Response(
          JSON.stringify({ success: true, message: 'reset_senha' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

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


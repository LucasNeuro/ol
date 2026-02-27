import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ── Ler chave da API (apenas trim) ────────────────────────────────────────
function readApiKey(): string {
  const raw = Deno.env.get('MISTRAL_API_KEY') ?? ''
  const key = raw.trim()
  return key
}

// ── Buscar bytes do PDF ───────────────────────────────────────────────────
// Tenta URL direta; se falhar (bucket privado), gera URL assinada via service-role.
async function fetchPdfBytes(
  documentoUrl: string,
  supabaseUrl: string,
  serviceKey: string,
): Promise<Uint8Array> {
  let res = await fetch(documentoUrl, { signal: AbortSignal.timeout(30_000) })

  if (!res.ok && documentoUrl.includes(supabaseUrl)) {
    console.log(`⚠️ URL retornou ${res.status}. Gerando URL assinada via service-role...`)
    const match = documentoUrl.match(/\/storage\/v1\/object\/(?:public\/)?([^/]+)\/(.+)$/)
    if (match) {
      const [, bucket, path] = match
      const sb = createClient(supabaseUrl, serviceKey)
      const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, 300)
      if (!error && data?.signedUrl) {
        res = await fetch(data.signedUrl, { signal: AbortSignal.timeout(30_000) })
      }
    }
  }

  if (!res.ok) {
    throw new Error(
      `Não foi possível acessar o documento (${res.status}). ` +
      `Verifique se o bucket "editais" está público no Supabase Storage.`,
    )
  }

  return new Uint8Array(await res.arrayBuffer())
}

// ── Uint8Array → base64 (sem estouro de stack) ────────────────────────────
function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 8192
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

// ── Handler ───────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // ── GET = teste de chave (sem abrir documento) ───────────────────────────
  if (req.method === 'GET') {
    const key = readApiKey()
    const keyOk = key.length >= 20
    if (!keyOk) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'MISTRAL_API_KEY ausente ou muito curta nos Secrets',
          dica: 'Supabase → Edge Functions → Manage secrets → MISTRAL_API_KEY (valor sem aspas)',
          keyLength: key.length,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      )
    }
    try {
      const res = await fetch('https://api.mistral.ai/v1/models', {
        headers: { 'Authorization': `Bearer ${key}` },
      })
      if (res.status === 401) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: 'Chave rejeitada pela Mistral (401). Gere uma nova chave em console.mistral.ai e atualize o secret.',
            keyPrefix: key.slice(0, 6) + '...',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
        )
      }
      if (!res.ok) {
        const t = await res.text()
        return new Response(
          JSON.stringify({ ok: false, error: `Mistral retornou ${res.status}`, detail: t }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
        )
      }
      return new Response(
        JSON.stringify({
          ok: true,
          message: 'Chave Mistral válida. O chat com documentos deve funcionar.',
          keyPrefix: key.slice(0, 6) + '...',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      )
    } catch (e) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Erro ao chamar Mistral', detail: (e as Error).message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      )
    }
  }

  try {
    const {
      pergunta,
      documentoUrl,
      documentoId,
      dadosEmpresa = null,
      historico = [],
      paginaAtual = null,
      textoPagina = null,
    } = await req.json()

    if (!pergunta) throw new Error('Parâmetro obrigatório ausente: pergunta')
    if (!documentoUrl && !textoPagina) {
      throw new Error('É necessário informar documentoUrl ou textoPagina')
    }
    if (documentoUrl) {
      try { new URL(documentoUrl) } catch { throw new Error('URL do documento inválida') }
    }

    const MAX_HISTORICO = 6
    console.log('💬 Pergunta:', pergunta)
    console.log('📄 URL:', documentoUrl)

    // ── Chave Mistral ──────────────────────────────────────────────────────
    const mistralApiKey = readApiKey()
    console.log('🔑 Key length:', mistralApiKey.length, '| prefix:', mistralApiKey.slice(0, 8) + '...')

    if (!mistralApiKey || mistralApiKey.length < 20) {
      throw new Error(
        `MISTRAL_API_KEY não encontrada ou inválida (length=${mistralApiKey.length}). ` +
        'Supabase → Edge Functions → Manage secrets → MISTRAL_API_KEY. Depois faça redeploy.',
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    // ── Definir conteúdo principal (texto da página OU PDF inteiro) ────────
    let ultimaMensagem

    if (textoPagina && typeof textoPagina === 'string' && textoPagina.trim().length > 0) {
      console.log(`📄 Modo TEXTO da página (${textoPagina.trim().length} chars) — NÃO baixando PDF`)
      const paginaLabel = paginaAtual ? `página ${paginaAtual}` : 'página atual'
      const textoLimitado =
        textoPagina.length > 20_000
          ? textoPagina.slice(0, 20_000) + '\n\n[trecho truncado pelo sistema]'
          : textoPagina

      const corpo = [
        `Pergunta do usuário: ${pergunta}`,
        '',
        `Trecho do edital (${paginaLabel}) enviado pelo frontend:`,
        '',
        textoLimitado,
        '',
        'Responda apenas com base nesse texto. Se a resposta não estiver explicitamente nesse trecho, diga claramente que não encontrou a informação na página enviada.',
      ].join('\n')

      ultimaMensagem = {
        role: 'user',
        content: corpo,
      }
    } else {
      // Caminho de compatibilidade: usar o PDF completo (pode falhar em documentos muito grandes)
      console.log('📥 Baixando PDF completo (modo compatibilidade)...')
      const pdfBytes = await fetchPdfBytes(documentoUrl!, supabaseUrl, serviceKey)
      const sizeMB = (pdfBytes.length / 1024 / 1024).toFixed(2)
      console.log(`✅ PDF: ${sizeMB} MB`)

      if (pdfBytes.length > 50 * 1024 * 1024) {
        throw new Error(`PDF muito grande (${sizeMB} MB). Máximo: 50 MB.`)
      }

      const pdfBase64  = toBase64(pdfBytes)
      const dataUri    = `data:application/pdf;base64,${pdfBase64}`

      ultimaMensagem = {
        role: 'user',
        content: [
          { type: 'text', text: pergunta },
          { type: 'document_url', document_url: dataUri },
        ],
      }
    }

    // ── Contexto da empresa ────────────────────────────────────────────────
    let contextoEmpresa = ''
    if (dadosEmpresa) {
      const info: string[] = []
      if (dadosEmpresa.razao_social)   info.push(`Razão Social: ${dadosEmpresa.razao_social}`)
      if (dadosEmpresa.cnpj)           info.push(`CNPJ: ${dadosEmpresa.cnpj}`)
      if (dadosEmpresa.uf)             info.push(`Estado: ${dadosEmpresa.uf}`)
      if (dadosEmpresa.cnae_principal) info.push(`CNAE: ${dadosEmpresa.cnae_principal}`)
      if (dadosEmpresa.porte_empresa)  info.push(`Porte: ${dadosEmpresa.porte_empresa}`)
      if (Array.isArray(dadosEmpresa.setores_atividades) && dadosEmpresa.setores_atividades.length) {
        info.push(`Setores: ${dadosEmpresa.setores_atividades.join(', ')}`)
      }
      if (info.length) {
        contextoEmpresa = `\n\nEMPRESA DO USUÁRIO:\n${info.join('\n')}\n\nUse esses dados para contextualizar a participação da empresa nesta licitação.`
      }
    }

    // ── Mensagens ──────────────────────────────────────────────────────────
    const systemPrompt = `# Identidade
Você é o Assistente do Sistema Licitação: especialista em licitações públicas brasileiras (Lei 14.133/2021, Pregão, RDC, etc.). Sua única fonte de verdade é o documento PDF anexado na última mensagem.

# Competências
- Extrair objeto, órgão, valor estimado, datas, modalidade e requisitos de habilitação.
- Citar o documento (seção/página) em toda informação relevante.
- Identificar exigências de qualificação técnica, certidões e cláusulas relevantes.
- Quando houver dados da empresa, avaliar aderência ao edital (setor, CNAE, porte, UF).
- Se a informação não existir no documento, dizer explicitamente.
- NUNCA inventar valores, datas, artigos ou requisitos ausentes no PDF.

# Regras
- Responda em português (PT-BR), tom profissional, 1-3 parágrafos.
- Baseie-se exclusivamente no PDF e no histórico da conversa.${contextoEmpresa}`

    const historicoLimitado = Array.isArray(historico) ? historico.slice(-MAX_HISTORICO) : []

    const messages = [
      { role: 'system', content: systemPrompt },
      ...historicoLimitado.map((m: any) => ({
        role: m.role,
        content: Array.isArray(m.content)
          ? (m.content.find((c: any) => c.type === 'text')?.text ?? m.content)
          : m.content,
      })),
      ultimaMensagem,
    ]

    // ── Chamada Mistral ────────────────────────────────────────────────────
    const controller = new AbortController()
    const timeoutId  = setTimeout(() => controller.abort(), 120_000)

    console.log('📤 Chamando Mistral chat/completions...')

    const mistralRes = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mistralApiKey}`,
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages,
        temperature: 0.3,
        max_tokens: 2000,
      }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!mistralRes.ok) {
      const errTxt = await mistralRes.text().catch(() => '')
      console.error(`Mistral ${mistralRes.status}:`, errTxt)

      if (mistralRes.status === 401) {
        throw new Error(
          'Chave Mistral rejeitada (401). Confira: (1) Secret MISTRAL_API_KEY no Supabase está correto e sem aspas. ' +
          '(2) Se você alterou o secret agora, faça redeploy da função e espere ~1 minuto. ' +
          '(3) Gere uma chave nova em console.mistral.ai se a atual foi revogada.',
        )
      }
      if (mistralRes.status === 422) {
        throw new Error(
          'Formato de requisição rejeitado pela Mistral (422). ' +
          'O modelo pode não suportar documentos PDF. Tente usar mistral-large-latest.',
        )
      }
      throw new Error(`Erro Mistral (${mistralRes.status}): ${errTxt}`)
    }

    const mistralData = await mistralRes.json()
    const resposta: string = mistralData?.choices?.[0]?.message?.content?.trim() ?? ''

    if (!resposta) throw new Error('Resposta vazia da API Mistral. Reformule a pergunta.')

    console.log('✅ Resposta:', resposta.slice(0, 120) + '...')
    const usage = mistralData?.usage ?? {}
    console.log('📊 Tokens:', usage)

    return new Response(
      JSON.stringify({
        success: true,
        resposta,
        tokens: {
          prompt: usage.prompt_tokens ?? 0,
          completion: usage.completion_tokens ?? 0,
          total: usage.total_tokens ?? 0,
        },
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )

  } catch (error) {
    console.error('❌ Erro:', error)

    let mensagem: string = error?.message || 'Erro desconhecido'
    if (error?.name === 'AbortError' || mensagem.includes('signal has been aborted')) {
      mensagem = 'Timeout (120s). O documento pode ser muito grande. Tente uma pergunta mais objetiva.'
    }

    return new Response(
      JSON.stringify({ success: false, error: mensagem }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    )
  }
})

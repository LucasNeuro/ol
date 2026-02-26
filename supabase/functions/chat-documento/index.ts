import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function sanitizeKey(raw: string): string {
  return raw
    .replace(/\r?\n|\r/g, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/^["'\s]+|["'\s]+$/g, '')
    .replace(/^(?:bearer\s+)/i, '')
    .trim()
}

/**
 * Baixa o PDF da URL (seja Storage público ou privado via service-role).
 * Se a URL for do próprio Supabase Storage e o bucket for privado,
 * gera uma URL assinada com validade de 1 hora usando o service-role key.
 */
async function fetchDocumentBytes(
  documentoUrl: string,
  supabaseUrl: string,
  serviceKey: string,
): Promise<Uint8Array> {
  // Tentativa 1: fetch direto (funciona quando bucket é público)
  let res = await fetch(documentoUrl, { signal: AbortSignal.timeout(30_000) })

  // Tentativa 2: se a URL for do nosso Storage e retornar 4xx, gera URL assinada
  if (!res.ok && documentoUrl.includes(supabaseUrl)) {
    console.log(`⚠️ URL pública retornou ${res.status}. Tentando URL assinada via service-role...`)

    const match = documentoUrl.match(/\/storage\/v1\/object\/(?:public\/)?([^/]+)\/(.+)$/)
    if (match) {
      const [, bucket, path] = match
      const supabase = createClient(supabaseUrl, serviceKey)
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 3600)

      if (error || !data?.signedUrl) {
        throw new Error(`Não foi possível gerar URL assinada para o documento: ${error?.message}`)
      }

      res = await fetch(data.signedUrl, { signal: AbortSignal.timeout(30_000) })
    }
  }

  if (!res.ok) {
    throw new Error(
      `Não foi possível baixar o documento (${res.status}). ` +
      `Verifique se o bucket "editais" é público no Supabase ou se a URL ainda é válida.`,
    )
  }

  const buffer = await res.arrayBuffer()
  return new Uint8Array(buffer)
}

/**
 * Faz upload do PDF para a Mistral Files API e retorna a URL assinada.
 * A URL é válida por 1 hora — suficiente para o chat.
 */
async function uploadToMistralFiles(
  pdfBytes: Uint8Array,
  mistralApiKey: string,
): Promise<{ fileId: string; signedUrl: string }> {
  const blob = new Blob([pdfBytes], { type: 'application/pdf' })
  const formData = new FormData()
  formData.append('purpose', 'ocr')
  formData.append('file', blob, 'documento.pdf')

  const uploadRes = await fetch('https://api.mistral.ai/v1/files', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${mistralApiKey}` },
    body: formData,
    signal: AbortSignal.timeout(60_000),
  })

  if (!uploadRes.ok) {
    const txt = await uploadRes.text().catch(() => '')
    if (uploadRes.status === 401) {
      throw new Error(
        'Chave da Mistral inválida (401 no upload). ' +
        'Verifique: Supabase → Edge Functions → Secrets → MISTRAL_API_KEY ' +
        'e faça redeploy da função (supabase functions deploy chat-documento).',
      )
    }
    throw new Error(`Erro ao enviar documento para Mistral (${uploadRes.status}): ${txt}`)
  }

  const uploadData = await uploadRes.json()
  const fileId: string = uploadData.id

  if (!fileId) {
    throw new Error('Mistral não retornou um ID de arquivo após o upload.')
  }

  // Obter URL assinada — expiry em HORAS (máximo 24h na Mistral)
  const signedRes = await fetch(
    `https://api.mistral.ai/v1/files/${fileId}/url?expiry=1`,
    {
      headers: { 'Authorization': `Bearer ${mistralApiKey}` },
      signal: AbortSignal.timeout(15_000),
    },
  )

  if (!signedRes.ok) {
    const errTxt = await signedRes.text().catch(() => '')
    console.error(`Mistral /files/url ${signedRes.status}:`, errTxt)
    await deleteMistralFile(fileId, mistralApiKey)
    throw new Error(
      `Erro ao obter URL assinada do documento na Mistral (${signedRes.status}): ${errTxt}`,
    )
  }

  const signedData = await signedRes.json()
  // Mistral pode retornar o campo como "url" ou "signed_url"
  const signedUrl: string = signedData.url ?? signedData.signed_url ?? ''

  if (!signedUrl) {
    console.error('Mistral signed URL response:', JSON.stringify(signedData))
    await deleteMistralFile(fileId, mistralApiKey)
    throw new Error(
      'Mistral não retornou URL assinada para o arquivo. ' +
      `Resposta: ${JSON.stringify(signedData)}`,
    )
  }

  return { fileId, signedUrl }
}

/** Remove o arquivo temporário da Mistral (best-effort, não falha o chat). */
async function deleteMistralFile(fileId: string, mistralApiKey: string): Promise<void> {
  try {
    await fetch(`https://api.mistral.ai/v1/files/${fileId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${mistralApiKey}` },
      signal: AbortSignal.timeout(10_000),
    })
    console.log('🗑️ Arquivo temporário removido da Mistral:', fileId)
  } catch {
    console.warn('⚠️ Não foi possível remover arquivo temporário da Mistral:', fileId)
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Handler principal
// ──────────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let mistralFileId: string | null = null

  try {
    const {
      pergunta,
      documentoUrl,
      documentoId,
      dadosEmpresa = null,
      historico = [],
    } = await req.json()

    if (!pergunta || !documentoUrl) {
      throw new Error('Parâmetros obrigatórios: pergunta, documentoUrl')
    }

    try { new URL(documentoUrl) } catch {
      throw new Error('URL do documento inválida')
    }

    const MAX_HISTORICO = 6
    console.log('💬 Nova pergunta:', pergunta)
    console.log('📄 Documento URL:', documentoUrl)

    // ── Chave Mistral ──────────────────────────────────────────────────────
    const rawKey = Deno.env.get('MISTRAL_API_KEY') || ''
    const mistralApiKey = sanitizeKey(rawKey)

    console.log(
      'MISTRAL_API_KEY: comprimento:', mistralApiKey.length,
      '| prefixo:', mistralApiKey.length >= 4 ? mistralApiKey.slice(0, 4) + '...' : '(vazia)',
    )

    if (!mistralApiKey) {
      throw new Error(
        'MISTRAL_API_KEY não encontrada. ' +
        'Supabase → Edge Functions → Secrets → adicione MISTRAL_API_KEY ' +
        'e faça redeploy: supabase functions deploy chat-documento',
      )
    }

    // ── Variáveis Supabase (necessárias para URL assinada de backup) ───────
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    // ── Baixar PDF e enviar para Mistral Files API ─────────────────────────
    console.log('📥 Baixando documento para upload na Mistral...')
    const pdfBytes = await fetchDocumentBytes(documentoUrl, supabaseUrl, serviceKey)
    console.log('✅ Download OK:', (pdfBytes.length / 1024 / 1024).toFixed(2), 'MB')

    console.log('📤 Fazendo upload do documento para Mistral Files API...')
    const { fileId, signedUrl } = await uploadToMistralFiles(pdfBytes, mistralApiKey)
    mistralFileId = fileId
    console.log('✅ Upload OK, fileId:', fileId)

    // ── Contexto da empresa ────────────────────────────────────────────────
    let contextoEmpresa = ''
    if (dadosEmpresa) {
      const info: string[] = []
      if (dadosEmpresa.razao_social)    info.push(`Razão Social: ${dadosEmpresa.razao_social}`)
      if (dadosEmpresa.nome_fantasia)   info.push(`Nome Fantasia: ${dadosEmpresa.nome_fantasia}`)
      if (dadosEmpresa.cnpj)            info.push(`CNPJ: ${dadosEmpresa.cnpj}`)
      if (dadosEmpresa.uf)              info.push(`Estado: ${dadosEmpresa.uf}`)
      if (dadosEmpresa.municipio)       info.push(`Município: ${dadosEmpresa.municipio}`)
      if (dadosEmpresa.cnae_principal)  info.push(`CNAE Principal: ${dadosEmpresa.cnae_principal}`)
      if (dadosEmpresa.porte_empresa)   info.push(`Porte: ${dadosEmpresa.porte_empresa}`)
      if (Array.isArray(dadosEmpresa.setores_atividades) && dadosEmpresa.setores_atividades.length > 0) {
        info.push(`Setores: ${dadosEmpresa.setores_atividades.join(', ')}`)
      }
      if (info.length > 0) {
        contextoEmpresa = `\n\nDADOS DA EMPRESA DO USUÁRIO:\n${info.join('\n')}\n\nUse essas informações para contextualizar a participação da empresa nesta licitação.`
      }
    }

    // ── Montar mensagens ───────────────────────────────────────────────────
    const systemPrompt = `# Identidade
Você é o Assistente do Sistema Licitação: especialista em licitações públicas brasileiras (Lei 14.133/2021, Pregão, RDC, etc.). Sua única fonte de verdade nesta conversa é o documento PDF anexado na última mensagem. Responda sempre com base nele e mantenha coerência com o histórico.

# Skills
- **Análise de edital**: extrair objeto, órgão, valor estimado, datas, modalidade, requisitos de habilitação e proposta.
- **Citação com origem**: toda informação deve ser atribuível ao documento (ex.: "Conforme o edital, seção X...").
- **Requisitos técnicos e jurídicos**: identificar exigências de qualificação técnica, econômico-financeira, certidões e cláusulas relevantes.
- **Comparação empresa × edital**: quando houver dados da empresa, avalie aderência (setor, CNAE, porte, UF).
- **Honestidade**: se a informação não existir no documento, diga explicitamente.
- **Nunca alucinar**: proibido inventar valores, datas, artigos ou requisitos não presentes no PDF.

# Regras
1. Responda SOMENTE com base no PDF e no histórico.
2. Cite seção/página/valor quando possível.
3. Em perguntas sobre participação da empresa, os requisitos devem vir exclusivamente do edital.
4. Respostas objetivas: 1-3 parágrafos, português PT-BR, tom profissional.${contextoEmpresa}

# Nota técnica
O PDF está anexado apenas na última mensagem do usuário via URL assinada Mistral.`

    const historicoLimitado = Array.isArray(historico) ? historico.slice(-MAX_HISTORICO) : []

    const messages = [
      { role: 'system', content: systemPrompt },
      ...historicoLimitado.map((msg: any) => ({
        role: msg.role,
        content: Array.isArray(msg.content)
          ? (msg.content.find((c: any) => c.type === 'text')?.text ?? msg.content)
          : msg.content,
      })),
      {
        role: 'user',
        content: [
          { type: 'text', text: pergunta },
          { type: 'document_url', document_url: signedUrl },
        ],
      },
    ]

    // ── Chamar Mistral Chat ────────────────────────────────────────────────
    const TIMEOUT_MS = 120_000
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

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
        temperature: 0.5,
        max_tokens: 2000,
      }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!mistralRes.ok) {
      const errorText = await mistralRes.text().catch(() => '')
      console.error(`Mistral chat ${mistralRes.status}:`, errorText)

      if (mistralRes.status === 401) {
        throw new Error(
          'Chave da Mistral rejeitada (401). ' +
          'Verifique: Supabase → Edge Functions → Secrets → MISTRAL_API_KEY ' +
          '(sem aspas, sem "Bearer") e faça redeploy: supabase functions deploy chat-documento',
        )
      }
      throw new Error(`Erro Mistral API (${mistralRes.status}): ${errorText}`)
    }

    const mistralData = await mistralRes.json()
    const resposta: string = mistralData?.choices?.[0]?.message?.content?.trim() ?? ''

    if (!resposta) {
      throw new Error('Resposta vazia da API Mistral. Tente reformular a pergunta.')
    }

    console.log('✅ Resposta recebida:', resposta.substring(0, 100) + '...')
    const usage = mistralData?.usage ?? {}
    console.log('📊 Tokens:', usage)

    // ── Registrar acesso ao documento ──────────────────────────────────────
    if (documentoId && supabaseUrl && serviceKey) {
      const supabase = createClient(supabaseUrl, serviceKey)
      await supabase.rpc('registrar_acesso_documento', { doc_id: documentoId }).catch(() => {})
    }

    // ── Cleanup do arquivo temporário na Mistral ───────────────────────────
    if (mistralFileId) {
      await deleteMistralFile(mistralFileId, mistralApiKey)
      mistralFileId = null
    }

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
    // Garantir cleanup do arquivo Mistral mesmo em caso de erro
    if (mistralFileId) {
      const rawKey = Deno.env.get('MISTRAL_API_KEY') || ''
      const key = sanitizeKey(rawKey)
      if (key) await deleteMistralFile(mistralFileId, key)
    }

    console.error('❌ Erro ao processar chat:', error)

    let mensagem: string = error?.message || 'Erro desconhecido ao processar chat'

    if (error?.name === 'AbortError' || mensagem.includes('signal has been aborted')) {
      mensagem =
        'A resposta demorou mais que o limite (120s). O documento pode ser muito grande. ' +
        'Tente uma pergunta mais objetiva ou aguarde e tente novamente.'
    }

    return new Response(
      JSON.stringify({ success: false, error: mensagem }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    )
  }
})

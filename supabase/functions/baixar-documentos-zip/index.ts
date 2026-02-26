// ============================================
// EDGE FUNCTION: BAIXAR DOCUMENTOS COMO ZIP
// ============================================
// Baixa todos os documentos de uma licitação e compacta em ZIP
// Retorna o ZIP como stream binário (não base64) para evitar corrupção e limites de tamanho

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import JSZip from 'https://esm.sh/jszip@3.10.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Expose-Headers': 'X-Nome-Arquivo, X-Docs-Sucesso, X-Docs-Erros, X-Docs-Total, Content-Disposition',
}

interface Documento {
  url?: string
  urlDocumento?: string
  linkDocumento?: string
  link?: string
  nomeArquivo?: string
  nome?: string
  nomeDocumento?: string
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    let body
    try {
      body = await req.json()
    } catch {
      return jsonResponse({ error: 'Body inválido' }, 400)
    }

    const { numeroControlePNCP, licitacaoId } = body

    if (!numeroControlePNCP && !licitacaoId) {
      return jsonResponse({ error: 'Parâmetros obrigatórios: numeroControlePNCP ou licitacaoId' }, 400)
    }

    console.log('📋 Parâmetros recebidos:', { numeroControlePNCP, licitacaoId })

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonResponse({ error: 'Configuração do Supabase não encontrada' }, 500)
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    let query = supabase
      .from('licitacoes')
      .select('id, numero_controle_pncp, anexos, dados_completos')
      .limit(1)

    if (licitacaoId) {
      query = query.eq('id', licitacaoId)
    } else {
      query = query.eq('numero_controle_pncp', numeroControlePNCP)
    }

    const { data: licitacoes, error: errorLicitacao } = await query

    if (errorLicitacao || !licitacoes || licitacoes.length === 0) {
      console.error('❌ Erro ao buscar licitação:', errorLicitacao)
      return jsonResponse({ error: 'Licitação não encontrada' }, 404)
    }

    const licitacao = licitacoes[0]
    console.log('✅ Licitação encontrada:', licitacao.numero_controle_pncp)

    // Extrair documentos de todas as fontes possíveis
    const documentos: Documento[] = []

    // 1. Documentos da tabela licitacao_documentos
    const { data: docsDb, error: errorDocs } = await supabase
      .from('licitacao_documentos')
      .select('url_documento, nome_arquivo')
      .eq('licitacao_id', licitacao.id)

    if (!errorDocs && docsDb && docsDb.length > 0) {
      docsDb.forEach(doc => {
        if (doc.url_documento) {
          documentos.push({
            urlDocumento: doc.url_documento,
            nomeArquivo: doc.nome_arquivo || 'Documento.pdf'
          })
        }
      })
      console.log(`📄 ${docsDb.length} documentos encontrados na tabela licitacao_documentos`)
    }

    // 2. Anexos do campo anexos (JSONB)
    if (licitacao.anexos && Array.isArray(licitacao.anexos)) {
      licitacao.anexos.forEach((anexo: any) => {
        const url = anexo.url || anexo.urlDocumento || anexo.linkDocumento || anexo.link
        const nome = anexo.nomeArquivo || anexo.nome || anexo.nomeDocumento || anexo.tipoDocumentoNome
        if (url && !documentos.some(d => d.urlDocumento === url)) {
          documentos.push({ urlDocumento: url, nomeArquivo: nome || 'Documento.pdf' })
        }
      })
      console.log(`📎 ${licitacao.anexos.length} anexos encontrados no campo anexos`)
    }

    // 3. Documentos de dados_completos (JSONB)
    if (licitacao.dados_completos) {
      let dadosCompletos = licitacao.dados_completos
      if (typeof dadosCompletos === 'string') {
        try { dadosCompletos = JSON.parse(dadosCompletos) } catch { /* ignore */ }
      }

      const extrairDocs = (arr: any[]) => {
        arr.forEach((item: any) => {
          const url = item.url || item.urlDocumento || item.linkDocumento || item.link
          const nome = item.nomeArquivo || item.nome || item.nomeDocumento
          if (url && !documentos.some(d => d.urlDocumento === url)) {
            documentos.push({ urlDocumento: url, nomeArquivo: nome || 'Documento.pdf' })
          }
        })
      }

      if (Array.isArray(dadosCompletos.anexos)) {
        extrairDocs(dadosCompletos.anexos)
        console.log(`📦 ${dadosCompletos.anexos.length} anexos encontrados em dados_completos`)
      }
      if (Array.isArray(dadosCompletos.documentos)) {
        extrairDocs(dadosCompletos.documentos)
        console.log(`📄 ${dadosCompletos.documentos.length} documentos encontrados em dados_completos`)
      }
    }

    if (documentos.length === 0) {
      return jsonResponse({ error: 'Nenhum documento encontrado para esta licitação' }, 404)
    }

    console.log(`📦 Total de ${documentos.length} documentos únicos`)

    // Criar ZIP
    let JSZipClass
    if (typeof JSZip === 'function') {
      JSZipClass = JSZip
    } else if (JSZip.default) {
      JSZipClass = JSZip.default
    } else if (JSZip.JSZip) {
      JSZipClass = JSZip.JSZip
    } else {
      throw new Error('Não foi possível inicializar JSZip')
    }

    const zip = new JSZipClass()
    let sucesso = 0
    let erros = 0
    const nomesUsados = new Map<string, number>()

    for (let i = 0; i < documentos.length; i++) {
      const doc = documentos[i]
      const url = doc.urlDocumento || doc.url || doc.linkDocumento || doc.link
      const nome = doc.nomeArquivo || doc.nome || `Documento_${i + 1}.pdf`

      if (!url) {
        erros++
        continue
      }

      const nomeBase = nome.replace(/[<>:"/\\|?*]/g, '_')
      const extIndex = nomeBase.lastIndexOf('.')
      const nomeSemExt = extIndex > 0 ? nomeBase.substring(0, extIndex) : nomeBase
      const extensao = extIndex > 0 ? nomeBase.substring(extIndex) : '.pdf'

      let nomeFinal = nomeBase
      if (nomesUsados.has(nomeBase)) {
        const contador = nomesUsados.get(nomeBase)! + 1
        nomesUsados.set(nomeBase, contador)
        nomeFinal = `${nomeSemExt}_${contador}${extensao}`
      } else {
        nomesUsados.set(nomeBase, 0)
      }

      try {
        console.log(`📥 Baixando ${i + 1}/${documentos.length}: ${nomeFinal}`)

        let downloadResponse: Response | null = null
        let retries = 3

        while (retries > 0) {
          try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 30000)

            downloadResponse = await fetch(url, {
              signal: controller.signal,
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PNCP-Processor/1.0)' }
            })

            clearTimeout(timeoutId)

            if (downloadResponse.ok) break
            if (downloadResponse.status >= 500 && retries > 1) {
              retries--
              await new Promise(r => setTimeout(r, 2000))
              continue
            }
            throw new Error(`HTTP ${downloadResponse.status}`)
          } catch (error) {
            if ((error as Error).name === 'AbortError') {
              throw new Error('Timeout ao baixar documento (30s)')
            }
            retries--
            if (retries > 0) await new Promise(r => setTimeout(r, 2000))
            else throw error
          }
        }

        if (!downloadResponse || !downloadResponse.ok) {
          throw new Error('Falha ao baixar documento após tentativas')
        }

        const arrayBuffer = await downloadResponse.arrayBuffer()
        zip.file(nomeFinal, arrayBuffer)
        sucesso++
        console.log(`✅ ${i + 1}/${documentos.length} adicionado: ${nomeFinal} (${(arrayBuffer.byteLength / 1024).toFixed(0)} KB)`)
      } catch (error) {
        console.error(`❌ Erro doc ${i + 1} (${nome}):`, (error as Error).message)
        erros++
      }
    }

    if (sucesso === 0) {
      return jsonResponse({ error: 'Não foi possível baixar nenhum documento' }, 500)
    }

    console.log(`📦 Compactando ${sucesso} documentos em ZIP...`)

    // Gerar ZIP como Uint8Array e retornar como resposta BINÁRIA
    const zipUint8Array = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } })

    const nomeArquivo = `Documentos_${licitacao.numero_controle_pncp}_${new Date().toISOString().split('T')[0]}.zip`
    console.log(`✅ ZIP criado! ${sucesso} docs, ${erros} erros. Tamanho: ${(zipUint8Array.length / 1024 / 1024).toFixed(2)}MB`)

    return new Response(zipUint8Array, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${nomeArquivo}"`,
        'X-Docs-Sucesso': String(sucesso),
        'X-Docs-Erros': String(erros),
        'X-Docs-Total': String(documentos.length),
        'X-Nome-Arquivo': nomeArquivo,
      },
    })

  } catch (error) {
    console.error('❌ Erro ao processar requisição:', error)
    return jsonResponse({ error: (error as Error).message || 'Erro interno do servidor' }, 500)
  }
})

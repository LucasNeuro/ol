// ============================================
// EDGE FUNCTION: BAIXAR DOCUMENTOS COMO ZIP
// ============================================
// Baixa todos os documentos de uma licitação e compacta em ZIP

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import JSZip from 'https://esm.sh/jszip@3.10.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
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

    const { numeroControlePNCP, licitacaoId } = body

    if (!numeroControlePNCP && !licitacaoId) {
      return new Response(
        JSON.stringify({ error: 'Parâmetros obrigatórios: numeroControlePNCP ou licitacaoId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('📋 Parâmetros recebidos:', { numeroControlePNCP, licitacaoId })

    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Variáveis de ambiente não configuradas')
      return new Response(
        JSON.stringify({ error: 'Configuração do Supabase não encontrada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Buscar licitação no banco
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
      return new Response(
        JSON.stringify({ error: 'Licitação não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
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
        if (url) {
          // Evitar duplicatas baseado na URL
          if (!documentos.some(d => d.urlDocumento === url)) {
            documentos.push({
              urlDocumento: url,
              nomeArquivo: nome || 'Documento.pdf'
            })
          }
        }
      })
      console.log(`📎 ${licitacao.anexos.length} anexos encontrados no campo anexos`)
    }

    // 3. Documentos de dados_completos (JSONB)
    if (licitacao.dados_completos) {
      let dadosCompletos = licitacao.dados_completos
      if (typeof dadosCompletos === 'string') {
        try {
          dadosCompletos = JSON.parse(dadosCompletos)
        } catch (e) {
          console.warn('⚠️ Erro ao parsear dados_completos:', e)
        }
      }

      // Anexos em dados_completos
      if (dadosCompletos.anexos && Array.isArray(dadosCompletos.anexos)) {
        dadosCompletos.anexos.forEach((anexo: any) => {
          const url = anexo.url || anexo.urlDocumento || anexo.linkDocumento || anexo.link
          const nome = anexo.nomeArquivo || anexo.nome || anexo.nomeDocumento
          if (url) {
            // Evitar duplicatas
            if (!documentos.some(d => d.urlDocumento === url)) {
              documentos.push({
                urlDocumento: url,
                nomeArquivo: nome || 'Documento.pdf'
              })
            }
          }
        })
        console.log(`📦 ${dadosCompletos.anexos.length} anexos encontrados em dados_completos`)
      }

      // Documentos em dados_completos
      if (dadosCompletos.documentos && Array.isArray(dadosCompletos.documentos)) {
        dadosCompletos.documentos.forEach((doc: any) => {
          const url = doc.url || doc.urlDocumento || doc.linkDocumento || doc.link
          const nome = doc.nomeArquivo || doc.nome || doc.nomeDocumento
          if (url) {
            // Evitar duplicatas
            if (!documentos.some(d => d.urlDocumento === url)) {
              documentos.push({
                urlDocumento: url,
                nomeArquivo: nome || 'Documento.pdf'
              })
            }
          }
        })
        console.log(`📄 ${dadosCompletos.documentos.length} documentos encontrados em dados_completos`)
      }
    }

    if (documentos.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Nenhum documento encontrado para esta licitação' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📦 Total de ${documentos.length} documentos únicos encontrados após remover duplicatas`)
    console.log(`📋 Lista de documentos:`, documentos.map((d, i) => `${i + 1}. ${d.nomeArquivo} (${d.urlDocumento?.substring(0, 50)}...)`))

    // Criar ZIP
    // JSZip pode vir como default export ou named export dependendo do esm.sh
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
    const nomesUsados = new Map<string, number>() // Para rastrear nomes duplicados

    // Baixar cada documento e adicionar ao ZIP
    for (let i = 0; i < documentos.length; i++) {
      const doc = documentos[i]
      const url = doc.urlDocumento || doc.url || doc.linkDocumento || doc.link
      let nome = doc.nomeArquivo || doc.nome || `Documento_${i + 1}.pdf`

      if (!url) {
        console.warn(`⚠️ Documento ${i + 1} sem URL, pulando...`)
        erros++
        continue
      }

      // Garantir nome único no ZIP (evitar sobrescrita)
      const nomeBase = nome.replace(/[<>:"/\\|?*]/g, '_')
      const extIndex = nomeBase.lastIndexOf('.')
      const nomeSemExt = extIndex > 0 ? nomeBase.substring(0, extIndex) : nomeBase
      const extensao = extIndex > 0 ? nomeBase.substring(extIndex) : '.pdf'
      
      let nomeFinal = nomeBase
      if (nomesUsados.has(nomeBase)) {
        // Se já existe, incrementar contador e renomear
        const contador = nomesUsados.get(nomeBase)! + 1
        nomesUsados.set(nomeBase, contador)
        nomeFinal = `${nomeSemExt}_${contador}${extensao}`
      } else {
        // Primeira ocorrência, marcar como usado
        nomesUsados.set(nomeBase, 0)
      }

      try {
        console.log(`📥 Baixando documento ${i + 1}/${documentos.length}: ${nome} -> ${nomeFinal}`)

        // Tentar baixar com timeout e retry
        let downloadResponse
        let retries = 3
        let lastError

        while (retries > 0) {
          try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout

            downloadResponse = await fetch(url, {
              signal: controller.signal,
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; PNCP-Processor/1.0)'
              }
            })

            clearTimeout(timeoutId)

            if (downloadResponse.ok) {
              break
            } else if (downloadResponse.status >= 500 && retries > 1) {
              retries--
              await new Promise(resolve => setTimeout(resolve, 2000))
              continue
            } else {
              throw new Error(`Erro ao baixar documento: ${downloadResponse.status}`)
            }
          } catch (error) {
            lastError = error
            if (error.name === 'AbortError') {
              throw new Error('Timeout ao baixar documento (30s)')
            }
            retries--
            if (retries > 0) {
              await new Promise(resolve => setTimeout(resolve, 2000))
            }
          }
        }

        if (!downloadResponse || !downloadResponse.ok) {
          throw lastError || new Error(`Erro ao baixar documento após tentativas`)
        }

        // Obter blob do documento
        const blob = await downloadResponse.arrayBuffer()
        
        // Adicionar ao ZIP (já tem nome sanitizado e único)
        zip.file(nomeFinal, blob)
        sucesso++
        console.log(`✅ Documento ${i + 1}/${documentos.length} adicionado ao ZIP: ${nomeFinal}`)
      } catch (error) {
        console.error(`❌ Erro ao baixar documento ${i + 1}/${documentos.length} (${nome}):`, error)
        erros++
      }
    }

    if (sucesso === 0) {
      return new Response(
        JSON.stringify({ error: 'Não foi possível baixar nenhum documento' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📦 Compactando ${sucesso} documentos em ZIP...`)

    // Gerar ZIP como Uint8Array (mais eficiente)
    const zipUint8Array = await zip.generateAsync({ type: 'uint8array' })
    
    // Converter Uint8Array para base64 de forma eficiente
    let binary = ''
    const chunkSize = 8192 // Processar em chunks para evitar problemas de memória
    for (let i = 0; i < zipUint8Array.length; i += chunkSize) {
      const chunk = zipUint8Array.subarray(i, i + chunkSize)
      binary += String.fromCharCode.apply(null, Array.from(chunk))
    }
    const base64 = btoa(binary)

    console.log(`✅ ZIP criado com sucesso! ${sucesso} documentos, ${erros} erros. Tamanho: ${(zipUint8Array.length / 1024 / 1024).toFixed(2)}MB`)

    // Retornar ZIP como base64
    return new Response(
      JSON.stringify({
        success: true,
        zipBase64: base64,
        nomeArquivo: `Documentos_${licitacao.numero_controle_pncp}_${new Date().toISOString().split('T')[0]}.zip`,
        documentosBaixados: sucesso,
        documentosErros: erros,
        totalDocumentos: documentos.length
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
    console.error('❌ Erro ao processar requisição:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})


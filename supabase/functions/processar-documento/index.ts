// ============================================
// EDGE FUNCTION: PROCESSAR DOCUMENTO
// ============================================
// Faz download de PDF do PNCP e armazena no Supabase Storage

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse do body com tratamento de erro
    let body
    try {
      body = await req.json()
    } catch (parseError) {
      console.error('❌ Erro ao fazer parse do JSON:', parseError)
      throw new Error('Erro ao processar requisição: body inválido')
    }

    const { urlDocumento, nomeArquivo, licitacaoId } = body

    console.log('📋 Parâmetros recebidos:', { urlDocumento, nomeArquivo, licitacaoId })

    if (!urlDocumento || !nomeArquivo) {
      throw new Error('Parâmetros obrigatórios: urlDocumento, nomeArquivo')
    }

    // Se não tiver licitacaoId, usar pasta de visualização
    const pastaStorage = licitacaoId || 'visualizacao'

    console.log('📥 Baixando documento:', urlDocumento)

    // 1. Fazer download do PDF com timeout e retry
    let downloadResponse
    let retries = 3
    let lastError
    
    while (retries > 0) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout
        
        downloadResponse = await fetch(urlDocumento, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; PNCP-Processor/1.0)'
          }
        })
        
        clearTimeout(timeoutId)
        
        if (downloadResponse.ok) {
          break
        } else if (downloadResponse.status >= 500 && retries > 1) {
          // Retry em caso de erro do servidor
          retries--
          await new Promise(resolve => setTimeout(resolve, 2000)) // Aguardar 2s antes de retry
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
      throw lastError || new Error(`Erro ao baixar documento após ${3 - retries} tentativas`)
    }

    // Baixar arquivo primeiro para validar
    let pdfBlob = await downloadResponse.blob()
    let pdfArrayBuffer = await pdfBlob.arrayBuffer()
    let pdfBuffer = new Uint8Array(pdfArrayBuffer)
    const contentType = downloadResponse.headers.get('content-type') || ''
    const urlLower = urlDocumento.toLowerCase()
    const hasPdfExtension = urlLower.includes('.pdf')

    // Detecção de ZIP por bytes (PK = 0x50 0x4B; evita dependência de TextDecoder)
    const isZipByBytes = pdfBuffer.length >= 4 &&
      pdfBuffer[0] === 0x50 && pdfBuffer[1] === 0x4B &&
      (pdfBuffer[2] === 0x03 || pdfBuffer[2] === 0x05) // 03 04 = local file, 05 06 = empty zip

    let nomeArquivoFinal = nomeArquivo
    if (isZipByBytes) {
      console.log('📦 Arquivo detectado como ZIP (PK), descompactando para obter o primeiro PDF...')
      try {
        const JSZip = (await import('https://esm.sh/jszip@3.10.1')).default
        const zip = await JSZip.loadAsync(pdfBuffer)
        const entry = Object.entries(zip.files).find(([path, e]) => {
          const entry = e as { dir?: boolean }
          if (entry.dir) return false
          const nome = path.split('/').pop() || path
          const ext = nome.toLowerCase().split('.').pop()
          return ext === 'pdf'
        })
        if (!entry) {
          throw new Error('O arquivo é um ZIP mas não contém nenhum PDF. Descompacte manualmente e abra o PDF.')
        }
        const [path, pdfEntry] = entry
        pdfBuffer = new Uint8Array(await (pdfEntry as any).async('uint8array'))
        nomeArquivoFinal = path.split('/').pop() || nomeArquivo.replace(/\.zip$/i, '.pdf')
        console.log('✅ Primeiro PDF extraído do ZIP:', nomeArquivoFinal, 'tamanho:', (pdfBuffer.length / 1024).toFixed(1), 'KB')
      } catch (zipErr) {
        console.error('❌ Erro ao descompactar ZIP:', zipErr)
        throw new Error(zipErr?.message || 'Arquivo parece ser ZIP mas não foi possível descompactar. Tente baixar e abrir manualmente.')
      }
    }

    // Validação de PDF (após eventual extração do ZIP)
    const isPdfSignature = pdfBuffer.length >= 4 &&
      pdfBuffer[0] === 0x25 && pdfBuffer[1] === 0x50 && pdfBuffer[2] === 0x44 && pdfBuffer[3] === 0x46 // %PDF
    const isContentTypePDF = contentType.includes('pdf')

    if (isPdfSignature) {
      console.log('✅ Arquivo tem assinatura PDF válida')
    } else {
      if (!isContentTypePDF && !hasPdfExtension) {
        console.warn('⚠️ Validação de PDF falhou:', { contentType, hasPdfExtension, isPdfSignature, firstBytes: pdfBuffer.slice(0, 4).join(',') })
        throw new Error(`Tipo de arquivo inválido: ${contentType || 'desconhecido'}. Esperado: PDF ou ZIP contendo PDF.`)
      }
      console.warn('⚠️ Arquivo sem assinatura %PDF; aceitando por extensão/content-type.')
    }

    console.log('✅ Download concluído:', (pdfBuffer.length / 1024 / 1024).toFixed(2), 'MB')

    // Verificar tamanho (max 70MB para permitir documentos maiores)
    const tamanhoMaximoMB = 70
    const tamanhoMaximoBytes = tamanhoMaximoMB * 1024 * 1024
    if (pdfBuffer.length > tamanhoMaximoBytes) {
      const tamanhoMB = (pdfBuffer.length / 1024 / 1024).toFixed(2)
      throw new Error(`Arquivo muito grande (${tamanhoMB} MB). Máximo permitido: ${tamanhoMaximoMB}MB. O documento pode ser visualizado diretamente no site do PNCP.`)
    }

    // 2. Criar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    console.log('🔍 Verificando variáveis de ambiente...')
    console.log('🔍 SUPABASE_URL:', supabaseUrl ? 'Configurado' : 'NÃO CONFIGURADO')
    console.log('🔍 SERVICE_ROLE_KEY:', supabaseServiceKey ? 'Configurado' : 'NÃO CONFIGURADO')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Variáveis de ambiente não configuradas')
      console.error('❌ SUPABASE_URL:', supabaseUrl ? 'OK' : 'FALTANDO')
      console.error('❌ SERVICE_ROLE_KEY:', supabaseServiceKey ? 'OK' : 'FALTANDO')
      throw new Error('Configuração do Supabase não encontrada. Verifique as variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.')
    }
    
    console.log('🔧 Criando cliente Supabase...')
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 3. Gerar nome único para o arquivo
    const timestamp = Date.now()
    const sanitizedFileName = nomeArquivoFinal
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_')
    
    const storagePath = `${pastaStorage}/${timestamp}_${sanitizedFileName}`

    console.log('📤 Upload para Supabase Storage:', storagePath)

    // 4. Upload para Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('editais')
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      console.error('❌ Erro no upload:', uploadError)
      throw uploadError
    }

    console.log('✅ Upload concluído:', uploadData.path)

    // 5. Obter URL pública (garantir que seja acessível publicamente)
    const { data: { publicUrl } } = supabase.storage
      .from('editais')
      .getPublicUrl(storagePath)

    console.log('🔗 URL pública gerada:', publicUrl)
    
    // IMPORTANTE: O Document QnA do Mistral precisa de URL pública e acessível
    // Verificar se o bucket está configurado como público no Dashboard do Supabase
    // Storage > Buckets > editais > Configurações > Público
    
    // Validar que a URL é acessível (teste opcional)
    try {
      const testResponse = await fetch(publicUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) })
      if (testResponse.ok) {
        console.log('✅ URL pública é acessível')
      } else {
        console.warn('⚠️ URL pública pode não ser acessível:', testResponse.status)
      }
    } catch (error) {
      console.warn('⚠️ Não foi possível verificar acessibilidade da URL:', error.message)
      console.warn('⚠️ Certifique-se de que o bucket "editais" está configurado como PÚBLICO')
    }

    // 6. Obter usuário autenticado
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    let userId = null
    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token)
      userId = user?.id
    }

    // 7. Registrar no banco de dados (apenas se tiver licitacaoId válido)
    let docData = null
    if (licitacaoId && licitacaoId !== 'visualizacao') {
      const { data: docDataInsert, error: dbError } = await supabase
        .from('documentos_processados')
        .insert({
          licitacao_id: licitacaoId,
          usuario_id: userId,
          nome_arquivo: nomeArquivoFinal,
          url_original: urlDocumento,
          url_storage: publicUrl,
          tamanho_bytes: pdfBuffer.length,
        })
        .select()
        .single()

      if (dbError) {
        console.error('⚠️ Erro ao registrar no banco:', dbError)
        // Não falhar a requisição se o registro falhar
      } else {
        docData = docDataInsert
      }
    } else {
      console.log('ℹ️ Documento de visualização - não registrando no banco')
    }

    // 8. Retornar sucesso
    return new Response(
      JSON.stringify({
        success: true,
        documento: {
          id: docData?.id,
          nome: nomeArquivoFinal,
          urlStorage: publicUrl,
          urlOriginal: urlDocumento,
          tamanhoMB: (pdfBuffer.length / 1024 / 1024).toFixed(2),
          licitacaoId,
        },
        message: 'Documento processado com sucesso!'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('❌ Erro ao processar documento:', error)
    console.error('❌ Stack trace:', error.stack)
    
    console.error('❌ Error name:', error.name)
    console.error('❌ Error message:', error.message)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro desconhecido ao processar documento',
        details: error.stack || 'Sem detalhes adicionais'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})


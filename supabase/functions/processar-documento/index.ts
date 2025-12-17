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
    const pdfBlob = await downloadResponse.blob()
    const pdfArrayBuffer = await pdfBlob.arrayBuffer()
    const pdfBuffer = new Uint8Array(pdfArrayBuffer)

    // Validação robusta de PDF:
    // 1. Verificar assinatura do arquivo (PDF sempre começa com "%PDF") - MAIS IMPORTANTE
    const firstBytes = new TextDecoder().decode(pdfBuffer.slice(0, 4))
    const isPdfSignature = firstBytes === '%PDF'
    
    // 2. Verificar Content-Type
    const contentType = downloadResponse.headers.get('content-type') || ''
    const isContentTypePDF = contentType.includes('pdf')
    const isOctetStream = contentType.includes('application/octet-stream')
    
    // 3. Verificar extensão na URL
    const urlLower = urlDocumento.toLowerCase()
    const hasPdfExtension = urlLower.includes('.pdf') || urlLower.includes('pdf')
    
    // Aceitar se tiver assinatura PDF (mesmo que Content-Type seja application/octet-stream)
    // Muitos servidores retornam application/octet-stream mesmo para PDFs válidos
    if (isPdfSignature) {
      // Se tem assinatura PDF, aceitar mesmo que Content-Type seja application/octet-stream
      console.log('✅ Arquivo tem assinatura PDF válida, aceitando mesmo com Content-Type:', contentType)
    } else {
      // Se não tem assinatura PDF, verificar outras validações
      if (!isContentTypePDF && !hasPdfExtension) {
        console.warn('⚠️ Validação de PDF falhou:', {
          contentType,
          hasPdfExtension,
          isPdfSignature,
          firstBytes
        })
        throw new Error(`Tipo de arquivo inválido: ${contentType || 'desconhecido'}. Apenas PDF é permitido.`)
      }
      // Se tem Content-Type PDF ou extensão PDF mas não tem assinatura, avisar mas aceitar
      console.warn('⚠️ Arquivo parece ser PDF mas não tem assinatura válida. Aceitando mesmo assim.')
    }

    console.log('✅ Validação de PDF passou:', {
      contentType,
      hasPdfExtension,
      isPdfSignature
    })

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
    const sanitizedFileName = nomeArquivo
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
          nome_arquivo: nomeArquivo,
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
          nome: nomeArquivo,
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


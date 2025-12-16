/**
 * Serviço para detectar e descompactar arquivos ZIP
 * Extrai arquivos de arquivos ZIP e retorna lista de arquivos internos
 */

/**
 * Verifica se um arquivo é um ZIP baseado na URL ou nome
 */
export function isZipFile(url, nomeArquivo) {
  if (!url && !nomeArquivo) return false
  
  const urlLower = (url || '').toLowerCase()
  const nomeLower = (nomeArquivo || '').toLowerCase()
  
  return urlLower.includes('.zip') || 
         nomeLower.includes('.zip') ||
         urlLower.includes('application/zip') ||
         urlLower.includes('application/x-zip-compressed')
}

/**
 * Baixa um arquivo ZIP e descompacta, retornando lista de arquivos internos
 * Usa Edge Function para contornar problemas de CORS
 * @param {string} url - URL do arquivo ZIP
 * @param {string} nomeArquivo - Nome do arquivo ZIP
 * @returns {Promise<Array>} Array de objetos { nome, url, tipo, tamanho }
 */
export async function descompactarZip(url, nomeArquivo) {
  try {
    console.log('📦 [ZIP] Iniciando descompactação:', { url, nomeArquivo })
    
    // Importar JSZip dinamicamente
    const JSZip = (await import('jszip')).default
    
    // Tentar usar Edge Function primeiro para contornar CORS
    let blob
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      if (supabaseUrl) {
        console.log('🔄 [ZIP] Tentando baixar via Edge Function...')
        
        // Obter token de autenticação
        const { createClient } = await import('@supabase/supabase-js')
        const { supabase } = await import('@/lib/supabase')
        const { data: session } = await supabase.auth.getSession()
        const token = session?.session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY
        
        // Chamar Edge Function
        const response = await fetch(
          `${supabaseUrl}/functions/v1/descompactar-zip`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              urlZip: url,
              nomeArquivo: nomeArquivo || 'arquivo.zip'
            }),
          }
        )
        
        if (response.ok) {
          const result = await response.json()
          console.log('📦 [ZIP] Resposta da Edge Function:', { 
            success: result.success, 
            temBase64: !!result.zipBase64,
            tamanho: result.tamanho 
          })
          
          if (result.success && result.zipBase64) {
            console.log('✅ [ZIP] ZIP baixado via Edge Function, convertendo base64...')
            console.log('📊 [ZIP] Tamanho do base64:', result.zipBase64.length, 'caracteres')
            
            // Converter base64 para blob de forma eficiente
            const base64Data = result.zipBase64
            
            try {
              // Decodificar base64 para ArrayBuffer
              const binaryString = atob(base64Data)
              const len = binaryString.length
              const bytes = new Uint8Array(len)
              for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i)
              }
              
              blob = new Blob([bytes], { type: 'application/zip' })
              console.log('✅ [ZIP] Blob criado a partir do base64, tamanho:', blob.size, 'bytes')
              
              // Validar que o tamanho está correto
              if (blob.size !== result.tamanho) {
                console.warn('⚠️ [ZIP] Tamanho do blob não corresponde ao esperado:', {
                  esperado: result.tamanho,
                  obtido: blob.size
                })
              }
            } catch (conversionError) {
              console.error('❌ [ZIP] Erro ao converter base64 para blob:', conversionError)
              throw new Error(`Erro ao processar dados do ZIP: ${conversionError.message}`)
            }
          } else {
            const errorMsg = result.error || 'Erro desconhecido na Edge Function'
            console.error('❌ [ZIP] Edge Function retornou erro:', errorMsg)
            throw new Error(errorMsg)
          }
        } else {
          const errorText = await response.text().catch(() => 'Erro desconhecido')
          console.error('❌ [ZIP] Edge Function retornou status:', response.status, errorText)
          throw new Error(`Edge Function retornou erro ${response.status}: ${errorText}`)
        }
      } else {
        throw new Error('VITE_SUPABASE_URL não configurado')
      }
    } catch (edgeError) {
      console.warn('⚠️ [ZIP] Erro ao usar Edge Function, tentando download direto:', edgeError.message)
      
      // Fallback: tentar baixar diretamente
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Erro ao baixar ZIP: ${response.status} ${response.statusText}. Tente novamente mais tarde.`)
      }
      blob = await response.blob()
    }
    
    console.log('✅ [ZIP] Arquivo baixado, tamanho:', blob.size, 'bytes')
    
    // Descompactar usando JSZip
    const zip = await JSZip.loadAsync(blob)
    console.log('✅ [ZIP] Arquivo descompactado, arquivos encontrados:', Object.keys(zip.files).length)
    
    // Processar cada arquivo no ZIP
    const arquivos = []
    const promises = []
    
    for (const [caminho, arquivo] of Object.entries(zip.files)) {
      // Ignorar pastas (arquivos que terminam com /)
      if (arquivo.dir) continue
      
      // Ignorar arquivos muito grandes (> 50MB) para evitar problemas de memória
      if (arquivo._data && arquivo._data.uncompressedSize > 50 * 1024 * 1024) {
        console.warn(`⚠️ [ZIP] Arquivo muito grande ignorado: ${caminho} (${(arquivo._data.uncompressedSize / 1024 / 1024).toFixed(2)}MB)`)
        continue
      }
      
      // Extrair nome do arquivo do caminho
      const nome = caminho.split('/').pop() || caminho
      
      // Determinar tipo do arquivo pela extensão
      const extensao = nome.split('.').pop()?.toLowerCase() || ''
      const tipo = getTipoArquivo(extensao)
      
      // Criar URL blob para o arquivo
      promises.push(
        arquivo.async('blob').then(blob => {
          const blobUrl = URL.createObjectURL(blob)
          
          arquivos.push({
            nome,
            caminho,
            url: blobUrl,
            tipo,
            extensao,
            tamanho: blob.size,
            nomeOriginal: nomeArquivo,
            caminhoZip: caminho
          })
          
          console.log(`✅ [ZIP] Arquivo extraído: ${nome} (${(blob.size / 1024).toFixed(2)}KB)`)
        })
      )
    }
    
    // Aguardar todos os arquivos serem processados
    await Promise.all(promises)
    
    console.log(`✅ [ZIP] Descompactação concluída: ${arquivos.length} arquivos extraídos`)
    return arquivos
    
  } catch (error) {
    console.error('❌ [ZIP] Erro ao descompactar:', error)
    throw new Error(`Erro ao descompactar arquivo ZIP: ${error.message}`)
  }
}

/**
 * Determina o tipo de arquivo pela extensão
 */
function getTipoArquivo(extensao) {
  const tipos = {
    'pdf': 'PDF',
    'doc': 'Word',
    'docx': 'Word',
    'xls': 'Excel',
    'xlsx': 'Excel',
    'txt': 'Texto',
    'jpg': 'Imagem',
    'jpeg': 'Imagem',
    'png': 'Imagem',
    'gif': 'Imagem',
    'xml': 'XML',
    'html': 'HTML',
    'htm': 'HTML',
    'csv': 'CSV',
    'rtf': 'RTF',
    'odt': 'OpenDocument',
    'ods': 'OpenDocument'
  }
  
  return tipos[extensao] || 'Arquivo'
}

/**
 * Limpa URLs blob criadas para liberar memória
 */
export function limparBlobUrls(arquivos) {
  if (!arquivos || !Array.isArray(arquivos)) return
  
  arquivos.forEach(arquivo => {
    if (arquivo.url && arquivo.url.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(arquivo.url)
      } catch (e) {
        console.warn('⚠️ [ZIP] Erro ao limpar blob URL:', e)
      }
    }
  })
}


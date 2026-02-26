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
    const JSZip = (await import('jszip')).default
    
    let blob
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      if (supabaseUrl) {
        const { supabase } = await import('@/lib/supabase')
        const { data: session } = await supabase.auth.getSession()
        const token = session?.session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY
        
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
        
        if (!response.ok) {
          const contentType = response.headers.get('content-type') || ''
          if (contentType.includes('application/json')) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.error || `Edge Function erro ${response.status}`)
          }
          throw new Error(`Edge Function erro ${response.status}`)
        }

        // A resposta agora é binária (application/zip) — receber como blob diretamente
        blob = await response.blob()
      } else {
        throw new Error('VITE_SUPABASE_URL não configurado')
      }
    } catch (edgeError) {
      // Fallback: tentar baixar diretamente (pode falhar por CORS)
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Erro ao baixar ZIP: ${response.status} ${response.statusText}. Tente novamente mais tarde.`)
      }
      blob = await response.blob()
    }
    
    // Descompactar usando JSZip
    const zip = await JSZip.loadAsync(blob)
    
    const arquivos = []
    const promises = []
    
    for (const [caminho, arquivo] of Object.entries(zip.files)) {
      if (arquivo.dir) continue
      
      if (arquivo._data && arquivo._data.uncompressedSize > 50 * 1024 * 1024) {
        continue
      }
      
      const nome = caminho.split('/').pop() || caminho
      const extensao = nome.split('.').pop()?.toLowerCase() || ''
      const tipo = getTipoArquivo(extensao)
      
      promises.push(
        arquivo.async('blob').then(fileBlob => {
          const blobUrl = URL.createObjectURL(fileBlob)
          
          arquivos.push({
            nome,
            caminho,
            url: blobUrl,
            tipo,
            extensao,
            tamanho: fileBlob.size,
            nomeOriginal: nomeArquivo,
            caminhoZip: caminho
          })
        })
      )
    }
    
    await Promise.all(promises)
    
    return arquivos
    
  } catch (error) {
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
      }
    }
  })
}

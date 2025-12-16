// Edge Function para baixar arquivos ZIP (contorna CORS)
// O cliente descompacta usando JSZip após receber os dados
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
    const { urlZip, nomeArquivo } = await req.json()
    
    if (!urlZip) {
      throw new Error('URL do arquivo ZIP é obrigatória')
    }

    console.log('📦 [Edge Function] Baixando ZIP:', { urlZip, nomeArquivo })

    // Baixar o arquivo ZIP do servidor (sem CORS)
    const zipResponse = await fetch(urlZip, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
    
    if (!zipResponse.ok) {
      throw new Error(`Erro ao baixar ZIP: ${zipResponse.status} ${zipResponse.statusText}`)
    }

    const zipArrayBuffer = await zipResponse.arrayBuffer()
    const zipBuffer = new Uint8Array(zipArrayBuffer)
    
    console.log('✅ [Edge Function] ZIP baixado, tamanho:', zipBuffer.length, 'bytes')

   
    if (zipBuffer.length > 50 * 1024 * 1024) {
      throw new Error('Arquivo ZIP muito grande. Máximo: 50MB')
    }

    
    let base64 = ''
    try {
      
      const base64Array = []
      const chunkSize = 8192
      for (let i = 0; i < zipBuffer.length; i += chunkSize) {
        const chunk = zipBuffer.slice(i, Math.min(i + chunkSize, zipBuffer.length))
        // Converter chunk para base64
        const chunkBase64 = btoa(String.fromCharCode.apply(null, Array.from(chunk)))
        base64Array.push(chunkBase64)
      }
      base64 = base64Array.join('')
    } catch (conversionError) {
      console.error('❌ Erro ao converter para base64:', conversionError)
      throw new Error(`Erro ao converter ZIP para base64: ${conversionError.message}`)
    }
    
    console.log('✅ [Edge Function] ZIP convertido para base64')
    
    return new Response(
      JSON.stringify({ 
        success: true,
        zipBase64: base64,
        tamanho: zipBuffer.length,
        nomeArquivo: nomeArquivo || 'arquivo.zip',
        mensagem: 'ZIP baixado com sucesso. Descompacte no cliente.'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('❌ [Edge Function] Erro:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Erro ao processar arquivo ZIP'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})


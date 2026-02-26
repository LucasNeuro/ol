// Edge Function para baixar arquivos ZIP (contorna CORS)
// Retorna o ZIP como stream binário — o cliente descompacta usando JSZip
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
      throw new Error('Erro ao processar requisição: body inválido')
    }

    const { urlZip, nomeArquivo } = body

    if (!urlZip) {
      throw new Error('URL do arquivo ZIP é obrigatória')
    }

    console.log('📦 [Edge Function] Baixando ZIP:', { urlZip, nomeArquivo })

    let zipResponse: Response | null = null
    let retries = 3

    while (retries > 0) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000)

        zipResponse = await fetch(urlZip, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        })

        clearTimeout(timeoutId)

        if (zipResponse.ok) break
        if (zipResponse.status >= 500 && retries > 1) {
          retries--
          await new Promise(r => setTimeout(r, 2000))
          continue
        }
        throw new Error(`Erro ao baixar ZIP: ${zipResponse.status} ${zipResponse.statusText}`)
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          throw new Error('Timeout ao baixar ZIP (30s)')
        }
        retries--
        if (retries > 0) await new Promise(r => setTimeout(r, 2000))
        else throw error
      }
    }

    if (!zipResponse || !zipResponse.ok) {
      throw new Error('Erro ao baixar ZIP após tentativas')
    }

    const zipArrayBuffer = await zipResponse.arrayBuffer()
    const zipBuffer = new Uint8Array(zipArrayBuffer)

    console.log('✅ [Edge Function] ZIP baixado, tamanho:', zipBuffer.length, 'bytes')

    if (zipBuffer.length > 50 * 1024 * 1024) {
      throw new Error('Arquivo ZIP muito grande. Máximo: 50MB')
    }

    // Retornar ZIP como resposta binária direta (sem base64)
    return new Response(zipBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${nomeArquivo || 'arquivo.zip'}"`,
        'X-Zip-Size': String(zipBuffer.length),
      },
    })
  } catch (error) {
    console.error('❌ [Edge Function] Erro:', (error as Error).message)

    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message || 'Erro desconhecido ao processar arquivo ZIP',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

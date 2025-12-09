// ============================================
// EDGE FUNCTION: processar-fila-alertas
// ============================================
// Processa a fila de alertas pendentes
// Pode ser chamada periodicamente ou manualmente

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { limite = 50 } = await req.json().catch(() => ({ limite: 50 }))

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Buscar alertas pendentes na fila
    const { data: fila, error: filaError } = await supabase
      .from('alertas_fila')
      .select('*')
      .eq('processado', false)
      .order('criado_em', { ascending: true })
      .limit(limite)

    if (filaError) {
      throw new Error(`Erro ao buscar fila: ${filaError.message}`)
    }

    if (!fila || fila.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhum alerta pendente', processados: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    console.log(`📋 Processando ${fila.length} alertas pendentes`)

    let processados = 0
    let erros = 0

    // Chamar a função de enviar alerta para cada item da fila
    for (const item of fila) {
      try {
        // Chamar a Edge Function enviar-alerta-webhook
        const functionUrl = `${supabaseUrl}/functions/v1/enviar-alerta-webhook`
        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ licitacao_id: item.licitacao_id }),
        })

        if (response.ok) {
          // Marcar como processado
          await supabase
            .from('alertas_fila')
            .update({
              processado: true,
              processado_em: new Date().toISOString(),
            })
            .eq('id', item.id)

          processados++
        } else {
          const errorText = await response.text()
          await supabase
            .from('alertas_fila')
            .update({
              tentativas: item.tentativas + 1,
              erro: errorText.substring(0, 500),
            })
            .eq('id', item.id)

          erros++
        }
      } catch (error) {
        console.error(`❌ Erro ao processar item ${item.id}:`, error)
        await supabase
          .from('alertas_fila')
          .update({
            tentativas: item.tentativas + 1,
            erro: error.message?.substring(0, 500) || 'Erro desconhecido',
          })
          .eq('id', item.id)

        erros++
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processados,
        erros,
        total: fila.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('❌ Erro ao processar fila:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro desconhecido',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})


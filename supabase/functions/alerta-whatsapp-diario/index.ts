// ============================================
// EDGE FUNCTION: ALERTA WHATSAPP DIÁRIO
// ============================================
// Chamada por cron (ex.: diariamente no horário configurado).
// Busca alertas com tipo = 'whatsapp' e ativo, aplica filtros, busca licitações
// e envia para cada número cadastrado via enviar-whatsapp-uazapi.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({ error: 'Configuração Supabase ausente' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const funUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/enviar-whatsapp-uazapi`
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

  try {
    // Horário atual no Brasil (America/Sao_Paulo) para comparar com horario_verificacao
    const now = new Date()
    const brTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
    const hora = brTime.getHours()
    const minuto = brTime.getMinutes()
    const horarioAtual = `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`
    const totalMinutosAgora = hora * 60 + minuto

    function dentroJanela(horario: string): boolean {
      const partes = String(horario).slice(0, 5).split(':')
      if (partes.length < 2) return false
      const hAlerta = parseInt(partes[0], 10)
      const mAlerta = parseInt(partes[1], 10)
      if (isNaN(hAlerta) || isNaN(mAlerta)) return false
      const totalMinutosAlerta = hAlerta * 60 + mAlerta
      const diff = Math.abs(totalMinutosAgora - totalMinutosAlerta)
      const diffCorrigido = Math.min(diff, 1440 - diff)
      return diffCorrigido <= 5
    }

    const { data: alertas, error: errAlertas } = await supabase
      .from('alertas_usuario')
      .select('id, usuario_id, filtros, horario_verificacao')
      .eq('tipo', 'whatsapp')
      .eq('ativo', true)

    if (errAlertas || !alertas?.length) {
      console.log('[Alerta WhatsApp] Nenhum alerta ativo ou erro:', errAlertas?.message)
      return new Response(
        JSON.stringify({ ok: true, processados: 0, mensagem: 'Nenhum alerta ativo' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const alertasParaRodar = alertas.filter((a) => {
      const h = a.horario_verificacao
      if (!h) return false
      return dentroJanela(String(h))
    })

    if (alertasParaRodar.length === 0) {
      console.log('[Alerta WhatsApp] Nenhum alerta com horário', horarioAtual)
      return new Response(
        JSON.stringify({ ok: true, processados: 0, horario: horarioAtual }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let totalEnvios = 0
    const hoje = new Date().toISOString().slice(0, 10)
    const doisDiasAtras = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    for (const alerta of alertasParaRodar) {
      const filtros = (alerta.filtros || {}) as Record<string, unknown>
      const usuarioId = alerta.usuario_id

      const { data: numeros } = await supabase
        .from('usuario_whatsapp_numeros')
        .select('numero_telefone')
        .eq('usuario_id', usuarioId)
        .eq('ativo', true)
        .order('ordem', { ascending: true })

      if (!numeros?.length) continue

      let q = supabase
        .from('licitacoes')
        .select('id, numero_controle_pncp, objeto_compra, orgao_razao_social, modalidade_nome, valor_total_estimado, uf_sigla, data_publicacao_pncp, dados_completos, link_portal_pncp')
        .gte('data_publicacao_pncp', doisDiasAtras)
        .lte('data_publicacao_pncp', hoje)
        .limit(50)

      if (filtros.uf) q = q.eq('uf_sigla', filtros.uf)
      if (filtros.modalidade) q = q.eq('modalidade_nome', filtros.modalidade)
      if (filtros.valorMin != null && filtros.valorMin !== '') q = q.gte('valor_total_estimado', Number(filtros.valorMin))
      if (filtros.valorMax != null && filtros.valorMax !== '') q = q.lte('valor_total_estimado', Number(filtros.valorMax))

      const { data: licitacoes, error: errLicit } = await q
      if (errLicit || !licitacoes?.length) continue

      for (const lic of licitacoes) {
        const dadosCompletos = lic.dados_completos as Record<string, unknown> | null
        const dataAbertura = dadosCompletos?.dataAberturaProposta ?? dadosCompletos?.data_abertura_proposta ?? null
        const dataEncerramento = dadosCompletos?.dataEncerramentoProposta ?? dadosCompletos?.data_encerramento_proposta ?? null
        const objetoEdital = lic.objeto_compra ?? dadosCompletos?.objetoCompra ?? dadosCompletos?.objeto_compra ?? 'Não informado'
        const valorTotal = lic.valor_total_estimado ?? null
        const payload = {
          telefone: '',
          objeto_licitacao: objetoEdital,
          objeto: objetoEdital,
          orgao: lic.orgao_razao_social ?? 'Não informado',
          modalidade: lic.modalidade_nome ?? 'Não informado',
          valor_estimado: valorTotal,
          valor_total: valorTotal,
          valor_total_formatado: valorTotal != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorTotal) : null,
          uf: lic.uf_sigla ?? '',
          numero_controle: lic.numero_controle_pncp ?? lic.id,
          data_publicacao: lic.data_publicacao_pncp ?? null,
          data_abertura: dataAbertura,
          data_encerramento: dataEncerramento,
          link_pncp: lic.link_portal_pncp ?? null,
          municipio: (dadosCompletos?.municipio as string) ?? null,
          unidade: (dadosCompletos?.unidadeCompradora as string) ?? null,
        }

        for (const n of numeros) {
          const num = (n.numero_telefone || '').replace(/\D/g, '')
          if (num.length < 10) continue
          payload.telefone = num.startsWith('55') ? num : `55${num}`
          try {
            const res = await fetch(funUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${anonKey}`,
              },
              body: JSON.stringify(payload),
            })
            if (res.ok) totalEnvios++
          } catch (e) {
            console.warn('[Alerta WhatsApp] Erro ao enviar para', payload.telefone, e)
          }
        }
      }

      await supabase.from('alertas_execucoes').insert({
        alerta_id: alerta.id,
        licitacoes_encontradas: [],
        total_encontrado: licitacoes.length,
        notificacao_enviada: true,
        sucesso: true,
      })
    }

    console.log('[Alerta WhatsApp] Total de envios:', totalEnvios)
    return new Response(
      JSON.stringify({ ok: true, processados: alertasParaRodar.length, totalEnvios }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[Alerta WhatsApp] Erro:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Erro ao processar alertas' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// ============================================
// EDGE FUNCTION: LEMBRETE DE PRAZO (FAVORITOS) VIA WHATSAPP
// ============================================
// Roda via cron (ex.: 1x por dia). Busca favoritos cuja data de encerramento
// está nos próximos 1, 3 ou 7 dias e envia lembrete por WhatsApp.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const DIAS_LEMBRETE = [1, 3, 7]

function parseDataEncerramento(val: unknown): Date | null {
  if (!val) return null
  const s = String(val).trim()
  if (!s) return null
  const iso = /^\d{4}-\d{2}-\d{2}/.test(s)
  if (iso) {
    const d = new Date(s)
    return isNaN(d.getTime()) ? null : d
  }
  const [dia, mes, ano] = s.split(/[/-]/)
  if (dia && mes && ano) {
    const d = new Date(Number(ano), Number(mes) - 1, Number(dia))
    return isNaN(d.getTime()) ? null : d
  }
  return null
}

function diasEntre(hoje: Date, data: Date): number {
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  const fim = new Date(data.getFullYear(), data.getMonth(), data.getDate())
  return Math.round((fim.getTime() - inicio.getTime()) / (24 * 60 * 60 * 1000))
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
  const uazapiBase = Deno.env.get('UAZAPI_BASE_URL') || 'https://atendemais.uazapi.com'
  const uazapiToken = Deno.env.get('UAZAPI_TOKEN') ?? Deno.env.get('UAZAPI_BEARER_TOKEN')

  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({ error: 'Configuração Supabase ausente' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (!uazapiToken) {
    return new Response(
      JSON.stringify({ error: 'Serviço WhatsApp não configurado' }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const tokenValue = uazapiToken.replace(/^Bearer\s+/i, '').trim()
  const instanceId = Deno.env.get('UAZAPI_INSTANCE_ID')?.trim()
  const headers: Record<string, string> = { 'Content-Type': 'application/json', token: tokenValue }
  if (instanceId) headers['instance'] = instanceId

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const { data: favoritos, error: errFav } = await supabase
    .from('licitacoes_favoritas')
    .select(`
      usuario_id,
      licitacao_id,
      licitacoes (
        id,
        objeto_compra,
        link_portal_pncp,
        dados_completos
      )
    `)

  if (errFav || !favoritos?.length) {
    return new Response(
      JSON.stringify({ ok: true, lembretesEnviados: 0, mensagem: 'Nenhum favorito ou erro' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const porUsuario = new Map<string, Array<{ dias: number; objeto: string; link: string; dataEncerramento: string }>>()

  for (const fav of favoritos) {
    const lic = (fav as { licitacoes?: Record<string, unknown> | null }).licitacoes
    if (!lic || typeof lic !== 'object') continue

    const dados = (lic.dados_completos as Record<string, unknown>) || {}
    const rawEncerramento = dados.dataEncerramentoProposta ?? dados.data_encerramento_proposta ?? null
    const dataEncerramento = parseDataEncerramento(rawEncerramento)
    if (!dataEncerramento) continue

    const dias = diasEntre(hoje, dataEncerramento)
    if (!DIAS_LEMBRETE.includes(dias)) continue

    const objeto = (lic.objeto_compra as string) || (dados.objetoCompra as string) || (dados.objeto_compra as string) || 'Licitação'
    const link = (lic.link_portal_pncp as string) || ''
    const dataFmt = dataEncerramento.toLocaleDateString('pt-BR')

    const usuarioId = (fav as { usuario_id?: string }).usuario_id
    if (!usuarioId) continue
    if (!porUsuario.has(usuarioId)) {
      porUsuario.set(usuarioId, [])
    }
    porUsuario.get(usuarioId)!.push({ dias, objeto: objeto.slice(0, 120), link, dataEncerramento: dataFmt })
  }

  let totalEnvios = 0

  for (const [usuarioId, itens] of porUsuario) {
    if (itens.length === 0) continue

    const { data: numeros } = await supabase
      .from('usuario_whatsapp_numeros')
      .select('numero_telefone')
      .eq('usuario_id', usuarioId)
      .eq('ativo', true)

    let numero: string | null = null
    if (numeros?.length) {
      const n = (numeros[0].numero_telefone || '').replace(/\D/g, '')
      numero = n.length >= 10 ? (n.startsWith('55') ? n : `55${n}`) : null
    }
    if (!numero) {
      const { data: profile } = await supabase.from('profiles').select('telefone').eq('id', usuarioId).maybeSingle()
      const t = (profile?.telefone || '').replace(/\D/g, '')
      if (t.length >= 10) numero = t.startsWith('55') ? t : `55${t}`
    }
    if (!numero) continue

    const linhas = itens.map(
      (i) =>
        `• ${i.objeto}${i.objeto.length >= 120 ? '...' : ''}\n  Encerra em *${i.dias} dia(s)* (${i.dataEncerramento})${i.link ? `\n  ${i.link}` : ''}`
    )
    const texto =
      `⏰ *Lembrete de prazos*\n\nVocê tem ${itens.length} licitação(ões) favorita(s) com prazo próximo:\n\n` +
      linhas.join('\n\n') +
      `\n\nAcesse o sistema para ver detalhes.`

    const url = `${uazapiBase.replace(/\/$/, '')}/send/text`
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ number: numero, text: texto }),
      })
      if (res.ok) totalEnvios++
    } catch (e) {
      console.warn('[lembrete-prazo] Erro ao enviar para', numero, e)
    }
  }

  return new Response(
    JSON.stringify({ ok: true, lembretesEnviados: totalEnvios, usuariosComLembrete: porUsuario.size }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})

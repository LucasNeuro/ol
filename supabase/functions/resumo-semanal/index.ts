// ============================================
// EDGE FUNCTION: RESUMO SEMANAL (E-MAIL E/OU WHATSAPP)
// ============================================
// Chamada por cron semanal (ex.: segunda 8h). Busca alertas com resumo_semanal_ativo = true,
// aplica filtros, busca licitações dos últimos 7 dias e envia por e-mail (Resend) e/ou WhatsApp (UAZAPI).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend@2.0.0'

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
  const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? ''
  const emailFrom = Deno.env.get('EMAIL_FROM') || 'Sistema Licitação <onboarding@resend.dev>'
  const siteUrl = Deno.env.get('SITE_URL') || 'https://sistema-licitacao-frontend.onrender.com'
  const uazapiBase = Deno.env.get('UAZAPI_BASE_URL') || 'https://atendemais.uazapi.com'
  const uazapiToken = Deno.env.get('UAZAPI_TOKEN') ?? Deno.env.get('UAZAPI_BEARER_TOKEN')

  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({ error: 'Configuração Supabase ausente' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  function escapeHtml(text: string | null | undefined): string {
    if (text == null || text === '') return ''
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  try {
    const hoje = new Date().toISOString().slice(0, 10)
    const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const { data: alertas, error: errAlertas } = await supabase
      .from('alertas_usuario')
      .select('id, usuario_id, tipo, filtros, email_notificacao, resumo_semanal_ativo')
      .eq('ativo', true)
      .eq('resumo_semanal_ativo', true)

    if (errAlertas) {
      console.warn('[Resumo Semanal] Erro ao buscar alertas (coluna resumo_semanal_ativo existe?):', errAlertas.message)
      return new Response(
        JSON.stringify({ error: errAlertas.message, hint: 'Execute add_resumo_semanal_alertas.sql se a coluna não existir' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!alertas?.length) {
      return new Response(
        JSON.stringify({ ok: true, processados: 0, mensagem: 'Nenhum alerta com resumo semanal ativo' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let totalEmail = 0
    let totalWhatsApp = 0
    const resend = resendApiKey ? new Resend(resendApiKey) : null
    const tokenValue = uazapiToken?.replace(/^Bearer\s+/i, '').trim() ?? ''
    const instanceId = Deno.env.get('UAZAPI_INSTANCE_ID')?.trim()
    const funUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/enviar-whatsapp-uazapi`
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    for (const alerta of alertas) {
      const filtros = (alerta.filtros || {}) as Record<string, unknown>
      const usuarioId = alerta.usuario_id
      const tipo = (alerta.tipo || 'email') as string

      let q = supabase
        .from('licitacoes')
        .select('id, numero_controle_pncp, objeto_compra, orgao_razao_social, modalidade_nome, valor_total_estimado, uf_sigla, data_publicacao_pncp, dados_completos, link_portal_pncp')
        .gte('data_publicacao_pncp', seteDiasAtras)
        .lte('data_publicacao_pncp', hoje)
        .order('data_publicacao_pncp', { ascending: false })
        .limit(80)

      if (filtros.uf) q = q.eq('uf_sigla', filtros.uf)
      if (filtros.modalidade) q = q.eq('modalidade_nome', filtros.modalidade)
      if (filtros.valorMin != null && filtros.valorMin !== '') q = q.gte('valor_total_estimado', Number(filtros.valorMin))
      if (filtros.valorMax != null && filtros.valorMax !== '') q = q.lte('valor_total_estimado', Number(filtros.valorMax))

      const { data: licitacoes, error: errLicit } = await q
      if (errLicit || !licitacoes?.length) {
        continue
      }

      const totalEncontrado = licitacoes.length
      const listaLicitacoes = licitacoes

      if (tipo === 'email' && resend) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, nome_fantasia, razao_social, nome_responsavel')
          .eq('id', usuarioId)
          .maybeSingle()
        const emailDestino = (alerta as { email_notificacao?: string }).email_notificacao || profile?.email
        const nomeUsuario = profile?.nome_fantasia || profile?.razao_social || profile?.nome_responsavel || null
        if (emailDestino && typeof emailDestino === 'string') {
          const cardsEditais = listaLicitacoes.slice(0, 25).map((lic) => {
            const valor = lic.valor_total_estimado
            const valorFmt = valor != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(valor) : '-'
            const objetoRaw = lic.objeto_compra ?? 'Não informado'
            const objeto = escapeHtml(objetoRaw.slice(0, 150)) + (objetoRaw.length > 150 ? '...' : '')
            const orgao = escapeHtml(lic.orgao_razao_social ?? '-')
            const uf = lic.uf_sigla ?? '-'
            return `
          <div style="background:#f9fafb;border-radius:6px;padding:14px 16px;margin-bottom:12px;border-left:4px solid #f97316;">
            <p style="margin:0 0 4px 0;font-size:11px;color:#6b7280;font-weight:600;">Objeto</p>
            <p style="margin:0 0 8px 0;font-size:14px;color:#1f2937;line-height:1.4;">${objeto}</p>
            <p style="margin:0 0 2px 0;font-size:11px;color:#6b7280;">Órgão: ${orgao}${uf !== '-' ? ` · UF: ${uf}` : ''}</p>
            <p style="margin:0;font-size:12px;color:#1f2937;font-weight:600;">Valor: ${valorFmt}</p>
          </div>`
          }).join('')
          const temMais = totalEncontrado > 25
          const linkBoletim = `${siteUrl.replace(/\/$/, '')}/licitacoes`
          const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Resumo Semanal - Sistema Licitação</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="background:#f97316;padding:30px;text-align:center;border-radius:8px 8px 0 0;">
              <h1 style="color:#fff;margin:0;font-size:24px;">Resumo Semanal</h1>
              <p style="color:rgba(255,255,255,0.95);margin:8px 0 0 0;font-size:14px;">Últimos 7 dias</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 30px;">
              <h2 style="color:#1f2937;margin:0 0 20px 0;font-size:20px;">${nomeUsuario ? `Olá, ${escapeHtml(nomeUsuario)}!` : 'Resumo Semanal'}</h2>
              <p style="color:#4b5563;margin:0 0 24px 0;font-size:16px;line-height:1.6;">
                Encontramos <strong>${totalEncontrado} edital(is)</strong> nos últimos 7 dias conforme seus filtros.
              </p>
              <div style="margin-bottom:24px;">${cardsEditais}</div>
              ${temMais ? `<p style="color:#6b7280;font-size:13px;margin:0 0 24px 0;">Mostrando 25 de ${totalEncontrado}. Acesse o sistema para ver todos.</p>` : ''}
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:20px 0;">
                    <a href="${linkBoletim}" style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-weight:600;font-size:16px;">Ver todos os editais</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
          try {
            await resend.emails.send({
              from: emailFrom,
              to: [emailDestino],
              subject: `Resumo semanal: ${totalEncontrado} edital(is) - Sistema Licitação`,
              html,
            })
            totalEmail++
          } catch (e) {
            console.warn('[Resumo Semanal] Erro e-mail para', emailDestino, e)
          }
        }
      }

      if (tipo === 'whatsapp' && tokenValue) {
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
        if (numero) {
          const linhas = listaLicitacoes.slice(0, 10).map((lic) => {
            const obj = (lic.objeto_compra || '').slice(0, 80)
            const link = lic.link_portal_pncp && String(lic.link_portal_pncp).startsWith('http') ? lic.link_portal_pncp : ''
            return `• ${obj}${obj.length >= 80 ? '...' : ''}${link ? `\n  ${link}` : ''}`
          })
          const texto = `📋 *Resumo semanal* (últimos 7 dias)\n\n${totalEncontrado} edital(is) encontrado(s) com seus filtros:\n\n${linhas.join('\n\n')}\n\nAcesse o sistema para ver todos.`
          const url = `${uazapiBase.replace(/\/$/, '')}/send/text`
          const headers: Record<string, string> = { 'Content-Type': 'application/json', token: tokenValue }
          if (instanceId) headers['instance'] = instanceId
          try {
            const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ number: numero, text: texto }) })
            if (res.ok) totalWhatsApp++
          } catch (e) {
            console.warn('[Resumo Semanal] Erro WhatsApp para', numero, e)
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, processados: alertas.length, totalEmail, totalWhatsApp }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[Resumo Semanal] Erro:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Erro ao processar resumo semanal' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

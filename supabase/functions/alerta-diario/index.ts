// ============================================
// EDGE FUNCTION: ALERTA DIÁRIO (E-MAIL + WHATSAPP)
// ============================================
// Uma única função chamada pelo cron. Processa todos os alertas ativos no horário
// e envia por e-mail e/ou WhatsApp (cards com botões), conforme o tipo de cada alerta.
// Assim o cron só precisa chamar esta função para garantir envio nos dois canais.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend@2.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function escapeHtml(text: string | null | undefined): string {
  if (text == null || text === '') return ''
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
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
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? ''
  const emailFrom = Deno.env.get('EMAIL_FROM') || 'Sistema Licitação <onboarding@resend.dev>'
  const siteUrl = Deno.env.get('SITE_URL') || 'https://sistema-licitacao-frontend.onrender.com'
  const funWhatsAppUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/enviar-whatsapp-uazapi`

  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({ error: 'Configuração Supabase ausente' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const resend = resendApiKey ? new Resend(resendApiKey) : null

  try {
    const now = new Date()
    const brTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
    const hora = brTime.getHours()
    const minuto = brTime.getMinutes()
    const horarioAtual = `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`
    const totalMinutosAgora = hora * 60 + minuto

    // Verifica se um horário (HH:MM) está dentro de uma janela de ±5 minutos do horário atual.
    // Necessário pois o cron pode disparar com alguns minutos de atraso.
    function dentroJanela(horario: string): boolean {
      const partes = String(horario).slice(0, 5).split(':')
      if (partes.length < 2) return false
      const hAlerta = parseInt(partes[0], 10)
      const mAlerta = parseInt(partes[1], 10)
      if (isNaN(hAlerta) || isNaN(mAlerta)) return false
      const totalMinutosAlerta = hAlerta * 60 + mAlerta
      const diff = Math.abs(totalMinutosAgora - totalMinutosAlerta)
      // Trata a virada de meia-noite (ex.: 23:58 vs 00:02)
      const diffCorrigido = Math.min(diff, 1440 - diff)
      return diffCorrigido <= 5
    }

    // Busca alertas ativos de qualquer tipo (inclui tipo = null, tratado como email)
    const { data: alertasRaw, error: errAlertas } = await supabase
      .from('alertas_usuario')
      .select('id, usuario_id, tipo, filtros, horario_verificacao, email_notificacao, enviar_whatsapp')
      .eq('ativo', true)

    // Normaliza tipo null para 'email'
    const alertas = (alertasRaw ?? []).map((a) => ({
      ...a,
      tipo: a.tipo ?? 'email',
    }))

    if (errAlertas || !alertas?.length) {
      console.log('[Alerta Diário] Nenhum alerta ativo ou erro:', errAlertas?.message)
      return new Response(
        JSON.stringify({ ok: true, processados: 0, totalEmails: 0, totalWhatsApp: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const alertasParaRodar = alertas.filter((a) => {
      const h = a.horario_verificacao
      if (!h) return false
      return dentroJanela(String(h))
    })

    if (alertasParaRodar.length === 0) {
      console.log('[Alerta Diário] Nenhum alerta com horário', horarioAtual)
      return new Response(
        JSON.stringify({ ok: true, processados: 0, horario: horarioAtual, totalEmails: 0, totalWhatsApp: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const hoje = new Date().toISOString().slice(0, 10)
    const doisDiasAtras = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    let totalEmailsEnviados = 0
    let totalEnviosWhatsApp = 0

    for (const alerta of alertasParaRodar) {
      const filtros = (alerta.filtros || {}) as Record<string, unknown>
      const usuarioId = alerta.usuario_id
      const tipo = (alerta as { tipo?: string }).tipo ?? 'email'

      let q = supabase
        .from('licitacoes')
        .select('id, numero_controle_pncp, objeto_compra, orgao_razao_social, modalidade_nome, valor_total_estimado, uf_sigla, data_publicacao_pncp, dados_completos, link_portal_pncp')
        .gte('data_publicacao_pncp', doisDiasAtras)
        .lte('data_publicacao_pncp', hoje)
        .order('data_publicacao_pncp', { ascending: false })
        .limit(50)

      if (filtros.uf) q = q.eq('uf_sigla', filtros.uf)
      if (filtros.modalidade && String(filtros.modalidade).trim()) q = q.eq('modalidade_nome', String(filtros.modalidade).trim())
      if (filtros.valorMin != null && filtros.valorMin !== '') q = q.gte('valor_total_estimado', Number(filtros.valorMin))
      if (filtros.valorMax != null && filtros.valorMax !== '') q = q.lte('valor_total_estimado', Number(filtros.valorMax))
      if (filtros.setor_principal_id) q = q.eq('setor_principal_id', filtros.setor_principal_id)
      const buscaObjeto = filtros.buscaObjeto && String(filtros.buscaObjeto).trim()
      if (buscaObjeto) {
        const termos = buscaObjeto.split(',').map((t: string) => t.trim()).filter(Boolean)
        for (const termo of termos.slice(0, 5)) {
          q = q.ilike('objeto_compra', `%${termo}%`)
        }
      }

      const { data: licitacoes, error: errLicit } = await q
      if (errLicit) {
        await supabase.from('alertas_execucoes').insert({
          alerta_id: alerta.id,
          licitacoes_encontradas: [],
          total_encontrado: 0,
          notificacao_enviada: false,
          sucesso: false,
          erro_mensagem: errLicit.message,
        })
        continue
      }

      const totalEncontrado = licitacoes?.length ?? 0
      const idsEncontrados = (licitacoes ?? []).map((l) => l.id)

      if (tipo === 'email') {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, nome_fantasia, razao_social, nome_responsavel')
          .eq('id', usuarioId)
          .maybeSingle()

        const emailDestino = (alerta as { email_notificacao?: string }).email_notificacao || profile?.email
        const nomeUsuario = profile?.nome_fantasia || profile?.razao_social || profile?.nome_responsavel || null

        if (!emailDestino || typeof emailDestino !== 'string') {
          await supabase.from('alertas_execucoes').insert({
            alerta_id: alerta.id,
            licitacoes_encontradas: [],
            total_encontrado: 0,
            notificacao_enviada: false,
            sucesso: false,
            erro_mensagem: 'E-mail não informado no alerta nem no perfil',
          })
          continue
        }

        if (!resend) {
          await supabase.from('alertas_execucoes').insert({
            alerta_id: alerta.id,
            licitacoes_encontradas: idsEncontrados,
            total_encontrado: totalEncontrado,
            notificacao_enviada: false,
            sucesso: false,
            erro_mensagem: 'RESEND_API_KEY não configurada',
          })
          continue
        }

        const listaLicitacoes = licitacoes ?? []
        const cardsEditais = listaLicitacoes.slice(0, 20).map((lic) => {
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

        const temMais = totalEncontrado > 20
        const linkBoletim = `${siteUrl.replace(/\/$/, '')}/boletim`
        const linkCancelar = `${siteUrl.replace(/\/$/, '')}/alertas`
        const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Novos Editais - Sistema Licitação</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color:#f97316;padding:30px;text-align:center;border-radius:8px 8px 0 0;">
              <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:600;">Sistema Licitação</h1>
              <p style="color:rgba(255,255,255,0.95);margin:8px 0 0 0;font-size:14px;">Resumo diário de licitações</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 30px;">
              <h2 style="color:#1f2937;margin:0 0 20px 0;font-size:20px;font-weight:600;">${nomeUsuario ? `Olá, ${escapeHtml(nomeUsuario)}!` : 'Novos Editais para Você'}</h2>
              <p style="color:#4b5563;margin:0 0 24px 0;font-size:16px;line-height:1.6;">
                Conforme seus filtros configurados, encontramos <strong>${totalEncontrado} edital(is)</strong> nos últimos 2 dias.
              </p>
              ${totalEncontrado > 0 ? `
              <div style="margin-bottom:24px;">${cardsEditais}</div>
              ${temMais ? `<p style="color:#6b7280;font-size:13px;margin:0 0 24px 0;">Mostrando 20 de ${totalEncontrado}. Acesse o sistema para ver todos.</p>` : ''}
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:20px 0;">
                    <a href="${linkBoletim}" style="display:inline-block;background-color:#f97316;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-weight:600;font-size:16px;">Ver todos os editais</a>
                  </td>
                </tr>
              </table>
              ` : `
              <p style="color:#6b7280;margin:0 0 24px 0;font-size:15px;">Nenhuma licitação nova no período. Tente ajustar seus filtros ou aguarde novas publicações.</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:20px 0;">
                    <a href="${linkBoletim}" style="display:inline-block;background-color:#f97316;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-weight:600;font-size:16px;">Acessar o sistema</a>
                  </td>
                </tr>
              </table>
              `}
              <p style="color:#9ca3af;margin:30px 0 0 0;font-size:12px;line-height:1.6;text-align:center;">
                Você está recebendo este e-mail porque ativou alertas no Sistema Licitação.<br>
                <a href="${linkCancelar}" style="color:#f97316;text-decoration:underline;">Gerenciar ou cancelar alertas</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f9fafb;padding:16px 30px;text-align:center;border-radius:0 0 8px 8px;border-top:1px solid #e5e7eb;">
              <p style="color:#9ca3af;margin:0;font-size:11px;">Sistema Licitação · Portal de Licitações Públicas</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

        try {
          const assunto = totalEncontrado > 0
            ? `${totalEncontrado} novo(s) edital(is) para você - Sistema Licitação`
            : 'Resumo diário - Nenhum edital novo - Sistema Licitação'
          const { error: errResend } = await resend.emails.send({
            from: emailFrom,
            to: [emailDestino],
            subject: assunto,
            html,
            headers: {
              'List-Unsubscribe': `<${linkCancelar}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
              'X-Entity-Ref-ID': alerta.id,
            },
          })
          if (errResend) throw errResend
          totalEmailsEnviados++
          await supabase.from('alertas_execucoes').insert({
            alerta_id: alerta.id,
            licitacoes_encontradas: idsEncontrados,
            total_encontrado: totalEncontrado,
            notificacao_enviada: true,
            sucesso: true,
          })
        } catch (e) {
          console.warn('[Alerta Diário] Erro ao enviar e-mail para', emailDestino, e)
          await supabase.from('alertas_execucoes').insert({
            alerta_id: alerta.id,
            licitacoes_encontradas: idsEncontrados,
            total_encontrado: totalEncontrado,
            notificacao_enviada: false,
            sucesso: false,
            erro_mensagem: e instanceof Error ? e.message : 'Erro ao enviar e-mail',
          })
          continue
        }

        // Se o alerta de e-mail também tem enviar_whatsapp=true, dispara para os números do usuário
        if ((alerta as { enviar_whatsapp?: boolean }).enviar_whatsapp && licitacoes?.length) {
          const { data: numeros } = await supabase
            .from('usuario_whatsapp_numeros')
            .select('numero_telefone')
            .eq('usuario_id', usuarioId)
            .eq('ativo', true)
            .order('ordem', { ascending: true })

          if (numeros?.length) {
            for (const lic of licitacoes.slice(0, 10)) {
              const dadosCompletos = lic.dados_completos as Record<string, unknown> | null
              const dataAbertura = dadosCompletos?.dataAberturaProposta ?? dadosCompletos?.data_abertura_proposta ?? null
              const dataEncerramento = dadosCompletos?.dataEncerramentoProposta ?? dadosCompletos?.data_encerramento_proposta ?? null
              const valorTotal = lic.valor_total_estimado ?? null
              const wppPayload = {
                telefone: '',
                objeto_licitacao: lic.objeto_compra ?? 'Não informado',
                objeto: lic.objeto_compra ?? 'Não informado',
                orgao: lic.orgao_razao_social ?? 'Não informado',
                modalidade: lic.modalidade_nome ?? 'Não informado',
                valor_total: valorTotal,
                valor_total_formatado: valorTotal != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorTotal) : null,
                uf: lic.uf_sigla ?? '',
                numero_controle: lic.numero_controle_pncp ?? lic.id,
                data_publicacao: lic.data_publicacao_pncp ?? null,
                data_abertura: dataAbertura,
                data_encerramento: dataEncerramento,
                link_pncp: lic.link_portal_pncp ?? null,
              }
              for (const n of numeros) {
                const num = (n.numero_telefone || '').replace(/\D/g, '')
                if (num.length < 10) continue
                wppPayload.telefone = num.startsWith('55') ? num : `55${num}`
                try {
                  const res = await fetch(funWhatsAppUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
                    body: JSON.stringify(wppPayload),
                  })
                  if (res.ok) totalEnviosWhatsApp++
                } catch (e) {
                  console.warn('[Alerta Diário] Erro WhatsApp (via email+wpp) para', wppPayload.telefone, e)
                }
              }
            }
            console.log(`[Alerta Diário] E-mail+WhatsApp: ${licitacoes.length} licitações → ${numeros.length} número(s)`)
          }
        }
      }

      if (tipo === 'whatsapp') {
        const { data: numeros } = await supabase
          .from('usuario_whatsapp_numeros')
          .select('numero_telefone')
          .eq('usuario_id', usuarioId)
          .eq('ativo', true)
          .order('ordem', { ascending: true })

        if (numeros?.length && licitacoes?.length) {
          for (const lic of licitacoes) {
            const dadosCompletos = lic.dados_completos as Record<string, unknown> | null
            const dataAbertura = dadosCompletos?.dataAberturaProposta ?? dadosCompletos?.data_abertura_proposta ?? null
            const dataEncerramento = dadosCompletos?.dataEncerramentoProposta ?? dadosCompletos?.data_encerramento_proposta ?? null
            const objetoEdital = lic.objeto_compra ?? (dadosCompletos?.objetoCompra ?? dadosCompletos?.objeto_compra) ?? 'Não informado'
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
            const res = await fetch(funWhatsAppUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${anonKey}`,
              },
              body: JSON.stringify(payload),
            })
            if (res.ok) totalEnviosWhatsApp++
          } catch (e) {
            console.warn('[Alerta Diário] Erro ao enviar WhatsApp para', payload.telefone, e)
          }
        }
          }
        }

        await supabase.from('alertas_execucoes').insert({
          alerta_id: alerta.id,
          licitacoes_encontradas: idsEncontrados,
          total_encontrado: totalEncontrado,
          notificacao_enviada: true,
          sucesso: true,
        })
      }
    }

    console.log('[Alerta Diário] Horário:', horarioAtual, 'Emails:', totalEmailsEnviados, 'WhatsApp:', totalEnviosWhatsApp)
    return new Response(
      JSON.stringify({
        ok: true,
        processados: alertasParaRodar.length,
        totalEmails: totalEmailsEnviados,
        totalWhatsApp: totalEnviosWhatsApp,
        horario: horarioAtual,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[Alerta Diário] Erro:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Erro ao processar alertas' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// ============================================
// EDGE FUNCTION: RECUPERAR SENHA VIA WHATSAPP
// ============================================
// Fluxo conversacional: envia mensagem com botões Sim/Não.
// Se Sim → webhook pede nova senha e atualiza no Supabase (sem link, sem token exposto).
// Tabela: password_reset_pendente (telefone, user_id, estado).

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

  try {
    let body: { email?: string }
    try {
      body = await req.json()
    } catch {
      return new Response(
        JSON.stringify({ error: 'Body inválido (JSON esperado)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const emailNorm = (body.email ?? '').toString().toLowerCase().trim()
    if (!emailNorm) {
      return new Response(
        JSON.stringify({ error: 'Informe o e-mail.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    // Buscar perfil pelo e-mail (profiles.email) ou fallback: buscar user no Auth e depois profile por id
    let profile: { id: string; user_id?: string; telefone?: string } | null = null
    const { data: profileByEmail, error: profileError } = await supabase
      .from('profiles')
      .select('id, user_id, email, telefone')
      .eq('email', emailNorm)
      .eq('ativo', true)
      .maybeSingle()

    if (profileByEmail) {
      profile = profileByEmail
    }
    if (!profile && (!profileError || profileError.code !== 'PGRST116')) {
      console.error('[recuperar-senha-whatsapp] profile error:', profileError?.message)
    }
    // Fallback: buscar user_id por email via RPC (auth.users) e depois profile por id
    if (!profile) {
      const { data: userIdFromRpc, error: rpcError } = await supabase.rpc('get_user_id_by_email', { p_email: emailNorm })
      if (rpcError) console.warn('[recuperar-senha-whatsapp] RPC get_user_id_by_email:', rpcError.message)
      if (userIdFromRpc) {
        const { data: profileById } = await supabase
          .from('profiles')
          .select('id, user_id, telefone')
          .eq('id', userIdFromRpc)
          .eq('ativo', true)
          .maybeSingle()
        if (profileById) profile = { id: profileById.id, user_id: profileById.user_id ?? profileById.id, telefone: profileById.telefone }
      }
    }

    if (!profile) {
      return new Response(
        JSON.stringify({ error: 'E-mail não encontrado ou conta inativa.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const telefoneRaw = (profile.telefone ?? '').toString().replace(/\D/g, '')
    if (telefoneRaw.length < 10) {
      return new Response(
        JSON.stringify({
          error: 'Nenhum telefone cadastrado no perfil. Cadastre um telefone no seu perfil para receber por WhatsApp.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const numero = telefoneRaw.startsWith('55') ? telefoneRaw : `55${telefoneRaw}`
    const userId = (profile as { user_id?: string }).user_id ?? profile.id
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Perfil sem vínculo com usuário.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Limpar solicitações antigas do mesmo telefone (evitar duplicidade)
    await supabase
      .from('password_reset_pendente')
      .delete()
      .eq('telefone', numero)

    const { error: insertError } = await supabase.from('password_reset_pendente').insert({
      telefone: numero,
      email: emailNorm,
      user_id: userId,
      estado: 'aguardando_confirmacao',
    })

    if (insertError) {
      console.error('[recuperar-senha-whatsapp] insert error:', insertError.message)
      return new Response(
        JSON.stringify({ error: 'Erro ao registrar solicitação. Tente novamente.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Enviar mensagem com BOTÕES Sim / Não (igual aos editais)
    const url = `${uazapiBase.replace(/\/$/, '')}/send/menu`
    const tokenValue = uazapiToken.replace(/^Bearer\s+/i, '').trim()
    const instanceId = Deno.env.get('UAZAPI_INSTANCE_ID')?.trim()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      token: tokenValue,
    }
    if (instanceId) headers['instance'] = instanceId

    const texto =
      `🔐 *Redefinir senha*\n\n` +
      `Você solicitou a redefinição da senha. Confirma?`

    const menuPayload = {
      number: numero,
      type: 'button',
      text: texto,
      choices: [
        'Sim, redefinir senha|sim_redefinir',
        'Não, encerrar|nao_redefinir',
      ],
      footerText: 'Toque em uma das opções abaixo para responder.',
      track_source: 'sistema-licitacao',
      track_id: 'reset_senha',
      async: true,
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(menuPayload),
    })

    const resText = await res.text().catch(() => '')
    if (!res.ok) {
      console.error('[recuperar-senha-whatsapp] UAZAPI:', res.status, resText)
      return new Response(
        JSON.stringify({
          error: 'Falha ao enviar mensagem no WhatsApp. Tente novamente em alguns minutos.',
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[recuperar-senha-whatsapp]', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Erro ao processar solicitação.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

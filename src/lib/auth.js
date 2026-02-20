/**
 * Autenticação via Supabase Auth (login, cadastro, logout).
 * Reset de senha: somente fluxo nativo Supabase (recuperar + redefinir).
 * https://supabase.com/docs/guides/auth/passwords
 * - Etapa 1: resetPasswordForEmail(email, { redirectTo }) → e-mail com link.
 * - Etapa 2: usuário abre o link → /redefinir-senha → updateUser({ password }) → signOut.
 * Perfis em `profiles` (id = auth.users.id).
 */
import { supabase, SUPABASE_NAO_CONFIGURADO_MSG } from './supabase'

async function getProfileByUserId(userId) {
  if (!supabase || !userId) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .eq('ativo', true)
    .maybeSingle()
  if (error || !data) return null
  const { password_hash, ...profile } = data
  return profile
}

/**
 * Cadastro: cria usuário no Auth + perfil em `profiles`.
 * Para cadastro sem e-mail de confirmação (evitar rate limit), desative "Confirm email"
 * no Supabase: Authentication → Providers → Email. Ver docs/SUPABASE-CADASTRO.md.
 */
export async function signUp(email, password, profileData) {
  if (!supabase) throw new Error(SUPABASE_NAO_CONFIGURADO_MSG)

  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.toLowerCase(),
      password,
      options: { emailRedirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/modulos` },
    })

    if (authError) {
      if (authError.message?.toLowerCase().includes('already registered')) {
        throw new Error('Email já cadastrado.')
      }
      throw authError
    }

    const user = authData?.user
    if (!user) throw new Error('Erro ao criar usuário.')

    const { error: insertError } = await supabase.from('profiles').insert({
      ...profileData,
      id: user.id,
      user_id: user.id,
      email: user.email,
      ativo: true,
    })

    if (insertError) {
      if (insertError.code === '23505') throw new Error('Email já cadastrado.')
      throw insertError
    }

    const profile = await getProfileByUserId(user.id)
    return { data: profile || { id: user.id, email: user.email, ...profileData }, error: null }
  } catch (e) {
    throw e
  }
}

/** Login via Supabase Auth; retorna perfil de `profiles` */
export async function signIn(email, password) {
  if (!supabase) throw new Error(SUPABASE_NAO_CONFIGURADO_MSG)

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: email.toLowerCase(),
    password,
  })

  if (authError) {
    const msg = authError.message || 'Erro ao fazer login.'
    if (/invalid login credentials|invalid_credentials/i.test(msg)) {
      throw new Error('Email ou senha incorretos.')
    }
    throw new Error(msg)
  }

  const user = authData?.user
  if (!user) throw new Error('Email ou senha incorretos.')

  const profile = await getProfileByUserId(user.id)
  if (!profile) throw new Error('Perfil não encontrado. Entre em contato com o suporte.')

  try {
    await supabase
      .from('profiles')
      .update({ ultimo_login: new Date().toISOString() })
      .eq('id', user.id)
  } catch (_) {}

  return { data: { user: profile }, error: null }
}

/** Logout Supabase + limpeza local */
export async function signOut() {
  if (supabase) await supabase.auth.signOut()
  try {
    localStorage.removeItem('user')
    localStorage.removeItem('session')
  } catch (_) {}
  return { error: null }
}

/** Sessão atual (Supabase). Retorna `{ user }` com perfil ou null. */
export async function getSession() {
  if (!supabase) return null
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null
  const profile = await getProfileByUserId(session.user.id)
  return profile ? { user: profile } : null
}

export function saveSession(_user) {
  // Sessão é gerida pelo Supabase; nada a persistir manualmente aqui.
}

export function isSessionValid() {
  return true // Validação real feita via getSession() assíncrono
}

/**
 * Etapa 1 do reset (doc Supabase: "Redefinir uma senha").
 * Página pública: coletar e-mail, solicitar e-mail de redefinição.
 * redirectTo = URL da página de alteração de senha (deve estar em Redirect URLs).
 * Supabase envia o e-mail; SMTP customizado (ex. Resend) em prod.
 */
export async function solicitarRecuperacaoSenha(email) {
  if (!supabase) throw new Error(SUPABASE_NAO_CONFIGURADO_MSG)

  const emailNorm = (email || '').toLowerCase().trim()
  if (!emailNorm) throw new Error('Informe o e-mail.')

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const redirectTo = `${origin}/redefinir-senha`

  const { error } = await supabase.auth.resetPasswordForEmail(emailNorm, { redirectTo })

  if (error) throw new Error(error.message || 'Erro ao enviar e-mail de recuperação.')

  return { success: true }
}

/**
 * Verifica se há sessão de recuperação (usuário veio do link do e-mail).
 * Faz algumas tentativas com delay porque o cliente pode demorar a processar o hash da URL.
 */
export async function hasRecoverySession() {
  if (!supabase) return false
  const delays = [0, 400, 1000]
  for (const ms of delays) {
    if (ms > 0) await new Promise((r) => setTimeout(r, ms))
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) return true
  }
  return false
}

/**
 * Etapa 2 do reset (doc Supabase: "Criar página para alterar a senha").
 * Página no URL do redirectTo (acessível só a quem veio do link).
 * updateUser({ password }) → depois signOut e redireciona para login.
 */
export async function redefinirSenhaViaSupabase(newPassword) {
  if (!supabase) throw new Error(SUPABASE_NAO_CONFIGURADO_MSG)

  const { error } = await supabase.auth.updateUser({ password: newPassword })

  if (error) throw new Error(error.message || 'Erro ao redefinir senha.')

  await supabase.auth.signOut()
  return { success: true }
}
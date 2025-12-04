// Sistema de Autenticação Personalizado usando apenas a tabela profiles
import { supabase } from './supabase'

// Criar usuário (cadastro) - APENAS tabela profiles
export async function signUp(email, password, profileData) {
  if (!supabase) throw new Error('Supabase não configurado.')

  console.log('📝 Criando novo usuário...')
  
  try {
    // Verificar se email já existe
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle()

    if (existingUser) {
      throw new Error('Email já cadastrado.')
    }

    console.log('✅ Email disponível')

    // Hash da senha (SHA-256)
    const encoder = new TextEncoder()
    const data = encoder.encode(password)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    console.log('🔐 Senha hashada')

    // Criar perfil
    const { data: newUser, error: insertError } = await supabase
      .from('profiles')
      .insert({
        email: email.toLowerCase(),
        password_hash: passwordHash,
        ...profileData,
      })
      .select()
      .single()

    if (insertError) {
      console.error('❌ Erro ao inserir:', insertError)
      throw insertError
    }

    console.log('✅ Usuário criado com sucesso!')

    const { password_hash, ...userData } = newUser
    return { data: userData, error: null }
  } catch (error) {
    console.error('❌ Erro no cadastro:', error)
    throw error
  }
}

// Login - APENAS tabela profiles
export async function signIn(email, password) {
  if (!supabase) throw new Error('Supabase não configurado.')

  console.log('🔐 Iniciando login...')
  
  try {
    // Buscar usuário
    const { data: user, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('ativo', true)
      .maybeSingle()

    if (fetchError) {
      console.error('❌ Erro ao buscar usuário:', fetchError)
      throw new Error('Erro ao fazer login. Tente novamente.')
    }

    if (!user) {
      console.log('❌ Usuário não encontrado')
      throw new Error('Email ou senha incorretos.')
    }

    console.log('✅ Usuário encontrado:', user.email)

    // Hash da senha para comparação
    const encoder = new TextEncoder()
    const data = encoder.encode(password)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    console.log('🔐 Verificando senha...')

    // Verificar senha
    if (passwordHash !== user.password_hash) {
      console.log('❌ Senha incorreta')
      throw new Error('Email ou senha incorretos.')
    }

    console.log('✅ Senha correta!')

    // Atualizar último login
    try {
      await supabase
        .from('profiles')
        .update({ ultimo_login: new Date().toISOString() })
        .eq('id', user.id)
    } catch (err) {
      console.warn('⚠️ Erro ao atualizar último login:', err)
    }

    // Remover password_hash antes de retornar
    const { password_hash, ...userWithoutPassword } = user

    console.log('✅ Login bem-sucedido!')

    return { 
      data: { user: userWithoutPassword }, 
      error: null 
    }
  } catch (error) {
    console.error('❌ Erro no login:', error)
    throw error
  }
}

// Logout (agora apenas limpa, redirecionamento é feito pelo store)
export function signOut() {
  // Limpar sessão do localStorage
  localStorage.removeItem('user')
  localStorage.removeItem('session')
  return { error: null }
}

// Verificar sessão atual
export function getSession() {
  try {
    const userStr = localStorage.getItem('user')
    if (!userStr) return null
    
    const user = JSON.parse(userStr)
    return { user }
  } catch {
    return null
  }
}

// Salvar sessão
export function saveSession(user) {
  localStorage.setItem('user', JSON.stringify(user))
  localStorage.setItem('session', JSON.stringify({ 
    expires_at: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 dias
  }))
}

// Verificar se sessão expirou
export function isSessionValid() {
  try {
    const sessionStr = localStorage.getItem('session')
    if (!sessionStr) return false
    
    const session = JSON.parse(sessionStr)
    return Date.now() < session.expires_at
  } catch {
    return false
  }
}


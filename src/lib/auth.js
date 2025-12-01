// Sistema de Autenticação Personalizado usando apenas a tabela profiles
import { supabase } from './supabase'

// Criar usuário (cadastro) - usando Edge Function
export async function signUp(email, password, profileData) {
  if (!supabase) throw new Error('Supabase não configurado.')

  try {
    // Chamar Edge Function para criar usuário com hash seguro
    const { data, error } = await supabase.functions.invoke('create-user', {
      body: {
        email,
        password,
        profileData,
      },
    })

    if (error) throw error
    if (data.error) throw new Error(data.error)

    return { data: data.data, error: null }
  } catch (error) {
    // Fallback: se Edge Function não estiver disponível, usar método direto (menos seguro)
    console.warn('Edge Function não disponível, usando método direto (não recomendado para produção)')
    
    // Verificar se email já existe
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle()

    if (existingUser) {
      throw new Error('Email já cadastrado.')
    }

    // Hash simples (NÃO SEGURO - apenas para desenvolvimento)
    const encoder = new TextEncoder()
    const data = encoder.encode(password)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

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

    if (insertError) throw insertError

    const { password_hash, ...userData } = newUser
    return { data: userData, error: null }
  }
}

// Login - usando Edge Function
export async function signIn(email, password) {
  if (!supabase) throw new Error('Supabase não configurado.')

  try {
    // Chamar Edge Function para login com verificação segura
    const { data, error } = await supabase.functions.invoke('login', {
      body: {
        email,
        password,
      },
    })

    if (error) throw error
    if (data.error) throw new Error(data.error)

    return { data: data.data, error: null }
  } catch (error) {
    // Fallback: se Edge Function não estiver disponível
    console.warn('Edge Function não disponível, usando método direto (não recomendado para produção)')
    
    // Buscar usuário
    const { data: user, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('ativo', true)
      .single()

    if (fetchError || !user) {
      throw new Error('Email ou senha incorretos.')
    }

    // Hash simples para comparação (NÃO SEGURO - apenas para desenvolvimento)
    const encoder = new TextEncoder()
    const data = encoder.encode(password)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    // Verificar senha
    if (passwordHash !== user.password_hash) {
      throw new Error('Email ou senha incorretos.')
    }

    // Atualizar último login
    await supabase
      .from('profiles')
      .update({ ultimo_login: new Date().toISOString() })
      .eq('id', user.id)

    // Remover password_hash antes de retornar
    const { password_hash, ...userWithoutPassword } = user

    return { 
      data: { user: userWithoutPassword }, 
      error: null 
    }
  }
}

// Logout
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


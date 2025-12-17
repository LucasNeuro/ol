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

// Função auxiliar para codificar em base64 URL-safe
function base64UrlEncode(str) {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

// Função auxiliar para decodificar base64 URL-safe
function base64UrlDecode(str) {
  // Adicionar padding se necessário
  str = str.replace(/-/g, '+').replace(/_/g, '/')
  while (str.length % 4) {
    str += '='
  }
  return atob(str)
}

// Gerar hash seguro para recuperação de senha (baseado em email + timestamp)
async function gerarHashRecuperacao(email, timestamp) {
  const secret = 'sistema-licitacao-reset-2024' // Chave secreta (em produção, usar variável de ambiente)
  const data = `${email.toLowerCase()}:${timestamp}:${secret}`
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(data)
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  // Codificar em base64 URL-safe
  return base64UrlEncode(`${timestamp}:${hash}`)
}

// Validar hash de recuperação
async function validarHashRecuperacao(email, hash) {
  try {
    // Decodificar base64
    const decoded = base64UrlDecode(hash)
    const [timestamp, hashValue] = decoded.split(':')
    
    if (!timestamp || !hashValue) return false
    
    // Verificar se expirou (24 horas)
    const timestampNum = parseInt(timestamp, 10)
    if (isNaN(timestampNum)) return false
    
    const expiresAt = timestampNum + (24 * 60 * 60 * 1000)
    if (Date.now() > expiresAt) {
      console.log('❌ Hash expirado')
      return false
    }
    
    // Gerar hash esperado e comparar
    const expectedHash = await gerarHashRecuperacao(email, timestampNum)
    return hash === expectedHash
  } catch (error) {
    console.error('❌ Erro ao validar hash:', error)
    return false
  }
}

// Solicitar recuperação de senha
export async function solicitarRecuperacaoSenha(email) {
  if (!supabase) throw new Error('Supabase não configurado.')

  console.log('🔐 Solicitando recuperação de senha para:', email)
  
  try {
    // Verificar se email existe na tabela profiles
    const { data: user, error: fetchError } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', email.toLowerCase())
      .eq('ativo', true)
      .maybeSingle()

    if (fetchError) {
      console.error('❌ Erro ao buscar usuário:', fetchError)
      throw new Error('Erro ao verificar email. Tente novamente.')
    }

    // Por segurança, sempre retornar sucesso mesmo se email não existir
    // Isso evita que alguém descubra quais emails estão cadastrados
    if (!user) {
      console.log('⚠️ Email não encontrado, mas retornando sucesso por segurança')
      return { success: true }
    }

    console.log('✅ Email encontrado, gerando hash...')

    // Gerar hash seguro baseado em email + timestamp
    const timestamp = Date.now()
    const hash = await gerarHashRecuperacao(user.email, timestamp)

    console.log('✅ Hash gerado, enviando email...')

    // Construir URL de recuperação
    const baseUrl = window.location.origin
    const resetUrl = `${baseUrl}/redefinir-senha/${hash}?email=${encodeURIComponent(user.email)}`

    // Chamar Edge Function para enviar email
    const { data: functionData, error: functionError } = await supabase.functions.invoke('enviar-email-recuperacao', {
      body: {
        email: user.email,
        resetUrl: resetUrl
      }
    })

    if (functionError) {
      console.error('❌ Erro ao enviar email:', functionError)
      // Não falhar se o email não for enviado, apenas logar
      console.warn('⚠️ Email não foi enviado')
    }

    console.log('✅ Solicitação de recuperação processada com sucesso!')
    return { success: true }
  } catch (error) {
    console.error('❌ Erro na recuperação de senha:', error)
    throw error
  }
}

// Validar hash de recuperação
export async function validarTokenRecuperacao(hash, email) {
  if (!hash || !email) {
    console.log('❌ Hash ou email não fornecido')
    return false
  }

  console.log('🔍 Validando hash de recuperação...')
  
  try {
    const isValid = await validarHashRecuperacao(email, hash)
    
    if (isValid) {
      console.log('✅ Hash válido!')
    } else {
      console.log('❌ Hash inválido ou expirado')
    }
    
    return isValid
  } catch (error) {
    console.error('❌ Erro ao validar hash:', error)
    return false
  }
}

// Redefinir senha usando hash
export async function redefinirSenha(hash, email, newPassword) {
  if (!supabase) throw new Error('Supabase não configurado.')

  console.log('🔐 Redefinindo senha...')
  
  try {
    // Validar hash primeiro
    const isValid = await validarHashRecuperacao(email, hash)
    if (!isValid) {
      throw new Error('Link inválido ou expirado. Solicite um novo link de recuperação.')
    }

    // Buscar usuário pelo email
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email.toLowerCase())
      .eq('ativo', true)
      .maybeSingle()

    if (userError || !user) {
      throw new Error('Usuário não encontrado.')
    }

    // Hash da nova senha (SHA-256)
    const encoder = new TextEncoder()
    const data = encoder.encode(newPassword)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    console.log('🔐 Senha hashada, atualizando...')

    // Atualizar senha do usuário
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ password_hash: passwordHash })
      .eq('id', user.id)

    if (updateError) {
      console.error('❌ Erro ao atualizar senha:', updateError)
      throw new Error('Erro ao atualizar senha. Tente novamente.')
    }

    console.log('✅ Senha redefinida com sucesso!')
    return { success: true }
  } catch (error) {
    console.error('❌ Erro ao redefinir senha:', error)
    throw error
  }
}


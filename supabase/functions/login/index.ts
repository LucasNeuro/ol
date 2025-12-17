// ============================================
// EDGE FUNCTION: LOGIN
// ============================================
// Login com verificação de senha usando bcrypt
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { compare } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, password } = await req.json()
    
    if (!email || !password) {
      throw new Error('Email e senha são obrigatórios')
    }

    console.log('🔐 Tentando login:', email)

    // Verificar variáveis de ambiente
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Variáveis de ambiente não configuradas')
      throw new Error('Configuração do Supabase não encontrada')
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Buscar usuário
    const { data: user, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('ativo', true)
      .single()

    if (fetchError || !user) {
      throw new Error('Email ou senha incorretos')
    }

    // Verificar senha
    const isValid = await compare(password, user.password_hash)
    
    if (!isValid) {
      throw new Error('Email ou senha incorretos')
    }

    // Atualizar último login
    await supabaseAdmin
      .from('profiles')
      .update({ ultimo_login: new Date().toISOString() })
      .eq('id', user.id)

    // Remover password_hash antes de retornar
    const { password_hash, ...userData } = user

    console.log('✅ Login bem-sucedido:', userData.id)

    return new Response(
      JSON.stringify({ 
        success: true,
        data: { user: userData } 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      }
    )
  } catch (error) {
    console.error('❌ Erro no login:', error.message)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Email ou senha incorretos'
      }),
      { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    )
  }
})



// ============================================
// EDGE FUNCTION: CREATE USER
// ============================================
// Cria usuário com hash de senha seguro
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { hash } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts"

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
    const { email, password, profileData } = await req.json()
    
    if (!email || !password) {
      throw new Error('Email e senha são obrigatórios')
    }

    console.log('👤 Criando novo usuário:', email)

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

    // Verificar se email já existe
    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email.toLowerCase())
      .single()

    if (existing) {
      throw new Error('Email já cadastrado')
    }

    // Hash da senha com bcrypt
    const passwordHash = await hash(password)

    // Criar perfil
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .insert({
        email: email.toLowerCase(),
        password_hash: passwordHash,
        ...profileData,
      })
      .select()
      .single()

    if (error) throw error

    // Remover password_hash antes de retornar
    const { password_hash, ...userData } = data

    console.log('✅ Usuário criado com sucesso:', userData.id)

    return new Response(
      JSON.stringify({ data: userData }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      }
    )
  } catch (error) {
    console.error('❌ Erro ao criar usuário:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Erro desconhecido ao criar usuário'
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    )
  }
})


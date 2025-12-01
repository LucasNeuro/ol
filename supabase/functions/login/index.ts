// Edge Function para login com verificação de senha
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { compare } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts"

serve(async (req) => {
  try {
    const { email, password } = await req.json()
    
    if (!email || !password) {
      throw new Error('Email e senha são obrigatórios')
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
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

    return new Response(
      JSON.stringify({ data: { user: userData } }),
      { headers: { "Content-Type": "application/json" } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    )
  }
})



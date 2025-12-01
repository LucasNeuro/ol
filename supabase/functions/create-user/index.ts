// Edge Function para criar usuário com hash de senha seguro
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { hash } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts"

serve(async (req) => {
  try {
    const { email, password, profileData } = await req.json()
    
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

    return new Response(
      JSON.stringify({ data: userData }),
      { headers: { "Content-Type": "application/json" } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  }
})


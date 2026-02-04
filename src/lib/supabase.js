import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey)

/** Mensagem amigável quando Supabase não está configurado (ex.: deploy no Render sem env vars) */
export const SUPABASE_NAO_CONFIGURADO_MSG =
  'Supabase não configurado. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nas variáveis de ambiente. ' +
  'No Render: Dashboard do serviço → Environment → adicione as variáveis e faça um novo deploy.'

// Validação mais amigável
if (!isSupabaseConfigured) {
  if (import.meta.env.DEV) {
    console.warn('⚠️ Variáveis de ambiente do Supabase não configuradas!')
    console.warn('Crie um arquivo .env com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY')
    console.warn('Funcionalidades que requerem autenticação não estarão disponíveis.')
  }
}

// Criar cliente apenas se as variáveis estiverem configuradas
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null


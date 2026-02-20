/**
 * Dispara só a Edge Function alerta-email-diario (para testar envio de e-mail).
 * Uso: npm run trigger-alerta-email   (a partir da pasta ol)
 */
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../.env') })

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('❌ Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env')
  process.exit(1)
}

const baseUrl = url.replace(/\/$/, '')
const target = `${baseUrl}/functions/v1/alerta-email-diario`

;(async () => {
  try {
    console.log('Chamando alerta-email-diario...')
    const res = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({}),
    })
    const text = await res.text()
    const data = text ? JSON.parse(text) : {}
    if (!res.ok) {
      console.error('❌ Resposta', res.status, text)
      process.exit(1)
    }
    console.log('✅ Resposta:', data)
    console.log('   Processados:', data.processados ?? 0, '| E-mails enviados:', data.totalEmailsEnviados ?? 0)
  } catch (err) {
    console.error('❌ Erro:', err.message)
    process.exit(1)
  }
})()

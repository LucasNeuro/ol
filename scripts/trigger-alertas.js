/**
 * Dispara as Edge Functions de alertas (WhatsApp e E-mail) no Supabase.
 * Uso: cd ol && node scripts/trigger-alertas.js
 * Carrega .env da pasta ol (onde está o .env com VITE_SUPABASE_*).
 */
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../.env') })

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('❌ Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (ou SUPABASE_*) no ambiente.')
  process.exit(1)
}

const baseUrl = url.replace(/\/$/, '')
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${key}`,
}

async function chamar(funcao) {
  const target = `${baseUrl}/functions/v1/${funcao}`
  console.log(`Chamando ${funcao}...`)
  const res = await fetch(target, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  })
  const text = await res.text()
  let data = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch (_) {
    data = { raw: text }
  }
  if (!res.ok) {
    console.error(`Resposta ${res.status}:`, text)
    throw new Error(`${res.status}: ${text}`)
  }
  return data
}

;(async () => {
  try {
    const [whatsapp, email] = await Promise.all([
      chamar('alerta-whatsapp-diario'),
      chamar('alerta-email-diario'),
    ])
    console.log('✅ Alertas executados:')
    console.log('   WhatsApp:', whatsapp.processados ?? 0, 'alertas,', whatsapp.totalEnvios ?? 0, 'envios')
    console.log('   E-mail:', email.processados ?? 0, 'alertas,', email.totalEmailsEnviados ?? 0, 'e-mails')
  } catch (err) {
    console.error('❌ Falha ao chamar alertas:', err.message)
    process.exit(1)
  }
})()

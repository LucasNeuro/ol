/**
 * Dispara a Edge Function alerta-whatsapp-diario no Supabase.
 * Uso: node scripts/trigger-alerta-whatsapp.js
 * Variáveis de ambiente: VITE_SUPABASE_URL (ou SUPABASE_URL) e VITE_SUPABASE_ANON_KEY (ou SUPABASE_ANON_KEY).
 *
 * No Render: o Cron Job "alerta-whatsapp-diario" no render.yaml roda a cada hora (0 * * * *).
 * Em Brasil (BRT) isso cai no início de cada hora (08:00, 09:00, …). Use horário redondo (ex.: 08:00).
 */
const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('❌ Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (ou SUPABASE_*) no ambiente.')
  process.exit(1)
}

const functionUrl = `${url.replace(/\/$/, '')}/functions/v1/alerta-whatsapp-diario`

;(async () => {
  try {
    const res = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({}),
    })
    const text = await res.text()
    if (!res.ok) {
      console.error('❌ Erro ao chamar alerta-whatsapp-diario:', res.status, text)
      process.exit(1)
    }
    const data = text ? JSON.parse(text) : {}
    console.log('✅ Alerta WhatsApp executado:', data.processados ?? 0, 'alertas,', data.totalEnvios ?? 0, 'envios.')
  } catch (err) {
    console.error('❌ Falha:', err.message)
    process.exit(1)
  }
})()

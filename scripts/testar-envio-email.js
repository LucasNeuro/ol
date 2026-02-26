/**
 * TESTE DE ENVIO DE E-MAIL (força disparo imediato)
 * ===================================================
 * Atualiza temporariamente o horário do alerta para o horário atual,
 * chama a Edge Function e depois restaura o horário original.
 *
 * Uso: node scripts/testar-envio-email.js
 */
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const anonKey    = process.env.VITE_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const OK   = '\x1b[32m✔\x1b[0m'
const FAIL = '\x1b[31m✘\x1b[0m'
const INFO = '\x1b[33m→\x1b[0m'

if (!supabaseUrl || !anonKey || !serviceKey) {
  console.error(`${FAIL} Defina VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY no .env`)
  process.exit(1)
}

// Headers com service role (necessário para UPDATE sem RLS)
const serviceHeaders = {
  'apikey': serviceKey,
  'Authorization': `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
}

// Headers com anon key (para chamar Edge Function)
const anonHeaders = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${anonKey}`,
}

// Calcula horário atual de Brasília no formato HH:MM:SS
function horarioBrasilAgora() {
  const now = new Date()
  const br  = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const h   = String(br.getHours()).padStart(2, '0')
  const m   = String(br.getMinutes()).padStart(2, '0')
  const s   = String(br.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

console.log('\n════════════════════════════════════════')
console.log('  TESTE DE ENVIO DE E-MAIL')
console.log('════════════════════════════════════════\n')

// 1. Buscar alertas ativos do tipo email
console.log('1. Buscando alertas de e-mail ativos...')
const resAlertas = await fetch(
  `${supabaseUrl}/rest/v1/alertas_usuario?ativo=eq.true&select=id,nome_alerta,tipo,horario_verificacao,email_notificacao&order=created_at.desc`,
  { headers: serviceHeaders }
)
const alertas = await resAlertas.json()

if (!alertas?.length) {
  console.log(`   ${FAIL} Nenhum alerta ativo encontrado. Crie e ative um alerta na página de Alertas.`)
  process.exit(1)
}

const emailAlertas = alertas.filter(a => !a.tipo || a.tipo === 'email')
if (!emailAlertas.length) {
  console.log(`   ${FAIL} Nenhum alerta de e-mail ativo encontrado.`)
  process.exit(1)
}

console.log(`   ${OK} ${emailAlertas.length} alerta(s) encontrado(s):`)
emailAlertas.forEach((a, i) => {
  console.log(`   ${i + 1}. "${a.nome_alerta}" — horário: ${String(a.horario_verificacao).slice(0,5)} — e-mail: ${a.email_notificacao || '(do perfil)'}`)
})

// Usa o primeiro alerta encontrado para o teste
const alerta = emailAlertas[0]
const horarioOriginal = alerta.horario_verificacao
const horarioAgora    = horarioBrasilAgora()

console.log(`\n2. Horário atual no Brasil: \x1b[36m${horarioAgora}\x1b[0m`)
console.log(`   Alerta selecionado: \x1b[36m"${alerta.nome_alerta}"\x1b[0m (horário original: ${String(horarioOriginal).slice(0,5)})`)
console.log(`   Atualizando horário para ${horarioAgora} para forçar o disparo...`)

// 2. Atualizar horário para agora
const resUpd = await fetch(
  `${supabaseUrl}/rest/v1/alertas_usuario?id=eq.${alerta.id}`,
  {
    method: 'PATCH',
    headers: serviceHeaders,
    body: JSON.stringify({ horario_verificacao: horarioAgora }),
  }
)
if (!resUpd.ok) {
  const txt = await resUpd.text()
  console.log(`   ${FAIL} Erro ao atualizar horário: ${resUpd.status} ${txt}`)
  process.exit(1)
}
console.log(`   ${OK} Horário atualizado para ${horarioAgora}`)

// 3. Chamar a Edge Function alerta-diario
console.log('\n3. Chamando Edge Function "alerta-diario"...')
let resposta = null
try {
  const resFn = await fetch(
    `${supabaseUrl.replace(/\/$/, '')}/functions/v1/alerta-diario`,
    {
      method: 'POST',
      headers: anonHeaders,
      body: JSON.stringify({}),
    }
  )
  const txt = await resFn.text()
  try { resposta = JSON.parse(txt) } catch { resposta = { raw: txt } }

  if (!resFn.ok) {
    console.log(`   ${FAIL} Edge Function retornou HTTP ${resFn.status}:`, resposta)
  } else if (resposta?.error) {
    console.log(`   ${FAIL} Erro na Edge Function: ${resposta.error}`)
    if (String(resposta.error).includes('RESEND')) {
      console.log(`\n   ${INFO} AÇÃO NECESSÁRIA:`)
      console.log(`      Vá em: Dashboard → Settings → Edge Functions → Secrets`)
      console.log(`      Adicione: RESEND_API_KEY = re_dVMk1uUn_KDdMszeyQsRuGMFT3UigZ1s9`)
      console.log(`      Adicione: EMAIL_FROM    = Sistema Licitação <onboarding@resend.dev>`)
      console.log(`      Adicione: SITE_URL      = https://ewqqxzvyehhitqbrbqzl.supabase.co`)
    }
  } else {
    console.log(`   ${OK} Edge Function OK!`)
    console.log(`      Alertas processados : ${resposta?.processados ?? 0}`)
    console.log(`      E-mails enviados    : ${resposta?.totalEmails ?? 0}`)
    console.log(`      WhatsApp enviados   : ${resposta?.totalWhatsApp ?? 0}`)
    console.log(`      Horário BR detectado: ${resposta?.horario ?? '—'}`)

    if ((resposta?.processados ?? 0) > 0 && (resposta?.totalEmails ?? 0) > 0) {
      console.log(`\n   \x1b[32m🎉 E-MAIL ENVIADO COM SUCESSO!\x1b[0m`)
      console.log(`   Verifique a caixa de entrada de: ${alerta.email_notificacao || '(e-mail do perfil)'}`)
    } else if ((resposta?.processados ?? 0) > 0 && (resposta?.totalEmails ?? 0) === 0) {
      console.log(`\n   ${FAIL} Alerta processado mas e-mail NÃO foi enviado.`)
      console.log(`   ${INFO} Provável causa: RESEND_API_KEY não configurada nas Secrets da Edge Function.`)
      console.log(`   ${INFO} Vá em: Dashboard → Settings → Edge Functions → Secrets`)
    } else if ((resposta?.processados ?? 0) === 0) {
      console.log(`\n   ${FAIL} Nenhum alerta processado (inesperado).`)
      console.log(`   ${INFO} Resposta completa:`, JSON.stringify(resposta, null, 2))
    }
  }
} catch (e) {
  console.log(`   ${FAIL} Erro ao chamar Edge Function: ${e.message}`)
}

// 4. Restaurar horário original
console.log(`\n4. Restaurando horário original (${String(horarioOriginal).slice(0,5)})...`)
const resRestore = await fetch(
  `${supabaseUrl}/rest/v1/alertas_usuario?id=eq.${alerta.id}`,
  {
    method: 'PATCH',
    headers: serviceHeaders,
    body: JSON.stringify({ horario_verificacao: horarioOriginal }),
  }
)
if (resRestore.ok) {
  console.log(`   ${OK} Horário restaurado para ${String(horarioOriginal).slice(0,5)}`)
} else {
  const txt = await resRestore.text()
  console.log(`   ${FAIL} Erro ao restaurar horário: ${txt}`)
  console.log(`   ${INFO} Restaure manualmente no banco: UPDATE alertas_usuario SET horario_verificacao = '${horarioOriginal}' WHERE id = '${alerta.id}';`)
}

console.log('\n════════════════════════════════════════')
console.log('  FIM DO TESTE')
console.log('════════════════════════════════════════\n')

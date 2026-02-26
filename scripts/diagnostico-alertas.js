/**
 * DIAGNÓSTICO DO SISTEMA DE ALERTAS
 * ===================================
 * Verifica se todas as configurações estão corretas e testa o envio.
 * Uso: node scripts/diagnostico-alertas.js
 */
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

const OK   = '\x1b[32m✔\x1b[0m'
const FAIL = '\x1b[31m✘\x1b[0m'
const INFO = '\x1b[33m→\x1b[0m'

console.log('\n════════════════════════════════════════')
console.log('  DIAGNÓSTICO DO SISTEMA DE ALERTAS')
console.log('════════════════════════════════════════\n')

// 1. Verificar variáveis de ambiente
console.log('1. Variáveis de ambiente (.env local):')
if (supabaseUrl) {
  console.log(`   ${OK} SUPABASE_URL: ${supabaseUrl}`)
} else {
  console.log(`   ${FAIL} SUPABASE_URL não encontrada`)
  process.exit(1)
}
if (anonKey) {
  console.log(`   ${OK} SUPABASE_ANON_KEY: ${anonKey.slice(0, 20)}...`)
} else {
  console.log(`   ${FAIL} SUPABASE_ANON_KEY não encontrada`)
  process.exit(1)
}

// 2. Testar conectividade com Supabase
console.log('\n2. Testando conectividade com Supabase...')
try {
  const res = await fetch(`${supabaseUrl}/rest/v1/alertas_usuario?select=count&limit=1`, {
    headers: {
      'apikey': anonKey,
      'Authorization': `Bearer ${anonKey}`,
    }
  })
  if (res.ok) {
    console.log(`   ${OK} Supabase acessível (status ${res.status})`)
  } else {
    const txt = await res.text()
    console.log(`   ${FAIL} Supabase retornou ${res.status}: ${txt}`)
  }
} catch (e) {
  console.log(`   ${FAIL} Erro ao conectar: ${e.message}`)
}

// 3. Verificar alertas ativos no banco
console.log('\n3. Verificando alertas ativos no banco...')
try {
  const res = await fetch(`${supabaseUrl}/rest/v1/alertas_usuario?ativo=eq.true&select=id,nome_alerta,tipo,horario_verificacao,email_notificacao`, {
    headers: {
      'apikey': anonKey,
      'Authorization': `Bearer ${anonKey}`,
    }
  })
  if (res.ok) {
    const alertas = await res.json()
    if (alertas.length === 0) {
      console.log(`   ${INFO} Nenhum alerta ativo encontrado. Ative um alerta na página de Alertas.`)
    } else {
      console.log(`   ${OK} ${alertas.length} alerta(s) ativo(s) encontrado(s):`)
      for (const a of alertas) {
        const horario = a.horario_verificacao ? String(a.horario_verificacao).slice(0, 5) : '—'
        const email = a.email_notificacao || '(usa e-mail do perfil)'
        console.log(`      • [${a.tipo}] "${a.nome_alerta}" — horário: ${horario} — e-mail: ${email}`)
      }
    }
  } else {
    console.log(`   ${FAIL} Erro ao buscar alertas: ${res.status}`)
  }
} catch (e) {
  console.log(`   ${FAIL} Erro: ${e.message}`)
}

// 4. Chamar a Edge Function alerta-diario e ver resposta
console.log('\n4. Chamando Edge Function "alerta-diario"...')
const targetUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/alerta-diario`
try {
  const res = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${anonKey}`,
    },
    body: JSON.stringify({}),
  })
  const text = await res.text()
  let data = {}
  try { data = JSON.parse(text) } catch {}

  if (!res.ok) {
    console.log(`   ${FAIL} Erro HTTP ${res.status}: ${text}`)
  } else if (data.error) {
    console.log(`   ${FAIL} Edge Function retornou erro: ${data.error}`)
    if (data.error.includes('RESEND_API_KEY')) {
      console.log(`\n   ${INFO} AÇÃO NECESSÁRIA NO PAINEL DO SUPABASE:`)
      console.log(`      Dashboard > Settings > Edge Functions > Secrets`)
      console.log(`      Adicionar: RESEND_API_KEY = <sua chave do Resend>`)
      console.log(`      Adicionar: EMAIL_FROM = Nome Remetente <email@seudominio.com>`)
      console.log(`      Adicionar: SITE_URL = https://seu-site.com`)
    }
  } else {
    console.log(`   ${OK} Edge Function respondeu OK!`)
    console.log(`      Horário BR atual: ${data.horario || '—'}`)
    console.log(`      Alertas processados: ${data.processados ?? 0}`)
    console.log(`      E-mails enviados: ${data.totalEmails ?? 0}`)
    console.log(`      WhatsApp enviados: ${data.totalWhatsApp ?? 0}`)
    if ((data.processados ?? 0) === 0) {
      console.log(`\n   ${INFO} Nenhum alerta foi processado. Possíveis causas:`)
      console.log(`      • Nenhum alerta ativo com horário dentro dos próximos ±5 min do horário atual`)
      console.log(`      • Verifique o horário configurado no alerta`)
    }
  }
} catch (e) {
  console.log(`   ${FAIL} Erro ao chamar Edge Function: ${e.message}`)
}

// 5. Checar histórico de execuções (alertas_execucoes)
console.log('\n5. Últimas execuções registradas (alertas_execucoes)...')
try {
  // Primeiro tenta descobrir as colunas disponíveis buscando 1 registro sem filtros de coluna
  const resSchema = await fetch(
    `${supabaseUrl}/rest/v1/alertas_execucoes?limit=1`,
    {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Accept': 'application/json',
      }
    }
  )
  if (!resSchema.ok) {
    const txt = await resSchema.text()
    console.log(`   ${INFO} Não foi possível acessar alertas_execucoes (pode ser RLS): ${resSchema.status} ${txt}`)
  } else {
    const sample = await resSchema.json()
    if (sample.length === 0) {
      console.log(`   ${INFO} Nenhuma execução registrada ainda (tabela vazia ou sem permissão de leitura).`)
    } else {
      // Detectar coluna de data
      const colunaData = sample[0].created_at !== undefined ? 'created_at'
        : sample[0].inserted_at !== undefined ? 'inserted_at'
        : sample[0].executado_em !== undefined ? 'executado_em'
        : sample[0].data_execucao !== undefined ? 'data_execucao'
        : null
      console.log(`   ${OK} Colunas detectadas: ${Object.keys(sample[0]).join(', ')}`)

      // Buscar últimas 5 com order dinâmico
      const orderParam = colunaData ? `&order=${colunaData}.desc` : ''
      const res2 = await fetch(
        `${supabaseUrl}/rest/v1/alertas_execucoes?limit=5${orderParam}`,
        {
          headers: {
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`,
          }
        }
      )
      const execucoes = await res2.json()
      for (const e of execucoes) {
        const status = e.sucesso ? OK : FAIL
        const dataStr = colunaData ? new Date(e[colunaData]).toLocaleString('pt-BR') : '—'
        console.log(`   ${status} [${dataStr}] encontradas: ${e.total_encontrado ?? '?'} | enviada: ${e.notificacao_enviada ?? '?'}${e.erro_mensagem ? ` | erro: ${e.erro_mensagem}` : ''}`)
      }
    }
  }
} catch (e) {
  console.log(`   ${FAIL} Erro: ${e.message}`)
}

console.log('\n════════════════════════════════════════')
console.log('  FIM DO DIAGNÓSTICO')
console.log('════════════════════════════════════════\n')

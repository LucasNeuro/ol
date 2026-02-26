/**
 * TESTE DE ENVIO DE WHATSAPP VIA UAZAPI
 * =======================================
 * Busca a primeira licitação disponível e envia via WhatsApp
 * para um número de teste informado como argumento.
 *
 * Uso: node scripts/testar-envio-whatsapp.js 5511999999999
 *   ou: node scripts/testar-envio-whatsapp.js  (usa o número da instância UAZAPI)
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

if (!supabaseUrl || !anonKey) {
  console.error(`${FAIL} Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env`)
  process.exit(1)
}

// Número passado como argumento (ou padrão: número da instância UAZAPI)
const telefoneArg = process.argv[2]?.replace(/\D/g, '')
const telefone = telefoneArg
  ? (telefoneArg.startsWith('55') ? telefoneArg : `55${telefoneArg}`)
  : '5511914589862' // número conectado na instância UAZAPI

console.log('\n════════════════════════════════════════')
console.log('  TESTE DE ENVIO DE WHATSAPP (UAZAPI)')
console.log('════════════════════════════════════════\n')
console.log(`${INFO} Número de destino: \x1b[36m${telefone}\x1b[0m`)

// 1. Buscar uma licitação recente para testar
console.log('\n1. Buscando licitação recente para o teste...')
const resLicit = await fetch(
  `${supabaseUrl}/rest/v1/licitacoes?select=id,numero_controle_pncp,objeto_compra,orgao_razao_social,modalidade_nome,valor_total_estimado,uf_sigla,data_publicacao_pncp,link_portal_pncp&order=data_publicacao_pncp.desc&limit=1`,
  {
    headers: {
      'apikey': serviceKey || anonKey,
      'Authorization': `Bearer ${serviceKey || anonKey}`,
    }
  }
)

if (!resLicit.ok) {
  console.log(`${FAIL} Erro ao buscar licitações: ${resLicit.status}`)
  process.exit(1)
}

const licitacoes = await resLicit.json()
if (!licitacoes?.length) {
  console.log(`${FAIL} Nenhuma licitação encontrada no banco.`)
  process.exit(1)
}

const lic = licitacoes[0]
console.log(`${OK} Licitação encontrada:`)
console.log(`   Objeto : ${String(lic.objeto_compra || '').slice(0, 80)}...`)
console.log(`   Órgão  : ${lic.orgao_razao_social || '—'}`)
console.log(`   UF     : ${lic.uf_sigla || '—'}`)
console.log(`   Valor  : R$ ${Number(lic.valor_total_estimado || 0).toLocaleString('pt-BR')}`)

// 2. Chamar a Edge Function enviar-whatsapp-uazapi
console.log('\n2. Chamando Edge Function "enviar-whatsapp-uazapi"...')

const payload = {
  telefone,
  objeto_licitacao : lic.objeto_compra || 'Não informado',
  objeto           : lic.objeto_compra || 'Não informado',
  orgao            : lic.orgao_razao_social || 'Não informado',
  modalidade       : lic.modalidade_nome || 'Não informado',
  valor_total      : lic.valor_total_estimado,
  valor_total_formatado: lic.valor_total_estimado != null
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lic.valor_total_estimado)
    : null,
  uf               : lic.uf_sigla || '',
  numero_controle  : lic.numero_controle_pncp || lic.id,
  data_publicacao  : lic.data_publicacao_pncp || null,
  link_pncp        : lic.link_portal_pncp || null,
}

try {
  const res = await fetch(
    `${supabaseUrl.replace(/\/$/, '')}/functions/v1/enviar-whatsapp-uazapi`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
      },
      body: JSON.stringify(payload),
    }
  )

  const txt = await res.text()
  let data = {}
  try { data = JSON.parse(txt) } catch {}

  if (!res.ok || data.error) {
    console.log(`${FAIL} Erro HTTP ${res.status}: ${data.error || txt}`)

    if (String(data.error || '').includes('não configurado') || String(data.error || '').includes('UAZAPI')) {
      console.log(`\n${INFO} AÇÃO NECESSÁRIA:`)
      console.log(`   Dashboard → Settings → Edge Functions → Secrets`)
      console.log(`   UAZAPI_TOKEN       = <token da instância>`)
      console.log(`   UAZAPI_BASE_URL    = https://atendemais.uazapi.com`)
      console.log(`   UAZAPI_INSTANCE_ID = Atendimentos_gerais_1769030774704`)
    }
  } else {
    console.log(`${OK} \x1b[32mMensagem enviada com sucesso!\x1b[0m`)
    console.log(`   Resposta UAZAPI:`, JSON.stringify(data, null, 2))
    console.log(`\n${INFO} Verifique o WhatsApp do número \x1b[36m+${telefone}\x1b[0m`)
    console.log(`${INFO} A mensagem deve chegar com os botões:`)
    console.log(`   ✅ "Sim, tenho interesse neste edital"`)
    console.log(`   ❌ "Não tenho interesse neste edital"`)
    console.log(`\n${INFO} Se o webhook estiver configurado na UAZAPI,`)
    console.log(`   clicar em "Sim" enviará os documentos do edital automaticamente.`)
  }
} catch (e) {
  console.log(`${FAIL} Erro ao chamar Edge Function: ${e.message}`)
}

console.log('\n════════════════════════════════════════')
console.log('  FIM DO TESTE')
console.log('════════════════════════════════════════\n')

/**
 * Testa a Edge Function validar-correspondencia-ia (filtro semântico por IA).
 *
 * Uso:
 *   npm run testar-validacao-ia
 *   node scripts/testar-validacao-ia.js
 *
 * Requer .env com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.
 * A Edge Function precisa estar rodando (local ou deploy) e MISTRAL_API_KEY configurada.
 */

import 'dotenv/config'

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('❌ Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env')
  process.exit(1)
}

const baseUrl = url.replace(/\/$/, '')
const functionUrl = `${baseUrl}/functions/v1/validar-correspondencia-ia`

async function testarModoUnico() {
  console.log('\n--- Teste 1: Modo único (uma licitação) ---\n')

  const body = {
    objetoLicitacao: 'Aquisição de medicamentos de uso contínuo para rede municipal de saúde, conforme termo de referência.',
    atividadesEmpresa: [
      { setor: 'Saúde', subsetores: ['Medicamentos', 'Hospitalar'] }
    ]
  }

  const res = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
      'apikey': key
    },
    body: JSON.stringify(body)
  })

  const data = await res.json().catch(() => ({}))
  console.log('Status:', res.status)
  console.log('Resposta:', JSON.stringify(data, null, 2))

  if (res.ok && typeof data.resultado === 'boolean') {
    console.log(data.resultado ? '✅ SIM – licitação considerada relevante' : '❌ NÃO – licitação não relevante')
  } else if (data.mensagem) {
    console.log('⚠️', data.mensagem)
  }
  return res.ok
}

async function testarModoLote() {
  console.log('\n--- Teste 2: Modo lote (várias licitações) ---\n')

  const body = {
    lotes: [
      { id: '1', objeto: 'Aquisição de medicamentos para UBS.' },
      { id: '2', objeto: 'Obra de pavimentação asfáltica em vias urbanas.' },
      { id: '3', objeto: 'Contratação de fornecimento de material de limpeza e higiene para unidades de saúde.' }
    ],
    atividadesEmpresa: [
      { setor: 'Saúde', subsetores: ['Medicamentos', 'Hospitalar'] }
    ]
  }

  const res = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
      'apikey': key
    },
    body: JSON.stringify(body)
  })

  const data = await res.json().catch(() => ({}))
  console.log('Status:', res.status)
  console.log('Resposta:', JSON.stringify(data, null, 2))

  if (res.ok && Array.isArray(data.resultados)) {
    data.resultados.forEach(({ id, resultado }) => {
      console.log(`  ID ${id}: ${resultado ? '✅ SIM' : '❌ NÃO'}`)
    })
  }
  return res.ok
}

async function main() {
  console.log('🔗 URL da função:', functionUrl)
  console.log('   (local: supabase functions serve validar-correspondencia-ia)')
  console.log('   (deploy: usar a URL do seu projeto Supabase)')

  try {
    const ok1 = await testarModoUnico()
    const ok2 = await testarModoLote()
    if (ok1 && ok2) {
      console.log('\n✅ Testes concluídos.')
    } else {
      console.log('\n⚠️ Algum teste falhou. Verifique se a Edge Function está rodando e MISTRAL_API_KEY está configurada.')
      process.exit(1)
    }
  } catch (err) {
    console.error('\n❌ Erro:', err.message)
    if (err.cause) console.error(err.cause)
    process.exit(1)
  }
}

main()

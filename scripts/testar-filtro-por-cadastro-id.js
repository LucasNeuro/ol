/**
 * Teste profundo do filtro usando um cadastro real (ID do profile).
 * Busca setores_atividades e estados_interesse do banco para o ID informado,
 * depois aplica o filtro semântico em licitações reais e mostra resultado.
 *
 * Uso (a partir da pasta ol):
 *   node scripts/testar-filtro-por-cadastro-id.js
 *   node scripts/testar-filtro-por-cadastro-id.js 4354bddb-05bc-49bf-878b-b3765a4ab45b
 *   USER_ID=outro-uuid node scripts/testar-filtro-por-cadastro-id.js
 *
 * Requer .env:
 *   VITE_SUPABASE_URL (ou SUPABASE_URL)
 *   Para ler perfil de qualquer usuário: SUPABASE_SERVICE_ROLE_KEY
 *   (sem service role, RLS pode impedir ler outro usuário)
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import {
  correspondeAtividades,
  extrairPalavrasChaveDosSetores,
  obterObjetoCompleto
} from '../src/lib/filtroSemantico.js'

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const userId = process.env.USER_ID || process.argv[2] || '4354bddb-05bc-49bf-878b-b3765a4ab45b'

if (!url || !anonKey) {
  console.error('❌ Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env')
  process.exit(1)
}

const supabase = createClient(url, serviceKey || anonKey, {
  auth: { persistSession: false }
})

async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, setores_atividades, estados_interesse')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('❌ Erro ao buscar perfil:', error.message)
    return null
  }
  if (!data) {
    console.error('❌ Perfil não encontrado para o ID:', userId)
    return null
  }
  return data
}

async function getPalavrasFortesPorSetor() {
  const { data, error } = await supabase
    .from('setores_palavras_fortes')
    .select('setor_nome, palavra')
    .eq('ativo', true)

  if (error) {
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      return {}
    }
    console.warn('⚠️ Palavras fortes:', error.message)
    return {}
  }

  const porSetor = {}
  ;(data || []).forEach(({ setor_nome, palavra }) => {
    const chave = (setor_nome || '').toLowerCase().trim()
    if (!chave || !palavra) return
    if (!porSetor[chave]) porSetor[chave] = []
    const p = (palavra || '').toLowerCase().trim()
    if (p && !porSetor[chave].includes(p)) porSetor[chave].push(p)
  })
  return porSetor
}

async function getLicitacoesAmostra(limit = 300) {
  const { data, error } = await supabase
    .from('licitacoes')
    .select('id, objeto_compra, dados_completos, uf_sigla, orgao_razao_social')
    .order('data_publicacao_pncp', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('❌ Erro ao buscar licitações:', error.message)
    return []
  }
  return data || []
}

async function main() {
  console.log('\n--- Teste do filtro por ID de cadastro ---\n')
  console.log('User ID:', userId)
  if (!serviceKey) {
    console.log('⚠️ SUPABASE_SERVICE_ROLE_KEY não definida: se o perfil não for do mesmo usuário da sessão, a leitura pode falhar por RLS.\n')
  }

  const profile = await getProfile(userId)
  if (!profile) process.exit(1)

  const setoresAtividades = profile.setores_atividades || []
  const estadosInteresse = profile.estados_interesse || []

  if (setoresAtividades.length === 0) {
    console.error('❌ Este cadastro não tem setores_atividades. Configure setores no perfil.')
    process.exit(1)
  }

  console.log('Perfil carregado:')
  console.log('  Setores:', setoresAtividades.map(s => s.setor).join(', '))
  console.log('  Subsetores (amostra):', setoresAtividades.flatMap(s => (s.subsetores || []).slice(0, 5)).join(', '))
  console.log('  Estados:', estadosInteresse?.length ? estadosInteresse.join(', ') : '(vazio ou Nacional)')
  console.log('')

  const palavrasFortesPorSetor = await getPalavrasFortesPorSetor()
  console.log('Palavras fortes do banco:', Object.keys(palavrasFortesPorSetor).length, 'setores')
  console.log('')

  const palavrasChave = extrairPalavrasChaveDosSetores(setoresAtividades, {}, {})
  console.log('Palavras-chave (total):', (palavrasChave.todas || []).length)
  console.log('')

  console.log('Buscando amostra de licitações do banco...')
  const licitacoes = await getLicitacoesAmostra(300)
  console.log('Licitações carregadas:', licitacoes.length)
  if (licitacoes.length === 0) {
    console.log('Nenhuma licitação no banco para testar.')
    process.exit(0)
  }

  let aceitas = 0
  let rejeitadas = 0
  const exemplosAceitas = []
  const exemplosRejeitadas = []

  for (const lic of licitacoes) {
    const resultado = correspondeAtividades(
      lic,
      palavrasChave,
      {},
      {},
      setoresAtividades,
      palavrasFortesPorSetor
    )
    if (resultado) {
      aceitas++
      if (exemplosAceitas.length < 5) {
        const obj = obterObjetoCompleto(lic) || ''
        exemplosAceitas.push({ id: lic.id, objeto: obj.substring(0, 120), uf: lic.uf_sigla })
      }
    } else {
      rejeitadas++
      if (exemplosRejeitadas.length < 5) {
        const obj = obterObjetoCompleto(lic) || ''
        exemplosRejeitadas.push({ id: lic.id, objeto: obj.substring(0, 120), uf: lic.uf_sigla })
      }
    }
  }

  console.log('\n--- Resultado do filtro semântico ---\n')
  console.log('Total processadas:', licitacoes.length)
  console.log('  Aceitas (passam no filtro):', aceitas)
  console.log('  Rejeitadas:', rejeitadas)
  console.log('  % aceitas:', licitacoes.length ? ((aceitas / licitacoes.length) * 100).toFixed(1) : 0, '%')

  console.log('\nExemplos ACEITAS (primeiras 5):')
  exemplosAceitas.forEach((ex, i) => {
    console.log(`  ${i + 1}. [${ex.uf}] ${ex.objeto}${ex.objeto.length >= 120 ? '...' : ''}`)
  })

  console.log('\nExemplos REJEITADAS (primeiras 5):')
  exemplosRejeitadas.forEach((ex, i) => {
    console.log(`  ${i + 1}. [${ex.uf}] ${ex.objeto}${ex.objeto.length >= 120 ? '...' : ''}`)
  })

  console.log('\n✅ Teste concluído. O filtro está usando o cadastro do ID', userId)
  process.exit(0)
}

main().catch((err) => {
  console.error('❌ Erro:', err.message)
  process.exit(1)
})

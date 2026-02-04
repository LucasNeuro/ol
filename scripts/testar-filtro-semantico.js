/**
 * Certificação do filtro semântico (lógica em código).
 * Testa correspondeAtividades com cenários que devem ACEITAR ou REJEITAR
 * conforme a lógica definida em filtroSemantico.js (incompatibilidades, palavras fortes).
 *
 * Uso (a partir da pasta ol):
 *   node scripts/testar-filtro-semantico.js
 *
 * Não depende de Supabase nem de IA; apenas do módulo filtroSemantico.
 */

import {
  correspondeAtividades,
  extrairPalavrasChaveDosSetores,
  obterObjetoCompleto
} from '../src/lib/filtroSemantico.js'

function licitacao(objetoCompra) {
  return {
    objeto_compra: objetoCompra,
    dados_completos: { objetoCompra }
  }
}

function runTest(name, licitacaoObj, setoresAtividades, palavrasFortesPorSetor, expected) {
  const palavrasChave = extrairPalavrasChaveDosSetores(setoresAtividades, {}, {})
  const result = correspondeAtividades(
    licitacaoObj,
    palavrasChave,
    {},
    {},
    setoresAtividades,
    palavrasFortesPorSetor || {}
  )
  const ok = result === expected
  console.log(ok ? '  ✅' : '  ❌', name, '→', result ? 'ACEITA' : 'REJEITA', '(esperado:', expected ? 'ACEITA' : 'REJEITA', ')')
  return ok
}

const setoresSaude = [
  { setor: 'Saúde', subsetores: ['Medicamentos', 'Material hospitalar', 'Equipamentos médicos'] }
]

const setoresConstrucao = [
  { setor: 'Engenharia', subsetores: ['Construção civil', 'Pavimentação', 'Obras'] }
]

// Palavras fortes por setor (simula banco) — necessário para o filtro aceitar por "palavra forte"
const palavrasFortesSaude = {
  saude: ['medicamento', 'medicamentos', 'hospitalar', 'medico', 'hospital', 'laboratorio', 'material medico']
}
const palavrasFortesConstrucao = {
  engenharia: ['construcao', 'obra', 'pavimentacao', 'drenagem', 'asfalto', 'concreto', 'obras civis']
}

let passed = 0
let failed = 0

console.log('\n--- Certificação do filtro semântico ---\n')
console.log('Perfil: Saúde (Medicamentos, Material hospitalar)\n')

// Saúde — deve ACEITAR
if (runTest(
  'Objeto sobre medicamentos para rede municipal',
  licitacao('Aquisição de medicamentos de uso contínuo para a rede municipal de saúde.'),
  setoresSaude,
  palavrasFortesSaude,
  true
)) passed++; else failed++;

if (runTest(
  'Fornecimento de material médico-hospitalar descartável',
  licitacao('Fornecimento de material médico-hospitalar descartável para unidades de saúde.'),
  setoresSaude,
  palavrasFortesSaude,
  true
)) passed++; else failed++;

// Saúde — deve REJEITAR (incompatibilidade)
if (runTest(
  'Obra de pavimentação asfáltica',
  licitacao('Obra de pavimentação asfáltica em vias urbanas, conforme projeto.'),
  setoresSaude,
  palavrasFortesSaude,
  false
)) passed++; else failed++;

if (runTest(
  'Revisão preventiva de veículos da frota',
  licitacao('Revisão preventiva de veículos da frota municipal, incluindo troca de óleo e filtros.'),
  setoresSaude,
  palavrasFortesSaude,
  false
)) passed++; else failed++;

if (runTest(
  'Manutenção de frota de veículos',
  licitacao('Contratação de serviços de manutenção de veículo e frota para a Secretaria de Saúde.'),
  setoresSaude,
  palavrasFortesSaude,
  false
)) passed++; else failed++;

if (runTest(
  'Equipamentos de áudio e som (não médico)',
  licitacao('Aquisição de equipamentos de áudio e som para salas de reunião.'),
  setoresSaude,
  palavrasFortesSaude,
  false
)) passed++; else failed++;

console.log('\nPerfil: Engenharia / Construção\n')

// Construção — deve ACEITAR
if (runTest(
  'Obra de pavimentação e drenagem',
  licitacao('Obra de pavimentação e drenagem em vias urbanas, conforme projeto básico.'),
  setoresConstrucao,
  palavrasFortesConstrucao,
  true
)) passed++; else failed++;

// Construção — deve REJEITAR (incompatibilidade)
if (runTest(
  'Aquisição de medicamentos para UBS',
  licitacao('Aquisição de medicamentos para dispensação em UBS.'),
  setoresConstrucao,
  palavrasFortesConstrucao,
  false
)) passed++; else failed++;

if (runTest(
  'Material hospitalar e laboratorial',
  licitacao('Fornecimento de material hospitalar e laboratorial para rede pública.'),
  setoresConstrucao,
  palavrasFortesConstrucao,
  false
)) passed++; else failed++;

// obterObjetoCompleto
console.log('\n--- obterObjetoCompleto ---\n')
const lic = licitacao('Teste de objeto')
const obj = obterObjetoCompleto(lic)
const okObjeto = obj === 'Teste de objeto'
console.log(okObjeto ? '  ✅' : '  ❌', 'Objeto extraído corretamente:', obj?.substring(0, 30))
if (okObjeto) passed++; else failed++;

console.log('\n--- Resultado ---\n')
console.log(`Total: ${passed + failed} | ✅ ${passed} passaram | ❌ ${failed} falharam`)

if (failed > 0) {
  console.log('\n⚠️ Certificação do filtro semântico FALHOU. Revise a lógica em src/lib/filtroSemantico.js')
  process.exit(1)
}
console.log('\n✅ Certificação do filtro semântico OK.')
process.exit(0)

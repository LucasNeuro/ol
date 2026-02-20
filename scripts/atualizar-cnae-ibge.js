/**
 * Atualiza o arquivo de CNAEs a partir da API aberta do IBGE.
 * Gera src/lib/cnae-ibge.json com mapeamento código -> descrição.
 *
 * Uso: node scripts/atualizar-cnae-ibge.js
 *
 * API: https://servicodados.ibge.gov.br/api/docs/CNAE?versao=2
 * - Classes: 673 itens  (id no formato 4721-1/04)
 * - Subclasses: 1301 itens (id no formato 4721-1/04, normalizado para 7 dígitos)
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_PATH = path.join(__dirname, '..', 'src', 'lib', 'cnae-ibge.json')

const BASE = 'https://servicodados.ibge.gov.br/api/v2/cnae'

/** Normaliza id da API (ex: "4721-1/04") para 7 dígitos (ex: "4721104") */
function normalizarId(id) {
  if (id == null) return null
  const digits = String(id).replace(/\D/g, '')
  if (digits.length >= 7) return digits.slice(0, 7)
  if (digits.length > 0) return digits.padStart(7, '0')
  return null
}

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} ${res.status}`)
  return res.json()
}

async function main() {
  const mapa = {}

  // 1) Classes (673)
  console.log('Buscando classes...')
  const classes = await fetchJson(`${BASE}/classes`)
  const listClasses = Array.isArray(classes) ? classes : [classes]
  for (const c of listClasses) {
    const id = normalizarId(c.id ?? c.identificador ?? c.subclasse)
    const nome = c.nome ?? c.descricao ?? c.descricao_ativ ?? c.observacoes
    if (id && nome) mapa[id] = nome
  }

  // 2) Subclasses (1301) - cobrem códigos de 7 dígitos usados no CNPJ
  console.log('Buscando subclasses...')
  try {
    const subclasses = await fetchJson(`${BASE}/subclasses`)
    const listSub = Array.isArray(subclasses) ? subclasses : [subclasses]
    for (const s of listSub) {
      const id = normalizarId(s.id ?? s.identificador ?? s.subclasse)
      const nome = s.nome ?? s.descricao ?? s.descricao_ativ ?? s.observacoes
      if (id && nome) mapa[id] = nome
    }
  } catch (e) {
    console.warn('Subclasses não disponíveis ou erro:', e.message)
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(mapa, null, 2), 'utf8')
  console.log('Escrito:', OUT_PATH, '|', Object.keys(mapa).length, 'CNAEs')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

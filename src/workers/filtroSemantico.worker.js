/**
 * Web Worker para o filtro semântico de licitações.
 * Roda correspondeAtividades em background para não travar a UI.
 */
import { correspondeAtividades, obterObjetoCompleto, normalizarTexto } from '../lib/filtroSemantico.js'

const PROGRESSO_INTERVALO = 100 // Enviar progresso a cada N licitações

self.onmessage = (e) => {
  const { type, payload } = e.data || {}
  if (type !== 'filter' || !payload) return

  const {
    licitacoes = [],
    palavrasChave,
    sinonimosPersonalizados = {},
    sinonimosBancoFormatados = {},
    setoresAtividades = [],
    palavrasFortesPorSetor = {},
    palavrasIncompatibilidadePorSetor = {},
  } = payload

  const aprovados = []
  const duvidosos = []
  const total = licitacoes.length
  let processados = 0

  for (let i = 0; i < licitacoes.length; i++) {
    const licitacao = licitacoes[i]
    const correspondeSemantico = correspondeAtividades(
      licitacao,
      palavrasChave,
      sinonimosPersonalizados,
      sinonimosBancoFormatados,
      setoresAtividades,
      palavrasFortesPorSetor,
      palavrasIncompatibilidadePorSetor
    )

    if (correspondeSemantico === true) {
      aprovados.push(licitacao)
    } else if (correspondeSemantico === false && setoresAtividades?.length > 0) {
      const objetoCompleto = obterObjetoCompleto(licitacao)
      if (objetoCompleto) {
        const objetoNormalizado = normalizarTexto(objetoCompleto)
        const principais = palavrasChave?.principais || []
        const temPalavraChave = principais.some((palavra) => {
          const p = normalizarTexto(palavra)
          if (objetoNormalizado.includes(p)) return true
          if (p.length >= 5 && objetoNormalizado.includes(p.substring(0, 5))) return true
          return false
        })
        if (temPalavraChave) duvidosos.push(licitacao)
      }
    }

    processados++
    if (processados % PROGRESSO_INTERVALO === 0 || processados === total) {
      self.postMessage({
        type: 'progress',
        processados,
        total,
        percent: total ? Math.round((processados / total) * 100) : 100,
      })
    }
  }

  self.postMessage({
    type: 'done',
    aprovados,
    duvidosos,
  })
}

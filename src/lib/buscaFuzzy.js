/**
 * Utilitários para busca com similaridade (fuzzy search)
 * Suporta busca case-insensitive e similaridade mesmo com erros de digitação
 */

/**
 * Normaliza texto removendo acentos e caracteres especiais
 */
export function normalizarTexto(texto) {
  if (!texto) return ''
  return String(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^\w\s]/g, ' ') // Remove caracteres especiais
    .replace(/\s+/g, ' ') // Normaliza espaços
    .trim()
}

/**
 * Calcula similaridade entre duas strings usando Levenshtein Distance
 * Retorna um valor entre 0 (sem similaridade) e 1 (idênticas)
 */
function calcularSimilaridade(str1, str2) {
  if (!str1 || !str2) return 0
  
  const s1 = normalizarTexto(str1)
  const s2 = normalizarTexto(str2)
  
  // Se são idênticas, retorna 1
  if (s1 === s2) return 1
  
  // Se uma contém a outra, retorna 0.9
  if (s1.includes(s2) || s2.includes(s1)) {
    return 0.9
  }
  
  // Calcular distância de Levenshtein
  const len1 = s1.length
  const len2 = s2.length
  
  // Se uma das strings é muito pequena, usar comparação simples
  if (len1 < 3 || len2 < 3) {
    return s1 === s2 ? 1 : 0
  }
  
  // Criar matriz para Levenshtein
  const matrix = []
  
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i]
  }
  
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j
  }
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (s1.charAt(i - 1) === s2.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substituição
          matrix[i][j - 1] + 1,     // inserção
          matrix[i - 1][j] + 1      // deleção
        )
      }
    }
  }
  
  const distance = matrix[len1][len2]
  const maxLen = Math.max(len1, len2)
  
  // Converter distância em similaridade (0 a 1)
  return 1 - (distance / maxLen)
}

/**
 * Verifica se um texto contém um termo (com similaridade)
 * @param {string} texto - Texto onde buscar
 * @param {string} termo - Termo a buscar
 * @param {number} thresholdSimilaridade - Limite de similaridade (0 a 1), padrão 0.6
 * @returns {boolean} - true se encontrou com similaridade suficiente
 */
export function contemTermo(texto, termo, thresholdSimilaridade = 0.6) {
  if (!texto || !termo) return false
  
  const textoNormalizado = normalizarTexto(texto)
  const termoNormalizado = normalizarTexto(termo)
  
  // Se termo muito curto, usar busca exata
  if (termoNormalizado.length <= 2) {
    return textoNormalizado.includes(termoNormalizado)
  }
  
  // 1. Busca exata (case-insensitive, sem acentos)
  if (textoNormalizado.includes(termoNormalizado)) {
    return true
  }
  
  // 2. Busca por palavras individuais (quebrar em palavras)
  const palavrasTexto = textoNormalizado.split(/\s+/).filter(p => p.length > 0)
  const palavrasTermo = termoNormalizado.split(/\s+/).filter(p => p.length > 0)
  
  // Se o termo tem múltiplas palavras, verificar se todas as palavras existem
  if (palavrasTermo.length > 1) {
    const todasPalavrasEncontradas = palavrasTermo.every(palavraTermo =>
      palavrasTexto.some(palavraTexto => {
        // Busca exata da palavra
        if (palavraTexto.includes(palavraTermo)) return true
        // Busca por similaridade (apenas se palavras têm mais de 3 caracteres)
        if (palavraTermo.length > 3 && palavraTexto.length > 3) {
          return calcularSimilaridade(palavraTexto, palavraTermo) >= thresholdSimilaridade
        }
        return false
      })
    )
    if (todasPalavrasEncontradas) return true
  }
  
  // 3. Busca por similaridade (fuzzy) em palavras individuais
  // Apenas para palavras com mais de 3 caracteres (evita falsos positivos)
  for (const palavraTexto of palavrasTexto) {
    if (palavraTexto.length <= 3) continue // Pular palavras muito curtas
    
    for (const palavraTermo of palavrasTermo) {
      if (palavraTermo.length <= 3) continue // Pular termos muito curtos
      
      // Se a palavra texto contém parte do termo
      if (palavraTexto.includes(palavraTermo) || palavraTermo.includes(palavraTexto)) {
        return true
      }
      
      const similaridade = calcularSimilaridade(palavraTexto, palavraTermo)
      if (similaridade >= thresholdSimilaridade) {
        return true
      }
    }
  }
  
  // 4. Busca por similaridade no texto completo (apenas para termos médios/grandes)
  if (termoNormalizado.length > 5) {
    const similaridadeCompleta = calcularSimilaridade(textoNormalizado, termoNormalizado)
    if (similaridadeCompleta >= thresholdSimilaridade) {
      return true
    }
    
    // 5. Busca parcial melhorada para termos compostos
    // Útil para termos como "pavimentação asfáltica" onde partes podem aparecer
    if (termoNormalizado.length > 8) {
      const palavrasTermo = termoNormalizado.split(/\s+/).filter(p => p.length > 3)
      if (palavrasTermo.length > 1) {
        // Se pelo menos 70% das palavras principais aparecem no texto, considera match
        const palavrasEncontradas = palavrasTermo.filter(palavra => 
          textoNormalizado.includes(palavra)
        )
        if (palavrasEncontradas.length >= Math.ceil(palavrasTermo.length * 0.7)) {
          return true
        }
      }
    }
  }
  
  return false
}

/**
 * Busca um termo em múltiplos campos de uma licitação (INTELIGENTE)
 * Busca em todos os campos relevantes do objeto do edital no cache
 * @param {Object} licitacao - Objeto da licitação do cache IndexedDB
 * @param {string} termo - Termo a buscar
 * @param {number} thresholdSimilaridade - Limite de similaridade (0 a 1)
 * @returns {boolean} - true se encontrou em algum campo
 */
export function buscarEmLicitacao(licitacao, termo, thresholdSimilaridade = 0.6) {
  if (!licitacao || !termo) return false
  
  // Campos principais onde buscar (maior prioridade)
  const camposPrincipais = [
    licitacao.objeto_compra, // Campo mais importante - descrição da licitação
    licitacao.orgao_razao_social, // Órgão responsável
    licitacao.numero_controle_pncp, // Número de controle
    licitacao.modalidade_nome, // Tipo de licitação (Pregão, Concorrência, etc)
  ]
  
  // Campos secundários
  const camposSecundarios = [
    licitacao.unidade_nome,
    licitacao.municipio_nome,
    licitacao.uf_sigla,
    licitacao.informacao_complementar,
    licitacao.processo,
    licitacao.numero_compra,
  ]
  
  // Buscar em campos principais primeiro (mais relevante)
  const encontradoNosPrincipais = camposPrincipais.some(campo => 
    campo && contemTermo(campo, termo, thresholdSimilaridade)
  )
  
  if (encontradoNosPrincipais) return true
  
  // Se não encontrou nos principais, buscar nos secundários
  const encontradoNosSecundarios = camposSecundarios.some(campo => 
    campo && contemTermo(campo, termo, thresholdSimilaridade)
  )
  
  if (encontradoNosSecundarios) return true
  
  // Buscar em dados_completos (objeto JSON) se disponível
  if (licitacao.dados_completos && typeof licitacao.dados_completos === 'object') {
    const dadosCompletos = licitacao.dados_completos
    
    // Buscar em campos específicos dentro de dados_completos
    const camposExtras = [
      dadosCompletos.objeto,
      dadosCompletos.objeto_detalhado,
      dadosCompletos.descricao,
      dadosCompletos.informacao_complementar,
      dadosCompletos.justificativa,
    ].filter(Boolean)
    
    const encontradoNosExtras = camposExtras.some(campo => 
      contemTermo(campo, termo, thresholdSimilaridade)
    )
    
    if (encontradoNosExtras) return true
  }
  
  // Buscar nos itens do edital (se disponível)
  if (licitacao.itens && Array.isArray(licitacao.itens) && licitacao.itens.length > 0) {
    const encontradoNosItens = licitacao.itens.some(item => {
      // Buscar na descrição do item
      const descricaoItem = item?.descricao || item?.item || item?.objeto || ''
      if (descricaoItem && contemTermo(descricaoItem, termo, thresholdSimilaridade)) {
        return true
      }
      
      // Buscar em outros campos do item se disponível
      const camposItem = [
        item?.material,
        item?.servico,
        item?.marca,
        item?.especificacao,
      ].filter(Boolean)
      
      return camposItem.some(campo => 
        contemTermo(campo, termo, thresholdSimilaridade)
      )
    })
    
    if (encontradoNosItens) return true
  }
  
  return false
}

/**
 * Filtra licitações usando busca fuzzy INTELIGENTE
 * Trabalha exclusivamente com dados do cache IndexedDB
 * @param {Array} licitacoes - Array de licitações do cache
 * @param {string|Array} termos - Termo(s) de busca (pode ser string com vírgulas ou array)
 * @param {number} thresholdSimilaridade - Limite de similaridade (0 a 1)
 * @returns {Array} - Licitações filtradas
 */
export function filtrarLicitacoesPorBusca(licitacoes, termos, thresholdSimilaridade = 0.6) {
  if (!licitacoes || licitacoes.length === 0) return []
  if (!termos) return licitacoes
  
  // Normalizar termos: aceitar string com vírgulas ou array
  // Suporta múltiplos formatos: "palavra1, palavra2" ou "palavra1 palavra2"
  const termosArray = Array.isArray(termos)
    ? termos
    : termos.split(/[,\n]/) // Separar por vírgula ou quebra de linha
        .map(t => t.trim())
        .filter(t => t.length > 0)
        .flatMap(t => {
          // Se termo tem espaços, também pode ser múltiplas palavras
          // Mas mantém como termo único se não tem vírgula explícita
          return t.includes(' ') && !t.includes(',') ? [t] : t.split(/\s+/).filter(w => w.length > 0)
        })
        .filter(t => t.length > 0)
  
  if (termosArray.length === 0) return licitacoes
  
  // Filtrar: licitação deve corresponder a PELO MENOS UM dos termos (OR lógico)
  // Cada termo é buscado em todos os campos do objeto do edital
  const resultado = licitacoes.filter(licitacao => {
    return termosArray.some(termo => 
      buscarEmLicitacao(licitacao, termo, thresholdSimilaridade)
    )
  })
  
  return resultado
}


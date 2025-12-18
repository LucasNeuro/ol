/**
 * Utilitários para filtragem semântica de licitações
 * Compara o objeto da licitação com as atividades cadastradas pela empresa
 */

/**
 * Remove acentos e normaliza texto para comparação
 */
function normalizarTexto(texto) {
  if (!texto) return ''
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^\w\s]/g, ' ') // Remove caracteres especiais
    .replace(/\s+/g, ' ') // Normaliza espaços
    .trim()
}

/**
 * Extrai a raiz de uma palavra (stemming básico em português)
 * Remove sufixos comuns para melhor correspondência
 */
function extrairRaizPalavra(palavra) {
  if (!palavra || palavra.length < 4) return palavra
  
  const sufixos = [
    'ção', 'coes', 'são', 'soes', 'ção', 'ções',
    'mento', 'mentos', 'agem', 'agens',
    'dade', 'dades', 'ção', 'ções',
    'ção', 'ções', 'são', 'soes',
    'ar', 'er', 'ir', 'or', 'ur',
    'ado', 'ada', 'idos', 'idas',
    'ando', 'endo', 'indo', 'ondo'
  ]
  
  for (const sufixo of sufixos) {
    if (palavra.endsWith(sufixo) && palavra.length > sufixo.length + 2) {
      return palavra.slice(0, -sufixo.length)
    }
  }
  
  return palavra
}

/**
 * Verifica correspondência parcial entre palavras
 * Aceita se uma palavra contém a outra ou vice-versa
 */
function correspondeParcial(palavra1, palavra2) {
  const p1 = normalizarTexto(palavra1)
  const p2 = normalizarTexto(palavra2)
  
  // Correspondência exata
  if (p1 === p2) return true
  
  // Uma contém a outra (para palavras compostas)
  if (p1.includes(p2) || p2.includes(p1)) {
    // Verificar se não é muito curta (evitar falsos positivos)
    const menor = p1.length < p2.length ? p1 : p2
    return menor.length >= 4
  }
  
  // Verificar raiz das palavras
  const raiz1 = extrairRaizPalavra(p1)
  const raiz2 = extrairRaizPalavra(p2)
  
  if (raiz1 === raiz2 && raiz1.length >= 4) return true
  
  return false
}

/**
 * Extrai palavras-chave relevantes de um texto
 * Considera palavras com mais de 3 caracteres e termos compostos
 * REMOVE palavras muito genéricas que causam falsos positivos
 * MELHORADO: Extrai mais variações e termos relacionados
 */
function extrairPalavrasChave(texto) {
  if (!texto) return []
  
  const normalizado = normalizarTexto(texto)
  
  // Dividir em palavras
  const palavras = normalizado.split(/\s+/)
  
  // Palavras muito genéricas que devem ser ignoradas (causam falsos positivos)
  const palavrasGenericasIgnorar = [
    'servico', 'servicos', 'prestacao', 'prestação', 'fornecimento', 'fornecer',
    'aquisição', 'aquisicao', 'compra', 'adquirir', 'contratacao', 'contratação',
    'publico', 'publica', 'municipal', 'estadual', 'federal', 'governo', 'orgao', 'órgão'
  ]
  
  // Filtrar palavras relevantes (mais de 3 caracteres e não genéricas)
  const palavrasRelevantes = palavras.filter(p => 
    p.length > 3 && 
    !palavrasGenericasIgnorar.includes(p)
  )
  
  // Adicionar termos compostos (palavras adjacentes)
  const termosCompostos = []
  for (let i = 0; i < palavrasRelevantes.length - 1; i++) {
    const termoComposto = `${palavrasRelevantes[i]} ${palavrasRelevantes[i + 1]}`
    termosCompostos.push(termoComposto)
    
    // Adicionar também termos de 3 palavras (mais específicos)
    if (i < palavrasRelevantes.length - 2) {
      const termoTriplo = `${palavrasRelevantes[i]} ${palavrasRelevantes[i + 1]} ${palavrasRelevantes[i + 2]}`
      termosCompostos.push(termoTriplo)
    }
  }
  
  // Adicionar raízes das palavras para melhor correspondência
  const raizes = palavrasRelevantes.map(p => extrairRaizPalavra(p)).filter(r => r.length >= 4)
  
  return [...new Set([...palavrasRelevantes, ...termosCompostos, ...raizes])]
}

/**
 * Mapeamento de sinônimos MÍNIMO (fallback apenas)
 * Usado apenas quando tabela do banco não está disponível
 * A fonte principal de sinônimos deve ser a tabela `sinonimos` do banco
 * 
 * NOTA: Este objeto deve ser mantido mínimo. Para sinônimos completos,
 * use a tabela `sinonimos` do banco de dados que pode ser gerenciada
 * dinamicamente e contém muito mais termos.
 */
const SINONIMOS_BASE_MINIMO = {
  'construção': ['construcao', 'obra', 'edificação', 'edificacao'],
  'engenharia': ['engenheiro', 'projeto', 'projetos'],
  'serviço': ['servico', 'servicos', 'prestação', 'prestacao'],
  'material': ['materiais', 'equipamento', 'equipamentos'],
}

/**
 * Obtém sinônimos mesclando banco + base mínimo + personalizados
 * PRIORIDADE: Banco > Personalizados > Base Mínimo
 * 
 * @param {Object} sinonimosBanco - Sinônimos do banco de dados (PRINCIPAL)
 * @param {Object} sinonimosPersonalizados - Sinônimos personalizados da empresa (opcional)
 * @returns {Object} - Sinônimos mesclados
 */
function obterSinonimos(sinonimosBanco = {}, sinonimosPersonalizados = {}) {
  // Converter sinônimos do banco (formato {palavra: [{sinonimo, peso}]}) para formato simples
  const sinonimosBancoFormatados = {}
  Object.entries(sinonimosBanco).forEach(([palavra, sinonimos]) => {
    if (Array.isArray(sinonimos)) {
      // Converter array de objetos {sinonimo, peso} para array de strings
      sinonimosBancoFormatados[palavra] = sinonimos.map(s => 
        typeof s === 'object' ? s.sinonimo : s
      )
    }
  })
  
  // Mesclar: Banco (principal) > Personalizados > Base Mínimo (fallback)
  const sinonimos = { 
    ...SINONIMOS_BASE_MINIMO,  // Fallback mínimo
    ...sinonimosBancoFormatados, // Banco (principal)
    ...sinonimosPersonalizados   // Personalizados (sobrescreve se houver)
  }
  
  // Mesclar arrays quando há sobreposição (personalizados têm prioridade)
  Object.entries(sinonimosPersonalizados).forEach(([chave, valores]) => {
    if (sinonimos[chave] && Array.isArray(sinonimos[chave])) {
      // Se já existe, mesclar arrays (personalizados têm prioridade)
      sinonimos[chave] = [...new Set([...valores, ...sinonimos[chave]])]
    } else {
      // Se não existe, adicionar novo
      sinonimos[chave] = valores
    }
  })
  
  return sinonimos
}

/**
 * Expande palavras-chave com sinônimos
 * @param {Array} palavras - Palavras-chave a expandir
 * @param {Object} sinonimosPersonalizados - Sinônimos personalizados da empresa (opcional)
 * @param {Object} sinonimosBanco - Sinônimos do banco de dados (opcional)
 */
function expandirComSinonimos(palavras, sinonimosPersonalizados = {}, sinonimosBanco = {}) {
  const expandidas = new Set(palavras)
  
  // Converter sinônimos do banco para formato simples se necessário
  const sinonimosBancoFormatados = {}
  if (sinonimosBanco && typeof sinonimosBanco === 'object') {
    Object.entries(sinonimosBanco).forEach(([palavra, sinonimos]) => {
      if (Array.isArray(sinonimos)) {
        // Se é array de objetos {sinonimo, peso}, converter para array de strings
        if (sinonimos.length > 0 && typeof sinonimos[0] === 'object' && sinonimos[0].sinonimo) {
          sinonimosBancoFormatados[palavra] = sinonimos.map(s => s.sinonimo)
        } else {
          // Já é array de strings
          sinonimosBancoFormatados[palavra] = sinonimos
        }
      }
    })
  }
  
  // PRIORIDADE: Banco (principal) > Personalizados > Base Mínimo (fallback)
  const sinonimosMesclados = { 
    ...SINONIMOS_BASE_MINIMO,      // Fallback mínimo
    ...sinonimosBancoFormatados,   // Banco (principal - mais completo)
    ...sinonimosPersonalizados    // Personalizados (sobrescreve)
  }
  
  // Normalizar palavras para comparação
  const palavrasNormalizadas = palavras.map(p => normalizarTexto(p))
  
  palavrasNormalizadas.forEach(palavra => {
    // Adicionar a palavra original
    expandidas.add(palavra)
    
    // Verificar se a palavra tem sinônimos diretos
    if (sinonimosMesclados[palavra] && Array.isArray(sinonimosMesclados[palavra])) {
      sinonimosMesclados[palavra].forEach(s => {
        const sinonimoNormalizado = normalizarTexto(s)
        if (sinonimoNormalizado) {
          expandidas.add(sinonimoNormalizado)
        }
      })
    }
    
    // Verificar correspondência parcial (palavra contém chave ou vice-versa)
    Object.entries(sinonimosMesclados).forEach(([chave, sinonimosLista]) => {
      const chaveNormalizada = normalizarTexto(chave)
      
      // Se palavra corresponde exatamente à chave
      if (palavra === chaveNormalizada) {
        if (Array.isArray(sinonimosLista)) {
          sinonimosLista.forEach(s => {
            const sinonimoNormalizado = typeof s === 'string' ? normalizarTexto(s) : normalizarTexto(s.sinonimo || s)
            if (sinonimoNormalizado) {
              expandidas.add(sinonimoNormalizado)
            }
          })
        }
        return
      }
      
      // Se palavra contém a chave ou chave contém a palavra (correspondência parcial)
      if (palavra.includes(chaveNormalizada) || chaveNormalizada.includes(palavra)) {
        if (Array.isArray(sinonimosLista)) {
          // Converter array de objetos para array de strings se necessário
          const sinonimosStrings = sinonimosLista.map(s => 
            typeof s === 'string' ? s : (s.sinonimo || s)
          )
          
          sinonimosStrings.forEach(s => {
            const sinonimoNormalizado = normalizarTexto(s)
            if (sinonimoNormalizado) {
              expandidas.add(sinonimoNormalizado)
            }
          })
          expandidas.add(chaveNormalizada)
        }
      }
    })
  })
  
  return Array.from(expandidas)
}

/**
 * Extrai palavras-chave dos setores e subsetores cadastrados
 * Retorna palavras principais (do setor) e palavras secundárias (dos subsetores)
 * MELHORADO: Agora usa sinônimos do banco de dados para expandir as palavras-chave
 * @param {Array} setoresAtividades - Setores e subsetores da empresa
 * @param {Object} sinonimosPersonalizados - Sinônimos personalizados da empresa (opcional, apenas do profile)
 * @param {Object} sinonimosBanco - Sinônimos do banco de dados (opcional, associados aos setores)
 * @returns {Object} - { principais: [], secundarias: [], todas: [] }
 */
export function extrairPalavrasChaveDosSetores(setoresAtividades, sinonimosPersonalizados = {}, sinonimosBanco = {}) {
  if (!setoresAtividades || !Array.isArray(setoresAtividades)) {
    return { principais: [], secundarias: [], todas: [] }
  }
  
  const palavrasPrincipais = new Set() // Palavras do nome do setor (mais importantes)
  const palavrasSecundarias = new Set() // Palavras dos subsetores
  
  setoresAtividades.forEach(setor => {
    // Adicionar palavras do nome do setor (PRINCIPAIS - obrigatórias)
    if (setor.setor) {
      const palavrasSetor = extrairPalavrasChave(setor.setor)
      palavrasSetor.forEach(p => palavrasPrincipais.add(p))
    }
    
    // Adicionar palavras dos subsetores (SECUNDÁRIAS - complementares)
    if (setor.subsetores && Array.isArray(setor.subsetores)) {
      setor.subsetores.forEach(subsetor => {
        if (subsetor) {
          const palavras = extrairPalavrasChave(subsetor)
          palavras.forEach(p => palavrasSecundarias.add(p))
        }
      })
    }
  })
  
  // Expandir com sinônimos (personalizados + banco de dados + base mínimo)
  const principaisArray = Array.from(palavrasPrincipais)
  const secundariasArray = Array.from(palavrasSecundarias)
  
  console.log(`🔍 [extrairPalavrasChaveDosSetores] Antes da expansão:`, {
    principais: principaisArray.length,
    secundarias: secundariasArray.length,
    sinonimosPersonalizados: Object.keys(sinonimosPersonalizados || {}).length,
    sinonimosBanco: Object.keys(sinonimosBanco || {}).length
  })
  
  // Expandir principais e secundárias (com sinônimos personalizados E do banco)
  const principaisExpandidas = expandirComSinonimos(principaisArray, sinonimosPersonalizados, sinonimosBanco)
  const secundariasExpandidas = expandirComSinonimos(secundariasArray, sinonimosPersonalizados, sinonimosBanco)
  
  console.log(`✅ [extrairPalavrasChaveDosSetores] Após expansão:`, {
    principais: principaisExpandidas.length,
    secundarias: secundariasExpandidas.length,
    expandiuPrincipais: principaisExpandidas.length - principaisArray.length,
    expandiuSecundarias: secundariasExpandidas.length - secundariasArray.length
  })
  
  // Combinar todas
  const todas = [...new Set([...principaisExpandidas, ...secundariasExpandidas])]
  
  return {
    principais: principaisExpandidas,
    secundarias: secundariasExpandidas,
    todas: todas
  }
}

/**
 * Obtém o objeto completo da licitação (de objeto_compra ou dados_completos.objetoCompra)
 */
export function obterObjetoCompleto(licitacao) {
  // Priorizar objetoCompra de dados_completos (mais completo)
  const objetoCompleto = licitacao.dados_completos?.objetoCompra || 
                        licitacao.dados_completos?.objeto_compra ||
                        licitacao.objeto_compra || 
                        ''
  
  return objetoCompleto
}

/**
 * Verifica correspondência contextual - evita falsos positivos
 * Exemplo: "manutenção de informática" não deve corresponder a "manutenção de carro"
 * @param {string} objetoNormalizado - Objeto da licitação normalizado
 * @param {string} palavraChave - Palavra-chave a verificar
 * @param {Array} palavrasContexto - Palavras de contexto do setor (ex: ["informática", "computador"])
 * @returns {boolean} - true se há correspondência contextual válida
 */
function correspondeContextual(objetoNormalizado, palavraChave, palavrasContexto = []) {
  const palavraNormalizada = normalizarTexto(palavraChave)
  
  // Se não tem contexto, verificar correspondência simples (mas ser mais restritivo)
  if (!palavrasContexto || palavrasContexto.length === 0) {
    // Verificar se palavra está no objeto
    return objetoNormalizado.includes(palavraNormalizada)
  }
  
  // Verificar se a palavra-chave está no objeto
  const indicePalavra = objetoNormalizado.indexOf(palavraNormalizada)
  if (indicePalavra === -1) {
    return false
  }
  
  // Verificar se há palavras de contexto próximas (dentro de 100 caracteres - menos restritivo)
  const contextoProximo = palavrasContexto.some(palavraContexto => {
    const palavraContextoNormalizada = normalizarTexto(palavraContexto)
    const indiceContexto = objetoNormalizado.indexOf(palavraContextoNormalizada)
    
    if (indiceContexto === -1) return false
    
    // Verificar proximidade (dentro de 100 caracteres - aumentado de 20 para ser menos restritivo)
    const distancia = Math.abs(indicePalavra - indiceContexto)
    return distancia <= 100
  })
  
  // Se encontrou contexto próximo, é correspondência válida
  if (contextoProximo) {
    return true
  }
  
  // Verificar termos compostos que incluem palavra-chave + contexto
  // Ex: "manutenção de informática" contém tanto "manutenção" quanto "informática"
  const termosCompostos = extrairPalavrasChave(objetoNormalizado)
  const temTermoComposto = termosCompostos.some(termo => {
    const temPalavra = termo.includes(palavraNormalizada)
    const temContexto = palavrasContexto.some(pc => 
      termo.includes(normalizarTexto(pc))
    )
    return temPalavra && temContexto
  })
  
  return temTermoComposto
}

/**
 * Extrai palavras de contexto dos setores (palavras principais que identificam o setor)
 * @param {Array} setoresAtividades - Setores e subsetores da empresa
 * @returns {Array} - Palavras de contexto
 */
function extrairPalavrasContexto(setoresAtividades) {
  if (!setoresAtividades || !Array.isArray(setoresAtividades)) {
    return []
  }
  
  const contexto = new Set()
  
  setoresAtividades.forEach(setor => {
    // Adicionar nome do setor como contexto
    if (setor.setor) {
      const palavrasSetor = extrairPalavrasChave(setor.setor)
      palavrasSetor.forEach(p => contexto.add(p))
    }
    
    // Adicionar subsetores como contexto
    if (setor.subsetores && Array.isArray(setor.subsetores)) {
      setor.subsetores.forEach(subsetor => {
        if (subsetor) {
          const palavras = extrairPalavrasChave(subsetor)
          palavras.forEach(p => contexto.add(p))
        }
      })
    }
  })
  
  return Array.from(contexto)
}

/**
 * Constrói um vocabulário completo do setor baseado nos subsetores cadastrados
 * Este vocabulário é usado para verificar correspondência semântica
 * @param {Array} setoresAtividades - Setores e subsetores da empresa
 * @returns {Set} - Vocabulário completo do setor (palavras únicas)
 */
function construirVocabularioSetor(setoresAtividades) {
  if (!setoresAtividades || !Array.isArray(setoresAtividades)) {
    return new Set()
  }
  
  const vocabulario = new Set()
  
  setoresAtividades.forEach(setor => {
    // Adicionar nome do setor completo
    if (setor.setor) {
      vocabulario.add(normalizarTexto(setor.setor))
      const palavrasSetor = extrairPalavrasChave(setor.setor)
      palavrasSetor.forEach(p => vocabulario.add(p))
    }
    
    // Adicionar subsetores completos e suas palavras
    if (setor.subsetores && Array.isArray(setor.subsetores)) {
      setor.subsetores.forEach(subsetor => {
        if (subsetor) {
          // Adicionar subsetor completo
          vocabulario.add(normalizarTexto(subsetor))
          // Adicionar palavras do subsetor
          const palavras = extrairPalavrasChave(subsetor)
          palavras.forEach(p => vocabulario.add(p))
        }
      })
    }
  })
  
  return vocabulario
}

/**
 * Verifica se o objeto da licitação contém palavras do vocabulário do setor
 * Usa correspondência semântica baseada nos setores cadastrados
 * MELHORADO: Usa correspondência parcial e por raiz para melhor abrangência
 * @param {string} objetoNormalizado - Objeto da licitação normalizado
 * @param {Set} vocabularioSetor - Vocabulário do setor (palavras dos subsetores)
 * @returns {boolean} - true se há correspondência semântica
 */
function correspondeVocabularioSetor(objetoNormalizado, vocabularioSetor) {
  if (!vocabularioSetor || vocabularioSetor.size === 0) {
    return false
  }
  
  // Extrair palavras do objeto para comparação
  const palavrasObjeto = objetoNormalizado.split(/\s+/).filter(p => p.length >= 4)
  
  // Verificar correspondência exata primeiro (mais precisa)
  for (const palavraVocabulario of vocabularioSetor) {
    if (objetoNormalizado.includes(palavraVocabulario)) {
      return true
    }
  }
  
  // Verificar correspondência parcial (mais abrangente)
  for (const palavraVocabulario of vocabularioSetor) {
    const raizVocabulario = extrairRaizPalavra(palavraVocabulario)
    
    // Verificar se alguma palavra do objeto corresponde parcialmente
    for (const palavraObjeto of palavrasObjeto) {
      if (correspondeParcial(palavraVocabulario, palavraObjeto)) {
        return true
      }
      
    
      const raizObjeto = extrairRaizPalavra(palavraObjeto)
      if (raizVocabulario === raizObjeto && raizVocabulario.length >= 4) {
        return true
      }
    }
  }
  
  return false
}

/**
 * Verifica se o objeto da licitação corresponde às atividades da empresa
 * Usa correspondência contextual melhorada para evitar falsos positivos
 * @param {Object} licitacao 
 * @param {Array} palavrasChave 
 * @param {Object} sinonimosPersonalizados 
 * @param {Object} sinonimosBanco 
 * @param {Array} setoresAtividades 
 */
export function correspondeAtividades(
  licitacao, 
  palavrasChave, 
  sinonimosPersonalizados = {},
  sinonimosBanco = {},
  setoresAtividades = []
) {
 
  const palavrasChaveFormatadas = palavrasChave.todas || palavrasChave.principais || (Array.isArray(palavrasChave) ? palavrasChave : [])
  const palavrasPrincipais = palavrasChave.principais || []
  const palavrasSecundarias = palavrasChave.secundarias || []
  
  if (!palavrasChaveFormatadas || palavrasChaveFormatadas.length === 0) {
    return true 
  }
  
  const objetoCompleto = obterObjetoCompleto(licitacao)
  if (!objetoCompleto) {
    return false 
  }
  
  const objetoNormalizado = normalizarTexto(objetoCompleto)
  const palavrasObjeto = objetoNormalizado.split(/\s+/).filter(p => p.length >= 4)
  const palavrasChaveObjeto = extrairPalavrasChave(objetoCompleto)
  const palavrasContexto = extrairPalavrasContexto(setoresAtividades)
  const vocabularioSetor = construirVocabularioSetor(setoresAtividades)
  
  // NOVA ABORDAGEM: Buscar por CADA atividade (subsetor) cadastrada individualmente
  // Isso aumenta muito a abrangência porque busca por termos específicos de cada atividade
  // MELHORADO: Sistema de pontuação para manter precisão e abrangência
  if (setoresAtividades && setoresAtividades.length > 0) {
    let pontuacaoCorrespondencia = 0
    const palavrasGenericas = ['servico', 'servicos', 'manutencao', 'manutenção', 'prestacao', 'prestação', 'fornecimento', 'fornecer']
    
    // Iterar sobre cada setor e seus subsetores
    for (const setor of setoresAtividades) {
      // Verificar nome do setor (peso menor, pois é mais genérico)
      if (setor.setor) {
        const setorNormalizado = normalizarTexto(setor.setor)
        // Correspondência exata do setor completo (peso 3)
        if (objetoNormalizado.includes(setorNormalizado)) {
          pontuacaoCorrespondencia += 3
        } else {
          // Correspondência parcial (peso 1)
          if (palavrasObjeto.some(po => correspondeParcial(setorNormalizado, po))) {
            pontuacaoCorrespondencia += 1
          }
        }
      }
      
      // Verificar CADA subsetor individualmente (mais específico e abrangente)
      if (setor.subsetores && Array.isArray(setor.subsetores)) {
        for (const subsetor of setor.subsetores) {
          if (!subsetor) continue
          
          const subsetorNormalizado = normalizarTexto(subsetor)
          
          // Correspondência exata do subsetor completo (peso 5 - muito específico)
          if (objetoNormalizado.includes(subsetorNormalizado)) {
            pontuacaoCorrespondencia += 5
            continue // Subsetor completo encontrado, não precisa verificar palavras individuais
          }
          
          // Extrair palavras-chave do subsetor para busca mais flexível
          const palavrasSubsetor = extrairPalavrasChave(subsetor)
          let palavrasEncontradas = 0
          
          // Verificar se palavras do subsetor estão no objeto
          for (const palavraSubsetor of palavrasSubsetor) {
            const palavraNormalizada = normalizarTexto(palavraSubsetor)
            
            // Ignorar palavras muito genéricas sem contexto
            if (palavrasGenericas.includes(palavraNormalizada)) {
              // Palavras genéricas precisam de contexto próximo
              const temContexto = palavrasContexto.some(pc => {
                const pcNormalizado = normalizarTexto(pc)
                const indicePalavra = objetoNormalizado.indexOf(palavraNormalizada)
                const indiceContexto = objetoNormalizado.indexOf(pcNormalizado)
                if (indiceContexto === -1) return false
                const distancia = Math.abs(indicePalavra - indiceContexto)
                return distancia <= 150
              })
              if (temContexto) {
                palavrasEncontradas++
                pontuacaoCorrespondencia += 2
              }
              continue
            }
            
            // Correspondência exata (peso 2)
            if (objetoNormalizado.includes(palavraNormalizada)) {
              palavrasEncontradas++
              pontuacaoCorrespondencia += 2
              continue
            }
            
            // Correspondência parcial (peso 1)
            if (palavrasObjeto.some(po => correspondeParcial(palavraNormalizada, po))) {
              palavrasEncontradas++
              pontuacaoCorrespondencia += 1
              continue
            }
            
            // Verificar por raiz (peso 1)
            const raizSubsetor = extrairRaizPalavra(palavraNormalizada)
            if (raizSubsetor.length >= 4) {
              if (palavrasObjeto.some(po => {
                const raizObjeto = extrairRaizPalavra(po)
                return raizSubsetor === raizObjeto
              })) {
                palavrasEncontradas++
                pontuacaoCorrespondencia += 1
              }
            }
          }
          
          // Se encontrou múltiplas palavras do subsetor, aumenta a confiança
          if (palavrasEncontradas >= 2) {
            pontuacaoCorrespondencia += 2 // Bônus por múltiplas correspondências
          }
        }
      }
    }
    
    // PRECISÃO: Exigir pontuação mínima MAIOR para aceitar (evita falsos positivos)
    // Pontuação >= 5: Aceita apenas correspondências mais específicas
    // Isso garante que apenas licitações realmente relacionadas aos subsetores sejam aceitas
    // Exemplo: precisa encontrar pelo menos 1 subsetor completo (5 pontos) OU múltiplas correspondências específicas
    if (pontuacaoCorrespondencia >= 5) {
      return true
    }
  }
  
  // FALLBACK: Se não encontrou correspondência específica (pontuação < 5), usar lógica mais restritiva
  // IMPORTANTE: Exigir correspondência com vocabulário do setor OU múltiplas palavras-chave principais
  let temCorrespondenciaPrincipal = false
  if (palavrasPrincipais.length > 0) {
    
    const palavrasGenericas = ['servico', 'servicos', 'manutencao', 'manutenção', 'prestacao', 'prestação', 'fornecimento', 'fornecer']
    
    // PRIMEIRA VERIFICAÇÃO: Deve corresponder ao vocabulário do setor
    const correspondeVocabulario = correspondeVocabularioSetor(objetoNormalizado, vocabularioSetor)
    
    // Se não corresponde ao vocabulário E tem vocabulário definido, NÃO ACEITAR
    if (!correspondeVocabulario && vocabularioSetor.size > 0) {
      // Não corresponder ao vocabulário do setor é um sinal claro de que não é relevante
      return false
    }
    
    // SEGUNDA VERIFICAÇÃO: Verificar correspondência com palavras-chave principais
    // Exigir múltiplas correspondências para aumentar precisão
    let correspondenciasEncontradas = 0
    
    temCorrespondenciaPrincipal = palavrasPrincipais.some(palavra => {
      const palavraNormalizada = normalizarTexto(palavra)
      
      // Se é palavra genérica, SEMPRE exige contexto próximo
      if (palavrasGenericas.includes(palavraNormalizada)) {
        // Verificar se palavra genérica está no objeto (exata ou parcial)
        const temPalavra = objetoNormalizado.includes(palavraNormalizada) ||
                          palavrasObjeto.some(po => correspondeParcial(palavraNormalizada, po))
        
        if (!temPalavra) {
          return false
        }
        
        // Se está, DEVE ter contexto próximo (obrigatório) - distância reduzida para maior precisão
        const temContextoProximo = palavrasContexto.some(pc => {
          const pcNormalizado = normalizarTexto(pc)
          const indicePalavra = objetoNormalizado.indexOf(palavraNormalizada)
          const indiceContexto = objetoNormalizado.indexOf(pcNormalizado)
          
          if (indiceContexto === -1) return false
          
          // Contexto deve estar próximo (100 caracteres - mais restritivo)
          const distancia = Math.abs(indicePalavra - indiceContexto)
          return distancia <= 100
        })
        
        if (temContextoProximo) {
          correspondenciasEncontradas++
          return true
        }
        return false
      }
      
      // Para palavras específicas, verificar correspondência contextual (mais restritiva)
      if (correspondeContextual(objetoNormalizado, palavra, palavrasContexto)) {
        correspondenciasEncontradas++
        return true
      }
      
      // Verificar correspondência exata (mais precisa)
      if (objetoNormalizado.includes(palavraNormalizada)) {
        correspondenciasEncontradas++
        return true
      }
      
      // Correspondência parcial apenas se palavra é longa o suficiente (mais específica)
      if (palavraNormalizada.length >= 6) {
        const temCorrespondenciaParcial = palavrasObjeto.some(po => {
          return correspondeParcial(palavraNormalizada, po)
        })
        
        if (temCorrespondenciaParcial) {
          correspondenciasEncontradas++
          return true
        }
      }
      
      return false
    })
    
    // Exigir pelo menos 1 correspondência clara OU correspondência com vocabulário do setor
    if (!temCorrespondenciaPrincipal && !correspondeVocabulario) {
      return false
    }
  }
  
  // REGRA FINAL: Se tem palavras principais, deve ter correspondência principal E vocabulário
  if (palavrasPrincipais.length > 0) {
    // Se tem correspondência principal E corresponde ao vocabulário do setor, aceitar
    if (temCorrespondenciaPrincipal) {
      // Verificar também se corresponde ao vocabulário do setor (dupla validação)
      const correspondeVocabulario = correspondeVocabularioSetor(objetoNormalizado, vocabularioSetor)
      if (correspondeVocabulario || vocabularioSetor.size === 0) {
        return true
      }
      // Se não corresponde ao vocabulário, não aceitar mesmo tendo palavra principal
      return false
    }
    
    // Se não tem correspondência principal, não aceitar
    return false
  }
  
  // Se só tem palavras secundárias (caso raro, mas possível)
  // REGRA RESTRITIVA: Exigir correspondência com vocabulário do setor OU contexto
  if (palavrasSecundarias.length > 0) {
    // Primeiro verificar se corresponde ao vocabulário do setor
    const correspondeVocabulario = correspondeVocabularioSetor(objetoNormalizado, vocabularioSetor)
    
    if (correspondeVocabulario) {
      return true
    }
    
    // Se não corresponde ao vocabulário, exigir correspondência contextual
    // MELHORADO: Usa correspondência parcial para melhor abrangência
    const temCorrespondenciaSecundaria = palavrasSecundarias.some(palavra => {
      const palavraNormalizada = normalizarTexto(palavra)
      
      // Exigir correspondência contextual (mais restritivo)
      if (palavrasContexto.length > 0) {
        if (correspondeContextual(objetoNormalizado, palavra, palavrasContexto)) {
          return true
        }
      }
      
      // Verificar correspondência exata
      if (objetoNormalizado.includes(palavraNormalizada)) {
        return true
      }
      
      // Verificar correspondência parcial (mais abrangente)
      return palavrasObjeto.some(po => correspondeParcial(palavraNormalizada, po))
    })
    
    if (!temCorrespondenciaSecundaria) {
      console.log(`🚫 [Filtro] Licitação não corresponde às palavras secundárias:`, {
        palavrasSecundarias: palavrasSecundarias.slice(0, 5),
        objeto: objetoCompleto.substring(0, 150)
      })
      return false
    }
    
    return temCorrespondenciaSecundaria
  }
  
  // Verificar correspondência com sinônimos (banco + personalizados) apenas se não encontrou correspondência direta
  // MAS: Ainda exigir correspondência com vocabulário do setor OU contexto
  const palavrasExpandidas = expandirComSinonimos(palavrasChaveFormatadas, sinonimosPersonalizados, sinonimosBanco)
  
  // Primeiro verificar se corresponde ao vocabulário do setor
  const correspondeVocabulario = correspondeVocabularioSetor(objetoNormalizado, vocabularioSetor)
  
  if (correspondeVocabulario) {
    // Se corresponde ao vocabulário, verificar se tem sinônimo correspondente
    const temCorrespondenciaSinonimo = palavrasExpandidas.some(palavra => {
      return objetoNormalizado.includes(normalizarTexto(palavra))
    })
    return temCorrespondenciaSinonimo
  }
  
  // Se não corresponde ao vocabulário, exigir correspondência contextual para sinônimos
  const temCorrespondenciaSinonimo = palavrasExpandidas.some(palavra => {
    // Verificar correspondência contextual também para sinônimos
    if (palavrasContexto.length > 0) {
      return correspondeContextual(objetoNormalizado, palavra, palavrasContexto)
    }
    // Se não tem contexto, verificar se palavra está no objeto
    return objetoNormalizado.includes(normalizarTexto(palavra))
  })
  
  return temCorrespondenciaSinonimo
}

/**
 * Gera hash para cache baseado no objeto e atividades
 */
function gerarHashCache(objetoLicitacao, atividadesEmpresa) {
  const texto = `${objetoLicitacao}|${JSON.stringify(atividadesEmpresa)}`
  // Hash simples usando algoritmo nativo do browser
  let hash = 0
  for (let i = 0; i < texto.length; i++) {
    const char = texto.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return `ia_cache_${Math.abs(hash)}`
}

/**
 * Cache de validações por IA (localStorage)
 */
const CACHE_IA_KEY = 'filtro_semantico_ia_cache'
const CACHE_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 dias

function obterCacheIA() {
  try {
    const cacheStr = localStorage.getItem(CACHE_IA_KEY)
    if (!cacheStr) return {}
    const cache = JSON.parse(cacheStr)
    
    // Limpar entradas expiradas
    const agora = Date.now()
    const cacheLimpo = {}
    Object.entries(cache).forEach(([key, value]) => {
      if (value.expiraEm > agora) {
        cacheLimpo[key] = value
      }
    })
    
    // Salvar cache limpo
    if (Object.keys(cacheLimpo).length !== Object.keys(cache).length) {
      localStorage.setItem(CACHE_IA_KEY, JSON.stringify(cacheLimpo))
    }
    
    return cacheLimpo
  } catch (error) {
    console.warn('⚠️ Erro ao ler cache de IA:', error)
    return {}
  }
}

function salvarCacheIA(hash, resultado) {
  try {
    const cache = obterCacheIA()
    cache[hash] = {
      resultado,
      timestamp: Date.now(),
      expiraEm: Date.now() + CACHE_EXPIRATION_MS
    }
    localStorage.setItem(CACHE_IA_KEY, JSON.stringify(cache))
  } catch (error) {
    console.warn('⚠️ Erro ao salvar cache de IA:', error)
  }
}

function obterDoCacheIA(hash) {
  const cache = obterCacheIA()
  const entrada = cache[hash]
  if (entrada && entrada.expiraEm > Date.now()) {
    return entrada.resultado
  }
  return null
}

// Rate limiting para API Mistral
let ultimaChamadaIA = 0
let filaChamadasIA = []
const DELAY_ENTRE_CHAMADAS = 100 // 100ms entre chamadas (máximo 10 por segundo)
const MAX_TENTATIVAS = 3
const DELAY_INICIAL_RETRY = 1000 // 1 segundo

/**
 * Aguarda antes de fazer próxima chamada (rate limiting)
 */
async function aguardarRateLimit() {
  const agora = Date.now()
  const tempoDesdeUltimaChamada = agora - ultimaChamadaIA
  
  if (tempoDesdeUltimaChamada < DELAY_ENTRE_CHAMADAS) {
    await new Promise(resolve => setTimeout(resolve, DELAY_ENTRE_CHAMADAS - tempoDesdeUltimaChamada))
  }
  
  ultimaChamadaIA = Date.now()
}

/**
 * Validação por IA usando Mistral (opcional)
 * Retorna uma Promise que resolve com true/false
 * Usa cache para evitar chamadas repetidas
 * Implementa rate limiting e retry com backoff exponencial
 */
export async function validarCorrespondenciaIA(objetoLicitacao, atividadesEmpresa, apiKey) {
  if (!apiKey) {
    return null // Retorna null para indicar que não foi validado
  }
  
  // Verificar cache primeiro
  const hash = gerarHashCache(objetoLicitacao, atividadesEmpresa)
  const cacheResult = obterDoCacheIA(hash)
  if (cacheResult !== null) {
    return cacheResult
  }
  
  // Rate limiting: aguardar antes de fazer chamada
  await aguardarRateLimit()
  
  // Preparar contexto das atividades do profile
  let atividadesTexto = ''
  if (Array.isArray(atividadesEmpresa) && atividadesEmpresa.length > 0) {
    atividadesTexto = atividadesEmpresa
      .map(a => {
        const subsetores = a.subsetores && Array.isArray(a.subsetores) 
          ? a.subsetores.join(', ') 
          : ''
        return `${a.setor || 'Setor'}: ${subsetores || 'Sem subsetores específicos'}`
      })
      .join('\n')
  } else {
    atividadesTexto = 'Nenhuma atividade cadastrada'
  }
  
  const prompt = `Você é um assistente especializado em análise de licitações públicas no Brasil.

Analise se o objeto da licitação abaixo está relacionado às atividades da empresa listadas.

OBJETO DA LICITAÇÃO:
${objetoLicitacao}

ATIVIDADES DA EMPRESA (do cadastro):
${atividadesTexto}

IMPORTANTE:
- Responda "SIM" APENAS se o objeto da licitação está diretamente relacionado às atividades cadastradas
- Responda "NÃO" se o objeto não tem relação clara com as atividades
- Seja rigoroso: evite falsos positivos

Responda APENAS com "SIM" ou "NÃO", sem explicações.`

  // Retry com backoff exponencial
  let tentativa = 0
  let delayRetry = DELAY_INICIAL_RETRY
  
  while (tentativa < MAX_TENTATIVAS) {
    try {
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'mistral-small',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.1,
          max_tokens: 10
        })
      })
      
      // Se for 429 (rate limit), fazer retry com backoff
      if (response.status === 429) {
        tentativa++
        if (tentativa < MAX_TENTATIVAS) {
          console.warn(`⏸️ [IA] Rate limit atingido. Aguardando ${delayRetry}ms antes de tentar novamente... (tentativa ${tentativa}/${MAX_TENTATIVAS})`)
          await new Promise(resolve => setTimeout(resolve, delayRetry))
          delayRetry *= 2 // Backoff exponencial
          continue
        } else {
          // Se esgotou tentativas, usar filtro semântico como fallback
          console.warn('⚠️ [IA] Rate limit persistente. Usando filtro semântico como fallback.')
          return null
        }
      }
      
      if (!response.ok) {
        throw new Error(`Erro na API Mistral: ${response.status}`)
      }
      
      const data = await response.json()
      const resposta = data.choices[0]?.message?.content?.trim().toUpperCase()
      const resultado = resposta === 'SIM'
      
      // Salvar no cache
      salvarCacheIA(hash, resultado)
      
      // Registrar métrica
      registrarMetricaIA('validacao_ia', {
        sucesso: true,
        resultado,
        usadoCache: false
      })
      
      return resultado
    } catch (error) {
      tentativa++
      
      // Se for erro de rede ou timeout, tentar novamente
      if (tentativa < MAX_TENTATIVAS && (error.message.includes('fetch') || error.message.includes('network'))) {
        console.warn(`⚠️ [IA] Erro de rede. Tentando novamente em ${delayRetry}ms... (tentativa ${tentativa}/${MAX_TENTATIVAS})`)
        await new Promise(resolve => setTimeout(resolve, delayRetry))
        delayRetry *= 2
        continue
      }
      
      // Se esgotou tentativas ou erro definitivo, retornar null (usa filtro semântico)
      console.warn('⚠️ [IA] Erro na validação. Usando filtro semântico como fallback:', error.message)
      return null
    }
  }
  
  // Se chegou aqui, esgotou todas as tentativas
  return null
}

/**
 * Filtro híbrido: combina filtro semântico + IA para máxima precisão
 * 
 * Estratégia:
 * 1. Filtro semântico rápido para casos claros
 * 2. IA apenas para casos duvidosos ou quando precisão é crítica
 * 
 * @param {Object} licitacao - Objeto da licitação
 * @param {Array} palavrasChave - Palavras-chave extraídas dos setores
 * @param {Array} atividadesEmpresa - Atividades completas da empresa (para IA)
 * @param {string} apiKey - API key do Mistral (opcional)
 * @param {Object} options - Opções de configuração
 * @param {boolean} options.usarIAParaTodas - Se true, valida todas com IA (mais lento, mais preciso)
 * @param {boolean} options.usarIAParaDuvidosos - Se true, valida apenas casos duvidosos (recomendado)
 * @returns {Promise<boolean>} - true se deve mostrar, false se não deve
 */
export async function correspondeAtividadesHibrido(
  licitacao, 
  palavrasChave, 
  atividadesEmpresa = [],
  apiKey = null,
  options = {}
) {
  const { 
    usarIAParaTodas = false, 
    usarIAParaDuvidosos = true 
  } = options

  // Se não tem palavras-chave, mostrar tudo
  if (!palavrasChave || palavrasChave.length === 0) {
    return true
  }

  const objetoCompleto = obterObjetoCompleto(licitacao)
  if (!objetoCompleto) {
    return false // Sem objeto, não mostrar
  }

  // OPÇÃO 1: Validar TODAS as licitações com IA (mais preciso, mais lento)
  if (usarIAParaTodas && apiKey && atividadesEmpresa.length > 0) {
    const validacaoIA = await validarCorrespondenciaIA(
      objetoCompleto,
      atividadesEmpresa,
      apiKey
    )
    
    // Se IA retornou resultado, usar ele
    if (validacaoIA !== null) {
      return validacaoIA
    }
    
    // Se IA falhou, continuar com filtro semântico
  }

  // OPÇÃO 2: Filtro semântico primeiro, IA apenas para duvidosos (recomendado)
  // Passar setores completos para contexto (sem sinônimos do banco)
  const resultadoSemantico = correspondeAtividades(
    licitacao, 
    palavrasChave, 
    {}, // Sinônimos personalizados (vazio, já foi usado na extração)
    {}, // Sinônimos do banco (não usar mais)
    atividadesEmpresa // Setores para contexto
  )
  
  // Se resultado é claro (true ou false), usar ele
  if (!usarIAParaDuvidosos || resultadoSemantico === true || resultadoSemantico === false) {
    return resultadoSemantico
  }

  // Caso duvidoso: usar IA para validar
  if (apiKey && atividadesEmpresa.length > 0) {
    const validacaoIA = await validarCorrespondenciaIA(
      objetoCompleto,
      atividadesEmpresa,
      apiKey
    )
    
    // Se IA retornou resultado, usar ele
    if (validacaoIA !== null) {
      return validacaoIA
    }
  }

  // Se IA não está disponível ou falhou, usar resultado do filtro semântico
  return resultadoSemantico
}

/**
 * Detecta se uma licitação é "duvidosa" (pode precisar de validação por IA)
 * 
 * Uma licitação é duvidosa quando:
 * - Contém palavras muito genéricas (ex: "serviços", "manutenção")
 * - Correspondência semântica é fraca (poucas palavras-chave encontradas)
 * - Objeto é muito curto ou muito longo
 */
export function isLicitacaoDuvidosa(licitacao, palavrasChave) {
  const objetoCompleto = obterObjetoCompleto(licitacao)
  if (!objetoCompleto) return false

  const objetoNormalizado = normalizarTexto(objetoCompleto)
  const palavrasObjeto = objetoNormalizado.split(/\s+/).filter(p => p.length > 3)

  // Palavras muito genéricas que podem gerar falsos positivos
  const palavrasGenericas = ['servico', 'servicos', 'manutencao', 'manutenção', 'prestacao', 'prestação']
  
  // Verificar se objeto contém muitas palavras genéricas
  const temMuitasGenericas = palavrasGenericas.some(p => objetoNormalizado.includes(p))
  
  // Verificar quantas palavras-chave foram encontradas
  const palavrasEncontradas = palavrasChave.filter(p => {
    const palavraNormalizada = normalizarTexto(p)
    return objetoNormalizado.includes(palavraNormalizada)
  }).length

  // É duvidosa se:
  // 1. Tem muitas palavras genéricas E poucas palavras-chave específicas encontradas
  // 2. Objeto é muito curto (< 50 caracteres) ou muito longo (> 1000 caracteres)
  const objetoCurtoOuLongo = objetoCompleto.length < 50 || objetoCompleto.length > 1000
  const poucasPalavrasChave = palavrasEncontradas < palavrasChave.length * 0.3 // Menos de 30% das palavras-chave

  return (temMuitasGenericas && poucasPalavrasChave) || objetoCurtoOuLongo
}

/**
 * Sistema de métricas de precisão do filtro
 */
const METRICAS_KEY = 'filtro_semantico_metricas'

function obterMetricas() {
  try {
    const metricasStr = localStorage.getItem(METRICAS_KEY)
    return metricasStr ? JSON.parse(metricasStr) : {
      totalLicitacoesFiltradas: 0,
      totalLicitacoesMostradas: 0,
      totalValidacoesIA: 0,
      totalCacheHits: 0,
      totalErrosIA: 0,
      precisaoEstimada: null,
      ultimaAtualizacao: null
    }
  } catch (error) {
    console.warn('⚠️ Erro ao ler métricas:', error)
    return {
      totalLicitacoesFiltradas: 0,
      totalLicitacoesMostradas: 0,
      totalValidacoesIA: 0,
      totalCacheHits: 0,
      totalErrosIA: 0,
      precisaoEstimada: null,
      ultimaAtualizacao: null
    }
  }
}

function salvarMetricas(metricas) {
  try {
    metricas.ultimaAtualizacao = new Date().toISOString()
    localStorage.setItem(METRICAS_KEY, JSON.stringify(metricas))
  } catch (error) {
    console.warn('⚠️ Erro ao salvar métricas:', error)
  }
}

/**
 * Registra uma métrica do filtro
 * @param {string} tipo - Tipo da métrica ('filtro_semantico', 'validacao_ia', etc)
 * @param {Object} dados - Dados adicionais da métrica
 */
export function registrarMetricaIA(tipo, dados = {}) {
  const metricas = obterMetricas()
  
  switch (tipo) {
    case 'filtro_semantico':
      metricas.totalLicitacoesFiltradas = (metricas.totalLicitacoesFiltradas || 0) + 1
      if (dados.mostrou) {
        metricas.totalLicitacoesMostradas = (metricas.totalLicitacoesMostradas || 0) + 1
      }
      break
    case 'validacao_ia':
      metricas.totalValidacoesIA = (metricas.totalValidacoesIA || 0) + 1
      if (dados.usadoCache) {
        metricas.totalCacheHits = (metricas.totalCacheHits || 0) + 1
      }
      break
    case 'validacao_ia_erro':
      metricas.totalErrosIA = (metricas.totalErrosIA || 0) + 1
      break
  }
  
  // Calcular precisão estimada (taxa de cache hits)
  if (metricas.totalValidacoesIA > 0) {
    metricas.precisaoEstimada = ((metricas.totalCacheHits || 0) / metricas.totalValidacoesIA) * 100
  }
  
  salvarMetricas(metricas)
}

/**
 * Obtém métricas do filtro
 * @returns {Object} - Métricas atuais
 */
export function obterMetricasFiltro() {
  return obterMetricas()
}

/**
 * Limpa métricas do filtro
 */
export function limparMetricasFiltro() {
  try {
    localStorage.removeItem(METRICAS_KEY)
  } catch (error) {
    console.warn('⚠️ Erro ao limpar métricas:', error)
  }
}

/**
 * Limpa cache de validações por IA
 */
export function limparCacheIA() {
  try {
    localStorage.removeItem(CACHE_IA_KEY)
  } catch (error) {
    console.warn('⚠️ Erro ao limpar cache de IA:', error)
  }
}


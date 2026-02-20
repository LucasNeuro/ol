/**
 * Utilitários para filtragem semântica de licitações
 * Compara o objeto da licitação com as atividades cadastradas pela empresa
 */

/**
 * Remove acentos e normaliza texto para comparação
 */
export function normalizarTexto(texto) {
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
 * Sinônimos por setor/área (fallback + banco).
 * Usado para expandir vocabulário e correspondência (menos rígido).
 * O banco (tabela sinonimos) complementa e sobrescreve quando disponível.
 */
const SINONIMOS_BASE_MINIMO = {
  // Construção e obras
  'construção': ['construcao', 'obra', 'obras', 'edificação', 'edificacao', 'pavimentação', 'pavimentacao', 'demolição', 'demolicao'],
  'engenharia': ['engenheiro', 'projeto', 'projetos', 'fiscalização', 'fiscalizacao', 'topografia', 'geotecnia'],
  'material': ['materiais', 'equipamento', 'equipamentos', 'insumos'],
  'saneamento': ['esgoto', 'drenagem', 'água', 'agua'],
  'pavimentação': ['pavimentacao', 'asfalto', 'calçamento', 'calçamento'],
  // Serviços
  'serviço': ['servico', 'servicos', 'prestação', 'prestacao', 'execução', 'execucao'],
  'manutenção': ['manutencao', 'reparo', 'reparos', 'conservação', 'conservacao'],
  // Saúde
  'saúde': ['saude', 'hospitalar', 'hospital', 'médico', 'medico', 'clínica', 'clinica'],
  'medicamento': ['medicamentos', 'remédio', 'remedios', 'fármaco', 'farmaco'],
  'hospitalar': ['hospital', 'clínica', 'clinica', 'ambulatório', 'ambulatorio', 'pronto socorro'],
  'laboratorial': ['laboratório', 'laboratorio', 'exame', 'análise', 'analise', 'diagnóstico', 'diagnostico'],
  'vacina': ['vacinas', 'imunização', 'imunizacao'],
  'dieta': ['dietas', 'nutrição', 'nutricao', 'enteral', 'parenteral'],
  'oxigênio': ['oxigenio', 'oxigênio medicinal', 'oxigenio medicinal', 'medicinal'],
  // Alimentação
  'alimentação': ['alimentacao', 'comida', 'alimento', 'alimentos', 'nutrição', 'nutricao', 'refeição', 'refeicao', 'merenda'],
  'cesta': ['cestas', 'cesta básica', 'cesta basica', 'cestas básicas', 'cestas basicas', 'kit alimentar', 'doação', 'doacao'],
  'refeição': ['refeicao', 'refeições', 'refeicoes', 'merenda', 'almoço', 'almoco', 'jantar'],
  'gêneros': ['generos', 'gêneros alimentícios', 'generos alimenticios', 'hortifruti', 'hortifrutigranjeiros'],
  'bebida': ['bebidas', 'laticínios', 'laticinios'],
  'buffet': ['buffets', 'catering', 'refeitório', 'refeitorio', 'copa'],
  // Informática
  'informática': ['informatica', 'ti', 'tecnologia', 'tecnologia da informação', 'tecnologia da informacao'],
  'computador': ['computadores', 'notebook', 'desktop', 'microcomputador'],
  'software': ['softwares', 'sistema', 'aplicativo', 'aplicação', 'aplicacao', 'licença', 'licenca'],
  'hardware': ['equipamentos informática', 'servidor', 'rede'],
  // Transporte
  'transporte': ['fretamento', 'frota', 'veículo', 'veiculo', 'locação veículos', 'locacao veiculos'],
  'veículo': ['veiculo', 'veículos', 'veiculos', 'automóvel', 'automovel', 'ônibus', 'onibus', 'caminhão', 'caminhao'],
  'passagem': ['passagens', 'bilhete', 'bilhetes'],
  // Educação
  'educação': ['educacao', 'escolar', 'pedagógico', 'pedagogico', 'capacitação', 'capacitacao', 'treinamento', 'curso', 'cursos'],
  // Financeiro
  'seguro': ['seguros', 'apólice', 'apolice', 'cobertura'],
  'contabilidade': ['contábil', 'contabil', 'auditoria', 'consultoria contábil'],
  // Eventos
  'evento': ['eventos', 'cerimonial', 'organização eventos', 'organizacao eventos', 'shows', 'palestras'],
  // Outros
  'limpeza': ['higienização', 'higienizacao', 'conservação', 'conservacao', 'asepsia'],
  'segurança': ['seguranca', 'vigilância', 'vigilancia', 'proteção', 'protecao', 'portaria'],
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
 * Expandido com sinônimos para correspondência menos rígida (mais licitações compatíveis)
 * @param {Array} setoresAtividades - Setores e subsetores da empresa
 * @param {Object} sinonimosPersonalizados - Sinônimos personalizados (opcional)
 * @param {Object} sinonimosBanco - Sinônimos do banco (opcional)
 * @returns {Set} - Vocabulário completo do setor (palavras + sinônimos)
 */
function construirVocabularioSetor(setoresAtividades, sinonimosPersonalizados = {}, sinonimosBanco = {}) {
  if (!setoresAtividades || !Array.isArray(setoresAtividades)) {
    return new Set()
  }
  
  const termosColetados = []
  
  setoresAtividades.forEach(setor => {
    // Nome do setor completo
    if (setor.setor) {
      termosColetados.push(normalizarTexto(setor.setor))
      const palavrasSetor = extrairPalavrasChave(setor.setor)
      palavrasSetor.forEach(p => termosColetados.push(normalizarTexto(p)))
    }
    // Subsetores completos e suas palavras
    if (setor.subsetores && Array.isArray(setor.subsetores)) {
      setor.subsetores.forEach(subsetor => {
        if (subsetor) {
          termosColetados.push(normalizarTexto(subsetor))
          const palavras = extrairPalavrasChave(subsetor)
          palavras.forEach(p => termosColetados.push(normalizarTexto(p)))
        }
      })
    }
  })
  
  // Expandir cada termo com sinônimos (fallback + banco + personalizados)
  const vocabulario = new Set()
  const termosUnicos = [...new Set(termosColetados)]
  termosUnicos.forEach(termo => {
    vocabulario.add(termo)
    const expandidos = expandirComSinonimos([termo], sinonimosPersonalizados, sinonimosBanco)
    expandidos.forEach(e => vocabulario.add(e))
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
 * @param {Object} [palavrasFortesPorSetor] - Palavras fortes por setor do banco (dinâmico). Formato: { setor_nome: [palavra1, ...] }
 * @param {Object} [palavrasIncompatibilidadePorSetor] - Palavras incompatíveis por setor do banco. Formato: { setor_nome: [palavra1, ...] }. Se o objeto contiver uma delas, rejeita para esse setor.
 */
export function correspondeAtividades(
  licitacao, 
  palavrasChave, 
  sinonimosPersonalizados = {},
  sinonimosBanco = {},
  setoresAtividades = [],
  palavrasFortesPorSetor = {},
  palavrasIncompatibilidadePorSetor = {}
) {
 
  const palavrasChaveFormatadas = palavrasChave.todas || palavrasChave.principais || (Array.isArray(palavrasChave) ? palavrasChave : [])
  const palavrasPrincipais = palavrasChave.principais || []
  const palavrasSecundarias = palavrasChave.secundarias || []
  
  // Sem palavras-chave: se a empresa tem setores cadastrados, não mostrar (evitar mostrar editais de outras áreas)
  if (!palavrasChaveFormatadas || palavrasChaveFormatadas.length === 0) {
    if (setoresAtividades?.length > 0) return false
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
  const vocabularioSetor = construirVocabularioSetor(setoresAtividades, sinonimosPersonalizados, sinonimosBanco)
  
 
  const listSaude = [
    'publicidade', 'diario oficial', 'publicacao de atos', 'servicos de publicidade', 'revisao de veiculo', 'manutencao de veiculo',
    'veiculo', 'automovel', 'construcao', 'obra', 'concreto', 'saneamento', 'esgoto', 'pavimentacao', 'terraplanagem', 'demolicao', 'drenagem', 'viaduto', 'tunel',
    'diesel', 'oleo diesel', 'arla', 'frota municipal', 'abastecimento da frota', 'combustivel', 'combustiveis',
    'eventos', 'shows', 'sonorizacao', 'iluminacao', 'promocao de eventos', 'organizacao de shows', 'equipamentos de som',
    'fardamento escolar', 'fardamento', 'camiseta', 'camisetas', 'tenis de uso escolar', 'tenis escolar', 'uso escolar',
    'vestuario escolar', 'uniforme escolar', 'material escolar', 'kit escolar', 'padronizadas',
    'passagem aerea', 'passagens aereas', 'bilhete aereo', 'seguro', 'seguros', 'apolice', 'cartao corporativo', 'cartao de pagamento',
    'locacao de imovel', 'aluguel de imovel', 'imovel publico', 'pedagio', 'concessionaria de pedagio', 'leilao', 'leilao de veiculos',
    'ar condicionado', 'manutencao de ar condicionado', 'climatizacao', 'condicionamento de ar', 'hvac',
    'limpeza predial', 'conservacao predial', 'vigilancia patrimonial', 'seguranca patrimonial', 'portaria',
    'jardinagem', 'servicos de jardinagem', 'podas', 'servicos de podas', 'impressao', 'servicos de impressao', 'marketing', 'servicos de marketing',
    'carga e descarga', 'armazenagem', 'lavanderia', 'dedetizacao', 'desinfecao', 'arquitetura', 'ferramentas', 'petrobras', 'solda', 'servicos de solda',
    'transporte aereo', 'transporte rodoviario', 'transporte nautico', 'ferroviarios', 'calibracao', 'varricao', 'serralheria', 'pintura predial',
    'servicos de rh', 'contabilidade', 'servicos de contabilidade', 'eletrica predial', 'hidraulica predial', 'revisao preventiva',
    'transcricao', 'digitalizacao', 'digitacao', 'sistema de vales', 'coleta de lixo', 'assessorias', 'inspecao', 'certificacao',
    'concessoes', 'exploracao', 'advocacia', 'servicos de advocacia', 'call center', 'telemarketing', 'design grafico',
    'agropecuaria', 'fotografia', 'funeraria', 'embalagens', 'faturamento', 'cobranca', 'traducao', 'montagem de moveis',
    'carpintaria', 'mobiliarios', 'desentupimento', 'telefonia', 'locacao de equipamentos', 'alvenaria', 'mineracao', 'pesca', 'textil',
    'infancia', 'playground', 'fornecimento de energia', 'esportivos', 'musica', 'hospedagem', 'grafica', 'escritorio',
    'porta de vidro', 'vidro temperado', 'esquadria', 'janela de vidro', 'instalacao de porta', 'instalacao de janela',
    'porta', 'vidro', 'temperado', 'janela', 'puxador', 'abrir e fechar',
  ]
  const listAlimentacao = [
    'diesel', 'oleo diesel', 'arla', 'frota municipal', 'abastecimento da frota', 'combustivel', 'combustiveis',
    'veiculo', 'automovel', 'frota', 'construcao', 'obra', 'concreto', 'saneamento', 'pavimentacao', 'demolicao',
    'medicamento', 'medicamentos', 'hospitalar', 'laboratorial', 'raio-x', 'dieta enteral', 'parenteral', 'proteses', 'orteses',
    'eventos', 'shows', 'sonorizacao', 'iluminacao', 'promocao de eventos', 'organizacao de shows', 'software', 'hardware', 'informatica', 'ti',
    'fardamento escolar', 'fardamento', 'camiseta', 'camisetas', 'tenis de uso escolar', 'tenis escolar', 'uso escolar',
    'vestuario escolar', 'uniforme escolar', 'material escolar', 'kit escolar', 'padronizadas',
    'passagem aerea', 'passagens aereas', 'bilhete aereo', 'seguro', 'seguros', 'apolice', 'cartao corporativo', 'cartao de pagamento',
    'locacao de imovel', 'aluguel de imovel', 'imovel publico', 'pedagio', 'concessionaria de pedagio', 'leilao', 'leilao de veiculos',
    'ar condicionado', 'manutencao de ar condicionado', 'climatizacao', 'condicionamento de ar', 'hvac',
    'limpeza predial', 'conservacao predial', 'vigilancia patrimonial', 'seguranca patrimonial', 'portaria',
    'jardinagem', 'podas', 'impressao', 'marketing', 'carga e descarga', 'armazenagem', 'lavanderia', 'dedetizacao', 'arquitetura', 'ferramentas', 'petrobras', 'solda',
    'transporte aereo', 'transporte rodoviario', 'transporte nautico', 'ferroviarios', 'calibracao', 'varricao', 'serralheria', 'pintura predial',
    'servicos de rh', 'contabilidade', 'eletrica predial', 'hidraulica predial', 'revisao de veiculo', 'transcricao', 'digitalizacao', 'digitacao',
    'sistema de vales', 'coleta de lixo', 'assessorias', 'inspecao', 'certificacao', 'concessoes', 'advocacia', 'call center', 'telemarketing', 'design grafico',
    'fotografia', 'funeraria', 'faturamento', 'cobranca', 'traducao', 'montagem de moveis', 'carpintaria', 'mobiliarios', 'desentupimento', 'telefonia',
    'alvenaria', 'mineracao', 'pesca', 'textil', 'fornecimento de energia', 'esportivos', 'musica', 'hospedagem', 'grafica', 'publicidade',
    'porta de vidro', 'vidro temperado', 'esquadria', 'janela de vidro', 'instalacao de porta', 'instalacao de janela',
    'porta', 'vidro', 'temperado', 'janela', 'puxador', 'abrir e fechar',
  ]
  const listInformatica = [
    'escolar', 'escolares', 'material escolar', 'kit escolar', 'alimento', 'comida', 'vestuario', 'roupa', 'uniforme', 'fardamento',
    'medicamento', 'medicamentos', 'hospitalar', 'laboratorial', 'construcao', 'obra', 'concreto', 'pavimentacao', 'saneamento',
    'diesel', 'combustivel', 'frota', 'veiculo', 'eventos', 'shows', 'publicidade', 'ar condicionado', 'climatizacao',
    'jardinagem', 'podas', 'solda', 'serralheria', 'pintura predial', 'alvenaria', 'hidraulica predial', 'eletrica predial',
    'seguro', 'seguros', 'passagem aerea', 'leilao', 'pedagio', 'locacao de imovel', 'cartao corporativo', 'advocacia', 'contabilidade',
    'funeraria', 'fotografia', 'agropecuaria', 'pesca', 'textil', 'mineracao',
  ]
  const listServicos = [
    'medicamento', 'medicamentos', 'hospitalar', 'laboratorial', 'raio-x', 'dieta enteral', 'parenteral', 'vacina', 'hemodialise',
    'generos alimenticios', 'cesta basica', 'merenda escolar', 'refeicao escolar', 'fornecimento de alimentos',
    'construcao civil', 'pavimentacao', 'terraplanagem', 'demolicao', 'viaduto', 'tunel', 'drenagem', 'obra de arte',
    'software', 'hardware', 'sistema de informacao', 'desenvolvimento de software', 'licenca de software',
    'porta de vidro', 'vidro temperado', 'esquadria', 'porta', 'vidro', 'temperado', 'janela', 'diesel', 'frota', 'combustivel', 'veiculo',
  ]
  const listEngenharia = [
    'medicamento', 'medicamentos', 'hospitalar', 'laboratorial', 'raio-x', 'dieta enteral', 'parenteral', 'vacina', 'exame medico',
    'generos alimenticios', 'cesta basica', 'refeicao', 'merenda', 'alimentacao escolar',
    'fardamento escolar', 'uniforme escolar', 'material escolar', 'vestuario', 'camiseta', 'tenis escolar',
    'eventos', 'shows', 'sonorizacao', 'iluminacao', 'publicidade', 'seguro', 'passagem aerea', 'cartao corporativo',
    'leilao de veiculos', 'pedagio', 'locacao de imovel', 'advocacia', 'contabilidade', 'call center', 'telemarketing',
  ]
  const listConstrucao = [
    'medicamento', 'medicamentos', 'hospitalar', 'laboratorial', 'raio-x', 'dieta enteral', 'parenteral',
    'generos alimenticios', 'cesta basica', 'refeicao', 'merenda', 'fardamento escolar', 'uniforme escolar', 'material escolar',
    'eventos', 'shows', 'publicidade', 'seguro', 'passagem aerea', 'leilao de veiculos', 'pedagio', 'locacao de imovel',
    'advocacia', 'contabilidade', 'call center', 'telemarketing', 'funeraria', 'fotografia',
  ]
  const listTransporte = [
    'medicamento', 'medicamentos', 'hospitalar', 'laboratorial', 'dieta enteral', 'parenteral', 'raio-x',
    'material escolar', 'fardamento escolar', 'uniforme escolar', 'kit escolar', 'merenda escolar',
    'construcao civil', 'pavimentacao', 'obra', 'concreto', 'saneamento', 'demolicao', 'pedagio', 'concessionaria de pedagio',
  ]
  const listFinanceiro = [
    'construcao civil', 'obra', 'pavimentacao', 'demolicao', 'saneamento', 'medicamento', 'medicamentos', 'hospitalar',
    'fardamento escolar', 'material escolar', 'uniforme escolar', 'ar condicionado', 'climatizacao', 'jardinagem', 'solda',
    'serralheria', 'pintura predial', 'alvenaria', 'hidraulica', 'eletrica predial', 'transporte aereo', 'transporte rodoviario',
    'leilao de veiculos', 'pedagio', 'advocacia', 'funeraria', 'fotografia', 'agropecuaria',
    'porta de vidro', 'vidro temperado', 'porta', 'vidro', 'temperado', 'diesel', 'frota', 'veiculo',
  ]
  const listEventos = [
    'medicamento', 'medicamentos', 'hospitalar', 'laboratorial', 'diesel', 'frota municipal', 'combustivel',
    'construcao civil', 'pavimentacao', 'obra', 'saneamento', 'material escolar', 'fardamento escolar', 'uniforme escolar',
    'seguro', 'apolice', 'passagem aerea', 'leilao de veiculos', 'pedagio', 'locacao de imovel', 'cartao corporativo',
  ]
  const listEducacao = [
    'diesel', 'oleo diesel', 'arla', 'frota municipal', 'combustivel', 'abastecimento da frota',
    'construcao civil', 'pavimentacao', 'terraplanagem', 'demolicao', 'viaduto', 'saneamento', 'obra de arte',
    'medicamento hospitalar', 'dieta enteral', 'parenteral', 'seguro', 'seguros', 'apolice', 'passagem aerea',
    'leilao', 'leilao de veiculos', 'pedagio', 'locacao de imovel', 'cartao corporativo', 'advocacia', 'contabilidade',
  ]

  // Não usar chave "servicos" sozinha: todos os setores têm "Serviços" no nome e rejeitariam editais corretos.
  const FALLBACK_INCOMPATIBILIDADE = {
    saude: listSaude,
    alimentacao: listAlimentacao,
    informatica: listInformatica,
    engenharia: listEngenharia,
    construcao: listConstrucao,
    transporte: listTransporte,
    financeiro: listFinanceiro,
    eventos: listEventos,
    educacao: listEducacao,
    // Chaves que batem com os nomes dos setores da tabela setores (cadastro)
    contabeis: listFinanceiro,
    fiscais: listFinanceiro,
    tributarios: listFinanceiro,
    alvenaria: listConstrucao,
    reformas: listConstrucao,
    laboratoriais: listSaude,
    arquitetura: listEngenharia,
    arquivamento: listServicos,
    documental: listServicos,
    buffet: listAlimentacao,
    catering: listAlimentacao,
    copa: listAlimentacao,
    cozinha: listAlimentacao,
    nutricao: listAlimentacao,
    calibracao: listServicos,
    metrologia: listServicos,
    'call center': listServicos,
    carga: listTransporte,
    descarga: listTransporte,
    movimentacao: listTransporte,
    carpintaria: listConstrucao,
    marcenaria: listConstrucao,
    certificacao: listFinanceiro,
    auditoria: listFinanceiro,
    cobranca: listFinanceiro,
    coleta: listServicos,
    residuos: listServicos,
    dedetizacao: listServicos,
    pragas: listServicos,
    desentupimento: listServicos,
    esgotos: listServicos,
    'design grafico': listServicos,
    desinfeccao: listServicos,
    sanitizacao: listServicos,
    digitacao: listServicos,
    digitalizacao: listServicos,
    'energia eletrica': listEngenharia,
    'energias renovaveis': listEngenharia,
    enfermagem: listSaude,
    faturamento: listFinanceiro,
    fisioterapia: listSaude,
    reabilitacao: listSaude,
    fotografia: listEventos,
    filmagem: listEventos,
    impressao: listServicos,
    grafica: listServicos,
    inspecao: listServicos,
    vistoria: listServicos,
    'instalacao de equipamentos': listServicos,
    internet: listInformatica,
    conectividade: listInformatica,
    jardinagem: listServicos,
    paisagismo: listServicos,
    lavanderia: listServicos,
    limpeza: listServicos,
    conservacao: listServicos,
    higienizacao: listServicos,
    locacao: listTransporte,
    veiculos: listTransporte,
    marketing: listServicos,
    comunicacao: listServicos,
    montagem: listServicos,
    desmontagem: listServicos,
    pintura: listConstrucao,
    revestimento: listConstrucao,
    acabamento: listConstrucao,
    poda: listServicos,
    arvores: listServicos,
    vegetacao: listServicos,
    portaria: listServicos,
    recepcao: listServicos,
    psicologia: listSaude,
    'recursos humanos': listServicos,
    'gestao de pessoas': listServicos,
    'revisao de textos': listServicos,
    saneamento: listEngenharia,
    'tratamento de agua': listEngenharia,
    seguranca: listServicos,
    vigilancia: listServicos,
    protecao: listServicos,
    serralheria: listServicos,
    metalurgia: listServicos,
    solda: listServicos,
    caldeiraria: listServicos,
    tecnologia: listInformatica,
    informacao: listInformatica,
    telefonia: listServicos,
    telecomunicacoes: listServicos,
    telemarketing: listServicos,
    traducao: listServicos,
    interpretacao: listServicos,
    transcricao: listServicos,
    logistica: listTransporte,
    treinamento: listServicos,
    capacitacao: listServicos,
    varricao: listServicos,
    eletricos: listEngenharia,
    hidraulicos: listEngenharia,
    encanamento: listEngenharia,
    juridicos: listServicos,
    advocacia: listServicos,
    medicos: listSaude,
    'bem-estar': listSaude,
  }
  const palavrasIncompatibilidade = {}
  for (const chave of [...new Set([...Object.keys(FALLBACK_INCOMPATIBILIDADE), ...Object.keys(palavrasIncompatibilidadePorSetor || {})])]) {
    const fallback = FALLBACK_INCOMPATIBILIDADE[chave] || []
    const doBanco = (palavrasIncompatibilidadePorSetor || {})[chave] || []
    palavrasIncompatibilidade[chave] = [...new Set([...fallback, ...doBanco])]
  }
  
  // Verificar incompatibilidades antes de processar
  if (setoresAtividades && setoresAtividades.length > 0) {
    for (const setor of setoresAtividades) {
      if (setor.setor) {
        const setorNormalizado = normalizarTexto(setor.setor)
        for (const [setorChave, palavrasIncompativeis] of Object.entries(palavrasIncompatibilidade)) {
          if (setorNormalizado.includes(setorChave)) {
            const temIncompativel = palavrasIncompativeis.some(palavra => 
              objetoNormalizado.includes(normalizarTexto(palavra))
            )
            if (temIncompativel) {
              const palavraEncontrada = palavrasIncompativeis.find(p => objetoNormalizado.includes(normalizarTexto(p)))
              // Log com valores serializáveis (string) para aparecer corretamente no console quando rodar no Worker
              console.log(`🚫 [Filtro] Licitação rejeitada por incompatibilidade: setor="${String(setor.setor)}" palavraIncompativel="${String(palavraEncontrada ?? '')}" objeto="${String(objetoCompleto).substring(0, 100)}"`)
              return false  // Rejeitar imediatamente
            }
          }
        }
        // Saúde: rejeitar "equipamento de áudio/som/informática" (não é equipamento médico/hospitalar)
        if (setorNormalizado.includes('saude')) {
          const temEquipamento = /\b(equipamento|equipamentos|peca|pecas)\b/.test(objetoNormalizado)
          const temNaoSaude = /\b(audio|som|informatica|informatico)\b/.test(objetoNormalizado)
          if (temEquipamento && temNaoSaude) {
            console.log(`🚫 [Filtro] Licitação rejeitada (equipamento não médico para Saúde): setor="${String(setor.setor)}" objeto="${String(objetoCompleto).substring(0, 100)}"`)
            return false
          }
          // Rejeitar manutenção/revisão de veículo (objeto é sobre veículo, não sobre produtos/serviços de saúde)
          const temaVeiculo = /\b(revisao|revisão|manutencao|manutenção)\s+(preventiva|de\s+veiculo|veicular|automotiva)\b/i.test(objetoCompleto) ||
            (/\b(veiculo|veículo|automovel|automóvel|frota|placa\s+[a-z]{3}\d{4})\b/i.test(objetoCompleto) && /\b(revisao|revisão|manutencao|manutenção|mecânica|mecanica)\b/i.test(objetoCompleto))
          if (temaVeiculo) {
            console.log(`🚫 [Filtro] Licitação rejeitada (manutenção/revisão de veículo para setor Saúde): setor="${String(setor.setor)}" objeto="${String(objetoCompleto).substring(0, 120)}"`)
            return false
          }
        }
      }
    }
  }

  /**
   * Palavras que sozinhas NÃO bastam para aceitar um edital (genéricas demais).
   * Se a licitação só bateu nisso, exige pelo menos uma "palavra forte" do setor cadastrado.
   */
  const PALAVRAS_GENERICAS_SOZINHAS = [
    'material', 'materiais', 'servico', 'servicos', 'equipamento', 'equipamentos',
    'fornecimento', 'fornecer', 'prestacao', 'prestação', 'produto', 'produtos',
    'aquisição', 'aquisicao', 'compra', 'adquirir', 'contratacao', 'contratação'
  ]

  /**
   * Por setor: palavras que provam que o edital é daquele setor (específicas).
   * Chaves batem com nome normalizado do setor (tabela setores). Banco (palavrasFortesPorSetor) estende quando disponível.
   */
  const palavrasFortesSaude = ['medicamento', 'medicamentos', 'hospitalar', 'laboratorial', 'medico', 'saude', 'hospital', 'laboratorio', 'radiologico', 'raio-x', 'dieta', 'enteral', 'parenteral', 'utensilio', 'vacina', 'vacinas', 'exame medico', 'analise laboratorial', 'oxigenio', 'oxigenio medicinal', 'medicinal', 'ambulatorio', 'pronto socorro', 'consulta medica', 'internacao', 'enfermagem', 'fisioterapia', 'psicologia', 'nutricao clinica', 'reabilitacao']
  const palavrasFortesAlimentacao = ['alimentacao', 'alimento', 'cesta basica', 'cestas basicas', 'refeicao', 'refeicoes', 'copa', 'buffet', 'bebida', 'bebidas', 'generos alimenticios', 'merenda', 'merenda escolar', 'doacao', 'nutricao', 'hortifruti', 'hortifrutigranjeiros', 'catering']
  const palavrasFortesInformatica = ['informatica', 'computador', 'software', 'hardware', 'sistema de informacao', 'ti', 'tecnologia', 'internet', 'conectividade', 'rede', 'licenca']
  const palavrasFortesEngenharia = ['construcao', 'obra', 'edificacao', 'pavimentacao', 'reforma', 'saneamento', 'drenagem', 'asfalto', 'concreto', 'terraplanagem', 'demolicao', 'viaduto', 'tunel', 'passarela', 'arquitetura', 'energia eletrica', 'hidraulica', 'eletrica']
  const palavrasFortesConstrucao = ['construcao', 'obra', 'edificacao', 'pavimentacao', 'reforma', 'saneamento', 'alvenaria', 'carpintaria', 'marcenaria', 'pintura', 'revestimento', 'acabamento', 'concreto', 'demolicao']
  const palavrasFortesTransporte = ['veiculo', 'transporte', 'frota', 'onibus', 'caminhao', 'ambulancia', 'motocicleta', 'locacao de veiculos', 'logistica', 'carga', 'descarga', 'movimentacao']
  const palavrasFortesFinanceiro = ['contabilidade', 'contabil', 'fiscal', 'tributario', 'tributo', 'nota fiscal', 'faturamento', 'cobranca', 'auditoria', 'certificacao', 'emissao de notas']
  const palavrasFortesServicos = ['limpeza', 'conservacao', 'higienizacao', 'jardinagem', 'paisagismo', 'lavanderia', 'dedetizacao', 'desentupimento', 'impressao', 'grafica', 'design grafico', 'digitacao', 'digitalizacao', 'inspecao', 'vistoria', 'seguranca', 'vigilancia', 'portaria', 'recepcao', 'serralheria', 'solda', 'montagem', 'desmontagem', 'treinamento', 'capacitacao', 'varricao', 'coleta de lixo', 'residuos', 'traducao', 'transcricao', 'advocacia', 'juridico', 'recursos humanos', 'revisao de textos', 'calibracao', 'metrologia', 'call center', 'telemarketing', 'marketing', 'comunicacao', 'fotografia', 'filmagem', 'locacao de equipamentos', 'manutencao', 'reparo', 'telefonia', 'telecomunicacoes']
  const palavrasFortesEventos = ['eventos', 'shows', 'sonorizacao', 'iluminacao', 'fotografia', 'filmagem', 'promocao']

  const PALAVRAS_FORTES_FALLBACK = {
    saude: palavrasFortesSaude,
    alimentacao: palavrasFortesAlimentacao,
    informatica: palavrasFortesInformatica,
    engenharia: palavrasFortesEngenharia,
    construcao: palavrasFortesConstrucao,
    transporte: palavrasFortesTransporte,
    financeiro: palavrasFortesFinanceiro,
    eventos: palavrasFortesEventos,
    seguranca: ['seguranca', 'protecao', 'epi', 'armamento', 'vigilancia', 'protecao individual'],
    // Chaves dos setores da tabela setores (nome normalizado inclui uma delas)
    contabeis: palavrasFortesFinanceiro,
    fiscais: palavrasFortesFinanceiro,
    tributarios: palavrasFortesFinanceiro,
    laboratoriais: palavrasFortesSaude,
    arquitetura: palavrasFortesEngenharia,
    buffet: palavrasFortesAlimentacao,
    catering: palavrasFortesAlimentacao,
    copa: palavrasFortesAlimentacao,
    cozinha: palavrasFortesAlimentacao,
    nutricao: palavrasFortesAlimentacao,
    enfermagem: palavrasFortesSaude,
    fisioterapia: palavrasFortesSaude,
    psicologia: palavrasFortesSaude,
    medicos: palavrasFortesSaude,
    'bem-estar': palavrasFortesSaude,
    alvenaria: palavrasFortesConstrucao,
    reformas: palavrasFortesConstrucao,
    carpintaria: palavrasFortesConstrucao,
    marcenaria: palavrasFortesConstrucao,
    pintura: palavrasFortesConstrucao,
    saneamento: palavrasFortesEngenharia,
    'energia eletrica': palavrasFortesEngenharia,
    eletricos: palavrasFortesEngenharia,
    hidraulicos: palavrasFortesEngenharia,
    tecnologia: palavrasFortesInformatica,
    internet: palavrasFortesInformatica,
    logistica: palavrasFortesTransporte,
    limpeza: palavrasFortesServicos,
    jardinagem: palavrasFortesServicos,
    vigilancia: palavrasFortesServicos,
  }
  // Dinâmico: banco sobrescreve/estende o fallback (permite gerenciar sem deploy)
  const palavrasFortesMescladas = {}
  Object.keys(PALAVRAS_FORTES_FALLBACK).forEach(k => {
    palavrasFortesMescladas[k] = [...(PALAVRAS_FORTES_FALLBACK[k] || [])]
  })
  if (palavrasFortesPorSetor && typeof palavrasFortesPorSetor === 'object') {
    Object.entries(palavrasFortesPorSetor).forEach(([setorNome, palavras]) => {
      const chave = (setorNome || '').toLowerCase().trim()
      if (!chave || !Array.isArray(palavras)) return
      palavrasFortesMescladas[chave] = (palavrasFortesMescladas[chave] || []).concat(
        palavras.map(p => (p || '').toLowerCase().trim()).filter(Boolean)
      )
      palavrasFortesMescladas[chave] = [...new Set(palavrasFortesMescladas[chave])]
    })
  }

  /**
   * REGRA RESTRITIVA: Só aceita o edital se o OBJETO contiver pelo menos uma palavra forte do setor cadastrado.
   * Assim editais que não têm a ver com os setores da empresa não aparecem (ex.: Construção para quem é Saúde).
   * Usa (1) mapa fallback+banco e (2) nome do setor + subsetores do perfil.
   */
  function exigePalavraForteDoSetor(objetoNorm, palavrasEncontradas, setores, palavrasFortesMap) {
    if (!setores || setores.length === 0) return true
    const palavrasFortesSetor = new Set()
    const map = palavrasFortesMap || palavrasFortesMescladas
    for (const setor of setores) {
      if (!setor.setor) continue
      const nomeNorm = normalizarTexto(setor.setor)
      // 1) Lista fixa/banco (quando existe chave que bate no nome do setor)
      for (const [chave, palavras] of Object.entries(map)) {
        if (nomeNorm.includes(chave) && Array.isArray(palavras)) {
          palavras.forEach(p => palavrasFortesSetor.add(normalizarTexto(p)))
        }
      }
      // 2) COBERTURA TOTAL: nome do setor + subsetores do perfil como palavras fortes
      palavrasFortesSetor.add(nomeNorm)
      if (setor.subsetores && Array.isArray(setor.subsetores)) {
        for (const subsetor of setor.subsetores) {
          if (!subsetor) continue
          const subNorm = normalizarTexto(subsetor)
          if (subNorm.length >= 3) palavrasFortesSetor.add(subNorm)
          const palavrasSub = extrairPalavrasChave(subsetor).filter(
            p => !PALAVRAS_GENERICAS_SOZINHAS.includes(normalizarTexto(p))
          )
          palavrasSub.forEach(p => palavrasFortesSetor.add(normalizarTexto(p)))
        }
      }
    }
    if (palavrasFortesSetor.size === 0) return true
    // Expandir com sinônimos (menos rígido, considera variações das áreas)
    const palavrasFortesExpandidas = new Set()
    Array.from(palavrasFortesSetor).forEach(p => {
      palavrasFortesExpandidas.add(p)
      const expandidos = expandirComSinonimos([p], sinonimosPersonalizados, sinonimosBanco)
      expandidos.forEach(e => palavrasFortesExpandidas.add(e))
    })
    const temForte = Array.from(palavrasFortesExpandidas).some(p => p && objetoNorm.includes(p))
    return temForte
  }
  
  // NOVA ABORDAGEM: Buscar por CADA atividade (subsetor) cadastrada individualmente
  // Isso aumenta muito a abrangência porque busca por termos específicos de cada atividade
  // MELHORADO: Sistema de pontuação para manter precisão e abrangência
  if (setoresAtividades && setoresAtividades.length > 0) {
    let pontuacaoCorrespondencia = 0
    const palavrasUnicasEncontradas = new Set()  // Rastrear palavras únicas encontradas
    // EXPANDIDO: Mais palavras genéricas para reduzir falsos positivos
    const palavrasGenericas = [
      'servico', 'servicos', 'manutencao', 'manutenção', 'prestacao', 'prestação', 
      'fornecimento', 'fornecer', 'material', 'materiais', 'escolar', 'escolares',
      'kit', 'kits', 'aquisição', 'aquisicao', 'compra', 'adquirir', 
      'contratacao', 'contratação', 'publico', 'publica', 'municipal', 
      'estadual', 'federal', 'governo', 'orgao', 'órgão'
    ]
    
    // Iterar sobre cada setor e seus subsetores
    for (const setor of setoresAtividades) {
      // Verificar nome do setor (peso menor, pois é mais genérico)
      if (setor.setor) {
        const setorNormalizado = normalizarTexto(setor.setor)
        // Correspondência exata do setor completo (peso 3)
        if (objetoNormalizado.includes(setorNormalizado)) {
          palavrasUnicasEncontradas.add(setorNormalizado)  // Rastrear palavra única
          pontuacaoCorrespondencia += 3
        } else {
          // Correspondência parcial (peso 1)
          if (palavrasObjeto.some(po => correspondeParcial(setorNormalizado, po))) {
            palavrasUnicasEncontradas.add(setorNormalizado)  // Rastrear palavra única
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
            palavrasUnicasEncontradas.add(subsetorNormalizado)  // Rastrear palavra única
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
                return distancia <= 130  // Contexto próximo para abranger mais (ex: "alimentação escolar" próximo a "merenda")
              })
              if (temContexto) {
                palavrasEncontradas++
                palavrasUnicasEncontradas.add(palavraNormalizada)  // Rastrear palavra única
                pontuacaoCorrespondencia += 2
              }
              continue
            }
            
            // Correspondência exata (peso 2)
            if (objetoNormalizado.includes(palavraNormalizada)) {
              palavrasEncontradas++
              palavrasUnicasEncontradas.add(palavraNormalizada)  // Rastrear palavra única
              pontuacaoCorrespondencia += 2
              continue
            }
            
            // Correspondência parcial (peso 1)
            if (palavrasObjeto.some(po => correspondeParcial(palavraNormalizada, po))) {
              palavrasEncontradas++
              palavrasUnicasEncontradas.add(palavraNormalizada)  // Rastrear palavra única
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
                palavrasUnicasEncontradas.add(palavraNormalizada)  // Rastrear palavra única
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
    
    // PRECISÃO: Sistema de pontuação flexível para balancear precisão e cobertura
    // Estratégia: Aceitar casos com pontuação alta OU múltiplas palavras-chave
    // Isso aumenta a cobertura sem perder muita precisão
    
    // REGRA: Com setores cadastrados, exige SEMPRE vocabulário do setor + pelo menos uma palavra forte (mostrar só o compatível).
      const correspondeVocabulario = correspondeVocabularioSetor(objetoNormalizado, vocabularioSetor)
    const temPalavraForte = exigePalavraForteDoSetor(objetoNormalizado, palavrasUnicasEncontradas, setoresAtividades, palavrasFortesMescladas)
    const exigeVocab = vocabularioSetor.size === 0 || correspondeVocabulario

    // CASO 1: Pontuação alta (6+) + vocabulário + palavra forte (abaixado de 7 para trazer mais)
    if (pontuacaoCorrespondencia >= 6 && exigeVocab && temPalavraForte) {
        return true
      }
    // CASO 2: Pontuação média-alta (5+) + pelo menos 2 termos do setor + vocabulário + palavra forte
    if (pontuacaoCorrespondencia >= 5 && palavrasUnicasEncontradas.size >= 2 && exigeVocab && temPalavraForte) {
        return true
      }
    // CASO 3: Subsetor completo no objeto (5+ pts) + 1 termo + vocabulário + palavra forte (abrange mais, mantém compatível)
    if (pontuacaoCorrespondencia >= 5 && palavrasUnicasEncontradas.size >= 1 && exigeVocab && temPalavraForte) {
          return true
        }
    // CASO 4: Pontuação média (5+) + 2+ termos + vocabulário + palavra forte (reforço contra falso positivo)
    if (pontuacaoCorrespondencia >= 5 && palavrasUnicasEncontradas.size >= 2 && exigeVocab && temPalavraForte) {
        return true
      }
    // Não passou: não mostrar (só compatíveis com setores e atividades cadastrados)
  }
  
  // FALLBACK: Se a empresa tem setores e não passou nos critérios restritivos acima, não aceitar (mostrar só compatíveis).
  if (setoresAtividades && setoresAtividades.length > 0) {
    return false
  }
  // Sem setores: usar lógica mais restritiva com palavras-chave principais
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
          
          // Contexto deve estar próximo (80 caracteres - mais restritivo ainda)
          const distancia = Math.abs(indicePalavra - indiceContexto)
          return distancia <= 80  // Reduzido de 100 para 80 para maior precisão
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
  
  // REGRA FINAL: Se tem palavras principais, deve ter correspondência principal E vocabulário E palavra forte do setor
  if (palavrasPrincipais.length > 0) {
    if (temCorrespondenciaPrincipal) {
      const correspondeVocabulario = correspondeVocabularioSetor(objetoNormalizado, vocabularioSetor)
      if (correspondeVocabulario || vocabularioSetor.size === 0) {
        // Só aceitar se o objeto tiver pelo menos uma palavra forte do setor (evita editais fora do setor)
        if (exigePalavraForteDoSetor(objetoNormalizado, new Set(palavrasPrincipais), setoresAtividades, palavrasFortesMescladas)) {
        return true
      }
      }
      return false
    }
    return false
  }
  
  // Se só tem palavras secundárias: exige vocabulário E palavra forte do setor
  if (palavrasSecundarias.length > 0) {
    const correspondeVocabulario = correspondeVocabularioSetor(objetoNormalizado, vocabularioSetor)
    if (correspondeVocabulario) {
      if (exigePalavraForteDoSetor(objetoNormalizado, new Set(palavrasSecundarias), setoresAtividades, palavrasFortesMescladas)) {
      return true
      }
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
    
    // Só aceitar se o objeto tiver pelo menos uma palavra forte do setor
    return exigePalavraForteDoSetor(objetoNormalizado, new Set(palavrasSecundarias), setoresAtividades, palavrasFortesMescladas)
  }
  
  // Verificar correspondência com sinônimos (banco + personalizados) apenas se não encontrou correspondência direta
  // MAS: Ainda exigir correspondência com vocabulário do setor OU contexto
  const palavrasExpandidas = expandirComSinonimos(palavrasChaveFormatadas, sinonimosPersonalizados, sinonimosBanco)
  
  // Primeiro verificar se corresponde ao vocabulário do setor
  const correspondeVocabulario = correspondeVocabularioSetor(objetoNormalizado, vocabularioSetor)
  
  if (correspondeVocabulario) {
    const temCorrespondenciaSinonimo = palavrasExpandidas.some(palavra => {
      return objetoNormalizado.includes(normalizarTexto(palavra))
    })
    if (!temCorrespondenciaSinonimo) return false
    if (setoresAtividades?.length > 0) {
      return exigePalavraForteDoSetor(objetoNormalizado, new Set(palavrasExpandidas), setoresAtividades, palavrasFortesMescladas)
    }
    return true
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
 * Calcula score de aderência (0–100) e label para exibição em cards.
 * Usa a mesma lógica de pontuação do filtro semântico (setores/subsetores).
 * @param {Object} licitacao
 * @param {Object} palavrasChave - { principais, secundarias, todas } (ex.: extrairPalavrasChaveDosSetores)
 * @param {Object} [sinonimosPersonalizados]
 * @param {Object} [sinonimosBanco]
 * @param {Array} [setoresAtividades]
 * @returns {{ score: number, label: 'alta'|'média'|'baixa' }}
 */
export function calcularScoreAderencia(
  licitacao,
  palavrasChave,
  sinonimosPersonalizados = {},
  sinonimosBanco = {},
  setoresAtividades = []
) {
  const objetoCompleto = obterObjetoCompleto(licitacao)
  if (!objetoCompleto || !setoresAtividades?.length) {
    return { score: 0, label: 'baixa' }
  }
  const objetoNormalizado = normalizarTexto(objetoCompleto)
  const palavrasObjeto = objetoNormalizado.split(/\s+/).filter(p => p.length >= 4)
  const palavrasContexto = extrairPalavrasContexto(setoresAtividades)
  const palavrasGenericas = [
    'servico', 'servicos', 'manutencao', 'manutenção', 'prestacao', 'prestação',
    'fornecimento', 'fornecer', 'material', 'materiais', 'escolar', 'escolares',
    'kit', 'kits', 'aquisição', 'aquisicao', 'compra', 'adquirir',
    'contratacao', 'contratação', 'publico', 'publica', 'municipal',
    'estadual', 'federal', 'governo', 'orgao', 'órgão'
  ]
  let pontuacaoCorrespondencia = 0
  const palavrasUnicasEncontradas = new Set()

  for (const setor of setoresAtividades) {
    if (setor.setor) {
      const setorNormalizado = normalizarTexto(setor.setor)
      if (objetoNormalizado.includes(setorNormalizado)) {
        palavrasUnicasEncontradas.add(setorNormalizado)
        pontuacaoCorrespondencia += 3
      } else if (palavrasObjeto.some(po => correspondeParcial(setorNormalizado, po))) {
        palavrasUnicasEncontradas.add(setorNormalizado)
        pontuacaoCorrespondencia += 1
      }
    }
    if (setor.subsetores && Array.isArray(setor.subsetores)) {
      for (const subsetor of setor.subsetores) {
        if (!subsetor) continue
        const subsetorNormalizado = normalizarTexto(subsetor)
        if (objetoNormalizado.includes(subsetorNormalizado)) {
          palavrasUnicasEncontradas.add(subsetorNormalizado)
          pontuacaoCorrespondencia += 5
          continue
        }
        const palavrasSubsetor = extrairPalavrasChave(subsetor)
        let palavrasEncontradas = 0
        for (const palavraSubsetor of palavrasSubsetor) {
          const palavraNormalizada = normalizarTexto(palavraSubsetor)
          if (palavrasGenericas.includes(palavraNormalizada)) {
            const temContexto = palavrasContexto.some(pc => {
              const pcNorm = normalizarTexto(pc)
              const idxPalavra = objetoNormalizado.indexOf(palavraNormalizada)
              const idxContexto = objetoNormalizado.indexOf(pcNorm)
              if (idxContexto === -1) return false
              return Math.abs(idxPalavra - idxContexto) <= 130
            })
            if (temContexto) {
              palavrasEncontradas++
              palavrasUnicasEncontradas.add(palavraNormalizada)
              pontuacaoCorrespondencia += 2
            }
            continue
          }
          if (objetoNormalizado.includes(palavraNormalizada)) {
            palavrasEncontradas++
            palavrasUnicasEncontradas.add(palavraNormalizada)
            pontuacaoCorrespondencia += 2
            continue
          }
          if (palavrasObjeto.some(po => correspondeParcial(palavraNormalizada, po))) {
            palavrasEncontradas++
            palavrasUnicasEncontradas.add(palavraNormalizada)
            pontuacaoCorrespondencia += 1
            continue
          }
          const raizSubsetor = extrairRaizPalavra(palavraNormalizada)
          if (raizSubsetor.length >= 4 && palavrasObjeto.some(po => extrairRaizPalavra(po) === raizSubsetor)) {
            palavrasEncontradas++
            palavrasUnicasEncontradas.add(palavraNormalizada)
            pontuacaoCorrespondencia += 1
          }
        }
        if (palavrasEncontradas >= 2) pontuacaoCorrespondencia += 2
      }
    }
  }

  const score = Math.min(100, Math.round(pontuacaoCorrespondencia * 10))
  const label = score >= 70 ? 'alta' : score >= 40 ? 'média' : 'baixa'
  return { score, label }
}

/** Fallback mínimo de termos incompatíveis por setor (para resumo na tela do edital) */
const FALLBACK_INCOMPATIBILIDADE_RESUMO = {
  saude: ['medicamento', 'hospitalar', 'laboratorial', 'diesel', 'veiculo', 'construcao', 'fardamento', 'eventos'],
  alimentacao: ['diesel', 'veiculo', 'construcao', 'medicamento', 'hospitalar', 'fardamento', 'software', 'informatica'],
  informatica: ['escolar', 'alimento', 'medicamento', 'construcao', 'diesel', 'frota', 'eventos', 'jardinagem'],
  engenharia: ['medicamento', 'alimentacao', 'fardamento', 'eventos', 'seguro', 'passagem aerea', 'leilao'],
  construcao: ['medicamento', 'alimentacao', 'fardamento', 'eventos', 'advocacia', 'contabilidade', 'telemarketing'],
  transporte: ['medicamento', 'material escolar', 'construcao', 'pedagio', 'leilao de veiculos'],
  financeiro: ['construcao', 'obra', 'medicamento', 'fardamento', 'solda', 'serralheria', 'pintura predial'],
  eventos: ['medicamento', 'diesel', 'construcao', 'material escolar', 'seguro', 'leilao', 'pedagio'],
  educacao: ['diesel', 'combustivel', 'construcao', 'medicamento', 'seguro', 'leilao', 'pedagio'],
}

/**
 * Retorna termos de incompatibilidade encontrados no texto do edital (para resumo na tela).
 * @param {string} objetoTexto - Objeto da licitação + informações complementares
 * @param {Array} setoresAtividades - Setores do perfil do usuário
 * @param {Object} palavrasIncompatibilidadePorSetor - Do banco (usePalavrasIncompatibilidade)
 * @returns {{ encontrados: string[], porSetor: Array<{ setor: string, termos: string[] }> }}
 */
export function termosIncompatibilidadeEncontrados(objetoTexto, setoresAtividades, palavrasIncompatibilidadePorSetor = {}) {
  const encontrados = []
  const porSetor = []
  if (!objetoTexto || !setoresAtividades?.length) return { encontrados, porSetor }
  const textoNorm = normalizarTexto(objetoTexto)
  const banco = palavrasIncompatibilidadePorSetor || {}

  for (const setor of setoresAtividades) {
    if (!setor.setor) continue
    const setorNorm = normalizarTexto(setor.setor)
    const fallback = FALLBACK_INCOMPATIBILIDADE_RESUMO[setorNorm] || []
    const doBanco = banco[setorNorm] || []
    const termosSetor = [...new Set([...fallback, ...doBanco])]
    const encontradosSetor = termosSetor.filter(termo => {
      const t = normalizarTexto(termo)
      return t.length >= 3 && textoNorm.includes(t)
    })
    if (encontradosSetor.length > 0) {
      encontradosSetor.forEach(t => { if (!encontrados.includes(t)) encontrados.push(t) })
      porSetor.push({ setor: setor.setor, termos: encontradosSetor })
    }
  }
  return { encontrados: [...new Set(encontrados)], porSetor }
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


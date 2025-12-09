// ============================================
// UTILITÁRIOS CNAE
// ============================================
// Funções para trabalhar com CNAEs e atividades econômicas

/**
 * Busca o nome da atividade econômica pelo código CNAE
 * Usa API pública do IBGE ou mapeamento local
 */
export async function buscarNomeAtividadeCnae(codigoCnae) {
  if (!codigoCnae) return null

  try {
    // Tentar buscar via API do IBGE
    const response = await fetch(
      `https://servicodados.ibge.gov.br/api/v2/cnae/classes/${codigoCnae}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      }
    )

    if (response.ok) {
      const data = await response.json()
      return data.nome || data.descricao || null
    }
  } catch (error) {
    console.warn('Erro ao buscar nome CNAE via API:', error)
  }

  // Fallback: retornar código se não encontrar
  return `CNAE ${codigoCnae}`
}

/**
 * Busca nomes de múltiplas atividades CNAE
 */
export async function buscarNomesAtividadesCnae(codigosCnae) {
  if (!codigosCnae || codigosCnae.length === 0) return []

  const promises = codigosCnae.map(codigo => buscarNomeAtividadeCnae(codigo))
  const nomes = await Promise.all(promises)

  return codigosCnae.map((codigo, index) => ({
    codigo,
    nome: nomes[index] || `CNAE ${codigo}`,
  }))
}

/**
 * Resumir nome de atividade (limitar tamanho)
 */
export function resumirNomeAtividade(nome, maxLength = 60) {
  if (!nome || nome.length <= maxLength) return nome
  return nome.substring(0, maxLength - 3) + '...'
}

/**
 * Mapeamento completo de CNAEs comuns (fallback)
 * Lista expandida com principais atividades econômicas
 */
const MAPEAMENTO_CNAE_COMPLETO = {
  // Tecnologia da Informação
  '6201502': 'Desenvolvimento e licenciamento de programas de computador customizáveis',
  '6201501': 'Desenvolvimento de programas de computador sob encomenda',
  '6202300': 'Desenvolvimento e licenciamento de programas de computador não-customizáveis',
  '6203100': 'Desenvolvimento e licenciamento de programas de computador não-customizáveis',
  '6204000': 'Consultoria em tecnologia da informação',
  '6209100': 'Suporte técnico, manutenção e outros serviços em tecnologia da informação',
  '6311900': 'Tratamento de dados, provedores de serviços de aplicação e serviços de hospedagem na internet',
  '6319400': 'Portais, provedores de conteúdo e outros serviços de informação na internet',
  '6619399': 'Outras atividades auxiliares dos serviços financeiros não especificadas anteriormente',
  '7020400': 'Atividades de consultoria em gestão empresarial',
  '7733100': 'Aluguel de máquinas e equipamentos para escritório',
  '8291100': 'Atividades de cobrança e informações cadastrais',
  '8599604': 'Gestão e promoção de eventos',
  
  // Construção
  '4110700': 'Incorporação de empreendimentos imobiliários',
  '4120400': 'Construção de edifícios',
  '4211101': 'Construção de rodovias e ferrovias',
  '4299500': 'Obras de engenharia civil não especificadas anteriormente',
  
  // Serviços
  '4520001': 'Manutenção e reparação de veículos automotores',
  '4530701': 'Comércio a varejo de peças e acessórios para veículos automotores',
  '4711301': 'Comércio varejista de mercadorias em geral, com predominância de produtos alimentícios',
  '4712100': 'Comércio varejista de mercadorias em geral, sem predominância de produtos alimentícios',
  
  // Consultoria
  '7020400': 'Atividades de consultoria em gestão empresarial',
  '7111100': 'Serviços de arquitetura',
  '7112000': 'Serviços de engenharia',
  '7120100': 'Serviços de cartografia, topografia e geodésia',
  
  // Limpeza e Conservação
  '8121400': 'Limpeza em prédios e em domicílios',
  '8122300': 'Imunização e controle de pragas urbanas',
  
  // Segurança
  '8011101': 'Atividades de vigilância e segurança privada',
  '8012900': 'Atividades de sistemas de segurança',
  
  // Alimentação
  '5611201': 'Restaurantes e similares',
  '5620101': 'Fornecimento de alimentos preparados preponderantemente para empresas',
  
  // Transporte
  '4923001': 'Transporte rodoviário de carga, exceto produtos perigosos e mudanças',
  '4923002': 'Transporte rodoviário de produtos perigosos',
  '4924801': 'Transporte rodoviário coletivo de passageiros, com itinerário fixo',
  
  // Comunicação
  '5819100': 'Edição integrada à impressão de livros',
  '5911101': 'Estúdios cinematográficos',
  '6010100': 'Atividades de rádio',
  '6010200': 'Atividades de televisão aberta',
  
  // Saúde
  '8610101': 'Atividades de atendimento hospitalar',
  '8621601': 'Atividades de atenção ambulatorial executadas por médicos e odontólogos',
  '8690900': 'Atividades de atenção à saúde humana não especificadas anteriormente',
  
  // Educação
  '8511200': 'Educação infantil - creche',
  '8512100': 'Educação infantil - pré-escola',
  '8520100': 'Ensino fundamental',
  '8531700': 'Ensino médio',
  
  // Outros
  '9001901': 'Produção teatral',
  '9002702': 'Produção de espetáculos de dança',
  '9101500': 'Bibliotecas e arquivos',
}

/**
 * Busca nome de atividade CNAE com fallback para mapeamento local
 */
export function obterNomeAtividadeCnae(codigoCnae) {
  if (!codigoCnae) return null

  // Tentar mapeamento local primeiro (mais rápido)
  if (MAPEAMENTO_CNAE_COMPLETO[codigoCnae]) {
    return MAPEAMENTO_CNAE_COMPLETO[codigoCnae]
  }

  // Se não encontrar, retornar código formatado
  return `CNAE ${codigoCnae}`
}

/**
 * Lista completa de CNAEs disponíveis para seleção
 * Inclui CNAEs da empresa + lista comum de atividades
 */
export function obterListaCompletaCnaes(cnaesEmpresa = []) {
  try {
    const todosCnaes = new Map()
    
    // Adicionar CNAEs da empresa primeiro (prioridade)
    if (Array.isArray(cnaesEmpresa)) {
      cnaesEmpresa.forEach(cnae => {
        if (cnae && cnae.codigo) {
          todosCnaes.set(cnae.codigo, {
            codigo: cnae.codigo,
            nome: obterNomeAtividadeCnae(cnae.codigo),
            tipo: cnae.tipo || 'empresa',
            prioridade: cnae.tipo === 'principal' ? 1 : 2
          })
        }
      })
    }
    
    // Adicionar CNAEs comuns do mapeamento
    if (MAPEAMENTO_CNAE_COMPLETO && typeof MAPEAMENTO_CNAE_COMPLETO === 'object') {
      Object.keys(MAPEAMENTO_CNAE_COMPLETO).forEach(codigo => {
        if (!todosCnaes.has(codigo)) {
          todosCnaes.set(codigo, {
            codigo,
            nome: MAPEAMENTO_CNAE_COMPLETO[codigo],
            tipo: 'comum',
            prioridade: 3
          })
        }
      })
    }
    
    // Converter para array e ordenar por prioridade
    return Array.from(todosCnaes.values())
      .sort((a, b) => a.prioridade - b.prioridade || a.nome.localeCompare(b.nome))
  } catch (error) {
    console.error('Erro ao obter lista completa de CNAEs:', error)
    return []
  }
}


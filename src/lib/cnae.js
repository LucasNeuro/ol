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
 * Mapeamento completo de CNAEs (base de dados local)
 * Lista expandida com principais atividades econômicas
 * Fonte: IBGE - Classificação Nacional de Atividades Econômicas (CNAE)
 */
const MAPEAMENTO_CNAE_COMPLETO = {
  // Serviços de saúde e prótese
  '3250706': 'Serviços de prótese dentária',
  '3250709': 'Serviço de laboratório óptico',
  
  // Construção e administração
  '4120400': 'Construção de edifícios',
  '4399101': 'Administração de obras',
  
  // Comércio de veículos e peças
  '4512901': 'Representantes comerciais e agentes do comércio de veículos automotores',
  '4530702': 'Comércio por atacado de pneumáticos e câmaras-de-ar',
  '4530703': 'Comércio a varejo de peças e acessórios novos para veículos automotores',
  '4530704': 'Comércio a varejo de peças e acessórios usados para veículos automotores',
  '4530705': 'Comércio a varejo de pneumáticos e câmaras-de-ar',
  '4530706': 'Representantes comerciais e agentes do comércio de peças e acessórios novos e usados para veículos automotores',
  '4541202': 'Comércio por atacado de peças e acessórios para motocicletas e motonetas',
  '4541206': 'Comércio a varejo de peças e acessórios novos para motocicletas e motonetas',
  '4541207': 'Comércio a varejo de peças e acessórios usados para motocicletas e motonetas',
  '4542101': 'Representantes comerciais e agentes do comércio de motocicletas e motonetas, peças e acessórios',
  
  // Representantes comerciais
  '4611700': 'Representantes comerciais e agentes do comércio de matérias-primas agrícolas e animais vivos',
  '4612500': 'Representantes comerciais e agentes do comércio de combustíveis, minerais, produtos siderúrgicos e químicos',
  '4613300': 'Representantes comerciais e agentes do comércio de madeira, material de construção e ferragens',
  '4614100': 'Representantes comerciais e agentes do comércio de máquinas, equipamentos, embarcações e aeronaves',
  '4615000': 'Representantes comerciais e agentes do comércio de eletrodomésticos, móveis e artigos de uso doméstico',
  '4616800': 'Representantes comerciais e agentes do comércio de têxteis, vestuário, calçados e artigos de viagem',
  '4617600': 'Representantes comerciais e agentes do comércio de produtos alimentícios, bebidas e fumo',
  '4618401': 'Representantes comerciais e agentes do comércio de medicamentos, cosméticos e produtos de perfumaria',
  '4618402': 'Representantes comerciais e agentes do comércio de instrumentos e materiais odonto-médico-hospitalares',
  '4618403': 'Representantes comerciais e agentes do comércio de jornais, revistas e outras publicações',
  '4618499': 'Outros representantes comerciais e agentes do comércio especializado em produtos não especificados anteriormente',
  '4619200': 'Representantes comerciais e agentes do comércio de mercadorias em geral não especializado',
  
  // Comércio varejista
  '4711301': 'Comércio varejista de mercadorias em geral, com predominância de produtos alimentícios – hipermercados',
  '4711302': 'Comércio varejista de mercadorias em geral, com predominância de produtos alimentícios – supermercados',
  '4712100': 'Comércio varejista de mercadorias em geral, com predominância de produtos alimentícios – minimercados, mercearias e armazéns',
  '4713002': 'Lojas de variedades, exceto lojas de departamentos ou magazines',
  '4713004': 'Lojas de departamentos ou magazines, exceto lojas francas (Duty free)',
  '4721102': 'Padaria e confeitaria com predominância de revenda',
  '4721103': 'Comércio varejista de laticínios e frios',
  '4721104': 'Comércio varejista de doces, balas, bombons e semelhantes',
  '4723700': 'Comércio varejista de bebidas',
  '4724500': 'Comércio varejista de hortifrutigranjeiros',
  '4729601': 'Tabacaria',
  '4729699': 'Comércio varejista de produtos alimentícios em geral ou especializado em produtos alimentícios não especificados anteriormente',
  '4743100': 'Comércio varejista de vidros',
  '4744002': 'Comércio varejista de madeira e artefatos',
  '4751201': 'Comércio varejista especializado de equipamentos e suprimentos de informática',
  '4751202': 'Recarga de cartuchos para equipamentos de informática',
  '4752100': 'Comércio varejista especializado de equipamentos de telefonia e comunicação',
  '4753900': 'Comércio varejista especializado de eletrodomésticos e equipamentos de áudio e vídeo',
  '4754701': 'Comércio varejista de móveis',
  '4754702': 'Comércio varejista de artigos de colchoaria',
  '4754703': 'Comércio varejista de artigos de iluminação',
  '4755501': 'Comércio varejista de tecidos',
  '4755502': 'Comércio varejista de artigos de armarinho',
  '4755503': 'Comércio varejista de artigos de cama, mesa e banho',
  '4756300': 'Comércio varejista especializado de instrumentos musicais e acessórios',
  '4757100': 'Comércio varejista especializado de peças e acessórios para aparelhos eletroeletrônicos para uso doméstico, exceto informática e comunicação',
  '4759801': 'Comércio varejista de artigos de tapeçaria, cortinas e persianas',
  '4759899': 'Comércio varejista de outros artigos de uso doméstico não especificados anteriormente',
  '4761001': 'Comércio varejista de livros',
  '4761002': 'Comércio varejista de jornais e revistas',
  '4761003': 'Comércio varejista de artigos de papelaria',
  '4762800': 'Comércio varejista de discos, CDs, DVDs e fitas',
  '4763601': 'Comércio varejista de brinquedos e artigos recreativos',
  '4763602': 'Comércio varejista de artigos esportivos',
  '4763603': 'Comércio varejista de bicicletas e triciclos peças e acessórios',
  '4763604': 'Comércio varejista de artigos de caça, pesca e camping',
  '4772500': 'Comércio varejista de cosméticos, produtos de perfumaria e de higiene pessoal',
  '4774100': 'Comércio varejista de artigos de óptica',
  '4781400': 'Comércio varejista de artigos do vestuário e acessórios',
  '4782201': 'Comércio varejista de calçados',
  '4782202': 'Comércio varejista de artigos de viagem',
  '4783102': 'Comércio varejista de artigos de relojoaria',
  '4785701': 'Comércio varejista de antigüidades',
  '4785799': 'Comércio varejista de outros artigos usados',
  '4789001': 'Comércio varejista de suvenires, bijuterias e artesanatos',
  '4789002': 'Comércio varejista de plantas e flores naturais',
  '4789003': 'Comércio varejista de objetos de arte',
  '4789007': 'Comércio varejista de equipamentos para escritório',
  '4789008': 'Comércio varejista de artigos fotográficos e para filmagem',
  '4789099': 'Comércio varejista de outros produtos não especificados anteriormente',
  
  // Alimentação
  '5611201': 'Restaurantes e similares',
  '5611203': 'Lanchonetes, casas de chá, de sucos e similares',
  '5611204': 'Bares e outros estabelecimentos especializados em servir bebidas, sem entretenimento',
  '5620101': 'Fornecimento de alimentos preparados preponderantemente para empresas',
  '5620103': 'Cantinas – serviços de alimentação privativos',
  '5620104': 'Fornecimento de alimentos preparados preponderantemente para consumo domiciliar',
  
  // Produção audiovisual
  '5911101': 'Estúdios cinematográficos',
  '5911102': 'Produção de filmes para publicidade',
  '5911199': 'Atividades de produção cinematográfica, de vídeos e de programas de televisão não especificadas anteriormente',
  '5912001': 'Serviços de dublagem',
  '5912002': 'Serviços de mixagem sonora em produção audiovisual',
  '5912099': 'Atividades de pós-produção cinematográfica, de vídeos e de programas de televisão não especificadas anteriormente',
  '5913800': 'Distribuição cinematográfica, de vídeo e de programas de televisão',
  '5914600': 'Atividades de exibição cinematográfica',
  '5920100': 'Atividades de gravação de som e de edição de música',
  
  // Tecnologia da Informação
  '6201501': 'Desenvolvimento de programas de computador sob encomenda',
  '6201502': 'Web design',
  '6202300': 'Desenvolvimento e licenciamento de programas de computador customizáveis',
  '6203100': 'Desenvolvimento e licenciamento de programas de computador não-customizáveis',
  '6204000': 'Consultoria em tecnologia da informação',
  '6209100': 'Suporte técnico, manutenção e outros serviços em tecnologia da informação',
  '6311900': 'Tratamento de dados, provedores de serviços de aplicação e serviços de hospedagem na internet',
  '6319400': 'Portais, provedores de conteúdo e outros serviços de informação na internet',
  '6391700': 'Agências de notícias',
  '6399200': 'Outras atividades de prestação de serviços de informação não especificadas anteriormente',
  
  // Serviços financeiros
  '6619302': 'Correspondentes de instituições financeiras',
  '6619399': 'Outras atividades auxiliares dos serviços financeiros não especificadas anteriormente',
  '6621501': 'Peritos e avaliadores de seguros',
  '6621502': 'Auditoria e consultoria atuarial',
  '6622300': 'Corretores e agentes de seguros, de planos de previdência complementar e de saúde',
  '6629100': 'Atividades auxiliares dos seguros, da previdência complementar e dos planos de saúde não especificadas anteriormente',
  
  // Imobiliário
  '6810201': 'Compra e venda de imóveis próprios',
  '6810202': 'Aluguel de imóveis próprios',
  '6821801': 'Corretagem na compra e venda e avaliação de imóveis',
  '6821802': 'Corretagem no aluguel de imóveis',
  
  // Serviços jurídicos
  '6911701': 'Serviços advocatícios',
  '6911702': 'Atividades auxiliares da justiça',
  '6911703': 'Agente de propriedade industrial',
  
  // Consultoria e gestão
  '7020400': 'Atividades de consultoria em gestão empresarial, exceto consultoria técnica específica',
  
  // Arquitetura e engenharia
  '7111100': 'Serviços de arquitetura',
  '7112000': 'Serviços de engenharia',
  '7119701': 'Serviços de cartografia, topografia e geodésia',
  '7119702': 'Atividades de estudos geológicos',
  '7119703': 'Serviços de desenho técnico relacionados à arquitetura e engenharia',
  '7119704': 'Serviços de perícia técnica relacionados à segurança do trabalho',
  '7119799': 'Atividades técnicas relacionadas à engenharia e arquitetura não especificadas anteriormente',
  '7120100': 'Testes e análises técnicas',
  
  // Pesquisa e desenvolvimento
  '7210000': 'Pesquisa e desenvolvimento experimental em ciências físicas e naturais',
  '7220700': 'Pesquisa e desenvolvimento experimental em ciências sociais e humanas',
  
  // Publicidade e marketing
  '7311400': 'Agências de publicidade',
  '7312200': 'Agenciamento de espaços para publicidade exceto em veículos de comunicação',
  '7319001': 'Criação de estandes para feiras e exposições',
  '7319002': 'Promoção de vendas',
  '7319003': 'Marketing direto',
  '7319004': 'Consultoria em publicidade',
  '7319099': 'Outras atividades de publicidade não especificadas anteriormente',
  '7320300': 'Pesquisas de mercado e de opinião pública',
  
  // Design
  '7410202': 'Design de interiores',
  '7410203': 'Design de produto',
  '7410299': 'Atividades de design não especificadas anteriormente',
  
  // Fotografia
  '7420001': 'Atividades de produção de fotografias, exceto aérea e submarina',
  '7420002': 'Atividades de produção de fotografias aéreas e submarinas',
  '7420003': 'Laboratórios fotográficos',
  '7420004': 'Filmagem de festas e eventos',
  '7420005': 'Serviços de microfilmagem',
  
  // Serviços profissionais diversos
  '7490101': 'Serviços de tradução, interpretação e similares',
  '7490102': 'Escafandria e mergulho',
  '7490103': 'Serviços de agronomia e de consultoria às atividades agrícolas e pecuárias',
  '7490104': 'Atividades de intermediação e agenciamento de serviços e negócios em geral, exceto imobiliários',
  '7490105': 'Agenciamento de profissionais para atividades esportivas, culturais e artísticas',
  '7490199': 'Outras atividades profissionais, científicas e técnicas não especificadas anteriormente',
  '7500100': 'Atividades veterinárias',
  
  // Aluguel
  '7721700': 'Aluguel de equipamentos recreativos e esportivos',
  '7722500': 'Aluguel de fitas de vídeo, DVDs e similares',
  '7723300': 'Aluguel de objetos do vestuário, jóias e acessórios',
  '7729201': 'Aluguel de aparelhos de jogos eletrônicos',
  '7729202': 'Aluguel de móveis, utensílios e aparelhos de uso doméstico e pessoal; instrumentos musicais',
  '7729203': 'Aluguel de material médico',
  '7729299': 'Aluguel de outros objetos pessoais e domésticos não especificados anteriormente',
  '7731400': 'Aluguel de máquinas e equipamentos agrícolas sem operador',
  '7732201': 'Aluguel de máquinas e equipamentos para construção sem operador, exceto andaimes',
  '7732202': 'Aluguel de andaimes',
  '7733100': 'Aluguel de máquinas e equipamentos para escritório',
  '7739001': 'Aluguel de máquinas e equipamentos para extração de minérios e petróleo, sem operador',
  '7739002': 'Aluguel de equipamentos científicos, médicos e hospitalares, sem operador',
  '7739003': 'Aluguel de palcos, coberturas e outras estruturas de uso temporário, exceto andaimes',
  '7739099': 'Aluguel de outras máquinas e equipamentos comerciais e industriais não especificados anteriormente, sem operador',
  '7740300': 'Gestão de ativos intangíveis não-financeiros',
  
  // Turismo
  '7911200': 'Agências de viagens',
  '7912100': 'Operadores turísticos',
  '7990200': 'Serviços de reservas e outros serviços de turismo não especificados anteriormente',
  
  // Segurança e investigação
  '8011102': 'Serviços de adestramento de cães de guarda',
  '8030700': 'Atividades de investigação particular',
  
  // Limpeza e conservação
  '8121400': 'Limpeza em prédios e em domicílios',
  '8122200': 'Imunização e controle de pragas urbanas',
  '8129000': 'Atividades de limpeza não especificadas anteriormente',
  '8130300': 'Atividades paisagísticas',
  
  // Serviços administrativos
  '8211300': 'Serviços combinados de escritório e apoio administrativo',
  '8219999': 'Preparação de documentos e serviços especializados de apoio administrativo não especificados anteriormente',
  '8220200': 'Atividades de teleatendimento',
  '8230001': 'Serviços de organização de feiras, congressos, exposições e festas',
  '8230002': 'Casas de festas e eventos',
  '8291100': 'Atividades de cobrança e informações cadastrais',
  '8299701': 'Medição de consumo de energia elétrica, gás e água',
  '8299703': 'Serviços de gravação de carimbos, exceto confecção',
  '8299707': 'Salas de acesso à internet',
  '8299799': 'Outras atividades de serviços prestados principalmente às empresas não especificadas anteriormente',
  
  // Educação
  '8511200': 'Educação infantil – creche',
  '8512100': 'Educação infantil – pré-escola',
  '8513900': 'Ensino fundamental',
  '8520100': 'Ensino médio',
  '8531700': 'Educação superior – graduação',
  '8532500': 'Educação superior – graduação e pós-graduação',
  '8533300': 'Educação superior – pós-graduação e extensão',
  '8541400': 'Educação profissional de nível técnico',
  '8542200': 'Educação profissional de nível tecnológico',
  '8550302': 'Atividades de apoio à educação, exceto caixas escolares',
  '8591100': 'Ensino de esportes',
  '8592901': 'Ensino de dança',
  '8592902': 'Ensino de artes cênicas, exceto dança',
  '8592903': 'Ensino de música',
  '8592999': 'Ensino de arte e cultura não especificado anteriormente',
  '8593700': 'Ensino de idiomas',
  '8599603': 'Treinamento em informática',
  '8599604': 'Treinamento em desenvolvimento profissional e gerencial',
  '8599605': 'Cursos preparatórios para concursos',
  '8599699': 'Outras atividades de ensino não especificadas anteriormente',
  
  // Saúde
  '8610101': 'Atividades de atendimento hospitalar, exceto pronto-socorro e unidades para atendimento a urgências',
  '8630501': 'Atividade médica ambulatorial com recursos para realização de procedimentos cirúrgicos',
  '8630502': 'Atividade médica ambulatorial com recursos para realização de exames complementares',
  '8630503': 'Atividade médica ambulatorial restrita a consultas',
  '8630504': 'Atividade odontológica',
  '8630506': 'Serviços de vacinação e imunização humana',
  '8630507': 'Atividades de reprodução humana assistida',
  '8630599': 'Atividades de atenção ambulatorial não especificadas anteriormente',
  '8640201': 'Laboratórios de anatomia patológica e citológica',
  '8640202': 'Laboratórios clínicos',
  '8640203': 'Serviços de diálise e nefrologia',
  '8640204': 'Serviços de tomografia',
  '8640205': 'Serviços de diagnóstico por imagem com uso de radiação ionizante, exceto tomografia',
  '8640206': 'Serviços de ressonância magnética',
  '8640207': 'Serviços de diagnóstico por imagem sem uso de radiação ionizante, exceto ressonância magnética',
  '8640208': 'Serviços de diagnóstico por registro gráfico – ECG, EEG e outros exames análogos',
  '8640209': 'Serviços de diagnóstico por métodos ópticos – endoscopia e outros exames análogos',
  '8640210': 'Serviços de quimioterapia',
  '8640211': 'Serviços de radioterapia',
  '8640212': 'Serviços de hemoterapia',
  '8640213': 'Serviços de litotripsia',
  '8640214': 'Serviços de bancos de células e tecidos humanos',
  '8640299': 'Atividades de serviços de complementação diagnóstica e terapêutica não especificadas anteriormente',
  '8650001': 'Atividades de enfermagem',
  '8650002': 'Atividades de profissionais da nutrição',
  '8650003': 'Atividades de psicologia e psicanálise',
  '8650004': 'Atividades de fisioterapia',
  '8650005': 'Atividades de terapia ocupacional',
  '8650006': 'Atividades de fonoaudiologia',
  '8650007': 'Atividades de terapia de nutrição enteral e parenteral',
  '8650099': 'Atividades de profissionais da área de saúde não especificadas anteriormente',
  '8660700': 'Atividades de apoio à gestão de saúde',
  '8690901': 'Atividades de práticas integrativas e complementares em saúde humana',
  '8690903': 'Atividades de acupuntura',
  '8690904': 'Atividades de podologia',
  '8690999': 'Outras atividades de atenção à saúde humana não especificadas anteriormente',
  
  // Artes e entretenimento
  '9001901': 'Produção teatral',
  '9001902': 'Produção musical',
  '9001903': 'Produção de espetáculos de dança',
  '9001904': 'Produção de espetáculos circenses, de marionetes e similares',
  '9001905': 'Produção de espetáculos de rodeios, vaquejadas e similares',
  '9001906': 'Atividades de sonorização e de iluminação',
  '9001999': 'Artes cênicas, espetáculos e atividades complementares não especificadas anteriormente',
  '9002701': 'Atividades de artistas plásticos, jornalistas independentes e escritores',
  '9002702': 'Restauração de obras de arte',
  
  // Esportes e recreação
  '9311500': 'Gestão de instalações de esportes',
  '9313100': 'Atividades de condicionamento físico',
  '9319101': 'Produção e promoção de eventos esportivos',
  '9319199': 'Outras atividades esportivas não especificadas anteriormente',
  '9329802': 'Exploração de boliches',
  '9329803': 'Exploração de jogos de sinuca, bilhar e similares',
  '9329804': 'Exploração de jogos eletrônicos recreativos',
  '9329899': 'Outras atividades de recreação e lazer não especificadas anteriormente',
  
  // Reparação e manutenção
  '9511800': 'Reparação e manutenção de computadores e de equipamentos periféricos',
  '9512600': 'Reparação e manutenção de equipamentos de comunicação',
  '9521500': 'Reparação e manutenção de equipamentos eletroeletrônicos de uso pessoal e doméstico',
  '9529101': 'Reparação de calçados, bolsas e artigos de viagem',
  '9529102': 'Chaveiros',
  '9529103': 'Reparação de relógios',
  '9529104': 'Reparação de bicicletas, triciclos e outros veículos não-motorizados',
  '9529105': 'Reparação de artigos do mobiliário',
  '9529106': 'Reparação de jóias',
  '9529199': 'Reparação e manutenção de outros objetos e equipamentos pessoais e domésticos não especificados anteriormente',
  
  // Serviços pessoais
  '9601701': 'Lavanderias',
  '9601702': 'Tinturarias',
  '9601703': 'Toalheiros',
  '9602501': 'Cabeleireiros, manicure e pedicure',
  '9602502': 'Atividades de Estética e outros serviços de cuidados com a beleza',
  '9609202': 'Agências matrimoniais',
  '9609205': 'Atividades de sauna e banhos',
  '9609206': 'Serviços de tatuagem e colocação de piercing',
  '9609207': 'Alojamento de animais domésticos',
  '9609208': 'Higiene e embelezamento de animais domésticos',
  '9609299': 'Outras atividades de serviços pessoais não especificadas anteriormente',
}

/**
 * Normaliza código CNAE removendo hífens e barras
 * Ex: "6201-5/02" -> "6201502"
 */
function normalizarCodigoCnae(codigoCnae) {
  if (!codigoCnae) return null
  // Converter para string e remover hífens, barras e espaços
  return String(codigoCnae).replace(/[-\/\s]/g, '')
}

/**
 * Busca nome de atividade CNAE com fallback para mapeamento local
 * Retorna o nome completo da atividade econômica
 */
export function obterNomeAtividadeCnae(codigoCnae) {
  if (!codigoCnae) return null

  // Normalizar código (remover hífens e barras)
  const codigoNormalizado = normalizarCodigoCnae(codigoCnae)

  // Tentar mapeamento local primeiro (mais rápido e confiável)
  if (MAPEAMENTO_CNAE_COMPLETO[codigoNormalizado]) {
    return MAPEAMENTO_CNAE_COMPLETO[codigoNormalizado]
  }

  // Se não encontrar no mapeamento local, retornar código formatado
  // (A busca via API seria assíncrona e não funciona bem em funções síncronas)
  return `CNAE ${codigoNormalizado}`
}

/**
 * Busca nomes de CNAEs de forma assíncrona (quando necessário buscar da API)
 * Útil para buscar nomes de CNAEs que não estão no mapeamento local
 */
export async function obterNomeAtividadeCnaeAsync(codigoCnae) {
  if (!codigoCnae) return null

  // Tentar mapeamento local primeiro
  if (MAPEAMENTO_CNAE_COMPLETO[codigoCnae]) {
    return MAPEAMENTO_CNAE_COMPLETO[codigoCnae]
  }

  // Se não encontrar, tentar buscar da API do IBGE
  try {
    const nome = await buscarNomeAtividadeCnae(codigoCnae)
    return nome || `CNAE ${codigoCnae}`
  } catch (error) {
    console.warn(`Erro ao buscar nome do CNAE ${codigoCnae}:`, error)
    return `CNAE ${codigoCnae}`
  }
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


/**
 * Estrutura de dados de setores e subsetores
 * Baseado no arquivo Setores.txt completo
 */

export const SETORES = [
  {
    setor: 'Agropecuaria',
    subsetores: [
      'Veterinária e vacinas',
      'rações para animais',
      'animais',
      'mudas, sementes e outros produtos agrícolas',
      'inseticida, herbicida e outros'
    ]
  },
  {
    setor: 'Alimentação',
    subsetores: [
      'Gêneros alimentícios',
      'Cesta básica',
      'Fornecimento de alimentação, copa, buffet e café',
      'água, bebidas'
    ]
  },
  {
    setor: 'Armazenagem',
    subsetores: [
      'Silos, depósitos, armazéns',
      'Tanques, reservatórios, caixa d\'água',
      'Movimentação de cargas',
      'Container',
      'Carrinhos em geral, rodízios'
    ]
  },
  {
    setor: 'Assessorias',
    subsetores: [
      'Consultoria, Assessorias técnicas e de apoio, cobranças',
      'Auditoria Independente',
      'Despachantes, aduaneiros',
      'Tradução, revisão ortográfica',
      'Telemarketing',
      'Cursos',
      'Concurso Público',
      'Pesquisa de opinião pública'
    ]
  },
  {
    setor: 'Cartões',
    subsetores: [
      'Magnético, pvc, crachá e outros'
    ]
  },
  {
    setor: 'Combustiveis',
    subsetores: [
      'GLP - botijões',
      'Combustíveis e Lubrificantes'
    ]
  },
  {
    setor: 'Comunicação/Identificação visual',
    subsetores: [
      'Painéis, luminosos, faixas, displays, plaqueta patrimonial'
    ]
  },
  {
    setor: 'Conssecoes / exploração / imovel',
    subsetores: [
      'Estacionamento, zona azul',
      'Pedágios',
      'Lanchonete, restaurante, bar e locação de máquinas de bebidas',
      'Áreas em aeroportos',
      'Áreas em rodoviárias',
      'Banca de jornal',
      'Áreas em sacolões',
      'Bancária/instituição financeira e lotérica',
      'Concessões especiais e outros',
      'Locação e aquisição de Imóveis',
      'Concessão/Exploração. privatização: Saneamento, elétrica, viária, gestão prisional e outros'
    ]
  },
  {
    setor: 'Confecções / Decoração',
    subsetores: [
      'Uniformes e confecções em geral',
      'Aviamentos',
      'Cama, mesa e banho',
      'Tecidos',
      'Calçados',
      'Tapeçaria, persianas, cortinas e decoração',
      'Malas, malotes e encerados'
    ]
  },
  {
    setor: 'Didatico',
    subsetores: [
      'Livros e material didático'
    ]
  },
  {
    setor: 'Eletro Eletronicos/Otica',
    subsetores: [
      'Cine, som, ótica, TV e projetores',
      'Eletrodomésticos, ventilador, bebedouro',
      'Exaustor e exaustão'
    ]
  },
  {
    setor: 'Embalagens e lacres',
    subsetores: [
      'Embalagens e lacres em geral',
      'Utensílios de copa e cozinha'
    ]
  },
  {
    setor: 'Engenharia - Materiais',
    subsetores: [
      'Construção, madeiras',
      'Hidráulicos, saneamento',
      'Asfálticos, concreto',
      'Elétricos',
      'Material de Sinalização'
    ]
  },
  {
    setor: 'Engenharia Serviços',
    subsetores: [
      'Reformas, edificações e demolição',
      'Saneamento, esgoto, dutos, rede de distribuição de água, rede de gás',
      'Pavimentação, drenagem',
      'Muro de arrimo, contenções',
      'Pontes, obras de arte, viadutos, túneis, passarelas',
      'Serviços de terraplanagem',
      'Poços tubulares, artesianos, perfuratriz, mineração, escavação',
      'Elétrica, redes, isolação, serviços',
      'Portos, aeroportos',
      'Supervisão de obras',
      'Projetos de engenharia e arquitetura, maquetes',
      'Sinalização viária',
      'Sinalização semafórica, controle do trânsito, radares'
    ]
  },
  {
    setor: 'Equipamentos Ferramentas',
    subsetores: [
      'Balanças',
      'Ferramentas e bancadas',
      'Agrícolas, implementos',
      'Máquinas pesadas e equipamentos de construção',
      'Medição em geral',
      'Hidráulicos, compressores e motores, bombas e outros',
      'Hidrômetros',
      'Energia: geradores, transformadores, painéis e outros',
      'Empilhadeiras, pallets'
    ]
  },
  {
    setor: 'Escritório e Grafica',
    subsetores: [
      'Materiais de escritório, expediente, papéis, formulários',
      'Equipamentos para escritórios, máquinas ( fac-símile, mimeógrafo, franqueadora, guilhotina, fragmentadora, contadores, escrever e calcular e outros)',
      'Copiadora, reprografia, encadernação, leitora, , duplicador, plastificação',
      'Serviços gráficos, impressos e edições',
      'Máquinas e materiais gráficos, serrilhadora, blocadora, envelopadora, contadora de cédulas e outros',
      'Microfilmagem, arquivamento, gerenciamento eletrônico de documentos (GED), digitalização, biblioteconomia',
      'Carimbos, chaves'
    ]
  },
  {
    setor: 'Especializados',
    subsetores: [
      'Satélite, sinais, sistema de posicionamento global, rastreamento, radar aéreo controlador de vôo, sistema de navegação aérea, controle de espaço aéreo',
      'Serviços técnicos, topográficos, sondagens, fundações, levantamentos estudos, saneamento ambiental, georreferenciados, inspeções',
      'Isolação térmica e acústica',
      'Caldeiraria, gerador de vapor, trocador de calor',
      'Usinagem, tornearia, peças sob desenho, mecânica industrial',
      'Meteorologia',
      'Cabines Sanitárias, banheiros químicos',
      'Câmaras frigoríficas, cozinha industrial, lavanderia, limpeza e outros',
      'Irrigação, hidrologia',
      'Tratamento de água, análises de água',
      'Blindagem'
    ]
  },
  {
    setor: 'ESPORTIVOS/MUSICAS',
    subsetores: [
      'Equipamentos e materiais esportivos, instrumentos musicais, artes'
    ]
  },
  {
    setor: 'Eventos',
    subsetores: [
      'Organização de eventos',
      'Cobertura e material fotográfico, filmagem',
      'Sonorização',
      'Iluminação'
    ]
  },
  {
    setor: 'Ferroviários',
    subsetores: [
      'Serviços, peças e equipamentos'
    ]
  },
  {
    setor: 'Funeraria',
    subsetores: [
      'Urnas, funerários, artigos religiosos'
    ]
  },
  {
    setor: 'HOSPEDAGEM',
    subsetores: [
      'Hotelaria'
    ]
  },
  {
    setor: 'Infância/playground',
    subsetores: [
      'Brinquedos, material infantil, playground'
    ]
  },
  {
    setor: 'Informatica',
    subsetores: [
      'Softwares, sistemas, serviços de rede, serviços técnicos',
      'Equipamentos e periféricos, compra, instalação e locação',
      'Manutenção de equipamentos de informática',
      'Suprimentos, formulários',
      'Sistema URA, correio de voz e outros',
      'Relógio de ponto e controle de acesso'
    ]
  },
  {
    setor: 'Instalações',
    subsetores: [
      'Manutenção predial, hidráulica, hidro-sanitárias, elétrica, pisos, pintura, telhados',
      'Impermeabilização, fachadas',
      'Estrutura metálica, andaimes, palco, arquibancadas, abrigos, toldos',
      'Ar condicionado, limpeza de dutos',
      'Elevadores, monta carga, escadas rolantes, esteiras transportadoras',
      'Vidraçaria, marcenaria, serralheria',
      'Divisórias',
      'Segurança: alarme, portas especiais, cofres, circuito de TV (CFTV), catracas, detector de metais, raio-x de bagagem',
      'Telecomunicações, sistemas, cabos, telefones, rádio-chamada, transceptores',
      'Equipamentos e material contra-incêndio e serviços',
      'Pára-raios'
    ]
  },
  {
    setor: 'Leiloes',
    subsetores: [
      'Transportes - veículos, aeronaves, embarcações, carros, utilitários, caminhões, motos, barcos, navios, helicópteros, aviões e suas respectivas peças',
      'Imóveis - casas, terrenos, lotes, glebas, apartamentos, prédios, salas comerciais',
      'Eletrodomésticos, eletro-eletrônicos, reprográficos, equip. informática, ar-condicionado, equip. segurança eletrônica, painéis eletrônicos, extintores, pára-raios, etc.',
      'Materiais de construção, saneamento, hidráulicos, elétricos, sinalização',
      'Máquinas, equipamentos e ferramentas: industriais, de engenharia (pesados), irrigação',
      'Livros, jóias, publicações, perfumes, obras de arte, títulos e ações. Ver observação',
      'Petrobrás e Ferroviário',
      'Inservíveis e Sucatas',
      'Animais, materiais e equipamentos agropecuários, veterinários, inseticidas',
      'Produtos químicos e seus derivados, gases, resíduos, combustíveis e seus derivados',
      'Alimentícios e bebidas',
      'Equipamentos, materiais e instrumentais: médicos, laboratoriais, medicamentos e balanças',
      'Materiais de escritório, didáticos, informática, utensílios domésticos, embalagens, limpeza, cosméticos',
      'Móveis em geral',
      'Confecções, malas, calçados, tecidos, esportivos, brinquedos, segurança',
      'Funerários'
    ]
  },
  {
    setor: 'Mobiliários',
    subsetores: [
      'Escritório',
      'Arquivo deslizante',
      'Médico, laboratorial, cadeira de rodas',
      'Escolar',
      'Quarto, sala, cozinha, clubes/lazer'
    ]
  },
  {
    setor: 'Passagens',
    subsetores: [
      'Agenciamento de passagens aéreas, marítimas e terrestres'
    ]
  },
  {
    setor: 'Petrobras',
    subsetores: [
      'Serviços, peças e equipamentos'
    ]
  },
  {
    setor: 'Prestação de serviço: Mão de obra',
    subsetores: [
      'Limpeza, conservação, predial, hospitalar e higienização',
      'Paisagismo, jardinagem, plantio, cortes e podas',
      'Coleta de lixo e limpeza urbana',
      'Incineração, tratamento de resíduos sólidos',
      'Lavagem de roupa',
      'Limpeza de galerias, dutos, dragagem, desassoreamento',
      'Cercamento e alambrado',
      'Leitura de hidrômetros, de energia elétrica e gás, coletor de dados',
      'Recursos humanos: ascensorista, copa, porteiro, telefonista e outros',
      'Serviços de vigilância, armada e desarmada',
      'Serviços de digitação',
      'Administração de creches e hospitalar',
      'Manuseio, tratamento de documentos, distribuição e entrega',
      'Estágio, estagiários'
    ]
  },
  {
    setor: 'Produtos de limpeza',
    subsetores: [
      'Produtos de higiene, limpeza e higiene pessoal'
    ]
  },
  {
    setor: 'Publicidade',
    subsetores: [
      'Propaganda, assessoria de imprensa',
      'Brindes, medalhas, troféus, brasões, distintivos',
      'Publicações, divulgação, clipping, radiodifusão, assinaturas',
      'Exploração de espaço publicitário'
    ]
  },
  {
    setor: 'Saude',
    subsetores: [
      'Medicamentos',
      'Materiais, produtos e utensílios médico, hospitalar e laboratorial',
      'Equipamentos e instrumentos, hospitalares, laboratoriais e científicos',
      'Serviços: engenharia clínica, exame médico ocupacional, admissional, serviços médicos e análises laboratoriais',
      'Gases',
      'Filmes, raio -x, radiológicos',
      'Dieta enteral e parenteral'
    ]
  },
  {
    setor: 'Segurança / Proteção',
    subsetores: [
      'Equipamentos e produtos de proteção individual',
      'Armas, munições, bélicos e explosivos'
    ]
  },
  {
    setor: 'Seguros',
    subsetores: [
      'Seguros',
      'Assistência Médica'
    ]
  },
  {
    setor: 'Sistema de vales',
    subsetores: [
      'Refeição, combustível, transporte'
    ]
  },
  {
    setor: 'Transporte aéreo',
    subsetores: [
      'Aquisição, locação, manutenção e peças para aviões, helicópteros e equipamentos aéreos, transporte internacional'
    ]
  },
  {
    setor: 'Transportes náuticos',
    subsetores: [
      'Aquisição, locação, manutenção e peças de equipamentos náuticos, transporte marítimo/fluvial',
      'Docagem',
      'Balsas'
    ]
  },
  {
    setor: 'Transporte rodoviários',
    subsetores: [
      'Aquisição de veículos, caminhões, ônibus, ambulâncias, motos',
      'Serviços de locação de veículos, motos',
      'Serviços de moto-boy e transporte: passageiros, documentos',
      'Serviços de transportes de valores',
      'Manutenção, peças e pneus, veículos, caminhões, ônibus, ambulâncias, motos',
      'Carroceria, guinchos, guindastes',
      'Aquisição/serviços de caminhão pipa',
      'Transporte de cargas: terrestre/aéreo/marítimo'
    ]
  }
]

/**
 * Estados brasileiros organizados por região
 */
export const ESTADOS_POR_REGIAO = {
  'Nacional': ['Nacional'],
  'Centro-Oeste': [
    { sigla: 'DF', nome: 'Distrito Federal' },
    { sigla: 'GO', nome: 'Goiás' },
    { sigla: 'MS', nome: 'Mato Grosso do Sul' },
    { sigla: 'MT', nome: 'Mato Grosso' }
  ],
  'Nordeste': [
    { sigla: 'AL', nome: 'Alagoas' },
    { sigla: 'BA', nome: 'Bahia' },
    { sigla: 'CE', nome: 'Ceará' },
    { sigla: 'MA', nome: 'Maranhão' },
    { sigla: 'PB', nome: 'Paraíba' },
    { sigla: 'PE', nome: 'Pernambuco' },
    { sigla: 'PI', nome: 'Piauí' },
    { sigla: 'RN', nome: 'Rio Grande do Norte' },
    { sigla: 'SE', nome: 'Sergipe' }
  ],
  'Norte': [
    { sigla: 'AC', nome: 'Acre' },
    { sigla: 'AM', nome: 'Amazonas' },
    { sigla: 'AP', nome: 'Amapá' },
    { sigla: 'PA', nome: 'Pará' },
    { sigla: 'RO', nome: 'Rondônia' },
    { sigla: 'RR', nome: 'Roraima' },
    { sigla: 'TO', nome: 'Tocantins' }
  ],
  'Sudeste': [
    { sigla: 'ES', nome: 'Espírito Santo' },
    { sigla: 'MG', nome: 'Minas Gerais' },
    { sigla: 'RJ', nome: 'Rio de Janeiro' },
    { sigla: 'SP', nome: 'São Paulo' }
  ],
  'Sul': [
    { sigla: 'PR', nome: 'Paraná' },
    { sigla: 'RS', nome: 'Rio Grande do Sul' },
    { sigla: 'SC', nome: 'Santa Catarina' }
  ]
}

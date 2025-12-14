    -- Script para popular as tabelas de setores e subsetores com dados iniciais
    -- Baseado no arquivo Setores.txt

    -- Inserir Setores Principais
    INSERT INTO public.setores (nome, ordem) VALUES
    ('Agropecuaria', 1),
    ('Alimentação', 2),
    ('Armazenagem', 3),
    ('Assessorias', 4),
    ('Cartões', 5),
    ('Combustiveis', 6),
    ('Comunicação/Identificação visual', 7),
    ('Conssecoes / exploração / imovel', 8),
    ('Confecções / Decoração', 9),
    ('Didatico', 10),
    ('Eletro Eletronicos/Otica', 11),
    ('Embalagens e lacres', 12),
    ('Engenharia - Materiais', 13),
    ('Engenharia Serviços', 14),
    ('Equipamentos Ferramentas', 15),
    ('Escritório e Grafica', 16),
    ('Especializados', 17),
    ('ESPORTIVOS/MUSICAS', 18),
    ('Eventos', 19),
    ('Ferroviários', 20),
    ('Funeraria', 21),
    ('HOSPEDAGEM', 22),
    ('Infância/playground', 23),
    ('Informatica', 24),
    ('Instalações', 25),
    ('Leiloes', 26),
    ('Mobiliários', 27),
    ('Passagens', 28),
    ('Petrobras', 29),
    ('Prestação de serviço: Mão de obra', 30),
    ('Produtos de limpeza', 31),
    ('Publicidade', 32),
    ('Saude', 33),
    ('Segurança / Proteção', 34),
    ('Seguros', 35),
    ('Sistema de vales', 36),
    ('Transporte aéreo', 37),
    ('Transportes náuticos', 38),
    ('Transporte rodoviários', 39)
    ON CONFLICT (nome) DO NOTHING;

    -- Inserir Subsetores para cada Setor
    -- Agropecuaria
    INSERT INTO public.subsetores (setor_id, nome, ordem)
    SELECT s.id, unnest(ARRAY[
    'Veterinária e vacinas',
    'rações para animais',
    'animais',
    'mudas, sementes e outros produtos agrícolas',
    'inseticida, herbicida e outros'
    ]), generate_series(1, 5)
    FROM public.setores s WHERE s.nome = 'Agropecuaria';

    -- Alimentação
    INSERT INTO public.subsetores (setor_id, nome, ordem)
    SELECT s.id, unnest(ARRAY[
    'Gêneros alimentícios',
    'Cesta básica',
    'Fornecimento de alimentação, copa, buffet e café',
    'água, bebidas'
    ]), generate_series(1, 4)
    FROM public.setores s WHERE s.nome = 'Alimentação';

    -- Armazenagem
    INSERT INTO public.subsetores (setor_id, nome, ordem)
    SELECT s.id, unnest(ARRAY[
    'Silos, depósitos, armazéns',
    'Tanques, reservatórios, caixa d''água',
    'Movimentação de cargas',
    'Container',
    'Carrinhos em geral, rodízios'
    ]), generate_series(1, 5)
    FROM public.setores s WHERE s.nome = 'Armazenagem';

    -- Assessorias
    INSERT INTO public.subsetores (setor_id, nome, ordem)
    SELECT s.id, unnest(ARRAY[
    'Consultoria, Assessorias técnicas e de apoio, cobranças',
    'Auditoria Independente',
    'Despachantes, aduaneiros',
    'Tradução, revisão ortográfica',
    'Telemarketing',
    'Cursos',
    'Concurso Público',
    'Pesquisa de opinião pública'
    ]), generate_series(1, 8)
    FROM public.setores s WHERE s.nome = 'Assessorias';

    -- Cartões
    INSERT INTO public.subsetores (setor_id, nome, ordem)
    SELECT s.id, 'Magnético, pvc, crachá e outros', 1
    FROM public.setores s WHERE s.nome = 'Cartões';

    -- Combustiveis
    INSERT INTO public.subsetores (setor_id, nome, ordem)
    SELECT s.id, unnest(ARRAY[
    'GLP - botijões',
    'Combustíveis e Lubrificantes'
    ]), generate_series(1, 2)
    FROM public.setores s WHERE s.nome = 'Combustiveis';

    -- Comunicação/Identificação visual
    INSERT INTO public.subsetores (setor_id, nome, ordem)
    SELECT s.id, 'Painéis, luminosos, faixas, displays, plaqueta patrimonial', 1
    FROM public.setores s WHERE s.nome = 'Comunicação/Identificação visual';

    -- Conssecoes / exploração / imovel
    INSERT INTO public.subsetores (setor_id, nome, ordem)
    SELECT s.id, unnest(ARRAY[
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
    ]), generate_series(1, 11)
    FROM public.setores s WHERE s.nome = 'Conssecoes / exploração / imovel';

    -- Confecções / Decoração
    INSERT INTO public.subsetores (setor_id, nome, ordem)
    SELECT s.id, unnest(ARRAY[
    'Uniformes e confecções em geral',
    'Aviamentos',
    'Cama, mesa e banho',
    'Tecidos',
    'Calçados',
    'Tapeçaria, persianas, cortinas e decoração',
    'Malas, malotes e encerados'
    ]), generate_series(1, 7)
    FROM public.setores s WHERE s.nome = 'Confecções / Decoração';

    -- Didatico
    INSERT INTO public.subsetores (setor_id, nome, ordem)
    SELECT s.id, 'Livros e material didático', 1
    FROM public.setores s WHERE s.nome = 'Didatico';

    -- Eletro Eletronicos/Otica
    INSERT INTO public.subsetores (setor_id, nome, ordem)
    SELECT s.id, unnest(ARRAY[
    'Cine, som, ótica, TV e projetores',
    'Eletrodomésticos, ventilador, bebedouro',
    'Exaustor e exaustão'
    ]), generate_series(1, 3)
    FROM public.setores s WHERE s.nome = 'Eletro Eletronicos/Otica';

    -- Embalagens e lacres
    INSERT INTO public.subsetores (setor_id, nome, ordem)
    SELECT s.id, unnest(ARRAY[
    'Embalagens e lacres em geral',
    'Utensílios de copa e cozinha'
    ]), generate_series(1, 2)
    FROM public.setores s WHERE s.nome = 'Embalagens e lacres';

    -- Engenharia - Materiais
    INSERT INTO public.subsetores (setor_id, nome, ordem)
    SELECT s.id, unnest(ARRAY[
    'Construção, madeiras',
    'Hidráulicos, saneamento',
    'Asfálticos, concreto',
    'Elétricos',
    'Material de Sinalização'
    ]), generate_series(1, 5)
    FROM public.setores s WHERE s.nome = 'Engenharia - Materiais';

    -- Engenharia Serviços
    INSERT INTO public.subsetores (setor_id, nome, ordem)
    SELECT s.id, unnest(ARRAY[
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
    ]), generate_series(1, 13)
    FROM public.setores s WHERE s.nome = 'Engenharia Serviços';

    -- Equipamentos Ferramentas
    INSERT INTO public.subsetores (setor_id, nome, ordem)
    SELECT s.id, unnest(ARRAY[
    'Balanças',
    'Ferramentas e bancadas',
    'Agrícolas, implementos',
    'Máquinas pesadas e equipamentos de construção',
    'Medição em geral',
    'Hidráulicos, compressores e motores, bombas e outros',
    'Hidrômetros',
    'Energia: geradores, transformadores, painéis e outros',
    'Empilhadeiras, pallets'
    ]), generate_series(1, 9)
    FROM public.setores s WHERE s.nome = 'Equipamentos Ferramentas';

    -- Escritório e Grafica
    INSERT INTO public.subsetores (setor_id, nome, ordem)
    SELECT s.id, unnest(ARRAY[
    'Materiais de escritório, expediente, papéis, formulários',
    'Equipamentos para escritórios, máquinas ( fac-símile, mimeógrafo, franqueadora, guilhotina, fragmentadora, contadores, escrever e calcular e outros)',
    'Copiadora, reprografia, encadernação, leitora, , duplicador, plastificação',
    'Serviços gráficos, impressos e edições',
    'Máquinas e materiais gráficos, serrilhadora, blocadora, envelopadora, contadora de cédulas e outros',
    'Microfilmagem, arquivamento, gerenciamento eletrônico de documentos (GED), digitalização, biblioteconomia',
    'Carimbos, chaves'
    ]), generate_series(1, 7)
    FROM public.setores s WHERE s.nome = 'Escritório e Grafica';

    -- Especializados
    INSERT INTO public.subsetores (setor_id, nome, ordem)
    SELECT s.id, unnest(ARRAY[
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
    ]), generate_series(1, 11)
    FROM public.setores s WHERE s.nome = 'Especializados';

    -- ESPORTIVOS/MUSICAS
    INSERT INTO public.subsetores (setor_id, nome, ordem)
    SELECT s.id, 'Equipamentos e materiais esportivos, instrumentos musicais, artes', 1
    FROM public.setores s WHERE s.nome = 'ESPORTIVOS/MUSICAS';

    -- Eventos
    INSERT INTO public.subsetores (setor_id, nome, ordem)
    SELECT s.id, unnest(ARRAY[
    'Organização de eventos',
    'Cobertura e material fotográfico, filmagem',
    'Sonorização',
    'Iluminação'
    ]), generate_series(1, 4)
    FROM public.setores s WHERE s.nome = 'Eventos';

    -- Ferroviários
    INSERT INTO public.subsetores (setor_id, nome, ordem)
    SELECT s.id, 'Serviços, peças e equipamentos', 1
    FROM public.setores s WHERE s.nome = 'Ferroviários';

    -- Funeraria
    INSERT INTO public.subsetores (setor_id, nome, ordem)
    SELECT s.id, 'Urnas, funerários, artigos religiosos', 1
    FROM public.setores s WHERE s.nome = 'Funeraria';

    -- HOSPEDAGEM
    INSERT INTO public.subsetores (setor_id, nome, ordem)
    SELECT s.id, 'Hotelaria', 1
    FROM public.setores s WHERE s.nome = 'HOSPEDAGEM';

    -- Infância/playground
    INSERT INTO public.subsetores (setor_id, nome, ordem)
    SELECT s.id, 'Brinquedos, material infantil, playground', 1
    FROM public.setores s WHERE s.nome = 'Infância/playground';

    -- Informatica
    INSERT INTO public.subsetores (setor_id, nome, ordem)
    SELECT s.id, unnest(ARRAY[
    'Softwares, sistemas, serviços de rede, serviços técnicos',
    'Equipamentos e periféricos, compra, instalação e locação',
    'Manutenção de equipamentos de informática',
    'Suprimentos, formulários',
    'Sistema URA, correio de voz e outros',
    'Relógio de ponto e controle de acesso'
    ]), generate_series(1, 6)
    FROM public.setores s WHERE s.nome = 'Informatica';

    -- Instalações
    INSERT INTO public.subsetores (setor_id, nome, ordem)
    SELECT s.id, unnest(ARRAY[
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
    ]), generate_series(1, 11)
    FROM public.setores s WHERE s.nome = 'Instalações';

    -- Leiloes
    INSERT INTO public.subsetores (setor_id, nome, ordem)
    SELECT s.id, unnest(ARRAY[
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
    ]), generate_series(1, 16)
    FROM public.setores s WHERE s.nome = 'Leiloes';

    -- Mobiliários
    INSERT INTO public.subsetores (setor_id, nome, ordem)
    SELECT s.id, unnest(ARRAY[
    'Escritório',
    'Arquivo deslizante',
    'Médico, laboratorial, cadeira de rodas',
    'Escolar',
    'Quarto, sala, cozinha, clubes/lazer'
    ]), generate_series(1, 5)
    FROM public.setores s WHERE s.nome = 'Mobiliários';

    -- Passagens
    INSERT INTO public.subsetores (setor_id, nome, ordem)
    SELECT s.id, 'Agenciamento de passagens aéreas, marítimas e terrestres', 1
    FROM public.setores s WHERE s.nome = 'Passagens';

    -- Petrobras
    INSERT INTO public.subsetores (setor_id, nome, ordem)
    SELECT s.id, 'Serviços, peças e equipamentos', 1
    FROM public.setores s WHERE s.nome = 'Petrobras';

    -- Prestação de serviço: Mão de obra
    INSERT INTO public.subsetores (setor_id, nome, ordem)
    SELECT s.id, unnest(ARRAY[
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
    ]), generate_series(1, 14)
    FROM public.setores s WHERE s.nome = 'Prestação de serviço: Mão de obra';

    -- Produtos de limpeza
    INSERT INTO public.subsetores (setor_id, nome, ordem)
    SELECT s.id, 'Produtos de higiene, limpeza e higiene pessoal', 1
    FROM public.setores s WHERE s.nome = 'Produtos de limpeza';

    -- Publicidade
    INSERT INTO public.subsetores (setor_id, nome, ordem)
    SELECT s.id, unnest(ARRAY[
    'Propaganda, assessoria de imprensa',
    'Brindes, medalhas, troféus, brasões, distintivos',
    'Publicações, divulgação, clipping, radiodifusão, assinaturas',
    'Exploração de espaço publicitário'
    ]), generate_series(1, 4)
    FROM public.setores s WHERE s.nome = 'Publicidade';

    -- Saude
    INSERT INTO public.subsetores (setor_id, nome, ordem)
    SELECT s.id, unnest(ARRAY[
    'Medicamentos',
    'Materiais, produtos e utensílios médico, hospitalar e laboratorial',
    'Equipamentos e instrumentos, hospitalares, laboratoriais e científicos',
    'Serviços: engenharia clínica, exame médico ocupacional, admissional, serviços médicos e análises laboratoriais',
    'Gases',
    'Filmes, raio -x, radiológicos',
    'Dieta enteral e parenteral'
    ]), generate_series(1, 7)
    FROM public.setores s WHERE s.nome = 'Saude';

    -- Segurança / Proteção
    INSERT INTO public.subsetores (setor_id, nome, ordem)
    SELECT s.id, unnest(ARRAY[
    'Equipamentos e produtos de proteção individual',
    'Armas, munições, bélicos e explosivos'
    ]), generate_series(1, 2)
    FROM public.setores s WHERE s.nome = 'Segurança / Proteção';

    -- Seguros
    INSERT INTO public.subsetores (setor_id, nome, ordem)
    SELECT s.id, unnest(ARRAY[
    'Seguros',
    'Assistência Médica'
    ]), generate_series(1, 2)
    FROM public.setores s WHERE s.nome = 'Seguros';

    -- Sistema de vales
    INSERT INTO public.subsetores (setor_id, nome, ordem)
    SELECT s.id, unnest(ARRAY[
    'Refeição, combustível, transporte'
    ]), generate_series(1, 1)
    FROM public.setores s WHERE s.nome = 'Sistema de vales';

    -- Transporte aéreo
    INSERT INTO public.subsetores (setor_id, nome, ordem)
    SELECT s.id, 'Aquisição, locação, manutenção e peças para aviões, helicópteros e equipamentos aéreos, transporte internacional', 1
    FROM public.setores s WHERE s.nome = 'Transporte aéreo';

    -- Transportes náuticos
    INSERT INTO public.subsetores (setor_id, nome, ordem)
    SELECT s.id, unnest(ARRAY[
    'Aquisição, locação, manutenção e peças de equipamentos náuticos, transporte marítimo/fluvial',
    'Docagem',
    'Balsas'
    ]), generate_series(1, 3)
    FROM public.setores s WHERE s.nome = 'Transportes náuticos';

    -- Transporte rodoviários
    INSERT INTO public.subsetores (setor_id, nome, ordem)
    SELECT s.id, unnest(ARRAY[
    'Aquisição de veículos, caminhões, ônibus, ambulâncias, motos',
    'Serviços de locação de veículos, motos',
    'Serviços de moto-boy e transporte: passageiros, documentos',
    'Serviços de transportes de valores',
    'Manutenção, peças e pneus, veículos, caminhões, ônibus, ambulâncias, motos',
    'Carroceria, guinchos, guindastes',
    'Aquisição/serviços de caminhão pipa',
    'Transporte de cargas: terrestre/aéreo/marítimo'
    ]), generate_series(1, 8)
    FROM public.setores s WHERE s.nome = 'Transporte rodoviários';


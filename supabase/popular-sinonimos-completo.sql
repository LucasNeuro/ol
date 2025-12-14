-- Popular tabela de sinônimos com lista COMPLETA e EXPANDIDA
-- Este script substitui o popular-sinonimos-inicial.sql com muito mais termos
-- Execute este script após criar a tabela sinonimos

-- Limpar dados existentes (opcional - descomente se quiser recomeçar)
-- DELETE FROM public.sinonimos;

-- Sinônimos gerais (aplicam a todos os setores)
-- Formato: (palavra_base, sinonimo, peso)
-- Peso: 1-10 (10 = mais relevante, 1 = menos relevante)

INSERT INTO public.sinonimos (palavra_base, sinonimo, peso, ativo) VALUES
-- ============================================
-- CONSTRUÇÃO E ENGENHARIA (Setor Principal)
-- ============================================
('construção', 'construcao', 10, true),
('construção', 'obra', 10, true),
('construção', 'edificação', 10, true),
('construção', 'edificacao', 10, true),
('construção', 'reforma', 9, true),
('construção', 'reformas', 9, true),
('construção', 'construir', 8, true),
('construção', 'construção civil', 10, true),
('construção', 'obras públicas', 10, true),
('construção', 'obras publicas', 10, true),
('construção', 'construção de edifícios', 10, true),
('construção', 'construção de edificios', 10, true),
('construção', 'construção predial', 9, true),
('construção', 'construção residencial', 9, true),
('construção', 'construção comercial', 9, true),
('construção', 'construção industrial', 9, true),
('construção', 'construção de infraestrutura', 10, true),
('construção', 'construção de infraestrutura', 10, true),
('construção', 'execução de obras', 9, true),
('construção', 'execucao de obras', 9, true),
('construção', 'realização de obras', 9, true),
('construção', 'realizacao de obras', 9, true),

('engenharia', 'engenheiro', 10, true),
('engenharia', 'engenharia', 10, true),
('engenharia', 'projeto', 9, true),
('engenharia', 'projetos', 9, true),
('engenharia', 'projetar', 8, true),
('engenharia', 'projetista', 9, true),
('engenharia', 'engenharia civil', 10, true),
('engenharia', 'engenharia estrutural', 10, true),
('engenharia', 'engenharia de obras', 10, true),
('engenharia', 'engenharia de construção', 10, true),
('engenharia', 'engenharia de construcao', 10, true),
('engenharia', 'engenharia arquitetônica', 9, true),
('engenharia', 'engenharia arquitetonica', 9, true),
('engenharia', 'engenharia de infraestrutura', 10, true),
('engenharia', 'engenharia de infraestrutura', 10, true),
('engenharia', 'projeto de engenharia', 10, true),
('engenharia', 'projetos de engenharia', 10, true),
('engenharia', 'projeto estrutural', 9, true),
('engenharia', 'projeto arquitetônico', 9, true),
('engenharia', 'projeto arquitetonico', 9, true),
('engenharia', 'projeto executivo', 9, true),
('engenharia', 'projeto básico', 8, true),
('engenharia', 'projeto basico', 8, true),

-- ============================================
-- SERVIÇOS E PRESTAÇÃO
-- ============================================
('serviço', 'servico', 10, true),
('serviço', 'servicos', 10, true),
('serviço', 'prestação', 9, true),
('serviço', 'prestacao', 9, true),
('serviço', 'prestar', 8, true),
('serviço', 'atendimento', 7, true),
('serviço', 'assistência', 7, true),
('serviço', 'assistencia', 7, true),
('serviço', 'execução', 8, true),
('serviço', 'execucao', 8, true),
('serviço', 'realização', 8, true),
('serviço', 'realizacao', 8, true),
('serviço', 'fornecimento de serviço', 9, true),
('serviço', 'fornecimento de servico', 9, true),

-- ============================================
-- MATERIAIS E EQUIPAMENTOS
-- ============================================
('material', 'materiais', 10, true),
('material', 'equipamento', 9, true),
('material', 'equipamentos', 9, true),
('material', 'fornecimento', 9, true),
('material', 'fornecer', 8, true),
('material', 'suprimento', 8, true),
('material', 'insumo', 8, true),
('material', 'insumos', 8, true),
('material', 'fornecimento de material', 10, true),
('material', 'fornecimento de materiais', 10, true),
('material', 'fornecimento de equipamentos', 10, true),
('material', 'aquisição de material', 9, true),
('material', 'aquisicao de material', 9, true),
('material', 'compra de material', 9, true),
('material', 'compra de materiais', 9, true),
('material', 'compra de equipamentos', 9, true),

-- ============================================
-- LIMPEZA E CONSERVAÇÃO
-- ============================================
('limpeza', 'limpeza', 10, true),
('limpeza', 'higienização', 9, true),
('limpeza', 'higienizacao', 9, true),
('limpeza', 'assepsia', 8, true),
('limpeza', 'limpar', 8, true),
('limpeza', 'faxina', 8, true),
('limpeza', 'conservação', 8, true),
('limpeza', 'conservacao', 8, true),
('limpeza', 'limpeza predial', 9, true),
('limpeza', 'limpeza de prédios', 9, true),
('limpeza', 'limpeza de predios', 9, true),
('limpeza', 'limpeza de edifícios', 9, true),
('limpeza', 'limpeza de edificios', 9, true),
('limpeza', 'limpeza de escritórios', 8, true),
('limpeza', 'limpeza de escritorios', 8, true),
('limpeza', 'limpeza de áreas comuns', 8, true),
('limpeza', 'limpeza de areas comuns', 8, true),
('limpeza', 'serviço de limpeza', 9, true),
('limpeza', 'servico de limpeza', 9, true),
('limpeza', 'prestação de serviço de limpeza', 9, true),
('limpeza', 'prestacao de servico de limpeza', 9, true),

-- ============================================
-- PAVIMENTAÇÃO E ASFALTO
-- ============================================
('pavimentação', 'pavimentacao', 10, true),
('pavimentação', 'pavimentação', 10, true),
('pavimentação', 'asfalto', 10, true),
('pavimentação', 'asfaltamento', 10, true),
('pavimentação', 'asfaltar', 9, true),
('pavimentação', 'calçamento', 9, true),
('pavimentação', 'calcamento', 9, true),
('pavimentação', 'pavimento', 9, true),
('pavimentação', 'pavimentação de vias', 10, true),
('pavimentação', 'pavimentacao de vias', 10, true),
('pavimentação', 'pavimentação de ruas', 10, true),
('pavimentação', 'pavimentacao de ruas', 10, true),
('pavimentação', 'pavimentação de estradas', 10, true),
('pavimentação', 'pavimentacao de estradas', 10, true),
('pavimentação', 'asfaltamento de vias', 10, true),
('pavimentação', 'asfaltamento de ruas', 10, true),
('pavimentação', 'asfaltamento de estradas', 10, true),
('pavimentação', 'recapeamento', 9, true),
('pavimentação', 'recapeamento asfáltico', 9, true),
('pavimentação', 'recapeamento asfaltico', 9, true),

-- ============================================
-- SANEAMENTO E ÁGUA
-- ============================================
('saneamento', 'saneamento', 10, true),
('saneamento', 'esgoto', 10, true),
('saneamento', 'água', 9, true),
('saneamento', 'agua', 9, true),
('saneamento', 'drenagem', 9, true),
('saneamento', 'drenar', 8, true),
('saneamento', 'sistema de água', 9, true),
('saneamento', 'sistema de agua', 9, true),
('saneamento', 'abastecimento', 9, true),
('saneamento', 'abastecimento de água', 10, true),
('saneamento', 'abastecimento de agua', 10, true),
('saneamento', 'sistema de esgoto', 10, true),
('saneamento', 'rede de esgoto', 10, true),
('saneamento', 'rede de água', 9, true),
('saneamento', 'rede de agua', 9, true),
('saneamento', 'saneamento básico', 10, true),
('saneamento', 'saneamento basico', 10, true),
('saneamento', 'tratamento de esgoto', 10, true),
('saneamento', 'tratamento de água', 9, true),
('saneamento', 'tratamento de agua', 9, true),
('saneamento', 'estação de tratamento', 9, true),
('saneamento', 'estacao de tratamento', 9, true),
('saneamento', 'eta', 8, true),
('saneamento', 'ete', 8, true),
('saneamento', 'drenagem pluvial', 9, true),
('saneamento', 'drenagem urbana', 9, true),

-- ============================================
-- ELÉTRICA E ENERGIA
-- ============================================
('elétrica', 'eletrica', 10, true),
('elétrica', 'elétrica', 10, true),
('elétrica', 'energia', 9, true),
('elétrica', 'elétrico', 9, true),
('elétrica', 'eletrico', 9, true),
('elétrica', 'eletricidade', 9, true),
('elétrica', 'instalação elétrica', 10, true),
('elétrica', 'instalacao eletrica', 10, true),
('elétrica', 'instalações elétricas', 10, true),
('elétrica', 'instalacoes eletricas', 10, true),
('elétrica', 'sistema elétrico', 9, true),
('elétrica', 'sistema eletrico', 9, true),
('elétrica', 'rede elétrica', 9, true),
('elétrica', 'rede eletrica', 9, true),
('elétrica', 'fiação elétrica', 9, true),
('elétrica', 'fiacao eletrica', 9, true),
('elétrica', 'elétrica predial', 9, true),
('elétrica', 'eletrica predial', 9, true),
('elétrica', 'elétrica residencial', 8, true),
('elétrica', 'eletrica residencial', 8, true),
('elétrica', 'elétrica industrial', 9, true),
('elétrica', 'eletrica industrial', 9, true),
('elétrica', 'energia elétrica', 9, true),
('elétrica', 'energia eletrica', 9, true),
('elétrica', 'fornecimento de energia', 9, true),

-- ============================================
-- MANUTENÇÃO E REPAROS
-- ============================================
('manutenção', 'manutencao', 10, true),
('manutenção', 'manutenção', 10, true),
('manutenção', 'manter', 8, true),
('manutenção', 'conservar', 8, true),
('manutenção', 'reparo', 9, true),
('manutenção', 'reparos', 9, true),
('manutenção', 'conserto', 9, true),
('manutenção', 'consertos', 9, true),
('manutenção', 'manutenção preventiva', 9, true),
('manutenção', 'manutencao preventiva', 9, true),
('manutenção', 'manutenção corretiva', 9, true),
('manutenção', 'manutencao corretiva', 9, true),
('manutenção', 'manutenção predial', 9, true),
('manutenção', 'manutencao predial', 9, true),
('manutenção', 'manutenção de equipamentos', 9, true),
('manutenção', 'manutencao de equipamentos', 9, true),
('manutenção', 'manutenção de instalações', 9, true),
('manutenção', 'manutencao de instalacoes', 9, true),
('manutenção', 'serviço de manutenção', 9, true),
('manutenção', 'servico de manutencao', 9, true),

-- ============================================
-- INSTALAÇÃO E MONTAGEM
-- ============================================
('instalação', 'instalacao', 10, true),
('instalação', 'instalação', 10, true),
('instalação', 'instalar', 9, true),
('instalação', 'montagem', 9, true),
('instalação', 'montar', 8, true),
('instalação', 'colocação', 8, true),
('instalação', 'colocacao', 8, true),
('instalação', 'instalação de equipamentos', 10, true),
('instalação', 'instalacao de equipamentos', 10, true),
('instalação', 'instalação de sistemas', 9, true),
('instalação', 'instalacao de sistemas', 9, true),
('instalação', 'montagem de equipamentos', 9, true),
('instalação', 'montagem de estruturas', 9, true),

-- ============================================
-- DEMOLIÇÃO
-- ============================================
('demolição', 'demolicao', 10, true),
('demolição', 'demolição', 10, true),
('demolição', 'demolir', 9, true),
('demolição', 'derrubada', 9, true),
('demolição', 'destruição', 8, true),
('demolição', 'destruicao', 8, true),
('demolição', 'demolição de edifícios', 10, true),
('demolição', 'demolicao de edificios', 10, true),
('demolição', 'demolição de estruturas', 10, true),
('demolição', 'demolicao de estruturas', 10, true),
('demolição', 'demolição controlada', 9, true),
('demolição', 'demolicao controlada', 9, true),

-- ============================================
-- TERAPLANAGEM
-- ============================================
('terraplanagem', 'terraplanagem', 10, true),
('terraplanagem', 'terraplenagem', 10, true),
('terraplanagem', 'nivelamento', 9, true),
('terraplanagem', 'aterro', 9, true),
('terraplanagem', 'aterros', 9, true),
('terraplanagem', 'escavação', 9, true),
('terraplanagem', 'escavacao', 9, true),
('terraplanagem', 'terraplanagem de terrenos', 10, true),
('terraplanagem', 'nivelamento de terreno', 9, true),
('terraplanagem', 'escavação de terreno', 9, true),
('terraplanagem', 'escavacao de terreno', 9, true),
('terraplanagem', 'movimentação de terra', 9, true),
('terraplanagem', 'movimentacao de terra', 9, true),
('terraplanagem', 'corte de terra', 8, true),
('terraplanagem', 'aterro de terra', 8, true),

-- ============================================
-- ALVENARIA
-- ============================================
('alvenaria', 'alvenaria', 10, true),
('alvenaria', 'alvenaria estrutural', 10, true),
('alvenaria', 'tijolo', 9, true),
('alvenaria', 'tijolos', 9, true),
('alvenaria', 'bloco', 9, true),
('alvenaria', 'blocos', 9, true),
('alvenaria', 'masonry', 7, true),
('alvenaria', 'alvenaria de tijolos', 10, true),
('alvenaria', 'alvenaria de blocos', 10, true),
('alvenaria', 'alvenaria de concreto', 9, true),
('alvenaria', 'alvenaria de vedação', 9, true),
('alvenaria', 'alvenaria de vedacao', 9, true),
('alvenaria', 'alvenaria estrutural', 10, true),
('alvenaria', 'execução de alvenaria', 9, true),
('alvenaria', 'execucao de alvenaria', 9, true),

-- ============================================
-- HIDRÁULICA
-- ============================================
('hidráulica', 'hidraulica', 10, true),
('hidráulica', 'hidráulica', 10, true),
('hidráulica', 'hidráulico', 9, true),
('hidráulica', 'hidraulico', 9, true),
('hidráulica', 'encanamento', 10, true),
('hidráulica', 'tubulação', 9, true),
('hidráulica', 'tubulacao', 9, true),
('hidráulica', 'instalação hidráulica', 10, true),
('hidráulica', 'instalacao hidraulica', 10, true),
('hidráulica', 'instalações hidráulicas', 10, true),
('hidráulica', 'instalacoes hidraulicas', 10, true),
('hidráulica', 'sistema hidráulico', 9, true),
('hidráulica', 'sistema hidraulico', 9, true),
('hidráulica', 'rede hidráulica', 9, true),
('hidráulica', 'rede hidraulica', 9, true),
('hidráulica', 'encanamento predial', 9, true),
('hidráulica', 'encanamento residencial', 8, true),
('hidráulica', 'encanamento industrial', 9, true),

-- ============================================
-- PINTURA E REVESTIMENTO
-- ============================================
('pintura', 'pintura', 10, true),
('pintura', 'pintar', 9, true),
('pintura', 'pintor', 8, true),
('pintura', 'tinta', 8, true),
('pintura', 'tintas', 8, true),
('pintura', 'revestimento', 9, true),
('pintura', 'acabamento', 9, true),
('pintura', 'pintura predial', 9, true),
('pintura', 'pintura de edifícios', 9, true),
('pintura', 'pintura de edificios', 9, true),
('pintura', 'pintura de paredes', 9, true),
('pintura', 'pintura externa', 8, true),
('pintura', 'pintura interna', 8, true),
('pintura', 'revestimento de paredes', 9, true),
('pintura', 'acabamento de pintura', 8, true),

-- ============================================
-- CARPINTARIA E MADEIRA
-- ============================================
('carpintaria', 'carpintaria', 10, true),
('carpintaria', 'carpinteiro', 9, true),
('carpintaria', 'madeira', 9, true),
('carpintaria', 'madeiras', 9, true),
('carpintaria', 'marcenaria', 9, true),
('carpintaria', 'marceneiro', 9, true),
('carpintaria', 'trabalho em madeira', 9, true),
('carpintaria', 'marcenaria de madeira', 9, true),
('carpintaria', 'carpintaria de madeira', 9, true),
('carpintaria', 'estrutura de madeira', 8, true),
('carpintaria', 'esquadrias de madeira', 8, true),

-- ============================================
-- SERRALHERIA E METAL
-- ============================================
('serralheria', 'serralheria', 10, true),
('serralheria', 'serralheiro', 9, true),
('serralheria', 'metal', 9, true),
('serralheria', 'metais', 9, true),
('serralheria', 'ferro', 9, true),
('serralheria', 'ferragem', 9, true),
('serralheria', 'ferragens', 9, true),
('serralheria', 'trabalho em metal', 9, true),
('serralheria', 'estrutura metálica', 9, true),
('serralheria', 'estrutura metalica', 9, true),
('serralheria', 'serralheria de ferro', 9, true),
('serralheria', 'esquadrias metálicas', 8, true),
('serralheria', 'esquadrias metalicas', 8, true),
('serralheria', 'portões metálicos', 8, true),
('serralheria', 'portoes metalicos', 8, true),
('serralheria', 'grades metálicas', 8, true),
('serralheria', 'grades metalicas', 8, true),

-- ============================================
-- JARDINAGEM E PAISAGISMO
-- ============================================
('jardinagem', 'jardinagem', 10, true),
('jardinagem', 'jardim', 9, true),
('jardinagem', 'jardins', 9, true),
('jardinagem', 'paisagismo', 9, true),
('jardinagem', 'paisagista', 9, true),
('jardinagem', 'poda', 8, true),
('jardinagem', 'poda de árvores', 9, true),
('jardinagem', 'poda de arvores', 9, true),
('jardinagem', 'manutenção de jardim', 9, true),
('jardinagem', 'manutencao de jardim', 9, true),
('jardinagem', 'manutenção de áreas verdes', 9, true),
('jardinagem', 'manutencao de areas verdes', 9, true),
('jardinagem', 'paisagismo de áreas verdes', 9, true),
('jardinagem', 'paisagismo de areas verdes', 9, true),
('jardinagem', 'jardinagem predial', 8, true),
('jardinagem', 'jardinagem urbana', 8, true),

-- ============================================
-- SEGURANÇA E VIGILÂNCIA
-- ============================================
('segurança', 'seguranca', 10, true),
('segurança', 'segurança', 10, true),
('segurança', 'vigilância', 9, true),
('segurança', 'vigilancia', 9, true),
('segurança', 'monitoramento', 9, true),
('segurança', 'alarme', 8, true),
('segurança', 'alarmes', 8, true),
('segurança', 'segurança patrimonial', 10, true),
('segurança', 'seguranca patrimonial', 10, true),
('segurança', 'vigilância patrimonial', 10, true),
('segurança', 'vigilancia patrimonial', 10, true),
('segurança', 'monitoramento de segurança', 9, true),
('segurança', 'monitoramento de seguranca', 9, true),
('segurança', 'sistema de segurança', 9, true),
('segurança', 'sistema de seguranca', 9, true),
('segurança', 'sistema de alarme', 8, true),
('segurança', 'cftv', 8, true),
('segurança', 'circuito fechado de tv', 8, true),

-- ============================================
-- INFORMÁTICA E TI
-- ============================================
('informática', 'informatica', 10, true),
('informática', 'informática', 10, true),
('informática', 'ti', 9, true),
('informática', 'tecnologia da informação', 10, true),
('informática', 'tecnologia da informacao', 10, true),
('informática', 'software', 9, true),
('informática', 'hardware', 9, true),
('informática', 'sistema de informação', 9, true),
('informática', 'sistema de informacao', 9, true),
('informática', 'sistema informatizado', 9, true),
('informática', 'sistema de gestão', 8, true),
('informática', 'sistema de gestao', 8, true),
('informática', 'desenvolvimento de software', 9, true),
('informática', 'suporte técnico', 8, true),
('informática', 'suporte tecnico', 8, true),
('informática', 'manutenção de sistemas', 8, true),
('informática', 'manutencao de sistemas', 8, true),

-- ============================================
-- ALIMENTAÇÃO
-- ============================================
('alimentação', 'alimentacao', 10, true),
('alimentação', 'alimentação', 10, true),
('alimentação', 'alimento', 9, true),
('alimentação', 'alimentos', 9, true),
('alimentação', 'comida', 8, true),
('alimentação', 'refeição', 9, true),
('alimentação', 'refeicao', 9, true),
('alimentação', 'catering', 8, true),
('alimentação', 'fornecimento de alimentação', 10, true),
('alimentação', 'fornecimento de alimentacao', 10, true),
('alimentação', 'fornecimento de refeições', 10, true),
('alimentação', 'fornecimento de refeicoes', 10, true),
('alimentação', 'serviço de alimentação', 9, true),
('alimentação', 'servico de alimentacao', 9, true),
('alimentação', 'merenda escolar', 8, true),
('alimentação', 'alimentação escolar', 9, true),
('alimentação', 'alimentacao escolar', 9, true),

-- ============================================
-- VESTUÁRIO E CONFECÇÃO
-- ============================================
('vestuário', 'vestuario', 10, true),
('vestuário', 'vestuário', 10, true),
('vestuário', 'roupa', 9, true),
('vestuário', 'roupas', 9, true),
('vestuário', 'uniforme', 9, true),
('vestuário', 'uniformes', 9, true),
('vestuário', 'confecção', 9, true),
('vestuário', 'confeccao', 9, true),
('vestuário', 'fornecimento de uniformes', 10, true),
('vestuário', 'fornecimento de roupas', 9, true),
('vestuário', 'confecção de uniformes', 9, true),
('vestuário', 'confeccao de uniformes', 9, true),
('vestuário', 'uniforme escolar', 8, true),
('vestuário', 'uniforme profissional', 8, true),

-- ============================================
-- MOBILIÁRIO
-- ============================================
('mobiliário', 'mobiliario', 10, true),
('mobiliário', 'mobiliário', 10, true),
('mobiliário', 'móvel', 9, true),
('mobiliário', 'moveis', 9, true),
('mobiliário', 'mobília', 9, true),
('mobiliário', 'mobilia', 9, true),
('mobiliário', 'furniture', 7, true),
('mobiliário', 'fornecimento de mobiliário', 10, true),
('mobiliário', 'fornecimento de mobiliario', 10, true),
('mobiliário', 'fornecimento de móveis', 10, true),
('mobiliário', 'fornecimento de moveis', 10, true),
('mobiliário', 'mobiliário escolar', 9, true),
('mobiliário', 'mobiliario escolar', 9, true),
('mobiliário', 'mobiliário de escritório', 9, true),
('mobiliário', 'mobiliario de escritorio', 9, true),

-- ============================================
-- PAPELARIA E MATERIAL DE ESCRITÓRIO
-- ============================================
('papelaria', 'papelaria', 10, true),
('papelaria', 'papel', 9, true),
('papelaria', 'papeis', 9, true),
('papelaria', 'material de escritório', 10, true),
('papelaria', 'material de escritorio', 10, true),
('papelaria', 'escritório', 8, true),
('papelaria', 'escritorio', 8, true),
('papelaria', 'fornecimento de papelaria', 10, true),
('papelaria', 'material escolar', 9, true),
('papelaria', 'material de escritório escolar', 9, true),
('papelaria', 'material de escritorio escolar', 9, true),
('papelaria', 'papelaria escolar', 9, true),

-- ============================================
-- COMBUSTÍVEL
-- ============================================
('combustível', 'combustivel', 10, true),
('combustível', 'combustível', 10, true),
('combustível', 'gasolina', 9, true),
('combustível', 'diesel', 9, true),
('combustível', 'álcool', 8, true),
('combustível', 'alcool', 8, true),
('combustível', 'gás', 8, true),
('combustível', 'gas', 8, true),
('combustível', 'fornecimento de combustível', 10, true),
('combustível', 'fornecimento de combustivel', 10, true),
('combustível', 'abastecimento de combustível', 10, true),
('combustível', 'abastecimento de combustivel', 10, true),
('combustível', 'combustível para veículos', 9, true),
('combustível', 'combustivel para veiculos', 9, true),

-- ============================================
-- TELECOMUNICAÇÃO
-- ============================================
('telecomunicação', 'telecomunicacao', 10, true),
('telecomunicação', 'telecomunicação', 10, true),
('telecomunicação', 'telefonia', 9, true),
('telecomunicação', 'internet', 9, true),
('telecomunicação', 'banda larga', 9, true),
('telecomunicação', 'fibra óptica', 9, true),
('telecomunicação', 'fibra optica', 9, true),
('telecomunicação', 'serviço de telecomunicação', 10, true),
('telecomunicação', 'servico de telecomunicacao', 10, true),
('telecomunicação', 'fornecimento de internet', 9, true),
('telecomunicação', 'fornecimento de telefonia', 9, true),
('telecomunicação', 'sistema de telefonia', 9, true),
('telecomunicação', 'sistema de internet', 9, true),

-- ============================================
-- CONSULTORIA E ASSESSORIA
-- ============================================
('consultoria', 'consultoria', 10, true),
('consultoria', 'consultor', 9, true),
('consultoria', 'consultores', 9, true),
('consultoria', 'assessoria', 9, true),
('consultoria', 'assessor', 9, true),
('consultoria', 'assessores', 9, true),
('consultoria', 'serviço de consultoria', 10, true),
('consultoria', 'servico de consultoria', 10, true),
('consultoria', 'prestação de consultoria', 10, true),
('consultoria', 'prestacao de consultoria', 10, true),
('consultoria', 'consultoria técnica', 9, true),
('consultoria', 'consultoria tecnica', 9, true),
('consultoria', 'consultoria especializada', 9, true),

-- ============================================
-- TREINAMENTO E CAPACITAÇÃO
-- ============================================
('treinamento', 'treinamento', 10, true),
('treinamento', 'capacitação', 9, true),
('treinamento', 'capacitacao', 9, true),
('treinamento', 'curso', 9, true),
('treinamento', 'cursos', 9, true),
('treinamento', 'educação', 8, true),
('treinamento', 'educacao', 8, true),
('treinamento', 'serviço de treinamento', 10, true),
('treinamento', 'servico de treinamento', 10, true),
('treinamento', 'prestação de treinamento', 10, true),
('treinamento', 'prestacao de treinamento', 10, true),
('treinamento', 'capacitação profissional', 9, true),
('treinamento', 'capacitacao profissional', 9, true),
('treinamento', 'curso de capacitação', 9, true),
('treinamento', 'curso de capacitacao', 9, true),

-- ============================================
-- PUBLICIDADE E MARKETING
-- ============================================
('publicidade', 'publicidade', 10, true),
('publicidade', 'propaganda', 9, true),
('publicidade', 'marketing', 9, true),
('publicidade', 'mídia', 8, true),
('publicidade', 'midia', 8, true),
('publicidade', 'divulgação', 9, true),
('publicidade', 'divulgacao', 9, true),
('publicidade', 'serviço de publicidade', 10, true),
('publicidade', 'servico de publicidade', 10, true),
('publicidade', 'prestação de serviço de publicidade', 10, true),
('publicidade', 'prestacao de servico de publicidade', 10, true),
('publicidade', 'campanha publicitária', 9, true),
('publicidade', 'campanha publicitaria', 9, true),
('publicidade', 'divulgação institucional', 9, true),
('publicidade', 'divulgacao institucional', 9, true),

-- ============================================
-- TRANSPORTE E LOGÍSTICA
-- ============================================
('transporte', 'transporte', 10, true),
('transporte', 'transporte de carga', 10, true),
('transporte', 'logística', 9, true),
('transporte', 'logistica', 9, true),
('transporte', 'frete', 9, true),
('transporte', 'fretes', 9, true),
('transporte', 'carga', 9, true),
('transporte', 'cargas', 9, true),
('transporte', 'serviço de transporte', 10, true),
('transporte', 'servico de transporte', 10, true),
('transporte', 'transporte de passageiros', 9, true),
('transporte', 'transporte escolar', 9, true),
('transporte', 'transporte público', 9, true),
('transporte', 'transporte publico', 9, true),
('transporte', 'logística de transporte', 9, true),
('transporte', 'logistica de transporte', 9, true),

-- ============================================
-- HOSPITALAR E SAÚDE
-- ============================================
('hospitalar', 'hospitalar', 10, true),
('hospitalar', 'hospital', 9, true),
('hospitalar', 'hospitais', 9, true),
('hospitalar', 'saúde', 9, true),
('hospitalar', 'saude', 9, true),
('hospitalar', 'médico', 8, true),
('hospitalar', 'medico', 8, true),
('hospitalar', 'médicos', 8, true),
('hospitalar', 'medicos', 8, true),
('hospitalar', 'serviço hospitalar', 10, true),
('hospitalar', 'servico hospitalar', 10, true),
('hospitalar', 'equipamento hospitalar', 9, true),
('hospitalar', 'material hospitalar', 9, true),
('hospitalar', 'serviço de saúde', 9, true),
('hospitalar', 'servico de saude', 9, true),

-- ============================================
-- EDUCACIONAL
-- ============================================
('educacional', 'educacional', 10, true),
('educacional', 'educação', 9, true),
('educacional', 'educacao', 9, true),
('educacional', 'escola', 9, true),
('educacional', 'escolas', 9, true),
('educacional', 'ensino', 9, true),
('educacional', 'pedagógico', 8, true),
('educacional', 'pedagogico', 8, true),
('educacional', 'serviço educacional', 10, true),
('educacional', 'servico educacional', 10, true),
('educacional', 'material educacional', 9, true),
('educacional', 'material didático', 9, true),
('educacional', 'material didatico', 9, true),
('educacional', 'equipamento educacional', 9, true),
('educacional', 'mobiliário escolar', 8, true),
('educacional', 'mobiliario escolar', 8, true),

-- ============================================
-- GERENCIAMENTO E GESTÃO
-- ============================================
('gerenciamento', 'gerenciamento', 10, true),
('gerenciamento', 'gestão', 9, true),
('gerenciamento', 'gestao', 9, true),
('gerenciamento', 'administração', 9, true),
('gerenciamento', 'administracao', 9, true),
('gerenciamento', 'gerir', 8, true),
('gerenciamento', 'gerenciar', 8, true),
('gerenciamento', 'serviço de gerenciamento', 10, true),
('gerenciamento', 'servico de gerenciamento', 10, true),
('gerenciamento', 'gestão de projetos', 9, true),
('gerenciamento', 'gestao de projetos', 9, true),
('gerenciamento', 'administração de contratos', 9, true),
('gerenciamento', 'administracao de contratos', 9, true),

-- ============================================
-- VIAGEM E TURISMO
-- ============================================
('viagem', 'viagem', 10, true),
('viagem', 'viagens', 10, true),
('viagem', 'passagem', 9, true),
('viagem', 'passagens', 9, true),
('viagem', 'bilhete', 9, true),
('viagem', 'bilhetes', 9, true),
('viagem', 'transporte', 8, true),
('viagem', 'locomoção', 8, true),
('viagem', 'locomocao', 8, true),
('viagem', 'serviço de viagem', 10, true),
('viagem', 'servico de viagem', 10, true),
('viagem', 'fornecimento de passagens', 10, true),
('viagem', 'fornecimento de bilhetes', 10, true),
('viagem', 'gestão de viagens', 9, true),
('viagem', 'gestao de viagens', 9, true),
('viagem', 'gerenciamento de viagens', 9, true);

-- Estatísticas
SELECT 
  COUNT(*) as total_sinonimos,
  COUNT(DISTINCT palavra_base) as palavras_base,
  AVG(peso) as peso_medio
FROM public.sinonimos
WHERE ativo = true;


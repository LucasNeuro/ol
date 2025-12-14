-- Popular tabela de sinônimos com dados iniciais
-- Sinônimos organizados por setor para maior precisão

-- Sinônimos gerais (aplicam a todos os setores)
INSERT INTO public.sinonimos (palavra_base, sinonimo, peso) VALUES
-- Construção
('construção', 'construcao', 10),
('construção', 'obra', 9),
('construção', 'edificação', 9),
('construção', 'edificacao', 9),
('construção', 'reforma', 8),
('construção', 'reformas', 8),
('construção', 'construir', 7),
('construção', 'construção civil', 10),
('construção', 'obras públicas', 9),
('construção', 'obras publicas', 9),

-- Engenharia
('engenharia', 'engenheiro', 9),
('engenharia', 'projeto', 8),
('engenharia', 'projetos', 8),
('engenharia', 'projetar', 7),
('engenharia', 'projetista', 8),
('engenharia', 'engenharia civil', 10),
('engenharia', 'engenharia estrutural', 9),

-- Serviço
('serviço', 'servico', 10),
('serviço', 'servicos', 10),
('serviço', 'prestação', 9),
('serviço', 'prestacao', 9),
('serviço', 'prestar', 7),
('serviço', 'atendimento', 6),
('serviço', 'assistência', 6),
('serviço', 'assistencia', 6),

-- Material
('material', 'materiais', 10),
('material', 'equipamento', 8),
('material', 'equipamentos', 8),
('material', 'fornecimento', 9),
('material', 'fornecer', 7),
('material', 'suprimento', 7),
('material', 'insumo', 7),
('material', 'insumos', 7),

-- Limpeza
('limpeza', 'higienização', 9),
('limpeza', 'higienizacao', 9),
('limpeza', 'assepsia', 8),
('limpeza', 'limpar', 7),
('limpeza', 'faxina', 8),
('limpeza', 'conservação', 6),
('limpeza', 'conservacao', 6),

-- Manutenção (genérico - precisa de contexto)
('manutenção', 'manutencao', 10),
('manutenção', 'manter', 7),
('manutenção', 'conservar', 6),
('manutenção', 'reparo', 8),
('manutenção', 'reparos', 8),
('manutenção', 'conserto', 8),
('manutenção', 'consertos', 8),

-- Informática/Tecnologia (específico)
('informática', 'informatica', 10),
('informática', 'ti', 9),
('informática', 'tecnologia da informação', 10),
('informática', 'tecnologia da informacao', 10),
('informática', 'software', 9),
('informática', 'hardware', 9),
('informática', 'sistema', 8),
('informática', 'sistemas', 8),
('informática', 'computador', 8),
('informática', 'computadores', 8),
('informática', 'equipamento de informática', 10),
('informática', 'equipamento de informatica', 10),
('informática', 'equipamentos de informática', 10),
('informática', 'equipamentos de informatica', 10),

-- Manutenção de Informática (específico - evita confusão com carros)
('manutenção de informática', 'manutencao de informatica', 10),
('manutenção de informática', 'manutenção de equipamentos de informática', 10),
('manutenção de informática', 'manutencao de equipamentos de informatica', 10),
('manutenção de informática', 'manutenção de computadores', 9),
('manutenção de informática', 'manutencao de computadores', 9),
('manutenção de informática', 'suporte técnico', 8),
('manutenção de informática', 'suporte tecnico', 8),

-- Veículos/Automóveis (para evitar falsos positivos)
('veículo', 'veiculo', 10),
('veículo', 'automóvel', 10),
('veículo', 'automovel', 10),
('veículo', 'carro', 10),
('veículo', 'carros', 10),
('veículo', 'moto', 8),
('veículo', 'motocicleta', 8),
('manutenção de veículo', 'manutencao de veiculo', 10),
('manutenção de veículo', 'manutenção de carro', 10),
('manutenção de veículo', 'manutencao de carro', 10),
('manutenção de veículo', 'manutenção automotiva', 10),
('manutenção de veículo', 'manutencao automotiva', 10),
('manutenção de veículo', 'oficina', 8),
('manutenção de veículo', 'mecânica', 8),
('manutenção de veículo', 'mecanica', 8),

-- Pavimentação
('pavimentação', 'pavimentacao', 10),
('pavimentação', 'asfalto', 9),
('pavimentação', 'asfaltamento', 9),
('pavimentação', 'asfaltar', 8),
('pavimentação', 'calçamento', 8),
('pavimentação', 'calcamento', 8),
('pavimentação', 'pavimento', 8),

-- Saneamento
('saneamento', 'esgoto', 9),
('saneamento', 'água', 8),
('saneamento', 'agua', 8),
('saneamento', 'drenagem', 8),
('saneamento', 'drenar', 7),
('saneamento', 'sistema de água', 9),
('saneamento', 'sistema de agua', 9),
('saneamento', 'abastecimento', 8),

-- Elétrica
('elétrica', 'eletrica', 10),
('elétrica', 'energia', 8),
('elétrica', 'elétrico', 10),
('elétrica', 'eletrico', 10),
('elétrica', 'eletricidade', 9),
('elétrica', 'instalação elétrica', 10),
('elétrica', 'instalacao eletrica', 10),

-- Instalação
('instalação', 'instalacao', 10),
('instalação', 'instalar', 8),
('instalação', 'montagem', 8),
('instalação', 'montar', 7),
('instalação', 'colocação', 7),
('instalação', 'colocacao', 7),

-- Demolição
('demolição', 'demolicao', 10),
('demolição', 'demolir', 8),
('demolição', 'derrubada', 8),
('demolição', 'destruição', 7),
('demolição', 'destruicao', 7),

-- Terraplanagem
('terraplanagem', 'terraplenagem', 10),
('terraplanagem', 'nivelamento', 9),
('terraplanagem', 'aterro', 8),
('terraplanagem', 'aterros', 8),
('terraplanagem', 'escavação', 8),
('terraplanagem', 'escavacao', 8)
ON CONFLICT (palavra_base, sinonimo) DO NOTHING;

-- Associar sinônimos específicos aos setores
-- Exemplo: sinônimos de informática só aplicam ao setor de informática
-- Isso evita que "manutenção" de informática seja confundido com "manutenção" de carro

-- Primeiro, vamos associar sinônimos gerais (que aplicam a todos)
-- Depois, associar sinônimos específicos por setor

-- Nota: Para associar sinônimos a setores específicos, você precisaria:
-- 1. Buscar o ID do setor "Informática" 
-- 2. Buscar os IDs dos sinônimos relacionados
-- 3. Inserir em setores_sinonimos

-- Exemplo de como fazer (execute após popular setores):
/*
-- Associar sinônimos de informática ao setor de Informática
INSERT INTO public.setores_sinonimos (setor_id, sinonimo_id)
SELECT 
  s.id as setor_id,
  sin.id as sinonimo_id
FROM public.setores s
CROSS JOIN public.sinonimos sin
WHERE s.nome = 'Informática'
  AND sin.palavra_base IN ('informática', 'manutenção de informática', 'equipamento de informática')
  AND sin.ativo = true
ON CONFLICT (setor_id, sinonimo_id) DO NOTHING;
*/


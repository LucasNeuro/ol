-- ============================================
-- Popula tabela sinonimos com exemplos de TODAS as áreas e setores
-- Usado para expandir a correspondência semântica (menos rígido)
-- Execute após criar a tabela sinonimos (palavra_base, sinonimo, peso, ativo)
-- ============================================

-- Estrutura esperada: sinonimos (id, palavra_base, sinonimo, peso, ativo)
-- peso: 1-10, maior = mais relevante

-- Criar tabela se não existir
CREATE TABLE IF NOT EXISTS sinonimos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  palavra_base text NOT NULL,
  sinonimo text NOT NULL,
  peso integer DEFAULT 10,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(palavra_base, sinonimo)
);

CREATE INDEX IF NOT EXISTS idx_sinonimos_palavra_base ON sinonimos(palavra_base);
CREATE INDEX IF NOT EXISTS idx_sinonimos_ativo ON sinonimos(ativo);

-- Inserir sinônimos por área (exemplos completos)
INSERT INTO sinonimos (palavra_base, sinonimo, peso) VALUES
  -- Construção e obras
  ('construção', 'construcao', 10),
  ('construção', 'obra', 9),
  ('construção', 'obras', 9),
  ('construção', 'edificação', 8),
  ('construção', 'pavimentação', 8),
  ('engenharia', 'engenheiro', 9),
  ('engenharia', 'projeto', 9),
  ('engenharia', 'projetos', 9),
  ('engenharia', 'fiscalização', 8),
  ('engenharia', 'topografia', 8),
  ('material', 'materiais', 10),
  ('material', 'equipamento', 9),
  ('material', 'equipamentos', 9),
  ('material', 'insumos', 8),
  ('saneamento', 'esgoto', 9),
  ('saneamento', 'drenagem', 8),
  ('saneamento', 'água', 8),
  ('pavimentação', 'pavimentacao', 10),
  ('pavimentação', 'asfalto', 9),
  ('pavimentação', 'calçamento', 8),
  -- Serviços
  ('serviço', 'servico', 10),
  ('serviço', 'servicos', 10),
  ('serviço', 'prestação', 9),
  ('serviço', 'prestacao', 9),
  ('serviço', 'execução', 8),
  ('manutenção', 'manutencao', 10),
  ('manutenção', 'reparo', 9),
  ('manutenção', 'reparos', 9),
  ('manutenção', 'conservação', 8),
  -- Saúde
  ('saúde', 'saude', 10),
  ('saúde', 'hospitalar', 9),
  ('saúde', 'hospital', 9),
  ('saúde', 'médico', 8),
  ('saúde', 'clínica', 8),
  ('medicamento', 'medicamentos', 10),
  ('medicamento', 'remédio', 9),
  ('medicamento', 'remédios', 9),
  ('medicamento', 'fármaco', 7),
  ('hospitalar', 'hospital', 10),
  ('hospitalar', 'clínica', 9),
  ('hospitalar', 'ambulatório', 8),
  ('hospitalar', 'pronto socorro', 9),
  ('laboratorial', 'laboratório', 10),
  ('laboratorial', 'exame', 9),
  ('laboratorial', 'análise', 9),
  ('laboratorial', 'diagnóstico', 8),
  ('vacina', 'vacinas', 10),
  ('vacina', 'imunização', 8),
  ('dieta', 'dietas', 10),
  ('dieta', 'nutrição', 9),
  ('dieta', 'enteral', 8),
  ('dieta', 'parenteral', 8),
  -- Alimentação
  ('alimentação', 'alimentacao', 10),
  ('alimentação', 'comida', 9),
  ('alimentação', 'alimento', 9),
  ('alimentação', 'alimentos', 9),
  ('alimentação', 'nutrição', 8),
  ('alimentação', 'refeição', 9),
  ('alimentação', 'merenda', 9),
  ('cesta', 'cestas', 10),
  ('cesta', 'cesta básica', 10),
  ('cesta', 'cestas básicas', 10),
  ('cesta', 'kit alimentar', 8),
  ('cesta', 'doação', 7),
  ('refeição', 'refeicao', 10),
  ('refeição', 'refeições', 10),
  ('refeição', 'merenda', 9),
  ('refeição', 'almoço', 8),
  ('refeição', 'jantar', 8),
  ('gêneros', 'generos', 10),
  ('gêneros', 'gêneros alimentícios', 10),
  ('gêneros', 'hortifruti', 9),
  ('gêneros', 'hortifrutigranjeiros', 9),
  ('bebida', 'bebidas', 10),
  ('bebida', 'laticínios', 8),
  ('buffet', 'buffets', 10),
  ('buffet', 'catering', 9),
  ('buffet', 'refeitório', 8),
  -- Informática
  ('informática', 'informatica', 10),
  ('informática', 'ti', 10),
  ('informática', 'tecnologia', 9),
  ('informática', 'tecnologia da informação', 10),
  ('computador', 'computadores', 10),
  ('computador', 'notebook', 9),
  ('computador', 'desktop', 9),
  ('computador', 'microcomputador', 8),
  ('software', 'softwares', 10),
  ('software', 'sistema', 9),
  ('software', 'aplicativo', 9),
  ('software', 'aplicação', 8),
  ('software', 'licença', 7),
  ('hardware', 'equipamentos informática', 8),
  ('hardware', 'servidor', 9),
  ('hardware', 'rede', 8),
  -- Transporte
  ('transporte', 'fretamento', 9),
  ('transporte', 'frota', 9),
  ('transporte', 'veículo', 9),
  ('transporte', 'locação veículos', 8),
  ('veículo', 'veiculo', 10),
  ('veículo', 'veículos', 10),
  ('veículo', 'automóvel', 9),
  ('veículo', 'ônibus', 8),
  ('veículo', 'caminhão', 8),
  ('passagem', 'passagens', 10),
  ('passagem', 'bilhete', 9),
  ('passagem', 'bilhetes', 9),
  -- Educação
  ('educação', 'educacao', 10),
  ('educação', 'escolar', 9),
  ('educação', 'pedagógico', 8),
  ('educação', 'capacitação', 8),
  ('educação', 'treinamento', 8),
  ('educação', 'curso', 8),
  ('educação', 'cursos', 8),
  -- Financeiro
  ('seguro', 'seguros', 10),
  ('seguro', 'apólice', 9),
  ('seguro', 'cobertura', 8),
  ('contabilidade', 'contábil', 9),
  ('contabilidade', 'auditoria', 8),
  ('contabilidade', 'consultoria contábil', 9),
  -- Eventos
  ('evento', 'eventos', 10),
  ('evento', 'cerimonial', 8),
  ('evento', 'organização eventos', 9),
  ('evento', 'shows', 8),
  ('evento', 'palestras', 7),
  -- Outros
  ('limpeza', 'higienização', 9),
  ('limpeza', 'conservação', 8),
  ('limpeza', 'asepsia', 7),
  ('segurança', 'seguranca', 10),
  ('segurança', 'vigilância', 9),
  ('segurança', 'proteção', 9),
  ('segurança', 'portaria', 8),
  ('oxigênio', 'oxigenio', 10),
  ('oxigênio', 'oxigênio medicinal', 10),
  ('oxigênio', 'medicinal', 9),
  -- Agropecuária
  ('agropecuária', 'agropecuaria', 10),
  ('agropecuária', 'agrícola', 9),
  ('agropecuária', 'agro', 8),
  ('agropecuária', 'rural', 8),
  ('agropecuária', 'pecuária', 9),
  ('agropecuária', 'pecuaria', 9),
  ('agrícola', 'agricola', 10),
  ('agrícola', 'lavoura', 8),
  ('agrícola', 'cultivo', 8),
  -- Mineração
  ('mineração', 'mineracao', 10),
  ('mineração', 'mineral', 9),
  ('mineração', 'extração', 8),
  ('mineração', 'extração mineral', 9),
  -- Pesca
  ('pesca', 'pescado', 9),
  ('pesca', 'aquicultura', 8),
  ('pescado', 'pescados', 10),
  ('pescado', 'peixe', 9),
  ('pescado', 'frutos do mar', 8),
  -- Têxtil
  ('têxtil', 'textil', 10),
  ('têxtil', 'vestuário', 9),
  ('têxtil', 'vestuario', 9),
  ('têxtil', 'confecção', 8),
  ('têxtil', 'confeccao', 8),
  ('vestuário', 'vestuario', 10),
  ('vestuário', 'roupa', 9),
  ('vestuário', 'roupas', 9),
  ('vestuário', 'uniformes', 8),
  -- Administrativo
  ('administrativo', 'administração', 9),
  ('administrativo', 'administracao', 9),
  ('administrativo', 'gestão', 8),
  ('administrativo', 'gestao', 8),
  ('administrativo', 'apoio administrativo', 9),
  ('gestão', 'gestao', 10),
  ('gestão', 'gerenciamento', 9),
  ('gestão', 'administração', 9),
  -- Comunicação
  ('comunicação', 'comunicacao', 10),
  ('comunicação', 'comunicacao', 10),
  ('comunicação', 'mídia', 8),
  ('comunicação', 'imprensa', 8),
  ('publicidade', 'propaganda', 9),
  ('publicidade', 'marketing', 8),
  ('publicidade', 'mídia', 7),
  -- Jurídico
  ('jurídico', 'juridico', 10),
  ('jurídico', 'advocacia', 9),
  ('jurídico', 'assessoria jurídica', 9),
  ('advocacia', 'advogado', 9),
  ('advocacia', 'consultoria jurídica', 9),
  -- Meio Ambiente
  ('meio ambiente', 'ambiental', 10),
  ('meio ambiente', 'sustentabilidade', 8),
  ('meio ambiente', 'recursos naturais', 8),
  ('ambiental', 'ecológico', 8),
  ('ambiental', 'ecologico', 8),
  -- Cultura
  ('cultura', 'cultural', 10),
  ('cultura', 'artístico', 8),
  ('cultura', 'artistico', 8),
  ('cultura', 'patrimônio', 8),
  ('cultura', 'patrimonio', 8),
  -- Turismo
  ('turismo', 'turístico', 9),
  ('turismo', 'turistico', 9),
  ('turismo', 'hospedagem', 8),
  ('turismo', 'hospitalidade', 8),
  -- Energia
  ('energia', 'energético', 8),
  ('energia', 'energetico', 8),
  ('energia', 'elétrica', 8),
  ('energia', 'eletrica', 8),
  ('energia', 'fornecimento energia', 9),
  -- Recursos Humanos
  ('recursos humanos', 'rh', 10),
  ('recursos humanos', 'gestão pessoas', 9),
  ('recursos humanos', 'gestao pessoas', 9),
  ('recursos humanos', 'folha pagamento', 8),
  ('recursos humanos', 'admissão', 7),
  -- Doação e assistência
  ('doação', 'doacao', 10),
  ('doação', 'doações', 10),
  ('doação', 'assistência', 8),
  ('doação', 'assistencia', 8),
  ('doação', 'vulnerabilidade', 7),
  ('doação', 'famílias', 7)
ON CONFLICT (palavra_base, sinonimo) DO NOTHING;

-- Log
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM sinonimos WHERE ativo = true;
  RAISE NOTICE 'Sinônimos ativos na tabela: %', n;
END $$;

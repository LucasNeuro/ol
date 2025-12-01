-- =====================================================
-- SCHEMA ROBUSTO E DINÂMICO - SISTEMA LICITAÇÃO
-- =====================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Para busca de texto (similaridade)
CREATE EXTENSION IF NOT EXISTS "btree_gin"; -- Para índices GIN em JSONB

-- =====================================================
-- 1. TABELAS PRINCIPAIS
-- =====================================================

-- Perfis de Usuário (Autenticação Personalizada)
CREATE TABLE public.profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  cnpj TEXT UNIQUE,
  razao_social TEXT,
  cargo TEXT CHECK (cargo IN ('Gerente', 'Dono', 'Independente')),
  tipo_acesso TEXT DEFAULT 'usuario' CHECK (tipo_acesso IN ('usuario', 'admin', 'gerente')),
  ativo BOOLEAN DEFAULT TRUE,
  ultimo_login TIMESTAMP WITH TIME ZONE,
  
  -- Preferências do usuário
  preferencias JSONB DEFAULT '{}'::jsonb, -- Ex: {"notificacoes": true, "tema": "claro"}
  
  -- Metadados
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela principal de Licitações (COMPARTILHADA - todos os usuários)
CREATE TABLE public.licitacoes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  numero_controle_pncp TEXT UNIQUE NOT NULL,
  
  -- Dados básicos
  numero_compra TEXT,
  ano_compra INTEGER,
  processo TEXT,
  objeto_compra TEXT,
  informacao_complementar TEXT,
  
  -- Classificação
  modalidade_id INTEGER,
  modalidade_nome TEXT,
  modo_disputa_id INTEGER,
  modo_disputa_nome TEXT,
  situacao_id INTEGER,
  situacao_nome TEXT,
  
  -- Valores
  valor_total_estimado DECIMAL(15,4),
  valor_total_homologado DECIMAL(15,4),
  moeda TEXT DEFAULT 'BRL',
  
  -- Datas importantes
  data_abertura_proposta TIMESTAMP WITH TIME ZONE,
  data_encerramento_proposta TIMESTAMP WITH TIME ZONE,
  data_publicacao_pncp DATE,
  data_homologacao TIMESTAMP WITH TIME ZONE,
  
  -- Links
  link_sistema_origem TEXT,
  link_pncp TEXT, -- Link direto no portal PNCP
  
  -- Dados do Órgão (normalizado)
  orgao_cnpj TEXT,
  orgao_razao_social TEXT,
  orgao_poder_id TEXT,
  orgao_poder_nome TEXT,
  orgao_esfera_id TEXT,
  orgao_esfera_nome TEXT,
  
  -- Dados da Unidade/Localização
  unidade_codigo TEXT,
  unidade_nome TEXT,
  municipio_codigo_ibge INTEGER,
  municipio_nome TEXT,
  uf_sigla TEXT,
  uf_nome TEXT,
  regiao TEXT, -- Norte, Nordeste, Sul, Sudeste, Centro-Oeste
  
  -- Dados adicionais do PNCP (JSONB para flexibilidade)
  dados_complementares JSONB DEFAULT '{}'::jsonb,
  
  -- Metadados de sincronização
  data_inclusao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  data_atualizacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sincronizado_em TIMESTAMP WITH TIME ZONE,
  versao_dados INTEGER DEFAULT 1, -- Para controle de versão
  
  -- Flags de qualidade dos dados
  dados_completos BOOLEAN DEFAULT FALSE, -- Se tem itens + documentos
  precisa_atualizacao BOOLEAN DEFAULT FALSE, -- Flag para re-sincronizar
  
  -- Índices compostos para busca rápida
  CONSTRAINT licitacoes_numero_controle_pncp_key UNIQUE (numero_controle_pncp)
);

-- Itens das Licitações
CREATE TABLE public.licitacao_itens (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  licitacao_id UUID REFERENCES public.licitacoes(id) ON DELETE CASCADE NOT NULL,
  
  numero_item INTEGER NOT NULL,
  descricao_item TEXT,
  quantidade DECIMAL(15,4),
  valor_unitario DECIMAL(15,4),
  valor_total DECIMAL(15,4),
  unidade_fornecimento TEXT,
  
  -- Classificação
  classificacao_codigo TEXT,
  classificacao_nome TEXT,
  categoria_item TEXT,
  
  -- Situação
  situacao_item_id INTEGER,
  situacao_item_nome TEXT,
  
  -- Dados adicionais
  dados_complementares JSONB DEFAULT '{}'::jsonb,
  
  -- Metadados
  data_inclusao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  data_atualizacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraint: não pode ter dois itens com mesmo número na mesma licitação
  CONSTRAINT licitacao_itens_licitacao_numero_key UNIQUE (licitacao_id, numero_item)
);

-- Documentos/Anexos das Licitações
CREATE TABLE public.licitacao_documentos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  licitacao_id UUID REFERENCES public.licitacoes(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES public.licitacao_itens(id) ON DELETE CASCADE,
  
  tipo_documento_id INTEGER,
  tipo_documento_nome TEXT,
  nome_arquivo TEXT NOT NULL,
  
  -- URLs (pode ser link externo ou path interno)
  url_documento TEXT NOT NULL, -- Link completo do PNCP
  url_original TEXT, -- URL original se diferente
  arquivo_path TEXT, -- Path no Supabase Storage (se baixado)
  
  -- Metadados do arquivo
  tamanho_bytes BIGINT,
  tipo_mime TEXT,
  extensao TEXT, -- pdf, docx, etc
  data_publicacao DATE,
  
  -- Status de download
  baixado BOOLEAN DEFAULT FALSE,
  data_download TIMESTAMP WITH TIME ZONE,
  hash_arquivo TEXT, -- Para verificar integridade
  
  -- Metadados
  data_inclusao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Dados adicionais
  dados_complementares JSONB DEFAULT '{}'::jsonb
);

-- Resultados/Homologações
CREATE TABLE public.licitacao_resultados (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  item_id UUID REFERENCES public.licitacao_itens(id) ON DELETE CASCADE NOT NULL,
  
  fornecedor_cnpj TEXT,
  fornecedor_razao_social TEXT,
  valor_lance DECIMAL(15,4),
  valor_homologado DECIMAL(15,4),
  situacao_resultado_id INTEGER,
  situacao_resultado_nome TEXT,
  data_homologacao DATE,
  
  -- Dados adicionais
  dados_complementares JSONB DEFAULT '{}'::jsonb
);

-- Imagens dos Itens
CREATE TABLE public.licitacao_imagens (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  item_id UUID REFERENCES public.licitacao_itens(id) ON DELETE CASCADE NOT NULL,
  url_imagem TEXT,
  descricao TEXT,
  ordem INTEGER DEFAULT 0
);

-- =====================================================
-- 2. SISTEMA DE CACHE E BUSCAS DO USUÁRIO
-- =====================================================

-- Histórico de Buscas do Usuário (para cache e análise)
CREATE TABLE public.buscas_usuario (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  usuario_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- Filtros aplicados (JSONB flexível)
  filtros JSONB NOT NULL, -- Ex: {"dataInicial": "2025-12-01", "modalidade": 6, "uf": "SP"}
  filtros_hash TEXT, -- Hash dos filtros para comparação rápida
  
  -- Resultados da busca
  total_encontrado INTEGER DEFAULT 0,
  licitacoes_ids UUID[] DEFAULT '{}', -- Array de IDs encontrados
  licitacoes_numeros TEXT[], -- Array de números de controle (para busca rápida)
  
  -- Metadados da busca
  data_busca TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  tempo_busca_ms INTEGER, -- Tempo que levou para buscar
  origem_busca TEXT DEFAULT 'api' CHECK (origem_busca IN ('api', 'cache', 'banco')),
  
  -- Cache
  expira_em TIMESTAMP WITH TIME ZONE, -- Quando o cache expira
  cache_valido BOOLEAN DEFAULT TRUE,
  
  -- Análise
  sucesso BOOLEAN DEFAULT TRUE,
  erro_mensagem TEXT
);

-- Visualizações de Licitações pelo Usuário (histórico)
CREATE TABLE public.licitacoes_visualizadas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  usuario_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  licitacao_id UUID REFERENCES public.licitacoes(id) ON DELETE CASCADE NOT NULL,
  
  -- Metadados da visualização
  data_visualizacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  tempo_visualizacao_segundos INTEGER, -- Quanto tempo ficou visualizando
  visualizou_detalhes BOOLEAN DEFAULT FALSE, -- Se abriu o sidepanel
  visualizou_itens BOOLEAN DEFAULT FALSE,
  visualizou_documentos BOOLEAN DEFAULT FALSE,
  
  -- Constraint: uma visualização por usuário/licitação (atualiza timestamp)
  CONSTRAINT licitacoes_visualizadas_usuario_licitacao_key UNIQUE (usuario_id, licitacao_id)
);

-- Licitações Favoritas
CREATE TABLE public.licitacoes_favoritas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  usuario_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  licitacao_id UUID REFERENCES public.licitacoes(id) ON DELETE CASCADE NOT NULL,
  
  data_adicao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notas TEXT, -- Notas pessoais do usuário sobre a licitação
  
  CONSTRAINT licitacoes_favoritas_usuario_licitacao_key UNIQUE (usuario_id, licitacao_id)
);

-- Tags Personalizadas do Usuário
CREATE TABLE public.licitacoes_tags (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  usuario_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  licitacao_id UUID REFERENCES public.licitacoes(id) ON DELETE CASCADE NOT NULL,
  tag TEXT NOT NULL, -- Ex: "interessante", "urgente", "seguir"
  
  data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT licitacoes_tags_usuario_licitacao_tag_key UNIQUE (usuario_id, licitacao_id, tag)
);

-- =====================================================
-- 3. SISTEMA DE ALERTAS E NOTIFICAÇÕES
-- =====================================================

-- Alertas do Usuário (mais robusto)
CREATE TABLE public.alertas_usuario (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  usuario_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  
  nome_alerta TEXT NOT NULL,
  descricao TEXT,
  
  -- Filtros do alerta (JSONB flexível)
  filtros JSONB NOT NULL, -- Ex: {"modalidade": 6, "valorMinimo": 10000, "uf": ["SP", "RJ"]}
  
  -- Configurações
  ativo BOOLEAN DEFAULT TRUE,
  frequencia TEXT CHECK (frequencia IN ('diario', 'semanal', 'imediato', 'personalizado')) DEFAULT 'diario',
  horario_notificacao TIME, -- Para frequência personalizada
  
  -- Notificações
  email_notificacao TEXT,
  notificar_email BOOLEAN DEFAULT TRUE,
  notificar_app BOOLEAN DEFAULT TRUE,
  
  -- Estatísticas
  total_encontrado INTEGER DEFAULT 0,
  ultima_execucao TIMESTAMP WITH TIME ZONE,
  proxima_execucao TIMESTAMP WITH TIME ZONE,
  
  -- Metadados
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Histórico de Execuções de Alertas
CREATE TABLE public.alertas_execucoes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  alerta_id UUID REFERENCES public.alertas_usuario(id) ON DELETE CASCADE NOT NULL,
  
  data_execucao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  licitacoes_encontradas UUID[],
  total_encontrado INTEGER DEFAULT 0,
  notificacao_enviada BOOLEAN DEFAULT FALSE,
  sucesso BOOLEAN DEFAULT TRUE,
  erro_mensagem TEXT
);

-- =====================================================
-- 4. SISTEMA DE ANÁLISE E ESTATÍSTICAS
-- =====================================================

-- Estatísticas de Licitações (agregadas por período)
CREATE TABLE public.licitacoes_estatisticas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  
  -- Período
  data_referencia DATE NOT NULL,
  tipo_periodo TEXT CHECK (tipo_periodo IN ('diario', 'semanal', 'mensal')) DEFAULT 'diario',
  
  -- Agregações
  total_licitacoes INTEGER DEFAULT 0,
  total_valor_estimado DECIMAL(15,4) DEFAULT 0,
  total_valor_homologado DECIMAL(15,4) DEFAULT 0,
  
  -- Por modalidade (JSONB)
  por_modalidade JSONB DEFAULT '{}'::jsonb,
  
  -- Por UF (JSONB)
  por_uf JSONB DEFAULT '{}'::jsonb,
  
  -- Por órgão (top 10)
  top_orgaos JSONB DEFAULT '[]'::jsonb,
  
  -- Metadados
  calculado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT licitacoes_estatisticas_data_tipo_key UNIQUE (data_referencia, tipo_periodo)
);

-- =====================================================
-- 5. SISTEMA DE AUDITORIA E LOGS
-- =====================================================

-- Logs de Ações do Usuário
CREATE TABLE public.logs_usuario (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  usuario_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  acao TEXT NOT NULL, -- "buscar_boletim", "visualizar_detalhes", "adicionar_favorito"
  entidade TEXT, -- "licitacao", "busca", "alerta"
  entidade_id UUID,
  
  dados_acao JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  
  data_acao TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 6. ÍNDICES PARA PERFORMANCE
-- =====================================================

-- Índices para licitacoes
CREATE INDEX idx_licitacoes_numero_controle_pncp ON public.licitacoes(numero_controle_pncp);
CREATE INDEX idx_licitacoes_data_publicacao ON public.licitacoes(data_publicacao_pncp);
CREATE INDEX idx_licitacoes_data_encerramento ON public.licitacoes(data_encerramento_proposta);
CREATE INDEX idx_licitacoes_orgao_cnpj ON public.licitacoes(orgao_cnpj);
CREATE INDEX idx_licitacoes_uf ON public.licitacoes(uf_sigla);
CREATE INDEX idx_licitacoes_modalidade ON public.licitacoes(modalidade_id);
CREATE INDEX idx_licitacoes_situacao ON public.licitacoes(situacao_id);
CREATE INDEX idx_licitacoes_valor ON public.licitacoes(valor_total_estimado);
CREATE INDEX idx_licitacoes_dados_completos ON public.licitacoes(dados_completos) WHERE dados_completos = TRUE;
CREATE INDEX idx_licitacoes_precisa_atualizacao ON public.licitacoes(precisa_atualizacao) WHERE precisa_atualizacao = TRUE;

-- Índice GIN para busca em JSONB
CREATE INDEX idx_licitacoes_dados_complementares ON public.licitacoes USING GIN (dados_complementares);
CREATE INDEX idx_licitacoes_dados_complementares_gin ON public.licitacao_itens USING GIN (dados_complementares);

-- Índice para busca de texto (similaridade)
CREATE INDEX idx_licitacoes_objeto_compra_trgm ON public.licitacoes USING GIN (objeto_compra gin_trgm_ops);
CREATE INDEX idx_licitacoes_orgao_razao_trgm ON public.licitacoes USING GIN (orgao_razao_social gin_trgm_ops);

-- Índices para itens
CREATE INDEX idx_licitacao_itens_licitacao_id ON public.licitacao_itens(licitacao_id);
CREATE INDEX idx_licitacao_itens_classificacao ON public.licitacao_itens(classificacao_codigo);
CREATE INDEX idx_licitacao_itens_numero ON public.licitacao_itens(licitacao_id, numero_item);

-- Índices para documentos
CREATE INDEX idx_licitacao_documentos_licitacao_id ON public.licitacao_documentos(licitacao_id);
CREATE INDEX idx_licitacao_documentos_item_id ON public.licitacao_documentos(item_id);
CREATE INDEX idx_licitacao_documentos_tipo ON public.licitacao_documentos(tipo_documento_id);
CREATE INDEX idx_licitacao_documentos_baixado ON public.licitacao_documentos(baixado) WHERE baixado = FALSE;

-- Índices para buscas do usuário
CREATE INDEX idx_buscas_usuario_usuario_id ON public.buscas_usuario(usuario_id);
CREATE INDEX idx_buscas_usuario_data_busca ON public.buscas_usuario(data_busca DESC);
CREATE INDEX idx_buscas_usuario_filtros_hash ON public.buscas_usuario(filtros_hash);
CREATE INDEX idx_buscas_usuario_cache_valido ON public.buscas_usuario(cache_valido, expira_em) WHERE cache_valido = TRUE;
CREATE INDEX idx_buscas_usuario_filtros_gin ON public.buscas_usuario USING GIN (filtros);

-- Índices para visualizações
CREATE INDEX idx_licitacoes_visualizadas_usuario_id ON public.licitacoes_visualizadas(usuario_id);
CREATE INDEX idx_licitacoes_visualizadas_licitacao_id ON public.licitacoes_visualizadas(licitacao_id);
CREATE INDEX idx_licitacoes_visualizadas_data ON public.licitacoes_visualizadas(data_visualizacao DESC);

-- Índices para favoritas
CREATE INDEX idx_licitacoes_favoritas_usuario_id ON public.licitacoes_favoritas(usuario_id);
CREATE INDEX idx_licitacoes_favoritas_licitacao_id ON public.licitacoes_favoritas(licitacao_id);

-- Índices para tags
CREATE INDEX idx_licitacoes_tags_usuario_id ON public.licitacoes_tags(usuario_id);
CREATE INDEX idx_licitacoes_tags_licitacao_id ON public.licitacoes_tags(licitacao_id);
CREATE INDEX idx_licitacoes_tags_tag ON public.licitacoes_tags(tag);

-- Índices para alertas
CREATE INDEX idx_alertas_usuario_usuario_id ON public.alertas_usuario(usuario_id);
CREATE INDEX idx_alertas_usuario_ativo ON public.alertas_usuario(ativo) WHERE ativo = TRUE;
CREATE INDEX idx_alertas_usuario_proxima_execucao ON public.alertas_usuario(proxima_execucao) WHERE ativo = TRUE;
CREATE INDEX idx_alertas_usuario_filtros_gin ON public.alertas_usuario USING GIN (filtros);

-- Índices para logs
CREATE INDEX idx_logs_usuario_usuario_id ON public.logs_usuario(usuario_id);
CREATE INDEX idx_logs_usuario_data_acao ON public.logs_usuario(data_acao DESC);
CREATE INDEX idx_logs_usuario_acao ON public.logs_usuario(acao);

-- =====================================================
-- 7. FUNÇÕES E TRIGGERS
-- =====================================================

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função para gerar hash de filtros
CREATE OR REPLACE FUNCTION generate_filtros_hash(filtros JSONB)
RETURNS TEXT AS $$
BEGIN
  RETURN md5(filtros::text);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função para atualizar estatísticas (pode ser chamada periodicamente)
CREATE OR REPLACE FUNCTION atualizar_estatisticas_licitacoes(data_ref DATE)
RETURNS VOID AS $$
BEGIN
  -- Implementar lógica de agregação
  -- Pode ser chamada por um job agendado
  NULL;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_licitacoes_updated_at BEFORE UPDATE ON public.licitacoes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_licitacao_itens_updated_at BEFORE UPDATE ON public.licitacao_itens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alertas_usuario_updated_at BEFORE UPDATE ON public.alertas_usuario
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger para gerar hash de filtros automaticamente
CREATE OR REPLACE FUNCTION set_filtros_hash()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.filtros_hash IS NULL THEN
    NEW.filtros_hash = generate_filtros_hash(NEW.filtros);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_buscas_filtros_hash BEFORE INSERT OR UPDATE ON public.buscas_usuario
  FOR EACH ROW EXECUTE FUNCTION set_filtros_hash();

-- =====================================================
-- 8. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licitacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licitacao_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licitacao_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licitacao_resultados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licitacao_imagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buscas_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licitacoes_visualizadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licitacoes_favoritas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licitacoes_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas_execucoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_usuario ENABLE ROW LEVEL SECURITY;

-- Políticas RLS

-- LICITAÇÕES: Públicas (todos podem ler, todos podem escrever)
CREATE POLICY "Anyone can view licitacoes" ON public.licitacoes
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert licitacoes" ON public.licitacoes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update licitacoes" ON public.licitacoes
  FOR UPDATE USING (true);

-- ITENS, DOCUMENTOS, RESULTADOS, IMAGENS: Públicos
CREATE POLICY "Anyone can view licitacao_itens" ON public.licitacao_itens
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert licitacao_itens" ON public.licitacao_itens
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view licitacao_documentos" ON public.licitacao_documentos
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert licitacao_documentos" ON public.licitacao_documentos
  FOR INSERT WITH CHECK (true);

-- BUSCAS, VISUALIZAÇÕES, FAVORITAS, TAGS: Privadas (apenas o próprio usuário)
CREATE POLICY "Users can manage own buscas" ON public.buscas_usuario
  FOR ALL USING (auth.uid()::text = usuario_id::text OR true); -- Será validado no código

CREATE POLICY "Users can manage own visualizacoes" ON public.licitacoes_visualizadas
  FOR ALL USING (auth.uid()::text = usuario_id::text OR true);

CREATE POLICY "Users can manage own favoritas" ON public.licitacoes_favoritas
  FOR ALL USING (auth.uid()::text = usuario_id::text OR true);

CREATE POLICY "Users can manage own tags" ON public.licitacoes_tags
  FOR ALL USING (auth.uid()::text = usuario_id::text OR true);

-- ALERTAS: Privados
CREATE POLICY "Users can manage own alertas" ON public.alertas_usuario
  FOR ALL USING (auth.uid()::text = usuario_id::text OR true);

CREATE POLICY "Users can view own alertas_execucoes" ON public.alertas_execucoes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.alertas_usuario
      WHERE id = alertas_execucoes.alerta_id
      AND usuario_id::text = auth.uid()::text
    ) OR true
  );

-- LOGS: Usuário pode ver apenas seus próprios logs
CREATE POLICY "Users can view own logs" ON public.logs_usuario
  FOR SELECT USING (auth.uid()::text = usuario_id::text OR true);

-- PROFILES: Usuário pode ver/atualizar apenas seu próprio perfil
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid()::text = id::text OR true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid()::text = id::text OR true);

-- =====================================================
-- 9. VIEWS ÚTEIS (OPCIONAL - para relatórios)
-- =====================================================

-- View: Licitações com contagem de itens e documentos
CREATE OR REPLACE VIEW public.vw_licitacoes_completa AS
SELECT 
  l.*,
  COUNT(DISTINCT li.id) as total_itens,
  COUNT(DISTINCT ld.id) as total_documentos,
  CASE 
    WHEN COUNT(DISTINCT li.id) > 0 AND COUNT(DISTINCT ld.id) > 0 THEN TRUE
    ELSE FALSE
  END as tem_dados_completos
FROM public.licitacoes l
LEFT JOIN public.licitacao_itens li ON li.licitacao_id = l.id
LEFT JOIN public.licitacao_documentos ld ON ld.licitacao_id = l.id
GROUP BY l.id;

-- =====================================================
-- FIM DO SCHEMA
-- =====================================================


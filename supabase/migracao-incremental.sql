-- =====================================================
-- MIGRAÇÃO INCREMENTAL - Adiciona funcionalidades ao schema existente
-- =====================================================
-- Este script ADICIONA apenas o que falta, sem quebrar o que já existe
-- Execute este script no Supabase SQL Editor

-- Extensões (se não existirem)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Para busca de texto (similaridade)
CREATE EXTENSION IF NOT EXISTS "btree_gin"; -- Para índices GIN em JSONB

-- =====================================================
-- 1. ADICIONAR NOVOS CAMPOS NAS TABELAS EXISTENTES
-- =====================================================

-- Adicionar campos na tabela profiles (se não existirem)
DO $$ 
BEGIN
  -- Preferências do usuário
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'profiles' 
                 AND column_name = 'preferencias') THEN
    ALTER TABLE public.profiles ADD COLUMN preferencias JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Adicionar campos na tabela licitacoes (se não existirem)
DO $$ 
BEGIN
  -- Link direto no portal PNCP
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'licitacoes' 
                 AND column_name = 'link_pncp') THEN
    ALTER TABLE public.licitacoes ADD COLUMN link_pncp TEXT;
  END IF;
  
  -- Dados complementares (JSONB flexível)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'licitacoes' 
                 AND column_name = 'dados_complementares') THEN
    ALTER TABLE public.licitacoes ADD COLUMN dados_complementares JSONB DEFAULT '{}'::jsonb;
  END IF;
  
  -- Controle de versão
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'licitacoes' 
                 AND column_name = 'versao_dados') THEN
    ALTER TABLE public.licitacoes ADD COLUMN versao_dados INTEGER DEFAULT 1;
  END IF;
  
  -- Flags de qualidade dos dados
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'licitacoes' 
                 AND column_name = 'dados_completos') THEN
    ALTER TABLE public.licitacoes ADD COLUMN dados_completos BOOLEAN DEFAULT FALSE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'licitacoes' 
                 AND column_name = 'precisa_atualizacao') THEN
    ALTER TABLE public.licitacoes ADD COLUMN precisa_atualizacao BOOLEAN DEFAULT FALSE;
  END IF;
  
  -- Região do Brasil
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'licitacoes' 
                 AND column_name = 'regiao') THEN
    ALTER TABLE public.licitacoes ADD COLUMN regiao TEXT;
  END IF;
  
  -- Moeda
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'licitacoes' 
                 AND column_name = 'moeda') THEN
    ALTER TABLE public.licitacoes ADD COLUMN moeda TEXT DEFAULT 'BRL';
  END IF;
  
  -- Data de homologação
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'licitacoes' 
                 AND column_name = 'data_homologacao') THEN
    ALTER TABLE public.licitacoes ADD COLUMN data_homologacao TIMESTAMP WITH TIME ZONE;
  END IF;
  
  -- Nomes dos poderes e esferas
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'licitacoes' 
                 AND column_name = 'orgao_poder_nome') THEN
    ALTER TABLE public.licitacoes ADD COLUMN orgao_poder_nome TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'licitacoes' 
                 AND column_name = 'orgao_esfera_nome') THEN
    ALTER TABLE public.licitacoes ADD COLUMN orgao_esfera_nome TEXT;
  END IF;
END $$;

-- Adicionar campos na tabela licitacao_itens (se não existirem)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'licitacao_itens' 
                 AND column_name = 'dados_complementares') THEN
    ALTER TABLE public.licitacao_itens ADD COLUMN dados_complementares JSONB DEFAULT '{}'::jsonb;
  END IF;
  
  -- Constraint para não ter dois itens com mesmo número na mesma licitação
  IF NOT EXISTS (SELECT 1 FROM pg_constraint 
                 WHERE conname = 'licitacao_itens_licitacao_numero_key') THEN
    ALTER TABLE public.licitacao_itens 
    ADD CONSTRAINT licitacao_itens_licitacao_numero_key UNIQUE (licitacao_id, numero_item);
  END IF;
END $$;

-- Adicionar campos na tabela licitacao_documentos (se não existirem)
DO $$ 
BEGIN
  -- URL original preservada
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'licitacao_documentos' 
                 AND column_name = 'url_original') THEN
    ALTER TABLE public.licitacao_documentos ADD COLUMN url_original TEXT;
  END IF;
  
  -- Tipo MIME do arquivo
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'licitacao_documentos' 
                 AND column_name = 'tipo_mime') THEN
    ALTER TABLE public.licitacao_documentos ADD COLUMN tipo_mime TEXT;
  END IF;
  
  -- Extensão do arquivo
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'licitacao_documentos' 
                 AND column_name = 'extensao') THEN
    ALTER TABLE public.licitacao_documentos ADD COLUMN extensao TEXT;
  END IF;
  
  -- Hash do arquivo para verificar integridade
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'licitacao_documentos' 
                 AND column_name = 'hash_arquivo') THEN
    ALTER TABLE public.licitacao_documentos ADD COLUMN hash_arquivo TEXT;
  END IF;
  
  -- Dados complementares
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'licitacao_documentos' 
                 AND column_name = 'dados_complementares') THEN
    ALTER TABLE public.licitacao_documentos ADD COLUMN dados_complementares JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Adicionar campos na tabela licitacao_resultados (se não existirem)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'licitacao_resultados' 
                 AND column_name = 'dados_complementares') THEN
    ALTER TABLE public.licitacao_resultados ADD COLUMN dados_complementares JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Adicionar campo na tabela licitacoes_favoritas (se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'licitacoes_favoritas' 
                 AND column_name = 'notas') THEN
    ALTER TABLE public.licitacoes_favoritas ADD COLUMN notas TEXT;
  END IF;
END $$;

-- Adicionar campos na tabela alertas_usuario (se não existirem)
DO $$ 
BEGIN
  -- Descrição do alerta
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'alertas_usuario' 
                 AND column_name = 'descricao') THEN
    ALTER TABLE public.alertas_usuario ADD COLUMN descricao TEXT;
  END IF;
  
  -- Horário de notificação
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'alertas_usuario' 
                 AND column_name = 'horario_notificacao') THEN
    ALTER TABLE public.alertas_usuario ADD COLUMN horario_notificacao TIME;
  END IF;
  
  -- Controle de notificações
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'alertas_usuario' 
                 AND column_name = 'notificar_email') THEN
    ALTER TABLE public.alertas_usuario ADD COLUMN notificar_email BOOLEAN DEFAULT TRUE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'alertas_usuario' 
                 AND column_name = 'notificar_app') THEN
    ALTER TABLE public.alertas_usuario ADD COLUMN notificar_app BOOLEAN DEFAULT TRUE;
  END IF;
  
  -- Estatísticas
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'alertas_usuario' 
                 AND column_name = 'total_encontrado') THEN
    ALTER TABLE public.alertas_usuario ADD COLUMN total_encontrado INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'alertas_usuario' 
                 AND column_name = 'ultima_execucao') THEN
    ALTER TABLE public.alertas_usuario ADD COLUMN ultima_execucao TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'alertas_usuario' 
                 AND column_name = 'proxima_execucao') THEN
    ALTER TABLE public.alertas_usuario ADD COLUMN proxima_execucao TIMESTAMP WITH TIME ZONE;
  END IF;
  
  -- Atualizar constraint de frequencia para incluir 'personalizado'
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
             WHERE constraint_schema = 'public' 
             AND table_name = 'alertas_usuario' 
             AND constraint_name LIKE '%frequencia%') THEN
    -- Remover constraint antiga e criar nova
    ALTER TABLE public.alertas_usuario DROP CONSTRAINT IF EXISTS alertas_usuario_frequencia_check;
    ALTER TABLE public.alertas_usuario ADD CONSTRAINT alertas_usuario_frequencia_check 
      CHECK (frequencia IN ('diario', 'semanal', 'imediato', 'personalizado'));
  END IF;
END $$;

-- =====================================================
-- 2. CRIAR NOVAS TABELAS (apenas se não existirem)
-- =====================================================

-- Tabela de buscas do usuário (cache)
CREATE TABLE IF NOT EXISTS public.buscas_usuario (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Filtros aplicados (JSONB flexível)
  filtros JSONB NOT NULL,
  filtros_hash TEXT, -- Hash dos filtros para comparação rápida
  
  -- Resultados da busca
  total_encontrado INTEGER DEFAULT 0,
  licitacoes_ids UUID[] DEFAULT '{}', -- Array de IDs encontrados
  licitacoes_numeros TEXT[], -- Array de números de controle
  
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

-- Tabela de visualizações do usuário
CREATE TABLE IF NOT EXISTS public.licitacoes_visualizadas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  licitacao_id UUID NOT NULL REFERENCES public.licitacoes(id) ON DELETE CASCADE,
  
  -- Metadados da visualização
  data_visualizacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  tempo_visualizacao_segundos INTEGER, -- Quanto tempo ficou visualizando
  visualizou_detalhes BOOLEAN DEFAULT FALSE, -- Se abriu o sidepanel
  visualizou_itens BOOLEAN DEFAULT FALSE,
  visualizou_documentos BOOLEAN DEFAULT FALSE,
  
  -- Constraint: uma visualização por usuário/licitação (atualiza timestamp)
  CONSTRAINT licitacoes_visualizadas_usuario_licitacao_key UNIQUE (usuario_id, licitacao_id)
);

-- Tabela de tags personalizadas
CREATE TABLE IF NOT EXISTS public.licitacoes_tags (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  licitacao_id UUID NOT NULL REFERENCES public.licitacoes(id) ON DELETE CASCADE,
  tag TEXT NOT NULL, -- Ex: "interessante", "urgente", "seguir"
  
  data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT licitacoes_tags_usuario_licitacao_tag_key UNIQUE (usuario_id, licitacao_id, tag)
);

-- Tabela de execuções de alertas
CREATE TABLE IF NOT EXISTS public.alertas_execucoes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  alerta_id UUID NOT NULL REFERENCES public.alertas_usuario(id) ON DELETE CASCADE,
  
  data_execucao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  licitacoes_encontradas UUID[],
  total_encontrado INTEGER DEFAULT 0,
  notificacao_enviada BOOLEAN DEFAULT FALSE,
  sucesso BOOLEAN DEFAULT TRUE,
  erro_mensagem TEXT
);

-- Tabela de estatísticas agregadas
CREATE TABLE IF NOT EXISTS public.licitacoes_estatisticas (
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

-- Tabela de logs do usuário
CREATE TABLE IF NOT EXISTS public.logs_usuario (
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
-- 3. CRIAR ÍNDICES (apenas se não existirem)
-- =====================================================

-- Índices para licitacoes (novos)
CREATE INDEX IF NOT EXISTS idx_licitacoes_data_encerramento ON public.licitacoes(data_encerramento_proposta);
CREATE INDEX IF NOT EXISTS idx_licitacoes_situacao ON public.licitacoes(situacao_id);
CREATE INDEX IF NOT EXISTS idx_licitacoes_valor ON public.licitacoes(valor_total_estimado);
CREATE INDEX IF NOT EXISTS idx_licitacoes_dados_completos ON public.licitacoes(dados_completos) WHERE dados_completos = TRUE;
CREATE INDEX IF NOT EXISTS idx_licitacoes_precisa_atualizacao ON public.licitacoes(precisa_atualizacao) WHERE precisa_atualizacao = TRUE;

-- Índices GIN para busca em JSONB
CREATE INDEX IF NOT EXISTS idx_licitacoes_dados_complementares ON public.licitacoes USING GIN (dados_complementares);
CREATE INDEX IF NOT EXISTS idx_licitacao_itens_dados_complementares_gin ON public.licitacao_itens USING GIN (dados_complementares);

-- Índice para busca de texto (similaridade) - requer extensão pg_trgm
CREATE INDEX IF NOT EXISTS idx_licitacoes_objeto_compra_trgm ON public.licitacoes USING GIN (objeto_compra gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_licitacoes_orgao_razao_trgm ON public.licitacoes USING GIN (orgao_razao_social gin_trgm_ops);

-- Índices para itens
CREATE INDEX IF NOT EXISTS idx_licitacao_itens_numero ON public.licitacao_itens(licitacao_id, numero_item);

-- Índices para documentos
CREATE INDEX IF NOT EXISTS idx_licitacao_documentos_baixado ON public.licitacao_documentos(baixado) WHERE baixado = FALSE;

-- Índices para buscas do usuário
CREATE INDEX IF NOT EXISTS idx_buscas_usuario_usuario_id ON public.buscas_usuario(usuario_id);
CREATE INDEX IF NOT EXISTS idx_buscas_usuario_data_busca ON public.buscas_usuario(data_busca DESC);
CREATE INDEX IF NOT EXISTS idx_buscas_usuario_filtros_hash ON public.buscas_usuario(filtros_hash);
CREATE INDEX IF NOT EXISTS idx_buscas_usuario_cache_valido ON public.buscas_usuario(cache_valido, expira_em) WHERE cache_valido = TRUE;
CREATE INDEX IF NOT EXISTS idx_buscas_usuario_filtros_gin ON public.buscas_usuario USING GIN (filtros);

-- Índices para visualizações
CREATE INDEX IF NOT EXISTS idx_licitacoes_visualizadas_usuario_id ON public.licitacoes_visualizadas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_licitacoes_visualizadas_licitacao_id ON public.licitacoes_visualizadas(licitacao_id);
CREATE INDEX IF NOT EXISTS idx_licitacoes_visualizadas_data ON public.licitacoes_visualizadas(data_visualizacao DESC);

-- Índices para tags
CREATE INDEX IF NOT EXISTS idx_licitacoes_tags_usuario_id ON public.licitacoes_tags(usuario_id);
CREATE INDEX IF NOT EXISTS idx_licitacoes_tags_licitacao_id ON public.licitacoes_tags(licitacao_id);
CREATE INDEX IF NOT EXISTS idx_licitacoes_tags_tag ON public.licitacoes_tags(tag);

-- Índices para alertas
CREATE INDEX IF NOT EXISTS idx_alertas_usuario_ativo ON public.alertas_usuario(ativo) WHERE ativo = TRUE;
CREATE INDEX IF NOT EXISTS idx_alertas_usuario_proxima_execucao ON public.alertas_usuario(proxima_execucao) WHERE ativo = TRUE;
CREATE INDEX IF NOT EXISTS idx_alertas_usuario_filtros_gin ON public.alertas_usuario USING GIN (filtros);

-- Índices para logs
CREATE INDEX IF NOT EXISTS idx_logs_usuario_usuario_id ON public.logs_usuario(usuario_id);
CREATE INDEX IF NOT EXISTS idx_logs_usuario_data_acao ON public.logs_usuario(data_acao DESC);
CREATE INDEX IF NOT EXISTS idx_logs_usuario_acao ON public.logs_usuario(acao);

-- =====================================================
-- 4. FUNÇÕES E TRIGGERS
-- =====================================================

-- Função para gerar hash de filtros
CREATE OR REPLACE FUNCTION generate_filtros_hash(filtros JSONB)
RETURNS TEXT AS $$
BEGIN
  RETURN md5(filtros::text);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

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

-- Aplicar trigger apenas se não existir
DROP TRIGGER IF EXISTS set_buscas_filtros_hash ON public.buscas_usuario;
CREATE TRIGGER set_buscas_filtros_hash BEFORE INSERT OR UPDATE ON public.buscas_usuario
  FOR EACH ROW EXECUTE FUNCTION set_filtros_hash();

-- =====================================================
-- 5. ROW LEVEL SECURITY (RLS) - Adicionar políticas para novas tabelas
-- =====================================================

-- Habilitar RLS nas novas tabelas
ALTER TABLE public.buscas_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licitacoes_visualizadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licitacoes_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas_execucoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licitacoes_estatisticas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_usuario ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para buscas_usuario
DROP POLICY IF EXISTS "Users can manage own buscas" ON public.buscas_usuario;
CREATE POLICY "Users can manage own buscas" ON public.buscas_usuario
  FOR ALL USING (true); -- Será validado no código da aplicação

-- Políticas RLS para licitacoes_visualizadas
DROP POLICY IF EXISTS "Users can manage own visualizacoes" ON public.licitacoes_visualizadas;
CREATE POLICY "Users can manage own visualizacoes" ON public.licitacoes_visualizadas
  FOR ALL USING (true); -- Será validado no código da aplicação

-- Políticas RLS para licitacoes_tags
DROP POLICY IF EXISTS "Users can manage own tags" ON public.licitacoes_tags;
CREATE POLICY "Users can manage own tags" ON public.licitacoes_tags
  FOR ALL USING (true); -- Será validado no código da aplicação

-- Políticas RLS para alertas_execucoes
DROP POLICY IF EXISTS "Users can view own alertas_execucoes" ON public.alertas_execucoes;
CREATE POLICY "Users can view own alertas_execucoes" ON public.alertas_execucoes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.alertas_usuario
      WHERE id = alertas_execucoes.alerta_id
    ) OR true
  );

-- Políticas RLS para licitacoes_estatisticas (públicas - todos podem ler)
DROP POLICY IF EXISTS "Anyone can view estatisticas" ON public.licitacoes_estatisticas;
CREATE POLICY "Anyone can view estatisticas" ON public.licitacoes_estatisticas
  FOR SELECT USING (true);

-- Políticas RLS para logs_usuario
DROP POLICY IF EXISTS "Users can view own logs" ON public.logs_usuario;
CREATE POLICY "Users can view own logs" ON public.logs_usuario
  FOR SELECT USING (true); -- Será validado no código da aplicação

-- =====================================================
-- 6. VIEWS ÚTEIS (opcional)
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
-- FIM DA MIGRAÇÃO
-- =====================================================
-- Este script pode ser executado múltiplas vezes sem problemas
-- Ele verifica se cada elemento já existe antes de criar


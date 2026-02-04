-- ============================================
-- Tabela: licitacoes
-- Armazena licitações sincronizadas do PNCP e usadas pelo filtro por preferência.
-- A aplicação busca da API PNCP e grava aqui; a listagem e o filtro leem desta tabela.
-- ============================================

CREATE TABLE IF NOT EXISTS licitacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_controle_pncp text NOT NULL,
  numero_compra text,
  ano_compra integer,
  processo text,
  objeto_compra text,
  informacao_complementar text,
  modalidade_id integer,
  modalidade_nome text,
  modo_disputa_id integer,
  modo_disputa_nome text,
  situacao_id integer,
  situacao_nome text,
  valor_total_estimado numeric(18,2),
  valor_total_homologado numeric(18,2),
  data_abertura_proposta timestamptz,
  data_encerramento_proposta timestamptz,
  data_publicacao_pncp timestamptz,
  link_sistema_origem text,
  orgao_cnpj text,
  orgao_razao_social text,
  orgao_poder_id integer,
  orgao_esfera_id integer,
  unidade_codigo text,
  unidade_nome text,
  municipio_codigo_ibge text,
  municipio_nome text,
  uf_sigla text,
  uf_nome text,
  sincronizado_em timestamptz,
  data_atualizacao timestamptz,
  -- Campos usados pelo frontend (detalhes completos, anexos, itens)
  dados_completos jsonb,
  anexos jsonb,
  itens jsonb,
  CONSTRAINT licitacoes_numero_controle_pncp_unique UNIQUE (numero_controle_pncp)
);

CREATE INDEX IF NOT EXISTS idx_licitacoes_data_publicacao
  ON licitacoes(data_publicacao_pncp DESC);
CREATE INDEX IF NOT EXISTS idx_licitacoes_uf_sigla
  ON licitacoes(uf_sigla);
CREATE INDEX IF NOT EXISTS idx_licitacoes_numero_controle
  ON licitacoes(numero_controle_pncp);
CREATE INDEX IF NOT EXISTS idx_licitacoes_data_atualizacao
  ON licitacoes(data_atualizacao DESC);

COMMENT ON TABLE licitacoes IS 'Licitações do PNCP sincronizadas para filtro por setores/estados e listagem.';

-- RLS (Row Level Security): permitir leitura para usuários autenticados
ALTER TABLE licitacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios autenticados podem ler licitacoes" ON licitacoes;
CREATE POLICY "Usuarios autenticados podem ler licitacoes"
  ON licitacoes FOR SELECT
  TO authenticated
  USING (true);

  

-- Inserção/atualização: use service_role na sincronização (backend) ou permitir anon/authenticated se preferir
DROP POLICY IF EXISTS "Service role pode inserir atualizar licitacoes" ON licitacoes;
CREATE POLICY "Service role pode inserir atualizar licitacoes"
  ON licitacoes FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

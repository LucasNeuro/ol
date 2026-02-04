-- ============================================
-- OBRIGATÓRIO para filtro robusto
-- Rode este script no Supabase: SQL Editor → New query → cole o conteúdo → Run.
-- Sem esta tabela, o sistema usa só fallback no código (menos preciso).
-- ============================================
-- Tabela: setores_palavras_fortes
-- Palavras que provam que um edital é daquele setor (filtro dinâmico).
-- setor_nome = chave normalizada do setor (ex: saude, engenharia, alimentacao).
--
-- COMO GERENCIAR (dinâmico):
-- - Inserir: INSERT INTO setores_palavras_fortes (setor_nome, palavra) VALUES ('saude', 'nova_palavra');
-- - Desativar: UPDATE setores_palavras_fortes SET ativo = false WHERE setor_nome = 'saude' AND palavra = 'x';
-- - Novo setor: use setor_nome igual ao nome normalizado do setor (ex: 'agropecuaria', 'didatico').
-- O frontend mescla estes dados com o fallback do código (banco sobrescreve/estende).
-- ============================================

CREATE TABLE IF NOT EXISTS setores_palavras_fortes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setor_nome text NOT NULL,
  palavra text NOT NULL,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(setor_nome, palavra)
);

CREATE INDEX IF NOT EXISTS idx_setores_palavras_fortes_setor_nome
  ON setores_palavras_fortes(setor_nome);
CREATE INDEX IF NOT EXISTS idx_setores_palavras_fortes_ativo
  ON setores_palavras_fortes(ativo) WHERE ativo = true;

COMMENT ON TABLE setores_palavras_fortes IS 'Palavras fortes por setor para filtro de licitações (dinâmico). Se o edital só tiver correspondências genéricas, exige pelo menos uma palavra forte do setor cadastrado.';

-- RLS: permitir que usuários autenticados leiam e insiram (para popular a tabela a partir do cadastro)
ALTER TABLE setores_palavras_fortes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura para autenticados" ON setores_palavras_fortes;
CREATE POLICY "Leitura para autenticados"
  ON setores_palavras_fortes FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Inserir para autenticados (sync a partir do cadastro)" ON setores_palavras_fortes;
CREATE POLICY "Inserir para autenticados (sync a partir do cadastro)"
  ON setores_palavras_fortes FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Dados iniciais (equivalentes ao fallback do código; novos termos vêm do cadastro)
INSERT INTO setores_palavras_fortes (setor_nome, palavra) VALUES
  ('saude', 'medicamento'),
  ('saude', 'medicamentos'),
  ('saude', 'hospitalar'),
  ('saude', 'laboratorial'),
  ('saude', 'medico'),
  ('saude', 'saude'),
  ('saude', 'hospital'),
  ('saude', 'laboratorio'),
  ('saude', 'radiologico'),
  ('saude', 'raio-x'),
  ('saude', 'dieta'),
  ('saude', 'enteral'),
  ('saude', 'parenteral'),
  ('saude', 'utensilio'),
  ('saude', 'vacina'),
  ('saude', 'vacinas'),
  ('saude', 'exame medico'),
  ('saude', 'analise laboratorial'),
  ('alimentacao', 'alimentacao'),
  ('alimentacao', 'alimento'),
  ('alimentacao', 'cesta basica'),
  ('alimentacao', 'refeicao'),
  ('alimentacao', 'copa'),
  ('alimentacao', 'buffet'),
  ('alimentacao', 'bebida'),
  ('alimentacao', 'bebidas'),
  ('alimentacao', 'generos alimenticios'),
  ('informatica', 'informatica'),
  ('informatica', 'computador'),
  ('informatica', 'software'),
  ('informatica', 'hardware'),
  ('informatica', 'sistema de informacao'),
  ('informatica', 'ti'),
  ('informatica', 'tecnologia'),
  ('engenharia', 'construcao'),
  ('engenharia', 'obra'),
  ('engenharia', 'edificacao'),
  ('engenharia', 'pavimentacao'),
  ('engenharia', 'reforma'),
  ('engenharia', 'saneamento'),
  ('engenharia', 'drenagem'),
  ('engenharia', 'asfalto'),
  ('engenharia', 'concreto'),
  ('engenharia', 'terraplanagem'),
  ('engenharia', 'demolicao'),
  ('engenharia', 'viaduto'),
  ('engenharia', 'tunel'),
  ('engenharia', 'passarela'),
  ('transporte', 'veiculo'),
  ('transporte', 'transporte'),
  ('transporte', 'frota'),
  ('transporte', 'onibus'),
  ('transporte', 'caminhao'),
  ('transporte', 'ambulancia'),
  ('transporte', 'motocicleta'),
  ('transporte', 'locacao de veiculos'),
  ('seguranca', 'seguranca'),
  ('seguranca', 'protecao'),
  ('seguranca', 'epi'),
  ('seguranca', 'armamento'),
  ('seguranca', 'vigilancia'),
  ('seguranca', 'protecao individual')
ON CONFLICT (setor_nome, palavra) DO NOTHING;

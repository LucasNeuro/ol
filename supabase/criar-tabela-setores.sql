-- Script para criar tabelas de setores e subsetores
-- Estrutura hierárquica que permite gerenciamento dinâmico

-- Tabela de Setores Principais
CREATE TABLE IF NOT EXISTS public.setores (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  nome text NOT NULL,
  descricao text NULL,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT setores_pkey PRIMARY KEY (id),
  CONSTRAINT setores_nome_key UNIQUE (nome)
);

-- Tabela de Subsetores (atividades dentro de cada setor)
CREATE TABLE IF NOT EXISTS public.subsetores (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  setor_id uuid NOT NULL,
  nome text NOT NULL,
  descricao text NULL,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT subsetores_pkey PRIMARY KEY (id),
  CONSTRAINT subsetores_setor_id_fkey FOREIGN KEY (setor_id) 
    REFERENCES public.setores(id) ON DELETE CASCADE
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_setores_ativo ON public.setores(ativo) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_setores_ordem ON public.setores(ordem);
CREATE INDEX IF NOT EXISTS idx_subsetores_setor_id ON public.subsetores(setor_id);
CREATE INDEX IF NOT EXISTS idx_subsetores_ativo ON public.subsetores(ativo) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_subsetores_ordem ON public.subsetores(ordem);

-- Triggers para updated_at
CREATE OR REPLACE FUNCTION update_setores_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_setores_updated_at
  BEFORE UPDATE ON public.setores
  FOR EACH ROW
  EXECUTE FUNCTION update_setores_updated_at();

CREATE TRIGGER trigger_update_subsetores_updated_at
  BEFORE UPDATE ON public.subsetores
  FOR EACH ROW
  EXECUTE FUNCTION update_setores_updated_at();

-- Comentários
COMMENT ON TABLE public.setores IS 'Setores principais de atuação da economia brasileira';
COMMENT ON TABLE public.subsetores IS 'Subsetores (atividades) dentro de cada setor principal';
COMMENT ON COLUMN public.setores.ordem IS 'Ordem de exibição (menor número aparece primeiro)';
COMMENT ON COLUMN public.subsetores.ordem IS 'Ordem de exibição dentro do setor';


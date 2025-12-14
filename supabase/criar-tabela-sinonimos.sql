-- Criar tabela de sinônimos para melhorar o filtro semântico
-- Permite gerenciar sinônimos dinamicamente no banco de dados

CREATE TABLE IF NOT EXISTS public.sinonimos (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  palavra_base text NOT NULL,
  sinonimo text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  peso integer NOT NULL DEFAULT 1, -- Peso da correspondência (1-10, maior = mais relevante)
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sinonimos_pkey PRIMARY KEY (id),
  CONSTRAINT sinonimos_palavra_sinonimo_unique UNIQUE (palavra_base, sinonimo)
) TABLESPACE pg_default;

-- Índices para busca eficiente
CREATE INDEX IF NOT EXISTS idx_sinonimos_palavra_base 
ON public.sinonimos USING btree (palavra_base) 
WHERE (ativo = true);

CREATE INDEX IF NOT EXISTS idx_sinonimos_sinonimo 
ON public.sinonimos USING btree (sinonimo) 
WHERE (ativo = true);

CREATE INDEX IF NOT EXISTS idx_sinonimos_ativo 
ON public.sinonimos USING btree (ativo) 
WHERE (ativo = true);

-- Trigger para atualizar updated_at
CREATE TRIGGER trigger_update_sinonimos_updated_at 
BEFORE UPDATE ON public.sinonimos 
FOR EACH ROW 
EXECUTE FUNCTION update_setores_updated_at();

-- Tabela de relacionamento: quais sinônimos pertencem a quais setores
-- Isso permite que sinônimos sejam específicos por setor
CREATE TABLE IF NOT EXISTS public.setores_sinonimos (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  setor_id uuid NOT NULL,
  sinonimo_id uuid NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT setores_sinonimos_pkey PRIMARY KEY (id),
  CONSTRAINT setores_sinonimos_setor_id_fkey 
    FOREIGN KEY (setor_id) REFERENCES public.setores(id) ON DELETE CASCADE,
  CONSTRAINT setores_sinonimos_sinonimo_id_fkey 
    FOREIGN KEY (sinonimo_id) REFERENCES public.sinonimos(id) ON DELETE CASCADE,
  CONSTRAINT setores_sinonimos_unique UNIQUE (setor_id, sinonimo_id)
) TABLESPACE pg_default;

-- Índices para busca eficiente
CREATE INDEX IF NOT EXISTS idx_setores_sinonimos_setor_id 
ON public.setores_sinonimos USING btree (setor_id) 
WHERE (ativo = true);

CREATE INDEX IF NOT EXISTS idx_setores_sinonimos_sinonimo_id 
ON public.setores_sinonimos USING btree (sinonimo_id) 
WHERE (ativo = true);

-- Comentários explicativos
COMMENT ON TABLE public.sinonimos IS 
'Tabela de sinônimos para melhorar correspondência semântica no filtro de licitações';

COMMENT ON TABLE public.setores_sinonimos IS 
'Relacionamento entre setores e seus sinônimos específicos';

COMMENT ON COLUMN public.sinonimos.peso IS 
'Peso da correspondência (1-10). Maior peso = correspondência mais relevante e precisa';


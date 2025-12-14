-- Script para configurar RLS (Row Level Security) nas tabelas de setores
-- Permite leitura pública (sem autenticação) para setores e subsetores

-- Habilitar RLS nas tabelas
ALTER TABLE public.setores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subsetores ENABLE ROW LEVEL SECURITY;

-- Política para permitir leitura pública de setores ativos
CREATE POLICY "Permitir leitura pública de setores ativos"
ON public.setores
FOR SELECT
USING (ativo = true);

-- Política para permitir leitura pública de subsetores ativos
CREATE POLICY "Permitir leitura pública de subsetores ativos"
ON public.subsetores
FOR SELECT
USING (ativo = true);

-- Se quiser permitir leitura de todos (incluindo inativos), use:
-- DROP POLICY IF EXISTS "Permitir leitura pública de setores ativos" ON public.setores;
-- DROP POLICY IF EXISTS "Permitir leitura pública de subsetores ativos" ON public.subsetores;
-- 
-- CREATE POLICY "Permitir leitura pública de setores"
-- ON public.setores
-- FOR SELECT
-- USING (true);
-- 
-- CREATE POLICY "Permitir leitura pública de subsetores"
-- ON public.subsetores
-- FOR SELECT
-- USING (true);


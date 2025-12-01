-- Script para corrigir políticas RLS das tabelas de licitações
-- Execute este script no SQL Editor do Supabase

-- =====================================================
-- 1. REMOVER POLÍTICAS ANTIGAS (se existirem)
-- =====================================================

DROP POLICY IF EXISTS "Anyone can view licitacoes" ON public.licitacoes;
DROP POLICY IF EXISTS "Anyone can insert licitacoes" ON public.licitacoes;
DROP POLICY IF EXISTS "Anyone can update licitacoes" ON public.licitacoes;
DROP POLICY IF EXISTS "Anyone can delete licitacoes" ON public.licitacoes;

DROP POLICY IF EXISTS "Anyone can view licitacao_itens" ON public.licitacao_itens;
DROP POLICY IF EXISTS "Anyone can insert licitacao_itens" ON public.licitacao_itens;
DROP POLICY IF EXISTS "Anyone can update licitacao_itens" ON public.licitacao_itens;
DROP POLICY IF EXISTS "Anyone can delete licitacao_itens" ON public.licitacao_itens;

DROP POLICY IF EXISTS "Anyone can view licitacao_documentos" ON public.licitacao_documentos;
DROP POLICY IF EXISTS "Anyone can insert licitacao_documentos" ON public.licitacao_documentos;
DROP POLICY IF EXISTS "Anyone can update licitacao_documentos" ON public.licitacao_documentos;
DROP POLICY IF EXISTS "Anyone can delete licitacao_documentos" ON public.licitacao_documentos;

-- =====================================================
-- 2. GARANTIR QUE RLS ESTÁ HABILITADO
-- =====================================================

ALTER TABLE public.licitacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licitacao_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licitacao_documentos ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 3. CRIAR POLÍTICAS PÚBLICAS (qualquer um pode acessar)
-- =====================================================

-- LICITAÇÕES: Totalmente públicas
CREATE POLICY "Anyone can view licitacoes" ON public.licitacoes
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert licitacoes" ON public.licitacoes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update licitacoes" ON public.licitacoes
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete licitacoes" ON public.licitacoes
  FOR DELETE USING (true);

-- ITENS: Totalmente públicos
CREATE POLICY "Anyone can view licitacao_itens" ON public.licitacao_itens
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert licitacao_itens" ON public.licitacao_itens
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update licitacao_itens" ON public.licitacao_itens
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete licitacao_itens" ON public.licitacao_itens
  FOR DELETE USING (true);

-- DOCUMENTOS: Totalmente públicos
CREATE POLICY "Anyone can view licitacao_documentos" ON public.licitacao_documentos
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert licitacao_documentos" ON public.licitacao_documentos
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update licitacao_documentos" ON public.licitacao_documentos
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete licitacao_documentos" ON public.licitacao_documentos
  FOR DELETE USING (true);

-- =====================================================
-- 4. VERIFICAR SE AS POLÍTICAS FORAM CRIADAS
-- =====================================================

-- Execute esta query para verificar:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
-- FROM pg_policies 
-- WHERE tablename IN ('licitacoes', 'licitacao_itens', 'licitacao_documentos')
-- ORDER BY tablename, policyname;


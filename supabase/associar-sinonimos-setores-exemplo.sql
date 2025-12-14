-- Script de exemplo para associar sinônimos a setores específicos
-- Execute após popular a tabela sinonimos

-- ============================================
-- ASSOCIAR SINÔNIMOS AO SETOR "ENGENHARIA SERVIÇOS"
-- ============================================

-- Sinônimos de "manutenção" para Engenharia
INSERT INTO public.setores_sinonimos (setor_id, sinonimo_id, ativo)
SELECT 
  s.id as setor_id,
  sin.id as sinonimo_id,
  true as ativo
FROM public.setores s
CROSS JOIN public.sinonimos sin
WHERE s.nome = 'Engenharia Serviços'
  AND sin.palavra_base = 'manutenção'
  AND sin.sinonimo IN (
    'manutenção de equipamentos de construção',
    'manutenção predial',
    'manutenção de instalações',
    'manutenção de sistemas elétricos',
    'manutenção de sistemas hidráulicos',
    'manutenção de equipamentos',
    'manutenção preventiva',
    'manutenção corretiva'
  )
  AND sin.ativo = true
ON CONFLICT (setor_id, sinonimo_id) DO NOTHING;

-- Sinônimos de "instalação" para Engenharia
INSERT INTO public.setores_sinonimos (setor_id, sinonimo_id, ativo)
SELECT 
  s.id as setor_id,
  sin.id as sinonimo_id,
  true as ativo
FROM public.setores s
CROSS JOIN public.sinonimos sin
WHERE s.nome = 'Engenharia Serviços'
  AND sin.palavra_base = 'instalação'
  AND sin.sinonimo IN (
    'instalação de equipamentos',
    'instalação de sistemas',
    'instalação elétrica',
    'instalação hidráulica',
    'instalação de sistemas elétricos',
    'instalação de sistemas hidráulicos',
    'montagem de equipamentos',
    'montagem de estruturas'
  )
  AND sin.ativo = true
ON CONFLICT (setor_id, sinonimo_id) DO NOTHING;

-- ============================================
-- ASSOCIAR SINÔNIMOS AO SETOR "INFORMÁTICA"
-- ============================================

-- Sinônimos de "manutenção" para Informática
INSERT INTO public.setores_sinonimos (setor_id, sinonimo_id, ativo)
SELECT 
  s.id as setor_id,
  sin.id as sinonimo_id,
  true as ativo
FROM public.setores s
CROSS JOIN public.sinonimos sin
WHERE s.nome = 'Informática'
  AND sin.palavra_base = 'manutenção'
  AND sin.sinonimo IN (
    'manutenção de computadores',
    'manutenção de equipamentos de informática',
    'manutenção de sistemas',
    'manutenção de equipamentos de informática',
    'suporte técnico',
    'manutenção preventiva',
    'manutenção corretiva'
  )
  AND sin.ativo = true
ON CONFLICT (setor_id, sinonimo_id) DO NOTHING;

-- Sinônimos de "instalação" para Informática
INSERT INTO public.setores_sinonimos (setor_id, sinonimo_id, ativo)
SELECT 
  s.id as setor_id,
  sin.id as sinonimo_id,
  true as ativo
FROM public.setores s
CROSS JOIN public.sinonimos sin
WHERE s.nome = 'Informática'
  AND sin.palavra_base = 'instalação'
  AND sin.sinonimo IN (
    'instalação de software',
    'instalação de sistemas',
    'instalação de equipamentos de informática',
    'instalação de computadores',
    'instalação de sistemas informatizados',
    'montagem de computadores',
    'montagem de equipamentos de informática'
  )
  AND sin.ativo = true
ON CONFLICT (setor_id, sinonimo_id) DO NOTHING;

-- ============================================
-- ASSOCIAR SINÔNIMOS AO SETOR "LIMPEZA"
-- ============================================

-- Sinônimos de "limpeza" para Limpeza Predial
INSERT INTO public.setores_sinonimos (setor_id, sinonimo_id, ativo)
SELECT 
  s.id as setor_id,
  sin.id as sinonimo_id,
  true as ativo
FROM public.setores s
CROSS JOIN public.sinonimos sin
WHERE s.nome = 'Limpeza'
  AND sin.palavra_base = 'limpeza'
  AND sin.sinonimo IN (
    'limpeza predial',
    'limpeza de prédios',
    'limpeza de edifícios',
    'limpeza de escritórios',
    'limpeza de áreas comuns',
    'serviço de limpeza',
    'prestação de serviço de limpeza',
    'higienização',
    'assepsia'
  )
  AND sin.ativo = true
ON CONFLICT (setor_id, sinonimo_id) DO NOTHING;

-- ============================================
-- VERIFICAR ASSOCIAÇÕES CRIADAS
-- ============================================

SELECT 
  s.nome as setor,
  sin.palavra_base,
  sin.sinonimo,
  ss.ativo
FROM public.setores_sinonimos ss
JOIN public.setores s ON s.id = ss.setor_id
JOIN public.sinonimos sin ON sin.id = ss.sinonimo_id
WHERE ss.ativo = true
ORDER BY s.nome, sin.palavra_base, sin.sinonimo;

-- ============================================
-- ESTATÍSTICAS
-- ============================================

SELECT 
  COUNT(*) as total_associacoes,
  COUNT(DISTINCT setor_id) as setores_com_sinonimos,
  COUNT(DISTINCT sinonimo_id) as sinonimos_associados
FROM public.setores_sinonimos
WHERE ativo = true;


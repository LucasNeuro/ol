-- Script de diagnóstico para verificar sinônimos e setores
-- Execute este script para entender por que não há associações

-- ============================================
-- 1. VERIFICAR SETORES EXISTENTES
-- ============================================
SELECT 
  'SETORES EXISTENTES' as tipo,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE ativo = true) as ativos,
  COUNT(*) FILTER (WHERE ativo = false) as inativos
FROM public.setores;

-- Listar todos os setores
SELECT 
  id,
  nome,
  ativo,
  ordem,
  created_at
FROM public.setores
ORDER BY ordem, nome
LIMIT 50;

-- ============================================
-- 2. VERIFICAR SINÔNIMOS EXISTENTES
-- ============================================
SELECT 
  'SINÔNIMOS EXISTENTES' as tipo,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE ativo = true) as ativos,
  COUNT(*) FILTER (WHERE ativo = false) as inativos,
  COUNT(DISTINCT palavra_base) as palavras_base_unicas
FROM public.sinonimos;

-- Listar palavras-base únicas
SELECT 
  palavra_base,
  COUNT(*) as total_sinonimos,
  COUNT(*) FILTER (WHERE ativo = true) as sinonimos_ativos
FROM public.sinonimos
GROUP BY palavra_base
ORDER BY total_sinonimos DESC
LIMIT 20;

-- ============================================
-- 3. VERIFICAR SE OS SETORES DO SCRIPT EXISTEM
-- ============================================
SELECT 
  'VERIFICAÇÃO DE SETORES DO SCRIPT' as tipo,
  CASE 
    WHEN EXISTS (SELECT 1 FROM public.setores WHERE nome = 'Engenharia Serviços') 
    THEN '✅ Existe' 
    ELSE '❌ NÃO existe' 
  END as engenharia_servicos,
  CASE 
    WHEN EXISTS (SELECT 1 FROM public.setores WHERE nome = 'Informática') 
    THEN '✅ Existe' 
    ELSE '❌ NÃO existe' 
  END as informatica,
  CASE 
    WHEN EXISTS (SELECT 1 FROM public.setores WHERE nome = 'Limpeza') 
    THEN '✅ Existe' 
    ELSE '❌ NÃO existe' 
  END as limpeza;

-- Buscar setores similares (pode ter diferença de maiúsculas/minúsculas ou acentos)
SELECT 
  id,
  nome,
  ativo
FROM public.setores
WHERE 
  LOWER(UNACCENT(nome)) LIKE LOWER(UNACCENT('%engenharia%')) OR
  LOWER(UNACCENT(nome)) LIKE LOWER(UNACCENT('%informática%')) OR
  LOWER(UNACCENT(nome)) LIKE LOWER(UNACCENT('%informatica%')) OR
  LOWER(UNACCENT(nome)) LIKE LOWER(UNACCENT('%limpeza%'))
ORDER BY nome;

-- ============================================
-- 4. VERIFICAR SE OS SINÔNIMOS DO SCRIPT EXISTEM
-- ============================================
-- Verificar sinônimos de "manutenção"
SELECT 
  'SINÔNIMOS DE MANUTENÇÃO' as tipo,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE ativo = true) as ativos
FROM public.sinonimos
WHERE palavra_base = 'manutenção' OR palavra_base = 'manutencao';

-- Listar alguns sinônimos de manutenção
SELECT 
  id,
  palavra_base,
  sinonimo,
  peso,
  ativo
FROM public.sinonimos
WHERE (palavra_base = 'manutenção' OR palavra_base = 'manutencao')
  AND ativo = true
ORDER BY peso DESC, sinonimo
LIMIT 20;

-- Verificar sinônimos de "instalação"
SELECT 
  'SINÔNIMOS DE INSTALAÇÃO' as tipo,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE ativo = true) as ativos
FROM public.sinonimos
WHERE palavra_base = 'instalação' OR palavra_base = 'instalacao';

-- Listar alguns sinônimos de instalação
SELECT 
  id,
  palavra_base,
  sinonimo,
  peso,
  ativo
FROM public.sinonimos
WHERE (palavra_base = 'instalação' OR palavra_base = 'instalacao')
  AND ativo = true
ORDER BY peso DESC, sinonimo
LIMIT 20;

-- Verificar sinônimos de "limpeza"
SELECT 
  'SINÔNIMOS DE LIMPEZA' as tipo,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE ativo = true) as ativos
FROM public.sinonimos
WHERE palavra_base = 'limpeza';

-- Listar alguns sinônimos de limpeza
SELECT 
  id,
  palavra_base,
  sinonimo,
  peso,
  ativo
FROM public.sinonimos
WHERE palavra_base = 'limpeza'
  AND ativo = true
ORDER BY peso DESC, sinonimo
LIMIT 20;

-- ============================================
-- 5. VERIFICAR SINÔNIMOS ESPECÍFICOS DO SCRIPT
-- ============================================
-- Verificar se os sinônimos específicos mencionados no script existem
SELECT 
  'VERIFICAÇÃO DE SINÔNIMOS ESPECÍFICOS' as tipo,
  sinonimo,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM public.sinonimos 
      WHERE LOWER(UNACCENT(sinonimo)) = LOWER(UNACCENT(s.sinonimo))
        AND ativo = true
    ) 
    THEN '✅ Existe' 
    ELSE '❌ NÃO existe' 
  END as status
FROM (
  VALUES 
    ('manutenção de equipamentos de construção'),
    ('manutenção predial'),
    ('manutenção de instalações'),
    ('manutenção de computadores'),
    ('manutenção de equipamentos de informática'),
    ('instalação de equipamentos'),
    ('instalação de software'),
    ('limpeza predial'),
    ('limpeza de prédios')
) AS s(sinonimo);

-- ============================================
-- 6. VERIFICAR ASSOCIAÇÕES EXISTENTES
-- ============================================
SELECT 
  'ASSOCIAÇÕES EXISTENTES' as tipo,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE ativo = true) as ativas,
  COUNT(DISTINCT setor_id) as setores_com_sinonimos,
  COUNT(DISTINCT sinonimo_id) as sinonimos_associados
FROM public.setores_sinonimos;

-- Listar associações existentes
SELECT 
  s.nome as setor,
  sin.palavra_base,
  sin.sinonimo,
  ss.ativo,
  ss.created_at
FROM public.setores_sinonimos ss
JOIN public.setores s ON s.id = ss.setor_id
JOIN public.sinonimos sin ON sin.id = ss.sinonimo_id
ORDER BY s.nome, sin.palavra_base, sin.sinonimo
LIMIT 50;

-- ============================================
-- 7. TESTE DE CORRESPONDÊNCIA (SIMULAÇÃO)
-- ============================================
-- Simular o que o script tentaria fazer
SELECT 
  'TESTE DE CORRESPONDÊNCIA' as tipo,
  s.nome as setor_encontrado,
  sin.palavra_base,
  sin.sinonimo,
  s.ativo as setor_ativo,
  sin.ativo as sinonimo_ativo
FROM public.setores s
CROSS JOIN public.sinonimos sin
WHERE 
  (s.nome = 'Engenharia Serviços' OR s.nome ILIKE '%engenharia%')
  AND (sin.palavra_base = 'manutenção' OR sin.palavra_base = 'manutencao')
  AND sin.ativo = true
  AND s.ativo = true
LIMIT 10;


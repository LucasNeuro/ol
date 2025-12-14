-- Script dinâmico para associar sinônimos a setores
-- Este script busca os setores e sinônimos existentes e cria associações automaticamente
-- Execute após popular a tabela sinonimos e verificar os nomes dos setores

-- ============================================
-- FUNÇÃO AUXILIAR: Buscar setor por nome (case-insensitive)
-- ============================================
CREATE OR REPLACE FUNCTION buscar_setor_por_nome(nome_buscado TEXT)
RETURNS UUID AS $$
DECLARE
  setor_id UUID;
BEGIN
  SELECT id INTO setor_id
  FROM public.setores
  WHERE LOWER(UNACCENT(nome)) = LOWER(UNACCENT(nome_buscado))
    AND ativo = true
  LIMIT 1;
  
  RETURN setor_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNÇÃO AUXILIAR: Buscar sinônimo por palavra e sinonimo
-- ============================================
CREATE OR REPLACE FUNCTION buscar_sinonimo(palavra_base_buscada TEXT, sinonimo_buscado TEXT)
RETURNS UUID AS $$
DECLARE
  sinonimo_id UUID;
BEGIN
  SELECT id INTO sinonimo_id
  FROM public.sinonimos
  WHERE LOWER(UNACCENT(palavra_base)) = LOWER(UNACCENT(palavra_base_buscada))
    AND LOWER(UNACCENT(sinonimo)) = LOWER(UNACCENT(sinonimo_buscado))
    AND ativo = true
  LIMIT 1;
  
  RETURN sinonimo_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ASSOCIAR SINÔNIMOS AO SETOR "ENGENHARIA" (busca flexível)
-- ============================================

-- Sinônimos de "manutenção" para Engenharia
DO $$
DECLARE
  setor_id UUID;
  sinonimo_id UUID;
  sinonimos_engenharia TEXT[] := ARRAY[
    'manutenção de equipamentos de construção',
    'manutenção predial',
    'manutenção de instalações',
    'manutenção de sistemas elétricos',
    'manutenção de sistemas hidráulicos',
    'manutenção de equipamentos',
    'manutenção preventiva',
    'manutenção corretiva'
  ];
  sinonimo TEXT;
BEGIN
  -- Buscar setor (tenta vários nomes possíveis)
  SELECT id INTO setor_id
  FROM public.setores
  WHERE (
    LOWER(UNACCENT(nome)) LIKE LOWER(UNACCENT('%engenharia%')) OR
    LOWER(UNACCENT(nome)) = LOWER(UNACCENT('Engenharia Serviços')) OR
    LOWER(UNACCENT(nome)) = LOWER(UNACCENT('Engenharia'))
  )
  AND ativo = true
  LIMIT 1;
  
  IF setor_id IS NULL THEN
    RAISE NOTICE 'Setor de Engenharia não encontrado. Verifique os nomes na tabela setores.';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Setor encontrado: %', setor_id;
  
  -- Associar sinônimos
  FOREACH sinonimo IN ARRAY sinonimos_engenharia
  LOOP
    SELECT buscar_sinonimo('manutenção', sinonimo) INTO sinonimo_id;
    
    IF sinonimo_id IS NOT NULL THEN
      INSERT INTO public.setores_sinonimos (setor_id, sinonimo_id, ativo)
      VALUES (setor_id, sinonimo_id, true)
      ON CONFLICT (setor_id, sinonimo_id) DO UPDATE SET ativo = true;
      
      RAISE NOTICE 'Associado: %', sinonimo;
    ELSE
      RAISE NOTICE 'Sinônimo não encontrado: %', sinonimo;
    END IF;
  END LOOP;
END $$;

-- Sinônimos de "instalação" para Engenharia
DO $$
DECLARE
  setor_id UUID;
  sinonimo_id UUID;
  sinonimos_engenharia TEXT[] := ARRAY[
    'instalação de equipamentos',
    'instalação de sistemas',
    'instalação elétrica',
    'instalação hidráulica',
    'instalação de sistemas elétricos',
    'instalação de sistemas hidráulicos',
    'montagem de equipamentos',
    'montagem de estruturas'
  ];
  sinonimo TEXT;
BEGIN
  SELECT id INTO setor_id
  FROM public.setores
  WHERE (
    LOWER(UNACCENT(nome)) LIKE LOWER(UNACCENT('%engenharia%')) OR
    LOWER(UNACCENT(nome)) = LOWER(UNACCENT('Engenharia Serviços'))
  )
  AND ativo = true
  LIMIT 1;
  
  IF setor_id IS NULL THEN RETURN; END IF;
  
  FOREACH sinonimo IN ARRAY sinonimos_engenharia
  LOOP
    SELECT buscar_sinonimo('instalação', sinonimo) INTO sinonimo_id;
    
    IF sinonimo_id IS NOT NULL THEN
      INSERT INTO public.setores_sinonimos (setor_id, sinonimo_id, ativo)
      VALUES (setor_id, sinonimo_id, true)
      ON CONFLICT (setor_id, sinonimo_id) DO UPDATE SET ativo = true;
    END IF;
  END LOOP;
END $$;

-- ============================================
-- ASSOCIAR SINÔNIMOS AO SETOR "INFORMÁTICA"
-- ============================================

-- Sinônimos de "manutenção" para Informática
DO $$
DECLARE
  setor_id UUID;
  sinonimo_id UUID;
  sinonimos_informatica TEXT[] := ARRAY[
    'manutenção de computadores',
    'manutenção de equipamentos de informática',
    'manutenção de sistemas',
    'suporte técnico',
    'manutenção preventiva',
    'manutenção corretiva'
  ];
  sinonimo TEXT;
BEGIN
  SELECT id INTO setor_id
  FROM public.setores
  WHERE (
    LOWER(UNACCENT(nome)) = LOWER(UNACCENT('Informática')) OR
    LOWER(UNACCENT(nome)) = LOWER(UNACCENT('Informatica')) OR
    LOWER(UNACCENT(nome)) LIKE LOWER(UNACCENT('%informática%')) OR
    LOWER(UNACCENT(nome)) LIKE LOWER(UNACCENT('%informatica%'))
  )
  AND ativo = true
  LIMIT 1;
  
  IF setor_id IS NULL THEN
    RAISE NOTICE 'Setor de Informática não encontrado. Verifique os nomes na tabela setores.';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Setor Informática encontrado: %', setor_id;
  
  FOREACH sinonimo IN ARRAY sinonimos_informatica
  LOOP
    SELECT buscar_sinonimo('manutenção', sinonimo) INTO sinonimo_id;
    
    IF sinonimo_id IS NOT NULL THEN
      INSERT INTO public.setores_sinonimos (setor_id, sinonimo_id, ativo)
      VALUES (setor_id, sinonimo_id, true)
      ON CONFLICT (setor_id, sinonimo_id) DO UPDATE SET ativo = true;
      
      RAISE NOTICE 'Associado: %', sinonimo;
    ELSE
      RAISE NOTICE 'Sinônimo não encontrado: %', sinonimo;
    END IF;
  END LOOP;
END $$;

-- Sinônimos de "instalação" para Informática
DO $$
DECLARE
  setor_id UUID;
  sinonimo_id UUID;
  sinonimos_informatica TEXT[] := ARRAY[
    'instalação de software',
    'instalação de sistemas',
    'instalação de equipamentos de informática',
    'instalação de computadores',
    'instalação de sistemas informatizados',
    'montagem de computadores',
    'montagem de equipamentos de informática'
  ];
  sinonimo TEXT;
BEGIN
  SELECT id INTO setor_id
  FROM public.setores
  WHERE (
    LOWER(UNACCENT(nome)) = LOWER(UNACCENT('Informática')) OR
    LOWER(UNACCENT(nome)) = LOWER(UNACCENT('Informatica')) OR
    LOWER(UNACCENT(nome)) LIKE LOWER(UNACCENT('%informática%'))
  )
  AND ativo = true
  LIMIT 1;
  
  IF setor_id IS NULL THEN RETURN; END IF;
  
  FOREACH sinonimo IN ARRAY sinonimos_informatica
  LOOP
    SELECT buscar_sinonimo('instalação', sinonimo) INTO sinonimo_id;
    
    IF sinonimo_id IS NOT NULL THEN
      INSERT INTO public.setores_sinonimos (setor_id, sinonimo_id, ativo)
      VALUES (setor_id, sinonimo_id, true)
      ON CONFLICT (setor_id, sinonimo_id) DO UPDATE SET ativo = true;
    END IF;
  END LOOP;
END $$;

-- ============================================
-- ASSOCIAR SINÔNIMOS AO SETOR "LIMPEZA"
-- ============================================

-- Sinônimos de "limpeza" para Limpeza
DO $$
DECLARE
  setor_id UUID;
  sinonimo_id UUID;
  sinonimos_limpeza TEXT[] := ARRAY[
    'limpeza predial',
    'limpeza de prédios',
    'limpeza de edifícios',
    'limpeza de escritórios',
    'limpeza de áreas comuns',
    'serviço de limpeza',
    'prestação de serviço de limpeza',
    'higienização',
    'assepsia'
  ];
  sinonimo TEXT;
BEGIN
  SELECT id INTO setor_id
  FROM public.setores
  WHERE (
    LOWER(UNACCENT(nome)) = LOWER(UNACCENT('Limpeza')) OR
    LOWER(UNACCENT(nome)) LIKE LOWER(UNACCENT('%limpeza%'))
  )
  AND ativo = true
  LIMIT 1;
  
  IF setor_id IS NULL THEN
    RAISE NOTICE 'Setor de Limpeza não encontrado. Verifique os nomes na tabela setores.';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Setor Limpeza encontrado: %', setor_id;
  
  FOREACH sinonimo IN ARRAY sinonimos_limpeza
  LOOP
    SELECT buscar_sinonimo('limpeza', sinonimo) INTO sinonimo_id;
    
    IF sinonimo_id IS NOT NULL THEN
      INSERT INTO public.setores_sinonimos (setor_id, sinonimo_id, ativo)
      VALUES (setor_id, sinonimo_id, true)
      ON CONFLICT (setor_id, sinonimo_id) DO UPDATE SET ativo = true;
      
      RAISE NOTICE 'Associado: %', sinonimo;
    ELSE
      RAISE NOTICE 'Sinônimo não encontrado: %', sinonimo;
    END IF;
  END LOOP;
END $$;

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
-- ESTATÍSTICAS FINAIS
-- ============================================

SELECT 
  COUNT(*) as total_associacoes,
  COUNT(DISTINCT setor_id) as setores_com_sinonimos,
  COUNT(DISTINCT sinonimo_id) as sinonimos_associados
FROM public.setores_sinonimos
WHERE ativo = true;

-- ============================================
-- LIMPAR FUNÇÕES AUXILIARES (OPCIONAL)
-- ============================================
-- Descomente se quiser remover as funções após usar
-- DROP FUNCTION IF EXISTS buscar_setor_por_nome(TEXT);
-- DROP FUNCTION IF EXISTS buscar_sinonimo(TEXT, TEXT);


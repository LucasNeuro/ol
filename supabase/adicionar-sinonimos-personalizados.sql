-- Adicionar coluna para sinônimos personalizados na tabela profiles
-- Permite que cada empresa configure seus próprios sinônimos para melhorar o filtro

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS sinonimos_personalizados jsonb NULL DEFAULT '{}'::jsonb;

-- Comentário explicativo
COMMENT ON COLUMN public.profiles.sinonimos_personalizados IS 
'JSONB com sinônimos personalizados da empresa. Formato: {"palavra_base": ["sinonimo1", "sinonimo2", ...]}';

-- Índice GIN para busca eficiente
CREATE INDEX IF NOT EXISTS idx_profiles_sinonimos_personalizados 
ON public.profiles USING gin (sinonimos_personalizados);

-- Exemplo de uso:
-- UPDATE profiles 
-- SET sinonimos_personalizados = '{"construção": ["obra", "edificação"], "limpeza": ["higienização"]}'::jsonb
-- WHERE id = 'uuid-do-usuario';


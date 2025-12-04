-- Corrigir tabela licitacoes_favoritas para usar tabela licitacoes correta

-- 1. Remover constraint antiga (se existir)
ALTER TABLE public.licitacoes_favoritas 
DROP CONSTRAINT IF EXISTS licitacoes_favoritas_licitacao_id_fkey;

-- 2. Adicionar constraint correta apontando para a tabela licitacoes (não licitacoes_backup_old)
ALTER TABLE public.licitacoes_favoritas
ADD CONSTRAINT licitacoes_favoritas_licitacao_id_fkey 
FOREIGN KEY (licitacao_id) REFERENCES public.licitacoes(id) ON DELETE CASCADE;

-- 3. Adicionar constraint UNIQUE para evitar duplicatas
ALTER TABLE public.licitacoes_favoritas
DROP CONSTRAINT IF EXISTS licitacoes_favoritas_usuario_licitacao_unique;

ALTER TABLE public.licitacoes_favoritas
ADD CONSTRAINT licitacoes_favoritas_usuario_licitacao_unique 
UNIQUE (usuario_id, licitacao_id);

-- 4. Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_favoritos_usuario 
ON public.licitacoes_favoritas(usuario_id);

CREATE INDEX IF NOT EXISTS idx_favoritos_licitacao 
ON public.licitacoes_favoritas(licitacao_id);

-- 5. Verificar estrutura final
\d licitacoes_favoritas;


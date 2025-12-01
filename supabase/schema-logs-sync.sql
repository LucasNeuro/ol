-- Tabela para logs de sincronização
-- Execute este script no SQL Editor do Supabase

CREATE TABLE IF NOT EXISTS public.logs_sync (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  data_sincronizacao text NOT NULL,
  total_encontrado integer DEFAULT 0,
  total_salvo integer DEFAULT 0,
  alertas_verificados integer DEFAULT 0,
  notificacoes_enviadas integer DEFAULT 0,
  sucesso boolean DEFAULT true,
  erro text,
  executado_em timestamp with time zone DEFAULT now(),
  CONSTRAINT logs_sync_pkey PRIMARY KEY (id)
);

-- Índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_logs_sync_executado_em ON public.logs_sync(executado_em DESC);
CREATE INDEX IF NOT EXISTS idx_logs_sync_data_sincronizacao ON public.logs_sync(data_sincronizacao);

-- RLS: Público (qualquer um pode ler)
ALTER TABLE public.logs_sync ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access to logs_sync" ON public.logs_sync;
CREATE POLICY "Public access to logs_sync" ON public.logs_sync
  FOR ALL USING (true) WITH CHECK (true);

-- Adicionar campo dados_completos na tabela licitacoes (se não existir)
ALTER TABLE public.licitacoes 
ADD COLUMN IF NOT EXISTS dados_completos boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_licitacoes_dados_completos ON public.licitacoes(dados_completos);


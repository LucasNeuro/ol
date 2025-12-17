-- Tabela para armazenar tokens de recuperação de senha
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  user_id uuid NOT NULL,
  token text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) 
    REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- Índice para busca rápida por token
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON public.password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON public.password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON public.password_reset_tokens(expires_at);

-- Índice para limpeza de tokens expirados
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_used_expires ON public.password_reset_tokens(used, expires_at);

-- Comentários
COMMENT ON TABLE public.password_reset_tokens IS 'Armazena tokens temporários para recuperação de senha';
COMMENT ON COLUMN public.password_reset_tokens.token IS 'Token único gerado para recuperação';
COMMENT ON COLUMN public.password_reset_tokens.expires_at IS 'Data e hora de expiração do token (geralmente 24 horas)';
COMMENT ON COLUMN public.password_reset_tokens.used IS 'Indica se o token já foi usado para redefinir a senha';


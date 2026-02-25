-- Tabela para fluxo de recuperação de senha via WhatsApp (Sim/Não + nova senha).
-- RPC para buscar user_id por email quando profiles não tiver coluna email sincronizada.

-- Tabela (criar se não existir)
CREATE TABLE IF NOT EXISTS public.password_reset_pendente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone text NOT NULL,
  email text,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  estado text NOT NULL DEFAULT 'aguardando_confirmacao' CHECK (estado IN ('aguardando_confirmacao', 'aguardando_senha')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_pendente_telefone ON public.password_reset_pendente(telefone);
CREATE INDEX IF NOT EXISTS idx_password_reset_pendente_created_at ON public.password_reset_pendente(created_at DESC);

-- RLS: apenas service_role (Edge Functions) acessa
ALTER TABLE public.password_reset_pendente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access password_reset_pendente" ON public.password_reset_pendente;
CREATE POLICY "Service role full access password_reset_pendente"
  ON public.password_reset_pendente FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- RPC: retorna user_id (uuid) pelo email (fallback quando profiles não tem email)
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT id FROM auth.users WHERE lower(trim(email)) = lower(trim(p_email)) LIMIT 1;
$$;

COMMENT ON TABLE public.password_reset_pendente IS 'Solicitações de reset de senha via WhatsApp (estado: aguardando_confirmacao | aguardando_senha)';
COMMENT ON FUNCTION public.get_user_id_by_email IS 'Usado pela Edge Function recuperar-senha-whatsapp para obter user_id quando profiles.email não está disponível.';

-- Adiciona preferência de resumo semanal em alertas_usuario.
-- Permite que o usuário receba um resumo semanal (e-mail e/ou WhatsApp) além do alerta diário.
-- Execute no SQL Editor do Supabase se a coluna ainda não existir.

ALTER TABLE alertas_usuario
ADD COLUMN IF NOT EXISTS resumo_semanal_ativo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN alertas_usuario.resumo_semanal_ativo IS 'Se true, o usuário recebe também o resumo semanal (últimos 7 dias) por este canal (tipo).';

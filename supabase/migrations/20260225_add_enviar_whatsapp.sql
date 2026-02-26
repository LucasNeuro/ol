-- ============================================================
-- MIGRATION: adicionar coluna enviar_whatsapp em alertas_usuario
-- ============================================================
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================

ALTER TABLE alertas_usuario
  ADD COLUMN IF NOT EXISTS enviar_whatsapp BOOLEAN NOT NULL DEFAULT false;

-- Confirmar
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'alertas_usuario' AND column_name = 'enviar_whatsapp';

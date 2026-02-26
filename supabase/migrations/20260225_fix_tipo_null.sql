-- ============================================================
-- CORREÇÃO: alertas com tipo = NULL → definir como 'email'
-- ============================================================
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Ver quantos registros serão afetados
SELECT id, nome_alerta, tipo, email_notificacao
FROM alertas_usuario
WHERE tipo IS NULL;

-- 2. Corrigir: setar tipo = 'email' onde está NULL
UPDATE alertas_usuario
SET tipo = 'email'
WHERE tipo IS NULL;

-- 3. Confirmar resultado
SELECT id, nome_alerta, tipo, ativo, horario_verificacao, email_notificacao
FROM alertas_usuario
ORDER BY created_at DESC;

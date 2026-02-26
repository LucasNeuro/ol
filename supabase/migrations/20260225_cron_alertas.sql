-- ============================================================
-- CRON: Disparo automático dos alertas diários
-- ============================================================
-- Execute este SQL no Supabase Dashboard > SQL Editor
-- (uma única vez, para configurar o cron permanentemente)
-- ============================================================

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================
-- REMOVER job antigo (evitar duplicata)
-- ============================================================
SELECT cron.unschedule('alerta-diario-cron')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'alerta-diario-cron'
);

-- ============================================================
-- CRIAR o job: dispara a cada 5 minutos
-- A Edge Function filtra internamente quem deve receber
-- baseada no horário configurado por cada usuário (±5 min)
-- ============================================================
SELECT cron.schedule(
  'alerta-diario-cron',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://ewqqxzvyehhitqbrbqzl.supabase.co/functions/v1/alerta-diario',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3cXF4enZ5ZWhoaXRxYnJicXpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzNjQ0MzcsImV4cCI6MjA3OTk0MDQzN30.gYYuQUtVPTast3bAnINEo-XMSi8CoN7Xdv0EO8ysAZY"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- ============================================================
-- VERIFICAR se o job está ativo
-- ============================================================
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname = 'alerta-diario-cron';

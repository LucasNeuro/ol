-- Tabela usuario_whatsapp_numeros: números de WhatsApp cadastrados por usuário (até 3)
-- Execute no SQL Editor do Supabase se a tabela ainda não existir.

-- Criar tabela
CREATE TABLE IF NOT EXISTS usuario_whatsapp_numeros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  numero_telefone text NOT NULL,
  label text,
  ordem smallint NOT NULL DEFAULT 1,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_usuario_whatsapp_usuario_id ON usuario_whatsapp_numeros(usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuario_whatsapp_ativo ON usuario_whatsapp_numeros(usuario_id, ativo) WHERE ativo = true;

-- RLS: usuário só acessa seus próprios números
ALTER TABLE usuario_whatsapp_numeros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuário vê seus números" ON usuario_whatsapp_numeros;
CREATE POLICY "Usuário vê seus números" ON usuario_whatsapp_numeros
  FOR SELECT USING (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "Usuário insere seus números" ON usuario_whatsapp_numeros;
CREATE POLICY "Usuário insere seus números" ON usuario_whatsapp_numeros
  FOR INSERT WITH CHECK (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "Usuário atualiza seus números" ON usuario_whatsapp_numeros;
CREATE POLICY "Usuário atualiza seus números" ON usuario_whatsapp_numeros
  FOR UPDATE USING (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "Usuário deleta seus números" ON usuario_whatsapp_numeros;
CREATE POLICY "Usuário deleta seus números" ON usuario_whatsapp_numeros
  FOR DELETE USING (auth.uid() = usuario_id);

COMMENT ON TABLE usuario_whatsapp_numeros IS 'Números de WhatsApp cadastrados pelo usuário para envio de licitações (até 3 por usuário).';

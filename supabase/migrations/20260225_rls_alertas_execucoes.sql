-- Habilitar RLS na tabela alertas_execucoes (caso ainda não esteja)
ALTER TABLE alertas_execucoes ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "usuarios podem ler suas execucoes" ON alertas_execucoes;
DROP POLICY IF EXISTS "service role pode inserir execucoes" ON alertas_execucoes;
DROP POLICY IF EXISTS "anon pode ler execucoes" ON alertas_execucoes;

-- Política: usuário autenticado pode ler execuções dos seus próprios alertas
CREATE POLICY "usuarios podem ler suas execucoes"
  ON alertas_execucoes
  FOR SELECT
  TO authenticated
  USING (
    alerta_id IN (
      SELECT id FROM alertas_usuario WHERE usuario_id = auth.uid()
    )
  );

-- Política: service role pode inserir (Edge Function usa service_role)
CREATE POLICY "service role pode tudo"
  ON alertas_execucoes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

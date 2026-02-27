-- ============================================================
-- MIGRATION: Notas e Anotações no Edital
-- ============================================================
-- Permite que o usuário adicione notas e cite trechos de
-- documentos de licitação diretamente no visualizador de PDF.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notas_edital (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  usuario_id    uuid        NOT NULL,
  licitacao_id  uuid        NOT NULL,
  trecho_citado text,                                      -- trecho colado/digitado (opcional)
  nota          text        NOT NULL,                      -- anotação do usuário
  pagina        integer,                                   -- página do documento (opcional)
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT notas_edital_pkey          PRIMARY KEY (id),
  CONSTRAINT notas_edital_usuario_fkey  FOREIGN KEY (usuario_id)   REFERENCES public.profiles(id)   ON DELETE CASCADE,
  CONSTRAINT notas_edital_licitacao_fkey FOREIGN KEY (licitacao_id) REFERENCES public.licitacoes(id) ON DELETE CASCADE
);

-- Index para busca rápida por usuário + licitação
CREATE INDEX IF NOT EXISTS notas_edital_usuario_licitacao_idx
  ON public.notas_edital (usuario_id, licitacao_id);

-- RLS: cada usuário vê e gerencia apenas suas próprias notas
ALTER TABLE public.notas_edital ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notas_edital: usuario gerencia proprias notas"
  ON public.notas_edital
  FOR ALL
  USING (
    usuario_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    usuario_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- Trigger para atualizar atualizado_em automaticamente
CREATE OR REPLACE FUNCTION public.set_atualizado_em()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notas_edital_atualizado_em ON public.notas_edital;
CREATE TRIGGER notas_edital_atualizado_em
  BEFORE UPDATE ON public.notas_edital
  FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();

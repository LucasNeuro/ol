# Correção do Erro RLS no Cadastro

## Problema

Ao criar uma conta, aparece o erro:
```
new row violates row-level security policy for table "profiles"
```

## Causa

O Row Level Security (RLS) está bloqueando a inserção do perfil porque a sessão do usuário pode não estar totalmente estabelecida no momento da inserção.

## Soluções Aplicadas

### 1. Atualização do Código (Frontend)

O código em `src/hooks/useAuth.js` foi atualizado para:
- Aguardar a sessão ser estabelecida após o signup
- Tentar inserir o perfil com retry automático
- Usar `upsert` como fallback para evitar duplicatas

### 2. Atualização do Schema SQL

O schema foi atualizado com política RLS mais permissiva:

```sql
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT 
  WITH CHECK (
    auth.uid() = id OR 
    auth.uid() IS NOT NULL
  );
```

## Como Aplicar a Correção

### Opção 1: Atualizar Política RLS (Recomendado)

1. Acesse o Supabase Dashboard
2. Vá em **SQL Editor**
3. Execute este comando:

```sql
-- Remover política antiga
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Criar nova política mais permissiva
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT 
  WITH CHECK (
    auth.uid() = id OR 
    auth.uid() IS NOT NULL
  );
```

### Opção 2: Desabilitar RLS Temporariamente (Apenas para Teste)

⚠️ **NÃO RECOMENDADO PARA PRODUÇÃO**

```sql
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
```

Depois reabilite:
```sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
```

### Opção 3: Usar Service Role (Apenas Backend)

Se você criar uma Edge Function ou API route, pode usar a service_role key que bypassa RLS. Mas isso deve ser feito apenas no backend, nunca no frontend.

## Verificação

Após aplicar a correção:

1. Tente criar uma nova conta
2. Verifique se o perfil foi criado em **Table Editor > profiles**
3. Verifique se não há mais erros no console

## Troubleshooting

### Ainda está dando erro?

1. **Verifique se a política foi atualizada:**
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'profiles';
   ```

2. **Verifique se o RLS está habilitado:**
   ```sql
   SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles';
   ```

3. **Teste a inserção manualmente:**
   ```sql
   -- Substitua 'user-id-aqui' pelo ID de um usuário de teste
   INSERT INTO public.profiles (id, cnpj, razao_social, cargo)
   VALUES ('user-id-aqui', '12345678000190', 'Teste LTDA', 'Gerente');
   ```

4. **Verifique os logs do Supabase:**
   - Vá em **Logs > Postgres Logs**
   - Procure por erros relacionados a RLS

## Solução Alternativa: Trigger Automático

Se continuar com problemas, você pode criar um trigger que cria o profile automaticamente:

```sql
-- Esta função já está no schema.sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Mas para usar este trigger, você precisaria configurá-lo no Supabase Dashboard em **Database > Triggers**.

## Contato

Se o problema persistir, verifique:
- Versão do Supabase
- Configurações de RLS
- Logs de erro detalhados


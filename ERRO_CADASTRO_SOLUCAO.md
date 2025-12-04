# 🔧 Solução para Erro de Cadastro

## ❌ Erro Identificado

```
infinite recursion detected in policy for relation "profiles"
```

### Causa:
As políticas RLS (Row Level Security) da tabela `profiles` no Supabase estão causando recursão infinita, provavelmente porque:
1. Uma política tenta verificar algo na própria tabela `profiles`
2. Políticas conflitantes ou mal configuradas
3. Referências circulares nas condições de política

---

## ✅ Solução

### Execute este SQL no Supabase:

1. Abra **Supabase Dashboard**
2. Vá em **SQL Editor**
3. Clique em **New Query**
4. Cole o conteúdo do arquivo: `supabase/fix-rls-profiles.sql`
5. Execute (Run)

### O que o SQL faz:

1. **Desabilita RLS temporariamente**
2. **Remove todas as políticas antigas** (que podem estar causando recursão)
3. **Habilita RLS novamente**
4. **Cria políticas SIMPLES e PERMISSIVAS** para desenvolvimento

---

## 📋 Políticas Criadas

### Para desenvolvimento (SEM RECURSÃO):
```sql
-- Permitir SELECT (consultar)
CREATE POLICY "Permitir todos os selects"
USING (true);

-- Permitir INSERT (cadastrar)
CREATE POLICY "Permitir todos os inserts"  
WITH CHECK (true);

-- Permitir UPDATE (atualizar)
CREATE POLICY "Permitir todos os updates"
USING (true) WITH CHECK (true);
```

---

## 🎯 Por Que Funciona?

As novas políticas:
- ✅ São SIMPLES (apenas `true`)
- ✅ NÃO fazem consultas na própria tabela
- ✅ NÃO causam recursão
- ✅ Permitem cadastro sem autenticação prévia
- ✅ Adequadas para desenvolvimento

---

## 🧪 Após Executar o SQL

1. **Volte no formulário de cadastro**
2. **Digite um CNPJ válido** (ex: 51.318.712/0001-94)
3. **Sistema busca dados automaticamente**
4. **Preenche campos**
5. **Digite email, senha e cargo**
6. **Clique em "Criar Conta Grátis"**
7. **Deve funcionar!** ✅

---

## ⚠️ Importante para Produção

Estas políticas são PERMISSIVAS e adequadas apenas para DESENVOLVIMENTO.

Em PRODUÇÃO, implemente políticas mais seguras:
- Verificar se é o próprio usuário (por email ou ID)
- Limitar acesso a dados sensíveis
- Validar permissões adequadamente

---

**Execute o SQL e teste novamente o cadastro!**



# 🧪 Teste de Cadastro e Login

## Opção 1: Cadastrar via Frontend (RECOMENDADO)

### 1. Limpar usuário antigo
Execute no Supabase SQL Editor:
```sql
DELETE FROM profiles WHERE email = 'lucasoffgod@hotmail.com';
```

### 2. Acessar página de cadastro
```
http://localhost:3000/cadastro
```

### 3. Preencher formulário
- **CNPJ:** Qualquer CNPJ válido (ex: `12.345.678/0001-90`)
- **Razão Social:** Nome da empresa
- **Email:** `lucasoffgod@hotmail.com`
- **Cargo:** Selecione qualquer um
- **Senha:** `@sacola10`
- **Confirmar Senha:** `@sacola10`

### 4. Clicar em "Criar Conta Grátis"

**Console vai mostrar:**
```
📝 Criando novo usuário...
✅ Email disponível
🔐 Senha hashada
✅ Usuário criado com sucesso!
```

### 5. Testar Login
Acesse: `http://localhost:3000/login`
- **Email:** `lucasoffgod@hotmail.com`
- **Senha:** `@sacola10`

**Console vai mostrar:**
```
🔐 Iniciando login...
✅ Usuário encontrado: lucasoffgod@hotmail.com
🔐 Verificando senha...
✅ Senha correta!
✅ Login bem-sucedido!
```

Se login funcionar → Redireciona para `/dashboard`

---

## Opção 2: Criar usuário direto no banco (ALTERNATIVA)

Se o cadastro pelo frontend não funcionar, use este SQL:

```sql
-- Execute: supabase/criar-usuario-teste.sql
INSERT INTO profiles (
  email,
  password_hash,
  cnpj,
  razao_social,
  nome_fantasia,
  cargo,
  ativo,
  tipo_acesso,
  created_at,
  updated_at
)
VALUES (
  'lucasoffgod@hotmail.com',
  '3d82fa8d73796c1882d2c0bda68a2ef323453393ecac6eadd4f2169a5632d123',
  '12345678000190',
  'EMPRESA TESTE LTDA',
  'Empresa Teste',
  'Dono',
  true,
  'usuario',
  NOW(),
  NOW()
);
```

Depois teste o login normalmente.

---

## 🔍 Debug

### Se o cadastro falhar:

1. **Abrir Console do navegador** (F12)
2. **Ver mensagens:**
   - ❌ Email já cadastrado → Executar `limpar-usuario-teste.sql`
   - ❌ Erro ao inserir → Verificar RLS policies
   - ❌ Erro de conexão → Verificar `.env` com credenciais Supabase

### Se o login falhar:

1. **Ver console:**
   - ❌ Usuário não encontrado → Verificar se email está correto
   - ❌ Senha incorreta → Hash pode estar errado
   - ❌ Erro de conexão → Verificar Supabase

2. **Verificar usuário no banco:**
```sql
SELECT email, password_hash, ativo 
FROM profiles 
WHERE email = 'lucasoffgod@hotmail.com';
```

3. **Verificar hash da senha:**
```bash
node -e "const crypto = require('crypto'); console.log(crypto.createHash('sha256').update('@sacola10').digest('hex'));"
```
Deve retornar: `3d82fa8d73796c1882d2c0bda68a2ef323453393ecac6eadd4f2169a5632d123`

---

## ✅ Checklist

- [ ] Usuário antigo removido
- [ ] Formulário de cadastro carrega sem erros
- [ ] Consegue preencher todos os campos
- [ ] Clica "Criar Conta" e não dá erro
- [ ] Redireciona para dashboard ou login
- [ ] Consegue fazer login com as credenciais
- [ ] Redireciona para dashboard após login
- [ ] Vê dados da empresa no dashboard
- [ ] Logout funciona e volta para /login

---

## 🎯 Resultado Esperado

1. **Cadastro bem-sucedido** → Redireciona para login ou dashboard
2. **Login bem-sucedido** → Redireciona para dashboard
3. **Dashboard carrega** → Mostra "Bem-vindo" + dados da empresa
4. **Sidebar funciona** → Menu com Dashboard, Licitações, etc
5. **Logout funciona** → Volta para login

**Teste agora e me avise o resultado!** 🚀



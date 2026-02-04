# Lógica de cadastro e recuperação de senha

Este documento descreve como funciona o **cadastro de nova empresa** (com validação de email via link) e a **recuperação de senha**, e onde o **Supabase** (provider Email) entra em cada fluxo.

---

## 1. Quem faz o quê

| Ação | Quem executa |
|------|-------------------------------|
| Enviar email de **confirmação de cadastro** (link) | **Supabase** (Auth), se "Confirm email" estiver ativo em **Authentication → Providers → Email**. |
| Enviar email de **recuperação de senha** (link) | **Supabase** (Auth), ao chamar `resetPasswordForEmail`. |
| Criar usuário no Auth e linha em `profiles` | **Sua aplicação** (chama Supabase Auth + insert em `profiles`). |
| Validar link e marcar email como confirmado / permitir troca de senha | **Supabase** (Auth), quando o usuário acessa o link enviado no email. |

Os templates de email (assunto, corpo, variáveis como `{{ .ConfirmationURL }}`) são configurados no dashboard: **Authentication → NOTIFICATIONS → Email**.

---

## 2. Fluxo de cadastro (nova empresa)

### 2.1 Onde está no código

- **Página**: `src/pages/cadastro.jsx`
- **Auth**: `src/lib/auth.js` → `signUp(email, password, profileData)`
- **Hook**: `src/hooks/useAuth.js` → `signUp` que chama `auth.signUp`

### 2.2 Passo a passo

1. **Usuário preenche o formulário**  
   Dados da empresa (CNPJ, razão social, etc.), email, senha, setores, estados, etc.

2. **Submit**  
   `cadastro.jsx` monta `dadosCompletos` (incluindo `setores_atividades`, `estados_interesse`) e chama:
   ```js
   await signUp(data.email, data.password, dadosCompletos)
   ```

3. **auth.signUp (auth.js)**  
   - Chama **Supabase Auth**:
     ```js
     supabase.auth.signUp({
       email: email.toLowerCase(),
       password,
       options: { emailRedirectTo: `${origin}/modulos` }
     })
     ```
   - **Supabase**:
     - Cria o usuário em `auth.users` (email pode ficar **não confirmado** se "Confirm email" estiver ativo).
     - Se a opção **Confirm email** estiver ativada em **Authentication → Sign In / Providers → Email**, o Supabase **envia automaticamente** o email de confirmação com um link. Quem envia é o Supabase (SMTP do projeto ou serviço configurado).
   - Se não houver erro, a aplicação faz **insert em `profiles`** com `id: user.id` e os dados do cadastro (razão social, setores, estados, etc.).
   - Retorna sucesso para o front.

4. **Front após signUp**  
   - Sincroniza palavras fortes (setores) em background.
   - Redireciona para `/modulos`:
     ```js
     setLocation('/modulos')
     ```

5. **Se "Confirm email" estiver ativo no Supabase**  
   - O usuário **ainda não confirmou** o email.
   - Ao tentar fazer **login** com email/senha, o Supabase pode retornar erro (por exemplo, "Email not confirmed") até que o usuário clique no link do email.
   - Quando o usuário **clica no link** do email de confirmação:
     - O Supabase valida o token.
     - Marca o email como **confirmado**.
     - Redireciona o usuário para a URL configurada em **emailRedirectTo** (no seu código: `${origin}/modulos`).

6. **Resumo**  
   - **Criação de conta e perfil**: sua aplicação (via `signUp` e insert em `profiles`).  
   - **Envio do email de confirmação e validação do link**: Supabase (provider Email), desde que **Confirm email** esteja habilitado no dashboard.  
   - O app **não** envia esse email; ele só chama `supabase.auth.signUp` e redireciona para `/modulos`. A mensagem “confira seu email para validar o cadastro” pode ser adicionada na tela após o cadastro para deixar claro que é preciso clicar no link.

---

## 3. Fluxo de recuperação de senha

Dois passos: (1) solicitar o link por email e (2) abrir o link e definir nova senha.

### 3.1 Etapa 1: Solicitar link (recuperar-senha)

**Onde está**: `src/pages/recuperar-senha.jsx` e `src/lib/auth.js` → `solicitarRecuperacaoSenha(email)`.

1. Usuário acessa **/recuperar-senha** e informa o **email**.
2. Front chama:
   ```js
   await solicitarRecuperacaoSenha(data.email)
   ```
3. **auth.js**:
   ```js
   const redirectTo = `${origin}/redefinir-senha`
   await supabase.auth.resetPasswordForEmail(emailNorm, { redirectTo })
   ```
4. **Supabase**:
   - Se o email existir em `auth.users`, gera um token de recuperação e **envia o email** com o link (template configurado em **Authentication → Email**).
   - O link aponta para o seu site com hash/token na URL; ao abrir, o Supabase trata o token e redireciona para `redirectTo` (no seu caso: **/redefinir-senha**).
5. **Front** mostra mensagem de sucesso: “Se o seu email estiver cadastrado, você receberá um link…” (por segurança não se diz se o email existe ou não).

Quem **envia o email** e **gera o link** é o **Supabase**; a aplicação só chama `resetPasswordForEmail` e define para onde o usuário vai após clicar (**/redefinir-senha**).

### 3.2 Etapa 2: Redefinir senha (redefinir-senha)

**Onde está**: `src/pages/redefinir-senha.jsx` e `src/lib/auth.js` → `hasRecoverySession`, `redefinirSenhaViaSupabase(newPassword)`.

1. Usuário **clica no link** do email e cai na sua app (URL com token no hash).
2. Supabase processa o token e estabelece uma **sessão de recuperação** (evento `PASSWORD_RECOVERY`).
3. Página **/redefinir-senha**:
   - Chama `hasRecoverySession()` (verifica se há sessão do Supabase após processar o hash).
   - Escuta `onAuthStateChange` para `SIGNED_IN` ou `PASSWORD_RECOVERY` (para quando o Supabase termina de processar o link).
4. Se **não** houver sessão de recuperação: mostra “Link inválido / Acesse pelo link enviado no e-mail” e botões para solicitar novo link ou voltar ao login.
5. Se **houver** sessão: mostra formulário “Nova senha” e “Confirmar nova senha”.
6. No submit:
   ```js
   await redefinirSenhaViaSupabase(data.password)
   ```
   - **auth.js**: `supabase.auth.updateUser({ password: newPassword })` (Supabase atualiza a senha do usuário da sessão de recuperação).
   - Em seguida: `signOut()` e retorno de sucesso.
7. Front mostra sucesso e redireciona para **/login** após alguns segundos.

Resumo: **envio do email e link** = Supabase; **página e formulário** = sua app; **troca efetiva da senha** = Supabase via `updateUser`, usando a sessão criada pelo link.

---

## 4. Configuração no Supabase (resumo)

Para a **validação de cadastro via link** funcionar como você descreveu:

1. **Authentication → Sign In / Providers → Email**  
   - Provider **Email** ativo (como na sua imagem).  
   - Opção **“Confirm email”** (ou equivalente) **ativada**, para que o Supabase envie o email de confirmação no signup.

2. **Authentication → NOTIFICATIONS → Email**  
   - Template **“Confirm signup”** (ou “Confirmar cadastro”): aqui você customiza o texto do email que contém o link de confirmação.  
   - Template de **“Reset password”** (recuperação de senha): customiza o email do link de redefinição.

3. **Redirect URLs**  
   - Em **Authentication → URL Configuration** (ou equivalente), inclua as URLs para onde o usuário é enviado após clicar nos links:
     - Cadastro: ex. `https://seu-dominio.com/modulos` (ou a origem do app).
     - Recuperação: ex. `https://seu-dominio.com/redefinir-senha`.
   - **Se a recuperação de senha não envia o email ou o link não funciona**, o motivo mais comum é essa URL **não** estar na lista. Veja o guia **RECUPERACAO_SENHA_SUPABASE.md** para o checklist completo.

Assim, a **lógica de cadastro** (incluindo “validar cadastro via link enviado no email”) e a **lógica de recuperação de senha** estão alinhadas: o Supabase é quem envia os emails e valida os links; sua aplicação usa o provider Email, chama `signUp` e `resetPasswordForEmail`/`updateUser` e redireciona para as rotas corretas.

---

## 5. Referência rápida de arquivos

| Arquivo | Função |
|---------|--------|
| **src/lib/auth.js** | `signUp`, `solicitarRecuperacaoSenha`, `hasRecoverySession`, `redefinirSenhaViaSupabase`. |
| **src/pages/cadastro.jsx** | Formulário de cadastro; chama `signUp` e redireciona para `/modulos`. |
| **src/pages/recuperar-senha.jsx** | Formulário de email; chama `solicitarRecuperacaoSenha`. |
| **src/pages/redefinir-senha.jsx** | Verifica sessão de recuperação; formulário nova senha; chama `redefinirSenhaViaSupabase`. |
| **src/hooks/useAuth.js** | Expõe `signUp` que chama `auth.signUp`. |

---

*Documento alinhado ao uso do provider Email do Supabase e ao fluxo atual do projeto.*

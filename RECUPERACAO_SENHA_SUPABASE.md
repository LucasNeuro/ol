# Recuperação de senha — 100% Supabase

A recuperação de senha **não envia email pela aplicação**: quem envia o link é o **Supabase**. O app só chama `resetPasswordForEmail(email, { redirectTo })`. Se o email não chega ou o link não funciona, ajuste o projeto no dashboard do Supabase.

---

## 1. Checklist no Supabase (por que não funciona)

Siga na ordem. Sem isso, o email pode não ser enviado ou o link pode quebrar.

### 1.1 URL Configuration (obrigatório)

1. No Supabase: **Authentication** → **URL Configuration**.
2. **Site URL**: deve ser a URL base do seu app (ex.: `https://seusite.com` ou `http://localhost:5173`).
3. **Redirect URLs**: adicione **uma linha por URL** onde o usuário pode cair após clicar no link do email:
   - Produção: `https://seusite.com/redefinir-senha`
   - Desenvolvimento: `http://localhost:5173/redefinir-senha` (ou a porta que você usa).

Se a URL de redirecionamento **não** estiver em **Redirect URLs**, o Supabase pode não enviar o email ou o link pode abrir com erro.

### 1.2 Provider Email ativo

1. **Authentication** → **Sign In / Providers** → **Email**.
2. Confirme que o provider **Email** está **Enabled**.

### 1.3 Template "Reset password"

1. **Authentication** → **NOTIFICATIONS** → **Email**.
2. Abra o template **"Reset password"** (ou "Redefinir senha").
3. Verifique se está **habilitado** e se o corpo do email usa o link de redefinição (ex.: `{{ .ConfirmationURL }}` ou o que o Supabase indica no template).
4. Não é necessário alterar nada no código do app para “validar email na profile”: o Supabase usa apenas **auth.users**; o email do usuário deve existir em **auth.users** (criado no cadastro).

### 1.4 Envio de emails (SMTP)

- Por padrão o Supabase usa o próprio serviço de email (com limites).
- Se nenhum email chega (nem em spam), em **Project Settings** → **Auth** (ou **Authentication** → configurações de email) verifique se há **Custom SMTP**. Em produção, configurar SMTP (ex.: Resend, SendGrid) costuma melhorar entrega.
- Confirme também se o domínio/remetente não está bloqueado ou em lista de bloqueio.

### 1.5 Usuário existe em auth.users

- O Supabase **só envia** recuperação se o email existir na tabela **auth.users** (não só em `profiles`).
- Quem faz o cadastro é o `signUp`, que cria **auth.users + profiles**. Se o usuário foi criado só em `profiles` por outro meio, a recuperação não será enviada para esse email.
- No dashboard: **Authentication** → **Users** e confira se o email aparece lá.

---

## 2. O que o app faz (para conferência)

- **recuperar-senha**: usuário informa o email → o app chama `solicitarRecuperacaoSenha(email)`.
- **auth.js**: `supabase.auth.resetPasswordForEmail(email, { redirectTo: origin + '/redefinir-senha' })`.
- **redirectTo** precisa ser a URL **completa** da página de redefinir senha (ex.: `https://seusite.com/redefinir-senha`). O app usa `window.location.origin` (ou, se existir, a variável `VITE_APP_URL` no `.env`) para montar essa URL. Em produção, se o app estiver atrás de proxy ou em um domínio diferente, defina `VITE_APP_URL=https://seusite.com` no ambiente para garantir que o link do email aponte para o domínio certo.
- O Supabase envia o email; o usuário clica no link → cai em **/redefinir-senha** → o app chama `updateUser({ password })` e faz logout.

Ou seja: envio e link são **100% Supabase**; o app só chama a API e exibe as telas.

---

## 3. Resumo rápido

| O que verificar | Onde no Supabase |
|-----------------|-------------------|
| URL de redirecionamento após clicar no link | **Authentication** → **URL Configuration** → **Redirect URLs** (ex.: `https://seusite.com/redefinir-senha`) |
| Site URL correta | **URL Configuration** → **Site URL** |
| Provider Email ativo | **Authentication** → **Providers** → **Email** → Enabled |
| Template de reset ativo e com link | **Authentication** → **NOTIFICATIONS** → **Email** → Reset password |
| Email existe no Auth | **Authentication** → **Users** (email deve estar em auth.users) |
| Emails não chegam | **Project Settings** / **Auth** → SMTP ou limite de envio |

Depois de ajustar **Redirect URLs** e **Site URL**, teste de novo. Na maioria dos casos o problema é a URL de redirecionamento não estar na lista.

# Deploy no Render

Este guia explica como configurar o **Sistema Licitação** no Render para que **login**, **cadastro** e **recuperação de senha** funcionem corretamente.

## Por que "Supabase não configurado"?

O frontend (Vite) usa as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` **em tempo de build**. Elas são injetadas no JavaScript durante `npm run build`. Se essas variáveis **não estiverem definidas no Render** quando o build roda, o app fica sem conexão com o Supabase e você vê:

- **"Supabase não configurado"** ao tentar login, cadastro ou recuperar senha.

**Solução:** configurar as variáveis de ambiente no serviço do frontend **e fazer um novo deploy** (para que o build use essas variáveis).

---

## 1. Variáveis de ambiente no Render

### Frontend (Static Site – `sistema-licitacao-frontend`)

1. Acesse o [Dashboard do Render](https://dashboard.render.com).
2. Abra o serviço **sistema-licitacao-frontend** (Static Site).
3. Vá em **Environment** (menu lateral).
4. Adicione:

   | Key | Value |
   |-----|--------|
   | `VITE_SUPABASE_URL` | `https://SEU-PROJETO.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | Sua chave **anon** (pública) do Supabase |

   Os valores estão em **Supabase → Settings → API**:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** → `VITE_SUPABASE_ANON_KEY`

5. Salve (**Save Changes**).
6. Faça um **novo deploy**: **Manual Deploy → Deploy latest commit** (ou push no repositório, se o deploy for automático).

O build é executado de novo **com** as variáveis definidas; o JavaScript passa a ter o Supabase configurado e login/recuperação de senha voltam a funcionar.

---

### Worker de alertas (`verificar-alertas`) – opcional

Se você usa o worker que verifica alertas e envia e-mails:

1. Abra o serviço **verificar-alertas** no Render.
2. Em **Environment**, configure:

   | Key | Value |
   |-----|--------|
   | `VITE_SUPABASE_URL` ou `SUPABASE_URL` | `https://SEU-PROJETO.supabase.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | Chave **service_role** (Supabase → Settings → API) |

3. Salve e redeploy o worker.

---

## 2. Checklist rápido

- [ ] `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` definidas no **frontend**.
- [ ] **Novo deploy** do frontend após alterar as variáveis.
- [ ] Projeto Supabase criado e tabelas (ex.: `profiles`) configuradas.
- [ ] **Redirect URLs** no Supabase: Authentication → URL Configuration → adicione `https://SEU-SITE.onrender.com/redefinir-senha` e `http://localhost:3000/redefinir-senha`.

---

## 3. Recuperação de senha (mecanismo nativo do Supabase)

Seguimos o fluxo oficial **Redefinir uma senha** da [documentação Supabase (Auth baseada em senha)](https://supabase.com/docs/guides/auth/passwords):

1. **Etapa 1 –** Página `/recuperar-senha`: coletar e-mail → `resetPasswordForEmail(email, { redirectTo })`. O Supabase envia o e-mail com o link.
2. **Etapa 2 –** Página `/redefinir-senha` (no `redirectTo`): usuário acessa pelo link → sessão de recuperação → `updateUser({ password })` → redireciona para login.

**Redirect URLs:** Em **Supabase → Authentication → URL Configuration**, adicione a URL do app para `/redefinir-senha` (ex.: `https://seu-app.onrender.com/redefinir-senha` e `http://localhost:5173/redefinir-senha`). Sem isso, o link não redireciona.

**E-mail:** A doc diz que os fluxos de confirmação e **redefinição exigem SMTP**. O Supabase tem serviço padrão (limite baixo; só equipe em muitos casos). Para produção, use **SMTP personalizado** (seção 3.2).

### 3.1 “Equipe” do Supabase vs usuários do seu app

- **Equipe do Supabase** = pessoas que **gerenciam o projeto** no Supabase (você, devs). São os e-mails em **Organization → Team** (ou **Settings → Team**).
- **Usuários do seu app** = quem se cadastra no **sistema de licitação** (clientes, usuários finais). Eles **não** fazem parte da “equipe” do Supabase.

O SMTP **padrão** do Supabase envia e-mails de auth (reset de senha, etc.) **só para a equipe**. Por isso, com o padrão, **só você e quem está na equipe** recebem o e-mail de recuperação. Os **usuários do seu site** não recebem.

**Para quê serve isso?** Ajuda a testar sem configurar nada (use seu próprio e-mail na equipe). Para **produção**, ou seja, para que **qualquer usuário cadastrado** receba o reset de senha, é obrigatório configurar **SMTP customizado** (próxima seção).

### 3.2 SMTP customizado (obrigatório para usuários do app)

Para o **reset de senha chegar no e-mail dos usuários do sistema** (não só da equipe Supabase):

1. Abra **Supabase → Authentication → SMTP Settings** (ou **Providers → Email**).
2. Ative **Custom SMTP** e preencha com um provedor de e-mail:
   - **Resend**, **SendGrid**, **Mailgun**, **Amazon SES** ou SMTP genérico.
3. Exemplo com **Resend** (grátis para começar):
   - Crie conta em [resend.com](https://resend.com), verifique um domínio (ou use `onboarding@resend.dev` só para teste).
   - Em **API Keys**, crie uma chave.
   - No Supabase, use:
     - **Host:** `smtp.resend.com`
     - **Port:** `465` (SSL) ou `587` (TLS)
     - **User:** `resend`
     - **Password:** sua API key do Resend
     - **Sender email / From:** um e-mail válido (ex.: `noreply@seudominio.com` ou o de teste do Resend).
4. Salve. A partir daí, o Supabase usará esse SMTP para **todos** os e-mails de auth (recuperação de senha, confirmação, etc.), inclusive para os **usuários do seu app**.

Não é preciso mudar nada no código do sistema de licitação: ele continua usando o mecanismo nativo do Supabase (`resetPasswordForEmail`). Só a **entrega** do e-mail passa a ser feita pelo seu SMTP.

**Resumo:** “Equipe” = quem administra o Supabase. Usuários do app = quem usa o site. Para reset de senha funcionar para os usuários do app, configure SMTP customizado no Supabase.

### Checklist antes de testar o reset

- [ ] **Redirect URLs:** `https://SEU-SITE.onrender.com/redefinir-senha` e `http://localhost:5173/redefinir-senha` (ou a porta do Vite, ex. 3000) em **Authentication → URL Configuration**.
- [ ] **SMTP customizado** configurado (Host, Port, User, Password, Sender email e nome).
- [ ] **Usuário de teste** existe em **auth.users** (cadastrado via Supabase Auth, ex.: pelo próprio app).
- [ ] Frontend com `VITE_SUPABASE_*` definidas e **deploy refeito** (se usar Render).

### Migração de usuários antigos

O sistema passou a usar **Supabase Auth** (login e recuperação de senha nativos). Usuários antigos que existiam apenas na tabela `profiles` (sem registro em `auth.users`) não conseguirão fazer login até que exista um correspondente em `auth.users`. Para migrar: criar usuário em Auth para cada perfil (por exemplo via script ou Supabase Dashboard) e, se necessário, disparar “recuperar senha” para cada um definir nova senha.

---

## 4. Erro persiste?

- **Supabase não configurado / login falha:** Variáveis no serviço **correto** (frontend)? **Deploy** refeito **depois** de salvar? DevTools (F12) → Console: ainda aparece aviso de Supabase?
- **E-mail de recuperação não chega para usuários do app:** Configure **SMTP customizado** (seção 3.2). O SMTP padrão envia só para a equipe do Supabase. Para testes rápidos, use um e-mail que esteja na equipe. Confira também **Auth logs** (Authentication → Logs) se houver erro ao enviar.
- **Link "Redefinir senha" não abre o formulário:** A URL de redirect deve ser **exatamente** a que está em Redirect URLs (ex.: `https://seu-app.onrender.com/redefinir-senha`). Verifique também se não há bloqueio de cookies/third-party no navegador.

Com variáveis corretas, Redirect URLs, usuário em `auth.users` e **SMTP customizado** (para usuários do app), login e recuperação de senha funcionam de ponta a ponta.

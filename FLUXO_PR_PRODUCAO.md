# Fluxo de PR antes de ir para produção

Este projeto é um **fork** do repositório original. A aplicação está em produção no **Render** (frontend_sistema_licitacao). Para que mudanças só subam para produção após aprovação, use o fluxo abaixo.

---

## 1. Confirmar onde o Render está conectado

- No **Render** → projeto **front_lici** → serviço **frontend_sistema_licitacao** → **Settings** (ou **Connect**).
- Veja qual repositório e branch estão configurados (ex.: `usuario/repo-original` e branch `main`).
- **Produção deve estar ligada ao repositório ORIGINAL (upstream), branch `main`.** Assim, só o merge no original dispara o deploy.

Se o Render estiver apontando para o **fork**, mude para o repositório original e branch `main` para que produção só atualize quando alguém fizer merge no original.

---

## 2. Configurar o remoto upstream (uma vez)

No seu fork (esta pasta), adicione o repositório original como `upstream`:

```bash
# Ver remotos atuais (geralmente só "origin" = seu fork)
git remote -v

# Adicionar o repositório original como "upstream" (troque pela URL real do original)
git remote add upstream https://github.com/ORGANIZACAO/repo-original.git

# Ou se for SSH:
# git remote add upstream git@github.com:ORGANIZACAO/repo-original.git
```

Troque `ORGANIZACAO/repo-original` pela URL real do repositório de onde você fez o fork.

---

## 3. Trabalhar em um branch (não commitar direto na main do fork)

Sempre que for mandar mudanças para revisão:

```bash
# Atualizar sua main com a do original (opcional mas recomendado)
git fetch upstream
git checkout main
git merge upstream/main

# Criar um branch para sua feature/correção
git checkout -b nome-da-feature
# Ex.: git checkout -b fix-redefinir-senha
# Ex.: git checkout -b ui-sideover

# Fazer seus commits
git add .
git commit -m "Descrição clara da alteração"

# Enviar o branch para o SEU fork (origin)
git push -u origin nome-da-feature
```

---

## 4. Abrir o Pull Request

1. Abra o **seu fork** no GitHub (repositório que está em `origin`).
2. O GitHub costuma mostrar um banner: **“nome-da-feature had recent pushes”** com botão **“Compare & pull request”**. Clique nele.
3. **Importante:** na tela do PR, confira:
   - **base:** repositório **original** (upstream), branch `main`.
   - **compare:** seu fork, branch `nome-da-feature`.
4. Preencha título e descrição do PR e crie o Pull Request.

Assim, o PR fica “fork → original”, e o merge acontece no repositório original. Quem tem permissão no original aprova e faz o merge.

---

## 5. Depois do merge no original

- O **Render** (se estiver conectado ao repo original, branch `main`) vai fazer o deploy automático após o merge.
- No seu fork, você pode atualizar a `main` e apagar o branch:

```bash
git checkout main
git fetch upstream
git merge upstream/main
git push origin main
git branch -d nome-da-feature
git push origin --delete nome-da-feature   # opcional, limpar no GitHub
```

---

## Resumo rápido

| Onde você está        | Onde envia (push) | O que acontece na produção |
|-----------------------|-------------------|----------------------------|
| Branch no fork        | `git push origin nome-da-feature` | Nada (produção vem do original) |
| Abre PR fork → original | —                 | Nada até alguém aprovar e dar merge |
| Merge no original (main) | —                | Render faz deploy (se estiver ligado ao original) |

Assim você **só reflete na aplicação em produção depois de criar o PR e alguém aprovar e fazer merge no repositório original.**

---

## Preview / Staging no Render (opcional)

Se quiser um ambiente de **preview** (ex.: uma URL por PR):

- No Render, em **Settings** do serviço, veja se há **“Preview Environments”** ou **“Branch deploys”**.
- Dá para configurar para fazer deploy de branches (ex.: seu branch do fork ou do original) em URLs separadas, para testar antes de mergear em `main`.

Isso não substitui o PR; só dá uma URL extra para testar as mudanças antes de aprovar.

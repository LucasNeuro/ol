# Sistema Licitação

Sistema B2B para busca, rastreamento e gestão de oportunidades de licitações públicas no Brasil.

## Tecnologias

- **Frontend**: React 18 + JavaScript + Vite
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **UI**: Tailwind CSS + shadcn/ui components
- **Roteamento**: Wouter
- **Estado**: TanStack Query (React Query)
- **Formulários**: React Hook Form + Zod
- **API Externa**: PNCP (Portal Nacional de Contratações Públicas)
- **Documentação**: Swagger/OpenAPI

## Configuração

### ⚠️ IMPORTANTE: Você PRECISA configurar:

1. **Supabase** (obrigatório para funcionalidades completas):
   - Criar projeto em https://supabase.com
   - Executar o schema SQL: copie e execute `supabase/schema.sql` no SQL Editor do Supabase
   - Obter credenciais em Settings > API

2. **Arquivo .env** (obrigatório):
   ```bash
   # Criar arquivo .env na raiz do projeto
   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui
   ```

3. **Instalar dependências:**
```bash
npm install
```

4. **Executar em desenvolvimento:**
```bash
npm run dev
```

📖 **Guia completo:** Veja `CONFIGURACAO_COMPLETA.md` para instruções detalhadas passo a passo.

## Estrutura do Projeto

```
/
  src/              # Frontend React
    components/      # Componentes reutilizáveis
    pages/           # Páginas da aplicação
    hooks/           # Custom hooks
    lib/             # Utilitários e configurações
    styles/          # Estilos globais
  
  supabase/          # Scripts SQL do banco
    schema.sql       # Schema principal
    functions/       # Edge Functions
```

## Funcionalidades

- 🔍 Busca avançada de licitações (direto da API do PNCP)
- 📅 Boletim diário de licitações
- 🔔 Alertas por email
- ⭐ Licitações favoritas
- 📄 Visualização de documentos e anexos
- 👤 Autenticação personalizada

